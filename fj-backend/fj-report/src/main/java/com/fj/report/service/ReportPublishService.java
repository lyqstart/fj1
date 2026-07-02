package com.fj.report.service;

import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.common.export.OfficialReportExporter;
import com.fj.report.entity.Report;
import com.fj.report.entity.ReportStatus;
import com.fj.report.repository.ReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * 报告发布固化 Service（TASK-042 / BR-4 发布即固化）。
 *
 * <p>核心职责：将审批通过（PENDING_PUBLISH）的报告固化为已发布（PUBLISHED）的不可篡改 Word 文档。
 *
 * <p>发布流程：
 * <ol>
 *   <li>预校验报告状态为 PENDING_PUBLISH（仅审批通过的报告可发布）</li>
 *   <li>调用 {@link OfficialReportExporter#exportForPublish} 生成固化 Word
 *       （版本化不可覆盖路径 + SHA-256，NFR-5 ≤120s）</li>
 *   <li>导出成功 → 报告状态 PENDING_PUBLISH → PUBLISHED，写入 published_at + locked_at（整体锁定）</li>
 * </ol>
 *
 * <p>失败语义（BR-4）：导出失败时报告状态保持 PENDING_PUBLISH 不变。
 * 关键设计：固化导出 <b>不在</b> 报告状态变更事务内执行 —— Exporter 自行管理 ExportFile 落库
 * （SUCCESS/FAILED 记录独立提交），因此导出失败时 Exporter 写入的 FAILED 留痕（§103）不会被报告事务回滚，
 * 同时报告状态因后续 {@link #markPublished} 未被调用而保持不变。
 *
 * <p>锁定策略：通过 {@link Report#getLockedAt()} 在报告级别整体锁定
 * （已发布报告禁止编辑，由 {@link ReportService#detail} + requireEditable 守护）。
 * ReportIssueSnapshot 不单独加 locked_at 列 —— 其不可变性由 Report 级锁定 + 快照本身为
 * 发布时刻冻结的不可变快照语义共同保证（§9.4）。
 *
 * <p>循环依赖处理：本服务依赖 {@code fj-common} 中的 {@link OfficialReportExporter} 端口接口，
 * 实际实现（PoiTlExportEngine）位于 {@code fj-export}，运行期由 Spring 注入，避免 fj-report → fj-export 的模块环。
 *
 * <p>自注入说明：{@link #markPublished} 通过 self 代理调用以激活 {@code @Transactional}
 * （同类内部 this 调用不会经过 Spring 代理，事务注解将失效）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportPublishService {

    private final ReportRepository reportRepository;
    private final OfficialReportExporter officialReportExporter;

    /**
     * 自身代理引用，用于在 {@link #publish} 中通过代理调用 {@link #markPublished} 激活事务。
     * <p>使用 {@code @Lazy} 打破构造期自引用循环。
     */
    @Lazy
    @Autowired
    private ReportPublishService self;

    /**
     * 发布报告（生成固化 Word 并锁定）。
     *
     * <p>本方法本身不加 {@code @Transactional}：固化导出（可能耗时 ≤120s）需在事务外执行，
     * 使 Exporter 的 ExportFile(SUCCESS/FAILED) 记录独立提交；仅报告状态变更走独立短事务。
     *
     * @param reportId    报告 ID
     * @param publisherId 发布人 ID
     * @return 已发布的报告（status=PUBLISHED）
     */
    public Report publish(Long reportId, Long publisherId) {
        // 1. 预校验：快速失败，避免无效的长耗时导出
        requirePendingPublish(reportId);

        // 2. 固化导出（事务外）：Exporter 内部渲染 → 落盘（不可覆盖路径）→ SHA-256 → 写 ExportFile。
        //    失败时 Exporter 写 ExportFile(FAILED) 留痕（独立提交）并抛异常 → 报告状态不变（BR-4）。
        officialReportExporter.exportForPublish(reportId, publisherId);

        // 3. 导出成功 → 报告状态固化为 PUBLISHED（独立短事务，事务内复核状态防并发重复发布）
        Report published = self.markPublished(reportId, publisherId);

        log.info("报告 {} 发布固化成功: publisher={}, publishedAt={}",
                reportId, publisherId, published.getPublishedAt());
        return published;
    }

    /**
     * 报告状态流转：PENDING_PUBLISH → PUBLISHED，并写入 published_at / locked_at。
     *
     * <p>事务内重新校验状态（requirePendingPublish），覆盖预校验与状态变更之间的并发窗口：
     * 若并发发布使状态已变更，则本次事务回滚并抛出状态非法异常。
     *
     * <p>必须通过 Spring 代理调用（self）才能生效，故声明为 public。
     *
     * @param reportId    报告 ID
     * @param publisherId 发布人 ID
     * @return 已发布的报告
     */
    @Transactional
    public Report markPublished(Long reportId, Long publisherId) {
        Report report = requirePendingPublish(reportId);
        OffsetDateTime now = OffsetDateTime.now();
        report.setStatus(ReportStatus.PUBLISHED);
        report.setPublishedAt(now);
        report.setLockedAt(now);
        report.setUpdatedBy(publisherId);
        return reportRepository.save(report);
    }

    // ==================== 内部工具 ====================

    /** 校验报告处于待发布状态（仅 PENDING_PUBLISH 可发布，BR-8 状态机） */
    private Report requirePendingPublish(Long reportId) {
        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "报告不存在: " + reportId));
        if (report.getStatus() != ReportStatus.PENDING_PUBLISH) {
            throw new BusinessException(ErrorCode.BIZ_OPERATION_NOT_ALLOWED,
                    "报告状态为 " + report.getStatus() + "，仅 PENDING_PUBLISH 可发布（BR-8）");
        }
        return report;
    }
}
