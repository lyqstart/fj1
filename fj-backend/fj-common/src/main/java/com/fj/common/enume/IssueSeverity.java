package com.fj.common.enume;

/**
 * 问题严重程度枚举（对应 daily_report_issues.severity / project_issues.severity VARCHAR，REQ-13）。
 * <p>共享枚举：fj-inspection（日报问题）和 fj-issue（项目问题池）共用，避免模块间循环依赖。
 * <p>三级分类用于整改期限计算（BR-1）：
 * <ul>
 *   <li>{@link #GENERAL} 一般 → 默认 +7 天</li>
 *   <li>{@link #MAJOR} 较大 → 默认 +3 天（可被 ProjectConfig.major_issue_deadline_hours 覆盖）</li>
 *   <li>{@link #CRITICAL} 重大 → 当日 23:59:59（或由 major_issue_deadline_hours 覆盖）</li>
 * </ul>
 */
public enum IssueSeverity {

    /** 一般问题（整改期限 +7 天，BR-1） */
    GENERAL,
    /** 较大问题（整改期限 +3 天，BR-1；可被 major_issue_deadline_hours 覆盖） */
    MAJOR,
    /** 重大问题（整改期限当日 23:59:59，BR-1；可被 major_issue_deadline_hours 覆盖） */
    CRITICAL
}
