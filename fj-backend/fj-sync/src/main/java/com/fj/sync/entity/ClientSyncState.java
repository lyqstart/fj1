package com.fj.sync.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;
import java.time.OffsetDateTime;

/**
 * 客户端同步状态实体（对应 V4 client_sync_states 表，§6.1 / §101.28）。
 * <p>每个 用户+设备+项目 维护一份 last_server_seq，作为增量拉取游标。
 */
@Entity
@Table(name = "client_sync_states")
@Getter
@Setter
public class ClientSyncState extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "device_id", nullable = false, length = 128)
    private String deviceId;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    /** 增量拉取游标（§6.2），pull 时 since=last_server_seq */
    @Column(name = "last_server_seq", nullable = false)
    private Long lastServerSeq = 0L;

    /** 最近一次成功推送的 sync_batches.id */
    @Column(name = "last_push_batch_id")
    private Long lastPushBatchId;

    /** 最近一次成功同步（pull+push）时间 */
    @Column(name = "last_synced_at")
    private OffsetDateTime lastSyncedAt;
}
