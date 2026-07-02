package com.fj.auth.rbac;

import com.fj.auth.security.SecurityContextHolder;
import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;

/**
 * 权限校验切面（§7.2 RBAC，AOP 拦截 @RequirePermission）。
 * <p>从 {@link SecurityContextHolder} 获取当前用户 → 通过 {@link PermissionChecker} 校验。
 * 无权限抛 {@link BusinessException}(ErrorCode.AUTHZ_NO_PERMISSION) 并记录审计日志。
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class PermissionAspect {

    private final PermissionChecker permissionChecker;

    /**
     * 拦截所有标注 @RequirePermission 的方法。
     */
    @Around("@annotation(rp)")
    public Object checkPermission(ProceedingJoinPoint pjp, RequirePermission rp) throws Throwable {
        Long userId = SecurityContextHolder.getCurrentUserId();
        if (userId == null) {
            throw new BusinessException(ErrorCode.AUTH_TOKEN_MISSING, "未认证，请先登录");
        }

        Long projectId = rp.projectId() ? resolveProjectId(pjp) : null;
        boolean allowed;
        if (rp.projectId()) {
            // 项目级校验：命中项目角色权限 或 全局角色权限均可
            allowed = permissionChecker.hasPermission(userId, projectId, rp.resource(), rp.action())
                    || permissionChecker.hasPermission(userId, null, rp.resource(), rp.action());
        } else {
            // 全局校验（如 user 管理，不区分项目）
            allowed = permissionChecker.hasPermission(userId, null, rp.resource(), rp.action());
        }

        if (!allowed) {
            log.warn("越权访问已拦截: userId={}, projectId={}, resource={}, action={}",
                    userId, projectId, rp.resource(), rp.action());
            throw new BusinessException(ErrorCode.AUTHZ_NO_PERMISSION, "无操作权限");
        }
        return pjp.proceed();
    }

    /**
     * 从方法参数中提取名为 projectId 的参数值。
     */
    private Long resolveProjectId(ProceedingJoinPoint pjp) {
        MethodSignature signature = (MethodSignature) pjp.getSignature();
        String[] paramNames = signature.getParameterNames();
        Object[] args = pjp.getArgs();
        if (paramNames == null) {
            return null;
        }
        for (int i = 0; i < paramNames.length; i++) {
            if ("projectId".equals(paramNames[i]) && args[i] != null) {
                try {
                    return Long.valueOf(args[i].toString());
                } catch (NumberFormatException e) {
                    return null;
                }
            }
        }
        return null;
    }
}
