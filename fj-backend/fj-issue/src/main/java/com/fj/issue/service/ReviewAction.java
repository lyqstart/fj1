package com.fj.issue.service;

/**
 * 组长复核动作枚举（TASK-032）。
 */
public enum ReviewAction {

    /** 复核通过，推进至下一阶段（PENDING_CONFIRM → VALID） */
    PASS,
    /** 退回给检查员（记录退回意见） */
    RETURN,
    /** 调整严重程度等级（记录原等级） */
    ADJUST,
    /** 作废问题（→ VOIDED，被已发布报告引用则 → CORRECTED） */
    VOID,
    /** 后续更正（DD-9，终态，不可回退到 VALID） */
    CORRECT
}
