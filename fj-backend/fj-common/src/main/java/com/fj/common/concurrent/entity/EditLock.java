package com.fj.common.concurrent.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;
import java.time.OffsetDateTime;

/**
 * 编辑锁实体（对应 V4 edit_locks 表，§101.20 / DD-8）。
 *
 * <p>用于日报等资源的悲观锁：同一资源同时只能有一个客户端编辑，
 * 锁超时未续期则自动释放。表上有唯一约束 uk_edit_locks_resource (resource_type, resource_id)。
 */
@Entity
@Table(name = "edit_locks")
@Getter
@Setter
public class EditLock extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 项目 ID */
    @Column(name = "project_id", nullable = false)
    private Long projectId;

    /** 被锁定的资源类型（daily_report / inspection_task ...） */
    @Column(name = "resource_type", nullable = false, length = 64)
    private String resourceType;

    /** 被锁定的资源 ID */
    @Column(name = "resource_id", nullable = false)
    private Long resourceId;

    /** 锁令牌（UUID，客户端续锁/释放时携带） */
    @Column(name = "lock_token", nullable = false, length = 64)
    private String lockToken;

    /** 持锁用户 ID */
    @Column(name = "locked_by_user_id", nullable = false)
    private Long lockedByUserId;

    /** 获取时间（由数据库 DEFAULT NOW() 写入，JPA 只读） */
    @Column(name = "acquired_at", insertable = false, updatable = false)
    private OffsetDateTime acquiredAt;

    /** 锁过期时间（超过此时间未续锁视为自动释放） */
    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;
}
