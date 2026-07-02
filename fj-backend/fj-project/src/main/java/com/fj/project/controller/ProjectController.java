package com.fj.project.controller;

import com.fj.common.dto.PageRequest;
import com.fj.common.response.ApiResponse;
import com.fj.common.response.PageResponse;
import com.fj.project.entity.Project;
import com.fj.project.entity.ProjectConfig;
import com.fj.project.service.ProjectService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 项目管理 REST API（GET / POST / PUT /api/v1/projects）。
 */
@RestController
@RequestMapping("/api/v1/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    /** 分页查询项目列表 */
    @GetMapping
    public ApiResponse<PageResponse<Project>> list(@Valid PageRequest pageRequest) {
        return ApiResponse.ok(projectService.list(pageRequest));
    }

    /** 查看项目详情 */
    @GetMapping("/{id}")
    public ApiResponse<Project> detail(@PathVariable Long id) {
        return ApiResponse.ok(projectService.detail(id));
    }

    /** 创建项目（自动生成唯一编号并初始化默认配置） */
    @PostMapping
    public ApiResponse<Project> create(@Valid @RequestBody Project project) {
        return ApiResponse.ok(projectService.create(project));
    }

    /** 更新项目基本信息 */
    @PutMapping("/{id}")
    public ApiResponse<Project> update(@PathVariable Long id, @RequestBody Project project) {
        return ApiResponse.ok(projectService.update(id, project));
    }

    /** 查看项目配置 */
    @GetMapping("/{id}/config")
    public ApiResponse<ProjectConfig> getConfig(@PathVariable Long id) {
        return ApiResponse.ok(projectService.getConfig(id));
    }

    /** 更新项目配置 */
    @PutMapping("/{id}/config")
    public ApiResponse<ProjectConfig> updateConfig(@PathVariable Long id, @RequestBody ProjectConfig config) {
        return ApiResponse.ok(projectService.updateConfig(id, config));
    }
}
