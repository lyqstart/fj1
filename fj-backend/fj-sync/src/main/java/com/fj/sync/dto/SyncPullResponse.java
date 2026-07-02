package com.fj.sync.dto;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.List;
import java.util.Map;

/**
 * 同步拉取响应（§6.2）。
 * <pre>
 * {
 *   "changes": { "daily_reports": [ {op, server_id, server_seq, fields} ] },
 *   "latest_server_seq": 12500,
 *   "has_more": false
 * }
 * </pre>
 */
@Data
public class SyncPullResponse implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 变更记录：表名 → 记录列表 */
    private Map<String, List<Map<String, Object>>> changes;

    /** 本次拉取覆盖的最大 server_seq（客户端据此更新 last_server_seq） */
    private Long latestServerSeq;

    /** 是否还有更多数据（结果数 = limit 时为 true） */
    private Boolean hasMore;
}
