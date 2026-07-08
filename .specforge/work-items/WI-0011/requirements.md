---
requirements_format: ears
bugfix_format: v1
---

# Bugfix: 登录系统完全不可用

**Work Item**: WI-0011
**缺陷等级**: P0（阻断性，所有用户无法登录）
**分析模式**: 静态代码分析（Bugfix Spec 工作流，不运行测试/不安装包）
**分析方法**: superpowers-systematic-debugging（复现→收集证据→形成假设→验证假设→确认根因）

---

## 简介

fj1 飞检现场管理系统上线后，登录端点 `POST /api/v1/auth/login` 完全不可用。所有用户（包括默认管理员 admin/admin123）调用登录接口均返回 HTTP 401，响应头携带 `WWW-Authenticate: Basic realm="Realm"`，响应体为空。请求从未到达业务代码（AuthService），应用启动日志反复出现 `Using generated security password`。

本 bugfix.md 基于静态代码分析定位根因，区分主因与次因，明确验收标准与不可破坏的不变行为。

---

## 术语表

| 术语 | 定义 |
|------|------|
| Spring Security AutoConfiguration | Spring Boot 检测到 classpath 存在 spring-boot-starter-security 且无自定义 SecurityFilterChain 时，自动应用默认安全策略（所有端点需 Basic Auth，自动生成名为 user 的账号） |
| SecurityFilterChain | Spring Security 5.7+/6.x 中定义安全规则的核心 Bean，替代废弃的 WebSecurityConfigurerAdapter。声明哪些路径放行、哪些需要认证、使用哪些过滤器 |
| Basic Auth | HTTP 基本认证，通过 `Authorization: Basic base64(user:pass)` 头传递凭证。Spring Security 默认策略会返回 401 + `WWW-Authenticate: Basic` 挑战头 |
| OncePerRequestFilter | Spring Web 提供的 Servlet Filter 基类，在 DispatcherServlet 之外执行。与 Spring Security 的 Filter 链是两条独立的链 |
| BCrypt 版本前缀 | BCrypt 哈希字符串的前缀标识：`$2a$`（原始版本）、`$2y$`（PHP crypt 修正版）、`$2b$`（OpenBSD 修正版），三者算法等价，前缀仅标识生成实现 |
| context-path | Servlet 容器的应用上下文路径前缀。本项目配置为 `/api`，所有 Controller 路径在此基础上叠加 |

---

## 当前行为（Current Behavior）

### CB-1：登录请求返回 HTTP 401 + Basic Auth 挑战

```
curl -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'

# 响应：
# HTTP/1.1 401 Unauthorized
# WWW-Authenticate: Basic realm="Realm"
# Content-Length: 0
# （响应体为空）
```

- 所有账号密码组合均返回 401，无差别
- 响应头 `WWW-Authenticate: Basic realm="Realm"` 是 **Spring Security 默认配置的标志性行为**
- 响应体为空（Content-Length: 0），说明请求被 Security 过滤链拦截，**未进入 Controller**

### CB-2：业务日志完全缺失

- 应用日志中**无任何 AuthService 输出**（无 "登录成功"、"登录失败（账号不存在）"、"登录失败（密码错误）" 日志）
- 说明请求在到达 `AuthController.login()` 之前就已被拦截返回

### CB-3：启动日志出现默认安全密码

- 每次重启应用，日志中出现：
  ```
  Using generated security password: <随机UUID>
  ```
- 这是 Spring Boot AutoConfiguration 检测到 classpath 有 spring-boot-starter-security 但无自定义配置时，**自动创建默认 user 账号**的行为
- UUID 每次重启都变，证明每次启动都重新生成默认配置

### CB-4：生产数据库已紧急修复（但源码未修）

- 生产 `users.password_hash` 已从 `$2b$12$jcLWioY...` 紧急更新为 `$2a$12$slq9M/Yk...`
- **此修改仅限生产数据库行级数据，源码 V2__seed_data.sql 仍是 `$2b$`**
- 新环境部署会重现种子数据问题

