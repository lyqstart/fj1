package com.fj.inspection.service;

import com.fj.common.enume.CorrectionStatus;
import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.inspection.entity.DailyReport;
import com.fj.inspection.entity.DailyReportStatus;
import com.fj.inspection.repository.DailyReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 日报提交 Service（REQ-10，§9.1 三层状态联动 + BR-5 状态机）。
 * <p>核心职责：
 * <ul>
 *   <li>三层校验（{@link DailyReportValidator}）：硬阻断 / 配置阻断 / 强提醒</li>
 *   <li>提交逻辑：DRAFT → SUBMITTED 状态联动，单事务保证 {@code DailyReport.status} +
 *       所有 {@code DailyReportIssue.correction_status} 一致</li>
 * </ul>
 * <p>多任务日报整体操作（§101.22）：一份日报所有关联的 DailyReportTask 同步变更，不支持局部确认。
 * <p>注意：问题池生成（ProjectIssue）由 {@code IssuePoolService}（fj-issue 模块）在日报确认流程（TASK-031）处理，
 * 本 Service 仅负责提交阶段（DRAFT → SUBMITTED），不跨模块调用。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DailyReportSubmitService {

    private final DailyReportRepository dailyReportRepository;
    private final DailyReportValidator validator;

    // ==================== 查询 ====================

    /**
     * 多条件查询日报。
     */
    @Transactional(readOnly = true)
    public List<DailyReport> list(Long projectId, LocalDate reportDate, Long inspectorId, DailyReportStatus status) {
        if (projectId != null && reportDate != null) {
            return dailyReportRepository.findByProjectIdAndReportDate(projectId, reportDate);
        }
        if (inspectorId != null && status != null) {
            return dailyReportRepository.findByInspectorIdAndStatus(inspectorId, status);
        }
        if (projectId != null) {
            return dailyReportRepository.findByProjectId(projectId);
        }
        return dailyReportRepository.findAll();
    }

    /** 查看日报详情 */
    @Transactional(readOnly = true)
    public DailyReport detail(Long id) {
        return requireReport(id);
    }

    // ==================== 草稿管理 ====================

    /**
     * 创建日报草稿（仅硬阻断校验）。
     */
    @Transactional
    public DailyReport createDraft(DailyReport report) {
        if (report.getStatus() == null) {
            report.setStatus(DailyReportStatus.DRAFT);
        }
        validator.validateHardBlock(report);
        return dailyReportRepository.save(report);
    }

    /**
     * 编辑日报草稿（仅 DRAFT / RETURNED 状态可编辑）。
     */
    @Transactional
    public DailyReport editDraft(Long id, DailyReport patch) {
        DailyReport existing = requireReport(id);
        if (existing.getStatus() != DailyReportStatus.DRAFT
                && existing.getStatus() != DailyReportStatus.RETURNED) {
            throw new BusinessException(ErrorCode.BIZ_OPERATION_NOT_ALLOWED,
                    "日报状态为 " + existing.getStatus() + "，不可编辑（仅 DRAFT/RETURNED 可编辑）");
        }
        if (patch.getReportDate() != null) {
            existing.setReportDate(patch.getReportDate());
        }
        if (patch.getTaskId() != null) {
            existing.setTaskId(patch.getTaskId());
        }
        if (patch.getInspectorId() != null) {
            existing.setInspectorId(patch.getInspectorId());
        }
        validator.validateHardBlock(existing);
        return dailyReportRepository.save(existing);
    }

    // ==================== 提交（§9.1 三层状态联动单事务）====================

    /**
     * 提交日报：DRAFT → SUBMITTED（§9.1 单事务保证三层状态一致）。
     * <p>单事务内完成：
     * <ol>
     *   <li>三层校验（硬阻断 + 配置阻断 + 强提醒收集）</li>
     *   <li>更新 {@code DailyReport.status = SUBMITTED}，写入 {@code submitted_at}</li>
     *   <li>联动更新所有 {@code DailyReportIssue.correction_status}（保持联动一致性）</li>
     * </ol>
     *
     * @return 提交后的日报（含强提醒可由调用方通过日志感知）
     */
    @Transactional
    public DailyReport submit(Long id) {
        DailyReport report = requireReport(id);

        // 1. 状态流转守卫：仅 DRAFT / RETURNED 可提交
        if (report.getStatus() != DailyReportStatus.DRAFT
                && report.getStatus() != DailyReportStatus.RETURNED) {
            throw new BusinessException(ErrorCode.BIZ_STATE_INVALID_TRANSITION,
                    "日报状态流转不合法：" + report.getStatus() + " → SUBMITTED"
                            + "（需从 DRAFT 或 RETURNED 迁移）");
        }

        // 2. 三层校验（硬阻断 + 配置阻断会抛异常；强提醒仅记录日志）
        validator.validateSubmitHardBlock(report);
        List<String> warnings = validator.validate(report);
        if (!warnings.isEmpty()) {
            log.warn("日报 {} 提交存在强提醒：{}", id, warnings);
        }

        // 3. 更新 DailyReport.status + submitted_at（§9.1 第 2 步）
        report.setStatus(DailyReportStatus.SUBMITTED);
        report.setSubmittedAt(OffsetDateTime.now());
        DailyReport saved = dailyReportRepository.save(report);

        // 4. 联动更新所有 DailyReportIssue.correction_status（§9.1 第 3 步，保持联动一致性）
        //    提交日报：问题进入待整改状态（PENDING，等待日报确认后映射到问题池）
        dailyReportRepository.updateIssueStatusByReport(id, CorrectionStatus.PENDING);

        log.info("日报 {} 提交成功（DRAFT/RETURNED → SUBMITTED），联动问题状态更新完成", id);
        return saved;
    }

    // ==================== 内部工具 ====================

    private DailyReport requireReport(Long id) {
        return dailyReportRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "日报不存在: " + id));
    }
}
