package com.fj.issue.entity;

import com.fj.common.enume.CorrectionStatus;
import com.fj.common.enume.IssueSeverity;
import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;
import java.time.OffsetDateTime;

/**
 * 项目问题实体（对应 V5 project_issues 表）。
 * <p>问题池核心实体：日报确认后由 {@code IssuePoolService} 从 DailyReportIssue 映射生成。
 * <p>关键字段语义：
 * <ul>
 *   <li>{@link #severity} + {@link #confirmedAt} → {@link #rectificationDeadline}（BR-1 整改期限，始终非空）</li>
 *   <li>{@link #status}：问题池生命周期状态机（{@link IssueStatus}）</li>
 *   <li>{@link #correctionStatus}：整改跟踪状态（{@link CorrectionStatus}）</li>
 *   <li>{@link #confirmedAt} / {@link #lockedAt}（DD-8：业务确认时刻与持久化锁定时刻，确认即锁定时同事务写入）</li>
 * </ul>
 */
@Entity
@Table(name = "project_issues")
@Getter
@Setter
public class ProjectIssue extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 所属项目 ID */
    @Column(name = "project_id", nullable = false)
    private Long projectId;

    /** 来源日报 ID（日报确认时映射生成） */
    @Column(name = "source_report_id")
    private Long sourceReportId;

    /** 来源日报问题 ID（DailyReportIssue.id） */
    @Column(name = "source_issue_id")
    private Long sourceIssueId;

    /** 问题编号（格式 ISS-{projectId}-{6位序号}） */
    @Column(name = "issue_no", nullable = false, unique = true, length = 64)
    private String issueNo;

    /** 问题描述 */
    @Column(name = "description", nullable = false, columnDefinition = "text")
    private String description;

    /** 严重程度（REQ-13）：GENERAL/MAJOR/CRITICAL */
    @Enumerated(EnumType.STRING)
    @Column(name = "severity", nullable = false, length = 32)
    private IssueSeverity severity = IssueSeverity.GENERAL;

    /** 问题分类 / 专业 */
    @Column(name = "category", length = 64)
    private String category;

    /** 责任单位/责任人 ID */
    @Column(name = "responsible_party_id")
    private Long responsiblePartyId;

    /**
     * 问题池状态机（TASK-026 + TASK-027）。
     * <p>VALID(待整改) → RECTIFIED(已整改) → CLOSED(已关闭) / OVERDUE(超期)
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private IssueStatus status = IssueStatus.PENDING_CONFIRM;

    /** 整改跟踪状态 */
    @Enumerated(EnumType.STRING)
    @Column(name = "correction_status", nullable = false, length = 32)
    private CorrectionStatus correctionStatus = CorrectionStatus.PENDING;

    /**
     * 整改期限（BR-1，始终非空）。
     * <p>由 {@code RectificationDeadlineCalculator} 基于 severity + confirmedAt 计算。
     */
    @Column(name = "rectification_deadline", nullable = false)
    private OffsetDateTime rectificationDeadline;

    /**
     * 业务确认时刻（DD-8，整改期限计算起点）。
     * <p>与 {@link #lockedAt} 分开存储，确认即锁定时同事务写入。
     */
    @Column(name = "confirmed_at")
    private OffsetDateTime confirmedAt;

    /**
     * 持久化锁定时刻（§102.2 确认即锁定，DD-8）。
     */
    @Column(name = "locked_at")
    private OffsetDateTime lockedAt;

    /** 创建来源日报 ID（与 source_report_id 可能相同，用于审计追溯） */
    @Column(name = "created_from_report_id")
    private Long createdFromReportId;
}
