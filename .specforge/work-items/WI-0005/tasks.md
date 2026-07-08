# Tasks — WI-0005 (svr-lg 同步 WI-0004 修复)

> Work Item: WI-0005
> Workflow Type: ops_task
> 来源: WI-0005 design.md (ops_plan, 22 步骤/8 阶段 A-H)
> 任务总数: 8
> 执行模式: **严格串行**（ops_task 阶段有严格依赖，不允许并行）
> 所有操作通过 `ssh lg` (svr-lg root@10.0.12.12) 远程执行
> 本地 scp 源文件只读，禁止修改源码仓库

---

## 执行顺序与依赖链

```
TASK-1 (备份) → TASK-2 (准备迁移文件) → TASK-3 (安装 Flyway CLI)
  → TASK-4 (Flyway repair,破坏性) → TASK-5 (停机+修补,停机窗口)
  → TASK-6 (启动+migrate) → TASK-7 (最终验证) → TASK-8 (清理,可选)
```

| TASK | 阶段 | 服务状态 | 破坏性 | requires_user_confirmation | parallel |
|------|------|----------|--------|---------------------------|----------|
| TASK-1 | A (备份) | ✅ 运行 | 否 | false | false |
| TASK-2 | B (准备迁移文件) | ✅ 运行 | 否 | false | false |
| TASK-3 | C (安装 Flyway CLI) | ✅ 运行 | 否 | false | false |
| TASK-4 | D (Flyway repair) | ✅ 运行 | **是** | **true** | false |
| TASK-5 | E (停机+修补) | ❌ 停机 | **是** | **true** | false |
| TASK-6 | F (启动+migrate) | ⏳→✅ | 是(V8 DDL) | false | false |
| TASK-7 | G (最终验证) | ✅ 运行 | 否 | false | false |
| TASK-8 | H (清理) | ✅ 运行 | 否 | false | false |

**停机窗口**: TASK-5 E1 ~ TASK-6 F2（实际约 2-3 分钟，含缓冲 5-10 分钟）

---

## 前置条件（P1-P10，TASK-1 执行前必须全部满足）

| # | 前置条件 | 验证命令 |
|---|----------|----------|
| P1 | svr-lg SSH 可达（root） | `ssh lg 'hostname && whoami'` |
| P2 | fj1-api 当前 health=UP | `ssh lg 'curl -sf localhost:8080/api/actuator/health'` |
| P3 | PostgreSQL 16 active | `ssh lg 'systemctl is-active postgresql-16'` |
| P4 | svr-lg 有 zip/unzip | `ssh lg 'which zip unzip'` |
| P5 | svr-lg 磁盘空间 >500MB | `ssh lg 'df -h /opt /tmp'` |
| P6 | 本地修复 V3 文件存在 | `ls -la fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql` |
| P7 | 本地新建 V8 文件存在 | `ls -la fj-backend/fj-api/src/main/resources/db/migration/V8__fix_schema_mismatches.sql` |
| P8 | 本地修复 yml 模板存在 | `ls -la deploy/config/application-prod.yml` |
| P9 | .env 文件存在 | `ssh lg 'ls -la /opt/fj1/api/.env'` |
| P10 | **用户已同意停机窗口** | 用户明确确认（P10 是 TASK-5 的硬前置） |

---

## 远程文件操作总表（供 code_permission 审计）

> ⚠️ ops_task 特殊性：executor 通过 `ssh lg` 修改远程文件，**不修改本地项目文件**。
> `allowed_write_files`（本地）= `[]`（本地无写入）。
> 远程操作目标在下方 `remote_targets` 字段声明（code_permission 审计参考）。

| TASK | 远程操作目标 | 操作类型 |
|------|-------------|----------|
| TASK-1 | `/opt/fj1/api/backups/*WI0005*` | 创建备份 |
| TASK-2 | `/tmp/flyway-migrations/V*.sql`, `/tmp/V3__*.sql`, `/tmp/V8__*.sql` | 创建目录+文件 |
| TASK-3 | `/opt/flyway-9.22.3/**`, `/tmp/flyway-commandline-*.tar.gz` | 安装 CLI |
| TASK-4 | `flyway_schema_history` (V3 checksum), `export_files` (条件性 ALTER) | 修改元数据 |
| TASK-5 | `/opt/fj1/api/fj-api-1.0.0.jar`, `/opt/fj1/api/application-prod.yml` | 修补 jar + yml |
| TASK-6 | `flyway_schema_history` (V8 记录), systemd fj-api | 启动+migrate |
| TASK-7 | （只读验证） | 无写入 |
| TASK-8 | `/tmp/flyway-migrations`, `/tmp/jar-patch`, `/tmp/V*.sql`, `/tmp/flyway-*.tar.gz` | 删除临时文件 |

**本地只读源文件**（scp 源，所有 task 共享只读）：
- `fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql`
- `fj-backend/fj-api/src/main/resources/db/migration/V8__fix_schema_mismatches.sql`
- `deploy/config/application-prod.yml`（参考模板，本 WI 不直接使用）

**全局 forbidden_files**（所有 task 禁止修改）：
- `fj-backend/**`（源码仓库只读）
- `.specforge/**`（治理产物）
- `/opt/fj1/api/.env`（机密文件，仅 source 引用）
- `/opt/fj1/api/fj-api-1.0.0.jar.bak.G6`（WI-0003 历史备份，保留）

---

### TASK-1 阶段 A：四重备份（数据库/jar/yml/Flyway 元数据）

**context_block**（executor 必读）：
- **What**: 在破坏性操作前完成四重备份：
  1. A1: `pg_dump` 备份 fj_inspect 数据库（全量 SQL）
  2. A2: `cp -p` 备份当前运行 jar（`fj-api-1.0.0.jar` → `.bak.WI0005`）
  3. A3: `cp -p` 备份外部 application-prod.yml（→ `.bak.WI0005`）
  4. A4: 导出 `flyway_schema_history` 为 CSV（V1-V7 当前状态，含 V3 旧 checksum）
