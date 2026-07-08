# Tasks — WI-0004 (fj1 源码 bug 修复)

> Work Item: WI-0004
> Workflow Type: bugfix_spec
> 来源 design: candidates/design.md（DD-1 ~ DD-5）
> 修复 bug 数: 5（Bug-1 ~ Bug-5）+ 1 项注释修正
> 任务总数: 5

---

## 执行计划

### 批次 1（并行，文件互不重叠、无依赖）

| Task | Bug | 修改文件 | 依赖 |
|------|-----|---------|------|
| TASK-1 | Bug-1 | application-prod.yml | 无 |
| TASK-2 | Bug-5 | install_pg16.sh | 无 |
| TASK-3 | Bug-4 注释 | UserStatusConverter.java, UserStatus.java | 无 |

### 批次 2（串行）

| Task | Bug | 修改文件 | 依赖 |
|------|-----|---------|------|
| TASK-4 | Bug-2 | V3__project_tables.sql | 无（逻辑独立，但建议先于 TASK-5） |
| TASK-5 | Bug-3/4 | V8__fix_schema_mismatches.sql（新建） | TASK-4 |

**串行理由：** TASK-4 修复 V3 的 ADD CONSTRAINT 失败（迁移链断裂点）。若 V3 未修复，迁移在 V3 中断，TASK-5 的 V8 永远不会被执行。因此 TASK-5 必须在 TASK-4 之后。文件层面两者不重叠（V3 vs V8），但执行语义上有强依赖。

---

## code_permission 白名单汇总（供 Orchestrator 调用 sf_code_permission）

```text
TASK-1: deploy/config/application-prod.yml
TASK-2: scripts/ops/install_pg16.sh
TASK-3: fj-backend/fj-system/src/main/java/com/fj/system/entity/UserStatusConverter.java
TASK-3: fj-backend/fj-system/src/main/java/com/fj/system/entity/UserStatus.java
TASK-4: fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql
TASK-5: fj-backend/fj-api/src/main/resources/db/migration/V8__fix_schema_mismatches.sql
```

**注意：** `deploy/systemd/fj-api.service` 已确认第 26 行存在 `Environment="SPRING_PROFILES_ACTIVE=prod"`，**无需修改**，仅作为 TASK-1 的验证目标（只读）。

---

### TASK-1 删除 application-prod.yml 中的 spring.profiles.active（Bug-1）

**context_block**（executor 必读）：
- **What**: 删除 `deploy/config/application-prod.yml` 第 6-8 行的 `spring:` 下 `profiles:` → `active: prod` 两个键，使 `spring:` 顶层下直接是 `datasource:`。
- **Why**: Spring Boot 2.4+（本项目 Spring Boot 3.x）禁止在 profile-specific 文件（`application-{profile}.yml`）中使用 `spring.profiles.active`，会导致 `IllegalStateException: Profiles are not allowed to use 'spring.profiles.active'`，应用无法启动。Profile 激活应交由外部环境控制。
- **Refs**: DD-1（Bug-1 修复，application-prod.yml 移除 spring.profiles.active）；REQ-Bug1；AC-1
- **Constraints**:
  - 仅删除 `profiles:` 键及其子键 `active: prod`（第 7-8 行），保留 `spring:` 顶层键本身（第 6 行 `spring:` 保留，其下 `datasource:` 等子键全部保留）
  - 不修改 application.yml / application-dev.yml
  - 不修改 systemd unit（已确认第 26 行有 `Environment="SPRING_PROFILES_ACTIVE=prod"`）
  - 不修改 .env 模板
  - YAML 缩进保持 2 空格，删除后 `spring:` 下直接接 `datasource:`
  - 注意：`spring:` 是顶层键（第 6 行），`profiles:` 是其下缩进键（第 7 行），`active: prod` 是更深层缩进（第 8 行）。删除第 7-8 行即可，保留第 6 行 `spring:`
- **Done When**:
  - `deploy/config/application-prod.yml` 不再包含 `spring.profiles.active` 或 `profiles:` 键
  - `deploy/config/application-prod.yml` 仍包含 `spring:` 和 `datasource:`（其余配置未被破坏）
  - `deploy/systemd/fj-api.service` 包含 `SPRING_PROFILES_ACTIVE=prod`（profile 激活有保障）

