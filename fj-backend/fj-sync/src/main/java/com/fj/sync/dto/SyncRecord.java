package com.fj.sync.dto;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.Map;

/**
 * 同步推送单条变更记录（§6.3）。
 * <pre>
 * { "client_uuid": "...", "op": "upsert|delete", "fields": {...} }
 * </pre>
 */
@Data
public class SyncRecord implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 客户端记录 UUID（单条幂等键，§6.3） */
    private String clientUuid;

    /** 操作类型：upsert 新增/更新 / delete 删除 */
    private String op;

    /** 记录字段（业务数据） */
    private Map<String, Object> fields;
}
