package com.fj.project.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 检查任务实体（对应 V4 inspection_tasks 表，§101.7）。
 * <p>服务端下派、离线可编辑；BR-7 任务状态机见 {@link InspectionTaskStatus}。
 */
@Entity
@Table(name = "inspection_tasks")
@Getter
@Setter
public class InspectionTask extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    /** 关联的已发布检查表（§101.7），NULL 表示自由任务 */
    @Column(name = "form_id")
    private Long formId;

    /** 任务编号（业务可读，如 IT-2026-0001，唯一） */
    @Column(name = "task_no", nullable = false, length = 64)
    private String taskNo;

    /** 任务名称（对应安卓 prompt 的 title） */
    @Column(name = "task_name", nullable = false, length = 255)
    private String taskName;

    /** 计划检查日期 */
    @Column(name = "task_date")
    private LocalDate taskDate;

    /** 被指派的检查人员 ID（§101.7） */
    @Column(name = "inspector_id", nullable = false)
    private Long inspectorId;

    /** 指派的组织 ID（V1 organizations） */
    @Column(name = "assigned_org_id")
    private Long assignedOrgId;

    @Enumerated(EnumType.STRING)
    @Column(name = "task_status", nullable = false, length = 32)
    private InspectionTaskStatus taskStatus = InspectionTaskStatus.ASSIGNED;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    /** 计划开始时间 */
    @Column(name = "planned_date")
    private OffsetDateTime plannedDate;

    /** 任务完成时间（SUBMITTED 时写入） */
    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    /** 任务取消时间 */
    @Column(name = "cancelled_at")
    private OffsetDateTime cancelledAt;

    /** 派发时位置 ID（冗余快照引用） */
    @Column(name = "location_id")
    private Long locationId;

    /** 派发时位置名称冗余快照 */
    @Column(name = "location_name_snapshot", length = 255)
    private String locationNameSnapshot;
}
