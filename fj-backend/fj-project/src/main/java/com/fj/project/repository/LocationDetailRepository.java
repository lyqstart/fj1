package com.fj.project.repository;

import com.fj.project.entity.LocationDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 位置明细 Repository。
 */
@Repository
public interface LocationDetailRepository extends JpaRepository<LocationDetail, Long> {

    /** 按任务查询位置列表（按排序号升序） */
    List<LocationDetail> findByTaskIdOrderBySortOrderAsc(Long taskId);

    /** 按项目查询位置列表 */
    List<LocationDetail> findByProjectId(Long projectId);
}
