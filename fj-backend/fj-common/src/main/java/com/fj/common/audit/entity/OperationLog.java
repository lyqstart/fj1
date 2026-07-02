package com.fj.common.audit.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;

/**
 * 操作日志实体（对应 V1 operation_logs 表，§7.4 链式哈希防篡改）。
 *
 * <p><b>只写不可改删</b>：本实体的仓储仅提供插入与查询，不提供 update/delete 方法，
 * 任何修改历史日志的行为都应被拒绝（链式哈希会检测到篡改）。
 */
@Entity
@Table(name = "operation_logs")
@Getter
@Setter
public class OperationLog extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 操作人 ID */
    @Column(name = "operator_id", nullable = false)
    private Long operatorId;

    /** 操作类型：create/update/delete/approve/login */
    @Column(name = "operation_type", nullable = false, length = 32)
    private String operationType;

    /** 目标实体类型 */
    @Column(name = "target_type", nullable = false, length = 64)
    private String targetType;

    /** 目标实体 ID（可空，如 login 无具体目标） */
    @Column(name = "target_id")
    private Long targetId;

    /** 操作内容描述 */
    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    /** 当前记录哈希（SHA-256） */
    @Column(name = "log_hash", nullable = false, length = 64)
    private String logHash;

    /** 上一条记录哈希，形成防篡改链（可为空，首条记录无前驱） */
    @Column(name = "prev_hash", length = 64)
    private String prevHash;
}
