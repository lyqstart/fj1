package com.fj.approval.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fj.approval.dto.ApprovalNodeConfig;
import com.fj.approval.entity.ApprovalAction;
import com.fj.approval.entity.ApprovalFlowConfig;
import com.fj.approval.entity.ApprovalFlowType;
import com.fj.approval.entity.ApprovalInstance;
import com.fj.approval.entity.ApprovalRecord;
import com.fj.approval.entity.ApprovalStatus;
import com.fj.approval.entity.ApprovalTask;
import com.fj.approval.entity.ApprovalTaskStatus;
import com.fj.approval.repository.ApprovalInstanceRepository;
import com.fj.approval.repository.ApprovalRecordRepository;
import com.fj.approval.repository.ApprovalTaskRepository;
import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * 通用审批引擎 Service（TASK-030）。
 * <p>核心职责：创建审批实例 + 按流程配置流转节点 + 通过/退回 + 审批记录链式留痕（§7.4）。
 * <p>通用引擎，日报确认（TASK-031）和报告审批复用本 Service。
 * <ul>
 *   <li>{@link #createInstance}：根据 {@link ApprovalFlowConfig} 创建实例 + 首节点任务</li>
 *   <li>{@link #approve}：通过当前任务 → 推进下一节点 → 末节点则标记实例 APPROVED</li>
 *   <li>{@link #reject}：退回 → 标记实例 REJECTED</li>
 *   <li>每次操作写入 {@link ApprovalRecord}（链式哈希 record_hash = SHA-256(prev_hash + content)）</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApprovalEngineService {

    private final ApprovalFlowConfigService flowConfigService;
    private final ApprovalInstanceRepository instanceRepository;
    private final ApprovalTaskRepository taskRepository;
    private final ApprovalRecordRepository recordRepository;
    private final ObjectMapper objectMapper;

    // ==================== 创建审批实例 ====================

    /**
     * 创建审批实例 + 首节点任务。
     *
     * @param projectId   项目 ID
     * @param flowType    审批类型（DAILY_REPORT / REPORT）
     * @param businessId  关联业务实体 ID（日报 id 或报告 id）
     * @param initiatorId 发起人 ID
     * @return 已创建的审批实例（状态 PENDING）
     */
    @Transactional
    public ApprovalInstance createInstance(Long projectId, ApprovalFlowType flowType,
                                           Long businessId, Long initiatorId) {
        // 1. 查找项目下指定类型的生效配置
        ApprovalFlowConfig config = flowConfigService.findActive(projectId, flowType);
        List<ApprovalNodeConfig> nodes = parseNodes(config.getConfigJson());
        if (nodes.isEmpty()) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID,
                    "审批流配置节点为空: configId=" + config.getId());
        }

        // 2. 创建审批实例（状态 PENDING，当前节点为首节点名称）
        ApprovalInstance instance = new ApprovalInstance();
        instance.setProjectId(projectId);
        instance.setFlowType(flowType);
        instance.setBusinessId(businessId);
        instance.setStatus(ApprovalStatus.PENDING);
        instance.setCurrentNode(nodes.get(0).name());
        instance.setInitiatorId(initiatorId);
        instance.setInitiatedAt(OffsetDateTime.now());
        instance = instanceRepository.save(instance);

        // 3. 创建首节点审批任务
        createTask(instance.getId(), nodes.get(0));

        log.info("创建审批实例: id={}, projectId={}, flowType={}, businessId={}, 首节点={}",
                instance.getId(), projectId, flowType, businessId, nodes.get(0).name());
        return instance;
    }

    // ==================== 通过当前任务 ====================

    /**
     * 通过当前审批任务 → 推进下一节点 → 末节点则标记实例 APPROVED。
     *
     * @param taskId     审批任务 ID
     * @param approverId 审批人 ID
     * @param comment    审批意见
     * @return 已通过的任务
     */
    @Transactional
    public ApprovalTask approve(Long taskId, Long approverId, String comment) {
        ApprovalTask task = requirePendingTask(taskId);

        // 1. 标记任务 APPROVED
        task.setStatus(ApprovalTaskStatus.APPROVED);
        task.setComment(comment);
        task.setCompletedAt(OffsetDateTime.now());
        taskRepository.save(task);

        // 2. 写入审批记录（链式哈希留痕，§7.4）
        writeRecord(task.getInstanceId(), taskId, approverId, ApprovalAction.APPROVE, comment);

        // 3. 推进节点：解析配置，定位当前节点序号
        ApprovalInstance instance = requireInstance(task.getInstanceId());
        List<ApprovalNodeConfig> nodes = parseNodes(flowConfigService
                .findActive(instance.getProjectId(), instance.getFlowType()).getConfigJson());
        int currentIdx = indexOfNode(nodes, task.getNodeName());

        if (currentIdx >= 0 && currentIdx + 1 < nodes.size()) {
            // 还有下一节点：推进
            ApprovalNodeConfig next = nodes.get(currentIdx + 1);
            instance.setCurrentNode(next.name());
            instanceRepository.save(instance);
            createTask(instance.getId(), next);
            log.info("审批任务 {} 通过，推进到下一节点: {}", taskId, next.name());
        } else {
            // 末节点：实例 APPROVED
            instance.setStatus(ApprovalStatus.APPROVED);
            instance.setCompletedAt(OffsetDateTime.now());
            instanceRepository.save(instance);
            log.info("审批任务 {} 通过，实例 {} 全部节点通过，标记 APPROVED", taskId, instance.getId());
        }
        return task;
    }

    // ==================== 退回当前任务 ====================

    /**
     * 退回当前审批任务 → 标记实例 REJECTED。
     *
     * @param taskId     审批任务 ID
     * @param approverId 审批人 ID
     * @param comment    退回意见
     * @return 已退回的任务
     */
    @Transactional
    public ApprovalTask reject(Long taskId, Long approverId, String comment) {
        ApprovalTask task = requirePendingTask(taskId);

        // 1. 标记任务 REJECTED
        task.setStatus(ApprovalTaskStatus.REJECTED);
        task.setComment(comment);
        task.setCompletedAt(OffsetDateTime.now());
        taskRepository.save(task);

        // 2. 写入审批记录（链式哈希留痕，§7.4）
        writeRecord(task.getInstanceId(), taskId, approverId, ApprovalAction.REJECT, comment);

        // 3. 标记实例 REJECTED
        ApprovalInstance instance = requireInstance(task.getInstanceId());
        instance.setStatus(ApprovalStatus.REJECTED);
        instance.setCompletedAt(OffsetDateTime.now());
        instanceRepository.save(instance);

        log.info("审批任务 {} 退回，实例 {} 标记 REJECTED", taskId, instance.getId());
        return task;
    }

    // ==================== 查询 ====================

    /** 查询审批人待办 / 指定状态的任务 */
    @Transactional(readOnly = true)
    public List<ApprovalTask> listTasks(Long assigneeId, ApprovalTaskStatus status) {
        if (assigneeId != null && status != null) {
            return taskRepository.findByAssigneeIdAndStatus(assigneeId, status);
        }
        if (assigneeId != null) {
            return taskRepository.findAll().stream()
                    .filter(t -> Objects.equals(t.getAssigneeId(), assigneeId))
                    .toList();
        }
        return taskRepository.findAll();
    }

    /** 查询审批实例的链式记录（按写入顺序） */
    @Transactional(readOnly = true)
    public List<ApprovalRecord> listRecords(Long instanceId) {
        return recordRepository.findByInstanceIdOrderByCreatedAtAsc(instanceId);
    }

    /** 查询审批实例下首个待处理任务（日报确认流程 confirm 时使用） */
    @Transactional(readOnly = true)
    public ApprovalTask findFirstPendingTask(Long instanceId) {
        List<ApprovalTask> pending = taskRepository.findByInstanceIdAndStatus(instanceId, ApprovalTaskStatus.PENDING);
        return pending.isEmpty() ? null : pending.get(0);
    }

    /** 按业务实体 ID + 审批类型查找审批实例（日报退回/作废联动时使用） */
    @Transactional(readOnly = true)
    public ApprovalInstance findInstance(Long businessId, ApprovalFlowType flowType) {
        return instanceRepository.findByBusinessIdAndFlowType(businessId, flowType).orElse(null);
    }

    /** 查看实例详情 */
    @Transactional(readOnly = true)
    public ApprovalInstance detailInstance(Long instanceId) {
        return requireInstance(instanceId);
    }

    // ==================== 内部工具 ====================

    /** 为指定节点创建审批任务（分派给节点配置的 approverId） */
    private ApprovalTask createTask(Long instanceId, ApprovalNodeConfig node) {
        if (node.approverId() == null) {
            // 角色解析需上层注入；通用引擎要求节点配置 approverId
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID,
                    "审批节点未配置具体审批人 approverId（node=" + node.node() + ", name=" + node.name()
                            + "），请先解析 approverRoleId 后回填 approverId");
        }
        ApprovalTask task = new ApprovalTask();
        task.setInstanceId(instanceId);
        task.setAssigneeId(node.approverId());
        task.setNodeName(node.name());
        task.setStatus(ApprovalTaskStatus.PENDING);
        task.setAssignedAt(OffsetDateTime.now());
        return taskRepository.save(task);
    }

    /**
     * 写入审批记录（§7.4 链式哈希留痕）。
     * <p>record_hash = SHA-256(prev_hash + content)，prev_hash 取本实例上一条记录的 record_hash。
     */
    private void writeRecord(Long instanceId, Long taskId, Long approverId,
                             ApprovalAction action, String comment) {
        List<ApprovalRecord> existing = recordRepository.findByInstanceIdOrderByCreatedAtAsc(instanceId);
        String prevHash = existing.isEmpty() ? null : existing.get(existing.size() - 1).getRecordHash();

        ApprovalRecord record = new ApprovalRecord();
        record.setInstanceId(instanceId);
        record.setTaskId(taskId);
        record.setApproverId(approverId);
        record.setAction(action);
        record.setComment(comment);
        record.setPrevHash(prevHash);
        record.setRecordHash(computeRecordHash(prevHash, instanceId, taskId, approverId, action, comment));
        recordRepository.save(record);
    }

    /** 计算链式哈希：SHA-256(prev_hash + "|" + content)，返回 64 位十六进制小写 */
    private static String computeRecordHash(String prevHash, Long instanceId, Long taskId,
                                            Long approverId, ApprovalAction action, String comment) {
        String safeComment = comment == null ? "" : comment;
        String safePrev = prevHash == null ? "" : prevHash;
        String content = safePrev + "|" + instanceId + "|" + taskId + "|"
                + approverId + "|" + action + "|" + safeComment;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(content.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(hashBytes.length * 2);
            for (byte b : hashBytes) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 算法不可用", e);
        }
    }

    /** 解析 config_json 为节点列表，按 node 序号排序 */
    private List<ApprovalNodeConfig> parseNodes(String configJson) {
        if (configJson == null || configJson.isBlank()) {
            return List.of();
        }
        try {
            List<ApprovalNodeConfig> nodes = objectMapper.readValue(
                    configJson, new TypeReference<List<ApprovalNodeConfig>>() {});
            nodes.sort(Comparator.comparing(ApprovalNodeConfig::node,
                    Comparator.nullsLast(Comparator.naturalOrder())));
            return nodes;
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.DATA_VALIDATION_FAILED,
                    "审批流配置 config_json 解析失败: " + e.getMessage());
        }
    }

    /** 定位节点名称在列表中的下标 */
    private int indexOfNode(List<ApprovalNodeConfig> nodes, String nodeName) {
        for (int i = 0; i < nodes.size(); i++) {
            if (Objects.equals(nodes.get(i).name(), nodeName)) {
                return i;
            }
        }
        return -1;
    }

    private ApprovalTask requirePendingTask(Long taskId) {
        ApprovalTask task = taskRepository.findById(taskId)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "审批任务不存在: " + taskId));
        if (task.getStatus() != ApprovalTaskStatus.PENDING) {
            throw new BusinessException(ErrorCode.BIZ_OPERATION_NOT_ALLOWED,
                    "审批任务状态为 " + task.getStatus() + "，不可重复处理");
        }
        return task;
    }

    private ApprovalInstance requireInstance(Long instanceId) {
        return instanceRepository.findById(instanceId)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND,
                        "审批实例不存在: " + instanceId));
    }
}
