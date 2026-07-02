package com.fj.project.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EnumType;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;

/**
 * 检查项-标准条款绑定实体（对应 V3 check_item_standard_bindings 表）。
 * <p>建立检查项（InspectionFormItem）与标准条款（StandardClause）的关联。
 * <br>standard_clause_id 为跨模块 Long 外键（fj-recommend 模块），不建 JPA 关联以避免循环依赖。
 */
@Entity
@Table(name = "check_item_standard_bindings")
@Getter
@Setter
public class CheckItemStandardBinding extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "check_item_id", nullable = false)
    private Long checkItemId;

    /** 标准条款 ID（fj-recommend.StandardClause，跨模块 Long 外键） */
    @Column(name = "standard_clause_id", nullable = false)
    private Long standardClauseId;

    @Enumerated(EnumType.STRING)
    @Column(name = "binding_type", nullable = false, length = 32)
    private BindingType bindingType = BindingType.RECOMMENDED;

    /** 推荐权重（0-100），默认 50 */
    @Column(name = "score_weight", nullable = false)
    private Integer scoreWeight = 50;
}