- **依赖**: 无
- refs: [REQ-Bug1, AC-1, DD-1]
- files_to_modify: [deploy/config/application-prod.yml]
- **expected_file_changes**:
  - `deploy/config/application-prod.yml`（modify：删除第 7-8 行 `profiles:` + `active: prod`）
- **allowed_write_files**: [deploy/config/application-prod.yml]
- **forbidden_files**: [deploy/systemd/fj-api.service, deploy/config/application.yml, deploy/config/application-dev.yml, requirements.md, design.md, tasks.md, trace_delta.md, 以及 TASK-2~5 的所有写文件]
- **verification_commands**:
  - `! grep -q 'spring.profiles.active' deploy/config/application-prod.yml`
  - `! grep -qE '^[[:space:]]*profiles:' deploy/config/application-prod.yml`
  - `grep -q 'datasource:' deploy/config/application-prod.yml`
  - `grep -q 'SPRING_PROFILES_ACTIVE=prod' deploy/systemd/fj-api.service`
- **verification_evidence_expected**:
  - 命令1：exit_code=0（spring.profiles.active 已删除，grep 无匹配返回1，取反为0）
  - 命令2：exit_code=0（profiles 键已删除）
  - 命令3：exit_code=0（datasource 配置保留完好）
  - 命令4：exit_code=0（systemd 已设 profile，激活有保障）
- **out_of_scope**:
  - 不修改 systemd unit / .env / application.yml / application-dev.yml
  - 不重写整个 yml 文件结构
  - 不添加新的 profile 激活机制

---

### TASK-2 修正 install_pg16.sh 的 PG13 包名与 initdb 参数（Bug-5）

**context_block**（executor 必读）：
- **What**: 修正 `scripts/ops/install_pg16.sh` 两处错误：
  1. 第 25 行 `PG13_PACKAGES="postgresql-server"` → `PG13_PACKAGES="postgresql13-server"`
  2. 第 143 行 `postgresql-16-setup --initdb` → `postgresql-16-setup initdb`
- **Why**:
  - 第 25 行：脚本整体使用 PGDG 仓库（第 127 行 `dnf install -y postgresql${PG16_VERSION}-server`），同环境的 PG13 也应为 PGDG 包 `postgresql13-server`。`postgresql-server` 是 RHEL 官方包名，导致 `rpm -q postgresql-server`（第 85 行）和 `dnf remove`（第 104 行）无法正确检测/清理 PGDG 安装的 PG13。
  - 第 143 行：PGDG `postgresql16-server` 包提供的 `/usr/pgsql-16/bin/postgresql-16-setup` 接受 `initdb` 作为位置参数（子命令），不接受 `--initdb` GNU 长选项。`--initdb` 被解析为未知选项，命令失败，PG16 数据目录无法初始化。
- **Refs**: DD-5（Bug-5 修复，install_pg16.sh 脚本修正）；REQ-Bug5；AC-5
- **Constraints**:
  - 仅修改第 25 行和第 143 行，不改动脚本其他逻辑
  - 不修改幂等性逻辑（PG16 已装跳过、数据目录已存在跳过）
  - 不修改 pg_hba.conf / postgresql.conf 配置规则
  - 不修改 FJ_DB_PASSWORD 校验逻辑
  - 不修改交互确认流程
  - 第 25 行保持双引号包裹（`PG13_PACKAGES="postgresql13-server"`）
  - 第 143 行 `postgresql-16-setup` 与 `initdb` 之间用单空格分隔（位置参数，无 `--` 前缀）
- **Done When**:
  - `bash -n scripts/ops/install_pg16.sh` 语法检查通过（exit 0）
  - 第 25 行为 `PG13_PACKAGES="postgresql13-server"`（精确匹配）
  - 第 143 行为 `postgresql-16-setup initdb`（精确匹配，无 `--` 前缀）
  - 文件中不再出现 `postgresql-16-setup --initdb`（旧错误模式）

- **依赖**: 无
- refs: [REQ-Bug5, AC-5, DD-5]
- files_to_modify: [scripts/ops/install_pg16.sh]
- **expected_file_changes**:
  - `scripts/ops/install_pg16.sh`（modify：第 25 行 PG13_PACKAGES + 第 143 行 initdb 参数）
