package com.fj.issue.service;

import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.issue.entity.IssueStatus;
import com.fj.issue.entity.ProjectIssue;
import com.fj.issue.repository.ProjectIssueRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * 问题状态机 Service（TASK-027）。
 * <p>状态流转规则（VALID → RECTIFIED → CLOSED，OVERDUE 由 Job 自动标记）：
 * <pre>
 *   VALID(待整改) ──markRectified──▶ RECTIFIED(已整改)
 *   RECTIFIED ───────close────────▶ CLOSED(已关闭)
 *   VALID ────OverdueDetectionJob──▶ OVERDUE(超期)
 *   OVERDUE ────markRectified──────▶ RECTIFIED（超期后仍可整改）
 *   VALID/PENDING_CONFIRM ──void───▶ VOIDED(作废)
 *   任意非终态 ────suspend──────────▶ SUSPENDED(暂停)
 *   SUSPENDED ────resume────────────▶ VALID
 * </pre>
 * <p>非法跳转抛 {@link BusinessException}（{@link ErrorCode#BIZ_STATE_INVALID_TRANSITION}）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IssueStatusService {

    private final ProjectIssueRepository projectIssueRepository;

    /** 合法状态流转邻接表（from → 允许的目标状态集合） */
    private static final Map<IssueStatus, Set<IssueStatus>> TRANSITIONS = new EnumMap<>(IssueStatus.class);

    static {
        TRANSITIONS.put(IssueStatus.VALID, EnumSet.of(IssueStatus.RECTIFIED, IssueStatus.OVERDUE,
                IssueStatus.VOIDED, IssueStatus.SUSPENDED));
        TRANSITIONS.put(IssueStatus.PENDING_CONFIRM, EnumSet.of(IssueStatus.VALID, IssueStatus.VOIDED));
        TRANSITIONS.put(IssueStatus.RECTIFIED, EnumSet.of(IssueStatus.CLOSED));
        TRANSITIONS.put(IssueStatus.OVERDUE, EnumSet.of(IssueStatus.RECTIFIED, IssueStatus.VOIDED));
        TRANSITIONS.put(IssueStatus.SUSPENDED, EnumSet.of(IssueStatus.VALID));
        // 终态：CLOSED 不允许继续流转
        TRANSITIONS.put(IssueStatus.CLOSED, EnumSet.noneOf(IssueStatus.class));
        // VOIDED：作废后若被已发布报告引用，组长可执行后续更正（DD-9）→ CORRECTED
        TRANSITIONS.put(IssueStatus.VOIDED, EnumSet.of(IssueStatus.CORRECTED));
        // CORRECTED：后续更正（DD-9，终态语义），仅可推进到 CLOSED
        TRANSITIONS.put(IssueStatus.CORRECTED, EnumSet.of(IssueStatus.CLOSED));
    }

    /**
     * 状态流转守卫：校验 from → target 是否合法，非法则抛异常。
     */
    public void guardTransition(IssueStatus from, IssueStatus target) {
        Set<IssueStatus> allowed = TRANSITIONS.get(from);
        if (allowed == null || !allowed.contains(target)) {
            throw new BusinessException(ErrorCode.BIZ_STATE_INVALID_TRANSITION,
                    "问题状态流转不合法：" + from + " → " + target);
        }
    }

    /**
     * 标记已整改：VALID/OVERDUE → RECTIFIED。
     */
    @Transactional
    public ProjectIssue markRectified(Long issueId) {
        ProjectIssue issue = requireIssue(issueId);
        guardTransition(issue.getStatus(), IssueStatus.RECTIFIED);
        issue.setStatus(IssueStatus.RECTIFIED);
        log.info("问题 {} 标记为已整改（{} → RECTIFIED）", issueId, issue.getStatus());
        return projectIssueRepository.save(issue);
    }

    /**
     * 关闭问题：RECTIFIED → CLOSED。
     */
    @Transactional
    public ProjectIssue close(Long issueId) {
        ProjectIssue issue = requireIssue(issueId);
        guardTransition(issue.getStatus(), IssueStatus.CLOSED);
        issue.setStatus(IssueStatus.CLOSED);
        log.info("问题 {} 已关闭（{} → CLOSED）", issueId, issue.getStatus());
        return projectIssueRepository.save(issue);
    }

    /**
     * 作废问题：VALID/PENDING_CONFIRM/OVERDUE → VOIDED。
     */
    @Transactional
    public ProjectIssue voidIssue(Long issueId) {
        ProjectIssue issue = requireIssue(issueId);
        guardTransition(issue.getStatus(), IssueStatus.VOIDED);
        issue.setStatus(IssueStatus.VOIDED);
        log.info("问题 {} 已作废（{} → VOIDED）", issueId, issue.getStatus());
        return projectIssueRepository.save(issue);
    }

    /**
     * 暂停问题：非终态 → SUSPENDED。
     */
    @Transactional
    public ProjectIssue suspend(Long issueId) {
        ProjectIssue issue = requireIssue(issueId);
        guardTransition(issue.getStatus(), IssueStatus.SUSPENDED);
        issue.setStatus(IssueStatus.SUSPENDED);
        log.info("问题 {} 已暂停（{} → SUSPENDED）", issueId, issue.getStatus());
        return projectIssueRepository.save(issue);
    }

    /**
     * 恢复问题：SUSPENDED → VALID。
     */
    @Transactional
    public ProjectIssue resume(Long issueId) {
        ProjectIssue issue = requireIssue(issueId);
        guardTransition(issue.getStatus(), IssueStatus.VALID);
        issue.setStatus(IssueStatus.VALID);
        log.info("问题 {} 已恢复（{} → VALID）", issueId, issue.getStatus());
        return projectIssueRepository.save(issue);
    }

    /**
     * 超期标记（由 OverdueDetectionJob 调用）：VALID → OVERDUE。
     * <p>内联守卫，不经过 guardTransition（Job 批量调用，合法来源固定）。
     */
    @Transactional
    public void markOverdue(ProjectIssue issue) {
        if (issue.getStatus() == IssueStatus.VALID) {
            issue.setStatus(IssueStatus.OVERDUE);
        }
    }

    private ProjectIssue requireIssue(Long id) {
        return projectIssueRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "问题不存在: " + id));
    }
}
