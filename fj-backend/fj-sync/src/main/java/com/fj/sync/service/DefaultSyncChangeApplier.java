package com.fj.sync.service;

import com.fj.sync.dto.SyncPushResponse.AcceptedRecord;
import com.fj.sync.dto.SyncRecord;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * 默认同步变更落库实现（V1 占位）。
 * <p>当业务表尚未提供专用 {@link SyncChangeApplier} 时使用：不真正写业务表，
 * 仅记录日志并返回"已接收"结果（server_id 留空，待业务模块接入后替换为 Bean 覆盖）。
 *
 * <p><b>设计意图</b>：保证同步协议层（幂等、序号分配、批次记录）在业务实体尚未全部建立时可独立运行与验证；
 * 待 fj-inspection / fj-report 等模块建立各自的业务表后，提供专用 Applier 覆盖本占位实现。
 */
@Slf4j
@Component
public class DefaultSyncChangeApplier implements SyncChangeApplier {

    @Override
    public String tableName() {
        // 通配占位：仅当无专用 Applier 时被选中（SyncPushService 优先匹配具名 Applier）
        return "*";
    }

    @Override
    public List<ApplyOutcome> apply(Long projectId, Long baseServerSeq, List<SyncRecord> records) {
        List<ApplyOutcome> outcomes = new ArrayList<>(records.size());
        for (SyncRecord record : records) {
            AcceptedRecord accepted = new AcceptedRecord();
            accepted.setClientUuid(record.getClientUuid());
            // 占位实现不写业务表，server_id 留空；真实 server_seq 由 SyncPushService 预填入 fields
            Object seq = record.getFields() == null ? null : record.getFields().get("server_seq");
            if (seq instanceof Number n) {
                accepted.setServerSeq(n.longValue());
            }
            accepted.setResult("received");
            log.debug("SyncChangeApplier placeholder received: project={}, client_uuid={}", projectId, record.getClientUuid());
            outcomes.add(new ApplyOutcome(accepted, null));
        }
        return outcomes;
    }
}