- **allowed_write_files**: [scripts/ops/install_pg16.sh]
- **forbidden_files**: [requirements.md, design.md, tasks.md, trace_delta.md, 以及 TASK-1/3/4/5 的所有写文件]
- **verification_commands**:
  - `bash -n scripts/ops/install_pg16.sh`
  - `grep -q 'PG13_PACKAGES="postgresql13-server"' scripts/ops/install_pg16.sh`
  - `grep -q 'postgresql-16-setup initdb' scripts/ops/install_pg16.sh`
  - `! grep -q 'postgresql-16-setup --initdb' scripts/ops/install_pg16.sh`
- **verification_evidence_expected**:
  - 命令1：exit_code=0（bash 语法检查通过）
  - 命令2：exit_code=0（PG13 包名已修正）
  - 命令3：exit_code=0（initdb 参数已修正为位置参数）
  - 命令4：exit_code=0（旧的 --initdb 错误模式已消除）
- **out_of_scope**:
  - 不重构脚本其他逻辑
  - 不处理 PG13→PG16 数据迁移（脚本是全新安装非原地升级）
  - 不修改脚本注释

---

### TASK-3 同步 UserStatusConverter / UserStatus 注释 SMALLINT → INTEGER（Bug-4 附加）

**context_block**（executor 必读）：
- **What**: 更新 2 处误导性注释，将 "SMALLINT" 改为 "INTEGER"：
  1. `fj-backend/fj-system/src/main/java/com/fj/system/entity/UserStatusConverter.java` 第 8 行：`UserStatus <-> SMALLINT JPA 转换器。` → `UserStatus <-> INTEGER JPA 转换器。`
  2. `fj-backend/fj-system/src/main/java/com/fj/system/entity/UserStatus.java` 第 7 行：`用户状态枚举（对应 users.status SMALLINT）。` → `用户状态枚举（对应 users.status INTEGER）。`
- **Why**: 这两处注释声称 SMALLINT，但 Converter 泛型（第 12 行 `AttributeConverter<UserStatus, Integer>`）实际使用 Integer（int4）。这是 Bug-4 根因之一——开发者被注释误导，V1 用 SMALLINT 而 Converter 用 Integer，导致 ddl-auto=validate 类型不匹配启动失败。TASK-5 将 DB 列改为 INTEGER 后，注释、DB 列类型、Converter 泛型三者需一致。
- **Refs**: DD-4（Bug-4 附加，注释同步）；REQ-Bug4；发现-3（requirements.md 新发现第 3 项）
- **Constraints**:
  - **仅修改注释文本，不改任何代码逻辑**（零运行时风险）
  - UserStatusConverter.java 第 8 行：只替换 `SMALLINT` → `INTEGER`，保留该行其余文本（`UserStatus <-> ` 前缀和 ` JPA 转换器。` 后缀）
  - UserStatus.java 第 7 行：只替换 `SMALLINT` → `INTEGER`，保留 `用户状态枚举（对应 users.status ` 前缀和 `）。` 后缀
  - 不修改 Converter 泛型（Integer 是正确设计）
  - 不修改 UserStatus 枚举值（DISABLED=0/ACTIVE=1/LOCKED=2）
  - 不修改 import 或其他行
- **Done When**:
  - UserStatusConverter.java 第 8 行包含 `UserStatus <-> INTEGER`，不再含 `SMALLINT`
  - UserStatus.java 第 7 行包含 `users.status INTEGER`，不再含 `SMALLINT`
  - 两个文件的 Converter 泛型 / 枚举值未被改动

- **依赖**: 无（注释修改与逻辑无关，可与 TASK-1/2/4/5 并行；逻辑上与 TASK-5 的 V8 配合使三者一致，但无文件冲突）
- refs: [REQ-Bug4, DD-4]
- files_to_modify: [fj-backend/fj-system/src/main/java/com/fj/system/entity/UserStatusConverter.java, fj-backend/fj-system/src/main/java/com/fj/system/entity/UserStatus.java]
- **expected_file_changes**:
  - `fj-backend/fj-system/src/main/java/com/fj/system/entity/UserStatusConverter.java`（modify：第 8 行注释 SMALLINT→INTEGER）
  - `fj-backend/fj-system/src/main/java/com/fj/system/entity/UserStatus.java`（modify：第 7 行注释 SMALLINT→INTEGER）