- **Why**: TASK-4 (repair) 和 TASK-5 (jar 修补) 是破坏性操作，必须有完整备份才能回滚。A1 数据库备份是后续所有操作的回滚基础；A4 的 flyway_history CSV 是 TASK-4 repair 回滚（R-D1）的唯一依据。
- **Refs**: 阶段 A（步骤 A1-A4），见 design.md L62-L142
- **Constraints**:
  - 不停机（服务保持运行）
  - 机密不泄露：DB_PASSWORD 从 `.env` 读取，不在命令行明文出现（`source /opt/fj1/api/.env`）
  - A1 失败 → **停止全部后续操作**（无数据库备份不可继续）
  - A4 失败 → **停止全部后续操作**（无 flyway 元数据备份不可 repair）
  - 备份文件命名含 `_WI0005_` 和时间戳，便于识别
- **Done When**:
  - `/opt/fj1/api/backups/fj_inspect_WI0005_*.sql` 存在且非空（输出 BACKUP_SIZE + BACKUP_LINES）
  - `/opt/fj1/api/fj-api-1.0.0.jar.bak.WI0005` 存在，md5 与原 jar 一致（JAR_SIZE_VERIFY: 1）
  - `/opt/fj1/api/application-prod.yml.bak.WI0005` 存在，当前 ddl-auto=none 已记录
  - `/opt/fj1/api/backups/flyway_history_WI0005_*.csv` 存在，含 V1-V7 共 7 行表头+数据

**ops_steps**（操作命令详见 design.md A1-A4，执行时逐条运行）：
1. A1: `ssh lg 'source /opt/fj1/api/.env && cd /opt/fj1/api && PGPASSWORD="${DB_PASSWORD}" pg_dump ... > backups/fj_inspect_WI0005_$(date).sql'`
2. A2: `ssh lg 'cp -p /opt/fj1/api/fj-api-1.0.0.jar /opt/fj1/api/fj-api-1.0.0.jar.bak.WI0005 && md5sum 校验'`
3. A3: `ssh lg 'cp -p /opt/fj1/api/application-prod.yml /opt/fj1/api/application-prod.yml.bak.WI0005 && grep ddl-auto'`
4. A4: `ssh lg 'source /opt/fj1/api/.env && PGPASSWORD="${DB_PASSWORD}" psql ... COPY flyway_schema_history TO STDOUT CSV > backups/flyway_history_WI0005_$(date).csv'`

- **依赖**: 无（首个 task，但需前置条件 P1-P10 全部满足）
- refs: [阶段-A, A1, A2, A3, A4, AC-7]
- requires_user_confirmation: false
- parallel: false
- **远程目标文件** (remote_targets):
  - `svr-lg:/opt/fj1/api/backups/fj_inspect_WI0005_*.sql` (创建)
  - `svr-lg:/opt/fj1/api/fj-api-1.0.0.jar.bak.WI0005` (创建)
  - `svr-lg:/opt/fj1/api/application-prod.yml.bak.WI0005` (创建)
  - `svr-lg:/opt/fj1/api/backups/flyway_history_WI0005_*.csv` (创建)
- **本地 allowed_write_files**: `[]`（仅 scp/ssh 远程操作，无本地写入）
- **verification_commands**:
  - `ssh lg 'ls -la /opt/fj1/api/backups/fj_inspect_WI0005_*.sql && wc -l /opt/fj1/api/backups/fj_inspect_WI0005_*.sql'`
  - `ssh lg 'test $(md5sum /opt/fj1/api/fj-api-1.0.0.jar /opt/fj1/api/fj-api-1.0.0.jar.bak.WI0005 | awk "{print \$1}" | sort -u | wc -l) -eq 1 && echo JAR_BACKUP_OK'`
  - `ssh lg 'test -f /opt/fj1/api/application-prod.yml.bak.WI0005 && grep -q "ddl-auto" /opt/fj1/api/application-prod.yml.bak.WI0005 && echo YML_BACKUP_OK'`
  - `ssh lg 'test -f /opt/fj1/api/backups/flyway_history_WI0005_*.csv && head -1 /opt/fj1/api/backups/flyway_history_WI0005_*.csv | grep -q "installed_rank,version" && wc -l /opt/fj1/api/backups/flyway_history_WI0005_*.csv'`
- **verification_evidence_expected**:
  - command: `ls fj_inspect_WI0005_*.sql`, expected_exit_code: 0, evidence_type: file_exists, expected_output: "BACKUP 文件存在且 wc -l 显示数百行"
  - command: `md5sum jar 对比`, expected_exit_code: 0, evidence_type: checksum_match, expected_output: "JAR_BACKUP_OK"
  - command: `yml bak 检查`, expected_exit_code: 0, evidence_type: file_exists, expected_output: "YML_BACKUP_OK"
  - command: `flyway csv 检查`, expected_exit_code: 0, evidence_type: csv_export, expected_output: "CSV 表头正确 + 8 行（1 表头+7 数据）"
- **out_of_scope**: 不修改任何运行中文件；不停止服务；不执行 repair/migrate

---

### TASK-2 阶段 B：准备迁移文件目录（V1-V8 共 8 个文件）

**context_block**（executor 必读）：
- **What**: 在 svr-lg 组装完整的 Flyway 迁移文件目录 `/tmp/flyway-migrations/`（V1-V8），供 TASK-3 的 Flyway CLI 和 TASK-5 的 jar 修补使用：
  1. B1: `scp` 本地修复后的 V3 + 新建 V8 到 svr-lg `/tmp/`
  2. B2: 从当前 jar 提取 V1-V7 到 `/tmp/flyway-migrations/`（`unzip -j`）
  3. B3: 用修复版 V3 覆盖提取的旧 V3 + 添加 V8
