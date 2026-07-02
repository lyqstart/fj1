package com.fj.issue.job;

import com.fj.issue.entity.IssueStatus;
import com.fj.issue.entity.ProjectIssue;
import com.fj.issue.repository.ProjectIssueRepository;
import com.fj.issue.service.IssueStatusService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 超期检测定时任务（TASK-027）。
 * <p>每 10 分钟扫描一次，将 status=VALID 且 rectification_deadline < now() 的问题标记为 OVERDUE。
 * <p>cron 表达式 "0 * / 10 * * * *"（每 10 分钟触发一次，秒固定 0）。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OverdueDetectionJob {

    private final ProjectIssueRepository projectIssueRepository;
    private final IssueStatusService issueStatusService;

    /**
     * 超期检测：查找 status=VALID 且 rectification_deadline < now() 的问题，更新为 OVERDUE。
     */
    @Scheduled(cron = "0 */10 * * * *")
    @Transactional
    public void detectOverdue() {
        OffsetDateTime now = OffsetDateTime.now();
        List<ProjectIssue> overdueCandidates = projectIssueRepository
                .findByStatusAndRectificationDeadlineBefore(IssueStatus.VALID, now);

        if (overdueCandidates.isEmpty()) {
            return;
        }

        log.info("超期检测：发现 {} 条超期待整改问题（截止时刻 {}）", overdueCandidates.size(), now);
        for (ProjectIssue issue : overdueCandidates) {
            try {
                issueStatusService.markOverdue(issue);
                projectIssueRepository.save(issue);
                log.info("问题 {}（{}）已标记为 OVERDUE（超期，deadline={}）",
                        issue.getId(), issue.getIssueNo(), issue.getRectificationDeadline());
            } catch (Exception e) {
                log.error("问题 {} 超期标记失败", issue.getId(), e);
            }
        }
    }
}
