# Ops Plan — WI-0008 (构建并部署 fj1 完整 jar + V9 迁移)

> Work Item: WI-0008
> Workflow Type: ops_task
> 产物类型: ops_plan.md (运维操作计划)
> 标准依据: sf-workflow-ops-task / SpecForge v1.1 Ops Task 工作流
> 关联: intake.md, impact_analysis.md
> 设计 Agent: sf-design

## 设计决策与约束映射

### DD-1 Fail-Stop 执行原则
refs: [intake.AC-2, intake.AC-3, intake.AC-6, intake.AC-7, intake.AC-8]
constrained_by: AGENT_CONSTITUTION (fail-stop 执行协议), sf-workflow-ops-task
- 每个破坏性步骤前设置 Fail-Stop 判断点
- 构建产物验证失败 → 立即停止，不进入部署
- 部署后验证失败 → 立即触发回滚
- 用户确认是破坏性步骤的硬前置

### DD-2 备份先于变更原则
refs: [intake.AC-4]
constrained_by: sf-workflow-ops-task (回滚方案必备)
- 步骤 5 在覆盖生产 jar 前先 `cp` 生成 `.bak.WI0008`
- 命名沿用既有约定（.bak.G6, .bak.WI0005, .bak.WI0008）
- 备份完成前不执行 mv 覆盖

### DD-3 环境隔离原则（JAVA_HOME 覆盖）
refs: [intake.操作目标, impact_analysis.构建环境现状]
constrained_by: host-profile (默认 java=JDK8, javac=17.0.19)
- 构建命令显式 `JAVA_HOME=/usr/lib/jvm/java-17-openjdk` 覆盖默认 JDK8
- 不修改全局 java 版本（避免影响其他工具）

---

## 1. 操作目标

构建并部署 fj1 完整 jar，执行 V9 迁移。

具体目标：
- 在本地（CentOS 8）搭建 JDK17 + maven 构建环境
- 使用 `mvn clean package -DskipTests` 构建包含 WI-0004（V3/V8 修复）+ WI-0007（W1 Java 修改 + V9 迁移）全部变更的新 jar
- 部署到 svr-lg 并重启 fj1-api 服务
- 使 Flyway 自动执行 V9 迁移（project_issues.status CHECK 扩展为 8 值 + standard_library_version VARCHAR(64)）
- 彻底消除本地源码与 svr-lg 部署之间的所有差异

---

## 2. 前置条件

| 前置条件 | 状态 | 验证方式 |
|----------|------|----------|
| svr-lg 服务当前 active running | ✅ 已确认 | `ssh lg "systemctl is-active fj1-api"` → active |
| 本地源码已含 WI-0004/0007 全部修改 | ⚠️ 需执行前确认 | `git status` 确认工作区状态符合预期 |
| svr-lg 磁盘充足 | ✅ 已确认 | 23G 可用 |
| 业务表为空（迁移零风险） | ✅ 已确认 | 0 sync_batches, 0 project_issues, 0 daily_reports |
| JDK17 路径存在 | ✅ 已确认 | `/usr/lib/jvm/java-17-openjdk` (javac 17.0.19) |
| ssh lg 可达（root） | ✅ 已确认 | 现有部署通道 |
| svr-lg 现有备份命名约定 | ✅ 已确认 | .bak.G6 (07-03), .bak.WI0005 (07-04) |

**执行前必须确认的前置：** 本地源码完整性（步骤 0 人工确认）。

---

## 3. 操作步骤

> 执行顺序严格按 Step 1 → Step 7。每个破坏性步骤前必须通过用户确认。

### 步骤 0：执行前确认（人工预检，非命令步骤）
- **动作：** 执行者确认 `git status` 显示 WI-0004/0007 相关文件已修改且未丢失
- **是否破坏性：** 否
- **requires_user_confirmation：** false
- **parallel：** false

---

### 步骤 1：安装 maven
- **命令：** `dnf install -y maven`
- **预期结果：** maven 3.5.4 安装成功，`mvn -version` 可执行
- **预计耗时：** 1-3 分钟
- **是否破坏性：** 否
- **requires_user_confirmation：** false
- **parallel：** false
- **失败处理：** 若 dnf 源不可用，检查网络/镜像；重试或换源

---

### 步骤 2：构建 jar
- **命令：**
  ```bash
  JAVA_HOME=/usr/lib/jvm/java-17-openjdk mvn clean package -DskipTests -pl fj-api -am
  ```
  （在项目根目录 `/mnt/1t_back/project/fj1` 执行）
