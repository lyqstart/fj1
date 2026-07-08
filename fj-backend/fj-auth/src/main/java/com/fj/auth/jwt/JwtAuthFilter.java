package com.fj.auth.jwt;

import com.fj.auth.security.SecurityContextHolder;
import com.fj.auth.security.UserContext;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * JWT 认证过滤器（OncePerRequestFilter，DD-4）。
 * <p>解析 Authorization: Bearer 令牌 → 校验黑名单 → 设置 {@link SecurityContextHolder}。
 * 必须在 {@link com.fj.auth.rbac.ProjectAccessFilter} 之前执行（@Order 指定）。
 */
@Slf4j
@Component
@RequiredArgsConstructor
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtTokenProvider jwtTokenProvider;
    private final TokenBlacklistService tokenBlacklistService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = resolveToken(request);
        try {
            if (StringUtils.hasText(token) && jwtTokenProvider.isValid(token)) {
                Claims claims = jwtTokenProvider.parse(token);
                String jti = jwtTokenProvider.getJti(claims);
                if (tokenBlacklistService.isRevoked(jti)) {
                    log.debug("令牌已撤销，跳过认证上下文设置: jti={}", jti);
                } else {
                    SecurityContextHolder.setContext(new UserContext(
                            jwtTokenProvider.getUserId(claims),
                            jwtTokenProvider.getUsername(claims),
                            jti));
                }
            }
        } catch (Exception e) {
            log.debug("JWT 解析异常，按匿名请求处理: {}", e.getMessage());
        }
        try {
            chain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clear();
        }
    }

    private String resolveToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (StringUtils.hasText(header) && header.startsWith(BEARER_PREFIX)) {
            return header.substring(BEARER_PREFIX.length()).trim();
        }
        return null;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        // 登录 / 刷新接口不走令牌认证（使用 getServletPath 以兼容 context-path）
        return path.startsWith("/api/v1/auth/login") || path.startsWith("/api/v1/auth/refresh");
    }
}