- **allowed_write_files**: [fj-backend/fj-system/src/main/java/com/fj/system/entity/UserStatusConverter.java, fj-backend/fj-system/src/main/java/com/fj/system/entity/UserStatus.java]
- **forbidden_files**: [requirements.md, design.md, tasks.md, trace_delta.md, 以及 TASK-1/2/4/5 的所有写文件]
- **verification_commands**:
  - `grep -q 'UserStatus <-> INTEGER' fj-backend/fj-system/src/main/java/com/fj/system/entity/UserStatusConverter.java`
  - `! grep -q 'SMALLINT' fj-backend/fj-system/src/main/java/com/fj/system/entity/UserStatusConverter.java`
  - `grep -q 'users.status INTEGER' fj-backend/fj-system/src/main/java/com/fj/system/entity/UserStatus.java`
  - `! grep -q 'SMALLINT' fj-backend/fj-system/src/main/java/com/fj/system/entity/UserStatus.java`
  - `grep -q 'AttributeConverter<UserStatus, Integer>' fj-backend/fj-system/src/main/java/com/fj/system/entity/UserStatusConverter.java`
- **verification_evidence_expected**:
  - 命令1：exit_code=0（Converter 注释已改为 INTEGER）
  - 命令2：exit_code=0（Converter 不再含 SMALLINT）
  - 命令3：exit_code=0（UserStatus 注释已改为 INTEGER）
  - 命令4：exit_code=0（UserStatus 不再含 SMALLINT）
  - 命令5：exit_code=0（Converter 泛型未被改动，仍为 Integer）
- **out_of_scope**:
  - 不修改 Converter 泛型类型
  - 不修改枚举 code 值
  - 不修改其他类文件的注释
  - 不修改 V1__base_tables.sql（users.status 的 SMALLINT 由 TASK-5 的 V8 运行时修正）

---

### TASK-4 在 V3 迁移中 ADD CONSTRAINT 前插入系统占位项目 projects(id=0)（Bug-2 方案 B）

**context_block**（executor 必读）：
- **What**: 在 `fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql` 的第 220 行（`-- ===== 10. 补充 V1 占位外键` 注释块）之后、第 222 行（`ALTER TABLE user_project_roles ADD CONSTRAINT fk_upr_project ...`）之前，插入一段 INSERT 语句，创建 id=0 的系统占位项目记录。
- **Why**: V2 种子数据为 admin 全局角色插入了 `user_project_roles(project_id=0)`（第 106 行 `SELECT u.id, 0, r.id`）。V3 在创建 projects 表后执行 `ADD CONSTRAINT fk_upr_project FOREIGN KEY (project_id) REFERENCES projects(id)`，PostgreSQL 默认校验已有数据。此时 projects 表为空（无 id=0 记录），FK 校验失败，V3 迁移中断，后续 V4-V8 均不执行，应用无法启动。在 ADD CONSTRAINT 前插入 projects(id=0) 系统占位项目，使 project_id=0 有对应记录，FK 校验通过。
- **Refs**: DD-2（Bug-2 修复，V3 插入系统占位项目，方案 B）；REQ-Bug2；AC-2；AC-7
- **Constraints**:
  - 插入位置必须在 `ALTER TABLE user_project_roles ADD CONSTRAINT fk_upr_project` **之前**（顺序是 FK 校验通过的关键）
  - INSERT 必须使用 `OVERRIDING SYSTEM VALUE`（projects.id 是 GENERATED ALWAYS AS IDENTITY，禁止手动插入指定值，除非用此子句）
  - projects 表列约束逐项：id=0（IDENTITY，用 OVERRIDING SYSTEM VALUE）；name='系统占位项目'（NOT NULL VARCHAR128）；code='SYSTEM'（UNIQUE）；status='ARCHIVED'（CHECK 约束允许值之一）；description='全局角色关联锚点（非业务项目，禁止删除）'（VARCHAR512）
  - id=0 不推进 IDENTITY 序列（序列默认 START WITH 1），后续业务 INSERT 从 1 开始，无冲突
  - 不修改 V2（admin 全局角色关联逻辑保留不变）
  - 不修改 V1（project_id NOT NULL 约束保留不变）
  - 不修改 V3 的其他部分（仅在第 221 行后新增 INSERT 段）
  - 修改 V3 会改变文件 checksum，svr-lg 升级需执行一次性 flyway repair（已知 trade-off，AC-7 允许）
