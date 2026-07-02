package com.fj.project.entity;

/**
 * 项目状态枚举（对应 projects.status VARCHAR）。
 * <p>按 {@code @Enumerated(EnumType.STRING)} 持久化，DB 可读。
 */
public enum ProjectStatus {

    /** 筹备中 */
    PREPARING,
    /** 进行中 */
    ACTIVE,
    /** 已结束 */
    COMPLETED,
    /** 已归档 */
    ARCHIVED
}
