package com.fj.report.controller;

import com.fj.approval.entity.ApprovalInstance;
import com.fj.approval.entity.ApprovalRecord;
import com.fj.common.response.ApiResponse;
import com.fj.report.entity.Report;
import com.fj.report.service.ReportApprovalService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 报告审批 REST API（/api/v1/reports/{id}/...）。
 * <p>支持报告提交审批、审批通过、审批退回、审批记录查询。
 * <p>审批通过 / 退回的底层任务处理委托给通用审批引擎（{@link com.fj.approval.service.ApprovalEngineService}）。
 */
@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportApprovalController {

    private final ReportApprovalService reportApprovalService;

    /**
     * 提交报告审批。
     * <p>POST /api/v1/reports/{id}/submit-approval
     * <p>请求体：{ "submitterId": 123 }
     */
    @PostMapping("/{id}/submit-approval")
    public ApiResponse<ApprovalInstance> submitApproval(@PathVariable Long id,
                                                         @RequestBody Map<String, Object> body) {
        Long submitterId = extractLong(body, "submitterId");
        return ApiResponse.ok(reportApprovalService.submitForApproval(id, submitterId));
    }

    /**
     * 审批通过当前报告的当前审批任务。
     * <p>POST /api/v1/reports/{id}/approve
     * <p>请求体：{ "approverId": 123, "comment": "同意" }
     * <p>注：内部最终调用 ApprovalEngineService.approve，与 ApprovalController 共用同一引擎。
     */
    @PostMapping("/{id}/approve")
    public ApiResponse<Report> approve(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long approverId = extractLong(body, "approverId");
        String comment = extractString(body, "comment");
        return ApiResponse.ok(reportApprovalService.approve(id, approverId, comment));
    }

    /**
     * 审批退回当前报告。
     * <p>POST /api/v1/reports/{id}/reject
     * <p>请求体：{ "approverId": 123, "comment": "请补充照片证据" }
     */
    @PostMapping("/{id}/reject")
    public ApiResponse<Report> reject(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long approverId = extractLong(body, "approverId");
        String comment = extractString(body, "comment");
        return ApiResponse.ok(reportApprovalService.reject(id, approverId, comment));
    }

    /** 查询报告关联的审批实例 */
    @GetMapping("/{id}/approval-instance")
    public ApiResponse<ApprovalInstance> getApprovalInstance(@PathVariable Long id) {
        return ApiResponse.ok(reportApprovalService.getApprovalInstance(id));
    }

    /** 查询报告审批记录链（按写入顺序） */
    @GetMapping("/{id}/approval-records")
    public ApiResponse<List<ApprovalRecord>> listApprovalRecords(@PathVariable Long id) {
        return ApiResponse.ok(reportApprovalService.listApprovalRecords(id));
    }

    // ==================== 内部工具 ====================

    private Long extractLong(Map<String, Object> body, String key) {
        if (body == null || body.get(key) == null) {
            throw new IllegalArgumentException("缺少必填参数: " + key);
        }
        Object v = body.get(key);
        if (v instanceof Number n) {
            return n.longValue();
        }
        return Long.parseLong(String.valueOf(v));
    }

    private String extractString(Map<String, Object> body, String key) {
        if (body == null) {
            return null;
        }
        Object v = body.get(key);
        return v == null ? null : String.valueOf(v);
    }
}