- **预期结果：** BUILD SUCCESS，生成 `fj-api/target/fj-api-1.0.0.jar`（约 78MB）
- **预计耗时：** 5-15 分钟（首次含依赖下载约 200-500MB 到 ~/.m2）
- **是否破坏性：** 否（仅 target/）
- **requires_user_confirmation：** false
- **parallel：** false
- **失败处理：**
  - 编译错误 → 检查 WI-0004/0007 修改是否完整，修复后重试
  - 依赖下载失败 → 检查网络/镜像，重试（maven 会缓存已下载依赖）
  - 构建失败 → **停止，不部署，保留 svr-lg 现状**（回滚触发条件 1）

---

### 步骤 3：验证 jar 内容（构建后检查，Fail-Stop 判断点）
- **命令 1（SQL 文件计数）：**
  ```bash
  unzip -l fj-api/target/fj-api-1.0.0.jar | grep -c "V[0-9]__"
  ```
  **预期：** 9（V1-V9）
- **命令 2（V9 存在性）：**
  ```bash
  unzip -l fj-api/target/fj-api-1.0.0.jar | grep V9
  ```
  **预期：** 显示 `V9__fix_enum_check_constraints.sql`
- **命令 3（SyncBatchStatus.class 验证）：**
  ```bash
  unzip -p fj-api/target/fj-api-1.0.0.jar BOOT-INF/lib/fj-sync-1.0.0-SNAPSHOT.jar > /tmp/fj-sync-new.jar
  unzip -p /tmp/fj-sync-new.jar com/fj/sync/entity/SyncBatchStatus.class | strings | grep -E "RECEIVED|PROCESSING"
  ```
  **预期：** 显示 `RECEIVED`，**不显示** `PROCESSING`
- **预期结果汇总：** 9 个 SQL（含 V9）+ SyncBatchStatus 含 RECEIVED 无 PROCESSING
- **🔴 Fail-Stop 判断：** **如果验证失败 → 停止，不部署**
- **是否破坏性：** 否
- **requires_user_confirmation：** false
- **parallel：** false
- **失败处理：** 检查构建问题，确认源码修改是否真正进入 class（回滚触发条件 2）

---

### 步骤 4：传输 jar 到 svr-lg
- **命令：**
  ```bash
  scp fj-api/target/fj-api-1.0.0.jar lg:/tmp/fj-api-1.0.0.jar.WI0008
  ```
- **预期结果：** 文件传输成功，svr-lg `/tmp` 下有该文件
- **预计耗时：** 10-60 秒（78MB，取决于内网带宽）
- **是否破坏性：** 否（仅写入 /tmp 临时文件）
- **requires_user_confirmation：** false
- **parallel：** false
- **失败处理：** 网络/ssh 问题 → 检查 ssh lg 连通性，重试 scp

---

### 步骤 5：备份 + 替换 jar（requires_user_confirmation）
- **命令序列：**
  ```bash
  ssh lg "cp /opt/fj1/api/fj-api-1.0.0.jar /opt/fj1/api/fj-api-1.0.0.jar.bak.WI0008"
  ssh lg "mv /tmp/fj-api-1.0.0.jar.WI0008 /opt/fj1/api/fj-api-1.0.0.jar"
  ssh lg "chown fj1:fj1 /opt/fj1/api/fj-api-1.0.0.jar && chmod 644 /opt/fj1/api/fj-api-1.0.0.jar"
  ssh lg "ls -la /opt/fj1/api/fj-api-1.0.0.jar*"
  ```
- **预期结果：** 新 jar 到位（时间戳为当前），`.bak.WI0008` 备份存在
- **是否破坏性：** **是**（覆盖生产 jar，但已备份且服务未重启，旧 jar 仍在内存运行）
- **requires_user_confirmation：** **true** ⚠️
- **parallel：** false
- **关键说明：**
  - 备份命名沿用既有约定（`.bak.G6`, `.bak.WI0005`, `.bak.WI0008`）
  - 备份完成前不执行 mv 覆盖（命令序列顺序保证）
  - 此步骤后服务仍在运行旧 jar（JVM 已加载），直到步骤 6 重启才加载新 jar

---

### 步骤 6：重启服务（requires_user_confirmation，破坏性，停机点）
- **命令：**
  ```bash
  ssh lg "systemctl restart fj1-api"
  ```
- **预期结果：** 服务重启，约 30-60 秒后 active running
- **停机时间：** 1-2 分钟
- **是否破坏性：** **是**（服务停机 + Flyway 执行 V9）
- **requires_user_confirmation：** **true** ⚠️
- **parallel：** false
- **执行时行为：**
  - JVM 关闭 → JVM 重启 → Spring Boot 初始化 → Flyway 检测 V9 未执行 → 执行 V9 → 应用就绪
  - V9 执行时间 <1 秒（元数据操作，表为空）
- **🔴 回滚触发条件：**
  - systemctl restart 后 90 秒内服务未 active
  - 启动日志含 FATAL / SQLException / FlywayException
  - health 检查非 UP

