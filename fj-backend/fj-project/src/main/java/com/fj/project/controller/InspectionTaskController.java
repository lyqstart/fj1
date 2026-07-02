package com.fj.project.controller;

import com.fj.common.response.ApiResponse;
import com.fj.project.entity.InspectionTask;
import com.fj.project.service.InspectionTaskService;
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
 * 检查任务 REST API（/api/v1/inspection-tasks）。
 * <p>支持多条件查询与 BR-7 状态流转（accept / start / submit / cancel）。
 */
@RestController
@RequestMapping("/api/v1/inspection-tasks")
@RequiredArgsConstructor
public class InspectionTaskController {

    private final InspectionTaskService inspectionTaskService;

    /**
     * 多条件查询任务。projectId / inspectorId / date 均为可选。
     * <p>示例：GET /api/v1/inspection-tasks?projectId=1&inspectorId=2&date=2026-07-01
     */
    @GetMapping
    public ApiResponse<List<InspectionTask>> list(
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long inspectorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ApiResponse.ok(inspectionTaskService.list(projectId, inspectorId, date));
    }

    /** 查看任务详情 */
    @GetMapping("/{id}")
    public ApiResponse<InspectionTask> detail(@PathVariable Long id) {
        return ApiResponse.ok(inspectionTaskService.detail(id));
    }

    /** 创建检查任务（未提供 task_no 时自动生成） */
    @PostMapping
    public ApiResponse<InspectionTask> create(@RequestBody InspectionTask task) {
        return ApiResponse.ok(inspectionTaskService.create(task));
    }

    /** 更新任务业务字段 */
    @PutMapping("/{id}")
    public ApiResponse<InspectionTask> update(@PathVariable Long id, @RequestBody InspectionTask task) {
        return ApiResponse.ok(inspectionTaskService.update(id, task));
    }

    /** 接收任务：ASSIGNED → ACCEPTED */
    @PutMapping("/{id}/accept")
    public ApiResponse<InspectionTask> accept(@PathVariable Long id) {
        return ApiResponse.ok(inspectionTaskService.accept(id));
    }

    /** 开始检查：ACCEPTED → IN_PROGRESS */
    @PutMapping("/{id}/start")
    public ApiResponse<InspectionTask> start(@PathVariable Long id) {
        return ApiResponse.ok(inspectionTaskService.start(id));
    }

    /** 提交任务：IN_PROGRESS → SUBMITTED */
    @PutMapping("/{id}/submit")
    public ApiResponse<InspectionTask> submit(@PathVariable Long id) {
        return ApiResponse.ok(inspectionTaskService.submit(id));
    }

    /** 取消任务：非终态 → CANCELLED */
    @PutMapping("/{id}/cancel")
    public ApiResponse<InspectionTask> cancel(@PathVariable Long id) {
        return ApiResponse.ok(inspectionTaskService.cancel(id));
    }
}
