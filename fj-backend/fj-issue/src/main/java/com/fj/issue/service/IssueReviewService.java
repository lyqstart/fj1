package com.fj.issue.service;

import com.fj.common.enume.IssueSeverity;
import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.common.port.IssueReferenceChecker;
import com.fj.issue.entity.IssueStatus;
import com.fj.issue.entity.ProjectIssue;
import com.fj.issue.repository.ProjectIssueRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 问题复核 Service（TASK-032）。
 * <p>核心职责：组长对项目问题执行复核操作（通过 / 退回 / 调整等级 / 作废 / 后续更正）。
 * <p>严格遵循状态机守卫（{@link IssueStatusService#guardTransition}）：
 * <ul>
 *   <li>{@link ReviewAction#PASS}：复核通过，推进至下一阶段（PENDING_CONFIRM → VALID）</li>
 *   <li>{@link ReviewAction#RETURN}：退回给检查员（记录退回意见，问题保持待复核状态）</li>
 *   <li>{@link ReviewAction#ADJUST}：调整严重程度等级（记录原等级，不改生命周期状态）</li>
 *   <li>{@link ReviewAction#VOID}：作废问题（→ VOIDED），联动检查是否被已发布报告引用（DD-9 → CORRECTED）</li>
 *   <li>{@link ReviewAction#CORRECT}：后续更正（DD-9，终态语义，VOIDED → CORRECTED，不可回退到 VALID）</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IssueReviewService {

    private final ProjectIssueRepository projectIssueRepository;
    private final IssueStatusService issueStatusService;
    private final IssueReferenceChecker issueReferenceChecker;

    /**
     * 组长复核操作。
     *
     * @param issueId      问题 ID
     * @param action       复核动作（见 {@link ReviewAction}）
     * @param comment      复核意见（可为空）
     * @param newSeverity  仅 {@link ReviewAction#ADJUST} 时生效，新等级
     * @return 复核后的最新问题
     */
    @Transactional
    public ProjectIssue review(Long issueId, ReviewAction action, String comment, IssueSeverity newSeverity) {
        if (action == null) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID, "复核动作 action 不能为空");
        }
        ProjectIssue issue = requireIssue(issueId);

        switch (action) {
            case PASS -> {
                return handlePass(issue, comment);
            }
            case RETURN -> {
                return handleReturn(issue, comment);
            }
            case ADJUST -> {
                return handleAdjust(issue, newSeverity, comment);
            }
            case VOID -> {
                return handleVoid(issue, comment);
            }
            case CORRECT -> {
                return handleCorrect(issue, comment);
            }
            default -> throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID, "不支持的复核动作: " + action);
        }
    }

    // ==================== 各动作处理 ====================

    /** PASS：复核通过，推进至下一阶段（PENDING_CONFIRM → VALID） */
    private ProjectIssue handlePass(ProjectIssue issue, String comment) {
        if (issue.getStatus() == IssueStatus.PENDING_CONFIRM) {
            // 待确认问题复核通过 → 进入问题池（VALID）
            issueStatusService.guardTransition(issue.getStatus(), IssueStatus.VALID);
            issue.setStatus(IssueStatus.VALID);
        }
        log.info("问题 {} 复核通过（PASS，status={}），意见：{}", issue.getId(), issue.getStatus(), comment);
        return projectIssueRepository.save(issue);
    }

    /** RETURN：退回给检查员（记录意见，问题保持待复核状态，不改生命周期状态） */
    private ProjectIssue handleReturn(ProjectIssue issue, String comment) {
        if (isTerminal(issue.getStatus())) {
            throw new BusinessException(ErrorCode.BIZ_OPERATION_NOT_ALLOWED,
                    "终态问题不可退回：" + issue.getStatus());
        }
        // 退回不改状态（无 RETURNED 生命周期状态），仅记录意见，检查员需重新核实
        log.info("问题 {} 已退回给检查员（RETURN），当前状态={}，意见：{}", issue.getId(), issue.getStatus(), comment);
        return issue;
    }

    /** ADJUST：调整严重程度（记录原等级，不改生命周期状态） */
    private ProjectIssue handleAdjust(ProjectIssue issue, IssueSeverity newSeverity, String comment) {
        if (newSeverity == null) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID, "ADJUST 动作必须提供 newSeverity");
        }
        if (isTerminal(issue.getStatus())) {
            throw new BusinessException(ErrorCode.BIZ_OPERATION_NOT_ALLOWED,
                    "终态问题不可调整等级：" + issue.getStatus());
        }
        IssueSeverity original = issue.getSeverity();
        if (original == newSeverity) {
            log.info("问题 {} 调整等级：新旧等级相同（{}），无需变更", issue.getId(), original);
            return issue;
        }
        issue.setSeverity(newSeverity);
        log.info("问题 {} 调整等级：{} → {}，原等级={}，意见：{}",
                issue.getId(), original, newSeverity, original, comment);
        return projectIssueRepository.save(issue);
    }

    /**
     * VOID：作废问题（→ VOIDED）。
     * <p>联动检查：若被已发布报告引用（report_issue_snapshots），则改为 CORRECTED（DD-9 后续更正）。
     */
    private ProjectIssue handleVoid(ProjectIssue issue, String comment) {
        // 守卫：合法状态 → VOIDED
        issueStatusService.guardTransition(issue.getStatus(), IssueStatus.VOIDED);
        issue.setStatus(IssueStatus.VOIDED);
        ProjectIssue saved = projectIssueRepository.save(issue);

        // DD-9 联动：被已发布报告引用的作废问题 → 标记 CORRECTED（终态，不可回退 VALID）
        if (isReferencedByPublishedReport(issue.getId())) {
            issueStatusService.guardTransition(IssueStatus.VOIDED, IssueStatus.CORRECTED);
            saved.setStatus(IssueStatus.CORRECTED);
            saved = projectIssueRepository.save(saved);
            log.info("问题 {} 作废后被已发布报告引用，标记为 CORRECTED（DD-9），意见：{}", issue.getId(), comment);
        } else {
            log.info("问题 {} 已作废（→ VOIDED），意见：{}", issue.getId(), comment);
        }
        return saved;
    }

    /** CORRECT：后续更正（DD-9，终态语义，VOIDED → CORRECTED，不可回退到 VALID） */
    private ProjectIssue handleCorrect(ProjectIssue issue, String comment) {
        // 守卫：仅 VOIDED 可更正为 CORRECTED（DD-9，终态）
        issueStatusService.guardTransition(issue.getStatus(), IssueStatus.CORRECTED);
        issue.setStatus(IssueStatus.CORRECTED);
        log.info("问题 {} 后续更正（VOIDED → CORRECTED，DD-9 终态），意见：{}", issue.getId(), comment);
        return projectIssueRepository.save(issue);
    }

    // ==================== 内部工具 ====================

    /**
     * 检查问题是否被已发布报告引用（report_issue_snapshots 表）。
     * <p>委托给 {@link IssueReferenceChecker} 端口（实现在 fj-report 模块），用于 DD-9 联动判定：
     * 被已发布报告引用的作废问题应走后续更正（CORRECTED）分支。
     */
    private boolean isReferencedByPublishedReport(Long issueId) {
        return issueReferenceChecker.isReferencedByPublishedReport(issueId);
    }

    /** 是否终态（CLOSED / CORRECTED） */
    private boolean isTerminal(IssueStatus status) {
        return status == IssueStatus.CLOSED || status == IssueStatus.CORRECTED;
    }

    private ProjectIssue requireIssue(Long id) {
        return projectIssueRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "问题不存在: " + id));
    }
}
