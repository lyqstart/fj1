package com.fj.auth.jwt;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

/**
 * 令牌黑名单服务（Caffeine 本地缓存，DD-4）。
 * <p>撤销的令牌按 jti 存储，TTL = token 剩余有效期，过期自动清除。
 * 解决 JWT 无状态令牌无法主动失效的问题。
 */
@Service
public class TokenBlacklistService {

    /** 黑名单缓存：key=jti, value=令牌过期时间戳（毫秒） */
    private final Cache<String, Long> blacklist = Caffeine.newBuilder()
            .expireAfterWrite(7, TimeUnit.DAYS)
            .maximumSize(50_000)
            .build();

    /** 将令牌加入黑名单（登出 / 刷新旧令牌时调用） */
    public void revoke(String jti, long expiryMillis) {
        if (jti == null || jti.isBlank()) {
            return;
        }
        blacklist.put(jti, expiryMillis);
    }

    /** 判断令牌是否已被撤销 */
    public boolean isRevoked(String jti) {
        return jti != null && !jti.isBlank() && blacklist.getIfPresent(jti) != null;
    }
}
