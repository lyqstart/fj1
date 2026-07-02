package com.fj.approval.entity;

/**
 * 审批动作枚举（对应 approval_records.action VARCHAR，§7.4）。
 * <p>每次审批操作（通过/退回）在 approval_records 中留痕，action 标识动作类型。
 */
public enum ApprovalAction {

    /** 通过 */
    APPROVE,
    /** 退回 */
    REJECT
}