---

### 步骤 7：验证部署（Fail-Stop 判断点）
- **命令序列：**
  ```bash
  # 7a. 服务状态
  ssh lg "systemctl status fj1-api | grep Active"
  # 预期：active (running)

  # 7b. 启动日志检查（无 ERROR）
  ssh lg "journalctl -u fj1-api --since '2 min ago' --no-pager | grep -iE 'ERROR|FATAL|Exception' | head -5"
  # 预期：无输出（或仅非致命警告）

  # 7c. Flyway V9 执行确认
  ssh lg "set -a && . /opt/fj1/api/.env && set +a && PGPASSWORD=\$DB_PASSWORD psql -h 127.0.0.1 -U fj1_app -d fj1_inspect -t -c \"SELECT version, description, success FROM flyway_schema_history WHERE version='9';\""
  # 预期：9 | fix enum check constraints | t

  # 7d. project_issues CHECK 8 值
  ssh lg "set -a && . /opt/fj1/api/.env && set +a && PGPASSWORD=\$DB_PASSWORD psql -h 127.0.0.1 -U fj1_app -d fj1_inspect -t -c \"SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='chk_pi_status';\""
  # 预期：含 8 个值（包括 RECTIFIED, CLOSED, OVERDUE）

  # 7e. standard_library_version VARCHAR(64)
  ssh lg "set -a && . /opt/fj1/api/.env && set +a && PGPASSWORD=\$DB_PASSWORD psql -h 127.0.0.1 -U fj1_app -d fj1_inspect -t -c \"SELECT character_maximum_length FROM information_schema.columns WHERE table_name='standard_recommendation_results' AND column_name='standard_library_version';\""
  # 预期：64
  ```
- **预期结果：** 全部 5 项检查通过
  - 7a: active (running)
  - 7b: 无 ERROR/FATAL/Exception
  - 7c: `9 | fix enum check constraints | t`
  - 7d: CHECK 含 8 值（含 RECTIFIED, CLOSED, OVERDUE）
  - 7e: `64`
- **🔴 Fail-Stop 判断：** **如果任何检查失败 → 触发回滚**
- **是否破坏性：** 否
- **requires_user_confirmation：** false
- **parallel：** false

---

## 4. 回滚方案

### 4.1 步骤 5 回滚（jar 替换回滚）
- **触发条件：** 步骤 5 执行后、步骤 6 执行前发现 jar 异常
- **命令：**
  ```bash
  ssh lg "mv /opt/fj1/api/fj-api-1.0.0.jar.bak.WI0008 /opt/fj1/api/fj-api-1.0.0.jar"
  ```
- **预期：** 恢复旧 jar（服务无需重启，因为仍在运行内存中的旧版本）

### 4.2 步骤 6 回滚（服务启动失败回滚）
- **触发条件：**
  - systemctl restart 后 90 秒内服务未 active
  - 启动日志含 FATAL / SQLException / FlywayException
  - health 检查非 UP
- **命令序列：**
  ```bash
  ssh lg "mv /opt/fj1/api/fj-api-1.0.0.jar.bak.WI0008 /opt/fj1/api/fj-api-1.0.0.jar"
  ssh lg "systemctl restart fj1-api"
  ```
- **预期：** 恢复旧 jar 并重启，服务回到 WI-0005 状态（V1-V8 已执行，无 V9）

### 4.3 V9 迁移失败回滚（Flyway 执行 V9 失败）
- **说明：** Flyway 失败会在 `flyway_schema_history` 留下 `success=f` 记录，阻止应用启动
- **命令序列（手动清理）：**
  ```bash
  ssh lg "set -a && . /opt/fj1/api/.env && set +a && PGPASSWORD=\$DB_PASSWORD psql -h 127.0.0.1 -U fj1_app -d fj1_inspect -c \"DELETE FROM flyway_schema_history WHERE version='9';\""
  # 然后恢复旧 jar 并重启（见 4.2）
  ssh lg "mv /opt/fj1/api/fj-api-1.0.0.jar.bak.WI0008 /opt/fj1/api/fj-api-1.0.0.jar"
  ssh lg "systemctl restart fj1-api"
  ```
- **预期：** 清理失败的 V9 记录，恢复旧 jar，服务回到 WI-0005 状态

---

## 5. 回滚触发条件（汇总）

