package com.fj.system.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;

/**
 * 组织机构实体（对应 V1 organizations 表，树形结构）。
 */
@Entity
@Table(name = "organizations")
@Getter
@Setter
public class Organization extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    /** 父组织 ID，顶层为 null */
    @Column(name = "parent_id")
    private Long parentId;

    @Column(name = "full_name", length = 255)
    private String fullName;

    /** 组织类型：1公司 2部门 3班组 */
    @Column(name = "org_type", nullable = false)
    private Short orgType = (short) 1;
}
