package com.fj.approval.repository;

import com.fj.approval.entity.ApprovalTask;
import com.fj.approval.entity.ApprovalTaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 审批任务 Repository。
 */
@Repository
public interface ApprovalTaskRepository extends JpaRepository<ApprovalTask, Long> {

    /** 按审批实例 ID 查询所有任务 */
    List<ApprovalTask> findByInstanceId(Long instanceId);

    /** 按审批人 + 任务状态查询（如：查询某审批人所有待办任务） */
    List<ApprovalTask> findByAssigneeIdAndStatus(Long assigneeId, ApprovalTaskStatus status);

    /** 按审批实例 ID 查询所有待处理任务 */
    List<ApprovalTask> findByInstanceIdAndStatus(Long instanceId, ApprovalTaskStatus status);
}
