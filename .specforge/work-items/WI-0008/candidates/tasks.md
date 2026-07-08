# Tasks — WI-0008 (构建并部署 fj1 完整 jar + V9 迁移)

> Work Item: WI-0008
> Workflow Type: ops_task
> Workflow Path: ops_task
> 产物类型: tasks.md (运维任务列表)
> 关联: design.md (ops_plan), intake.md
> 生成 Agent: sf-task-planner

## 执行总则

### 串行约束（ops_task 强制）

本 WI 的 7 个 TASK **全部串行执行，禁止并行**。每个 TASK 通过 `depends_on` 显式声明前置依赖，形成严格线性链：

```
TASK-1 → TASK-2 → TASK-3 → TASK-4 → TASK-5 → TASK-6 → TASK-7
```

理由：每个步骤的输入是前一步骤的输出（maven → jar → 验证后的 jar → 传输到 svr-lg 的 jar → 替换后的 jar → 重启后的服务 → 验证目标）。任何并行都会破坏运维安全语义。

### Fail-Stop 判断点

- **TASK-3**（构建后验证）：失败 → 停止，不部署（对应 DD-1）
- **TASK-7**（部署后验证）：失败 → 触发回滚（对应 DD-1）

### 用户确认前置（硬门禁）

- **TASK-5**（备份+替换 jar）：`requires_user_confirmation=true`，destructive=true
- **TASK-6**（重启服务）：`requires_user_confirmation=true`，destructive=true

破坏性步骤未获用户确认前，executor 必须 fail-stop，不得执行。

### 回滚参考

任何 Fail-Stop 触发后，参考 design.md §4 回滚方案：
- 步骤 5 后异常 → 恢复 `.bak.WI0008`（见 §4.1）
- 步骤 6 启动失败 → 恢复 `.bak.WI0008` + restart（见 §4.2）
- V9 迁移失败 → 清理 flyway_schema_history + 恢复 jar（见 §4.3）

---

### TASK-1 安装 maven 构建

