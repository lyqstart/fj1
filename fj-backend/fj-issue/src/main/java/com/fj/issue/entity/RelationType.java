package com.fj.issue.entity;

/**
 * 问题关联类型枚举（对应 issue_relations.relation_type VARCHAR）。
 * <p>记录两个 ProjectIssue 之间的关联关系。
 */
public enum RelationType {

    /** 重复问题（同一问题的不同来源） */
    DUPLICATE,
    /** 相似问题（内容/根因相近） */
    SIMILAR
}
