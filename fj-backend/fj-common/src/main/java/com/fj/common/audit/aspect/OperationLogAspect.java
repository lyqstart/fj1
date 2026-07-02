package com.fj.common.audit.aspect;

import com.fj.common.audit.LogOperation;
import com.fj.common.audit.service.OperationLogService;
import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.AfterThrowing;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;

import java.lang.annotation.Annotation;

/**
 * 操作日志切面（§7.4）。
 *
 * <p>拦截标注 {@link LogOperation} 的方法：
 * <ul>
 *   <li>正常返回后，按注解元数据写入一条操作日志</li>
 *   <li>抛出权限类 {@link BusinessException}（错误码 2xxx）时，写入一条越权访问记录</li>
 * </ul>
 *
 * <p>同时拦截 {@code com.fj.auth.rbac.RequirePermission} 方法：当其抛出权限类异常
 * （错误码 2xxx）时，写入一条 ACCESS_DENIED 审计记录。该注解位于 fj-auth，fj-common
 * 通过全限定类名匹配切点、反射读取 resource/action，避免循环依赖。
 *
 * <p>日志记录本身的任何异常都被吞掉并降级为 WARN，绝不影响业务主流程。
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class OperationLogAspect {

    private final OperationLogService operationLogService;

    /** 正常完成后记录操作日志 */
    @Around("@annotation(logOperation)")
    public Object around(ProceedingJoinPoint pjp, LogOperation logOperation) throws Throwable {
        Object result = pjp.proceed();
        safeLog(logOperation, pjp.getArgs(), null);
        return result;
    }

    /** 抛出权限类异常时记录越权访问 */
    @AfterThrowing(pointcut = "@annotation(logOperation)", throwing = "ex")
    public void afterThrowing(LogOperation logOperation, Throwable ex) {
        if (ex instanceof BusinessException be) {
            ErrorCode code = be.getErrorCode();
            // 错误码 2000-2999 为权限类（见 ErrorCode 分段）
            if (code.getCode() >= 2000 && code.getCode() < 3000) {
                safeLog(logOperation, new Object[0], "越权访问被拒绝: " + code.getDescription());
            }
        }
    }

    /**
     * 拦截 {@code @RequirePermission} 方法抛出的权限类异常，写入 ACCESS_DENIED 审计记录。
     *
     * <p>注：{@code @RequirePermission} 位于 fj-auth 模块，fj-common 不能编译期依赖 fj-auth
     * （依赖方向 fj-auth → fj-common），故此处以全限定类名匹配切点、反射读取 resource/action，
     * 避免循环依赖。SecurityContextHolder 同在 fj-auth，operatorId 暂记为 null。
     */
    @AfterThrowing(
            pointcut = "@annotation(com.fj.auth.rbac.RequirePermission)",
            throwing = "ex")
    public void logPermissionDenied(JoinPoint joinPoint, Throwable ex) {
        if (!isPermissionDeniedException(ex)) {
            return;
        }
        try {
            String targetType = joinPoint.getSignature().getDeclaringType().getSimpleName();
            String permission = describeDeniedPermission(joinPoint);
            String content = permission != null ? "权限拒绝: " + permission : "权限拒绝";
            operationLogService.log(null, "ACCESS_DENIED", targetType, null, content);
        } catch (Exception logEx) {
            log.warn("越权访问审计日志写入失败（不影响业务）: {}", logEx.getMessage());
        }
    }

    /** 判定是否为权限拒绝类异常（BusinessException 且错误码落在 2xxx 段） */
    private boolean isPermissionDeniedException(Throwable ex) {
        if (ex instanceof BusinessException be) {
            int code = be.getErrorCode().getCode();
            return code >= 2000 && code < 3000;
        }
        return false;
    }

    /**
     * 反射读取 {@code @RequirePermission} 的 resource/action（不依赖 fj-auth 编译期类型）。
     * 读不到或反射异常时返回 null。
     */
    private String describeDeniedPermission(JoinPoint joinPoint) {
        if (!(joinPoint.getSignature() instanceof MethodSignature ms)) {
            return null;
        }
        for (Annotation a : ms.getMethod().getAnnotations()) {
            if ("com.fj.auth.rbac.RequirePermission".equals(a.annotationType().getName())) {
                try {
                    String resource = (String) a.annotationType().getMethod("resource").invoke(a);
                    String action = (String) a.annotationType().getMethod("action").invoke(a);
                    return "resource=" + resource + ", action=" + action;
                } catch (Exception ignore) {
                    return null;
                }
            }
        }
        return null;
    }

    /** 记录日志，失败时降级为 WARN，不影响业务 */
    private void safeLog(LogOperation meta, Object[] args, String overrideContent) {
        try {
            Long operatorId = extractLong(args, meta.operatorArgIndex());
            Long targetId = extractLong(args, meta.targetIdArgIndex());
            String content = overrideContent != null ? overrideContent : meta.operationType();
            operationLogService.log(operatorId, meta.operationType(), meta.targetType(), targetId, content);
        } catch (Exception e) {
            log.warn("操作日志记录失败（不影响业务）: {}", e.getMessage());
        }
    }

    /** 按索引从方法参数中提取 Long（越界或类型不符返回 null） */
    private Long extractLong(Object[] args, int index) {
        if (index < 0 || args == null || index >= args.length) {
            return null;
        }
        Object v = args[index];
        return v instanceof Long l ? l : null;
    }
}
