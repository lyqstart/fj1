package com.fj.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.List;

/**
 * 跨域配置（CORS）。
 * <p>开发环境允许 Vite dev server（localhost:5173），
 * 生产环境通过 {@code fj.security.cors.allowed-origins} 注入允许的前端域名。
 */
@Configuration
public class CorsConfig {

    @Value("${fj.security.cors.allowed-origins:http://localhost:5173}")
    private String allowedOrigins;

    @Value("${fj.security.cors.allow-credentials:true}")
    private boolean allowCredentials;

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        // 允许的前端来源（开发 + 生产域名，逗号分隔）
        List<String> origins = Arrays.asList(allowedOrigins.split(","));
        origins.forEach(origin -> config.addAllowedOriginPattern(origin.trim()));
        // 允许的请求方法
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        // 允许的请求头
        config.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "X-Requested-With", "trace-id"));
        // 暴露的响应头
        config.setExposedHeaders(List.of("trace-id"));
        // 是否携带凭证
        config.setAllowCredentials(allowCredentials);
        // 预检请求缓存时间（秒）
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsFilter(source);
    }
}
