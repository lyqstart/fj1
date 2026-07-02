package com.fj.project.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EnumType;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;
import java.time.LocalDate;

/**
 * 项目实体（对应 V3 projects 表）。
 * <p>项目是飞检业务的顶层聚合根，检查表 / 任务 / 日报 / 问题均挂在项目下。
 */
@Entity
@Table(name = "projects")
@Getter
@Setter
public class Project extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    /** 项目编号，可手填或系统生成（唯一） */
    @Column(name = "code", length = 64)
    private String code;

    @Column(name = "description", length = 512)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ProjectStatus status;

    /** 项目扩展配置 JSON（结构化配置项优先存 ProjectConfig） */
    @Column(name = "config_json", columnDefinition = "jsonb")
    private String configJson;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;
}
