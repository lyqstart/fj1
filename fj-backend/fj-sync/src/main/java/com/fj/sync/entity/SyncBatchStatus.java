package com.fj.sync.entity;

/**
 * 同步批次状态枚举（对应 sync_batches.status VARCHAR，§101.28）。
 * <p>枚举值与 V4 chk_sync_batches_status CHECK 约束完全对齐。
 */
public enum SyncBatchStatus {

    /** 已接收（服务端已接收，处理中） */
    RECEIVED,
    /** 处理完成（全部成功） */
    SUCCESS,
    /** 部分成功（部分记录冲突） */
    PARTIAL,
    /** 存在冲突 */
    CONFLICT,
    /** 处理失败 */
    FAILED
}
