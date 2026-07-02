package com.fj.project.repository;

import com.fj.project.entity.Equipment;
import com.fj.project.entity.EquipmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 设备 Repository。
 */
@Repository
public interface EquipmentRepository extends JpaRepository<Equipment, Long> {

    /** 按任务查询设备列表 */
    List<Equipment> findByTaskId(Long taskId);

    /** 按任务 + 状态查询设备 */
    List<Equipment> findByTaskIdAndStatus(Long taskId, EquipmentStatus status);

    /** 按项目查询设备列表 */
    List<Equipment> findByProjectId(Long projectId);
}
