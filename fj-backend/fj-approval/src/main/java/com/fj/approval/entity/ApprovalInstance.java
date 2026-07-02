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
 * 审批实例实体（对应 V6 approval_instances 表，§101.21）。
 * <p>一次审批流程的运行实例：日报确认 / 报告审批均复用本实体。
 * <p>通用审批引擎核心实体，由 {@code ApprovalEngineService.createInstance(...)} 创建。
 */
@Entity
@Table(name = "approval_instances")
@Getter
@Setter
public class ApprovalInstance extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 所属项目 ID */
    @Column(name = "project_id", nullable = false)
    private Long projectId;

    /** 审批类型：DAILY_REPORT 日报确认 / REPORT 报告审批 */
    @Enumerated(EnumType.STRING)
    @Column(name = "flow_type", nullable = false, length = 32)
    private ApprovalFlowType flowType;

    /**
     * 关联业务实体 ID（日报 id 或报告 id，按 flowType 解释）。
     */
    @Column(name = "business_id", nullable = false)
    private Long businessId;

    /** 实例状态：PENDING/APPROVED/REJECTED/CANCELLED */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ApprovalStatus status = ApprovalStatus.PENDING;

    /** 当前节点名称（多节点审批流中的当前节点） */
    @Column(name = "current_node", length = 128)
    private String currentNode;

    /** 发起人 ID（通常为日报提交人） */
    @Column(name = "initiator_id")
    private Long initiatorId;

    /** 发起时刻 */
    @Column(name = "initiated_at", nullable = false)
    private OffsetDateTime initiatedAt;

    /** 完成时刻（APPROVED/REJECTED/CANCELLED 时写入） */
    @Column(name = "completed_at")
    private OffsetDateTime completedAt;
}