- **Why**: Flyway CLI (TASK-3/4) 需要读取修复后的 V3 计算 checksum；jar 修补 (TASK-5) 需要修复版 V3 和 V8 文件。必须先组装完整目录。
- **Refs**: 阶段 B（步骤 B1-B3），见 design.md L145-L215
- **Constraints**:
  - 不停机
  - V3 修复版必须含 `INSERT INTO projects (0)` 种子数据
  - V8 必须是 WI-0004 创建的幂等迁移文件（IF NOT EXISTS + DO 块）
  - 提取后 V3 的 `INSERT INTO projects` 计数应为 0（jar 内是旧版），覆盖后应为 1
  - 最终 `/tmp/flyway-migrations/` 必须有 V1-V8 共 8 个文件
  - 本地 scp 源文件只读，不修改源码仓库
- **Done When**:
  - `/tmp/flyway-migrations/` 含 V1-V8 共 8 个 `.sql` 文件
  - V3 的 `grep -c "INSERT INTO projects"` = **1**（修复版）
  - V8 的 `grep -c "fix_schema_mismatches"` = **1**（存在且内容正确）

**ops_steps**:
1. B1: `scp fj-backend/.../V3__project_tables.sql lg:/tmp/V3__project_tables.sql` + `scp .../V8__fix_schema_mismatches.sql lg:/tmp/V8__fix_schema_mismatches.sql` + 验证传输
2. B2: `ssh lg 'rm -rf /tmp/flyway-migrations && mkdir -p /tmp/flyway-migrations && cd /tmp/flyway-migrations && unzip -j -o /opt/fj1/api/fj-api-1.0.0.jar "BOOT-INF/classes/db/migration/V*.sql"'`（预期提取 V1-V7，V3 INSERT 计数=0）
3. B3: `ssh lg 'cp /tmp/V3__project_tables.sql /tmp/flyway-migrations/ && cp /tmp/V8__fix_schema_mismatches.sql /tmp/flyway-migrations/'`（预期 V3 INSERT=1, V8 存在）

- **依赖**: [TASK-1]
- refs: [阶段-B, B1, B2, B3, AC-1]
- requires_user_confirmation: false
- parallel: false
- **远程目标文件** (remote_targets):
  - `svr-lg:/tmp/V3__project_tables.sql` (创建, B1 scp)
  - `svr-lg:/tmp/V8__fix_schema_mismatches.sql` (创建, B1 scp)
  - `svr-lg:/tmp/flyway-migrations/V*.sql` (创建, B2 unzip + B3 cp)
- **本地 allowed_write_files**: `[]`（scp 源只读）
- **verification_commands**:
  - `ssh lg 'ls /tmp/flyway-migrations/V*.sql | wc -l'`
  - `ssh lg 'test $(grep -c "INSERT INTO projects" /tmp/flyway-migrations/V3__project_tables.sql) -eq 1 && echo V3_FIXED_OK'`
  - `ssh lg 'test $(grep -c "fix_schema_mismatches" /tmp/flyway-migrations/V8__fix_schema_mismatches.sql) -ge 1 && echo V8_PRESENT_OK'`
  - `ssh lg 'ls /tmp/flyway-migrations/V1__*.sql /tmp/flyway-migrations/V7__*.sql 2>/dev/null && echo V1V7_PRESENT'`
- **verification_evidence_expected**:
  - command: `ls V*.sql | wc -l`, expected_exit_code: 0, evidence_type: file_count, expected_output: "8"
  - command: `grep INSERT V3`, expected_exit_code: 0, evidence_type: content_check, expected_output: "V3_FIXED_OK"
  - command: `grep V8`, expected_exit_code: 0, evidence_type: content_check, expected_output: "V8_PRESENT_OK"
- **out_of_scope**: 不修改 jar；不执行 repair/migrate；不修改源码仓库

---

### TASK-3 阶段 C：安装 Flyway CLI 9.22.3（多镜像 fallback）

**context_block**（executor 必读）：
- **What**: 在 svr-lg 安装 Flyway CLI 9.22.3（用于 TASK-4 的 repair）：
  1. C1: 下载 `flyway-commandline-9.22.3-linux-x64.tar.gz`（3 个镜像 fallback：Maven Central / 阿里云 / 腾讯云）
  2. C2: 解压到 `/opt/flyway-9.22.3/` + 生成 `flyway.conf`（从 `.env` 读取 DB 连接信息）
- **Why**: Flyway repair 需要 CLI 工具重新计算 V3 的 checksum 并更新 flyway_schema_history。svr-lg 当前无 Flyway CLI。
- **Refs**: 阶段 C（步骤 C1-C2），见 design.md L218-L293
- **Constraints**:
  - 不停机
  - **网络依赖**：若 3 个镜像全部下载失败（exit code 2）→ 切换方案 B（Python checksum，见 TASK-4 fallback）
  - flyway.conf 密码从 `.env` 读取，配置文件中密码需脱敏展示
  - flyway.locations 指向 `/tmp/flyway-migrations`（TASK-2 产出）
  - flyway.validateOnMigrate=false（repair 阶段不校验）
  - Flyway 9.22.3 需 Java 8+，svr-lg 有 JRE 17（满足）
  - **版本兼容性**：jar 内 Flyway 应为 9.x（Spring Boot 3.x 标准依赖）。若需精确匹配，可先检查 `unzip -l jar | grep flyway-core`
- **Done When**:
  - `/opt/flyway-9.22.3/flyway` 可执行，`flyway -v` 输出 `Flyway Community Edition 9.22.3`
  - `/opt/flyway-9.22.3/conf/flyway.conf` 存在，含正确 url/user/password/locations
  - 所有镜像失败时输出 `FALLBACK_REQUIRED` 并 exit 2（触发方案 B）

**ops_steps**:
1. C1: `ssh lg 'FLYWAY_VERSION=9.22.3 && for URL in Maven阿里腾讯; do curl -sfL ... && break; done; if 失败 exit 2'`
2. C2: `ssh lg 'cd /opt && tar xzf /tmp/flyway-commandline-9.22.3-linux-x64.tar.gz && cat > /opt/flyway-9.22.3/conf/flyway.conf <<CONF ... CONF && /opt/flyway-9.22.3/flyway -v'`

