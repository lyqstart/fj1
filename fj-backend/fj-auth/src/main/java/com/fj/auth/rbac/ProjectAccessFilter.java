package com.fj.auth.rbac;

import com.fj.auth.security.SecurityContextHolder;
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
 * 项目访问过滤器（§7.2 项目级数据隔离，§103.3 授权基线）。
 * <p>从请求参数中提取 projectId → 校验当前用户是否有该项目的访问权限。
 * 必须在 {@link com.fj.auth.jwt.JwtAuthFilter} 之后执行（@Order 指定）。
 * <p>注意：过滤器位于 DispatcherServlet 之外，@RestControllerAdvice 无法捕获异常，
 * 因此越权时直接写出 403 JSON 响应，不抛异常。
 */
@Slf4j
@Component
@RequiredArgsConstructor
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class ProjectAccessFilter extends OncePerRequestFilter {

    private final PermissionChecker permissionChecker;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Long userId = SecurityContextHolder.getCurrentUserId();
        // 双写参数兼容：优先读 camelCase projectId，为空时 fallback 读 snake_case project_id，
        // 兼容 camelCase / snake_case 两种命名约定的前端与上游调用方。
        String projectIdParam = request.getParameter("projectId");
        if (!StringUtils.hasText(projectIdParam)) {
            projectIdParam = request.getParameter("project_id");  // snake_case fallback
        }

        if (userId != null && StringUtils.hasText(projectIdParam)) {
            Long projectId;
            try {
                projectId = Long.valueOf(projectIdParam);
            } catch (NumberFormatException e) {
                chain.doFilter(request, response);
                return;
            }
            if (!permissionChecker.hasProjectAccess(userId, projectId)) {
                log.warn("项目访问被拒: userId={}, projectId={}", userId, projectId);
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write("{\"code\":2003,\"message\":\"无该项目访问权限\"}");
                return;
            }
        }
        chain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // 认证接口不校验项目访问
        return request.getRequestURI().startsWith("/api/v1/auth/");
    }
}