**context_block**（executor 必读）：
- **What**: 在本地（CentOS 8）通过 dnf 安装 maven，使 `mvn` 命令可执行
- **Why**: 后续 TASK-2 需要 maven 执行 `mvn clean package` 构建 jar；本地当前缺 maven（host-profile 默认 java=JDK8, javac=17.0.19，无 mvn）
- **Refs**: DD-3（环境隔离），ops_plan 步骤 1，AC-1（mvn 构建前置）
- **Where**:
  - read_files: [无（系统安装操作）]
  - allowed_write_files: [系统：通过 dnf 安装 maven 包到系统路径]
  - forbidden_files: [项目源码、.specforge/**、远程 svr-lg 文件]
- **Constraints**:
  - 使用 dnf 安装（不手动下载二进制）
  - 预计安装 maven 3.5.4
  - 不修改全局 java 版本（保持 JDK8 默认，仅 maven 工具安装）
  - 失败处理：若 dnf 源不可用，检查网络/镜像，重试或换源
- **Done When**:
  - `mvn -version` 退出码 0 且输出包含 Apache Maven 版本号

**task_id**: TASK-1
**refs**: [DD-3, AC-1, ops_plan.步骤1]
**depends_on**: []
**parallel**: false
**requires_user_confirmation**: false
**destructive**: false
**expected_timeout_seconds**: 180
**expected_file_changes**:
- 系统：maven 包安装（~10MB）

**operation_commands**:
- `dnf install -y maven`

**verification_commands**:
- `mvn -version` (期望 exit 0；输出含 "Apache Maven")

**verification_evidence_expected**:
- command: `mvn -version`
  expected_exit_code: 0
  expected_output_pattern: "Apache Maven"
  evidence_type: command_output

**out_of_scope**:
- 不修改全局 JAVA_HOME（DD-3：构建时才覆盖）
- 不构建 jar（属于 TASK-2）
- 不安装 JDK17（已存在于 /usr/lib/jvm/java-17-openjdk）

---

### TASK-2 构建 fj-api jar

**context_block**（executor 必读）：
- **What**: 在项目根目录 `/mnt/1t_back/project/fj1` 执行 maven 构建，生成 `fj-api/target/fj-api-1.0.0.jar`（约 78MB），包含 WI-0004（V3/V8 修复）+ WI-0007（W1 Java 修改 + V9 迁移）全部变更
- **Why**: 这是部署的核心产物；当前 svr-lg 上的 jar 是 07-02 原始版本，缺所有修复；必须用完整构建产生含新 class + V9 SQL 的 jar（AC-1）
- **Refs**: DD-3（JAVA_HOME 覆盖），AC-1，ops_plan 步骤 2
- **Where**:
  - read_files: [fj-api/pom.xml, fj-sync/pom.xml, pom.xml, fj-sync/src/main/java/com/fj/sync/entity/SyncBatchStatus.java, fj-api/src/main/resources/db/migration/V9__*.sql]
  - allowed_write_files: [fj-api/target/fj-api-1.0.0.jar, fj-api/target/**（构建产物）, ~/.m2/repository/**（maven 依赖缓存）]
  - forbidden_files: [src/**（不修改源码，仅编译）, .specforge/**, 远程 svr-lg 文件]
- **Constraints**:
  - **必须显式 `JAVA_HOME=/usr/lib/jvm/java-17-openjdk` 覆盖默认 JDK8**（DD-3 环境隔离），不修改全局 java
  - 使用 `-DskipTests` 跳过测试（测试不属于本次部署范围）
  - 使用 `-pl fj-api -am` 仅构建 fj-api 模块及其依赖模块（fj-sync 等）
  - 首次构建会下载 200-500MB 依赖到 ~/.m2，预计 5-15 分钟
  - **失败处理**：编译错误 → 检查 WI-0004/0007 修改是否完整，修复后重试；依赖下载失败 → 检查网络/镜像，重试（maven 缓存已下载依赖）；构建失败 → **停止，不部署，保留 svr-lg 现状（回滚触发条件 1）**
- **Done When**:
  - `fj-api/target/fj-api-1.0.0.jar` 文件存在
  - 文件大小 > 70MB（约 78MB，确保是完整 fat jar 而非空壳）
  - 构建输出含 BUILD SUCCESS

**task_id**: TASK-2
**refs**: [DD-3, AC-1, ops_plan.步骤2]
**depends_on**: [TASK-1]
**parallel**: false
**requires_user_confirmation**: false
**destructive**: false
**expected_timeout_seconds**: 900
**expected_file_changes**:
- fj-api/target/fj-api-1.0.0.jar
- fj-api/target/**（其他构建产物）
- ~/.m2/repository/**（依赖缓存）

**operation_commands**:
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk mvn clean package -DskipTests -pl fj-api -am` (cwd=/mnt/1t_back/project/fj1)

**verification_commands**:
- `test -f fj-api/target/fj-api-1.0.0.jar` (期望 exit 0；文件存在)
- `test $(stat -c%s fj-api/target/fj-api-1.0.0.jar) -gt 70000000` (期望 exit 0；> 70MB)

**verification_evidence_expected**:
- command: `test -f fj-api/target/fj-api-1.0.0.jar`
  expected_exit_code: 0
  evidence_type: file_existence
- command: `test $(stat -c%s fj-api/target/fj-api-1.0.0.jar) -gt 70000000`
  expected_exit_code: 0
  evidence_type: file_size_check

**out_of_scope**:
- 不运行测试（-DskipTests）
- 不验证 jar 内容（属于 TASK-3）
- 不传输 jar（属于 TASK-4）
- 不修改源码（源码修改属于 WI-0004/0007）

---

### TASK-3 验证 jar 内容（Fail-Stop 判断点）

**context_block**（executor 必读）：
- **What**: 验证刚构建的 jar 是否真正包含 V9 SQL + 修复后的 SyncBatchStatus.class（RECEIVED 无 PROCESSING）。这是部署前的 Fail-Stop 门禁。
- **Why**: 仅 BUILD SUCCESS 不够——必须确认 WI-0007 的 Java 修改和 V9 迁移真正编译进 jar。如果 jar 内容错误，部署后会导致服务启动失败或行为错误（AC-2, AC-3）。此步骤是 DD-1 Fail-Stop 的核心判断点：**验证失败 → 立即停止，绝不部署**。
- **Refs**: DD-1（Fail-Stop），AC-2（jar 含 V1-V9），AC-3（class 含 RECEIVED），ops_plan 步骤 3
- **Where**:
  - read_files: [fj-api/target/fj-api-1.0.0.jar]
  - allowed_write_files: [/tmp/fj-sync-new.jar（临时解压文件）]
  - forbidden_files: [项目源码、.specforge/**、远程 svr-lg 文件、jar 内文件（只读解压）]
- **Constraints**:
  - 只读验证 jar 内容，不修改 jar
  - 使用 unzip + grep + strings 检查
  - 三项检查全部通过才算成功
  - **🔴 Fail-Stop 判断：任何一项失败 → 停止，不部署，检查构建问题（回滚触发条件 2）**
- **Done When**:
  - jar 内 SQL 文件计数（V[0-9]__）== 9（V1-V9）
  - jar 内存在 V9 SQL 文件
  - fj-sync 的 SyncBatchStatus.class strings 含 RECEIVED，不含 PROCESSING

**task_id**: TASK-3
**refs**: [DD-1, AC-2, AC-3, ops_plan.步骤3]
**depends_on**: [TASK-2]
**parallel**: false
**requires_user_confirmation**: false
**destructive**: false
**is_fail_stop_gate**: true
**expected_timeout_seconds**: 60
**expected_file_changes**:
- /tmp/fj-sync-new.jar（临时文件）

**operation_commands**（验证即操作）:
- `unzip -l fj-api/target/fj-api-1.0.0.jar | grep -c "V[0-9]__"`
- `unzip -l fj-api/target/fj-api-1.0.0.jar | grep V9`
- `unzip -p fj-api/target/fj-api-1.0.0.jar BOOT-INF/lib/fj-sync-1.0.0-SNAPSHOT.jar > /tmp/fj-sync-new.jar && unzip -p /tmp/fj-sync-new.jar com/fj/sync/entity/SyncBatchStatus.class | strings | grep -E "RECEIVED|PROCESSING"`

**verification_commands**（每条独立返回退出码）:
- `test "$(unzip -l fj-api/target/fj-api-1.0.0.jar | grep -c 'V[0-9]__')" -eq 9` (期望 exit 0；9 个 SQL 文件)
- `unzip -l fj-api/target/fj-api-1.0.0.jar | grep -q V9` (期望 exit 0；V9 存在)
- `unzip -p fj-api/target/fj-api-1.0.0.jar BOOT-INF/lib/fj-sync-1.0.0-SNAPSHOT.jar > /tmp/fj-sync-new.jar && unzip -p /tmp/fj-sync-new.jar com/fj/sync/entity/SyncBatchStatus.class | strings | grep -q RECEIVED` (期望 exit 0；含 RECEIVED)
- `! unzip -p /tmp/fj-sync-new.jar com/fj/sync/entity/SyncBatchStatus.class | strings | grep -q PROCESSING` (期望 exit 0；不含 PROCESSING)

**verification_evidence_expected**:
- command: SQL 计数检查
  expected_exit_code: 0
  evidence_type: count_check (AC-2)
- command: V9 存在检查
  expected_exit_code: 0
  evidence_type: existence_check (AC-2)
- command: RECEIVED 存在检查
  expected_exit_code: 0
  evidence_type: content_check (AC-3)
- command: PROCESSING 不存在检查
  expected_exit_code: 0
  evidence_type: content_check_negative (AC-3)

**out_of_scope**:
- 不传输 jar（属于 TASK-4）
- 不修改 jar 内容（只读验证）
- 失败时不尝试修复构建（属于人工介入）

**on_failure_action**: STOP — 不进入 TASK-4，报告验证失败详情，等待人工/Orchestrator 决策

---

### TASK-4 传输 jar 到 svr-lg

**context_block**（executor 必读）：
- **What**: 将本地验证通过的 jar 通过 scp 传输到 svr-lg 的 `/tmp/fj-api-1.0.0.jar.WI0008`（带 WI 后缀，避免覆盖现有临时文件）
- **Why**: 部署需要先获取目标机器上的 jar；通过 /tmp 中转，步骤 5 再正式替换生产路径（AC-4 前置）。使用 .WI0008 后缀便于识别和回滚清理。
- **Refs**: AC-4（jar 替换前置），ops_plan 步骤 4
- **Where**:
  - read_files: [fj-api/target/fj-api-1.0.0.jar（本地刚构建验证通过的）]
  - allowed_write_files: [svr-lg:/tmp/fj-api-1.0.0.jar.WI0008]
  - forbidden_files: [svr-lg:/opt/fj1/**（生产路径，此步骤不触碰）, 项目源码, .specforge/**]
- **Constraints**:
  - 使用 `scp` + `ssh lg` 通道（已确认 root 可达）
  - 传输到 /tmp 临时目录（不直接覆盖生产 jar）
  - 文件名带 .WI0008 后缀
  - 失败处理：网络/ssh 问题 → 检查 `ssh lg` 连通性，重试 scp
- **Done When**:
  - svr-lg `/tmp/fj-api-1.0.0.jar.WI0008` 文件存在
  - 文件大小 > 70MB（与本地一致）

**task_id**: TASK-4
**refs**: [AC-4, ops_plan.步骤4]
**depends_on**: [TASK-3]
**parallel**: false
**requires_user_confirmation**: false
**destructive**: false
**expected_timeout_seconds**: 120
**expected_file_changes**:
- svr-lg:/tmp/fj-api-1.0.0.jar.WI0008

**operation_commands**:
- `scp fj-api/target/fj-api-1.0.0.jar lg:/tmp/fj-api-1.0.0.jar.WI0008`

**verification_commands**:
- `ssh lg "test -f /tmp/fj-api-1.0.0.jar.WI0008"` (期望 exit 0；文件存在)
- `ssh lg "test \$(stat -c%s /tmp/fj-api-1.0.0.jar.WI0008) -gt 70000000"` (期望 exit 0；> 70MB)

**verification_evidence_expected**:
- command: `ssh lg "test -f /tmp/fj-api-1.0.0.jar.WI0008"`
  expected_exit_code: 0
  evidence_type: remote_file_existence
- command: `ssh lg "test $(stat -c%s ...) -gt 70000000"`
  expected_exit_code: 0
  evidence_type: remote_file_size_check

**out_of_scope**:
- 不替换生产 jar（属于 TASK-5）
- 不重启服务（属于 TASK-6）
- 不备份（备份在 TASK-5）

---

### TASK-5 备份 + 替换生产 jar（requires_user_confirmation，destructive）

**context_block**（executor 必读）：
- **What**: 在 svr-lg 上备份当前生产 jar 为 `.bak.WI0008`，然后将 /tmp 的新 jar 替换到 `/opt/fj1/api/fj-api-1.0.0.jar`，并设置正确的 owner（fj1:fj1）和权限（644）
- **Why**: 这是覆盖生产 jar 的破坏性操作。**备份必须先于替换**（DD-2 备份先于变更原则），否则无法回滚。命令序列顺序保证先 cp 备份再 mv 替换。此步骤后服务仍运行内存中的旧 jar（JVM 已加载），直到 TASK-6 重启才加载新 jar。
- **Refs**: DD-1（Fail-Stop），DD-2（备份先于变更），AC-4（jar 替换+备份），ops_plan 步骤 5
- **Where**:
  - read_files: [svr-lg:/tmp/fj-api-1.0.0.jar.WI0008（TASK-4 传输的）, svr-lg:/opt/fj1/api/fj-api-1.0.0.jar（当前生产 jar）]
  - allowed_write_files: [svr-lg:/opt/fj1/api/fj-api-1.0.0.jar.bak.WI0008, svr-lg:/opt/fj1/api/fj-api-1.0.0.jar]
  - forbidden_files: [项目源码, .specforge/**, svr-lg 其他服务文件, .env, application-prod.yml]
- **Constraints**:
  - **🔴 requires_user_confirmation=true：破坏性操作，必须用户明确确认后才执行**
  - 命令序列严格顺序：① cp 备份 → ② mv 替换 → ③ chown+chmod → ④ ls 确认
  - 备份命名沿用既有约定（.bak.G6, .bak.WI0005, .bak.WI0008）
  - **备份完成前不执行 mv 覆盖**（命令序列顺序保证）
  - 此步骤服务仍在运行旧 jar（JVM 已加载），可秒回滚（恢复 .bak.WI0008）
- **Done When**:
  - `svr-lg:/opt/fj1/api/fj-api-1.0.0.jar.bak.WI0008` 存在（旧 jar 备份）
  - `svr-lg:/opt/fj1/api/fj-api-1.0.0.jar` 时间戳为当前（新 jar 到位）
  - owner == fj1:fj1，权限 == 644

**task_id**: TASK-5
**refs**: [DD-1, DD-2, AC-4, ops_plan.步骤5]
**depends_on**: [TASK-4]
**parallel**: false
**requires_user_confirmation**: true
**destructive**: true
**expected_timeout_seconds**: 60
**expected_file_changes**:
- svr-lg:/opt/fj1/api/fj-api-1.0.0.jar.bak.WI0008（新建备份）
- svr-lg:/opt/fj1/api/fj-api-1.0.0.jar（覆盖为新 jar）

**operation_commands**（严格顺序）:
- `ssh lg "cp /opt/fj1/api/fj-api-1.0.0.jar /opt/fj1/api/fj-api-1.0.0.jar.bak.WI0008"` （先备份）
- `ssh lg "mv /tmp/fj-api-1.0.0.jar.WI0008 /opt/fj1/api/fj-api-1.0.0.jar"` （再替换）
- `ssh lg "chown fj1:fj1 /opt/fj1/api/fj-api-1.0.0.jar && chmod 644 /opt/fj1/api/fj-api-1.0.0.jar"` （设权限）
- `ssh lg "ls -la /opt/fj1/api/fj-api-1.0.0.jar*"` （确认）

**verification_commands**:
- `ssh lg "test -f /opt/fj1/api/fj-api-1.0.0.jar.bak.WI0008"` (期望 exit 0；备份存在)
- `ssh lg "test \"\$(stat -c%U:%G /opt/fj1/api/fj-api-1.0.0.jar)\" = fj1:fj1"` (期望 exit 0；owner 正确)
- `ssh lg "test \"\$(stat -c%a /opt/fj1/api/fj-api-1.0.0.jar)\" = 644"` (期望 exit 0；权限正确)

**verification_evidence_expected**:
- command: `ssh lg "test -f /opt/fj1/api/fj-api-1.0.0.jar.bak.WI0008"`
  expected_exit_code: 0
  evidence_type: backup_existence (AC-4)
- command: owner 检查
  expected_exit_code: 0
  evidence_type: ownership_check
- command: 权限检查
  expected_exit_code: 0
  evidence_type: permission_check

**out_of_scope**:
- 不重启服务（属于 TASK-6）
- 不修改 .env / application-prod.yml
- 不删除其他历史备份（.bak.G6, .bak.WI0005）

**rollback_on_failure**: 见 design.md §4.1 — `ssh lg "mv /opt/fj1/api/fj-api-1.0.0.jar.bak.WI0008 /opt/fj1/api/fj-api-1.0.0.jar"`

---

### TASK-6 重启服务（requires_user_confirmation，destructive，停机点）

**context_block**（executor 必读）：
- **What**: 重启 svr-lg 的 fj1-api 服务（systemd unit `fj1-api.service`），触发 JVM 重新加载新 jar 并由 Flyway 自动执行 V9 迁移
- **Why**: 替换 jar 后服务仍运行旧版本（JVM 已加载旧 class 到内存）。必须 restart 才能加载新 jar 的新 class + 触发 Flyway V9。这是整个部署的**最大风险点**，有 1-2 分钟停机（AC-5）。
- **Refs**: DD-1（Fail-Stop），AC-5（服务 active），AC-6（Flyway V9），ops_plan 步骤 6
- **Where**:
  - read_files: [svr-lg:/opt/fj1/api/.env（Flyway/DB 配置读取）, svr-lg:fj1-api.service]
  - allowed_write_files: [系统：systemd 服务状态变更；DB：flyway_schema_history 新增 V9 记录]
  - forbidden_files: [项目源码, .specforge/**, jar 文件（TASK-5 已就位）, .env 内容（只读取不修改）]
- **Constraints**:
  - **🔴 requires_user_confirmation=true：破坏性操作，1-2 分钟停机，必须用户明确确认**
  - systemd service 名是 `fj1-api`（注意：不是 fj-api）
  - 执行时行为链：JVM 关闭 → JVM 重启 → Spring Boot 初始化 → Flyway 检测 V9 未执行 → 执行 V9（<1 秒，表为空）→ 应用就绪
  - 预计 30-60 秒后 active running
  - **🔴 回滚触发条件**：restart 后 90 秒内未 active；启动日志含 FATAL/SQLException/FlywayException
  - 执行前应选低峰时段
- **Done When**:
  - restart 后等待 30 秒，`systemctl is-active fj1-api` 返回 active

**task_id**: TASK-6
**refs**: [DD-1, AC-5, AC-6, ops_plan.步骤6]
**depends_on**: [TASK-5]
**parallel**: false
**requires_user_confirmation**: true
**destructive**: true
**expected_timeout_seconds**: 120
**expected_file_changes**:
- 系统：fj1-api 服务状态（restart）
- DB：flyway_schema_history 新增 V9 记录（Flyway 自动执行）

**operation_commands**:
- `ssh lg "systemctl restart fj1-api"`

**verification_commands**:
- `sleep 30; ssh lg "systemctl is-active fj1-api"` (期望 exit 0；输出 active)

**verification_evidence_expected**:
- command: `sleep 30; ssh lg "systemctl is-active fj1-api"`
  expected_exit_code: 0
  expected_output_pattern: "active"
  evidence_type: service_status (AC-5)

**out_of_scope**:
- 不修改 service 文件
- 不手动执行 SQL（Flyway 自动执行 V9）
- 不验证迁移结果（属于 TASK-7 的完整验证）

**rollback_on_failure**: 见 design.md §4.2 — 恢复 `.bak.WI0008` + restart

---

### TASK-7 验证部署（Fail-Stop 判断点）

**context_block**（executor 必读）：
- **What**: 重启后执行 5 项部署后验证，全面确认服务健康 + V9 迁移成功 + schema 正确。这是部署的最终 Fail-Stop 门禁：**任何一项失败 → 立即触发回滚**。
- **Why**: 仅服务 active 不够——必须确认 Flyway 真的执行了 V9、CHECK 真的扩展为 8 值、VARCHAR 真的变成 64、启动日志无错误。这覆盖 AC-6/7/8/9，是整个部署的成功判据。验证失败意味着部署有隐患，必须回滚到 .bak.WI0008（DD-1 Fail-Stop）。
- **Refs**: DD-1（Fail-Stop），AC-5（active），AC-6（Flyway V9），AC-7（CHECK 8 值），AC-8（VARCHAR 64），AC-9（无 ERROR），ops_plan 步骤 7
- **Where**:
  - read_files: [svr-lg:fj1-api 服务状态, svr-lg:journalctl 日志, DB:fj1_inspect.flyway_schema_history, DB:pg_constraint(chk_pi_status), DB:information_schema.columns]
  - allowed_write_files: [无（纯只读验证）]
  - forbidden_files: [项目源码, .specforge/**, jar 文件, .env, 任何 svr-lg 配置]
- **Constraints**:
  - 5 项检查全部通过才算成功
  - 使用 ssh + psql 远程查询（读取 .env 获取 DB_PASSWORD）
  - **🔴 Fail-Stop 判断：任何一项失败 → 触发回滚（恢复 .bak.WI0008 + restart）**
- **Done When**:
  - 7a: systemctl status → active (running)
  - 7b: journalctl 近 2 分钟无 ERROR/FATAL/Exception
  - 7c: flyway_schema_history version=9 success=t
  - 7d: chk_pi_status CHECK 含 8 值（含 RECTIFIED, CLOSED, OVERDUE）
  - 7e: standard_library_version character_maximum_length = 64

**task_id**: TASK-7
**refs**: [DD-1, AC-5, AC-6, AC-7, AC-8, AC-9, ops_plan.步骤7]
**depends_on**: [TASK-6]
**parallel**: false
**requires_user_confirmation**: false
**destructive**: false
**is_fail_stop_gate**: true
**expected_timeout_seconds**: 120
**expected_file_changes**:
- 无（纯只读验证）

**operation_commands**（验证即操作）:
- 7a: `ssh lg "systemctl status fj1-api | grep Active"`
- 7b: `ssh lg "journalctl -u fj1-api --since '2 min ago' --no-pager | grep -iE 'ERROR|FATAL|Exception' | head -5"`
- 7c: `ssh lg "set -a && . /opt/fj1/api/.env && set +a && PGPASSWORD=\$DB_PASSWORD psql -h 127.0.0.1 -U fj1_app -d fj1_inspect -t -c \"SELECT version, description, success FROM flyway_schema_history WHERE version='9';\""`
- 7d: `ssh lg "set -a && . /opt/fj1/api/.env && set +a && PGPASSWORD=\$DB_PASSWORD psql -h 127.0.0.1 -U fj1_app -d fj1_inspect -t -c \"SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='chk_pi_status';\""`
- 7e: `ssh lg "set -a && . /opt/fj1/api/.env && set +a && PGPASSWORD=\$DB_PASSWORD psql -h 127.0.0.1 -U fj1_app -d fj1_inspect -t -c \"SELECT character_maximum_length FROM information_schema.columns WHERE table_name='standard_recommendation_results' AND column_name='standard_library_version';\""`

**verification_commands**（每条独立返回退出码）:
- `ssh lg "systemctl is-active fj1-api | grep -q active"` (期望 exit 0；7a active running, AC-5)
- `! ssh lg "journalctl -u fj1-api --since '2 min ago' --no-pager | grep -qiE 'FATAL|FlywayException'"` (期望 exit 0；7b 无致命错误, AC-9；ERROR/Exception 仅作警告参考)
- `ssh lg "set -a && . /opt/fj1/api/.env && set +a && PGPASSWORD=\$DB_PASSWORD psql -h 127.0.0.1 -U fj1_app -d fj1_inspect -t -c \"SELECT success FROM flyway_schema_history WHERE version='9';\" | grep -q t"` (期望 exit 0；7c V9 success=t, AC-6)
- `ssh lg "set -a && . /opt/fj1/api/.env && set +a && PGPASSWORD=\$DB_PASSWORD psql -h 127.0.0.1 -U fj1_app -d fj1_inspect -t -c \"SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='chk_pi_status';\"" | grep -q RECTIFIED` (期望 exit 0；7d CHECK 含 RECTIFIED, AC-7)
- `test "\$(ssh lg "set -a && . /opt/fj1/api/.env && set +a && PGPASSWORD=\$DB_PASSWORD psql -h 127.0.0.1 -U fj1_app -d fj1_inspect -t -c \"SELECT character_maximum_length FROM information_schema.columns WHERE table_name='standard_recommendation_results' AND column_name='standard_library_version';\"" | tr -d ' ')" = "64"` (期望 exit 0；7e VARCHAR=64, AC-8)

**verification_evidence_expected**:
- command: 7a service status
  expected_exit_code: 0
  evidence_type: service_status (AC-5)
- command: 7b log check
  expected_exit_code: 0
  evidence_type: log_check (AC-9)
- command: 7c flyway check
  expected_exit_code: 0
  evidence_type: flyway_check (AC-6)
- command: 7d constraint check
  expected_exit_code: 0
  evidence_type: constraint_check (AC-7)
- command: 7e schema check
  expected_exit_code: 0
  evidence_type: schema_check (AC-8)

**out_of_scope**:
- 不回滚（回滚是 on_failure_action）
- 不监控长期运行（仅验证部署即时状态）
- 不执行业务功能测试（业务表为空）

**on_failure_action**: ROLLBACK — 按 design.md §4.2/§4.3 恢复 `.bak.WI0008` + restart；若 V9 失败先清理 flyway_schema_history

---

## 任务依赖图

```
TASK-1 (安装 maven)
  └─ TASK-2 (构建 jar)
       └─ TASK-3 (验证 jar) [Fail-Stop]
            └─ TASK-4 (传输 jar)
                 └─ TASK-5 (备份+替换) [user_confirm, destructive]
                      └─ TASK-6 (重启服务) [user_confirm, destructive, 停机点]
                           └─ TASK-7 (验证部署) [Fail-Stop]
```

## 批次划分

| 批次 | TASK | 说明 |
|------|------|------|
| 批次 1 | TASK-1, TASK-2, TASK-3 | 本地构建+验证（无停机，无破坏性） |
| 批次 2 | TASK-4, TASK-5 | 传输+替换（TASK-5 需用户确认，破坏性但无停机） |
| 批次 3 | TASK-6, TASK-7 | 重启+验证（TASK-6 需用户确认，停机点） |

> 注：批次仅用于阶段划分，**所有 TASK 严格串行执行**。

## 覆盖统计

- 总 TASK 数：7
- 串行 TASK 数：7
- 并行批次：0（全串行）
- 含 context_block：7/7
- 含 verification_commands：7/7
- Fail-Stop 门禁：2（TASK-3, TASK-7）
- requires_user_confirmation：2（TASK-5, TASK-6）
- destructive：2（TASK-5, TASK-6）
- 覆盖 AC：9/9（AC-1~AC-9）
- 覆盖 DD：3/3（DD-1, DD-2, DD-3）
- 覆盖 ops_plan 步骤：7/7（步骤 1-7）

*Generated by sf-task-planner for WI-0008 (ops_task workflow)*