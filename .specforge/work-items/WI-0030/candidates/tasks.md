# WI-0030 Tasks

## Task 1: 修正日志路径常量

**文件**: `fj-backend/fj-common/src/main/java/com/fj/common/applog/AppLogService.java`

**修改**: 第 19 行
```java
// 旧
private static final String LOG_DIR = "/opt/fj/api/logs/app-logs";
// 新
private static final String LOG_DIR = "/opt/fj1/api/logs/app-logs";
```

**verification_commands**:
- `grep "LOG_DIR" fj-backend/fj-common/src/main/java/com/fj/common/applog/AppLogService.java`（确认包含 `/opt/fj1/`）
- `cd fj-backend && JAVA_HOME=/usr/lib/jvm/java-17-openjdk mvn compile -q`（编译通过）

## Task 2: 编译并部署 jar

**操作**:
1. `mvn clean package -DskipTests -q -f fj-backend/pom.xml`
2. `scp fj-backend/fj-api/target/fj-api-1.0.0.jar lg:/opt/fj1/api/fj-api-1.0.0.jar.new`
3. `ssh lg "systemctl stop fj1-api && mv /opt/fj1/api/fj-api-1.0.0.jar.new /opt/fj1/api/fj-api-1.0.0.jar && chown fj1:fj1 /opt/fj1/api/fj-api-1.0.0.jar && systemctl start fj1-api"`
4. `ssh lg "mkdir -p /opt/fj1/api/logs/app-logs && chown fj1:fj1 /opt/fj1/api/logs/app-logs"`

**verification_commands**:
- `ssh lg "systemctl is-active fj1-api"`（返回 active）
- `curl -s -X POST http://129.211.5.240/api/v1/logs/batch -H "Content-Type: application/json" -d '{"entries":[{"timestamp":"2026-07-06T19:00:00Z","level":"INFO","module":"DEPLOY_TEST","message":"WI-0030 deploy verify"}]}'`（返回 `{"code":0,...}`）
- `ssh lg "cat /opt/fj1/api/logs/app-logs/app-2026-07-06.log"`（包含 DEPLOY_TEST 条目）