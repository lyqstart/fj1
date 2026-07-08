# Trace Delta: WI-0011

## 追溯矩阵（REQ → AC → DD → TASK → FILE → TEST）

| REQ | AC | Design Decision | Task | Target File | Verification |
|-----|-----|-----------------|------|-------------|--------------|
| BUG-1: Security 默认配置拦截登录 | AC-1: admin 登录返回 200+JWT | DD-1: SecurityConfig | TASK-1 | SecurityConfig.java (新建) | curl 登录测试 |
| BUG-1: Security 默认配置拦截登录 | AC-2: 无 generated password | DD-1: SecurityConfig | TASK-1 | SecurityConfig.java (新建) | 启动日志检查 |
| BUG-1: Security 默认配置拦截登录 | AC-3: 应用级 401 非 Basic | DD-1: httpBasic disable | TASK-1 | SecurityConfig.java (新建) | curl 无认证请求 |
| BUG-1: Security 默认配置拦截登录 | AC-4: 登录端点免认证 | DD-1: permitAll | TASK-1, TASK-3 | SecurityConfig.java, JwtAuthFilter.java | curl 登录 |
| BUG-2: BCrypt $2b$ 不兼容 | AC-5: 种子数据 $2a$ | DD-2: 哈希修复 | TASK-2 | V2__seed_data.sql | grep 验证 |

## 缺陷根因映射

| Root Cause | Severity | Fixed By Task |
|------------|----------|---------------|
| RC-1: 无 SecurityFilterChain Bean | Critical | TASK-1 |
| RC-2: BCrypt $2b$ 哈希 | Minor | TASK-2 |
| RC-3: JwtAuthFilter 路径失效 | Related | TASK-3 |

## 新增文件
- `fj-backend/fj-api/src/main/java/com/fj/api/config/SecurityConfig.java`（新建）

## 修改文件
- `fj-backend/fj-api/src/main/resources/db/migration/V2__seed_data.sql`
- `fj-backend/fj-auth/src/main/java/com/fj/auth/jwt/JwtAuthFilter.java`