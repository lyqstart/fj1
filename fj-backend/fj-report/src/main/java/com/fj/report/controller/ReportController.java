package com.fj.report.controller;

import com.fj.common.response.ApiResponse;
import com.fj.report.entity.Report;
import com.fj.report.entity.ReportStatus;
import com.fj.report.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * 报告 REST API（/api/v1/reports）。
 * <p>支持报告草稿生成、列表查询、详情查看、基本信息更新、选择纳入问题清单。
 */
@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    /**
     * 生成报告草稿。
     * <p>示例：POST /api/v1/reports/generate?projectId=1&periodStart=...&periodEnd=...
     */
    @PostMapping("/generate")
    public ApiResponse<Report> generate(@RequestParam Long projectId,
                                        @RequestParam(required = false) OffsetDateTime periodStart,
                                        @RequestParam(required = false) OffsetDateTime periodEnd) {
        return ApiResponse.ok(reportService.generateDraft(projectId, periodStart, periodEnd));
    }

    /** 报告列表（可选状态过滤） */
    @GetMapping
    public ApiResponse<List<Report>> list(@RequestParam Long projectId,
                                          @RequestParam(required = false) ReportStatus status) {
        return ApiResponse.ok(reportService.list(projectId, status));
    }

    /** 查看报告详情 */
    @GetMapping("/{id}")
    public ApiResponse<Report> detail(@PathVariable Long id) {
        return ApiResponse.ok(reportService.detail(id));
    }

    /**
     * 更新报告基本信息（标题）。
     * <p>请求体：{ "title": "...", "description": "..." }（description 为预留参数）
     */
    @PutMapping("/{id}")
    public ApiResponse<Report> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String title = body == null ? null : (String) body.get("title");
        String description = body == null ? null : (String) body.get("description");
        return ApiResponse.ok(reportService.updateReportInfo(id, title, description));
    }

    /**
     * 选择纳入报告的问题清单。
     * <p>请求体：{ "issueIds": [1, 2, 3] }
     */
    @PostMapping("/{id}/select-issues")
    public ApiResponse<Report> selectIssues(@PathVariable Long id, @RequestBody Map<String, List<Long>> body) {
        List<Long> issueIds = body == null ? null : body.get("issueIds");
        return ApiResponse.ok(reportService.selectIssues(id, issueIds));
    }
}
