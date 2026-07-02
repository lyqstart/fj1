package com.fj.api.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web MVC 配置。
 * <p>预留拦截器、参数解析器、消息转换器等扩展点。
 * 鉴权拦截器在 fj-auth 模块实现后在此注册。
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    // 后续阶段在此注册：
    // - JwtAuthInterceptor（认证拦截）
    // - PermissionInterceptor（权限拦截）
    // - PageRequestArgumentResolver（分页参数绑定）
}
