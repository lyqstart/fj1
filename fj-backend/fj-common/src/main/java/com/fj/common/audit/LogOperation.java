package com.fj.common.audit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 标记需要写入操作日志的方法（由 {@link com.fj.common.audit.aspect.OperationLogAspect} 拦截）。
 *
 * <pre>
 * &#64;LogOperation(operationType = "create", targetType = "daily_report", operatorArgIndex = 0)
 * public ApiResponse&lt;?&gt; submit(Long userId, DailyReportDto dto) { ... }
 * </pre>
 *
 * <p>说明：审计注解独立于 {@code com.fj.auth.rbac.RequirePermission}，
 * 原因是 fj-common 无法反向依赖 fj-auth（模块依赖方向：fj-auth → fj-common）。
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LogOperation {

    /** 操作类型：create/update/delete/approve/login */
    String operationType();

    /** 目标实体类型 */
    String targetType();

    /**
     * 操作人 ID 在方法参数中的索引位置（默认 0）。
     * 若方法无合适参数，置为 -1，则 operatorId 记录为 null。
     */
    int operatorArgIndex() default 0;

    /**
     * 目标 ID 在方法参数中的索引位置（默认 -1，表示不提取）。
     */
    int targetIdArgIndex() default -1;
}
