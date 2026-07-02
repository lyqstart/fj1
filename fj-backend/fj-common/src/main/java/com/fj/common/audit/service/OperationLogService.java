package com.fj.common.audit.service;

import com.fj.common.audit.entity.OperationLog;
import com.fj.common.audit.repository.OperationLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Optional;

/**
 * 操作日志服务（§7.4 链式哈希防篡改）。
 *
 * <p>每次写入：
 * <ol>
 *   <li>取链尾记录的 {@code log_hash} 作为新记录的 {@code prev_hash}</li>
 *   <li>计算 {@code log_hash = SHA-256(prev_hash + operator_id + operation_type
 *       + target_type + target_id + content)}</li>
 *   <li>保存新记录</li>
 * </ol>
 * 任何对历史记录的篡改都会导致后续哈希校验失败。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OperationLogService {

    private final OperationLogRepository operationLogRepository;

    /**
     * 记录一条操作日志（链式哈希）。
     *
     * @param operatorId    操作人 ID
     * @param operationType 操作类型（create/update/delete/approve/login）
     * @param targetType    目标实体类型
     * @param targetId      目标实体 ID（可空）
     * @param content       操作内容描述（可空）
     * @return 已保存的操作日志
     */
    @Transactional
    public OperationLog log(Long operatorId, String operationType, String targetType,
                            Long targetId, String content) {
        // 1. 取链尾哈希作为 prev_hash
        String prevHash = operationLogRepository.findTopByOrderByCreatedAtDesc()
                .map(OperationLog::getLogHash)
                .orElse(null);

        // 2. 计算当前记录哈希 = SHA-256(prev_hash + operator_id + operation_type
        //    + target_type + target_id + content)
        String logHash = computeHash(prevHash, operatorId, operationType, targetType, targetId, content);

        // 3. 保存新记录（只插入，不更新/删除）
        OperationLog entity = new OperationLog();
        entity.setOperatorId(operatorId);
        entity.setOperationType(operationType);
        entity.setTargetType(targetType);
        entity.setTargetId(targetId);
        entity.setContent(content);
        entity.setPrevHash(prevHash);
        entity.setLogHash(logHash);
        return operationLogRepository.save(entity);
    }

    /**
     * SHA-256 链式哈希计算。
     * <p>拼接顺序：prev_hash → operator_id → operation_type → target_type → target_id → content。
     * 空值统一以空串参与运算，保证可重算。
     */
    static String computeHash(String prevHash, Long operatorId, String operationType,
                              String targetType, Long targetId, String content) {
        String payload = nullToEmpty(prevHash)
                + nullToEmpty(operatorId)
                + nullToEmpty(operationType)
                + nullToEmpty(targetType)
                + nullToEmpty(targetId)
                + nullToEmpty(content);
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 为 JDK 标准算法，理论上不会缺失
            throw new IllegalStateException("SHA-256 算法不可用", e);
        }
    }

    private static String nullToEmpty(Object o) {
        return o == null ? "" : o.toString();
    }

    /** 仅用于校验链完整性（只读） */
    @Transactional(readOnly = true)
    public Optional<OperationLog> findLatest() {
        return operationLogRepository.findTopByOrderByCreatedAtDesc();
    }
}
