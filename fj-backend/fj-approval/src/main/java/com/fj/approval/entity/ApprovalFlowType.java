package com.fj.approval.entity;

/**
 * 审批流类型枚举（对应 approval_flow_configs.flow_type VARCHAR）。
 */
public enum ApprovalFlowType {

    /** 日报确认流程 */
    DAILY_REPORT,
    /** 报告审批流程（周报 / 月报） */
    REPORT
}
