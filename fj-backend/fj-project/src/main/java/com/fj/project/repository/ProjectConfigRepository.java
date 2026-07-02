package com.fj.project.repository;

import com.fj.project.entity.ProjectConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 项目配置 Repository。
 */
@Repository
public interface ProjectConfigRepository extends JpaRepository<ProjectConfig, Long> {

    /** 按项目 ID 查询配置（一对一） */
    Optional<ProjectConfig> findByProjectId(Long projectId);
}