- **Done When**:
  - V3 文件在 `ADD CONSTRAINT fk_upr_project` 之前包含 `INSERT INTO projects ... OVERRIDING SYSTEM VALUE` 语句
  - INSERT 语句包含 `VALUES (0, '系统占位项目', 'SYSTEM', 'ARCHIVED'`
  - projects(id=0) 的 INSERT 行号 < ADD CONSTRAINT fk_upr_project 行号（顺序正确）
  - V3 文件仍包含原有 ADD CONSTRAINT 语句（未被删除）

**要插入的 SQL（精确内容，放在第 221 行注释之后、第 222 行 ALTER TABLE 之前）：**

```sql

-- 系统占位项目（Bug-2 修复）：V2 已用 project_id=0 为 admin 建立全局角色关联，
-- 此处必须在 ADD CONSTRAINT fk_upr_project 之前插入 id=0 记录，
-- 否则 PostgreSQL 校验已有数据时 FK 违规（project_id=0 无对应 projects.id）。
-- id=0 < IDENTITY 序列起始值 1，不与后续业务 INSERT 冲突。
INSERT INTO projects (id, name, code, status, description)
VALUES (0, '系统占位项目', 'SYSTEM', 'ARCHIVED', '全局角色关联锚点（非业务项目，禁止删除）')
OVERRIDING SYSTEM VALUE;
```

- **依赖**: 无文件依赖（与 TASK-5 不同文件）。但**强烈建议先于 TASK-5 执行**：V3 修复是 V8 能被执行的前置条件（迁移链完整性）。
- refs: [REQ-Bug2, AC-2, AC-7, DD-2]
- files_to_modify: [fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql]
- **expected_file_changes**:
  - `fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql`（modify：第 221 行后新增 projects(0) INSERT 段）
- **allowed_write_files**: [fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql]
- **forbidden_files**: [fj-backend/fj-api/src/main/resources/db/migration/V1__base_tables.sql, fj-backend/fj-api/src/main/resources/db/migration/V2__seed_data.sql, fj-backend/fj-api/src/main/resources/db/migration/V4__task_tables.sql, fj-backend/fj-api/src/main/resources/db/migration/V5__daily_report_tables.sql, fj-backend/fj-api/src/main/resources/db/migration/V6__approval_tables.sql, fj-backend/fj-api/src/main/resources/db/migration/V7__report_tables.sql, requirements.md, design.md, tasks.md, trace_delta.md, 以及 TASK-1/2/3/5 的所有写文件]
- **verification_commands**:
  - `grep -q 'OVERRIDING SYSTEM VALUE' fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql`
  - `grep -q "'系统占位项目'" fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql`
  - `grep -q "VALUES (0, '系统占位项目', 'SYSTEM', 'ARCHIVED'" fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql`
  - `awk '/INSERT INTO projects.*OVERRIDING SYSTEM VALUE/{a=NR} /ADD CONSTRAINT fk_upr_project/{b=NR} END{exit !(a>0 && b>0 && a<b)}' fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql`
  - `grep -q 'ADD CONSTRAINT fk_upr_project FOREIGN KEY (project_id) REFERENCES projects (id)' fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql`
- **verification_evidence_expected**:
  - 命令1：exit_code=0（OVERRIDING SYSTEM VALUE 存在）
  - 命令2：exit_code=0（系统占位项目名称存在）
  - 命令3：exit_code=0（INSERT VALUES 语句正确）
  - 命令4：exit_code=0（INSERT 行号 < ADD CONSTRAINT 行号，顺序正确，a<b）
  - 命令5：exit_code=0（原有 ADD CONSTRAINT 语句保留）
- **out_of_scope**:
  - 不修改 V1/V2/V4/V5/V6/V7
  - 不修改 V2 的 project_id=0 种子数据（保留 admin 全局角色关联）
  - 不删除或修改 V3 末尾的触发器创建段
  - 不执行迁移测试（由 verification 阶段在干净 PG16 实例上执行）
  - svr-lg 的 flyway repair 属运维操作，不在本 task 范围

