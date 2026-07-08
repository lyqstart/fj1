# Impact Analysis — WI-0008

## 影响范围总览

| 维度 | 影响 |
|------|------|
| 构建机（本地） | 安装 maven 包，生成 target/ 产物 |
| svr-lg（生产） | jar 替换，服务重启，DB 迁移 |
| API 可用性 | 停机 1-2 分钟（重启期间） |
| 数据库 | V9 迁移（CHECK 扩展 + VARCHAR 扩展） |
| 前端 | 重启期间 nginx 502 |
| 数据 | 无影响（业务表为空，DDL 宽松化） |

---

## 构建环境现状

| 项 | 本地 | svr-lg |
|----|------|--------|
| OS | CentOS 8 | CentOS 8 |
| java | JDK 8 (默认) + JDK 17 (已装) | JRE 17 |
| javac | 17.0.19 ✅ | ❌ |
| maven | ❌ 缺失 | ❌ |
| JAVA_HOME | 未设 | 未设 |

**JDK17 路径：** `/usr/lib/jvm/java-17-openjdk`（确认存在）
**maven 可用包：** `dnf install maven` → 3.5.4（appstream）

---

## 操作步骤详细影响

### 步骤 1：安装 maven
- **命令：** `dnf install -y maven`
- **影响：** 安装 maven 3.5.4 + 依赖（约 30MB）
- **风险：** 低（标准系统包）
- **回滚：** `dnf remove maven`（无需，不影响生产）

### 步骤 2：构建 jar
- **命令：** `JAVA_HOME=/usr/lib/jvm/java-17-openjdk mvn clean package -DskipTests -pl fj-api -am`
- **影响：** 下载依赖（首次约 200-500MB 到 ~/.m2），编译全部模块，生成 fj-api/target/fj-api-1.0.0.jar
- **预计耗时：** 5-15 分钟（首次，含依赖下载）
- **风险：** 低（仅本地 target/）
- **回滚：** 删除 target/，不部署

### 步骤 3：验证 jar 内容（构建后检查）
- **命令：** `unzip -l fj-api/target/fj-api-1.0.0.jar | grep V9` + `unzip -p ... fj-sync.jar | strings | grep RECEIVED`
- **影响：** 无（只读检查）
- **风险：** 无
- **判断点：** 如果 jar 不含 V9 或 class 不含 RECEIVED → 构建失败，停止

### 步骤 4：传输 jar 到 svr-lg
- **命令：** `scp fj-api/target/fj-api-1.0.0.jar lg:/tmp/fj-api-1.0.0.jar.WI0008`
- **影响：** 传输 78MB 到 svr-lg /tmp
- **风险：** 无（临时文件）

### 步骤 5：备份 + 替换 jar（requires_user_confirmation）
- **命令序列：**
  ```bash
  ssh lg "cp /opt/fj1/api/fj-api-1.0.0.jar /opt/fj1/api/fj-api-1.0.0.jar.bak.WI0008"
  ssh lg "mv /tmp/fj-api-1.0.0.jar.WI0008 /opt/fj1/api/fj-api-1.0.0.jar"
  ssh lg "chown fj1:fj1 /opt/fj1/api/fj-api-1.0.0.jar"
  ```
- **影响：** 覆盖生产 jar（已备份）
- **风险：** 中（文件替换，但服务仍运行旧 jar 直到重启）
- **回滚：** `mv .bak.WI0008 fj-api-1.0.0.jar`

### 步骤 6：重启服务（requires_user_confirmation，破坏性）
- **命令：** `ssh lg "systemctl restart fj1-api"`
- **影响：** API 停机，JVM 重启，Spring Boot 初始化，Flyway 执行 V9
- **预计停机：** 1-2 分钟
- **风险：** 高（生产服务中断）
- **回滚触发：** 90 秒未 active / health 非 UP / Flyway 失败

### 步骤 7：验证部署
- **检查项：**
  - systemctl status fj1-api → active running
  - journalctl 启动日志无 ERROR
  - Flyway V9 执行成功（flyway_schema_history）
  - project_issues CHECK 8 值
  - standard_library_version VARCHAR(64)

---

## 关键依赖检查

### ✅ 已确认
- JDK17 路径存在：`/usr/lib/jvm/java-17-openjdk`
- maven 可通过 dnf 安装
- svr-lg 磁盘充足（23G 可用）
- svr-lg 现有备份目录和命名约定
- 业务表为空（迁移零数据风险）

### ⚠️ 需注意
- 首次构建需下载依赖，网络不稳定可能失败（重试即可）
- maven 3.5.4 较旧，但 Spring Boot 3.x 兼容（需验证）
- fj-api pom 可能指定特定 maven 版本（构建时验证）

## 数据库迁移影响

### V9 执行（由 Flyway 在应用启动时自动执行）

```sql
-- W2: project_issues.status CHECK 5→8 值
ALTER TABLE project_issues DROP CONSTRAINT IF EXISTS chk_pi_status;
ALTER TABLE project_issues ADD CONSTRAINT chk_pi_status CHECK (...8 值...);
-- W3: standard_library_version VARCHAR(32)→(64)
ALTER TABLE standard_recommendation_results ALTER COLUMN standard_library_version TYPE VARCHAR(64);
```

**执行时间：** <1 秒（元数据操作，无数据扫描）
**锁影响：** 短暂 AccessExclusiveLock（DROP/ADD CONSTRAINT 和 ALTER TYPE）
**数据风险：** 零（表为空，宽松化变更）

## 不变行为

- application-prod.yml 不变（外部配置，jar 替换不影响）
- .env 不变
- nginx 配置不变
- 数据库连接参数不变
- API 端口 8080 不变