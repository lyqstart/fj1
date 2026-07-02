package com.fj.sync.dto;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.List;
import java.util.Map;

/**
 * 同步推送响应（§6.3）。
 * <pre>
 * {
 *   "sync_batch_id": 1,
 *   "status": "COMPLETED",
 *   "server_seq_after": 12510,
 *   "accepted": { "daily_report_issues": [ {client_uuid, server_id, server_seq} ] },
 *   "conflicts": [ {table, client_uuid, conflict_code, server_data} ],
 *   "latest_server_seq": 12510
 * }
 * </pre>
 */
@Data
public class SyncPushResponse implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Long syncBatchId;

    /** 批次状态：COMPLETED / FAILED */
    private String status;

    /** 本次推送完成后服务端的最新 seq */
    private Long serverSeqAfter;

    /** 接收明细：表名 → [{client_uuid, server_id, server_seq}] */
    private Map<String, List<AcceptedRecord>> accepted;

    /** 冲突明细 */
    private List<ConflictRecord> conflicts;

    /** 最新服务端 seq（便于客户端对齐） */
    private Long latestServerSeq;

    /** 单条记录的接收结果 */
    @Data
    public static class AcceptedRecord implements Serializable {
        @Serial
        private static final long serialVersionUID = 1L;
        private String clientUuid;
        /** 服务端分配的正式 ID（业务表尚未接入时为 null） */
        private Long serverId;
        /** 服务端分配的同步序号 */
        private Long serverSeq;
        /** 处理状态：created / updated / unchanged */
        private String result;
    }

    /** 冲突记录（§6.5：4002/4003/4004） */
    @Data
    public static class ConflictRecord implements Serializable {
        @Serial
        private static final long serialVersionUID = 1L;
        private String table;
        private String clientUuid;
        /** 冲突码：4002 server_seq 冲突 / 4003 日报已退回 / 4004 任务已取消 */
        private Integer conflictCode;
        private String message;
        /** 服务端当前版本数据（供客户端展示对比） */
        private Map<String, Object> serverData;
    }
}
