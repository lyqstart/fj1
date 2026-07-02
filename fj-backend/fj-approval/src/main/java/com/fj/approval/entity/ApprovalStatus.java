package com.fj.approval.entity;

/**
 * 审批实例状态枚举（对应 approval_instances.status VARCHAR，§101.21）。
 * <pre>
 *   PENDING    待审（实例已发起，等待审批人处理）
 *   APPROVED   已通过（所有节点通过）
 *   REJECTED   已退回（任一节点退回）
 *   CANCELLED  已撤销（发起人撤销）
 * </pre>
 */
public enum ApprovalStatus {

    /** 待审 */
    PENDING,
    /** 已通过 */
    APPROVED,
    /** 已退回 */
    REJECTED,
    /** 已撤销 */
    CANCELLED
}
