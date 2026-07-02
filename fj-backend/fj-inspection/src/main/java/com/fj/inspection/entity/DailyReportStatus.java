package com.fj.inspection.entity;

/**
 * 日报状态枚举（对应 daily_reports.status VARCHAR，§101.9 / BR-5 状态机）。
 * <pre>
 *   DRAFT 草稿
 *     → SUBMITTED 已提交
 *       → RETURNED 已退回（可回 DRAFT 修改后重新提交）
 *       → LOCKED 已锁定（确认即锁定，§102.2）
 *     → VOIDED 已作废（终态）
 * </pre>
 * 关键裁决：
 * - DD-8：confirmed_at（业务语义）与 locked_at（持久化锁定）分开，但 LOCKED 时同事务写入。
 * - BR-3：确认即锁定，原日报不可修改。
 */
public enum DailyReportStatus {

    /** 草稿（检查员编辑中） */
    DRAFT,
    /** 已提交（等待组长确认/退回） */
    SUBMITTED,
    /** 已退回（组长退回，附退回意见，可回 DRAFT 修改） */
    RETURNED,
    /** 已锁定（确认即锁定，§102.2，confirmed_at + locked_at 同事务写入，DD-8） */
    LOCKED,
    /** 已作废（终态） */
    VOIDED
}