- **依赖**: [TASK-2]（flyway.conf 的 locations 指向 TASK-2 产出的 `/tmp/flyway-migrations`）
- refs: [阶段-C, C1, C2]
- requires_user_confirmation: false
- parallel: false
- **远程目标文件** (remote_targets):
  - `svr-lg:/tmp/flyway-commandline-9.22.3-linux-x64.tar.gz` (创建, C1 下载)
  - `svr-lg:/opt/flyway-9.22.3/**` (创建, C2 解压)
  - `svr-lg:/opt/flyway-9.22.3/conf/flyway.conf` (创建, C2 配置)
- **本地 allowed_write_files**: `[]`
- **verification_commands**:
  - `ssh lg '/opt/flyway-9.22.3/flyway -v 2>&1 | grep -q "9.22.3" && echo FLYWAY_CLI_OK'`
  - `ssh lg 'grep -q "flyway.url=jdbc:postgresql://127.0.0.1:5432/fj_inspect" /opt/flyway-9.22.3/conf/flyway.conf && grep -q "flyway.locations=filesystem:/tmp/flyway-migrations" /opt/flyway-9.22.3/conf/flyway.conf && echo CONF_OK'`
- **verification_evidence_expected**:
  - command: `flyway -v`, expected_exit_code: 0, evidence_type: cli_version, expected_output: "FLYWAY_CLI_OK (含 9.22.3)"
  - command: `grep flyway.conf`, expected_exit_code: 0, evidence_type: config_check, expected_output: "CONF_OK"
- **out_of_scope**: 不执行 repair/migrate（TASK-4）；不修改 jar；方案 B（Python）仅在 C1 失败时由 TASK-4 处理

---

### TASK-4 阶段 D：D-PreCheck + Flyway repair（⚠️ 破坏性，修改 flyway_schema_history）

**context_block**（executor 必读）：
- **What**: 执行破坏性 repair 操作，同步 V3 的 checksum：
  1. D-PreCheck: 检查 `export_files.export_status` 是否 NOT NULL（若缺则条件性 ALTER，破坏性）
  2. D1: `flyway repair` — 读取 TASK-2 的修复版 V3，重新计算 checksum，UPDATE flyway_schema_history V3 记录
  3. D2: 验证 repair 结果（V3 checksum 已变更，其他版本不变，所有 success=t）
- **Why**: jar 内 V3 已修复（含 INSERT），但 flyway_schema_history 记录的是旧 V3 的 checksum。如果不 repair，TASK-6 启动时 Flyway validate 会因 checksum 不匹配而失败（FlywayValidateException）。repair 是同步 checksum 的唯一方式。
- **Refs**: 阶段 D（步骤 D-PreCheck, D1-D2），见 design.md L296-L442
- **Constraints**:
  - 不停机（repair 不影响运行中的服务）
  - **⚠️ 破坏性操作**：repair 修改 flyway_schema_history 元数据（V3 checksum 字段）
  - **requires_user_confirmation: true**（用户必须确认理解 repair 风险）
  - **回滚**：repair 失败 → R-D1（恢复 A4 导出的 flyway_history CSV）
  - **方案 B fallback**：若 TASK-3 的 Flyway CLI 不可用（下载失败/版本不兼容），切换 Python 手算 checksum（design.md L322-L384，风险：CRC32 算法可能不完全匹配）
  - D-PreCheck 若发现 export_status 缺 NOT NULL → 条件性 ALTER（额外破坏性操作，需用户确认）
  - repair 仅更新有差异的记录（预期仅 V3），不影响 V1/V2/V4-V7
- **Done When**:
  - D-PreCheck: export_files 三列（error_message/export_status/file_hash）存在；export_status 为 NOT NULL（或已 ALTER 修复）；users.status 为 integer
  - D1: `flyway repair` 输出 `Repair ... was successful`，REPAIR_EXIT_CODE=0
  - D2: V3 checksum 与 A4 导出的旧值**不同**（已更新）；V1-V7 共 7 行不变；所有 success=t

**ops_steps**:
1. D-PreCheck: `ssh lg 'source .env && psql ... SELECT column_name,is_nullable FROM information_schema.columns WHERE export_files'`（若 export_status nullable=YES → 需用户确认后 ALTER SET NOT NULL + DEFAULT 'SUCCESS'）
2. D1: `ssh lg '/opt/flyway-9.22.3/flyway repair 2>&1 | tee /tmp/flyway_repair_WI0005.log'`（预期 REPAIR_EXIT_CODE=0）
3. D2: `ssh lg 'source .env && psql ... SELECT version,checksum,success FROM flyway_schema_history ORDER BY installed_rank'` + 对比 A4 CSV

- **依赖**: [TASK-3]（需要 Flyway CLI）+ [TASK-1]（需要 A4 的 flyway_history CSV 用于对比/回滚）
- refs: [阶段-D, D-PreCheck, D1, D2, AC-1]
- requires_user_confirmation: **true**（破坏性：repair 修改元数据 + 可能的条件性 ALTER）
- parallel: false
- **远程目标文件** (remote_targets):
  - `svr-lg:flyway_schema_history` (修改, D1 UPDATE V3 checksum)
  - `svr-lg:export_files` (条件性修改, D-PreCheck ALTER export_status)
  - `svr-lg:/tmp/flyway_repair_WI0005.log` (创建, D1 日志)
- **本地 allowed_write_files**: `[]`
- **verification_commands**:
  - `ssh lg 'source /opt/fj1/api/.env && PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect -t -c "SELECT count(*) FROM flyway_schema_history WHERE success=true;" | tr -d " " | grep -qx "7" && echo FLYWAY_V1V7_SUCCESS_OK'`
  - `ssh lg 'source /opt/fj1/api/.env && PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect -t -c "SELECT is_nullable FROM information_schema.columns WHERE table_name='\''export_files'\'' AND column_name='\''export_status'\'';" | tr -d " " | grep -qx "NO" && echo EXPORT_STATUS_NOTNULL_OK'`
  - `ssh lg 'source /opt/fj1/api/.env && OLD_CS=$(grep "^3," /opt/fj1/api/backups/flyway_history_WI0005_*.csv | cut -d, -f6) && NEW_CS=$(PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect -t -c "SELECT checksum FROM flyway_schema_history WHERE version='\''3'\'';" | tr -d " ") && [ "$OLD_CS" != "$NEW_CS" ] && echo V3_CHECKSUM_UPDATED_OK'`