---

## 预期行为（Expected Behavior）

### EB-1：登录成功

- 使用 admin/admin123 调用登录端点，应返回 HTTP 200 + JWT 令牌对（access_token + refresh_token）
- AuthService.login() 正常执行：限流检查 → 查询用户 → 密码校验 → 签发令牌
- 应用日志出现 "登录成功: userId=?, username=admin"

### EB-2：登录端点免认证

- `POST /api/v1/auth/login` 和 `POST /api/v1/auth/refresh` 端点本身不需要任何认证即可访问
- 这两个端点应被 Security 规则显式 `permitAll()` 放行

### EB-3：非登录端点的认证由 JwtAuthFilter 处理

- 其他业务端点（如 `/api/v1/users/**`）需要有效的 Bearer JWT
- 未认证请求应返回 401（由应用自定义的 ApiResponse 错误格式，而非 Spring Security 的 Basic Auth 挑战）
- JwtAuthFilter 应正确解析 Bearer 令牌并设置 SecurityContextHolder

### EB-4：启动日志清洁

- 启动日志不再出现 `Using generated security password` 警告
- 证明 Security 已被自定义配置接管

---

## 不变行为（Invariant Behavior）

> 以下行为在修复缺陷的过程中**绝对不能被破坏**，修复方案必须保持这些行为不变。

### INV-1：JWT 签发与校验逻辑不变

- `JwtTokenProvider.generateTokenPair()` 的签名算法（HS256）、密钥来源（`fj.security.jwt.secret`）、有效期（access 30min / refresh 7d）保持不变
- `JwtTokenProvider.isValid()` / `parse()` / `getJti()` 等校验逻辑不变
- **证据**：`JwtTokenProvider` 实现本次不修改，Security 配置修复不应触碰 JWT 核心逻辑

### INV-2：令牌黑名单（TokenBlacklistService）机制不变

- 登出时 access_token 加入黑名单的逻辑不变
- refresh 时检查 jti 是否已撤销的逻辑不变
- 黑名单存储方式（Caffeine 缓存）不变

### INV-3：登录限流（RateLimiter）逻辑不变

- 基于 clientIp 的限流策略不变（锁定阈值、锁定时长）
- 登录失败不区分"用户不存在"与"密码错误"（防信息泄露，REQ-1.2 安全要求）不变
- **证据**：`AuthService.login()` 第 51-77 行的限流与防泄露逻辑必须完整保留

### INV-4：CORS 配置不变

- `CorsConfig` 允许的前端来源、方法、头、凭证策略保持不变
- **注意**：修复 Security 时，CORS 必须在 Security 之前处理（`corsConfigurationSource` 需注入 HttpSecurity），否则预检请求会被 Security 拦截

### INV-5：项目级数据隔离（ProjectAccessFilter）不变

- `ProjectAccessFilter` 的 projectId 提取与权限校验逻辑不变
- 越权访问返回 403 JSON `{"code":2003,"message":"无该项目访问权限"}` 的行为不变

### INV-6：BCrypt cost 因子不变

- 密码哈希始终使用 BCrypt cost=12（`AuthService.BCRYPT_COST`、`UserService.BCRYPT_COST`）
- 修复不应改变密码编码器的强度参数

---

## 根因分析（Root Cause Analysis）

### 证据收集清单

