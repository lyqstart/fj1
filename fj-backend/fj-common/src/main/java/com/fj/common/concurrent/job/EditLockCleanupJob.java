package com.fj.common.concurrent.job;

import com.fj.common.concurrent.repository.EditLockRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * 编辑锁过期清理任务（§101.20）。
 *
 * <p>每 5 分钟扫描一次，删除 {@code expires_at < now()} 的过期锁，
 * 释放因客户端异常退出未及时释放的资源。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EditLockCleanupJob {

    private final EditLockRepository editLockRepository;

    /** 每 5 分钟清理一次过期锁（秒 分 时 日 月 周） */
    @Scheduled(cron = "0 */5 * * * *")
    @Transactional
    public void cleanupExpiredLocks() {
        int deleted = editLockRepository.deleteByExpiresAtBefore(OffsetDateTime.now());
        if (deleted > 0) {
            log.info("清理过期编辑锁 {} 把", deleted);
        }
    }
}
