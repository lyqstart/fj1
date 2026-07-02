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

/**
 * 项目检查表实体（对应 V3 project_inspection_forms 表）。
 * <p>按项目组织，含版本号；发布（DRAFT→ACTIVE）后条目锁定。
 */
@Entity
@Table(name = "project_inspection_forms")
@Getter
@Setter
public class ProjectInspectionForm extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    /** 版本号，发布后递增 */
    @Column(name = "version", nullable = false)
    private Integer version = 1;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private FormStatus status = FormStatus.DRAFT;
}
