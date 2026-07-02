package com.fj.inspection.repository;

import com.fj.common.enume.IssueSeverity;
import com.fj.inspection.entity.DailyReportIssue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 日报问题 Repository。
 */
@Repository
public interface DailyReportIssueRepository extends JpaRepository<DailyReportIssue, Long> {

    /** 按日报 ID 查询全部问题 */
    List<DailyReportIssue> findByDailyReportId(Long dailyReportId);

    /** 按日报 ID 查询并按序号排序 */
    List<DailyReportIssue> findByDailyReportIdOrderBySeqNoAsc(Long dailyReportId);

    /** 按日报 ID + 严重程度查询（如：查询某日报的所有重大问题） */
    List<DailyReportIssue> findByDailyReportIdAndSeverity(Long dailyReportId, IssueSeverity severity);

    /** 统计日报下问题总数（硬阻断校验：至少一条问题） */
    long countByDailyReportId(Long dailyReportId);
}
