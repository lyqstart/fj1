package com.fj.recommend.entity;

/**
 * 标准文档状态枚举（对应 standard_documents.status VARCHAR）。
 */
public enum StandardDocumentStatus {

    /** 草稿 */
    DRAFT,
    /** 启用（已发布生效） */
    PUBLISHED,
    /** 已废止（被新版本替代） */
    SUPERSEDED
}
