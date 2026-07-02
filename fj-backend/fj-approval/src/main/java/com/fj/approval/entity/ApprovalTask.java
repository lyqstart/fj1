package com.fj.approval.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;
import java.time.OffsetDateTime;

/**
 * 审批任务实体（对应 V6 approval_tasks 表，§101.21）。
 * <p>审批实例下分派给具体审批人的任务（一个实例 → 多个任务，按节点串联）。
 * <p>由 {@code ApprovalEngineService} 在创建实例 / 推进节点时生成。
 */
@Entity
@Table(name = "approval_tasks")
@Getter
@Setter
public class ApprovalTask extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 所属审批实例 ID */
    @Column(name = "instance_id", nullable = false)
    private Long instanceId;

    /** 审批人 ID（users.id） */
    @Column(name = "assignee_id", nullable = false)
    private Long assigneeId;

    /** 节点名称（对应 approval_flow_configs.config_json 的节点 name） */
    @Column(name = "node_name", nullable = false, length = 128)
    private String nodeName;

    /** 任务状态：PENDING/APPROVED/REJECTED */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ApprovalTaskStatus status = ApprovalTaskStatus.PENDING;

    /** 审批意见（审批通过/退回时填入） */
    @Column(name = "comment", columnDefinition = "text")
    private String comment;

    /** 分派时刻 */
    @Column(name = "assigned_at", nullable = false)
    private OffsetDateTime assignedAt;

    /** 完成时刻（APPROVED/REJECTED 时写入） */
    @Column(name = "completed_at")
    private OffsetDateTime completedAt;
}
