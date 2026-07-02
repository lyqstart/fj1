package com.fj.inspection.service;

import com.fj.approval.entity.ApprovalFlowType;
import com.fj.approval.entity.ApprovalInstance;
import com.fj.approval.entity.ApprovalStatus;
import com.fj.approval.entity.ApprovalTask;
import com.fj.approval.service.ApprovalEngineService;
import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.inspection.entity.DailyReport;
import com.fj.inspection.entity.DailyReportIssue;
import com.fj.inspection.entity.DailyReportStatus;
import com.fj.inspection.repository.DailyReportIssueRepository;
import com.fj.inspection.repository.DailyReportRepository;
import com.fj.issue.dto.DailyReportIssueImport;
import com.fj.issue.entity.IssueStatus;
import com.fj.issue.entity.ProjectIssue;
import com.fj.issue.repository.ProjectIssueRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 日报确认与锁定 Service（TASK-031）。
 * <p>核心职责：日报确认（SUBMITTED → LOCKED）走通用审批引擎，确认即锁定（BR-3），同事务写入
 * {@code confirmed_at} + {@code locked_at}（DD-8），并调用 {@code IssuePoolService} 生成 ProjectIssue。
 * <p>严格遵循 §9.1 联动规则表与 BR-5 日报状态机。
 * <ul>
 *   <li>{@link #confirm}：发起确认审批 → 通过审批引擎 → 通过后锁定日报 + 生成问题（DD-8/BR-3 同事务）</li>
 *   <li>{@link #rejectConfirmation}：退回 → 日报状态 RETURNED，附带退回意见</li>
 *   <li>{@link #voidReport}：作废 → 日报状态 VOIDED，联动处理 ProjectIssue（DD-9）</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DailyReportConfirmService {

    private final DailyReportRepository dailyReportRepository;
    private final DailyReportIssueRepository dailyReportIssueRepository;
    private final ApprovalEngineService approvalEngineService;
    private final com.fj.issue.service.IssuePoolService issuePoolService;
    private final ProjectIssueRepository projectIssueRepository;

    /**
     * 发起日报确认审批 + 通过审批引擎处理。
     * <p>对 SUBMITTED 状态日报：创建审批实例（DAILY_REPORT），由确认人（approverId）通过首个节点任务，
     * 审批通过后同事务完成（DD-8 确认即锁定，BR-3）：
     * <ol>
     *   <li>写入 {@code confirmed_at} + {@code locked_at}（DD-8，整改期限计算起点）</li>
     *   <li>更新 {@code DailyReport.status = LOCKED}</li>
     *   <li>调用 {@code IssuePoolService.generateFromDailyReport} 生成 ProjectIssue（BR-3 确认即锁定）</li>
     * </ol>
     * <p>多节点审批流：仅通过首个节点后仍为 PENDING 时，日报保持 SUBMITTED，等待后续节点。
     *
     * @param reportId   日报 ID
     * @param approverId 确认人（审批人）ID
     * @return 锁定后的日报（若审批尚未全部通过则返回当前日报）
     */
    @Transactional
    public DailyReport confirm(Long reportId, Long approverId) {
        DailyReport report = requireReport(reportId);

        // 1. 状态守卫：仅 SUBMITTED 可发起确认
        if (report.getStatus() != DailyReportStatus.SUBMITTED) {
            throw new BusinessException(ErrorCode.BIZ_STATE_INVALID_TRANSITION,
                    "日报状态流转不合法：" + report.getStatus() + " → 确认（需从 SUBMITTED 迁移）");
        }

        // 2. 创建审批实例（flow_type=DAILY_REPORT，business_id=reportId，initiator=inspector）
        ApprovalInstance instance = approvalEngineService.createInstance(
                report.getProjectId(), ApprovalFlowType.DAILY_REPORT, reportId, report.getInspectorId());

        // 3. 通过首个待处理节点任务（确认人 = approverId）
        ApprovalTask firstTask = approvalEngineService.findFirstPendingTask(instance.getId());
        if (firstTask == null) {
            throw new BusinessException(ErrorCode.BIZ_OPERATION_NOT_ALLOWED,
                    "审批实例 " + instance.getId() + " 无待处理任务");
        }
        approvalEngineService.approve(firstTask.getId(), approverId, "日报确认通过");

        // 4. 重新加载实例判断是否全部通过
        ApprovalInstance reloaded = approvalEngineService.detailInstance(instance.getId());
        if (reloaded.getStatus() != ApprovalStatus.APPROVED) {
            // 多节点流程：仍有后续节点，日报保持 SUBMITTED
            log.info("日报 {} 审批实例 {} 已通过首节点，仍有后续节点，日报保持 SUBMITTED", reportId, instance.getId());
            return report;
        }

        // 5. 审批全部通过 → DD-8 确认即锁定（同事务写 confirmed_at + locked_at）
        OffsetDateTime confirmedAt = OffsetDateTime.now();
        report.setConfirmedAt(confirmedAt);   // DD-8：业务确认时刻（整改期限计算起点 BR-1）
        report.setLockedAt(confirmedAt);      // DD-8/§102.2：持久化锁定时刻，与 confirmed_at 同事务
        report.setStatus(DailyReportStatus.LOCKED);
        DailyReport locked = dailyReportRepository.save(report);

        // 6. 生成 ProjectIssue（BR-3 确认即锁定 → 进入问题池）：DailyReportIssue → DailyReportIssueImport DTO
        List<DailyReportIssue> reportIssues =
                dailyReportIssueRepository.findByDailyReportIdOrderBySeqNoAsc(reportId);
        List<DailyReportIssueImport> imports = reportIssues.stream()
                .map(this::toImport)
                .toList();
        List<ProjectIssue> generated = issuePoolService.generateFromDailyReport(
                report.getProjectId(), reportId, confirmedAt, imports);

        log.info("日报 {} 确认完成（SUBMITTED → LOCKED），审批实例 {} 已 APPROVED，生成 {} 条项目问题",
                reportId, instance.getId(), generated.size());
        return locked;
    }

    /**
     * 退回日报确认（组长退回，附带退回意见）。
     * <p>更新 {@code DailyReport.status = RETURNED}，退回意见记录在审批任务 comment 中。
     *
     * @param reportId   日报 ID
     * @param approverId 退回人 ID
     * @param comment    退回意见
     * @return 退回后的日报
     */
    @Transactional
    public DailyReport rejectConfirmation(Long reportId, Long approverId, String comment) {
        DailyReport report = requireReport(reportId);
        if (report.getStatus() != DailyReportStatus.SUBMITTED) {
            throw new BusinessException(ErrorCode.BIZ_STATE_INVALID_TRANSITION,
                    "日报状态流转不合法：" + report.getStatus() + " → 退回（需从 SUBMITTED 迁移）");
        }

        // 若存在审批实例，通过引擎退回首个待处理任务（意见写入审批记录 §7.4）
        ApprovalInstance instance = approvalEngineService.findInstance(
                reportId, ApprovalFlowType.DAILY_REPORT);
        if (instance != null) {
            ApprovalTask pending = approvalEngineService.findFirstPendingTask(instance.getId());
            if (pending != null) {
                approvalEngineService.reject(pending.getId(), approverId, comment);
            }
        }

        // §9.1 三层联动：日报状态 → RETURNED
        report.setStatus(DailyReportStatus.RETURNED);
        DailyReport returned = dailyReportRepository.save(report);

        log.info("日报 {} 已退回（SUBMITTED → RETURNED），退回人={}，意见={}", reportId, approverId, comment);
        return returned;
    }

    /**
     * 作废日报（终态）。
     * <p>更新 {@code DailyReport.status = VOIDED}，联动处理 ProjectIssue：
     * 将来源于本日报的问题标记为 VOIDED（DD-9 后续更正由 IssueReviewService 处理）。
     *
     * @param reportId 日报 ID
     * @param voiderId 作废操作人 ID
     * @return 作废后的日报
     */
    @Transactional
    public DailyReport voidReport(Long reportId, Long voiderId) {
        DailyReport report = requireReport(reportId);
        DailyReportStatus previousStatus = report.getStatus();
        if (previousStatus == DailyReportStatus.VOIDED) {
            throw new BusinessException(ErrorCode.BIZ_OPERATION_NOT_ALLOWED, "日报已作废，不可重复操作");
        }

        report.setStatus(DailyReportStatus.VOIDED);
        DailyReport voided = dailyReportRepository.save(report);

        // 联动处理 ProjectIssue：来源于本日报且仍有效的问题 → VOIDED
        List<ProjectIssue> linkedIssues = projectIssueRepository.findBySourceReportId(reportId);
        for (ProjectIssue issue : linkedIssues) {
            if (issue.getStatus() == IssueStatus.VALID
                    || issue.getStatus() == IssueStatus.PENDING_CONFIRM
                    || issue.getStatus() == IssueStatus.OVERDUE) {
                issue.setStatus(IssueStatus.VOIDED);
                projectIssueRepository.save(issue);
            }
        }

        log.info("日报 {} 已作废（{} → VOIDED），联动处理 {} 条 ProjectIssue",
                reportId, previousStatus, linkedIssues.size());
        return voided;
    }

    // ==================== 内部工具 ====================

    /** DailyReportIssue → DailyReportIssueImport DTO 转换（规避循环依赖，§设计文档） */
    private DailyReportIssueImport toImport(DailyReportIssue issue) {
        return new DailyReportIssueImport(
                issue.getId(),
                issue.getSeqNo(),
                issue.getDescription(),
                issue.getSeverity(),
                issue.getCategory(),
                issue.getResponsiblePartyId(),
                issue.getLocation()
        );
    }

    private DailyReport requireReport(Long id) {
        return dailyReportRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "日报不存在: " + id));
    }
}
