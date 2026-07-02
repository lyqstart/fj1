package com.fj.report.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;

/**
 * 问题快照实体（对应 V7 report_issue_snapshots 表，§101.15）。
 * <p>报告纳入的问题清单快照：每条记录在报告生成时刻从 project_issues 复制一份冗余副本。
 * <p><b>§103 快照独立性原则</b>：所有 *_snapshot 字段独立存储，展示/打印只读快照字段，
 * 不依赖 JOIN project_issues。原文改名 / 整改状态变化不影响已发布报告内容。
 * <p>快照编辑（左右对照）只修改本实体的 *_snapshot 字段，绝不回写 source_issue 原文。
 */
@Entity
@Table(name = "report_issue_snapshots")
@Getter
@Setter
public class ReportIssueSnapshot extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 所属报告 ID */
    @Column(name = "report_id", nullable = false)
    private Long reportId;

    /** 源问题 ID（保留外键便于追溯，展示只读 *_snapshot 字段） */
    @Column(name = "source_issue_id", nullable = false)
    private Long sourceIssueId;

    /** 问题描述快照（§103 冗余副本，原文改名不影响已发布报告） */
    @Column(name = "description_snapshot", nullable = false, length = 2000)
    private String descriptionSnapshot;

    /** 问题严重程度快照（GENERAL/MAJOR/CRITICAL） */
    @Column(name = "severity_snapshot", nullable = false, length = 32)
    private String severitySnapshot;

    /** 问题分类/专业快照 */
    @Column(name = "category_snapshot", length = 64)
    private String categorySnapshot;

    /** 责任单位/责任人名称快照（已解析为展示名，避免依赖 organizations/users JOIN） */
    @Column(name = "responsible_party_snapshot", length = 128)
    private String responsiblePartySnapshot;

    /**
     * 照片引用快照（JSONB）。
     * <p>存储为 JSON 字符串，对应 PG jsonb 列。包含照片清单的冗余副本。
     */
    @Column(name = "photo_reference_snapshot", columnDefinition = "jsonb")
    private String photoReferenceSnapshot;

    /** 问题编号快照（业务可读，便于报告脱网展示） */
    @Column(name = "issue_no_snapshot", nullable = false, length = 64)
    private String issueNoSnapshot;

    /** 报告内排序（手工调整顺序） */
    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;
}
