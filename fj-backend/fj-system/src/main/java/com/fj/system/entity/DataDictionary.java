package com.fj.system.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;

/**
 * 数据字典实体（对应 V1 data_dictionaries 表）。
 * <p>枚举型业务数据（问题等级、照片类型、同步状态等）的集中管理。
 */
@Entity
@Table(name = "data_dictionaries")
@Getter
@Setter
public class DataDictionary extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 字典分类，如 issue_severity / photo_type */
    @Column(name = "category", nullable = false, length = 64)
    private String category;

    @Column(name = "code", nullable = false, length = 64)
    private String code;

    @Column(name = "value", nullable = false, length = 255)
    private String value;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;
}
