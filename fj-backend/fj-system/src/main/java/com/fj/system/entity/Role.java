package com.fj.system.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;
import java.util.HashSet;
import java.util.Set;

/**
 * 角色实体（对应 V1 roles 表）。
 * <p>通过 role_permissions 关联表与 {@link Permission} 多对多。
 * <p>EAGER 加载权限集合：角色数量少（<50），权限校验需即时读取，避免 N+1。
 */
@Entity
@Table(name = "roles")
@Getter
@Setter
public class Role extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 角色编码，唯一，如 ROLE_INSPECTOR */
    @Column(name = "code", nullable = false, length = 64)
    private String code;

    @Column(name = "name", nullable = false, length = 64)
    private String name;

    @Column(name = "description", length = 255)
    private String description;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "role_permissions",
            joinColumns = @JoinColumn(name = "role_id"),
            inverseJoinColumns = @JoinColumn(name = "permission_id")
    )
    private Set<Permission> permissions = new HashSet<>();
}
