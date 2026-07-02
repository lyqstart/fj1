package com.fj.project.service;

import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.project.entity.InspectionTask;
import com.fj.project.entity.InspectionTaskStatus;
import com.fj.project.repository.InspectionTaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 检查任务 Service（CRUD + BR-7 状态流转 + 按检查员/日期查询）。
 * <p>状态机：ASSIGNED → ACCEPTED → IN_PROGRESS → SUBMITTED；任意非终态可 CANCELLED。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InspectionTaskService {

    private final InspectionTaskRepository inspectionTaskRepository;

    // ==================== CRUD ====================

    /**
     * 创建检查任务。未提供 task_no 时自动生成唯一编号，状态默认 ASSIGNED。
     */
    @Transactional
    public InspectionTask create(InspectionTask task) {
        if (task.getTaskStatus() == null) {
            task.setTaskStatus(InspectionTaskStatus.ASSIGNED);
        }
        if (task.getTaskNo() == null || task.getTaskNo().isBlank()) {
            task.setTaskNo(generateTaskNo());
        } else if (inspectionTaskRepository.existsByTaskNo(task.getTaskNo())) {
            throw new BusinessException(ErrorCode.DATA_ALREADY_EXISTS, "任务编号已存在: " + task.getTaskNo());
        }
        return inspectionTaskRepository.save(task);
    }

    /**
     * 更新任务（仅允许在 ASSIGNED / ACCEPTED 阶段修改业务字段）。
     */
    @Transactional
    public InspectionTask update(Long id, InspectionTask patch) {
        InspectionTask existing = requireTask(id);
        if (existing.getTaskStatus() == InspectionTaskStatus.SUBMITTED
                || existing.getTaskStatus() == InspectionTaskStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.BIZ_OPERATION_NOT_ALLOWED,
                    "任务已" + existing.getTaskStatus() + "，不可修改");
        }
        if (patch.getTaskName() != null) {
            existing.setTaskName(patch.getTaskName());
        }
        if (patch.getTaskDate() != null) {
            existing.setTaskDate(patch.getTaskDate());
        }
        if (patch.getFormId() != null) {
            existing.setFormId(patch.getFormId());
        }
        if (patch.getInspectorId() != null) {
            existing.setInspectorId(patch.getInspectorId());
        }
        if (patch.getAssignedOrgId() != null) {
            existing.setAssignedOrgId(patch.getAssignedOrgId());
        }
        if (patch.getDescription() != null) {
            existing.setDescription(patch.getDescription());
        }
        if (patch.getPlannedDate() != null) {
            existing.setPlannedDate(patch.getPlannedDate());
        }
        if (patch.getLocationId() != null) {
            existing.setLocationId(patch.getLocationId());
        }
        if (patch.getLocationNameSnapshot() != null) {
            existing.setLocationNameSnapshot(patch.getLocationNameSnapshot());
        }
        return inspectionTaskRepository.save(existing);
    }

    /**
     * 查看任务详情。
     */
    @Transactional(readOnly = true)
    public InspectionTask detail(Long id) {
        return requireTask(id);
    }

    /**
     * 多条件查询任务（projectId / inspectorId / date 任一可选组合）。
     */
    @Transactional(readOnly = true)
    public List<InspectionTask> list(Long projectId, Long inspectorId, LocalDate date) {
        if (projectId != null && inspectorId != null && date != null) {
            return inspectionTaskRepository.findByProjectIdAndInspectorIdAndTaskDate(projectId, inspectorId, date);
        }
        if (projectId != null && inspectorId != null) {
            return inspectionTaskRepository.findByProjectIdAndInspectorId(projectId, inspectorId);
        }
        if (projectId != null && date != null) {
            return inspectionTaskRepository.findByProjectIdAndTaskDate(projectId, date);
        }
        if (inspectorId != null && date != null) {
            return inspectionTaskRepository.findByInspectorIdAndTaskDate(inspectorId, date);
        }
        if (projectId != null) {
            return inspectionTaskRepository.findByProjectId(projectId);
        }
        if (inspectorId != null) {
            return inspectionTaskRepository.findByInspectorId(inspectorId);
        }
        return inspectionTaskRepository.findAll();
    }

    // ==================== 状态流转（BR-7） ====================

    /**
     * 接收任务：ASSIGNED → ACCEPTED。
     */
    @Transactional
    public InspectionTask accept(Long id) {
        InspectionTask task = requireTask(id);
        guardTransition(task, InspectionTaskStatus.ASSIGNED, InspectionTaskStatus.ACCEPTED);
        task.setTaskStatus(InspectionTaskStatus.ACCEPTED);
        return inspectionTaskRepository.save(task);
    }

    /**
     * 开始检查：ACCEPTED → IN_PROGRESS。
     */
    @Transactional
    public InspectionTask start(Long id) {
        InspectionTask task = requireTask(id);
        guardTransition(task, InspectionTaskStatus.ACCEPTED, InspectionTaskStatus.IN_PROGRESS);
        task.setTaskStatus(InspectionTaskStatus.IN_PROGRESS);
        return inspectionTaskRepository.save(task);
    }

    /**
     * 提交任务：IN_PROGRESS → SUBMITTED，并写入 completed_at。
     */
    @Transactional
    public InspectionTask submit(Long id) {
        InspectionTask task = requireTask(id);
        guardTransition(task, InspectionTaskStatus.IN_PROGRESS, InspectionTaskStatus.SUBMITTED);
        task.setTaskStatus(InspectionTaskStatus.SUBMITTED);
        task.setCompletedAt(OffsetDateTime.now());
        return inspectionTaskRepository.save(task);
    }

    /**
     * 取消任务：ASSIGNED / ACCEPTED / IN_PROGRESS → CANCELLED。
     */
    @Transactional
    public InspectionTask cancel(Long id) {
        InspectionTask task = requireTask(id);
        InspectionTaskStatus current = task.getTaskStatus();
        if (current == InspectionTaskStatus.SUBMITTED) {
            throw new BusinessException(ErrorCode.BIZ_OPERATION_NOT_ALLOWED, "已提交的任务不可取消");
        }
        if (current == InspectionTaskStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.BIZ_OPERATION_NOT_ALLOWED, "任务已取消");
        }
        task.setTaskStatus(InspectionTaskStatus.CANCELLED);
        task.setCancelledAt(OffsetDateTime.now());
        return inspectionTaskRepository.save(task);
    }

    // ==================== 内部工具 ====================

    private InspectionTask requireTask(Long id) {
        return inspectionTaskRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "检查任务不存在: " + id));
    }

    /**
     * 状态流转守卫：仅允许从期望的当前状态迁移到目标状态，否则抛 BIZ_STATE_INVALID_TRANSITION。
     */
    private void guardTransition(InspectionTask task, InspectionTaskStatus expectedFrom, InspectionTaskStatus target) {
        if (task.getTaskStatus() != expectedFrom) {
            throw new BusinessException(ErrorCode.BIZ_STATE_INVALID_TRANSITION,
                    "任务状态流转不合法：" + task.getTaskStatus() + " → " + target
                            + "（需从 " + expectedFrom + " 迁移）");
        }
    }

    /** 生成唯一任务编号：IT + yyyy + 6 位时间毫秒低位 + 2 位随机 */
    private String generateTaskNo() {
        long base = System.currentTimeMillis() % 1000000;
        int rand = (int) (Math.random() * 90) + 10;
        String no = "IT-" + LocalDate.now().getYear() + "-" + String.format("%06d", base) + rand;
        return inspectionTaskRepository.existsByTaskNo(no) ? generateTaskNo() : no;
    }
}
