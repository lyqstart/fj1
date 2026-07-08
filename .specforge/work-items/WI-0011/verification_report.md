{
  "conclusion": "pass",
  "summary": "WI-0011 登录阻断 Bug 已修复。3 个根因（缺少 SecurityConfig、BCrypt $2b$ 哈希不兼容、context-path 双重 /api）全部修复。所有 5 条验收标准在 svr-lg 生产环境验证通过。admin/admin123 登录返回 200 + JWT，未认证请求返回 401 JSON，启动日志无 generated security password。",
  "acceptance_criteria": {
    "AC-1": {
      "status": "pass",
      "description": "admin/admin123 登录返回 200 + JWT 令牌对",
      "evidence": "curl POST http://127.0.0.1:8080/api/v1/auth/login 返回 HTTP 200 + {accessToken, refreshToken, user}",
      "also_tested": "nginx :80 端到端登录同样成功"
    },
    "AC-2": {
      "status": "pass",
      "description": "启动日志不再出现 generated security password",
      "evidence": "journalctl -u fj1-api | grep -c 'generated security password' = 0"
    },
    "AC-3": {
      "status": "pass",
      "description": "未认证请求返回应用级 401（非 Basic Auth 拦截）",
      "evidence": "curl GET /api/v1/users/me 返回 HTTP 401 + {\"code\":401,\"message\":\"Unauthorized\",\"data\":null,\"success\":false}（无 WWW-Authenticate: Basic 头）"
    },
    "AC-4": {
      "status": "pass",
      "description": "登录端点 /api/v1/auth/login 免认证可访问",
      "evidence": "AC-1 验证证明登录端点无需认证即可访问"
    },
    "AC-5": {
      "status": "pass",
      "description": "种子数据 V2__seed_data.sql 使用 $2a$ 哈希前缀",
      "evidence": "grep $2a$12$ = 1 match, grep $2b$ = 0 matches"
    }
  },
  "verification_commands": {
    "compile": "JAVA_HOME=/usr/lib/jvm/java-17-openjdk mvn clean package -pl fj-api -am -DskipTests -q → EXIT 0",
    "login_8080": "curl POST :8080/api/v1/auth/login → HTTP 200 + JWT",
    "login_nginx": "curl POST :80/api/v1/auth/login → HTTP 200 + JWT",
    "unauthenticated": "curl GET :8080/api/v1/users/me → HTTP 401 JSON",
    "startup_log": "journalctl grep 'generated security password' → 0 matches",
    "seed_data": "grep $2a$ in V2 → 1 match; grep $2b$ → 0 matches"
  },
  "root_causes_fixed": {
    "RC-1": "SecurityConfig.java created — SecurityFilterChain Bean with STATELESS session, permitAll for login/refresh, exceptionHandling returning 401 JSON",
    "RC-2": "V2__seed_data.sql $2b$ → $2a$ (Flyway checksum updated to 755432963)",
    "RC-3": "JwtAuthFilter shouldNotFilter: getRequestURI() → getServletPath()",
    "RC-4-discovered": "context-path: /api removed from application.yml and application-prod.yml (was causing double /api path conflict with Controller @RequestMapping)"
  },
  "files_modified": [
    "fj-backend/fj-api/src/main/java/com/fj/api/config/SecurityConfig.java (new)",
    "fj-backend/fj-api/src/main/resources/db/migration/V2__seed_data.sql",
    "fj-backend/fj-auth/src/main/java/com/fj/auth/jwt/JwtAuthFilter.java",
    "fj-backend/fj-api/src/main/resources/application.yml",
    "fj-backend/fj-api/src/main/resources/application-prod.yml"
  ],
  "production_deployment": {
    "jar_size": "81738031 bytes",
    "flyway_checksum_v2": "755432963 (updated from -2013682703)",
    "database_hash_prefix": "$2a$12$ (updated from $2b$12$)",
    "external_config_context_path": "removed (source code also removed)",
    "service_status": "active",
    "backup": "/opt/fj1/api/fj-api-1.0.0.jar.bak.WI0011"
  },
  "side_effects": "None. JPA/Flyway/JWT/RateLimiter/CORS all verified working. No data loss, no schema changes."
}