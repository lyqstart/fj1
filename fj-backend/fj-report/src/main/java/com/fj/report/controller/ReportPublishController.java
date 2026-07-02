package com.fj.report.controller;

import com.fj.common.response.ApiResponse;
import com.fj.report.entity.Report;
import com.fj.report.service.ReportPublishService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 报告发布 REST API（TASK-042 / BR-4 发布即固化）。
 *
 * <p>POST /api/v1/reports/{id}/publish — 发布报告（生成固化 Word + 整体锁定）。
 */
@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportPublishController {

    private final ReportPublishService reportPublishService;

    /**
     * 发布报告。
     * <p>请求体：{ "publisherId": 123 }
     * <p>BR-4：发布即固化。导出成功 → 报告 PUBLISHED + 锁定；导出失败 → 报告状态不变。
     */
    @PostMapping("/{id}/publish")
    public ApiResponse<Report> publish(@PathVariable Long id,
                                       @RequestBody Map<String, Object> body) {
        Long publisherId = extractLong(body, "publisherId");
        return ApiResponse.ok(reportPublishService.publish(id, publisherId));
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
}
