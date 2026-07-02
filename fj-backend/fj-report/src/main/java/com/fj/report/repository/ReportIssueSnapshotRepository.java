package com.fj.report.repository;

import com.fj.report.entity.ReportIssueSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 问题快照 Repository。
 */
@Repository
public interface ReportIssueSnapshotRepository extends JpaRepository<ReportIssueSnapshot, Long> {

    /** 按报告 ID 查询全部快照（按 sort_order 升序） */
    List<ReportIssueSnapshot> findByReportIdOrderBySortOrder(Long reportId);

    /** 按报告 ID + 源问题 ID 查询（用于查重，避免同一问题重复纳入） */
    Optional<ReportIssueSnapshot> findByReportIdAndSourceIssueId(Long reportId, Long sourceIssueId);

    /** 统计报告下快照数量（用于计算下一 sort_order） */
    long countByReportId(Long reportId);

    /** 删除报告下指定源问题的快照（移除问题时使用） */
    long deleteByReportIdAndSourceIssueId(Long reportId, Long sourceIssueId);

    /**
     * 统计指定源问题被「已发布（PUBLISHED）」状态报告引用的快照数量（DD-9 联动）。
     * <p>注意：{@code ReportIssueSnapshot} 通过 {@code reportId}（Long 外键）关联 Report，
     * 无实体关联映射，因此使用子查询在 reports 表上过滤 status。
     *
     * @param issueId 源问题 ID（对应实体字段 sourceIssueId）
     * @return 引用计数，&gt; 0 表示被已发布报告引用
     */
    @Query("SELECT COUNT(s) FROM ReportIssueSnapshot s " +
            "WHERE s.sourceIssueId = :issueId " +
            "AND s.reportId IN (SELECT r.id FROM Report r WHERE r.status = com.fj.report.entity.ReportStatus.PUBLISHED)")
    long countByIssueIdInPublishedReport(@Param("issueId") Long issueId);
}
