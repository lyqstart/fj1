package com.fj.report.controller;

import com.fj.common.response.ApiResponse;
import com.fj.report.entity.ReportIssueSnapshot;
import com.fj.report.service.ReportSnapshotService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 问题快照 REST API（/api/v1/reports/{id}/snapshots）。
 * <p>支持报告下问题快照的查询、编辑（§103 左右对照）、增删。
 */
@RestController
@RequestMapping("/api/v1/reports/{id}/snapshots")
@RequiredArgsConstructor
public class ReportSnapshotController {

    private final ReportSnapshotService snapshotService;

    /** 查询报告下全部问题快照（按 sort_order 升序） */
    @GetMapping
    public ApiResponse<List<ReportIssueSnapshot>> list(@PathVariable Long id) {
        return ApiResponse.ok(snapshotService.listByReport(id));
    }

    /**
     * 编辑快照（§103 左右对照，不覆盖原文 source_issue）。
     * <p>请求体可包含任意 *_snapshot 字段子集，未提供的字段保持不变：
     * <pre>{ "description": "...", "severity": "MAJOR", "category": "...",
     *        "responsibleParty": "...", "photoReference": "{...}", "sortOrder": 2 }</pre>
     */
    @PutMapping("/{snapshotId}")
    public ApiResponse<ReportIssueSnapshot> edit(@PathVariable Long id,
                                                  @PathVariable Long snapshotId,
                                                  @RequestBody Map<String, Object> editFields) {
        return ApiResponse.ok(snapshotService.editSnapshot(snapshotId, editFields));
    }

    /**
     * 手动增加问题到报告。
     * <p>请求体：{ "issueId": 123 }
     */
    @PostMapping
    public ApiResponse<ReportIssueSnapshot> add(@PathVariable Long id,
                                                @RequestBody Map<String, Object> body) {
        Long issueId = body == null ? null : ((Number) body.get("issueId")).longValue();
        return ApiResponse.ok(snapshotService.addSnapshot(id, issueId));
    }

    /** 从报告中移除问题（只删快照，不影响 ProjectIssue 原文） */
    @DeleteMapping("/{snapshotId}")
    public ApiResponse<Void> remove(@PathVariable Long id, @PathVariable Long snapshotId) {
        snapshotService.removeSnapshot(snapshotId);
        return ApiResponse.ok();
    }
}
