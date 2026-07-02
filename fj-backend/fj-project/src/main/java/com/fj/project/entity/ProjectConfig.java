package com.fj.project.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;

/**
 * 项目配置实体（对应 V3 project_configs 表）。
 * <p>结构化配置项，包含 BR-1 整改期限配置点。
 * 与 Project 一对一，项目创建时由 Service 初始化默认配置。
 */
@Entity
@Table(name = "project_configs")
@Getter
@Setter
public class ProjectConfig extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false, unique = true)
    private Project project;

    /** 是否强制必查项 */
    @Column(name = "enforce_required_items", nullable = false)
    private Boolean enforceRequiredItems = Boolean.TRUE;

    /** 问题描述最少字数 */
    @Column(name = "min_description_length", nullable = false)
    private Integer minDescriptionLength = 100;

    /** 重大问题整改期限（小时），BR-1 配置点，默认 24 */
    @Column(name = "major_issue_deadline_hours", nullable = false)
    private Integer majorIssueDeadlineHours = 24;

    /** 一般问题整改默认天数，默认 7 */
    @Column(name = "rectification_deadline_default_days", nullable = false)
    private Integer rectificationDeadlineDefaultDays = 7;

    /** 照片最少张数 */
    @Column(name = "photo_min_count", nullable = false)
    private Integer photoMinCount = 1;

    /** 照片质量等级：STANDARD / HIGH */
    @Column(name = "photo_quality_level", nullable = false, length = 32)
    private String photoQualityLevel = "STANDARD";
}