---

### TASK-5 新建 V8 迁移修复 export_files 缺列/file_hash 长度/users.status 类型（Bug-3 + Bug-4）

**context_block**（executor 必读）：
- **What**: 新建迁移文件 `fj-backend/fj-api/src/main/resources/db/migration/V8__fix_schema_mismatches.sql`，包含 4 条修复 SQL（覆盖 Bug-3 三处 + Bug-4 一处），全部使用幂等写法以兼容全新部署和 svr-lg 已修补状态。
- **Why**:
  - Bug-3：V7 的 export_files 表缺少 `error_message`（ExportFile.java 第 72-74 行声明 `@Column(length=1024)`）、`export_status`（ExportFile.java 第 68-70 行声明 `@Column(length=32, nullable=false)` String 类型默认 SUCCESS）两列；且 `file_hash` 为 VARCHAR(64) 与实体 `@Column(length=128)` 不匹配。ddl-auto=validate 会报 missing column / wrong column type。
  - Bug-4：V1 的 users.status 为 SMALLINT（int2），但 UserStatusConverter 泛型为 Integer（int4），ddl-auto=validate 报 wrong column type。
  - 两者合并到单一 V8 文件减少碎片化。V8 是 forward-compatible 修补迁移，不修改 V1/V7，保证 svr-lg 的 flyway_schema_history 不受影响（V8 是新增迁移）。
- **Refs**: DD-3（Bug-3/4/file_hash 修复，新增 V8 迁移）；REQ-Bug3；REQ-Bug4；AC-3；AC-4；AC-6
- **Constraints**:
  - 文件名必须为 `V8__fix_schema_mismatches.sql`（Flyway 版本号 V8，与现有 V1-V7 连续）
  - `ADD COLUMN` 必须用 `IF NOT EXISTS`（兼容 svr-lg 已手动补列的状态）
  - `file_hash` ALTER TYPE 是 VARCHAR(64)→VARCHAR(128) 扩展（不截断，安全）
  - `users.status` ALTER TYPE 必须包裹在 `DO $$ ... END $$` 条件块中（检测 data_type='smallint' 才执行，兼容 svr-lg 已改为 integer 的状态）
  - export_status 必须为 `VARCHAR(32) NOT NULL DEFAULT 'SUCCESS'`（与 ExportFile.java 实体 String 类型一致，**非 INTEGER**——intake.md 的 INTEGER 描述有误，requirements.md AC-3 已修正）
  - 不修改 V1（users.status 仍 SMALLINT，由 V8 运行时修正）
  - 不修改 V7（export_files 仍缺列，由 V8 运行时补全）
  - 不修改 ExportFile.java（实体声明已正确）
  - 不修改 UserStatusConverter.java 泛型（Integer 是正确设计选择；注释修改在 TASK-3）
  - SQL 必须兼容 PostgreSQL 16
- **Done When**:
  - 文件 `fj-backend/fj-api/src/main/resources/db/migration/V8__fix_schema_mismatches.sql` 存在
  - 包含 `ADD COLUMN IF NOT EXISTS error_message VARCHAR(1024)`
  - 包含 `ADD COLUMN IF NOT EXISTS export_status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS'`
  - 包含 `ALTER COLUMN file_hash TYPE VARCHAR(128)`
  - 包含 `ALTER TABLE users ALTER COLUMN status TYPE INTEGER USING status::INTEGER`（在 DO 块内）
  - 包含 `data_type = 'smallint'` 条件判断
  - export_status 列**不是** INTEGER 类型（验证不含 `export_status.*INTEGER`）

**V8 完整 SQL 内容（必须逐字写入文件）：**

