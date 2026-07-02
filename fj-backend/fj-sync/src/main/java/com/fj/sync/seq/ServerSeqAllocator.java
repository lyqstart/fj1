package com.fj.sync.seq;

import jakarta.annotation.PostConstruct;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicLong;

/**
 * 全局同步序号分配器（§6.2）。
 * <p>线程安全：基于 {@link AtomicLong} 单调递增分配 {@code server_seq}，用于增量同步冲突检测。
 *
 * <h3>实现策略</h3>
 * <ul>
 *   <li>启动时从数据库 {@code SELECT COALESCE(MAX(server_seq),0) FROM sync_batches} 引导当前值，
 *       保证单实例重启后序号不回退。</li>
 *   <li>进程内通过 {@code AtomicLong.incrementAndGet()} 并发安全分配。</li>
 *   <li>支持批量预占 {@link #nextRange(int)}，减少并发竞争。</li>
 * </ul>
 *
 * <p><b>生产增强建议</b>：多实例部署时，应替换为 PostgreSQL 全局 SEQUENCE
 * （{@code nextval('global_server_seq')}），并在迁移脚本中创建该序列。当前迁移未包含该序列，
 * 见 out_of_scope 备注。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ServerSeqAllocator {

    private final EntityManager entityManager;

    /** 引导 SQL（可配置，默认从 sync_batches 取最大 server_seq） */
    @Value("${fj.sync.seq.bootstrap-sql:SELECT COALESCE(MAX(server_seq),0) FROM sync_batches}")
    private String bootstrapSql;

    private final AtomicLong counter = new AtomicLong(0L);

    /**
     * 启动后从数据库引导当前最大序号，避免重启后序号回退。
     * <p>引导失败（如表未初始化）时记日志并以 0 起步，不阻断启动。
     */
    @PostConstruct
    public void bootstrap() {
        try {
            Object result = entityManager.createNativeQuery(bootstrapSql).getSingleResult();
            long current = result == null ? 0L : ((Number) result).longValue();
            counter.set(current);
            log.info("ServerSeqAllocator bootstrapped from DB: current_seq={}", current);
        } catch (PersistenceException | IllegalArgumentException e) {
            // 表可能尚未初始化（如首次启动未执行迁移），以 0 起步
            counter.set(0L);
            log.warn("ServerSeqAllocator bootstrap failed (table not ready?), starting from 0: {}", e.getMessage());
        }
    }

    /**
     * 分配下一个全局递增 server_seq（线程安全）。
     */
    public long next() {
        return counter.incrementAndGet();
    }

    /**
     * 批量预占 n 个连续 server_seq，返回 [起始(含), 结束(含)]。
     * <p>原子地取得一段区间，减少并发竞争。
     *
     * @param count 需要分配的数量（必须 &gt; 0）
     * @return 长度为 2 的数组：[startInclusive, endInclusive]
     */
    public long[] nextRange(int count) {
        if (count <= 0) {
            throw new IllegalArgumentException("count must be > 0");
        }
        long end = counter.addAndGet(count);
        long start = end - count + 1;
        return new long[]{start, end};
    }

    /**
     * 当前已分配到的最大 server_seq（不含未分配）。
     */
    public long current() {
        return counter.get();
    }
}
