package com.fj.report.entity;

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
 * 报告实体（对应 V7 reports 表，§101.14）。
 * <p>报告生产层核心实体：按时间范围汇总项目问题生成的正式报告。
 * <p>关键字段语义：
 * <ul>
 *   <li>{@link #status}：报告状态机（{@link ReportStatus}，BR-8）</li>
 *   <li>{@link #rootReportId} / {@link #previousReportId} / {@link #reportVersion} /
 *       {@link #isCurrentEffective}：版本树字段（§9.2 预留）</li>
 *   <li>{@link #publishedAt} / {@link #lockedAt}：发布时刻与锁定时刻（BR-4 发布即固化）</li>
 * </ul>
 */
@Entity
@Table(name = "reports")
@Getter
@Setter
public class Report extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 所属项目 ID */
    @Column(name = "project_id", nullable = false)
    private Long projectId;

    /** 报告编号（业务可读，如 RPT-{projectId}-{seq}） */
    @Column(name = "report_no", nullable = false, unique = true, length = 64)
    private String reportNo;

    /** 报告标题 */
    @Column(name = "title", nullable = false, length = 256)
    private String title;

    /** 报告状态（BR-8 状态机） */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ReportStatus status = ReportStatus.DRAFT;

    /** 报告周期起始时刻（时间范围汇总依据） */
    @Column(name = "report_period_start")
    private OffsetDateTime reportPeriodStart;

    /** 报告周期结束时刻（时间范围汇总依据） */
    @Column(name = "report_period_end")
    private OffsetDateTime reportPeriodEnd;

    /** 版本树根 ID（§9.2：首版 = 自身 id，新版本仍指向原始首版） */
    @Column(name = "root_report_id")
    private Long rootReportId;

    /** 上一版本 ID（§9.2：首版为 NULL，新版本指向被修订的上一版） */
    @Column(name = "previous_report_id")
    private Long previousReportId;

    /** 版本号（§9.2：首版 = 1，每次修订递增） */
    @Column(name = "report_version", nullable = false)
    private Integer reportVersion = 1;

    /** 是否当前生效版本（§9.2：同一版本树内仅一版为 true） */
    @Column(name = "is_current_effective", nullable = false)
    private Boolean isCurrentEffective = Boolean.TRUE;

    /** 发布时刻（PUBLISHED 时写入；BR-4 发布即固化） */
    @Column(name = "published_at")
    private OffsetDateTime publishedAt;

    /** 锁定时刻（已发布报告锁定，禁止再编辑） */
    @Column(name = "locked_at")
    private OffsetDateTime lockedAt;
}