```sql
-- =====================================================================
-- V8__fix_schema_mismatches.sql
-- 飞检现场管理系统 — Schema 不匹配修复迁移（WI-0004 Bug-3 + Bug-4）
-- 目标数据库：PostgreSQL 16
-- 依赖：V1__base_tables.sql（users）、V7__report_tables.sql（export_files）
-- 修复范围：
--   - Bug-3: export_files 缺 error_message / export_status 列
--   - Bug-3: export_files.file_hash VARCHAR(64) → VARCHAR(128)（对齐实体 length=128）
--   - Bug-4: users.status SMALLINT → INTEGER（对齐 UserStatusConverter Integer 泛型）
-- 幂等性设计（兼容全新部署 + svr-lg 已修补状态）：
--   - ADD COLUMN IF NOT EXISTS：全新环境补列，svr-lg 已有列则跳过
--   - ALTER COLUMN TYPE：类型扩展操作，已有数据安全（VARCHAR 64→128 扩展不截断）
--   - DO 块条件判断：users.status 已是 integer（svr-lg 修补后）则跳过 ALTER
-- =====================================================================

-- ===== Bug-3 修复：export_files 补缺列 =====

-- error_message：导出失败时的错误信息（nullable，成功时为 NULL）
ALTER TABLE export_files ADD COLUMN IF NOT EXISTS error_message VARCHAR(1024);

-- export_status：导出状态 SUCCESS/FAILED（NOT NULL，默认 SUCCESS）
-- 注意：与 ExportFile.java 实体一致，类型为 VARCHAR(32) String，非 INTEGER
ALTER TABLE export_files ADD COLUMN IF NOT EXISTS export_status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS';

-- ===== Bug-3 修复：export_files.file_hash 扩展长度 =====
-- V7 原为 VARCHAR(64)（SHA-256 = 64 位十六进制）
-- ExportFile.java @Column(length=128) 需 VARCHAR(128)，兼容未来 SHA-512（128 字符）
-- ALTER TYPE 是扩展操作，已有 64 字符哈希值不受影响（不截断）
ALTER TABLE export_files ALTER COLUMN file_hash TYPE VARCHAR(128);

-- ===== Bug-4 修复：users.status SMALLINT → INTEGER =====
-- V1 原为 SMALLINT（int2），UserStatusConverter 泛型为 Integer（int4）
-- DO 块条件判断：svr-lg 已 ALTER 为 integer 则跳过（幂等）
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'status'
          AND data_type = 'smallint'
    ) THEN
        ALTER TABLE users ALTER COLUMN status TYPE INTEGER USING status::INTEGER;
    END IF;
END $$;
```

- **依赖**: TASK-4（V3 修复是迁移链完整性的前置：若 V3 未修复，迁移在 V3 中断，V8 永远不会执行）
- refs: [REQ-Bug3, REQ-Bug4, AC-3, AC-4, AC-6, DD-3]
- files_to_modify: [fj-backend/fj-api/src/main/resources/db/migration/V8__fix_schema_mismatches.sql]
- **expected_file_changes**:
  - `fj-backend/fj-api/src/main/resources/db/migration/V8__fix_schema_mismatches.sql`（create：新增迁移文件）
- **allowed_write_files**: [fj-backend/fj-api/src/main/resources/db/migration/V8__fix_schema_mismatches.sql]
- **forbidden_files**: [fj-backend/fj-api/src/main/resources/db/migration/V1__base_tables.sql, fj-backend/fj-api/src/main/resources/db/migration/V2__seed_data.sql, fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql, fj-backend/fj-api/src/main/resources/db/migration/V4__task_tables.sql, fj-backend/fj-api/src/main/resources/db/migration/V5__daily_report_tables.sql, fj-backend/fj-api/src/main/resources/db/migration/V6__approval_tables.sql, fj-backend/fj-api/src/main/resources/db/migration/V7__report_tables.sql, requirements.md, design.md, tasks.md, trace_delta.md, 以及 TASK-1/2/3/4 的所有写文件]
- **verification_commands**:
  - `test -f fj-backend/fj-api/src/main/resources/db/migration/V8__fix_schema_mismatches.sql`
  - `grep -q 'ADD COLUMN IF NOT EXISTS error_message VARCHAR(1024)' fj-backend/fj-api/src/main/resources/db/migration/V8__fix_schema_mismatches.sql`
  - `grep -q 'ADD COLUMN IF NOT EXISTS export_status VARCHAR(32) NOT NULL DEFAULT' fj-backend/fj-api/src/main/resources/db/migration/V8__fix_schema_mismatches.sql`
  - `grep -q 'ALTER COLUMN file_hash TYPE VARCHAR(128)' fj-backend/fj-api/src/main/resources/db/migration/V8__fix_schema_mismatches.sql`
  - `grep -q 'ALTER TABLE users ALTER COLUMN status TYPE INTEGER USING status::INTEGER' fj-backend/fj-api/src/main/resources/db/migration/V8__fix_schema_mismatches.sql`
  - `grep -q "data_type = 'smallint'" fj-backend/fj-api/src/main/resources/db/migration/V8__fix_schema_mismatches.sql`
