package com.fj.issue.controller;

import com.fj.common.enume.IssueSeverity;
import com.fj.common.response.ApiResponse;
import com.fj.common.response.PageResponse;
import com.fj.issue.entity.IssueStatus;
import com.fj.issue.entity.ProjectIssue;
import com.fj.issue.service.IssuePoolService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 问题池 REST API（/api/v1/issues）。
 * <p>支持多条件分页查询、详情查看、编辑问题描述/等级。
 */
@RestController
@RequestMapping("/api/v1/issues")
@RequiredArgsConstructor
public class IssueController {

    private final IssuePoolService issuePoolService;

    /**
     * 多条件分页查询问题。
     * <p>示例：GET /api/v1/issues?projectId=1&status=VALID&severity=MAJOR&page=1&pageSize=20
     */
    @GetMapping
    public ApiResponse<PageResponse<ProjectIssue>> list(
            @RequestParam Long projectId,
            @RequestParam(required = false) IssueStatus status,
            @RequestParam(required = false) IssueSeverity severity,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt");
        PageRequest pageable = PageRequest.of(Math.max(page - 1, 0), Math.max(pageSize, 1), sort);

        Page<ProjectIssue> result;
        if (status != null && severity != null) {
            result = issuePoolService.findByProjectIdAndStatusAndSeverity(projectId, status, severity, pageable);
        } else if (status != null) {
            result = issuePoolService.findByProjectIdAndStatus(projectId, status, pageable);
        } else {
            result = issuePoolService.findByProjectId(projectId, pageable);
        }

        List<ProjectIssue> items = result.getContent();
        return ApiResponse.ok(PageResponse.of(items, result.getTotalElements(), page, pageSize));
    }

    /** 查看问题详情 */
    @GetMapping("/{id}")
    public ApiResponse<ProjectIssue> detail(@PathVariable Long id) {
        return ApiResponse.ok(issuePoolService.detail(id));
    }

    /**
     * 编辑问题描述 / 等级 / 分类。
     * <p>仅更新非空字段（部分更新语义）。
     */
    @PutMapping("/{id}")
    public ApiResponse<ProjectIssue> update(@PathVariable Long id, @RequestBody ProjectIssue patch) {
        return ApiResponse.ok(issuePoolService.edit(id, patch));
    }
}
