package com.fj.system.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;

/**
 * 项目-组织关联实体（对应 V1 project_organizations 表）。
 */
@Entity
@Table(name = "project_organizations")
@Getter
@Setter
public class ProjectOrganization extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;
}
