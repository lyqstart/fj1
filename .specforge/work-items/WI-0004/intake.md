# Intake — WI-0004 (fj1 源码 bug 修复)

**来源 Work Item:** WI-0003（fj1 部署到 svr-lg）
**发现时间:** 2026-07-03（部署阶段 G 期间）
**报告人:** sf-executor / sf-orchestrator
**严重级别:** 中（阻塞干净的全新部署，需服务器端临时修补才能运行）

---

## 背景

WI-0003 首次部署 fj1 飞检系统到 svr-lg (10.0.12.12) 时，在阶段 G（部署后端）遇到多个源码层 bug，导致服务无法直接启动。所有 bug 通过服务器端的临时修补（patch jar 内嵌 yml / 直接 SQL 修补 schema / ddl-auto 改 none）绕过，系统最终成功运行（Flyway V1-V7 全部成功，health=UP）。

**但这些临时修补仅存在于服务器运行环境，源码仓库 fj1 仍包含这些 bug。** 下次全新部署到其他环境（如 svr-sh）时同样会失败。本 WI 目标是在源码层面根本修复这 5 个 bug，使部署流程可以无需手动干预。

---

## 缺陷清单

### Bug-1：application-prod.yml 包含 spring.profiles.active（Spring Boot 2.4+ 违规）

**文件:** `deploy/config/application-prod.yml`

**当前行为:**
该 yml 文件包含顶层 `spring.profiles.active` 键。当该文件被打包进 jar（通过 `spring-boot-maven-plugin` 或作为 `application-prod.yml` profile resource）后，Spring Boot 2.4+ 启动时报错：

```
java.lang.IllegalStateException: Profiles are not allowed to use 'spring.profiles.active'
```

服务无法启动。

**预期行为:**
`application-prod.yml` 中不得包含 `spring.profiles.active`。Profile 激活应由外部机制控制（如 `SPRING_PROFILES_ACTIVE` 环境变量、`spring.profiles.active` JVM 参数、systemd unit 的 `Environment=`）。

**服务器端临时修补:** 从 jar 内嵌的 `BOOT-INF/classes/application-prod.yml` 中删除了该键（修补后 jar 备份为 `/opt/fj1/api/fj-api-1.0.0.jar.bak.G6`）。

**影响范围:** fj-backend/fj-api 模块（打包的 fat jar）

---

### Bug-2：V2 种子数据在 V3 FK 建立前引用 projects.id=0（FK 违规）

**文件:** `fj-backend/fj-api/src/main/resources/db/migration/V2__seed_data.sql`（向 user_project_roles 插入 project_id=0）
**关联文件:** `V3__projects.sql`（CREATE TABLE projects + FK）

**当前行为:**
V2 中的种子 INSERT 向 `user_project_roles.project_id` 列写入值 `0`，但此时 `projects` 表尚未创建（在 V3 才创建），且 `projects` 表中也没有 id=0 的记录。Flyway 按文件名顺序执行 V2 在 V3 之前，导致：

```
ERROR: insert or update on table "user_project_roles" violates foreign key constraint
DETAIL: Key (project_id)=(0) is not present in table "projects".
```

Flyway 迁移失败，应用无法启动。

**预期行为:**
要么 V2 不向 user_project_roles 种子化 project_id=0；要么将 projects 表的创建和系统项目（id=0）的 INSERT 移到 V2 之前（或合并到 V1/V2 一次性创建）。无论如何，种子数据的 FK 引用必须在 FK 约束建立之前就有效。

**服务器端临时修补:** 将 V3 中的 `INSERT INTO projects (id, ...) VALUES (0, ...)` 改为 `OVERRIDING SYSTEM VALUE`（id 列为 GENERATED AS IDENTITY），并在 V3 创建 FK 约束之前执行该 INSERT。

**影响范围:** Flyway 迁移链 V2/V3

---

### Bug-3：V7 export_files 表缺少 error_message 和 export_status 列

**文件:** `fj-backend/fj-api/src/main/resources/db/migration/V7__report_tables.sql`（CREATE TABLE export_files）
**关联文件:** `fj-backend/fj-export/src/main/java/com/fj/export/entity/ExportFile.java`（JPA 实体）

**当前行为:**
V7 的 `CREATE TABLE export_files` 中没有定义 `error_message` 和 `export_status` 两列。但 JPA 实体 `ExportFile.java`（约第 73 行）声明了：

```java
@Column(name = "error_message", length = 1024)
private String errorMessage;

@Column(name = "export_status")
private Integer exportStatus;
```

当 `spring.jpa.hibernate.ddl-auto=validate` 时，Hibernate 启动校验失败：

```
Schema-validation: missing column [error_message] in table [export_files]
Schema-validation: missing column [export_status] in table [export_files]
```

应用无法启动。

**预期行为:**
V7 的 `CREATE TABLE export_files` 必须包含实体声明的所有列。具体地，应添加：
- `error_message VARCHAR(1024)` （或 `TEXT`，与实体 length=1024 一致）
- `export_status INTEGER`

