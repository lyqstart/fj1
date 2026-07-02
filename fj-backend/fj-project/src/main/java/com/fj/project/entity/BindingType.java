package com.fj.project.entity;

/**
 * 检查项-标准条款绑定类型枚举（对应 check_item_standard_bindings.binding_type VARCHAR）。
 */
public enum BindingType {

    /** 固定绑定（不可在检查时替换） */
    FIXED,
    /** 推荐绑定（检查时可替换 / 忽略） */
    RECOMMENDED
}
