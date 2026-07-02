package com.fj.approval.repository;

import com.fj.approval.entity.ApprovalFlowConfig;
import com.fj.approval.entity.ApprovalFlowType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 审批流配置 Repository。
 */
@Repository
public interface ApprovalFlowConfigRepository extends JpaRepository<ApprovalFlowConfig, Long> {

    /** 按项目 ID 查询配置列表 */
    List<ApprovalFlowConfig> findByProjectId(Long projectId);

    /** 查询项目下指定类型的生效配置（status=ACTIVE） */
    Optional<ApprovalFlowConfig> findByProjectIdAndFlowTypeAndStatus(
            Long projectId, ApprovalFlowType flowType, String status);
}
