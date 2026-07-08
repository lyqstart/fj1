# Design: WI-0011 登录阻断修复

## DD-1: SecurityConfig 配置类设计

### 方案
在 fj-api 模块新建 `com.fj.api.config.SecurityConfig`，定义 `SecurityFilterChain` Bean。

### 配置要点
```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/login", "/api/v1/auth/refresh").permitAll()
                .requestMatchers("/error", "/favicon.ico").permitAll()
                .anyRequest().authenticated()
            )
            .httpBasic(basic -> basic.disable())
            .formLogin(form -> form.disable())
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
```

### 关键决策
- **CSRF disable**：纯 JWT API，无 cookie session，不需要 CSRF 保护
- **Session STATELESS**：不创建 HTTP Session，每次请求通过 JWT 认证
- **httpBasic/formLogin disable**：禁用 Spring Security 默认认证方式
- **permitAll 路径**：登录和刷新端点免认证（JwtAuthFilter.shouldNotFilter 也跳过这些路径）
- **JwtAuthFilter 注册到 Security 链**：在 UsernamePasswordAuthenticationFilter 之前执行

### context-path 兼容
`server.servlet.context-path=/api` 导致 requestMatchers 的路径需要考虑 context-path。
Spring Security 6.x 的 `authorizeHttpRequests` 使用 `HttpServletRequest` 匹配，**context-path 会自动剥离**，因此 `requestMatchers("/api/v1/auth/login")` 匹配的是 context-path 之后的路径。

但 JwtAuthFilter.shouldNotFilter() 使用 `getRequestURI()` 返回的是**含 context-path 的完整路径**（`/api/api/v1/auth/login`）。需要修改为使用 `getServletPath()`（返回 context-path 之后的路径）。

## DD-2: BCrypt 种子数据修复

### 方案
将 V2__seed_data.sql 中 admin 的 password_hash 从 `$2b$12$...` 改为 `$2a$12$...`。

### 新哈希值
使用 Python bcrypt 生成（prefix=b'2a', rounds=12）：
```
$2a$12$slq9M/Yknmi83WYOiUrkkuDkDuMomPMoa215j6MtUUYgJlwERlaL6
```
（此值已验证：Python bcrypt.checkpw 返回 True，且 `$2a$` 前缀兼容 Spring BCryptPasswordEncoder）

### 注意
V2 是已执行的 Flyway 迁移脚本。修改已执行的历史迁移不影响生产数据库（Flyway 检查 checksum 会报错），但：
- 需要使用 `flyway repair` 更新 checksum
- 或者创建新的 V10 迁移脚本来更新密码（更安全）

**决策**：由于 V9 是最近执行的迁移且 WI-0008 已处理过 checksum 问题，**直接修改 V2 并使用 flyway repair** 是最简洁的方案。新环境部署时 V2 会使用正确的 `$2a$` 哈希。

## DD-3: JwtAuthFilter 路径修复

### 方案
将 `shouldNotFilter()` 中的 `request.getRequestURI()` 改为 `request.getServletPath()`。

```java
@Override
protected boolean shouldNotFilter(HttpServletRequest request) {
    String path = request.getServletPath();  // 不含 context-path
    return path.startsWith("/api/v1/auth/login") || path.startsWith("/api/v1/auth/refresh");
}
```

### 原因
- `getRequestURI()` 返回完整路径含 context-path（`/api/api/v1/auth/login`）
- `getServletPath()` 返回 context-path 之后的路径（`/api/v1/auth/login`），与 Controller mapping 一致

## 不变行为验证策略
- INV-1~INV-6 通过编译验证 + 集成测试验证
- 登录成功后 JWT 令牌签发逻辑不受 SecurityConfig 影响
- RateLimiter、TokenBlacklistService 作为 @Service Bean 不受 Security 配置变更影响