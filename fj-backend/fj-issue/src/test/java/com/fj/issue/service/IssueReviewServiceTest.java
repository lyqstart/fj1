package com.fj.issue.service;

import com.fj.common.port.IssueReferenceChecker;
import com.fj.issue.entity.IssueStatus;
import com.fj.issue.entity.ProjectIssue;
import com.fj.issue.repository.ProjectIssueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link IssueReviewService} 单元测试。
 *
 * <p>聚焦 DD-9 联动检查（TASK-W02-041，G3 修复后）：组长执行作废（VOID）动作时，
 * 通过 {@link IssueReferenceChecker} 端口查询该问题是否被已发布报告引用——
 * <ul>
 *   <li>被引用 → 走后续更正分支，状态推进至 {@link IssueStatus#CORRECTED}</li>
 *   <li>未被引用 → 保持作废，状态停留在 {@link IssueStatus#VOIDED}</li>
 * </ul>
 *
 * <p>测试覆盖 {@code IssueReviewService#review} 的 VOID 分支两条路径，校验：
 * 状态机守卫调用顺序、{@link IssueReferenceChecker} 端口调用、以及最终持久化状态。
 */
@ExtendWith(MockitoExtension.class)
class IssueReviewServiceTest {

    private static final Long ISSUE_ID = 1L;

    @Mock
    private ProjectIssueRepository projectIssueRepository;

    @Mock
    private IssueStatusService issueStatusService;

    @Mock
    private IssueReferenceChecker issueReferenceChecker;

    @InjectMocks
    private IssueReviewService issueReviewService;

    private ProjectIssue issue;

    @BeforeEach
    void setUp() {
        // 构造一个处于 VALID（合法作废来源）的问题，仅用于驱动 review(VOID) 逻辑，
        // 持久化层已 Mock，无需填充全部非空列。
        issue = new ProjectIssue();
        issue.setId(ISSUE_ID);
        issue.setStatus(IssueStatus.VALID);

        // findById：review() 入口加载问题
        when(projectIssueRepository.findById(ISSUE_ID)).thenReturn(Optional.of(issue));
        // save：返回传入实体（模拟真实 JPA 返回受管实体），保证后续 setStatus 对同一引用生效
        when(projectIssueRepository.save(any(ProjectIssue.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    /**
     * 场景 1：被已发布报告引用 → 作废后联动走 CORRECTED 分支（DD-9 后续更正）。
     *
     * <p>断言：返回问题状态为 CORRECTED（而非 VOIDED），且状态机守卫被依次调用
     * (VALID→VOIDED) 与 (VOIDED→CORRECTED)，端口被查询一次。
     */
    @Test
    @DisplayName("作废问题·被已发布报告引用 → 走 DD-9 后续更正分支（CORRECTED）")
    void testVoidDailyReport_IssueReferencedByPublishedReport_GoesToCorrected() {
        // given：端口返回“被已发布报告引用”
        when(issueReferenceChecker.isReferencedByPublishedReport(ISSUE_ID)).thenReturn(true);

        // when：组长执行作废动作
        ProjectIssue result = issueReviewService.review(ISSUE_ID, ReviewAction.VOID, "作废-已发布报告引用", null);

        // then：状态推进至 CORRECTED（DD-9 后续更正），不是 VOIDED
        assertThat(result).as("返回的应为被 save 返回的同一受管实体").isSameAs(issue);
        assertThat(result.getStatus())
                .as("被已发布报告引用的作废问题必须走 CORRECTED 分支")
                .isEqualTo(IssueStatus.CORRECTED);

        // 状态机守卫：先 (VALID → VOIDED)，再 (VOIDED → CORRECTED)
        verify(issueStatusService).guardTransition(IssueStatus.VALID, IssueStatus.VOIDED);
        verify(issueStatusService).guardTransition(IssueStatus.VOIDED, IssueStatus.CORRECTED);
        // DD-9 联动端口必须被调用一次
        verify(issueReferenceChecker).isReferencedByPublishedReport(ISSUE_ID);
    }

    /**
     * 场景 2：未被任何已发布报告引用 → 保持作废（VOIDED），不触发 DD-9 更正分支。
     *
     * <p>断言：返回问题状态为 VOIDED，状态机守卫仅调用一次 (VALID→VOIDED)，
     * 不出现 (VOIDED→CORRECTED) 的更正守卫调用，端口被查询一次。
     */
    @Test
    @DisplayName("作废问题·未被已发布报告引用 → 保持作废（VOIDED）")
    void testVoidDailyReport_IssueNotReferenced_GoesToVoided() {
        // given：端口返回“未被引用”
        when(issueReferenceChecker.isReferencedByPublishedReport(ISSUE_ID)).thenReturn(false);

        // when：组长执行作废动作
        ProjectIssue result = issueReviewService.review(ISSUE_ID, ReviewAction.VOID, "作废-未引用", null);

        // then：状态停留在 VOIDED
        assertThat(result).as("返回的应为被 save 返回的同一受管实体").isSameAs(issue);
        assertThat(result.getStatus())
                .as("未被引用的作废问题应保持 VOIDED，不进入 CORRECTED")
                .isEqualTo(IssueStatus.VOIDED);

        // 状态机守卫：仅 (VALID → VOIDED)，不得出现 (VOIDED → CORRECTED)
        verify(issueStatusService).guardTransition(IssueStatus.VALID, IssueStatus.VOIDED);
        verify(issueStatusService, never()).guardTransition(eq(IssueStatus.VOIDED), any());
        // DD-9 联动端口仍被查询一次（结果 false）
        verify(issueReferenceChecker).isReferencedByPublishedReport(ISSUE_ID);
    }
}
