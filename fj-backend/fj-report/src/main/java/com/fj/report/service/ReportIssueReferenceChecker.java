package com.fj.report.service;

import com.fj.common.port.IssueReferenceChecker;
import com.fj.report.repository.ReportIssueSnapshotRepository;
import org.springframework.stereotype.Component;

/**
 * {@link IssueReferenceChecker} 端口的适配器实现（位于 fj-report 模块）。
 * <p>通过查询 report_issue_snapshots 表，检查问题是否被 PUBLISHED 状态的报告引用（DD-9 联动）。
 * <p>注册为 Spring {@code @Component}，在应用启动时由 fj-issue 的 {@code IssueReviewService}
 * 通过构造器注入（依赖倒置，fj-issue 仅依赖 fj-common 中的端口接口）。
 */
@Component
public class ReportIssueReferenceChecker implements IssueReferenceChecker {

    private final ReportIssueSnapshotRepository snapshotRepository;

    public ReportIssueReferenceChecker(ReportIssueSnapshotRepository snapshotRepository) {
        this.snapshotRepository = snapshotRepository;
    }

    @Override
    public boolean isReferencedByPublishedReport(Long issueId) {
        if (issueId == null) {
            return false;
        }
        return snapshotRepository.countByIssueIdInPublishedReport(issueId) > 0;
    }
}