| 编号 | 证据 | 来源 | 验证方法 |
|------|------|------|----------|
| E1 | fj-auth/pom.xml 引入 spring-boot-starter-security | 第 26-30 行 | read 工具直接读取 |
| E2 | fj-system/pom.xml 引入 spring-boot-starter-security | 第 22-26 行 | read 工具直接读取 |
| E3 | 全局搜索 SecurityFilterChain/EnableWebSecurity/HttpSecurity/WebSecurityConfigurerAdapter = **0 匹配** | fj-backend/**/*.java | grep 工具全量搜索 |
| E4 | 全局搜索 antMatchers/requestMatchers/permitAll/authorizeRequests/authorizeHttpRequests = **0 匹配** | fj-backend/**/*.java | grep 工具全量搜索 |
| E5 | application.yml 中无 spring.security 配置段 = **0 匹配** | fj-backend/**/*.yml | grep 工具全量搜索 |
| E6 | V2__seed_data.sql admin 密码哈希为 `$2b$12$...` | 第 102 行 | read 工具直接读取 |
| E7 | AuthService 使用 `new BCryptPasswordEncoder(12)` 直接实例化（未作为 Bean 注册） | 第 41 行 | read 工具直接读取 |
| E8 | JwtAuthFilter 是 `@Component` + `OncePerRequestFilter`（Servlet Filter，非 Security Filter） | 第 25-29 行 | read 工具直接读取 |
| E9 | context-path = `/api`，AuthController `@RequestMapping("/api/v1/auth")` | application.yml 第 7 行 / AuthController 第 27 行 | read 工具直接读取 |
| E10 | 现有 config 目录仅 CorsConfig.java + WebMvcConfig.java（无 SecurityConfig） | fj-api/config/ 目录列举 | read 目录 |

### 假设与验证

#### 假设 H1（主因）：缺少 Spring Security 配置类，AutoConfiguration 默认拦截所有端点

**假设陈述**：
项目 classpath 包含 spring-boot-starter-security（证据 E1、E2），但源码中不存在任何 SecurityFilterChain Bean（证据 E3）、不存在任何 @EnableWebSecurity 注解（证据 E3）、不存在任何 HttpSecurity 配置（证据 E3）、不存在任何路径放行规则（证据 E4）、application.yml 中无 spring.security 配置（证据 E5）。Spring Boot AutoConfiguration 接管，应用默认安全策略：所有端点需要 HTTP Basic 认证，自动生成名为 user 的默认账号。

**证据支持**：
- E3 + E4 + E5 → 证实零 Security 配置
- CB-1 的 `WWW-Authenticate: Basic realm="Realm"` → 证实 Spring Security 默认 Basic Auth 策略生效
- CB-3 的 `Using generated security password` → 证实 AutoConfiguration 自动创建默认 user 账号
- CB-2 的 AuthService 日志缺失 → 证实请求被 Security 在 Controller 之前拦截

**验证结论**：✅ **假设成立，确认为主因（致命根因）**

#### 假设 H2（次因）：BCrypt 哈希前缀兼容性风险

**假设陈述**：
种子数据 V2__seed_data.sql 中 admin 的 password_hash 使用 `$2b$12$...` 前缀（证据 E6），可能不被 Spring BCryptPasswordEncoder 识别。

**证据分析**：
- `$2b$` 是 OpenBSD 对 BCrypt 的修正版本标识，与 `$2a$` 算法等价
- Spring Security 5.x+/6.x 的 `BCryptPasswordEncoder` 内部 `BCRYPT_PATTERN` 正则为 `\A\$2(a|y|b)?\$\d\d\$.*`，**理论上支持 `$2b$`**
- 但 intake.md 记录生产环境密码验证确实失败，紧急修复为 `$2a$` 后才成功
- 失败的真实原因无法仅凭静态分析确定，可能因素包括：
  - (a) Spring Boot 3.2.5 对应的 Spring Security 6.2.x 具体版本对 `$2b$` 的处理差异
  - (b) 哈希值在 shell 转义/数据导入过程中损坏
  - (c) 哈希值本身可能不是 admin123 的有效哈希

**验证结论**：⚠️ **假设部分成立，确认为次因（需运行时验证）**
- 静态分析无法 100% 确认 `$2b$` 是否在当前 Spring Boot 3.2.5 环境下兼容
- **无论兼容与否，都应统一为 `$2a$`** 以消除歧义、确保跨语言/跨库兼容、保证确定性
- 修复时需确保种子数据中的哈希值确实是 admin123 的有效 BCrypt(cost=12) 哈希

