package com.fj.common.jpa;

import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;
import java.io.Serializable;
import java.time.OffsetDateTime;

/**
 * 横切服务（Notification / OperationLog / EditLock）的 JPA 基类。
 *
 * <p>设计说明：本类是全项目唯一的 JPA 基类（@MappedSuperclass），
 * 所有业务模块（fj-system / fj-project / fj-inspection 等）的实体均继承本类。
 * 位于 fj-common 以保证所有模块可访问，避免循环依赖。对应 V1 各表公共列：
 * id / server_seq / created_at / updated_at / created_by / updated_by。
 */
@Getter
@Setter
@MappedSuperclass
public abstract class BaseEntity implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键（PostgreSQL GENERATED ALWAYS AS IDENTITY） */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    /** 同步序列号，用于离线同步冲突检测（§6.2），默认 0 */
    @Column(name = "server_seq", nullable = false)
    private Long serverSeq = 0L;

    /** 创建时间（由数据库 DEFAULT NOW() 写入，JPA 只读） */
    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    /** 更新时间（由触发器 trg_set_updated_at 维护，JPA 只读） */
    @Column(name = "updated_at", insertable = false, updatable = false)
    private OffsetDateTime updatedAt;

    /** 创建人 ID */
    @Column(name = "created_by")
    private Long createdBy;

    /** 更新人 ID */
    @Column(name = "updated_by")
    private Long updatedBy;
}
