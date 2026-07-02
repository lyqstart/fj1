package com.fj.approval.service;

import com.fj.approval.entity.ApprovalFlowConfig;
import com.fj.approval.entity.ApprovalFlowType;
import com.fj.approval.repository.ApprovalFlowConfigRepository;
import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 审批流配置 Service（CRUD + 按项目+类型查询生效配置）。
 * <p>同一项目同一类型同时只能有一条 ACTIVE 配置；新建生效配置时自动停用旧配置。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApprovalFlowConfigService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_INACTIVE = "INACTIVE";

    private final ApprovalFlowConfigRepository repository;

    /**
     * 创建审批流配置。若设为生效，则停用同项目同类型的旧生效配置。
     */
    @Transactional
    public ApprovalFlowConfig create(ApprovalFlowConfig config) {
        if (config.getStatus() == null) {
            config.setStatus(STATUS_ACTIVE);
        }
        if (config.getVersion() == null) {
            config.setVersion(1);
        }
        if (STATUS_ACTIVE.equals(config.getStatus())) {
            deactivateExisting(config.getProjectId(), config.getFlowType());
        }
        return repository.save(config);
    }

    /**
     * 查看配置详情。
     */
    @Transactional(readOnly = true)
    public ApprovalFlowConfig detail(Long id) {
        return requireConfig(id);
    }

    /**
     * 按项目查询配置列表。
     */
    @Transactional(readOnly = true)
    public List<ApprovalFlowConfig> listByProject(Long projectId) {
        return repository.findByProjectId(projectId);
    }

    /**
     * 更新配置。
     */
    @Transactional
    public ApprovalFlowConfig update(Long id, ApprovalFlowConfig patch) {
        ApprovalFlowConfig existing = requireConfig(id);
        if (patch.getConfigJson() != null) {
            existing.setConfigJson(patch.getConfigJson());
        }
        if (patch.getStatus() != null) {
            if (STATUS_ACTIVE.equals(patch.getStatus())
                    && !STATUS_ACTIVE.equals(existing.getStatus())) {
                deactivateExisting(existing.getProjectId(), existing.getFlowType());
            }
            existing.setStatus(patch.getStatus());
        }
        if (patch.getVersion() != null) {
            existing.setVersion(patch.getVersion());
        }
        return repository.save(existing);
    }

    /**
     * 查询项目下指定类型的生效配置。
     */
    @Transactional(readOnly = true)
    public ApprovalFlowConfig findActive(Long projectId, ApprovalFlowType flowType) {
        return repository.findByProjectIdAndFlowTypeAndStatus(projectId, flowType, STATUS_ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND,
                        "未找到生效的审批流配置: project=" + projectId + ", type=" + flowType));
    }

    private ApprovalFlowConfig requireConfig(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "审批流配置不存在: " + id));
    }

    /** 停用同项目同类型的旧生效配置（保证唯一生效） */
    private void deactivateExisting(Long projectId, ApprovalFlowType flowType) {
        repository.findByProjectIdAndFlowTypeAndStatus(projectId, flowType, STATUS_ACTIVE)
                .ifPresent(old -> {
                    old.setStatus(STATUS_INACTIVE);
                    repository.save(old);
                });
    }
}
