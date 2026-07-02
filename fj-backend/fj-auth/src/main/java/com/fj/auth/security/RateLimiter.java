package com.fj.auth.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 登录失败限流器（Caffeine 实现，§7.1）。
 * <p>同一 IP 5 次失败后锁定 5 分钟，期间直接拒绝登录请求。
 */
@Slf4j
@Component
public class RateLimiter {

    /** 触发锁定的最大失败次数 */
    private static final int MAX_FAILURES = 5;

    /** 锁定时长（分钟） */
    private static final long LOCK_MINUTES = 5;

    private final Cache<String, AtomicInteger> failureCache = Caffeine.newBuilder()
            .expireAfterWrite(LOCK_MINUTES, TimeUnit.MINUTES)
            .maximumSize(10_000)
            .build();

    /** 当前 key 是否已被锁定 */
    public boolean isLocked(String key) {
        AtomicInteger count = failureCache.getIfPresent(key);
        return count != null && count.get() >= MAX_FAILURES;
    }

    /** 记录一次失败 */
    public void recordFailure(String key) {
        AtomicInteger count = failureCache.get(key, k -> new AtomicInteger(0));
        int current = count.incrementAndGet();
        if (current >= MAX_FAILURES) {
            log.warn("登录失败次数达阈值，锁定 IP: key={}, count={}", key, current);
        }
    }

    /** 登录成功后重置计数 */
    public void reset(String key) {
        failureCache.invalidate(key);
    }
}
