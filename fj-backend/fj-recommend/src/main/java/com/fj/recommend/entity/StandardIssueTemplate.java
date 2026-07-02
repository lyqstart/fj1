package com.fj.recommend.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;

/**
 * 标准问题模板实体（对应 V3 standard_issue_templates 表）。
 * <p>预置的问题描述与整改建议模板，检查时由推荐服务引用。
 */
@Entity
@Table(name = "standard_issue_templates")
@Getter
@Setter
public class StandardIssueTemplate extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "description_template", columnDefinition = "text")
    private String descriptionTemplate;

    /** 严重等级：MAJOR 重大 / MINOR 一般 / SUGGESTION 建议 */
    @Column(name = "severity_level", length = 32)
    private String severityLevel;

    /** 问题分类 */
    @Column(name = "category", length = 64)
    private String category;
}
