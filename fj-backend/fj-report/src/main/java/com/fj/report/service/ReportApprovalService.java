package com.fj.report.service;

import com.fj.approval.entity.ApprovalFlowType;
import com.fj.approval.entity.ApprovalInstance;
import com.fj.approval.entity.ApprovalRecord;
import com.fj.approval.entity.ApprovalStatus;
import com.fj.approval.entity.ApprovalTask;
import com.fj.approval.service.ApprovalEngineService;
import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.report.entity.Report;
import com.fj.report.entity.ReportStatus;
import com.fj.report.repository.ReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 报告审批 Service（TASK-040）。
 * <p>核心职责：报告提交审批 → 复用 {@link ApprovalEngineService}（flowType=REPORT）→
 * 通过变更为 PENDING_PUBLISH / 退回变更为 RETURNED 并附带退回意见。
 * <p>关键业务规则（BR-8 报告状态机 + §9.2 版本树）：
 * <ul>
 *   <li>仅 DRAFT / RETURNED 状态可提交审批；提交后进入 IN_REVIEW，期间不可修改报告内容</li>
 *   <li>审批通过（实例 APPROVED）→ 报告 PENDING_PUBLISH（待发布）</li>
 *   <li>审批退回（实例 REJECTED）→ 报告 RETURNED，可通过 {@link #getLatestRejectComment} 获取退回意见</li>
 *   <li>版本树管理：首次发布 v1，root_report_id=自身（{@link ReportService#generateDraft} 已在创建时回填）</li>
 * </ul>
 * <p>报告内容的可编辑性由 {@link ReportService} 的 {@code requireEditable} 统一守护：
 * 仅 DRAFT / RETURNED 允许编辑，IN_REVIEW / PENDING_PUBLISH / PUBLISHED 均不可编辑。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportApprovalService {

    /** 报告审批复用的流程类型 */
    private static final ApprovalFlowType REPORT_FLOW_TYPE = ApprovalFlowType.REPORT;

    private final ReportRepository reportRepository;
    private final ApprovalEngineService approvalEngineService;

    /**
     * 提交报告审批。
     * <p>创建审批实例（flowType=REPORT，businessId=reportId），报告状态 DRAFT/RETURNED → IN_REVIEW。
     * <p>提交后报告进入审批中，不可修改报告内容（由 {@link ReportService#requireEditable} 守护）。
     *
     * @param reportId    报告 ID
     * @param submitterId 提交人 ID
     * @return 已创建的审批实例
     */
    @Transactional
    public ApprovalInstance submitForApproval(Long reportId, Long submitterId) {
        Report report = requireSubmittable(reportId);

        // 复用通用审批引擎创建实例（flowType=REPORT，businessId=reportId）
        ApprovalInstance instance = approvalEngineService.createInstance(
                report.getProjectId(), REPORT_FLOW_TYPE, report.getId(), submitterId);

        // 报告状态流转：DRAFT/RETURNED → IN_REVIEW
        report.setStatus(ReportStatus.IN_REVIEW);
        report.setUpdatedBy(submitterId);
        reportRepository.save(report);

        log.info("报告 {} 提交审批: instanceId={}, submitter={}", reportId, instance.getId(), submitterId);
        return instance;
    }

    /**
     * 审批通过当前报告的当前审批任务。
     * <p>定位报告关联的审批实例的首个 PENDING 任务 → 调用 {@link ApprovalEngineService#approve}；
     * 若实例整体 APPROVED（末节点通过），报告状态 → PENDING_PUBLISH（待发布）。
     *
     * @param reportId   报告 ID
     * @param approverId 审批人 ID
     * @param comment    审批意见
     * @return 报告（流转后状态）
     */
    @Transactional
    public Report approve(Long reportId, Long approverId, String comment) {
        Report report = requireInReview(reportId);
        ApprovalInstance instance = requireInstance(reportId);
        ApprovalTask pendingTask = findPendingTask(reportId);
        if (pendingTask == null) {
            throw new BusinessException(ErrorCode.BIZ_OPERATION_NOT_ALLOWED,
                    "报告 " + reportId + " 无待处理审批任务，不可重复审批");
        }

        // 调用通用审批引擎处理通过
        approvalEngineService.approve(pendingTask.getId(), approverId, comment);

        // 重新读取实例状态（approve 内部已更新）
        ApprovalInstance refreshed = approvalEngineService.detailInstance(instance.getId());
        if (refreshed.getStatus() == ApprovalStatus.APPROVED) {
            // 末节点通过 → 报告进入待发布
            report.setStatus(ReportStatus.PENDING_PUBLISH);
            report.setUpdatedBy(approverId);
            reportRepository.save(report);
            log.info("报告 {} 审批通过，进入待发布: approver={}", reportId, approverId);
        } else {
            // 多节点审批：仅推进到下一节点，报告状态保持 IN_REVIEW
            log.info("报告 {} 审批推进到下一节点: currentNode={}, approver={}",
                    reportId, refreshed.getCurrentNode(), approverId);
        }
        return report;
    }

    /**
     * 审批退回当前报告。
     * <p>调用 {@link ApprovalEngineService#reject}，实例 REJECTED → 报告状态 RETURNED。
     * 退回意见存储于 {@link ApprovalRecord#getComment()}，可通过 {@link #getLatestRejectComment} 查询。
     *
     * @param reportId   报告 ID
     * @param approverId 审批人 ID
     * @param comment    退回意见
     * @return 报告（已退回）
     */
    @Transactional
    public Report reject(Long reportId, Long approverId, String comment) {
        Report report = requireInReview(reportId);
        requireInstance(reportId);
        ApprovalTask pendingTask = findPendingTask(reportId);
        if (pendingTask == null) {
            throw new BusinessException(ErrorCode.BIZ_OPERATION_NOT_ALLOWED,
                    "报告 " + reportId + " 无待处理审批任务，不可重复审批");
        }

        // 调用通用审批引擎处理退回（实例标记 REJECTED + 写入退回意见到 ApprovalRecord）
        approvalEngineService.reject(pendingTask.getId(), approverId, comment);

        // 报告状态流转：IN_REVIEW → RETURNED（附带退回意见存于 ApprovalRecord）
        report.setStatus(ReportStatus.RETURNED);
        report.setUpdatedBy(approverId);
        reportRepository.save(report);
        log.info("报告 {} 审批退回，进入 RETURNED: approver={}, comment={}",
                reportId, approverId, comment);
        return report;
    }

    /**
     * 获取报告最新退回意见（RETURNED 状态时调用）。
     * <p>退回意见在 {@link ApprovalEngineService#reject} 写入 ApprovalRecord 链尾。
     *
     * @param reportId 报告 ID
     * @return 最新退回意见；无记录返回 null
     */
    @Transactional(readOnly = true)
    public String getLatestRejectComment(Long reportId) {
        ApprovalInstance instance = approvalEngineService.findInstance(reportId, REPORT_FLOW_TYPE);
        if (instance == null) {
            return null;
        }
        List<ApprovalRecord> records = approvalEngineService.listRecords(instance.getId());
        if (records.isEmpty()) {
            return null;
        }
        // 链尾即最新记录；退回意见来自 REJECT 动作的 comment
        return records.get(records.size() - 1).getComment();
    }

    /** 查询报告关联的审批实例（用于审批记录展示） */
    @Transactional(readOnly = true)
    public ApprovalInstance getApprovalInstance(Long reportId) {
        return approvalEngineService.findInstance(reportId, REPORT_FLOW_TYPE);
    }

    /** 查询报告审批记录链（按写入顺序） */
    @Transactional(readOnly = true)
    public List<ApprovalRecord> listApprovalRecords(Long reportId) {
        ApprovalInstance instance = approvalEngineService.findInstance(reportId, REPORT_FLOW_TYPE);
        if (instance == null) {
            return List.of();
        }
        return approvalEngineService.listRecords(instance.getId());
    }

    // ==================== 内部工具 ====================

    /** 校验报告可提交审批：仅 DRAFT / RETURNED 允许提交 */
    private Report requireSubmittable(Long reportId) {
        Report report = requireReport(reportId);
        ReportStatus st = report.getStatus();
        if (st != ReportStatus.DRAFT && st != ReportStatus.RETURNED) {
            throw new BusinessException(ErrorCode.BIZ_OPERATION_NOT_ALLOWED,
                    "报告状态为 " + st + "，不可提交审批（仅 DRAFT/RETURNED 允许提交）");
        }
        // 同一报告不可重复发起审批实例（已有未完成的 REPORT 流程实例时拒绝）
        ApprovalInstance existing = approvalEngineService.findInstance(reportId, REPORT_FLOW_TYPE);
        if (existing != null && existing.getStatus() == ApprovalStatus.PENDING) {
            throw new BusinessException(ErrorCode.DATA_ALREADY_EXISTS,
                    "报告 " + reportId + " 已存在进行中的审批实例: " + existing.getId());
        }
        return report;
    }

    /** 校验报告处于审批中：仅 IN_REVIEW 允许审批操作 */
    private Report requireInReview(Long reportId) {
        Report report = requireReport(reportId);
        if (report.getStatus() != ReportStatus.IN_REVIEW) {
            throw new BusinessException(ErrorCode.BIZ_OPERATION_NOT_ALLOWED,
                    "报告状态为 " + report.getStatus() + "，仅 IN_REVIEW 可执行审批操作");
        }
        return report;
    }

    /** 获取报告关联的审批实例（必须存在） */
    private ApprovalInstance requireInstance(Long reportId) {
        ApprovalInstance instance = approvalEngineService.findInstance(reportId, REPORT_FLOW_TYPE);
        if (instance == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND,
                    "报告 " + reportId + " 未关联审批实例（flowType=REPORT）");
        }
        return instance;
    }

    /** 查找报告审批实例的首个 PENDING 任务 */
    private ApprovalTask findPendingTask(Long reportId) {
        ApprovalInstance instance = approvalEngineService.findInstance(reportId, REPORT_FLOW_TYPE);
        if (instance == null) {
            return null;
        }
        return approvalEngineService.findFirstPendingTask(instance.getId());
    }

    private Report requireReport(Long reportId) {
        return reportRepository.findById(reportId)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "报告不存在: " + reportId));
    }

    /** 保留 OffsetDateTime 引用避免未来扩展时遗漏 import（报告审批本身不直接写时间戳，由 BaseEntity 触发器维护） */
    @SuppressWarnings("unused")
    private OffsetDateTime reservedNow() {
        return OffsetDateTime.now();
    }
}
