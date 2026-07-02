package com.fj.approval.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;
import java.io.Serializable;
import java.time.OffsetDateTime;

/**
 * 审批记录实体（对应 V6 approval_records 表，§7.4 链式哈希留痕）。
 * <p><b>只写不可变实体</b>：本实体只支持 INSERT，禁止 UPDATE / DELETE。
 * <ul>
 *   <li>不继承 {@code BaseEntity}（BaseEntity 含 updated_at/updated_by，与本实体"不可更新"语义冲突）</li>
 *   <li>仅含 {@code created_at}（无 updated_at），数据库层通过触发器阻断 UPDATE/DELETE（见 V6 迁移）</li>
 *   <li>链式哈希：{@code record_hash} = SHA-256({@code prev_hash} + content)，{@code prev_hash} 指向上一条记录</li>
 * </ul>
 * <p>由 {@code ApprovalEngineService} 在每次 approve/reject 时写入，作为不可篡改的审批留痕。
 */
@Entity
@Table(name = "approval_records")
@Getter
@Setter
public class ApprovalRecord implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键（PostgreSQL GENERATED ALWAYS AS IDENTITY） */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    /** 所属审批实例 ID */
    @Column(name = "instance_id", nullable = false)
    private Long instanceId;

    /** 关联审批任务（可空：实例级操作如 CANCEL 不关联任务） */
    @Column(name = "task_id")
    private Long taskId;

    /** 操作人 ID */
    @Column(name = "approver_id", nullable = false)
    private Long approverId;

    /** 审批动作：APPROVE 通过 / REJECT 退回 */
    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 32)
    private ApprovalAction action;

    /** 审批意见快照 */
    @Column(name = "comment", columnDefinition = "text")
    private String comment;

    /** 当前记录哈希（SHA-256，64 位十六进制），防篡改 */
    @Column(name = "record_hash", nullable = false, length = 64)
    private String recordHash;

    /** 上一条记录哈希，形成防篡改链（首条为 NULL） */
    @Column(name = "prev_hash", length = 64)
    private String prevHash;

    /** 记录创建时刻（§7.4 不可变：由数据库 DEFAULT NOW() 写入，JPA 只读） */
    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;
}
