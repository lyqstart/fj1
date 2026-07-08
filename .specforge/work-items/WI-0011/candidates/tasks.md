# Tasks: WI-0011 登录阻断修复

## TASK-1: 创建 SecurityConfig 配置类
- **描述**: 在 fj-api 模块新建 SecurityConfig.java，定义 SecurityFilterChain Bean
- **修改文件**: `fj-backend/fj-api/src/main/java/com/fj/api/config/SecurityConfig.java`（新建）
- **依赖**: 无
- **验证命令**: `cd fj-backend && JAVA_HOME=/usr/lib/jvm/java-17-openjdk ./mvnw compile -pl fj-api -am`
- **验收标准**: AC-2（启动日志无 generated security password）, AC-3（非 Basic Auth 拦截）, AC-4（登录端点免认证）

## TASK-2: 修复 BCrypt 种子数据哈希前缀
- **描述**: 将 V2__seed_data.sql 中 admin 的 password_hash 从 $2b$ 改为 $2a$
- **修改文件**: `fj-backend/fj-api/src/main/resources/db/migration/V2__seed_data.sql`
- **依赖**: 无
- **验证命令**: `grep 'password_hash' fj-backend/fj-api/src/main/resources/db/migration/V2__seed_data.sql`
- **验收标准**: AC-5（种子数据使用 $2a$ 哈希）

## TASK-3: 修复 JwtAuthFilter shouldNotFilter 路径匹配
- **描述**: 将 getRequestURI() 改为 getServletPath()，修复 context-path 下的路径匹配
- **修改文件**: `fj-backend/fj-auth/src/main/java/com/fj/auth/jwt/JwtAuthFilter.java`
- **依赖**: 无
- **验证命令**: `cd fj-backend && JAVA_HOME=/usr/lib/jvm/java-17-openjdk ./mvnw compile -pl fj-auth -am`
- **验收标准**: AC-4（登录端点免认证可访问）

## TASK-4: 构建部署验证
- **描述**: 重新构建完整 jar，部署到 svr-lg，运行登录测试
- **修改文件**: 无（部署操作）
- **依赖**: TASK-1, TASK-2, TASK-3
- **验证命令**: `curl -X POST http://127.0.0.1:8080/api/v1/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}'`
- **验收标准**: AC-1（admin/admin123 登录返回 200 + JWT）