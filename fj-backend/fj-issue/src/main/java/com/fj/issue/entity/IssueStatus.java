package com.fj.issue.entity;

import com.fj.common.enume.BaseEnum;

/**
 * 项目问题池状态枚举（对应 project_issues.status VARCHAR）。
 * <p>综合 TASK-026（问题池生命周期）和 TASK-027（整改状态机）的全部状态：
 * <ul>
 *   <li>{@link #VALID} 有效/待整改（进入问题池的初始状态）</li>
 *   <li>{@link #PENDING_CONFIRM} 待确认（待审核入池）</li>
 *   <li>{@link #RECTIFIED} 已整改（整改完成，待验证关闭）</li>
 *   <li>{@link #CLOSED} 已关闭（整改验证通过，闭环）</li>
 *   <li>{@link #OVERDUE} 超期（整改期限已过，由 OverdueDetectionJob 自动标记）</li>
 *   <li>{@link #SUSPENDED} 暂停（临时挂起，不计入超期检测）</li>
 *   <li>{@link #VOIDED} 作废（无效化，退出问题池）</li>
 *   <li>{@link #CORRECTED} 已纠正（与 RECTIFIED 语义相近，保留兼容）</li>
 * </ul>
 * <p>持久化按 {@link Enum#name()} 存储（@Enumerated(EnumType.STRING)），BaseEnum 的 code/description 仅用于展示。
 */
public enum IssueStatus implements BaseEnum {

    VALID(1, "有效"),
    PENDING_CONFIRM(2, "待确认"),
    RECTIFIED(3, "已整改"),
    CLOSED(4, "已关闭"),
    OVERDUE(5, "超期"),
    SUSPENDED(6, "暂停"),
    VOIDED(7, "作废"),
    CORRECTED(8, "已纠正");

    private final int code;
    private final String description;

    IssueStatus(int code, String description) {
        this.code = code;
        this.description = description;
    }

    @Override
    public int getCode() {
        return code;
    }

    @Override
    public String getDescription() {
        return description;
    }
}