### 根因链（结构化）

```
[主因·致命] 缺少 Spring Security 配置类 (RC-1)
    │
    ├─ 触发条件：classpath 有 spring-boot-starter-security (E1, E2)
    │            + 零自定义 SecurityFilterChain (E3, E4, E5)
    │
    ├─ 后果链：Spring Boot AutoConfiguration 启用默认安全策略
    │          → 所有端点需 Basic Auth
    │          → 自动生成默认 user 账号 (CB-3)
    │          → 请求到达 Controller 前被 AuthorizationFilter 拦截
    │          → 返回 401 + WWW-Authenticate: Basic (CB-1)
    │          → AuthService 从未执行 (CB-2)
    │
    └─ 影响范围：所有端点（不仅是登录），所有用户
                  → P0 级阻断，系统完全不可用

[次因·潜在] BCrypt 哈希前缀兼容性风险 (RC-2)
    │
    ├─ 触发条件：种子数据使用 $2b$12$ 前缀 (E6)
    │            + AuthService.matches() 可能不识别 $2b$
    │
    ├─ 后果链：即使 RC-1 修复、Security 放行登录端点
    │          → AuthService.login() 执行到 passwordEncoder.matches()
    │          → 若 $2b$ 不兼容 → matches() 返回 false
    │          → 抛出 AUTH_LOGIN_FAILED → 登录仍然失败
    │
    └─ 影响范围：仅当 RC-1 修复后才会显现
                  → 新环境部署必现（生产数据库已紧急修复，但源码未改）

[关联因素·非根因] JwtAuthFilter 不在 Security 过滤链中 (RC-3)
    │
    ├─ 现状：JwtAuthFilter 是 @Component + OncePerRequestFilter (E8)
    │        作为普通 Servlet Filter 在 DispatcherServlet 外执行
    │        不在 Spring Security 的 FilterChainProxy 中
    │
    ├─ 当前影响：无（因为 Security 默认拦截在 JwtAuthFilter 之前/之后起决定作用）
    │
    └─ 修复关联：修复 RC-1 时必须决策 JwtAuthFilter 的定位
                  → 选项 A：保持独立 Filter，Security 配置 permitAll 全放行
                  → 选项 B：将 JwtAuthFilter 注册到 Security 链中
                  → 无论哪种，Security 规则必须与 JwtAuthFilter 的放行逻辑协调一致
```

### 根因确认总结

| 编号 | 根因 | 类型 | 确信度 | 修复优先级 |
|------|------|------|--------|------------|
| RC-1 | 缺少 Spring Security 配置类 | 主因（致命） | 高（证据充分） | **P0·必修** |
| RC-2 | BCrypt 哈希前缀 `$2b$` 兼容性风险 | 次因（潜在） | 中（需运行时验证） | **P1·必修（确保确定性）** |
| RC-3 | JwtAuthFilter 架构定位需协调 | 关联因素 | 高（事实陈述） | 修复 RC-1 时一并解决 |

---

## 验收标准（Acceptance Criteria）

### AC-1：admin/admin123 登录成功返回 200 + JWT 令牌对

**用户故事**：作为系统管理员，我希望使用默认账号 admin/admin123 登录系统，以便验证登录功能已恢复。

1. [Event-driven] WHEN 客户端以 `{"username":"admin","password":"admin123"}` 调用 `POST /api/v1/auth/login`，THEN THE 系统 SHALL 返回 HTTP 200，响应体包含有效的 `accessToken`（JWT，有效期 30 分钟）和 `refreshToken`（JWT，有效期 7 天）。
2. [Event-driven] WHEN 登录成功后，THEN THE 系统 SHALL 在应用日志中输出 `登录成功: userId=?, username=admin`。
3. [Unwanted-behavior] IF 用户名或密码错误，THEN THE 系统 SHALL 返回业务错误（HTTP 200 + ApiResponse 错误码，或约定的 4xx），**而非** Spring Security 的 401 Basic Auth 挑战。

