package com.fj.approval.controller;

import com.fj.approval.entity.ApprovalFlowType;
import com.fj.approval.entity.ApprovalInstance;
import com.fj.approval.entity.ApprovalRecord;
import com.fj.approval.entity.ApprovalTask;
import com.fj.approval.entity.ApprovalTaskStatus;
import com.fj.approval.service.ApprovalEngineService;
import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 审批引擎 REST API（/api/v1/approvals）。
 * <p>提供审批实例创建、任务查询、通过/退回、记录查询（链式留痕）。
 */
@RestController
@RequestMapping("/api/v1/approvals")
@RequiredArgsConstructor
public class ApprovalController {

    private final ApprovalEngineService approvalEngineService;

    /**
     * 创建审批实例。
     * <p>body 示例：{"projectId":1,"flowType":"DAILY_REPORT","businessId":10,"initiatorId":5}
     */
    @PostMapping("/instances")
    public ApiResponse<ApprovalInstance> createInstance(@RequestBody Map<String, Object> body) {
        Long projectId = asLong(body.get("projectId"));
        ApprovalFlowType flowType = parseFlowType(body.get("flowType"));
        Long businessId = asLong(body.get("businessId"));
        Long initiatorId = asLong(body.get("initiatorId"));
        return ApiResponse.ok(approvalEngineService.createInstance(projectId, flowType, businessId, initiatorId));
    }

    /** 查看审批实例详情 */
    @GetMapping("/instances/{id}")
    public ApiResponse<ApprovalInstance> detailInstance(@PathVariable Long id) {
        return ApiResponse.ok(approvalEngineService.detailInstance(id));
    }

    /**
     * 查询审批人任务列表（按状态筛选）。
     * <p>GET /api/v1/approvals/tasks?assigneeId=5&status=PENDING
     */
    @GetMapping("/tasks")
    public ApiResponse<List<ApprovalTask>> listTasks(
            @RequestParam(required = false) Long assigneeId,
            @RequestParam(required = false) ApprovalTaskStatus status) {
        return ApiResponse.ok(approvalEngineService.listTasks(assigneeId, status));
    }

    /**
     * 通过审批任务。
     * <p>body 示例：{"approverId":5,"comment":"同意"}
     */
    @PostMapping("/tasks/{id}/approve")
    public ApiResponse<ApprovalTask> approve(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long approverId = asLong(body.get("approverId"));
        String comment = body.get("comment") == null ? null : String.valueOf(body.get("comment"));
        return ApiResponse.ok(approvalEngineService.approve(id, approverId, comment));
    }

    /**
     * 退回审批任务。
     * <p>body 示例：{"approverId":5,"comment":"问题描述不足，请补充"}
     */
    @PostMapping("/tasks/{id}/reject")
    public ApiResponse<ApprovalTask> reject(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long approverId = asLong(body.get("approverId"));
        String comment = body.get("comment") == null ? null : String.valueOf(body.get("comment"));
        return ApiResponse.ok(approvalEngineService.reject(id, approverId, comment));
    }

    /** 查询审批实例的链式记录（按写入顺序，§7.4 留痕） */
    @GetMapping("/instances/{id}/records")
    public ApiResponse<List<ApprovalRecord>> listRecords(@PathVariable Long id) {
        return ApiResponse.ok(approvalEngineService.listRecords(id));
    }

    // ==================== 内部工具 ====================

    private static Long asLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number n) {
            return n.longValue();
        }
        return Long.valueOf(String.valueOf(value));
    }

    private static ApprovalFlowType parseFlowType(Object value) {
        if (value == null) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID, "flowType 不能为空");
        }
        try {
            return ApprovalFlowType.valueOf(String.valueOf(value).toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID, "flowType 取值非法: " + value);
        }
    }
}
