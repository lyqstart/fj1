# Intake: 登录系统完全不可用

## 缺陷标题
新系统 fj1 的登录端点被 Spring Security 默认配置拦截，所有用户（包括 admin/admin123）均无法登录。

## 报告人
用户（生产环境实测）

## 报告时间
2026-07-05 00:27 CST

## 环境
- 生产服务器：svr-lg (10.0.12.12)
- 应用：fj1-api.service（Spring Boot 3.2.5，JDK17）
- 数据库：PostgreSQL fj1_inspect @ 127.0.0.1:5432
- 访问入口：nginx :80 → 127.0.0.1:8080（context-path=/api）

## 当前行为（缺陷现象）
1. 使用任何账号密码（包括默认 admin/admin123）调用登录接口，均返回 HTTP 401
2. 响应头包含 `WWW-Authenticate: Basic realm="Realm"`
3. 响应体为空（Content-Length: 0）
4. 应用日志中无 AuthService 输出（请求根本没到达业务代码）
5. 启动日志反复出现：`Using generated security password: <随机UUID>`（每次重启都变）

## 预期行为
1. 使用 admin/admin123 调用 `POST /api/v1/auth/login` 应返回 200 + JWT 令牌对
2. AuthService.login() 正常执行密码校验和令牌签发
3. 启动日志中不应出现 generated security password 警告

## 复现步骤
```
curl -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'
# 实际返回：HTTP 401，空响应体
```

## 初步根因线索（待 requirements 阶段确认）

### 线索 1（致命）：缺少 Spring Security 配置类
- 项目 pom.xml 引入了 `spring-boot-starter-security`（fj-auth、fj-system 模块）
- 但源码中**无任何 SecurityFilterChain Bean 定义**（全局搜索 `SecurityFilterChain`/`@EnableWebSecurity`/`HttpSecurity` 均无结果）
- Spring Boot 自动配置接管，使用默认安全策略：所有端点都需要 HTTP Basic 认证
- 自定义的 JwtAuthFilter 虽然有 @Component 注解，但作为通用 Servlet Filter 执行，**不在 Spring Security 过滤链中**，无法设置 Authentication
- 导致：请求在到达 AuthController 之前就被 Spring Security 的 AuthorizationFilter 拦截返回 401

### 线索 2（次要）：BCrypt 哈希版本不兼容
- 种子数据 V2__seed_data.sql 中 admin 的 password_hash 使用 `$2b$12$...` 前缀（Node.js bcrypt 变种）
- Spring 的 BCryptPasswordEncoder 内部正则 `\$2(a|y)?\$` 只认 `$2a$` 和 `$2y$`，**不认 `$2b$`**
- 即使 Security 放行，matches() 也会因版本前缀不匹配而直接返回 false（不执行实际比对）
- 生产数据库已被紧急修复为 `$2a$12$...`（shell 转义导致第一次更新失败，第二次通过 SQL 文件成功）
- 但源码种子数据 V2__seed_data.sql 仍是 `$2b$`，新环境部署会重现此问题

## 紧急处置（已执行，仅限生产数据库）
- 将生产 users.password_hash 从 `$2b$12$jcLWioY...` 更新为 `$2a$12$slq9M/Yk...`（admin123 的 BCrypt 哈希）
- **此修改仅限生产数据库行级数据，不影响源码**

## 影响范围
- **所有用户无法登录系统**（P0 级阻断）
- 这是 fj1 系统上线后的首个阻断性缺陷
- WI-0001~0010 的所有部署工作均因此 Bug 无法被实际使用（虽然服务进程正常运行）

## 相关文件
- `fj-backend/fj-auth/pom.xml` — spring-boot-starter-security 依赖声明
- `fj-backend/fj-system/pom.xml` — spring-boot-starter-security 依赖声明
- `fj-backend/fj-auth/src/main/java/com/fj/auth/controller/AuthController.java` — 登录端点
- `fj-backend/fj-auth/src/main/java/com/fj/auth/service/AuthService.java` — 登录业务逻辑
- `fj-backend/fj-auth/src/main/java/com/fj/auth/jwt/JwtAuthFilter.java` — JWT 过滤器（未被 Security 链识别）
- `fj-backend/fj-api/src/main/java/com/fj/api/config/` — 现有配置目录（仅有 CorsConfig、WebMvcConfig）
- `fj-backend/fj-api/src/main/resources/db/migration/V2__seed_data.sql` — 种子数据（含 $2b$ 哈希）
- `fj-backend/fj-api/src/main/resources/application-prod.yml` — 生产配置（context-path: /api）