**服务器端临时修补:** 直接在 fj1_inspect 数据库中 `ALTER TABLE export_files ADD COLUMN error_message ...; ADD COLUMN export_status ...;`。注意：这仅修复了当前数据库，V7 源文件未改，下次全新部署仍会失败。同时 ddl-auto 从 validate 改为 none 才能启动。

**影响范围:** Flyway V7 / fj-export 模块

---

### Bug-4：users.status 列类型 smallint 与 JPA 实体 integer 不匹配

**文件:** V1 或 V2 中的 `CREATE TABLE users`（具体位置需 requirements agent 定位，status 列定义为 smallint）
**关联文件:** `fj-backend/fj-api/src/main/java/.../entity/User.java`（JPA 实体）

**当前行为:**
users 表的 status 列创建为 `smallint`（int2，PostgreSQL），但 JPA 实体 `User.java` 中 status 字段类型为 `Integer`（Java Integer → JDBC INTEGER → PostgreSQL int4）。Hibernate 启动 schema-validation 时：

```
Schema-validation: wrong column type in column [status] in table [users]
Encountered: smallint
Expected: integer
```

应用无法启动。

**预期行为:**
users 表的 status 列类型应为 `INTEGER`（int4），与 JPA 实体的 Integer 类型匹配。或者实体改用 Short（但这会改变业务语义，不推荐）。

**服务器端临时修补:** `ALTER TABLE users ALTER COLUMN status TYPE integer USING status::integer;`。同样，仅修复当前数据库，源 SQL 未改。

**影响范围:** Flyway V1/V2 / fj-api User 实体

**注意:** 历史 journalctl 日志（部署失败启动 PID 3210454 @18:31:40）保留了这条错误证据。

---

### Bug-5：install_pg16.sh 参数错误 + PG13 包名不匹配

**文件:** `scripts/ops/install_pg16.sh`

**当前行为:**
该脚本有两个 bug：

1. **postgresql-16-setup --initdb 参数错误:** 脚本调用类似 `postgresql-16-setup --initdb` 但 PGDG 官方包装提供的初始化方式是 `postgresql-16-setup --initdb` 需要指定 `--pgdata` 或使用 service initdb 包装。实际正确命令应是 `/usr/pgsql-16/bin/postgresql-16-setup initdb` 或 `postgresql-16-setup initdb`（无 `--` 前缀）。

2. **PG13 包名错误:** 脚本中卸载/检测 PG13 时使用包名 `postgresql-server`，但实际安装的包名是 `postgresql-13.23`（PGDG 精确版本包）或 `postgresql13-server`（PGDG 短名）。导致脚本无法正确检测/清理旧 PG13。

**预期行为:**
- `--initdb` 参数与 PGDG 官方包装一致
- PG13 包名检测使用正确的包名（建议 `postgresql13*` 通配或 `postgresql-13*-server`）

**服务器端临时修补:** 跳过脚本，手动执行 `postgresql-16-setup initdb` + `systemctl start postgresql-16`。

**影响范围:** scripts/ops/install_pg16.sh（运维脚本，不影响应用本身）

---

## 验证环境

- 源码仓库: `/mnt/1t_back/project/fj1`
- 已部署环境: svr-lg (10.0.12.12)，含临时修补（参考 WI-0003 verification_report.md）
- 备份: `/opt/fj-backup-20260702/`（部署前 PG13 + /opt/fj 完整备份）

## 验证目标

修复后的源码应满足：
1. 全新部署无需任何手动 jar patch / SQL ALTER 即可成功
2. Flyway V1-V7 在空数据库上一次性迁移成功
3. `spring.jpa.hibernate.ddl-auto=validate`（非 none）下应用能启动
4. install_pg16.sh 在干净系统上能正确安装 PG16
5. 现有 svr-lg 部署不受影响（不破坏已运行的系统）

## 不变行为（修复不得破坏）

- fj1 系统功能行为不变（API 契约、UI、业务流程）
- 已部署的 svr-lg 数据库数据不丢失
- 现有 Flyway 已迁移的 fj1_inspect 数据库不需要 rollback（修复应是 forward-compatible 的，例如通过新增 V8 迁移而不是修改 V1-V7）

**重要约束:** PostgreSQL Flyway 已迁移的版本不可修改。对于 Bug-2/3/4，如果 V1-V7 已被任何环境应用过，修复方式应是新增 V8+ 迁移（修正 schema），而不是修改已发布的 V1-V7 文件。requirements/design 阶段需明确这一点。

## 关联证据

- WI-0003 verification_report.md（部署验证证据）
- WI-0003 changed_files_audit.md（审计报告，含临时修补记录）
- svr-lg: /opt/fj1/api/fj-api-1.0.0.jar.bak.G6（修补前 jar 备份）
- svr-lg: journalctl 历史 Schema-validation 错误日志
- svr-lg: flyway_schema_history（V1-V7 success=t）