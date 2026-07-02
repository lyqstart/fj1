package com.fj.report.repository;

import com.fj.report.entity.Report;
import com.fj.report.entity.ReportStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 报告 Repository。
 */
@Repository
public interface ReportRepository extends JpaRepository<Report, Long> {

    /** 按项目 + 状态查询 */
    List<Report> findByProjectIdAndStatus(Long projectId, ReportStatus status);

    /** 按项目查询 */
    List<Report> findByProjectId(Long projectId);

    /** 按版本树根 ID 查询全部版本（按版本号倒序，最新版本优先） */
    List<Report> findByRootReportIdOrderByReportVersionDesc(Long rootReportId);

    /** 查询项目下当前生效版本（同一版本树内仅一版 is_current_effective=true） */
    List<Report> findByIsCurrentEffectiveAndProjectId(Boolean isCurrentEffective, Long projectId);

    /** 统计项目下报告总数（用于生成 report_no 序号） */
    long countByProjectId(Long projectId);
}
