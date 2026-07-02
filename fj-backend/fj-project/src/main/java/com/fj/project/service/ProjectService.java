package com.fj.project.service;

import com.fj.common.dto.PageRequest;
import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.common.response.PageResponse;
import com.fj.project.entity.Project;
import com.fj.project.entity.ProjectConfig;
import com.fj.project.entity.ProjectStatus;
import com.fj.project.repository.ProjectConfigRepository;
import com.fj.project.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 项目管理 Service（CRUD + 配置初始化 + 唯一编号生成）。
 * <p>创建项目时自动初始化默认 ProjectConfig（含 BR-1 整改期限默认值）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final ProjectConfigRepository projectConfigRepository;

    /**
     * 创建项目。若未提供 code 则自动生成唯一编号，并初始化默认配置。
     */
    @Transactional
    public Project create(Project project) {
        if (project.getStatus() == null) {
            project.setStatus(ProjectStatus.PREPARING);
        }
        if (project.getCode() == null || project.getCode().isBlank()) {
            project.setCode(generateCode());
        } else if (projectRepository.existsByCode(project.getCode())) {
            throw new BusinessException(ErrorCode.DATA_ALREADY_EXISTS, "项目编号已存在: " + project.getCode());
        }
        Project saved = projectRepository.save(project);
        initDefaultConfig(saved);
        return saved;
    }

    /**
     * 更新项目（部分字段）。
     */
    @Transactional
    public Project update(Long id, Project patch) {
        Project existing = requireProject(id);
        if (patch.getName() != null) {
            existing.setName(patch.getName());
        }
        if (patch.getDescription() != null) {
            existing.setDescription(patch.getDescription());
        }
        if (patch.getStatus() != null) {
            existing.setStatus(patch.getStatus());
        }
        if (patch.getConfigJson() != null) {
            existing.setConfigJson(patch.getConfigJson());
        }
        if (patch.getStartDate() != null) {
            existing.setStartDate(patch.getStartDate());
        }
        if (patch.getEndDate() != null) {
            existing.setEndDate(patch.getEndDate());
        }
        return projectRepository.save(existing);
    }

    /**
     * 查看项目详情。
     */
    @Transactional(readOnly = true)
    public Project detail(Long id) {
        return requireProject(id);
    }

    /**
     * 查询项目配置。
     */
    @Transactional(readOnly = true)
    public ProjectConfig getConfig(Long projectId) {
        requireProject(projectId);
        return projectConfigRepository.findByProjectId(projectId)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "项目配置不存在: " + projectId));
    }

    /**
     * 更新项目配置。
     */
    @Transactional
    public ProjectConfig updateConfig(Long projectId, ProjectConfig patch) {
        ProjectConfig existing = getConfig(projectId);
        if (patch.getEnforceRequiredItems() != null) {
            existing.setEnforceRequiredItems(patch.getEnforceRequiredItems());
        }
        if (patch.getMinDescriptionLength() != null) {
            existing.setMinDescriptionLength(patch.getMinDescriptionLength());
        }
        if (patch.getMajorIssueDeadlineHours() != null) {
            existing.setMajorIssueDeadlineHours(patch.getMajorIssueDeadlineHours());
        }
        if (patch.getRectificationDeadlineDefaultDays() != null) {
            existing.setRectificationDeadlineDefaultDays(patch.getRectificationDeadlineDefaultDays());
        }
        if (patch.getPhotoMinCount() != null) {
            existing.setPhotoMinCount(patch.getPhotoMinCount());
        }
        if (patch.getPhotoQualityLevel() != null) {
            existing.setPhotoQualityLevel(patch.getPhotoQualityLevel());
        }
        return projectConfigRepository.save(existing);
    }

    /**
     * 分页查询项目列表。
     */
    @Transactional(readOnly = true)
    public PageResponse<Project> list(PageRequest pageRequest) {
        pageRequest.normalize();
        Sort sort = Sort.by(
                "desc".equalsIgnoreCase(pageRequest.getSortOrder()) ? Sort.Direction.DESC : Sort.Direction.ASC,
                pageRequest.getSortBy() == null ? "id" : pageRequest.getSortBy());
        Page<Project> page = projectRepository.findAll(
                org.springframework.data.domain.PageRequest.of(pageRequest.getPage() - 1, pageRequest.getPageSize(), sort));
        List<Project> items = page.getContent();
        return PageResponse.of(items, page.getTotalElements(), pageRequest.getPage(), pageRequest.getPageSize());
    }

    private Project requireProject(Long id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "项目不存在: " + id));
    }

    /** 初始化默认项目配置（含 BR-1 整改期限默认值） */
    private void initDefaultConfig(Project project) {
        ProjectConfig config = new ProjectConfig();
        config.setProject(project);
        projectConfigRepository.save(config);
    }

    /** 生成唯一项目编号：P + 毫秒时间戳 + 2 位随机数 */
    private String generateCode() {
        long base = System.currentTimeMillis();
        int rand = (int) (Math.random() * 90) + 10;
        String code = "P" + base + rand;
        // 极小概率冲突时递归重试
        return projectRepository.existsByCode(code) ? generateCode() : code;
    }
}
