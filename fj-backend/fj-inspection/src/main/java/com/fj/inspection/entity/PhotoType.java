package com.fj.inspection.entity;

/**
 * 照片类型枚举（对应 photos.photo_type VARCHAR，§101.13）。
 */
public enum PhotoType {

    /** 全景照片 */
    PANORAMA,
    /** 细节照片（问题特写） */
    DETAIL,
    /** 概览照片（环境/位置参考） */
    OVERVIEW,
    /** 整改后照片（复检取证） */
    AFTER_RECTIFICATION
}