- **verification_evidence_expected**:
  - command: `count success=true`, expected_exit_code: 0, evidence_type: db_query, expected_output: "FLYWAY_V1V7_SUCCESS_OK (7 行)"
  - command: `export_status NOT NULL`, expected_exit_code: 0, evidence_type: schema_check, expected_output: "EXPORT_STATUS_NOTNULL_OK"
  - command: `V3 checksum 对比`, expected_exit_code: 0, evidence_type: checksum_diff, expected_output: "V3_CHECKSUM_UPDATED_OK (新旧 checksum 不同)"
- **out_of_scope**: 不停止服务；不执行 migrate（V8 由 TASK-6 启动时触发）；不修改 jar（TASK-5）

---

### TASK-5 阶段 E：停机 + 修补 jar + 更新 yml（⚠️ 停机窗口开始）

**context_block**（executor 必读）：
- **What**: 停止服务，修补 jar 内部文件，更新外部配置（**停机窗口**）：
  1. E1: `systemctl stop fj-api`（停机开始）
  2. E2: 用 `zip` 修补 jar — 更新 `BOOT-INF/classes/db/migration/V3__project_tables.sql`（修复版）+ 添加 `BOOT-INF/classes/db/migration/V8__fix_schema_mismatches.sql`
  3. E3: `sed` 更新外部 `application-prod.yml`：`ddl-auto: none` → `ddl-auto: validate`
  4. E4: 验证修补结果（jar 内 V3 有 INSERT + V8 存在 + jar 完整性 + yml 正确）
- **Why**: 这是本 WI 的核心操作 — 让 jar 内部包含修复版 V3 和 V8，并恢复 ddl-auto=validate。E1 停机是必须的（不能在运行时修改 jar）。修补方案采用 zip/unzip（因本地无 maven/JDK17，svr-lg 无 javac/maven，无法标准构建）。
- **Refs**: 阶段 E（步骤 E1-E4），见 design.md L445-L556
- **Constraints**:
  - **⚠️ 停机窗口**：E1 后服务不可用，直到 TASK-6 F2 health=UP
  - **requires_user_confirmation: true**（用户必须确认停机窗口）
  - E2 修补需构建 `/tmp/jar-patch/BOOT-INF/classes/db/migration/` 目录结构以匹配 jar 内部路径
  - E3 sed 仅替换 `ddl-auto: none` → `validate`，不影响其他行
  - **回滚**：E2/E4 jar 损坏 → R-E2（恢复 A2 jar 备份）；E3 yml 错误 → R-E3（恢复 A3 yml 备份）
  - jar 修补后必须 `unzip -t` 验证完整性
  - 机密不泄露（不涉及密码操作）
- **Done When**:
  - E1: `systemctl is-active fj-api` = inactive，pgrep 无 fj-api 进程
  - E2: jar 内 V3 的 `INSERT INTO projects` 计数 = **1**（修复版已注入）
  - E2: jar 内 V8 文件存在（`unzip -l` 列出）
  - E3: `ddl-auto: validate`，yml YAML 语法有效（YAML_VALID）
  - E4: `unzip -t` 显示 `No errors detected`，新 jar 比旧 jar 略大

**ops_steps**:
1. E1: `ssh lg 'systemctl stop fj-api && sleep 2 && systemctl is-active fj-api; pgrep -f fj-api-1.0.0.jar || echo NO_PROCESS'`
2. E2: `ssh lg 'mkdir -p /tmp/jar-patch/BOOT-INF/classes/db/migration && cp /tmp/flyway-migrations/V3__*.sql /tmp/flyway-migrations/V8__*.sql /tmp/jar-patch/BOOT-INF/classes/db/migration/ && cd /tmp/jar-patch && zip -u /opt/fj1/api/fj-api-1.0.0.jar BOOT-INF/classes/db/migration/V3__project_tables.sql && zip /opt/fj1/api/fj-api-1.0.0.jar BOOT-INF/classes/db/migration/V8__fix_schema_mismatches.sql'`
3. E3: `ssh lg 'sed -i "s/ddl-auto: none/ddl-auto: validate/" /opt/fj1/api/application-prod.yml && grep ddl-auto && python3 yaml 校验'`
4. E4: `ssh lg 'unzip -p jar .../V3 | grep -c INSERT && unzip -l jar | grep V8 && unzip -t jar'`

- **依赖**: [TASK-4]（repair 完成，checksum 已同步；export_status NOT NULL 已确认）
- refs: [阶段-E, E1, E2, E3, E4, AC-2]
- requires_user_confirmation: **true**（停机窗口 + jar 修补破坏性）
- parallel: false
- **远程目标文件** (remote_targets):
  - `svr-lg:/opt/fj1/api/fj-api-1.0.0.jar` (修改, E2 zip 修补 V3+V8)
  - `svr-lg:/opt/fj1/api/application-prod.yml` (修改, E3 sed ddl-auto)
  - `svr-lg:/tmp/jar-patch/**` (创建临时, E2 工作目录)
  - `svr-lg:systemd fj-api` (控制, E1 stop)
