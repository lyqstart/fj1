package com.fj.auth.security;

/**
 * 当前用户上下文持有者（ThreadLocal）。
 * <p>请求线程级存储，{@code JwtAuthFilter} 在请求开始时设置、结束时清理。
 * 避免使用 Spring Security 的 SecurityContext，保持业务层解耦。
 */
public final class SecurityContextHolder {

    private static final ThreadLocal<UserContext> CONTEXT = new ThreadLocal<>();

    private SecurityContextHolder() {
    }

    /** 设置当前请求的认证上下文 */
    public static void setContext(UserContext context) {
        CONTEXT.set(context);
    }

    /** 获取当前请求的认证上下文（未认证返回 null） */
    public static UserContext getContext() {
        return CONTEXT.get();
    }

    /** 获取当前用户 ID（未认证返回 null） */
    public static Long getCurrentUserId() {
        UserContext ctx = CONTEXT.get();
        return ctx == null ? null : ctx.userId();
    }

    /** 获取当前用户名（未认证返回 null） */
    public static String getCurrentUsername() {
        UserContext ctx = CONTEXT.get();
        return ctx == null ? null : ctx.username();
    }

    /** 清理当前线程上下文（必须在请求结束时调用，防止线程池泄漏） */
    public static void clear() {
        CONTEXT.remove();
    }
}
