package com.fj.project.repository;

import com.fj.project.entity.InspectionTask;
import com.fj.project.entity.InspectionTaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 检查任务 Repository（支持按检查员 / 项目 / 日期 / 状态查询）。
 */
@Repository
public interface InspectionTaskRepository extends JpaRepository<InspectionTask, Long> {

    /** 任务编号唯一查询 */
    Optional<InspectionTask> findByTaskNo(String taskNo);

    /** 判断任务编号是否已存在 */
    boolean existsByTaskNo(String taskNo);

    /** 按检查员查询全部任务 */
    List<InspectionTask> findByInspectorId(Long inspectorId);

    /** 按检查员 + 计划日期查询任务（今日待办） */
    List<InspectionTask> findByInspectorIdAndTaskDate(Long inspectorId, LocalDate taskDate);

    /** 按项目查询任务 */
    List<InspectionTask> findByProjectId(Long projectId);

    /** 按项目 + 检查员查询任务 */
    List<InspectionTask> findByProjectIdAndInspectorId(Long projectId, Long inspectorId);

    /** 按项目 + 计划日期查询任务 */
    List<InspectionTask> findByProjectIdAndTaskDate(Long projectId, LocalDate taskDate);

    /** 按项目 + 检查员 + 计划日期精确查询 */
    List<InspectionTask> findByProjectIdAndInspectorIdAndTaskDate(Long projectId, Long inspectorId, LocalDate taskDate);

    /** 按状态查询任务 */
    List<InspectionTask> findByTaskStatus(InspectionTaskStatus taskStatus);
}
