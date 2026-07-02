package com.fj.inspection.controller;

import com.fj.common.response.ApiResponse;
import com.fj.inspection.entity.DailyReport;
import com.fj.inspection.service.DailyReportConfirmService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 日报确认 / 作废 REST API（TASK-031）。
 * <p>日报确认走通用审批引擎（{@link DailyReportConfirmService#confirm}），
 * 确认即锁定（DD-8 / BR-3，同事务写 {@code confirmed_at} + {@code locked_at} 并生成问题池条目）。
 */
@RestController
@RequestMapping("/api/v1/daily-reports")
@RequiredArgsConstructor
public class DailyReportConfirmController {

    private final DailyReportConfirmService dailyReportConfirmService;

    /**
     * 发起日报确认审批流程：SUBMITTED → LOCKED（DD-8 确认即锁定）。
     * <p>请求体示例：{@code { "approverId": 123 }}
     *
     * @param id         日报 ID
     * @param request    确认请求（含确认人 ID）
     */
    @PostMapping("/{id}/confirm")
    public ApiResponse<DailyReport> confirm(@PathVariable Long id, @RequestBody ConfirmRequest request) {
        return ApiResponse.ok(dailyReportConfirmService.confirm(id, request.approverId()));
    }

    /**
     * 作废日报：任意非 VOIDED → VOIDED（终态），联动处理 ProjectIssue（DD-9）。
     * <p>请求体示例：{@code { "voiderId": 123 }}
     *
     * @param id         日报 ID
     * @param request    作废请求（含作废人 ID）
     */
    @PostMapping("/{id}/void")
    public ApiResponse<DailyReport> voidReport(@PathVariable Long id, @RequestBody VoidRequest request) {
        return ApiResponse.ok(dailyReportConfirmService.voidReport(id, request.voiderId()));
    }

    /** 日报确认请求体 */
    public record ConfirmRequest(Long approverId) {
    }

    /** 日报作废请求体 */
    public record VoidRequest(Long voiderId) {
    }
}
