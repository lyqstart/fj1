package com.fj.export.controller;

import com.fj.common.response.ApiResponse;
import com.fj.export.entity.ExportFile;
import com.fj.export.repository.ExportFileRepository;
import com.fj.export.service.ExportService;
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
 * 报告导出 REST API（/api/v1/reports/{id}/export/... + /api/v1/reports/{id}/export-files）。
 * <p>支持草稿预览导出、发布固化导出、查询报告导出文件记录。
 * <p>路径设计（TASK-041）：
 * <ul>
 *   <li>POST /api/v1/reports/{id}/export/draft-preview — 草稿预览导出（NFR-5 ≤60s）</li>
 *   <li>POST /api/v1/reports/{id}/export/official-publish — 发布固化导出（NFR-5 ≤120s）</li>
 *   <li>GET /api/v1/reports/{id}/export-files — 查询导出文件记录</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ExportController {

    private final ExportService exportService;
    private final ExportFileRepository exportFileRepository;

    /**
     * 草稿预览导出（不改变报告状态，NFR-5 ≤60s）。
     * <p>请求体：{ "userId": 123 }
     */
    @PostMapping("/{id}/export/draft-preview")
    public ApiResponse<ExportFile> exportDraftPreview(@PathVariable Long id,
                                                      @RequestBody Map<String, Object> body) {
        Long userId = extractLong(body, "userId");
        return ApiResponse.ok(exportService.exportDraftPreview(id, userId));
    }

    /**
     * 发布固化导出（BR-4 发布即固化，NFR-5 ≤120s）。
     * <p>请求体：{ "publisherId": 123 }
     */
    @PostMapping("/{id}/export/official-publish")
    public ApiResponse<ExportFile> exportOfficialPublish(@PathVariable Long id,
                                                          @RequestBody Map<String, Object> body) {
        Long publisherId = extractLong(body, "publisherId");
        return ApiResponse.ok(exportService.exportOfficialPublish(id, publisherId));
    }

    /**
     * 查询报告导出文件记录列表（按生成时刻倒序）。
     */
    @GetMapping("/{id}/export-files")
    public ApiResponse<List<ExportFile>> listExportFiles(@PathVariable Long id) {
        return ApiResponse.ok(exportFileRepository.findByReportIdOrderByGeneratedAtDesc(id));
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