| 条件 | 触发位置 | 动作 |
|------|----------|------|
| 步骤 2 构建失败 | 步骤 2 后 | 不部署，保留 svr-lg 现状 |
| 步骤 3 jar 验证失败（无 V9 / class 无 RECEIVED） | 步骤 3 后 | 不部署，检查构建问题 |
| 步骤 6 后 90 秒未 active | 步骤 6 后 | 恢复 `.bak.WI0008` + restart |
| 步骤 6 后日志含 FATAL / SQLException / FlywayException | 步骤 6 后 | 恢复 `.bak.WI0008` + restart |
| 步骤 7 任何验证项失败 | 步骤 7 后 | 恢复 `.bak.WI0008` + restart |
| V9 迁移失败（flyway_schema_history success=f） | 步骤 6/7 | 清理 flyway_schema_history + 恢复 jar |

---

## 6. 风险评估

| 风险项 | 等级 | 说明 | 缓解措施 |
|--------|------|------|----------|
| 服务重启停机 | **中** | 步骤 6 有 1-2 分钟停机，最大风险点 | 选低峰时段执行；完整回滚路径已准备 |
| 构建失败 | 低 | 本地首次完整构建，依赖下载/编译未知问题 | 构建失败不部署；可重试 |
| V9 迁移 | **极低** | 宽松化变更（CHECK 扩展 + VARCHAR 扩展）+ 表为空 | Flyway 失败有清理回滚方案（4.3） |
| 配置覆盖 | 极低 | 新 jar 内嵌 application.yml 与 svr-lg 外部 prod.yml 冲突 | 已确认 svr-lg 用 SPRING_CONFIG_ADDITIONAL_LOCATION 加载外部 yml |
| jar 替换 | 低 | 覆盖生产 jar | 先备份 `.bak.WI0008`，服务未重启前可秒回滚 |

**整体风险：中**
- 最大风险点是步骤 6（服务重启），有 1-2 分钟停机
- V9 迁移风险极低（宽松化变更 + 表为空）
- 完整回滚路径已准备（`.bak.WI0008`）

---

## 7. 影响范围

| 对象 | 影响 | 持续时间 |
|------|------|----------|
| **API 用户** | 重启期间（1-2 分钟）API 不可用，nginx 返回 502 | 步骤 6 期间 |
| **前端用户** | 同上，页面无法操作 | 步骤 6 期间 |
| **数据库** | V9 执行（<1 秒元数据操作，短暂 AccessExclusiveLock） | 步骤 6 期间瞬时 |
| **数据** | 无影响（业务表为空，DDL 宽松化） | 无 |
| **构建机（本地）** | 安装 maven + 生成 target/ 产物 | 步骤 1-3 |
| **svr-lg 磁盘** | 新 jar（78MB）+ 备份 `.bak.WI0008`（78MB） | 永久（备份保留） |

---

## Out of Scope（本计划不涉及）

- ❌ 不修改 application-prod.yml（外部配置不变，ddl-auto=validate）
- ❌ 不修改 .env（DB_PASSWORD/JWT_SECRET 不变）
- ❌ 不修改 nginx 配置
- ❌ 不修改 API 端口（8080 不变）
- ❌ 不执行任何数据库数据操作（业务表为空，无需数据迁移）
- ❌ 不修改源代码（源码修改属于 WI-0004/0007，本 WI 仅构建部署）
- ❌ 不回滚 WI-0005 的 application-prod.yml.bak（与本 WI 无关）

---

## Assumptions（设计假设）

- 假设 `ssh lg` 通道稳定可用（root 权限）
- 假设 svr-lg 磁盘 23G 可用空间足够（新 jar + 备份约 156MB）
- 假设本地 dnf 源可用，可安装 maven 3.5.4
- 假设 maven 3.5.4 与 Spring Boot 3.x 兼容（构建时验证）
- 假设本地网络可访问 maven 中央仓库/镜像下载依赖
- 假设 svr-lg 的 fj1-api.service 当前 active running（前置条件）
- 假设业务表保持为空直到部署完成（迁移零数据风险）
- 假设 JDK17 路径 `/usr/lib/jvm/java-17-openjdk` 稳定（javac 17.0.19）
- 假设 svr-lg PostgreSQL 版本 ≥ 12（ALTER TYPE VARCHAR 仅改元数据，不锁表）

---

## 自检（架构 5 属性）

| 属性 | 检查 | 结果 |
|------|------|------|
| A1 单一职责 | 本计划仅回答"如何构建部署 fj1 jar + 执行 V9" | ✅ |
| A2 显式依赖 | 步骤间依赖关系明确（1→2→3→4→5→6→7 严格顺序） | ✅ |
| A3 可替换性 | 回滚方案提供完整的替代路径（恢复 .bak.WI0008） | ✅ |
| A4 失败可观测 | 每个破坏性步骤有 Fail-Stop 判断点 + 回滚触发条件 | ✅ |
| A5 边界明确 | Out of Scope + Assumptions 段完整 | ✅ |

---

*Generated by sf-design for WI-0008 (ops_task workflow)*