- **本地 allowed_write_files**: `[]`
- **verification_commands**:
  - `ssh lg 'systemctl is-active fj-api 2>/dev/null; pgrep -f "fj-api-1.0.0.jar" && echo UNEXPECTED_PROCESS || echo STOPPED_OK'`
  - `ssh lg 'test $(unzip -p /opt/fj1/api/fj-api-1.0.0.jar BOOT-INF/classes/db/migration/V3__project_tables.sql | grep -c "INSERT INTO projects") -eq 1 && echo JAR_V3_FIXED_OK'`
  - `ssh lg 'unzip -l /opt/fj1/api/fj-api-1.0.0.jar | grep -q "V8__fix_schema_mismatches" && echo JAR_V8_ADDED_OK'`
  - `ssh lg 'grep -qx "ddl-auto: validate" <(grep "ddl-auto" /opt/fj1/api/application-prod.yml) 2>/dev/null || grep -q "ddl-auto: validate" /opt/fj1/api/application-prod.yml && echo YML_DDL_VALIDATE_OK'`
  - `ssh lg 'unzip -t /opt/fj1/api/fj-api-1.0.0.jar > /tmp/jar_test.log 2>&1 && tail -1 /tmp/jar_test.log | grep -q "No errors detected" && echo JAR_INTEGRITY_OK'`
- **verification_evidence_expected**:
  - command: `systemctl is-active`, expected_exit_code: 0, evidence_type: service_state, expected_output: "STOPPED_OK (inactive + 无进程)"
  - command: `jar V3 INSERT`, expected_exit_code: 0, evidence_type: content_check, expected_output: "JAR_V3_FIXED_OK"
  - command: `jar V8 存在`, expected_exit_code: 0, evidence_type: file_in_jar, expected_output: "JAR_V8_ADDED_OK"
  - command: `yml ddl-auto`, expected_exit_code: 0, evidence_type: config_check, expected_output: "YML_DDL_VALIDATE_OK"
  - command: `jar 完整性`, expected_exit_code: 0, evidence_type: integrity_check, expected_output: "JAR_INTEGRITY_OK (No errors detected)"
- **out_of_scope**: 不启动服务（TASK-6）；不执行 flyway migrate（TASK-6 启动时触发）；不修改 systemd unit/.env/nginx

---

### TASK-6 阶段 F：启动服务 + Flyway 自动 migrate V8

**context_block**（executor 必读）：
- **What**: 启动 fj1-api，触发 Flyway 自动执行 V8 迁移，验证启动成功：
  1. F1: `systemctl start fj-api`（等待最多 90 秒 health=UP；Flyway 启动时自动 migrate V8）
  2. F2: 验证 health=UP（systemctl active + pgrep 有进程 + curl health）
  3. F3: 验证 flyway_schema_history V1-V8 共 8 行全部 success=t
- **Why**: 启动服务并应用 V8 迁移（补列/扩展类型，大部分幂等跳过）。这是验证 TASK-4 (repair) + TASK-5 (jar 修补 + ddl-auto=validate) 是否成功的关键步骤。若 ddl-auto=validate 暴露 schema 不匹配，启动会失败。
- **Refs**: 阶段 F（步骤 F1-F3），见 design.md L559-L640
- **Constraints**:
  - **停机窗口结束**：F2 health=UP 后服务恢复
  - F1 启动可能触发 V8 DDL 变更（破坏性，但 V8 幂等 + 有 A1 数据库备份）
  - **启动失败处理**：
    - Schema-validation 错误 → R-F1（恢复 ddl-auto=none + jar 备份 + 重启）
    - Flyway migrate 报错 → R-F1-DB（pg_dump 恢复数据库）
    - 超时 90 秒未 UP → 查看日志排查
  - 启动日志应显示 `Migrating schema "public" to version "8"` + `Successfully applied 1 migration`
  - **无** Schema-validation 错误，**无** FlywayValidateException
  - V8 幂等性：svr-lg export_files 列已存在（IF NOT EXISTS 跳过），users.status 已 integer（DO 块跳过），仅 file_hash 扩展实际执行
- **Done When**:
  - F1: 启动日志含 `Started FjApiApplication` + `profile is active: "prod"` + V8 迁移成功
  - F2: `curl health` = `{"status":"UP"}`，systemctl active，pgrep 有 PID
  - F3: flyway_schema_history V1-V8 共 8 行，count(success=true) = **8**

**ops_steps**:
1. F1: `ssh lg 'systemctl start fj-api && for i in $(seq 1 18); do sleep 5; HEALTH=$(curl ...); if UP break; done && tail -50 fj-api.log | grep -E "Started|Flyway|ERROR|Schema-validation|Migrating|Successfully"'`
2. F2: `ssh lg 'curl -sf localhost:8080/api/actuator/health | python3 -m json.tool && systemctl is-active fj-api && pgrep -f fj-api-1.0.0.jar'`
3. F3: `ssh lg 'source .env && psql ... SELECT version,success FROM flyway_schema_history ORDER BY installed_rank && SELECT count(*) WHERE success=true'`

- **依赖**: [TASK-5]（jar 已修补 + yml 已更新 + 服务已停止待启动）
- refs: [阶段-F, F1, F2, F3, AC-1, AC-2, AC-3]
- requires_user_confirmation: false（V8 幂等 + 有完整备份；停机已在 TASK-5 确认）
- parallel: false
- **远程目标文件** (remote_targets):
  - `svr-lg:flyway_schema_history` (修改, V8 新增记录)
  - `svr-lg:systemd fj-api` (控制, start)
  - `svr-lg:/opt/fj1/api/logs/fj-api.log` (产生, 启动日志)
- **本地 allowed_write_files**: `[]`
- **verification_commands**:
  - `ssh lg 'curl -sf localhost:8080/api/actuator/health | python3 -c "import sys,json; print(json.load(sys.stdin)[\"status\"])" | grep -qx "UP" && echo HEALTH_UP_OK'`
  - `ssh lg 'systemctl is-active fj-api | grep -qx "active" && echo SERVICE_ACTIVE_OK'`
  - `ssh lg 'source /opt/fj1/api/.env && PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect -t -c "SELECT count(*) FROM flyway_schema_history WHERE success=true;" | tr -d " " | grep -qx "8" && echo FLYWAY_V1V8_SUCCESS_OK'`
  - `ssh lg 'grep -c "Schema-validation" /opt/fj1/api/logs/fj-api.log'`（注意：此命令检查全文历史，需结合时间窗口判断；executor 应检查最近启动的日志段落）
