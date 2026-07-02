package com.fj.sync.service;

import com.fj.sync.dto.SyncPullResponse;
import com.fj.sync.seq.ServerSeqAllocator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 同步拉取 Service（§6.2）。
 * <p>职责：
 * <ol>
 *   <li>查询 {@code server_seq > since} 的增量变更记录（按表分发）。</li>
 *   <li>分页：结果数达到 limit 时设置 {@code has_more=true}。</li>
 *   <li>返回 {@code latest_server_seq} 供客户端更新游标。</li>
 * </ol>
 *
 * <p>各业务表的增量查询由 {@link SyncChangeProvider} 提供（业务模块实现）；
 * 当前未接入 Provider 时返回空变更 + 最新 seq，保证协议可用。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SyncPullService {

    private final ServerSeqAllocator serverSeqAllocator;
    private final List<SyncChangeProvider> providers;

    /**
     * 增量拉取变更。
     *
     * @param projectId   项目 ID（可选，限定项目范围）
     * @param since       增量游标（仅返回 server_seq &gt; since 的记录）
     * @param limit       单次最大记录数（默认 200）
     * @param entityTypes 可选，限定拉取的表名集合（逗号分隔）
     * @return 拉取响应
     */
    @Transactional(readOnly = true)
    public SyncPullResponse pull(Long projectId, Long since, Integer limit, List<String> entityTypes) {
        long cursor = since == null ? 0L : since;
        int pageSize = (limit == null || limit <= 0) ? 200 : limit;

        Map<String, List<Map<String, Object>>> changes = new LinkedHashMap<>();
        int total = 0;
        boolean hasMore = false;

        for (SyncChangeProvider provider : providers) {
            // 按 entityTypes 过滤
            if (entityTypes != null && !entityTypes.isEmpty()
                    && !entityTypes.contains(provider.tableName())) {
                continue;
            }
            int remaining = pageSize - total;
            if (remaining <= 0) {
                hasMore = true;
                break;
            }
            List<Map<String, Object>> records = provider.findChangesSince(projectId, cursor, remaining);
            if (!records.isEmpty()) {
                changes.put(provider.tableName(), records);
                total += records.size();
                if (records.size() >= remaining) {
                    hasMore = true;
                    break;
                }
            }
        }

        SyncPullResponse response = new SyncPullResponse();
        response.setChanges(changes);
        response.setLatestServerSeq(serverSeqAllocator.current());
        response.setHasMore(hasMore);
        return response;
    }
}
