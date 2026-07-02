package com.fj.inspection.repository;

import com.fj.inspection.entity.DailyReport;
import com.fj.inspection.entity.DailyReportStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 日报 Repository（支持按项目/日期/检查员/状态查询）。
 */
@Repository
public interface DailyReportRepository extends JpaRepository<DailyReport, Long> {

    /** 按项目 + 日报日期查询 */
    List<DailyReport> findByProjectIdAndReportDate(Long projectId, LocalDate reportDate);

    /** 按检查员 + 状态查询（如：查询某检查员所有草稿） */
    List<DailyReport> findByInspectorIdAndStatus(Long inspectorId, DailyReportStatus status);

    /** 按项目 + 日报日期 + 检查员精确查询（同一检查员同一天最多一份） */
    Optional<DailyReport> findByProjectIdAndReportDateAndInspectorId(Long projectId, LocalDate reportDate, Long inspectorId);

    /** 按项目查询全部日报 */
    List<DailyReport> findByProjectId(Long projectId);

    /**
     * 批量更新日报下所有问题的状态（§9.1 三层状态联动单事务保证）。
     * <p>提交/退回/作废日报时联动更新 DailyReportIssue.correction_status。
     *
     * @param dailyReportId 日报 ID
     * @param newStatus     目标整改状态
     * @return 受影响行数
     */
    @Modifying
    @Query("UPDATE DailyReportIssue i SET i.correctionStatus = :newStatus WHERE i.dailyReportId = :dailyReportId")
    int updateIssueStatusByReport(@Param("dailyReportId") Long dailyReportId,
                                  @Param("newStatus") com.fj.common.enume.CorrectionStatus newStatus);
}