### AC-2：启动日志不再出现 generated security password 警告

**用户故事**：作为运维工程师，我希望应用启动日志中不再出现默认安全密码警告，以便确认 Security 已被自定义配置接管。

1. [Ubiquitous] THE 系统 SHALL 在启动日志中不再输出 `Using generated security password`。
2. [Ubiquitous] THE 系统 SHALL 通过显式的 SecurityFilterChain Bean 接管安全配置，而非依赖 AutoConfiguration 默认策略。

### AC-3：未认证请求访问受保护端点返回应用级 401（非 Basic Auth 拦截）

**用户故事**：作为 API 调用方，我希望未认证请求访问受保护端点时获得结构化的错误响应，以便程序化处理认证失败。

1. [Unwanted-behavior] IF 未携带 Bearer 令牌的请求访问受保护业务端点（如 `/api/v1/users`），THEN THE 系统 SHALL 返回 401，且响应为应用自定义的 JSON 格式（ApiResponse），**而非** Spring Security 默认的空响应体 + `WWW-Authenticate: Basic` 头。
2. [Ubiquitous] THE 系统 SHALL NOT 对任何业务端点返回 `WWW-Authenticate: Basic realm="Realm"` 响应头。

### AC-4：登录端点本身免认证可访问

**用户故事**：作为未登录用户，我希望登录端点不需要认证即可访问，以便首次登录获取令牌。

1. [Ubiquitous] THE 系统 SHALL 对 `POST /api/v1/auth/login` 和 `POST /api/v1/auth/refresh` 端点应用 `permitAll()` 规则，允许未认证请求访问。
2. [State-driven] WHILE Security 过滤链处理请求时，THE 系统 SHALL 在到达认证检查之前放行 `/api/v1/auth/login` 和 `/api/v1/auth/refresh` 路径。

### AC-5：种子数据 BCrypt 哈希统一为 $2a$ 前缀

**用户故事**：作为新环境部署者，我希望种子数据使用标准 `$2a$` BCrypt 前缀，以便确保跨环境、跨库的密码验证确定性。

1. [Ubiquitous] THE 系统 SHALL 在 `V2__seed_data.sql` 中使用 `$2a$12$` 前缀的 BCrypt 哈希存储 admin 密码。
2. [Ubiquitous] THE 种子数据中的 admin 密码哈希 SHALL 确实是明文 `admin123` 的有效 BCrypt(cost=12) 哈希，使得 `new BCryptPasswordEncoder(12).matches("admin123", hash)` 返回 true。
3. [Optional-feature] WHERE 新环境通过 Flyway 迁移初始化数据库，THE 系统 SHALL 允许 admin/admin123 首次登录成功，无需手动修改数据库。

---

## 修复约束与额外发现风险

### 修复约束（对 sf-design / sf-task-planner 的输入）

1. **必须新增 Spring Security 配置类**：定义 SecurityFilterChain Bean，至少包含：
   - `/api/v1/auth/login`、`/api/v1/auth/refresh` → `permitAll()`
   - 其余业务端点 → 需认证
   - CORS 配置集成（`corsConfigurationSource`）
   - 禁用 CSRF（REST API 场景）
   - 禁用默认 Basic Auth 表单登录
   - 无状态会话（SessionCreationPolicy.STATELESS）

2. **必须协调 JwtAuthFilter 定位**：决策 JwtAuthFilter 是保持独立 Servlet Filter（配合 Security permitAll 全放行 + JwtAuthFilter 自行校验），还是注册到 Security Filter 链中。两种方案需择一并保持一致性。

