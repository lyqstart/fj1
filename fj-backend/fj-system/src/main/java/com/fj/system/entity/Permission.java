package com.fj.system.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;

/**
 * 权限实体（对应 V1 permissions 表）。
 * <p>权限粒度 = resource + action（§7.2），如 (resource=daily_report, action=submit)。
 */
@Entity
@Table(name = "permissions")
@Getter
@Setter
public class Permission extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 权限编码，唯一，如 daily_report:submit */
    @Column(name = "code", nullable = false, length = 128)
    private String code;

    @Column(name = "name", nullable = false, length = 64)
    private String name;

    /** 受保护资源标识 */
    @Column(name = "resource", nullable = false, length = 128)
    private String resource;

    /** 操作类型：create/read/update/delete/manage 等 */
    @Column(name = "action", nullable = false, length = 32)
    private String action;

    @Column(name = "description", length = 255)
    private String description;
}
