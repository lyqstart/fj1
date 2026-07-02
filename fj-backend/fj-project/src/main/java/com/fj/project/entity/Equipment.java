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

/**
 * 设备实体（对应 V4 equipments 表，§101.6）。
 * <p>任务关联的被检设备。
 */
@Entity
@Table(name = "equipments")
@Getter
@Setter
public class Equipment extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "task_id", nullable = false)
    private Long taskId;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    /** 设备名称 */
    @Column(name = "name", nullable = false, length = 255)
    private String name;

    /** 设备型号 */
    @Column(name = "model", length = 128)
    private String model;

    /** 规格参数 */
    @Column(name = "specification", length = 512)
    private String specification;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private EquipmentStatus status = EquipmentStatus.NORMAL;

    /** 关联位置明细（§101.8），可为空 */
    @Column(name = "location_id")
    private Long locationId;
}
