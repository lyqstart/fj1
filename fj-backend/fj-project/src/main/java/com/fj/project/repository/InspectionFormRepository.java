package com.fj.project.repository;

import com.fj.project.entity.ProjectInspectionForm;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 项目检查表 Repository。
 */
@Repository
public interface InspectionFormRepository extends JpaRepository<ProjectInspectionForm, Long> {

    /** 按项目 ID 查询检查表列表 */
    List<ProjectInspectionForm> findByProjectId(Long projectId);
}