- **verification_evidence_expected**:
  - 命令1：exit_code=0（V8 文件已创建）
  - 命令2：exit_code=0（error_message 列补全 SQL 存在）
  - 命令3：exit_code=0（export_status 列补全 SQL 存在，VARCHAR(32) NOT NULL）
  - 命令4：exit_code=0（file_hash 扩展到 VARCHAR(128)）
  - 命令5：exit_code=0（users.status 改为 INTEGER 的 ALTER 存在）
  - 命令6：exit_code=0（DO 块条件判断 data_type='smallint' 存在，保证幂等）
- **out_of_scope**:
  - 不修改 V1/V2/V3/V4/V5/V6/V7
  - 不修改 ExportFile.java / UserStatusConverter.java 泛型 / UserStatus 枚举
  - 不执行实际数据库迁移（由 verification 阶段在干净 PG16 实例上执行 V1-V8 全链测试）
  - 不创建 V9 或更高版本迁移

---

## Task Contract 完整性自检

| 检查项 | TASK-1 | TASK-2 | TASK-3 | TASK-4 | TASK-5 |
|--------|--------|--------|--------|--------|--------|
| refs 非空且引用存在 | ✅ REQ-Bug1/AC-1/DD-1 | ✅ REQ-Bug5/AC-5/DD-5 | ✅ REQ-Bug4/DD-4 | ✅ REQ-Bug2/AC-2/AC-7/DD-2 | ✅ REQ-Bug3/REQ-Bug4/AC-3/AC-4/AC-6/DD-3 |
| allowed_write_files 具体无通配符 | ✅ | ✅ | ✅ | ✅ | ✅ |
| forbidden_files 含 spec+其他task文件 | ✅ | ✅ | ✅ | ✅ | ✅ |
| verification_commands 返回退出码 | ✅ 4条 | ✅ 4条 | ✅ 5条 | ✅ 5条 | ✅ 6条 |
| done_when 可机器验证 | ✅ | ✅ | ✅ | ✅ | ✅ |
| out_of_scope 明确 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 单一 DD（T1） | ✅ DD-1 | ✅ DD-5 | ✅ DD-4 | ✅ DD-2 | ✅ DD-3 |

## T1-T6 规则自检

- **T1 单一产物**: 每个 task 仅服务一个 DD ✅
- **T2 上下文充分**: 每个 task 的 context_block 含 What/Why/Refs/Constraints/Done When，executor 无需回查 design.md ✅
- **T3 边界清晰**: 所有 verification_commands 返回 0/非0 退出码，无"检查代码是否正确"类手动命令 ✅
- **T4 独立可执行**: 批次1三个 task 文件不重叠无依赖；TASK-5 显式声明 depends_on TASK-4 ✅
- **T5 共享代码先建**: 无跨 task 共享代码（每个 task 独立修改各自文件）✅
- **T6 大小控制**: 所有 task 改动 30-200 行内，1-2 文件，1 个 DD，1-6 条验证命令 ✅

## AC 覆盖矩阵

| AC | 描述 | 覆盖 Task |
|----|------|-----------|
| AC-1 | application-prod.yml 不含 spring.profiles.active | TASK-1 |
| AC-2 | V1-V8 全链迁移一次性成功无 FK 违规 | TASK-4（V3 修复）+ TASK-5（V8 新建） |
| AC-3 | export_files 含 error_message/export_status 列 | TASK-5 |
| AC-4 | users.status 为 INTEGER | TASK-5（+ TASK-3 注释同步） |
| AC-5 | install_pg16.sh 正确初始化 PG16 + 检测 PG13 | TASK-2 |
| AC-6 | ddl-auto=validate 启动无 Schema-validation 错误 | TASK-5（export_files + users.status 修复） |
| AC-7 | 不破坏 svr-lg（V8 附加迁移；Bug-2 需 flyway repair） | TASK-4（V3 checksum 变化属已知 trade-off）+ TASK-5（V8 幂等） |
