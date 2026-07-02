package com.fj.issue.entity;

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
 * 问题关联实体（对应 V5 issue_relations 表）。
 * <p>记录两个 ProjectIssue 之间的关联关系（重复 / 相似）。
 */
@Entity
@Table(name = "issue_relations")
@Getter
@Setter
public class IssueRelation extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 源问题 ID */
    @Column(name = "source_issue_id", nullable = false)
    private Long sourceIssueId;

    /** 目标问题 ID */
    @Column(name = "target_issue_id", nullable = false)
    private Long targetIssueId;

    /** 关联类型：DUPLICATE/SIMILAR */
    @Enumerated(EnumType.STRING)
    @Column(name = "relation_type", nullable = false, length = 32)
    private RelationType relationType;
}
