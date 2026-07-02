package com.fj.issue.repository;

import com.fj.issue.entity.IssueStatus;
import com.fj.issue.entity.ProjectIssue;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 项目问题 Repository。
 */
@Repository
public interface ProjectIssueRepository extends JpaRepository<ProjectIssue, Long> {

    /** 按项目 + 状态查询 */
    List<ProjectIssue> findByProjectIdAndStatus(Long projectId, IssueStatus status);

    /** 按责任单位查询 */
    List<ProjectIssue> findByResponsiblePartyId(Long responsiblePartyId);

    /** 按项目查询，按创建时间倒序（最新优先） */
    List<ProjectIssue> findByProjectIdOrderByCreatedAtDesc(Long projectId);

    /** 按来源日报 ID 查询（日报作废联动处理 ProjectIssue 时使用） */
    List<ProjectIssue> findBySourceReportId(Long sourceReportId);

    /** 按项目 + 状态 + 严重程度分页查询（多条件筛选） */
    Page<ProjectIssue> findByProjectIdAndStatusAndSeverity(Long projectId, IssueStatus status,
                                                            com.fj.common.enume.IssueSeverity severity,
                                                            Pageable pageable);

    /** 按项目 + 状态分页查询 */
    Page<ProjectIssue> findByProjectIdAndStatus(Long projectId, IssueStatus status, Pageable pageable);

    /** 按项目分页查询 */
    Page<ProjectIssue> findByProjectId(Long projectId, Pageable pageable);

    /** 统计项目下问题总数（用于生成 issue_no 序号） */
    long countByProjectId(Long projectId);

    /**
     * 查找超期待整改问题（OverdueDetectionJob 调用，TASK-027）。
     * <p>status=VALID 且 rectification_deadline < cutoff（通常为 now()）。
     */
    List<ProjectIssue> findByStatusAndRectificationDeadlineBefore(IssueStatus status, OffsetDateTime cutoff);
}
