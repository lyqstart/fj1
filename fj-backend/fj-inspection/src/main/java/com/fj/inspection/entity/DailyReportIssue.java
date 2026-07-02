package com.fj.inspection.entity;

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

/**
 * 日报问题实体（对应 V5 daily_report_issues 表，§101.10）。
 * <p>日报下的检查发现项；日报确认后映射到项目问题池（project_issues）。
 */
@Entity
@Table(name = "daily_report_issues")
@Getter
@Setter
public class DailyReportIssue extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "daily_report_id", nullable = false)
    private Long dailyReportId;

    /** 日报内序号（同一日报内递增） */
    @Column(name = "seq_no", nullable = false)
    private Integer seqNo;

    /** 问题描述（受 ProjectConfig.min_description_length 约束） */
    @Column(name = "description", nullable = false, columnDefinition = "text")
    private String description;

    /** 问题严重程度（REQ-13）：GENERAL/MAJOR/CRITICAL */
    @Enumerated(EnumType.STRING)
    @Column(name = "severity", nullable = false, length = 32)
    private IssueSeverity severity = IssueSeverity.GENERAL;

    /** 问题分类 / 专业 */
    @Column(name = "category", length = 64)
    private String category;

    /** 责任单位/责任人 ID（V1 organizations 或 users） */
    @Column(name = "responsible_party_id")
    private Long responsiblePartyId;

    /** 问题位置描述 */
    @Column(name = "location", length = 255)
    private String location;

    /** 关联标准条款 ID（check_item_standard_bindings） */
    @Column(name = "standard_clause_id")
    private Long standardClauseId;

    /** 整改状态：PENDING/IN_PROGRESS/CORRECTED/VERIFIED */
    @Enumerated(EnumType.STRING)
    @Column(name = "correction_status", nullable = false, length = 32)
    private CorrectionStatus correctionStatus = CorrectionStatus.PENDING;
}