3. **必须修正种子数据**：V2__seed_data.sql 中 admin 密码哈希改为 `$2a$12$` 前缀的有效哈希。

### 额外发现风险（Out-of-scope Observations）

> 以下问题在本次分析中发现，但**不在本次 bugfix 修复范围内**（除非影响 AC 达成），记录供后续 Work Item 处理。

#### 风险 R1：context-path 与 Controller 路径前缀重复（中风险）

- **现象**：`server.servlet.context-path: /api`（application.yml 第 7 行）+ AuthController `@RequestMapping("/api/v1/auth")` → 完整 URL 为 `/api/api/v1/auth/login`
- **影响**：
  - 前端若调用 `/api/v1/auth/login`（不含 context-path），实际匹配的 servlet path 是 `/v1/auth/login`，无 Controller 映射 → 404
  - 前端若调用 `/api/api/v1/auth/login`，才匹配 AuthController
  - 这可能导致前端与后端的路径约定不一致
- **建议**：后续统一路径规范，要么去掉 context-path，要么去掉 Controller 中的 `/api` 前缀
- **本 bugfix 不强制修复**，但 AC 验证时需明确测试 URL 的完整路径

#### 风险 R2：JwtAuthFilter.shouldNotFilter 路径与 context-path 不匹配（低风险）

- **现象**：JwtAuthFilter.shouldNotFilter 检查 `path.startsWith("/api/v1/auth/login")`（第 75 行），但 `request.getRequestURI()` 在 context-path `/api` 下返回的是 `/api/api/v1/auth/login`
- **影响**：
  - `"/api/api/v1/auth/login".startsWith("/api/v1/auth/login")` → **false**
  - shouldNotFilter 逻辑失效，JwtAuthFilter 会对登录请求执行 doFilterInternal
  - **实际影响较小**：登录请求无 Bearer 令牌，JwtAuthFilter 的逻辑是"无令牌则当匿名继续"（第 41 行 `StringUtils.hasText(token)` 为 false 时直接 chain.doFilter），不会阻止登录
- **建议**：修复时应一并修正 shouldNotFilter 的路径匹配逻辑，使用 context-path 无关的匹配方式（如 `request.getServletPath()`）
- **本 bugfix 建议一并修复**，避免语义混淆

#### 风险 R3：PasswordEncoder 未注册为 Spring Bean（低风险）

- **现象**：AuthService 第 41 行和 UserService 第 36 行各自 `new BCryptPasswordEncoder(12)` 直接实例化，而非注册为 Bean 注入
- **影响**：
  - 多处重复实例化，配置分散
  - 若未来需要调整 cost 因子或切换编码器，需多处修改
- **建议**：后续重构时注册为 `@Bean PasswordEncoder`
- **本 bugfix 不强制修复**

#### 风险 R4：WebMvcConfig 为空壳（信息记录）

- **现象**：WebMvcConfig（第 14-17 行）仅有注释占位，无实际拦截器注册
- **影响**：当前鉴权完全依赖 Filter 链，未使用 WebMvc 拦截器
- **结论**：非缺陷，记录为架构现状

---

## 分析局限性声明

本次分析为**纯静态代码分析**（符合 Bugfix Spec 工作流的 Agent 边界约束），未执行以下操作：

- ❌ 未运行应用验证 HTTP 响应
- ❌ 未编写测试验证 BCrypt `$2b$` 兼容性
- ❌ 未安装任何依赖包
- ❌ 未执行任何 shell 命令修改运行时

因此，以下结论存在残余不确定性，需在修复阶段通过运行时验证消除：

1. **RC-2 的确信度为"中"**：`$2b$` 在 Spring Boot 3.2.5 / Spring Security 6.2.x 下是否实际兼容，需运行时确认。但无论结果如何，统一为 `$2a$` 的建议不变。
2. **风险 R1 的实际影响**：前端实际调用的 URL 格式需确认（取决于前端 baseURL 配置），本分析仅基于后端代码。