- **verification_evidence_expected**:
  - command: `curl health`, expected_exit_code: 0, evidence_type: http_check, expected_output: "HEALTH_UP_OK"
  - command: `systemctl is-active`, expected_exit_code: 0, evidence_type: service_state, expected_output: "SERVICE_ACTIVE_OK"
  - command: `count success=true`, expected_exit_code: 0, evidence_type: db_query, expected_output: "FLYWAY_V1V8_SUCCESS_OK (8 行)"
- **out_of_scope**: 不做前端访问验证（TASK-7）；不做 admin 登录验证（TASK-7）；不做内存日志检查（TASK-7）

---

### TASK-7 阶段 G：最终全链路验证（ddl-auto/前端/登录/内存/日志）

**context_block**（executor 必读）：
- **What**: 全链路验证系统功能正常，覆盖全部 7 个验收标准：
  1. G1: ddl-auto=validate 启动成功验证（日志无 Schema-validation 错误）
  2. G2: 前端访问验证（HTTP 200 + nginx 代理 health UP）
  3. G3: admin 登录验证 + export_files schema 验证
  4. G4: 内存 + 错误日志检查（RSS ≥ 500MB 无 OOM，无 ERROR/EXCEPTION）
- **Why**: 这是 ops_task 的最终验收环节，确认所有 7 个 AC 全部满足。若任一 AC 失败，需触发对应回滚（见 design.md 回滚触发条件表）。
- **Refs**: 阶段 G（步骤 G1-G4），见 design.md L643-L749
- **Constraints**:
  - 不停机（只读验证）
  - G1 检查启动日志的最近一次启动段落（非全文历史）
  - G3 admin 密码 `admin123`（种子环境默认，非生产机密）
  - G4 内存检查 RSS 预计 300-600MB（种子环境）
  - 若 G1 Schema-validation 错误数 > 0 → 可能需 R-F1 回滚或另立 WI
  - 若 G3 admin 登录失败 → 可能需 R-F1-DB 数据库回滚
- **Done When**:
  - G1: 最近启动日志 Schema-validation 出现次数 = 0；ddl-auto=validate；profile=prod
  - G2: 前端首页 HTTP 200；nginx 代理 API health=UP
  - G3: admin 登录返回 token（LOGIN_SUCCESS）；export_files 三列正确（error_message varchar(1024) nullable / export_status varchar(32) NOT NULL / file_hash varchar(128)）
  - G4: health 详细信息正常；RSS ≥ 500MB；无 ERROR/EXCEPTION；systemctl active (running)

**ops_steps**:
1. G1: `ssh lg 'grep -c "Schema-validation" 最近启动日志 && grep ddl-auto yml && grep "profile is active" 日志'`
2. G2: `ssh lg 'curl -sf -o /dev/null -w "%{http_code}" http://localhost/ && curl -sf http://localhost/api/actuator/health'`
3. G3: `ssh lg 'curl -X POST localhost:8080/api/auth/login -d {admin/admin123} && psql export_files columns'`
4. G4: `ssh lg 'curl health details && ps aux | grep fj-api && tail -100 fj-api.log | grep -iE ERROR|EXCEPTION && systemctl status fj-api'`

- **依赖**: [TASK-6]（服务已启动 + health=UP + V8 已 migrate）
- refs: [阶段-G, G1, G2, G3, G4, AC-2, AC-3, AC-4, AC-5, AC-6]
- requires_user_confirmation: false
- parallel: false
- **远程目标文件** (remote_targets): 无（纯只读验证）
- **本地 allowed_write_files**: `[]`
- **verification_commands**:
  - `ssh lg 'grep "ddl-auto" /opt/fj1/api/application-prod.yml | grep -q "validate" && echo AC2_DDL_VALIDATE_OK'`
  - `ssh lg 'curl -sf -o /dev/null -w "%{http_code}" http://localhost/ | grep -qx "200" && echo AC4_FRONTEND_200_OK'`
  - `ssh lg 'curl -sf http://localhost/api/actuator/health | python3 -c "import sys,json; print(json.load(sys.stdin)[\"status\"])" | grep -qx "UP" && echo AC3_NGINX_HEALTH_UP_OK'`
  - `ssh lg 'ps aux | grep "[f]j-api-1.0.0.jar" | awk "{print \$6/1024}" | head -1'`（输出 RSS MB，executor 判断 ≥ 500MB 则 AC-5 通过；若 < 500MB 需排查但未必 OOM）
  - `ssh lg 'tail -100 /opt/fj1/api/logs/fj-api.log | grep -icE "(ERROR|EXCEPTION|FATAL)" || echo 0'`（输出错误计数，executor 判断是否为 0 或可忽略 WARN）
  - `ssh lg 'source /opt/fj1/api/.env && PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect -t -c "SELECT count(*) FROM information_schema.columns WHERE table_name='\''export_files'\'' AND column_name IN ('\''error_message'\'','\''export_status'\'','\''file_hash'\'');" | tr -d " " | grep -qx "3" && echo AC_EXPORT_FILES_COLS_OK'`
- **verification_evidence_expected**:
  - command: `ddl-auto 检查`, expected_exit_code: 0, evidence_type: config_check, expected_output: "AC2_DDL_VALIDATE_OK"
  - command: `前端 HTTP`, expected_exit_code: 0, evidence_type: http_status, expected_output: "AC4_FRONTEND_200_OK (200)"
  - command: `nginx health`, expected_exit_code: 0, evidence_type: http_check, expected_output: "AC3_NGINX_HEALTH_UP_OK"
  - command: `export_files 三列`, expected_exit_code: 0, evidence_type: schema_check, expected_output: "AC_EXPORT_FILES_COLS_OK (3)"
  - command: `内存 RSS`, expected_exit_code: 0, evidence_type: process_metric, expected_output: "RSS 数值（MB），executor 判断 ≥ 500MB"
  - command: `错误日志`, expected_exit_code: 0, evidence_type: log_scan, expected_output: "计数（executor 判断 0 或可忽略）"
- **out_of_scope**: 不清理临时文件（TASK-8）；不做压力测试；不修改任何配置

