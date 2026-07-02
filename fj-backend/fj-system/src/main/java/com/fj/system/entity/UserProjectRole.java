package com.fj.system.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;

/**
 * 用户-项目-角色关联实体（对应 V1 user_project_roles 表）。
 * <p>项目级 RBAC 绑定：User → UserProjectRole → Role → Permission（§7.2）。
 * <p>{@code roleId} 用于写入，{@code role} 为只读关联（insertable=false）供权限校验读取。
 */
@Entity
@Table(name = "user_project_roles")
@Getter
@Setter
public class UserProjectRole extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "role_id", nullable = false)
    private Long roleId;

    /** 只读关联：加载角色及其权限集合，供 PermissionChecker 使用 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "role_id", insertable = false, updatable = false)
    private Role role;
}
