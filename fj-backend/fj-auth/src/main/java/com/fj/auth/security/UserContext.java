package com.fj.auth.security;

/**
 * 当前认证用户上下文（绑定到 ThreadLocal）。
 * <p>由 {@link SecurityContextHolder} 管理，{@code JwtAuthFilter} 解析令牌后设置。
 *
 * @param userId   用户 ID
 * @param username 用户名
 * @param jti      JWT 唯一标识（用于黑名单撤销）
 */
public record UserContext(Long userId, String username, String jti) {
}
