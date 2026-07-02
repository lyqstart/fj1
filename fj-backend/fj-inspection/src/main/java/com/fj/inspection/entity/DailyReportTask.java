package com.fj.inspection.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;

/**
 * 日报关联任务实体（对应 V5 daily_report_tasks 表，§101.15）。
 * <p>一份日报可关联多个检查任务（多任务日报整体操作 §101.22）；
 * {@link #taskSnapshot} 保存日报时刻的任务冗余副本，避免任务后续变更影响历史日报。
 */
@Entity
@Table(name = "daily_report_tasks")
@Getter
@Setter
public class DailyReportTask extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "daily_report_id", nullable = false)
    private Long dailyReportId;

    @Column(name = "task_id", nullable = false)
    private Long taskId;

    /**
     * 任务快照（JSONB，日报时刻的 InspectionTask 冗余副本）。
     * <p>对应 V5 daily_report_tasks.task_snapshot，存储任务关键字段的 JSON 字符串。
     */
    @Column(name = "task_snapshot", columnDefinition = "jsonb")
    private String taskSnapshot;
}
