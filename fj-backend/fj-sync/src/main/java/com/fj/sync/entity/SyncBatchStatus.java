package com.fj.sync.entity;

/**
 * 同步批次状态枚举（对应 sync_batches.status VARCHAR，§101.28）。
 */
public enum SyncBatchStatus {

    /** 已接收（服务端已接收，处理中） */
    PROCESSING,
    /** 处理完成（全部成功） */
    COMPLETED,
    /** 处理失败 */
    FAILED
}
