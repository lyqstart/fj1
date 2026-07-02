package com.fj.common.port;

/**
 * 问题引用检查端口接口。
 * <p>解决 fj-issue 不能直接依赖 fj-report 的循环依赖问题。
 * <p>端口定义在 fj-common（共享模块），实际适配器实现在 fj-report 模块
 * （{@code ReportIssueReferenceChecker}），由 fj-issue 通过依赖倒置注入消费。
 */
public interface IssueReferenceChecker {
    /**
     * 检查指定问题是否被已发布（PUBLISHED）状态的报告快照引用。
     * <p>用于 DD-9 联动：作废问题时若被已发布报告引用，应走后续更正（CORRECTED）分支。
     *
     * @param issueId 问题 ID
     * @return {@code true} 如果被已发布报告引用（→ 后续更正分支，DD-9）
     */
    boolean isReferencedByPublishedReport(Long issueId);
}
