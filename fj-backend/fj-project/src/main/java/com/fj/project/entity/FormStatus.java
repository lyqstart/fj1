package com.fj.project.entity;

/**
 * 检查表状态枚举（对应 project_inspection_forms.status VARCHAR）。
 */
public enum FormStatus {

    /** 草稿（可编辑条目） */
    DRAFT,
    /** 已发布（条目锁定，不可修改） */
    ACTIVE,
    /** 已归档 */
    ARCHIVED
}
