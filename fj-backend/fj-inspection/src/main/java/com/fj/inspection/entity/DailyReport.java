package com.fj.inspection.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 日报实体（对应 V5 daily_reports 表，§101.9）。
 * <p>BR-5 状态机：DRAFT → SUBMITTED → RETURNED/LOCKED → VOIDED。
 * <p>DD-8：{@link #confirmedAt}（业务语义，审批通过时刻，整改期限计算起点 BR-1）
 *         与 {@link #lockedAt}（持久化锁定，§102.2）分开存储，确认即锁定时同事务写入。
 */
@Entity
@Table(name = "daily_reports")
@Getter
@Setter
public class DailyReport extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    /** 关联检查任务（§101.7），自由日报可空 */
    @Column(name = "task_id")
    private Long taskId;

    /** 日报日期（业务日期，非提交时刻） */
    @Column(name = "report_date", nullable = false)
    private LocalDate reportDate;

    /** 检查人员 ID（§101.9） */
    @Column(name = "inspector_id", nullable = false)
    private Long inspectorId;

    /** 日报状态机（BR-5）：DRAFT/SUBMITTED/RETURNED/LOCKED/VOIDED */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private DailyReportStatus status = DailyReportStatus.DRAFT;

    /** 提交时刻（DRAFT → SUBMITTED 时写入） */
    @Column(name = "submitted_at")
    private OffsetDateTime submittedAt;

    /**
     * 业务语义：审批通过时刻（DD-8，整改期限计算起点 BR-1）。
     * <p>与 {@link #lockedAt} 分开存储，确认即锁定时同事务写入。
     */
    @Column(name = "confirmed_at")
    private OffsetDateTime confirmedAt;

    /**
     * 持久化锁定时刻（§102.2 确认即锁定，DD-8 与 {@link #confirmedAt} 同事务写入）。
     */
    @Column(name = "locked_at")
    private OffsetDateTime lockedAt;
}
