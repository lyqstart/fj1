package com.fj.recommend.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;

/**
 * 标准推荐结果实体（对应 V5 standard_recommendation_results 表，DD-11）。
 * <p>由 {@code StandardRecommendationService} 三层规则匹配产出，关联到具体问题。
 *
 * <p><b>注</b>：本表 DDL 在 TASK-008（V5 迁移）尚未创建；此处 Entity 先行声明，
 * 待 V5 迁移落地后即可生效。表结构：project_id / issue_id / clause_id / score /
 * reason_snapshot / standard_library_version + 审计字段。
 */
@Entity
@Table(name = "standard_recommendation_results")
@Getter
@Setter
public class StandardRecommendationResult extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    /** 关联问题 ID（V5/V6 问题表建立后外键；此处为跨模块 Long） */
    @Column(name = "issue_id")
    private Long issueId;

    /** 命中的标准条款 ID（StandardClause） */
    @Column(name = "clause_id", nullable = false)
    private Long clauseId;

    /** 综合得分（三层规则累加） */
    @Column(name = "score", nullable = false)
    private Integer score;

    /** 推荐理由快照（如"检查项绑定+50;分类匹配+15;关键词+10"） */
    @Column(name = "reason_snapshot", length = 512)
    private String reasonSnapshot;

    /** 推荐时使用的标准库版本（取自 StandardDocument.version） */
    @Column(name = "standard_library_version", length = 64)
    private String standardLibraryVersion;
}
