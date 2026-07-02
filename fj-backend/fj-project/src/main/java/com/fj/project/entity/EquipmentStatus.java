package com.fj.project.entity;

/**
 * 设备状态枚举（对应 equipments.status VARCHAR）。
 */
public enum EquipmentStatus {

    /** 正常 */
    NORMAL,
    /** 异常 */
    ABNORMAL,
    /** 停用 */
    OUT_OF_SERVICE,
    /** 未知 */
    UNKNOWN
}
