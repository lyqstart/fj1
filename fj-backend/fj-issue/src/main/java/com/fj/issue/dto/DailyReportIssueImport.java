package com.fj.issue.dto;

import com.fj.common.enume.IssueSeverity;

/**
 * 日报问题导入 DTO（从 DailyReportIssue 映射到 ProjectIssue 的中间载体）。
 * <p><b>循环依赖规避</b>：fj-inspection 依赖 fj-issue（见 fj-inspection/pom.xml），
 * 因此 fj-issue 不能反向引用 fj-inspection 的 DailyReportIssue 类。
 * 调用方（fj-inspection 的日报确认流程，TASK-031）负责将 DailyReportIssue 转为此 DTO，
 * 再调用 {@code IssuePoolService.generateFromDailyReport(...)}。
 *
 * @param sourceIssueId      来源日报问题 ID（DailyReportIssue.id）
 * @param seqNo              日报内序号
 * @param description        问题描述
 * @param severity           严重程度（REQ-13）
 * @param category           问题分类 / 专业
 * @param responsiblePartyId 责任单位/责任人 ID
 * @param location           问题位置描述
 */
public record DailyReportIssueImport(
        Long sourceIssueId,
        Integer seqNo,
        String description,
        IssueSeverity severity,
        String category,
        Long responsiblePartyId,
        String location
) {
}
