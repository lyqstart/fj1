package com.fj.common.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

/**
 * Caffeine 本地缓存配置（§6.1）。
 * <p>用于高频读取、低变更的数据缓存（如权限、字典、配置）。
 */
@Configuration
@EnableCaching
public class CacheConfig {

    /** 默认过期时间（分钟） */
    private static final long DEFAULT_EXPIRE_MINUTES = 30;

    /** 默认最大缓存条目 */
    private static final long DEFAULT_MAX_SIZE = 10_000;

    /**
     * Caffeine 缓存管理器。
     * <p>采用懒加载策略：首次访问某 cacheName 时按默认规格创建。
     *
     * @return CacheManager
     */
    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();
        cacheManager.setCaffeine(Caffeine.newBuilder()
                .expireAfterWrite(DEFAULT_EXPIRE_MINUTES, TimeUnit.MINUTES)
                .maximumSize(DEFAULT_MAX_SIZE)
                .recordStats());
        cacheManager.setAllowNullValues(false);
        return cacheManager;
    }
}
