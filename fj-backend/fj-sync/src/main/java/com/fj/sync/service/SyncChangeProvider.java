package com.fj.sync.service;

import java.util.List;
import java.util.Map;

/**
 * 同步增量查询 SPI（业务模块实现，用于 pull 时返回本表的增量变更）。
 * <p>{@link SyncPullService} 按 {@code tableName()} 收集各 Provider 的增量记录并合并返回。
 */
public interface SyncChangeProvider {

    /** 本实现负责的业务表名 */
    String tableName();

    /**
     * 查询 {@code server_seq > since} 的增量记录。
     *
     * @param projectId 项目 ID（可空：系统级表忽略）
     * @param since     增量游标
     * @param limit     最多返回条数
     * @return 变更记录列表（每条含 op / server_id / server_seq / fields）
     */
    List<Map<String, Object>> findChangesSince(Long projectId, long since, int limit);
}
