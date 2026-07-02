package com.fj.sync.service;

import com.fj.sync.dto.SyncPushResponse.AcceptedRecord;
import com.fj.sync.dto.SyncPushResponse.ConflictRecord;
import com.fj.sync.dto.SyncRecord;

import java.util.List;

/**
 * 同步变更落库 SPI（业务模块实现，用于把推送记录真正写入业务表）。
 * <p>{@link SyncPushService} 负责协议层（幂等、序号分配、批次记录、ClientSyncState 更新），
 * 而每张业务表（daily_report_issues / photos / ...）的实际 upsert/delete 由对应模块通过实现本接口提供。
 *
 * <p>每个实现声明自己负责的 {@code tableName}（如 {@code "daily_report_issues"}），
 * {@link SyncPushService} 按 changes 的 key 分发。
 */
public interface SyncChangeApplier {

    /** 本实现负责的业务表名（与 push payload 的 changes key 对应） */
    String tableName();

    /**
     * 应用一批变更记录。
     *
     * @param projectId  项目 ID
     * @param baseServerSeq 客户端基线 seq（冲突检测用）
     * @param records    本批次的变更记录（每条已预分配 server_seq，置于 fields.server_seq）
     * @return 每条记录的接收结果（成功）或冲突（§6.5：4002/4003/4004）
     */
    List<ApplyOutcome> apply(Long projectId, Long baseServerSeq, List<SyncRecord> records);

    /** 单条记录的接收结果 */
    record ApplyOutcome(AcceptedRecord accepted, ConflictRecord conflict) {
        /** 是否为冲突结果 */
        public boolean isConflict() {
            return conflict != null;
        }
    }
}
