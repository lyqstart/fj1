# Impact Analysis: WI-0011

## 根因

### RC-1（主因，致命）：缺少 Spring Security 配置类
项目 classpath 包含 `spring-boot-starter-security`（fj-auth、fj-system 模块声明），但源码中无任何 `SecurityFilterChain` Bean 定义。Spring Boot AutoConfiguration 接管，使用默认安全策略：所有端点需 HTTP Basic Auth。

证据：
- 启动日志 `Using generated security password: <随机UUID>`（每次重启变化）
- 响应头 `WWW-Authenticate: Basic realm="Realm"`
- 响应体 Content-Length: 0（请求未到达 Controller）
- 全局搜索 `SecurityFilterChain`/`@EnableWebSecurity`/`HttpSecurity` = 0 匹配

### RC-2（次因）：BCrypt 哈希版本前缀
种子数据 V2__seed_data.sql 使用 `$2b$12$...`（Node.js bcrypt 变种）。虽然 Spring Security 6.x 理论支持 `$2b$`，但统一为 `$2a$` 可消除兼容性风险。

### RC-3（关联）：JwtAuthFilter 路径匹配
JwtAuthFilter.shouldNotFilter() 检查 `/api/v1/auth/login`，但 context-path=/api 导致 getRequestURI() 返回 `/api/api/v1/auth/login`，匹配失效。

## 修复影响评估

### 需修改的文件
| 文件 | 修改类型 | 说明 |
|------|----------|------|
| fj-api/.../config/SecurityConfig.java | 新建 | SecurityFilterChain Bean |
| fj-api/.../db/migration/V2__seed_data.sql | 修改 | $2b$ → $2a$ |
| fj-auth/.../jwt/JwtAuthFilter.java | 修改 | shouldNotFilter 路径修复 |

### 不受影响的文件
- AuthController.java（API 契约不变）
- AuthService.java（业务逻辑不变）
- JwtTokenProvider.java（令牌签发逻辑不变）
- 所有其他 Controller / Service / Repository

### 不变行为约束
- INV-1: JWT 令牌签发和校验逻辑不变
- INV-2: 登录限流逻辑（RateLimiter）不变
- INV-3: CORS 配置不变
- INV-4: 密码 BCrypt cost=12 不变
- INV-5: API 路径 /api/v1/auth/* 不变
- INV-6: 令牌黑名单（TokenBlacklistService）逻辑不变

## 验收标准
- AC-1: admin/admin123 登录返回 200 + JWT 令牌对
- AC-2: 启动日志不再出现 generated security password 警告
- AC-3: 未认证请求访问受保护端点返回应用级 401（非 Basic Auth）
- AC-4: 登录端点 /api/v1/auth/login 免认证可访问
- AC-5: 种子数据 V2__seed_data.sql 使用 $2a$ 哈希前缀