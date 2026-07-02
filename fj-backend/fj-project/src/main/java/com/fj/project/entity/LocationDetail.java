package com.fj.project.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;

/**
 * 位置明细实体（对应 V4 location_details 表，§101.8）。
 * <p>任务关联的检查位置，含 WGS84 经纬度。
 */
@Entity
@Table(name = "location_details")
@Getter
@Setter
public class LocationDetail extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "task_id", nullable = false)
    private Long taskId;

    /** 冗余项目 ID，便于按项目筛选位置 */
    @Column(name = "project_id", nullable = false)
    private Long projectId;

    /** 位置名称（如"主厂房 1F 配电室"） */
    @Column(name = "name", nullable = false, length = 255)
    private String name;

    /** 详细地址 */
    @Column(name = "address", length = 512)
    private String address;

    /** 经度（WGS84） */
    @Column(name = "longitude")
    private Double longitude;

    /** 纬度（WGS84） */
    @Column(name = "latitude")
    private Double latitude;

    /** 同一任务下多个位置的排序 */
    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;
}
