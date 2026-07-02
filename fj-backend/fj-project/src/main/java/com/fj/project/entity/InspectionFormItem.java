package com.fj.project.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;

/**
 * 检查表条目实体（对应 V3 inspection_form_items 表）。
 * <p>standard_binding_id 关联 check_item_standard_bindings（检查项-标准绑定）。
 */
@Entity
@Table(name = "inspection_form_items")
@Getter
@Setter
public class InspectionFormItem extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "form_id", nullable = false)
    private Long formId;

    /** 检查分类 / 专业 */
    @Column(name = "category", length = 64)
    private String category;

    @Column(name = "check_content", nullable = false, length = 512)
    private String checkContent;

    @Column(name = "is_required", nullable = false)
    private Boolean isRequired = Boolean.FALSE;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    /** 默认绑定标准条款 ID（关联 check_item_standard_bindings） */
    @Column(name = "standard_binding_id")
    private Long standardBindingId;
}
