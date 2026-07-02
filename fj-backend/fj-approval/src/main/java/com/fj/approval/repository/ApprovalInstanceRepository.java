package com.fj.approval.repository;

import com.fj.approval.entity.ApprovalFlowType;
import com.fj.approval.entity.ApprovalInstance;
import com.fj.approval.entity.ApprovalStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 审批实例 Repository。
 */
@Repository
public interface ApprovalInstanceRepository extends JpaRepository<ApprovalInstance, Long> {

    /** 按业务实体 ID + 审批类型查询（如：查询某日报的审批实例） */
    Optional<ApprovalInstance> findByBusinessIdAndFlowType(Long businessId, ApprovalFlowType flowType);

    /** 按项目 + 实例状态查询 */
    List<ApprovalInstance> findByProjectIdAndStatus(Long projectId, ApprovalStatus status);

    /** 按业务实体 ID 查询所有审批实例（不限类型） */
    List<ApprovalInstance> findByBusinessId(Long businessId);
}
