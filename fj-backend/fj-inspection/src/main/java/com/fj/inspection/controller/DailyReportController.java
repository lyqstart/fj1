package com.fj.inspection.controller;

import com.fj.common.response.ApiResponse;
import com.fj.inspection.entity.DailyReport;
import com.fj.inspection.entity.DailyReportStatus;
import com.fj.inspection.service.DailyReportSubmitService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * 日报 REST API（/api/v1/daily-reports）。
 * <p>支持多条件查询、草稿管理、提交（§9.1 三层校验 + 状态联动）。
 */
@RestController
@RequestMapping("/api/v1/daily-reports")
@RequiredArgsConstructor
public class DailyReportController {

    private final DailyReportSubmitService dailyReportSubmitService;

    /**
     * 多条件查询日报。projectId / date / inspectorId / status 均为可选。
     * <p>示例：GET /api/v1/daily-reports?projectId=1&date=2026-07-01
     */
    @GetMapping
    public ApiResponse<List<DailyReport>> list(
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) Long inspectorId,
            @RequestParam(required = false) DailyReportStatus status) {
        return ApiResponse.ok(dailyReportSubmitService.list(projectId, date, inspectorId, status));
    }

    /** 查看日报详情 */
    @GetMapping("/{id}")
    public ApiResponse<DailyReport> detail(@PathVariable Long id) {
        return ApiResponse.ok(dailyReportSubmitService.detail(id));
    }

    /** 创建日报草稿 */
    @PostMapping
    public ApiResponse<DailyReport> create(@RequestBody DailyReport report) {
        return ApiResponse.ok(dailyReportSubmitService.createDraft(report));
    }

    /** 编辑日报草稿（仅 DRAFT / RETURNED 状态可编辑） */
    @PutMapping("/{id}")
    public ApiResponse<DailyReport> update(@PathVariable Long id, @RequestBody DailyReport report) {
        return ApiResponse.ok(dailyReportSubmitService.editDraft(id, report));
    }

    /**
     * 提交日报：DRAFT/RETURNED → SUBMITTED（§9.1 三层校验 + 状态联动单事务）。
     */
    @PostMapping("/{id}/submit")
    public ApiResponse<DailyReport> submit(@PathVariable Long id) {
        return ApiResponse.ok(dailyReportSubmitService.submit(id));
    }
}
