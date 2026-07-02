package com.fj.approval.controller;

import com.fj.approval.entity.ApprovalFlowConfig;
import com.fj.approval.entity.ApprovalFlowType;
import com.fj.approval.service.ApprovalFlowConfigService;
import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 审批流配置 REST API（/api/v1/approval-flow-configs）。
 */
@RestController
@RequestMapping("/api/v1/approval-flow-configs")
@RequiredArgsConstructor
public class ApprovalFlowConfigController {

    private final ApprovalFlowConfigService approvalFlowConfigService;

    /** 按项目查询配置列表 */
    @GetMapping
    public ApiResponse<List<ApprovalFlowConfig>> list(@RequestParam Long projectId) {
        return ApiResponse.ok(approvalFlowConfigService.listByProject(projectId));
    }

    /** 查看配置详情 */
    @GetMapping("/{id}")
    public ApiResponse<ApprovalFlowConfig> detail(@PathVariable Long id) {
        return ApiResponse.ok(approvalFlowConfigService.detail(id));
    }

    /** 查询项目下指定类型的生效配置 */
    @GetMapping("/active")
    public ApiResponse<ApprovalFlowConfig> findActive(@RequestParam Long projectId,
                                                      @RequestParam String flowType) {
        ApprovalFlowType type = parseFlowType(flowType);
        return ApiResponse.ok(approvalFlowConfigService.findActive(projectId, type));
    }

    /** 创建审批流配置 */
    @PostMapping
    public ApiResponse<ApprovalFlowConfig> create(@RequestBody ApprovalFlowConfig config) {
        return ApiResponse.ok(approvalFlowConfigService.create(config));
    }

    /** 更新审批流配置 */
    @PutMapping("/{id}")
    public ApiResponse<ApprovalFlowConfig> update(@PathVariable Long id,
                                                  @RequestBody ApprovalFlowConfig config) {
        return ApiResponse.ok(approvalFlowConfigService.update(id, config));
    }

    private ApprovalFlowType parseFlowType(String flowType) {
        try {
            return ApprovalFlowType.valueOf(String.valueOf(flowType).toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID, "flowType 取值非法: " + flowType);
        }
    }
}
