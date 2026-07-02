package com.fj.approval.entity;

/**
 * 审批任务状态枚举（对应 approval_tasks.status VARCHAR，§101.21）。
 * <pre>
 *   PENDING   待处理（已分派给审批人，等待操作）
 *   APPROVED  已通过（审批人通过）
 *   REJECTED  已退回（审批人退回）
 * </pre>
 */
public enum ApprovalTaskStatus {

    /** 待处理 */
    PENDING,
    /** 已通过 */
    APPROVED,
    /** 已退回 */
    REJECTED
}