---

### TASK-8 阶段 H：清理临时文件（可选）

**context_block**（executor 必读）：
- **What**: 清理 TASK-2/TASK-3/TASK-5 产生的临时文件，保留备份：
  1. H1: 删除 `/tmp/flyway-migrations`、`/tmp/jar-patch`、`/tmp/V3__*.sql`、`/tmp/V8__*.sql`、`/tmp/flyway-commandline-*.tar.gz`
  2. 保留：所有 `.bak.WI0005` 备份 + `backups/*WI0005*`（建议保留至少 7 天）
  3. 可选保留：`/opt/flyway-9.22.3/`（备后续 WI 使用）
- **Why**: 清理临时文件释放磁盘空间；保留备份以便回滚（7 天观察期）。
- **Refs**: 阶段 H（步骤 H1），见 design.md L752-L780
- **Constraints**:
  - 不停机
  - 仅删除 `/tmp/` 临时文件，不删除 `/opt/fj1/api/*.bak.WI0005` 和 `backups/*WI0005*`
  - **建议保留** `/opt/flyway-9.22.3/`（后续 WI 可能再用）
  - 此 task 为**可选**（若磁盘空间充足可跳过）
- **Done When**:
  - `/tmp/flyway-migrations`、`/tmp/jar-patch` 不存在
  - `/tmp/V3__*.sql`、`/tmp/V8__*.sql`、`/tmp/flyway-commandline-*.tar.gz` 不存在
  - `CLEANUP_DONE` 输出
  - 备份文件仍存在（jar.bak.WI0005 / yml.bak.WI0005 / fj_inspect_WI0005_*.sql / flyway_history_WI0005_*.csv）

**ops_steps**:
1. H1: `ssh lg 'rm -rf /tmp/flyway-migrations /tmp/jar-patch && rm -f /tmp/V3__project_tables.sql /tmp/V8__fix_schema_mismatches.sql /tmp/flyway-commandline-*.tar.gz && echo CLEANUP_DONE && ls -la /opt/fj1/api/*.bak.WI0005 /opt/fj1/api/backups/*WI0005*'`

- **依赖**: [TASK-7]（验证全部通过后才清理）
- refs: [阶段-H, H1]
- requires_user_confirmation: false
- parallel: false
- **远程目标文件** (remote_targets):
  - `svr-lg:/tmp/flyway-migrations` (删除)
  - `svr-lg:/tmp/jar-patch` (删除)
  - `svr-lg:/tmp/V3__project_tables.sql` (删除)
  - `svr-lg:/tmp/V8__fix_schema_mismatches.sql` (删除)
  - `svr-lg:/tmp/flyway-commandline-*.tar.gz` (删除)
- **本地 allowed_write_files**: `[]`
- **verification_commands**:
  - `ssh lg 'test ! -d /tmp/flyway-migrations && test ! -d /tmp/jar-patch && echo TMP_CLEANED_OK'`
  - `ssh lg 'ls /opt/fj1/api/fj-api-1.0.0.jar.bak.WI0005 /opt/fj1/api/application-prod.yml.bak.WI0005 /opt/fj1/api/backups/fj_inspect_WI0005_*.sql /opt/fj1/api/backups/flyway_history_WI0005_*.csv 2>/dev/null | wc -l'`（输出备份数，应 ≥ 4）
- **verification_evidence_expected**:
  - command: `tmp 目录检查`, expected_exit_code: 0, evidence_type: file_absence, expected_output: "TMP_CLEANED_OK"
  - command: `备份保留检查`, expected_exit_code: 0, evidence_type: file_count, expected_output: "≥ 4（jar/yml/db/csv 四重备份）"
- **out_of_scope**: 不删除 `.bak.WI0005` 备份；不删除 `/opt/flyway-9.22.3/`；不删除 `backups/*WI0005*`

---

## 回滚方案快速索引（executor 参考）

> 详细回滚命令见 design.md L783-L866。executor 遇到失败时按此表执行回滚。

| 失败步骤 | 回滚 ID | 回滚操作 | 数据影响 |
|----------|---------|----------|----------|
| TASK-1 A1/A4 失败 | N/A | **停止全部操作**（无备份不可继续） | 无 |
| TASK-3 C1 全部镜像失败 | 方案 B | TASK-4 切换 Python checksum | 无 |
| TASK-4 D1 repair 失败 | R-D1 | 恢复 A4 flyway_history CSV | 仅元数据 |
| TASK-5 E2/E4 jar 损坏 | R-E2 | 恢复 A2 jar 备份 `cp .bak.WI0005 jar` | 无 |
| TASK-5 E3 yml 错误 | R-E3 | 恢复 A3 yml 备份 `cp .bak.WI0005 yml` | 无 |
| TASK-6 F1 启动失败 | R-F1 | 恢复 jar+yml+repair checksum+重启 | 无 |
| TASK-6 F1 V8 migrate 失败 | R-F1-DB | pg_dump 恢复数据库 | 回退 schema 变更 |

---

## 自检（Task Planner 完成前）

| 规则 | 检查 | 通过 |
|------|------|------|
| T1 单一产物 | 每个 task 对应一个阶段（A-H），不跨阶段 | ✅ |
| T2 上下文充分 | 每个 task 含 What/Why/Refs/Constraints/Done When + ops_steps | ✅ |
| T3 边界清晰 | verification_commands 全为可执行 ssh 命令，返回退出码 | ✅ |
| T4 独立可执行 | 串行依赖链清晰，无循环依赖 | ✅ |
| T5 共享代码先建 | TASK-1 备份是所有后续 task 的前置；TASK-2 迁移目录供 TASK-3/4/5 共享 | ✅ |
| T6 大小控制 | 每个 task 30-200 行，1 个阶段，verification 2-6 条 | ✅ |
| Contract 完整性 | refs/allowed_write_files/forbidden/verification/evidence/out_of_scope 齐全 | ✅ |
| Extension Registry | task_types 为空，使用标准 ops_task tasks 类型，不触发 Extension Subflow | ✅ |
