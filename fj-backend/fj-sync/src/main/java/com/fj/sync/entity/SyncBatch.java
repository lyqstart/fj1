package com.fj.sync.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;
import java.time.OffsetDateTime;

/**
 * 同步批次实体（对应 V4 sync_batches 表，§6.3 / §101.28）。
 * <p>每次 push 携带 client_batch_uuid，服务端据此去重：同一 batch_uuid 重复提交直接返回原结果（幂等）。
 */
@Entity
@Table(name = "sync_batches")
@Getter
@Setter
public class SyncBatch extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 客户端生成的批次 UUID（幂等键，全局唯一） */
    @Column(name = "client_batch_uuid", nullable = false, length = 64)
    private String clientBatchUuid;

    /** 推送用户 ID */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 推送设备标识 */
    @Column(name = "device_id", length = 128)
    private String deviceId;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private SyncBatchStatus status = SyncBatchStatus.RECEIVED;

    /** push 时客户端携带的基线 seq（冲突检测，§6.5） */
    @Column(name = "base_server_seq", nullable = false)
    private Long baseServerSeq = 0L;

    /** 本次推送完成后服务端的最新 seq */
    @Column(name = "server_seq_after", nullable = false)
    private Long serverSeqAfter = 0L;

    /** 本批次包含的变更记录总数 */
    @Column(name = "record_count", nullable = false)
    private Integer recordCount = 0;

    /** 本批次检测到的冲突数 */
    @Column(name = "conflict_count", nullable = false)
    private Integer conflictCount = 0;

    /** 失败时的错误明细 */
    @Column(name = "error_detail", columnDefinition = "text")
    private String errorDetail;

    /** 服务端处理完成时间 */
    @Column(name = "processed_at")
    private OffsetDateTime processedAt;
}
