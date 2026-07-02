package com.fj.project.repository;

import com.fj.project.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 项目 Repository（Spring Data JPA 自动实现）。
 */
@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {

    /** 按项目编号精确查询 */
    Optional<Project> findByCode(String code);

    /** 判断项目编号是否已存在 */
    boolean existsByCode(String code);
}
