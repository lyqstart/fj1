package com.fj.recommend.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;

/**
 * 标准条款实体（对应 V3 standard_clauses 表）。
 * <p>条款是智能推荐的最小匹配单元，通过 keyword_tags / category 参与检索。
 */
@Entity
@Table(name = "standard_clauses")
@Getter
@Setter
public class StandardClause extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Column(name = "clause_number", nullable = false, length = 64)
    private String clauseNumber;

    @Column(name = "content", nullable = false, columnDefinition = "text")
    private String content;

    /** 问题分类 / 专业 */
    @Column(name = "category", length = 64)
    private String category;

    /** 关键词标签（逗号分隔，用于推荐检索） */
    @Column(name = "keyword_tags", length = 512)
    private String keywordTags;

    /** 关联问题模板 ID */
    @Column(name = "issue_template_id")
    private Long issueTemplateId;
}
