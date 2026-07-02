package com.fj.project.entity;

/**
 * 检查任务状态枚举（对应 inspection_tasks.task_status VARCHAR）。
 * <p>BR-7 任务状态机：
 * <pre>
 *   ASSIGNED 待接收
 *     → ACCEPTED 已接收
 *       → IN_PROGRESS 进行中
 *         → SUBMITTED 已提交
 *     → CANCELLED 已取消（终态）
 * </pre>
 * 任意非终态在满足业务条件时可被 CANCELLED。
 */
public enum InspectionTaskStatus {

    /** 待接收（任务已下派，检查员尚未确认） */
    ASSIGNED,
    /** 已接收（检查员已确认领取任务） */
    ACCEPTED,
    /** 进行中（检查员已开始现场检查） */
    IN_PROGRESS,
    /** 已提交（检查员完成检查并提交） */
    SUBMITTED,
    /** 已取消（终态） */
    CANCELLED
}
