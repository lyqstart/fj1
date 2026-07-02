package com.fj.sync.dto;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.Map;

/**
 * 同步推送请求（§6.3）。
 * <pre>
 * {
 *   "client_batch_uuid": "batch-uuid-001",
 *   "base_server_seq": 12345,
 *   "project_id": 1,
 *   "device_id": "device-xxx",
 *   "changes": {
 *     "daily_report_issues": [ {client_uuid, op, fields}, ... ],
 *     "photos": [ ... ]
 *   }
 * }
 * </pre>
 */
@Data
public class SyncPushRequest implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 客户端生成的批次 UUID（幂等键，§6.3） */
    private String clientBatchUuid;

    /** push 时客户端携带的基线 seq（冲突检测，§6.5） */
    private Long baseServerSeq;

    private Long projectId;

    private String deviceId;

    /** 变更记录：表名 → 记录列表 */
    private Map<String, java.util.List<SyncRecord>> changes;
}
