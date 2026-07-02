package com.fj.report.entity;

import com.fj.common.enume.BaseEnum;

/**
 * 报告状态枚举（对应 reports.status VARCHAR，BR-8 报告状态机）。
 * <p>状态流转（§102.8 BR-8）：
 * <ul>
 *   <li>{@link #DRAFT} 草稿 → 提交审批 → {@link #IN_REVIEW}</li>
 *   <li>{@link #IN_REVIEW} 审批中 → 通过 → {@link #PENDING_PUBLISH}；退回 → {@link #RETURNED}</li>
 *   <li>{@link #PENDING_PUBLISH} 待发布 → 发布 → {@link #PUBLISHED}（BR-4 发布即固化）</li>
 *   <li>{@link #RETURNED} 已退回 → 修改后重新提交 → {@link #IN_REVIEW}</li>
 * </ul>
 */
public enum ReportStatus implements BaseEnum {

    /** 草稿 */
    DRAFT(1, "草稿"),
    /** 审批中 */
    IN_REVIEW(2, "审批中"),
    /** 待发布 */
    PENDING_PUBLISH(3, "待发布"),
    /** 已发布（BR-4 发布即固化） */
    PUBLISHED(4, "已发布"),
    /** 已退回 */
    RETURNED(5, "已退回");

    private final int code;
    private final String description;

    ReportStatus(int code, String description) {
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
