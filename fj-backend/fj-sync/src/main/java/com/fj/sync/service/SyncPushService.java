package com.fj.sync.service;

import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.sync.dto.SyncPushRequest;
import com.fj.sync.dto.SyncPushResponse;
import com.fj.sync.dto.SyncPushResponse.AcceptedRecord;
import com.fj.sync.dto.SyncPushResponse.ConflictRecord;
import com.fj.sync.dto.SyncRecord;
import com.fj.sync.entity.ClientSyncState;
import com.fj.sync.entity.SyncBatch;
import com.fj.sync.entity.SyncBatchStatus;
import com.fj.sync.repository.ClientSyncStateRepository;
import com.fj.sync.repository.SyncBatchRepository;
import com.fj.sync.seq.ServerSeqAllocator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 同步推送 Service（§6.3 / §101.28）。
 * <p>职责：
 * <ol>
 *   <li><b>批次幂等</b>：按 {@code client_batch_uuid} 去重，重复提交直接返回原结果。</li>
 *   <li><b>序号分配</b>：调用 {@link ServerSeqAllocator} 为每条记录分配 {@code server_seq}。</li>
 *   <li><b>变更落库</b>：按表名分发到对应 {@link SyncChangeApplier}。</li>
 *   <li><b>状态记录</b>：写入 {@link SyncBatch} 并更新 {@link ClientSyncState}。</li>
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SyncPushService {

    private final SyncBatchRepository syncBatchRepository;
    private final ClientSyncStateRepository clientSyncStateRepository;
    private final ServerSeqAllocator serverSeqAllocator;
    private final List<SyncChangeApplier> appliers;

    /**
     * 处理一次同步推送。
     *
     * @param userId   推送用户 ID（由认证上下文注入）
     * @param request  推送请求
     * @return 推送响应（含 accepted / conflicts / latest_server_seq）
     */
    @Transactional
    public SyncPushResponse push(Long userId, SyncPushRequest request) {
        if (request.getClientBatchUuid() == null || request.getClientBatchUuid().isBlank()) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID, "client_batch_uuid 不能为空");
        }
        if (request.getProjectId() == null) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID, "project_id 不能为空");
        }

        // ===== 1. 批次幂等：client_batch_uuid 去重（§6.3） =====
        SyncBatch existing = syncBatchRepository.findByClientBatchUuid(request.getClientBatchUuid()).orElse(null);
        if (existing != null) {
            log.info("SyncPush idempotent hit: client_batch_uuid={}, status={}",
                    request.getClientBatchUuid(), existing.getStatus());
            return buildIdempotentResponse(existing);
        }

        // ===== 2. 创建批次记录（PROCESSING） =====
        SyncBatch batch = new SyncBatch();
        batch.setClientBatchUuid(request.getClientBatchUuid());
        batch.setUserId(userId);
        batch.setDeviceId(request.getDeviceId());
        batch.setProjectId(request.getProjectId());
        batch.setBaseServerSeq(request.getBaseServerSeq() == null ? 0L : request.getBaseServerSeq());
        batch.setStatus(SyncBatchStatus.PROCESSING);
        batch = syncBatchRepository.save(batch);

        // ===== 3. 逐表分发：分配 server_seq 并应用变更 =====
        Map<String, List<AcceptedRecord>> accepted = new LinkedHashMap<>();
        List<ConflictRecord> conflicts = new ArrayList<>();
        int totalRecords = 0;

        Map<String, List<SyncRecord>> changes = request.getChanges() == null
                ? Map.of() : request.getChanges();
        for (Map.Entry<String, List<SyncRecord>> entry : changes.entrySet()) {
            String tableName = entry.getKey();
            List<SyncRecord> records = entry.getValue();
            if (records == null || records.isEmpty()) {
                continue;
            }
            totalRecords += records.size();

            // 为本表批次预占连续 server_seq
            long[] range = serverSeqAllocator.nextRange(records.size());
            long seq = range[0];
            for (SyncRecord r : records) {
                stampServerSeq(r, seq++);
            }

            SyncChangeApplier applier = resolveApplier(tableName);
            List<SyncChangeApplier.ApplyOutcome> outcomes =
                    applier.apply(request.getProjectId(), batch.getBaseServerSeq(), records);

            List<AcceptedRecord> tableAccepted = new ArrayList<>();
            for (SyncChangeApplier.ApplyOutcome o : outcomes) {
                if (o.isConflict()) {
                    conflicts.add(o.conflict());
                } else if (o.accepted() != null) {
                    tableAccepted.add(o.accepted());
                }
            }
            accepted.put(tableName, tableAccepted);
        }

        // ===== 4. 更新批次记录（COMPLETED） =====
        long latestSeq = serverSeqAllocator.current();
        batch.setStatus(SyncBatchStatus.COMPLETED);
        batch.setRecordCount(totalRecords);
        batch.setConflictCount(conflicts.size());
        batch.setServerSeqAfter(latestSeq);
        batch.setProcessedAt(OffsetDateTime.now());
        syncBatchRepository.save(batch);

        // ===== 5. 更新客户端同步状态（增量拉取游标） =====
        upsertClientSyncState(userId, request.getDeviceId(), request.getProjectId(), latestSeq, batch.getId());

        // ===== 6. 构建响应 =====
        SyncPushResponse response = new SyncPushResponse();
        response.setSyncBatchId(batch.getId());
        response.setStatus(batch.getStatus().name());
        response.setServerSeqAfter(latestSeq);
        response.setAccepted(accepted);
        response.setConflicts(conflicts);
        response.setLatestServerSeq(latestSeq);
        return response;
    }

    /**
     * 解析变更落库 Applier：优先匹配同名具名 Applier，否则回退到默认占位实现（tableName="*"）。
     */
    private SyncChangeApplier resolveApplier(String tableName) {
        SyncChangeApplier fallback = null;
        for (SyncChangeApplier a : appliers) {
            if (tableName.equals(a.tableName())) {
                return a;
            }
            if ("*".equals(a.tableName())) {
                fallback = a;
            }
        }
        if (fallback == null) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID,
                    "无可用的同步变更处理器: " + tableName);
        }
        return fallback;
    }

    /** 将预分配的 server_seq 写入记录 fields，供 Applier 持久化 */
    private void stampServerSeq(SyncRecord record, long seq) {
        if (record.getFields() == null) {
            record.setFields(new HashMap<>());
        }
        record.getFields().put("server_seq", seq);
    }

    /** 幂等命中时重建响应（不含变更明细，仅状态与 seq） */
    private SyncPushResponse buildIdempotentResponse(SyncBatch batch) {
        SyncPushResponse response = new SyncPushResponse();
        response.setSyncBatchId(batch.getId());
        response.setStatus(batch.getStatus().name());
        response.setServerSeqAfter(batch.getServerSeqAfter());
        response.setAccepted(new LinkedHashMap<>());
        response.setConflicts(List.of());
        response.setLatestServerSeq(batch.getServerSeqAfter());
        return response;
    }

    /** 更新或创建客户端同步状态 */
    private void upsertClientSyncState(Long userId, String deviceId, Long projectId, long latestSeq, Long batchId) {
        ClientSyncState state = clientSyncStateRepository
                .findByUserIdAndDeviceIdAndProjectId(userId, deviceId == null ? "" : deviceId, projectId)
                .orElseGet(() -> {
                    ClientSyncState s = new ClientSyncState();
                    s.setUserId(userId);
                    s.setDeviceId(deviceId == null ? "" : deviceId);
                    s.setProjectId(projectId);
                    return s;
                });
        // 游标只前进，不回退
        if (latestSeq > state.getLastServerSeq()) {
            state.setLastServerSeq(latestSeq);
        }
        state.setLastPushBatchId(batchId);
        state.setLastSyncedAt(OffsetDateTime.now());
        clientSyncStateRepository.save(state);
    }
}
