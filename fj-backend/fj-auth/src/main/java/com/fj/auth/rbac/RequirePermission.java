package com.fj.auth.rbac;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 权限校验注解（§7.2 RBAC，AOP 拦截）。
 * <p>标注于 Controller 方法，由 {@link PermissionAspect} 拦截并校验当前用户是否拥有对应权限。
 *
 * <pre>
 * &#64;RequirePermission(resource = "daily_report", action = "submit")
 * public ApiResponse&lt;Void&gt; submit(...) { ... }
 * </pre>
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RequirePermission {

    /** 受保护资源标识，如 daily_report / project / user */
    String resource();

    /** 操作类型：create / read / update / delete / manage */
    String action();

    /**
     * 是否从请求参数提取 projectId 做项目级校验。
     * <p>true（默认）：从方法名为 projectId 的参数中提取，校验用户在该项目的角色权限。
     * false：仅做全局权限校验（如 user 模块不区分项目）。
     */
    boolean projectId() default true;
}
