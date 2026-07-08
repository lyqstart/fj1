---
requirements_format: ears
---

# Bugfix Analysis — WI-0004

**Work Item:** WI-0004 (fj1 源码 bug 修复)
**来源:** WI-0003 首次部署 svr-lg (10.0.12.12) 时发现
**分析方法:** superpowers-systematic-debugging（复现→证据→假设→验证→根因）

---

## 简介

本文档记录 fj1 飞检系统 5 个源码层 bug 的系统化缺陷分析。每个 bug 均经过实际源码读取确认根因（非仅凭 intake.md 描述）。分析过程中发现 intake.md 存在 2 处与实际源码不符的描述，已在对应章节标注修正。

**关键约束回顾：** svr-lg 的 fj_inspect 数据库已成功迁移 V1-V7（flyway_schema_history 7 行 success=t）。对于 Bug-2/3/4，优先采用 forward-compatible（V8+）修复策略；若技术上不可行，需明确论证并给出替代方案。

---

## 术语表

| 术语 | 定义 |
|------|------|
| Flyway | 数据库迁移版本控制工具，按版本号顺序执行 SQL 文件，已执行版本记录在 flyway_schema_history 表 |
| Flyway checksum | Flyway 对每个迁移文件内容计算的 CRC32 校验和。validate-on-migrate=true 时启动校验，文件被修改则 checksum 不匹配导致启动失败 |
| forward-compatible 修复 | 不修改已发布的迁移文件，通过新增 V8+ 迁移来修正 schema，保证已部署环境的 flyway_schema_history 不受影响 |
| ddl-auto=validate | Hibernate 启动时校验 JPA 实体与数据库 schema 的一致性，不修改 schema，不一致则启动失败 |
| spring.profiles.active | Spring Boot profile 激活配置。Spring Boot 2.4+ 禁止在 profile-specific 文件中使用 |
| PGDG | PostgreSQL Global Development Group 官方 yum/dnf 仓库，提供精确版本包（如 postgresql16-server） |
| AttributeConverter | JPA 接口，定义实体属性与数据库列值之间的转换。泛型 Y 决定 Hibernate validate 期望的 JDBC 列类型 |
| GENERATED ALWAYS AS IDENTITY | PostgreSQL 标识列，禁止手动插入指定值（除非用 OVERRIDING SYSTEM VALUE） |

---

## Bug-1: application-prod.yml 包含 spring.profiles.active（Spring Boot 2.4+ 违规）

**文件:** `deploy/config/application-prod.yml` 第 7-8 行

### 当前行为

THE application-prod.yml 文件第 7-8 行包含：

```yaml
spring:
  profiles:
    active: prod
```

WHEN 该文件被打包进 jar 并以 prod profile 加载时，THEN Spring Boot 2.4+ 抛出异常：

```
java.lang.IllegalStateException: Profiles are not allowed to use 'spring.profiles.active'
```

服务无法启动。svr-lg 部署时通过从 jar 内嵌 BOOT-INF/classes/application-prod.yml 中删除该键绕过（备份：`/opt/fj1/api/fj-api-1.0.0.jar.bak.G6`）。

### 预期行为

1. [Ubiquitous] THE application-prod.yml SHALL NOT 包含 `spring.profiles.active` 键。
2. [Event-driven] WHEN 应用启动时，THEN profile 激活 SHALL 由外部机制控制（`SPRING_PROFILES_ACTIVE` 环境变量 / JVM 参数 `-Dspring.profiles.active` / systemd unit `Environment=`）。

### 不变行为

- 应用其余配置（datasource / flyway / jpa / fj.security / logging / management）不变
- 生产环境的数据库连接参数、JWT 配置、日志路径不变
- API 契约和业务功能不变

### 根因分析

**复现：** 读取 `deploy/config/application-prod.yml` 确认第 6-8 行：
```yaml
spring:
  profiles:
    active: prod
```

**证据：**
- 源文件第 7 行 `profiles:` 第 8 行 `active: prod`，位于 `spring:` 顶层下
- Spring Boot 2.4+（本项目使用 Spring Boot 3.x）在 profile-specific 文件（`application-{profile}.yml`）中禁止使用 `spring.profiles.active`，因为会导致 profile 激活循环

**假设与验证：**
- H1（确认）：`spring.profiles.active` 出现在 `application-prod.yml` 中（profile-specific 文件）→ 违反 Spring Boot 2.4+ 多文档配置规则
- H2（排除）：不是在 `application.yml`（主配置）中 — 主配置中使用 `spring.profiles.active` 是合法的，但此 bug 位于 `application-prod.yml`

**确认根因：** `application-prod.yml` 作为 profile-specific 文件不应自引用 `spring.profiles.active`。Profile 激活应交由外部环境控制。

**修复策略：** 直接修改 `deploy/config/application-prod.yml`，删除第 7-8 行（`profiles:` + `active: prod`）。不涉及 Flyway，无 forward-compatible 约束。

**forward-compatible 论证：** 不适用（非数据库迁移文件）。

---

## Bug-2: V2 种子数据在 V3 FK 建立前引用 project_id=0（FK 违规）

**文件:** `V2__seed_data.sql` 第 105-107 行 + `V3__project_tables.sql` 第 222-223 行

### 当前行为

Flyway 按版本号顺序执行 V1→V2→V3。执行过程：

1. V1 创建 `user_project_roles` 表（第 93-106 行），`project_id` 列为 `BIGINT NOT NULL`，**仅对 user_id 和 role_id 建立外键，project_id 无外键约束**
2. V2 第 105-107 行执行：
   ```sql
   INSERT INTO user_project_roles (user_id, project_id, role_id)
   SELECT u.id, 0, r.id FROM users u, roles r
   WHERE u.username = 'admin' AND r.code = 'ROLE_SYS_ADMIN';
   ```
   此 INSERT **成功**（此时 project_id 无外键约束，project_id=0 不受校验）
3. V3 创建 `projects` 表（第 15-31 行，表为空），随后第 222-223 行：
   ```sql
   ALTER TABLE user_project_roles
       ADD CONSTRAINT fk_upr_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;
   ```
   PostgreSQL 执行 `ADD CONSTRAINT FOREIGN KEY` 时默认校验已有数据。`user_project_roles` 中存在 `project_id=0` 的行，而 `projects` 表为空（无 id=0 记录）→ **ALTER TABLE 失败**。

WHEN Flyway 执行 V3 的 ADD CONSTRAINT 语句时，THEN PostgreSQL 抛出：

```
ERROR: insert or update on table "user_project_roles" violates foreign key constraint
DETAIL: Key (project_id)=(0) is not present in table "projects".
```

V3 迁移失败，Flyway 标记 V3 为 failed，后续 V4-V7 均不执行，应用无法启动。

svr-lg 部署时通过修改 V3 SQL（在 ADD CONSTRAINT 前用 `OVERRIDING SYSTEM VALUE` 插入 projects(id=0) 系统项目记录）绕过。

### 预期行为

1. [Event-driven] WHEN Flyway 在空数据库上执行 V1 到 V8 的完整迁移链时，THEN 所有迁移 SHALL 一次性成功，无外键约束违规。
2. [Ubiquitous] THE admin 用户的 ROLE_SYS_ADMIN 全局角色关联 SHALL 在迁移完成后正确建立。
3. [State-driven] WHILE projects 表中不存在 id=0 的记录时，THE user_project_roles SHALL NOT 包含 project_id=0 的行（除非设计明确引入系统占位项目）。

### 不变行为

- admin 用户账号及其密码哈希不变（V2 第 101-102 行）
- admin 拥有 ROLE_SYS_ADMIN 角色及其全部权限不变
- projects / project_configs / project_inspection_forms 等业务表结构不变
- 已部署 svr-lg 的 user_project_roles 数据不丢失

### 根因分析

**复现（逻辑推演）：** 基于源码追踪迁移执行顺序：
- V1 第 104-105 行：user_project_roles 仅有 `fk_upr_user`（→users）和 `fk_upr_role`（→roles），**无 project_id 外键**
- V1 第 108 行注释明确："项目 ID（业务表建立后补充外键）"
- V2 第 106 行：`SELECT u.id, 0, r.id` — project_id 硬编码为 0
- V3 第 222-223 行：`ALTER TABLE ... ADD CONSTRAINT fk_upr_project` — 此时校验已有数据

**证据：**
- V1 源码确认：project_id 外键确实延后到 V3
- V2 源码确认：project_id=0 是"全局角色占位"（注释第 104 行："project_id 占位 0 表示非项目级"）
- V3 源码确认：ADD CONSTRAINT 在 CREATE TABLE projects 之后，此时 projects 表无 id=0 记录

**假设与验证：**
- H1（确认）：V2 插入 project_id=0 时无 FK 约束 → INSERT 成功 → V3 ADD CONSTRAINT 时校验失败
- H2（排除）：不是 V2 INSERT 本身失败 — intake.md 描述的错误发生在 ADD CONSTRAINT 阶段，与 V1 无 FK 的事实一致
- H3（排除）：不是 projects 表不存在 — projects 在 V3 第 15 行创建，ADD CONSTRAINT 在第 222 行，projects 表此时已存在但为空

**确认根因：** V2 的种子数据设计了一个"project_id=0 表示全局角色"的占位约定，但 projects 表（及 id=0 的系统项目记录）在 V3 才创建。V3 的 ADD CONSTRAINT 在 projects 表无 id=0 记录时校验 user_project_roles 的已有数据，导致 FK 违规。这是一个**迁移文件间的顺序依赖设计错误**。

#### forward-compatible 限制论证（关键）

**V8+ 迁移无法修复此 bug。** 原因：

1. Flyway 按版本号严格顺序执行：V1→V2→V3→...→V7→V8
2. V3 的 ADD CONSTRAINT 失败后，Flyway 将 V3 标记为 failed，整个迁移中止
3. V8 永远不会被执行（V3 失败 = 迁移链断裂）
4. 因此无论 V8 写什么 SQL，都无法改变"V3 ADD CONSTRAINT 失败"这一事实

这与 Bug-3/4（最终 schema 状态错误，可通过 V8 补丁修复）有本质区别：**Bug-2 是迁移执行过程中的失败，不是最终 schema 状态的错误。**

#### 修复策略（推荐方案）

**方案 A（推荐）：修改 V2 源文件，移除 project_id=0 的全局角色关联插入**

将 V2 第 104-107 行的 user_project_roles 插入移除。admin 的全局角色关联改为在 V3 末尾（projects 表已建立后）执行，使用 NULL project_id（如果业务允许）或指向一个新建的系统占位项目。

理由：
- 最小改动（仅 V2 一处）
- 消除 project_id=0 的占位约定，避免 FK 问题

实现考量：
- 若 user_project_roles.project_id 改为 nullable（允许 NULL 表示全局角色），需 V1 同步修改 `project_id BIGINT`（去掉 NOT NULL）——但这又改 V1
- 或者 V3 末尾 INSERT 一个 projects(id=0, name='SYSTEM', ...) 系统项目（用 OVERRIDING SYSTEM VALUE），再 INSERT user_project_roles

**方案 B：修改 V3 源文件，在 ADD CONSTRAINT 前插入系统项目**

在 V3 第 222 行之前添加：
```sql
INSERT INTO projects (id, name, code, status) OVERRIDING SYSTEM VALUE
VALUES (0, 'SYSTEM', 'SYSTEM', 'ARCHIVED');
```
然后 ADD CONSTRAINT 校验通过（project_id=0 对应 projects.id=0）。

理由：
- 保持 V2 不变
- 引入一个明确的系统占位项目

**对 svr-lg 的影响（两方案共同）：**
- 修改 V2 或 V3 改变了文件 checksum
- svr-lg 的 flyway_schema_history 记录的是修补版 V2/V3 的 checksum
- 升级时 `validate-on-migrate=true` 会发现 checksum 不匹配 → 需执行一次性 `flyway repair`
- flyway repair 更新 flyway_schema_history 中的 checksum 为当前文件值，不影响数据

**决策标记：** 此方案违反 intake.md "不得修改 V1-V7" 的约束，但 Bug-2 的技术本质决定了无法纯 forward 修复。**建议 design 阶段评估以下 trade-off 后由用户决策：**
- 选项 1：修改 V2/V3 + svr-lg flyway repair（根本修复，但破坏 svr-lg checksum 不变性）
- 选项 2：保持 V1-V7 不变，全新部署需手动干预（不满足 AC-2 "一次性成功"）

---

## Bug-3: V7 export_files 表缺列 + file_hash 长度不匹配

**文件:** `V7__report_tables.sql`（export_files CREATE TABLE，第 131-153 行）+ `ExportFile.java`

### 当前行为

THE V7 的 `CREATE TABLE export_files`（第 131-153 行）与 JPA 实体 `ExportFile.java` 存在 **3 处不匹配**：

**不匹配 1（intake.md 已记录）：** export_files 表缺少 `error_message` 列。
- ExportFile.java 第 72-74 行：`@Column(name = "error_message", length = 1024) private String errorMessage;`
- V7 无此列

**不匹配 2（intake.md 已记录，但类型描述有误）：** export_files 表缺少 `export_status` 列。
- ExportFile.java 第 68-70 行：`@Column(name = "export_status", nullable = false, length = 32) private String exportStatus = "SUCCESS";`
- intake.md 第 78-79 行错误描述为 `private Integer exportStatus;` — **实际源码是 String 类型**，默认值 "SUCCESS"
- V7 无此列

**不匹配 3（新发现，intake.md 未覆盖）：** `file_hash` 列长度不一致。
- V7 第 140 行：`file_hash VARCHAR(64)`
- ExportFile.java 第 57 行：`@Column(name = "file_hash", length = 128)` — 实体期望 VARCHAR(128)

WHEN ddl-auto=validate 时，THEN Hibernate 抛出：

```
Schema-validation: missing column [error_message] in table [export_files]
Schema-validation: missing column [export_status] in table [export_files]
Schema-validation: wrong column type in column [file_hash] in table [export_files]  -- 可能（取决于 Hibernate 版本对 varchar 长度的校验严格度）
```

> **注：** 不匹配 3 在 svr-lg 上未暴露，因为临时修补将 ddl-auto 从 validate 改为 none，Hibernate 未执行 schema 校验。恢复 validate 后（AC-6）将暴露。

### 预期行为

1. [Ubiquitous] THE export_files 表 SHALL 包含 `error_message VARCHAR(1024)` 列（nullable）。
2. [Ubiquitous] THE export_files 表 SHALL 包含 `export_status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS'` 列。
3. [Ubiquitous] THE export_files 表 `file_hash` 列 SHALL 为 `VARCHAR(128)`，与实体 `@Column(length=128)` 一致。
4. [State-driven] WHILE ddl-auto=validate 时，THE 应用 SHALL 正常启动，无 Schema-validation 错误。

### 不变行为

- export_files 表已有列（id / report_id / file_type / file_path / file_name / file_size / file_hash / generated_at / generated_by / server_seq / 审计列）不变
- CHECK 约束 `chk_ef_file_type` 不变
- 外键 `fk_ef_report` / `fk_ef_generator` 不变
- 已有的 export_files 数据（如有）不丢失

### 根因分析

**复现（源码比对）：**

| 属性 | ExportFile.java 声明 | V7 CREATE TABLE | 状态 |
|------|----------------------|-----------------|------|
| error_message | `@Column(length=1024) String` | （不存在） | ❌ 缺列 |
| export_status | `@Column(length=32, nullable=false) String` | （不存在） | ❌ 缺列 |
| file_hash | `@Column(length=128) String` | `VARCHAR(64)` | ❌ 长度不一致 |

**证据：**
- ExportFile.java 第 57、69、73 行确认实体声明
- V7 第 131-153 行确认表结构（无 error_message / export_status，file_hash=VARCHAR(64)）
- BaseEntity（第 38-55 行）的 server_seq / created_at / updated_at / created_by / updated_by 与 V7 对应列一致 ✅

**假设与验证：**
- H1（确认）：V7 编写时遗漏了 ExportFile 实体后来新增的 error_message / export_status 字段
- H2（确认）：file_hash VARCHAR(64) 是基于 SHA-256（64 位十六进制字符 = 64 字节）设计，但实体 length=128 可能是为兼容未来哈希算法（如 SHA-512 = 128 字符）。DB 列应扩展为 128 以匹配实体
- H3（排除）：不是 ExportFile 实体多余声明了字段 — 这两个字段有明确业务语义（导出状态 + 错误信息，DD-3 报告导出引擎需要）

**确认根因：** V7 迁移文件与 ExportFile 实体不同步。实体定义了 error_message（导出失败信息）和 export_status（SUCCESS/FAILED 状态）两个字段用于 DD-3 报告导出引擎的失败留痕，但 V7 CREATE TABLE 未包含。file_hash 长度设计不一致（DB 64 vs 实体 128）。

**修复策略（forward-compatible，V8 迁移）：**

新增 `V8__fix_export_files_schema.sql`（或与 Bug-4 合并为 `V8__fix_schema_mismatches.sql`）：

```sql
-- Bug-3 修复：补缺列 + 扩展 file_hash 长度
ALTER TABLE export_files ADD COLUMN IF NOT EXISTS error_message VARCHAR(1024);
ALTER TABLE export_files ADD COLUMN IF NOT EXISTS export_status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS';
ALTER TABLE export_files ALTER COLUMN file_hash TYPE VARCHAR(128);
```

**forward-compatible 论证：**
- 全新部署：V7 建表（缺列/短长度）→ V8 补列/扩展 → ddl-auto validate 通过 ✅
- svr-lg：V7 已执行（修补后已有 error_message/export_status 列），V8 用 `IF NOT EXISTS` 幂等跳过 ADD，ALTER file_hash TYPE 是扩展操作安全 ✅
- flyway_schema_history 不受影响（V8 是新增迁移，不修改 V7）✅

**AC-3 修正：** intake.md AC-3 声称 export_status 为 INTEGER，**实际源码 ExportFile.java 第 69 行为 `String exportStatus`（VARCHAR 32）**。验收标准应修正为 VARCHAR(32)。

---

## Bug-4: users.status 列类型 smallint 与 JPA Converter Integer 不匹配

**文件:** `V1__base_tables.sql` 第 19 行 + `UserStatusConverter.java` 第 12 行

### 当前行为

THE users 表的 `status` 列创建为 `SMALLINT`（PostgreSQL int2），但 JPA 实体通过 `UserStatusConverter`（`AttributeConverter<UserStatus, Integer>`）持久化时使用 Java `Integer`（→ JDBC INTEGER → PostgreSQL int4）。

证据链：
- V1 第 19 行：`status SMALLINT NOT NULL DEFAULT 1`（int2）
- User.java 第 45-47 行：`@Convert(converter = UserStatusConverter.class) @Column(name = "status") private UserStatus status;`
- UserStatusConverter.java 第 12 行：`implements AttributeConverter<UserStatus, Integer>` — 泛型 Y=Integer
- UserStatusConverter.java 第 8 行注释：`UserStatus <-> SMALLINT`（**注释与实现矛盾**）
- UserStatus.java 第 7 行注释：`对应 users.status SMALLINT`（**注释与 Converter 泛型矛盾**）

WHEN ddl-auto=validate 时，THEN Hibernate 抛出：

```
Schema-validation: wrong column type in column [status] in table [users]
Encountered: smallint (int2)
Expected: integer (int4)
```

应用无法启动。svr-lg 部署时通过 `ALTER TABLE users ALTER COLUMN status TYPE integer USING status::integer;` 绕过。

### 预期行为

1. [Ubiquitous] THE users 表 `status` 列 SHALL 为 `INTEGER`（int4），与 `UserStatusConverter` 的 `AttributeConverter<UserStatus, Integer>` 泛型一致。
2. [State-driven] WHILE ddl-auto=validate 时，THE 应用 SHALL 正常启动，users.status 无类型校验错误。
3. [Ubiquitous] THE UserStatus 枚举值（DISABLED=0, ACTIVE=1, LOCKED=2）SHALL 在类型变更后保持语义不变。

### 不变行为

- users 表其他列不变
- UserStatus 枚举的 code 值（0/1/2）不变
- admin 账号的 status=1（ACTIVE）不变
- 已有的 users 数据不丢失

### 根因分析

**复现（源码追踪）：**
- V1 第 19 行确认：`status SMALLINT NOT NULL DEFAULT 1`
- UserStatusConverter 第 12 行确认：`AttributeConverter<UserStatus, Integer>`
- Hibernate validate 逻辑：当实体使用 `@Convert(AttributeConverter<X, Integer>)` 时，Hibernate 期望数据库列的 JDBC 类型为 INTEGER（int4），而非 SMALLINT（int2）

**假设与验证：**
- H1（确认）：Converter 泛型 `Integer` → Hibernate 期望 int4 → DB 是 int2 → 类型不匹配
- H2（排除）：不是 User.java 直接声明 Integer 字段 — User.java 使用 UserStatus 枚举 + @Convert，类型由 Converter 泛型决定
- H3（已排除）：开发者注释说"SMALLINT"，说明**原始设计意图是 SMALLINT**，但 Converter 泛型错误地用了 Integer 而非 Short。修复方向应统一为 Integer（改 DB）而非 Short（改 Converter），因为：
  - Java 枚举 code 用 int 更自然
  - Integer 是 JPA AttributeConverter 的惯用类型
  - intake.md 和服务器修补都选择了改 DB 类型

**确认根因：** V1 将 status 设计为 SMALLINT（int2），但 UserStatusConverter 的泛型使用了 Integer（int4）。这是 SQL schema 与 Java 实体层之间的类型约定不一致。开发者注释（"SMALLINT"）表明意图是 SMALLINT，但实现（Converter 泛型 Integer）偏离了意图。

**修复策略（forward-compatible，V8 迁移）：**

在 `V8__fix_schema_mismatches.sql`（与 Bug-3 合并）中添加：

```sql
-- Bug-4 修复：users.status smallint → integer
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'status'
          AND data_type = 'smallint'
    ) THEN
        ALTER TABLE users ALTER COLUMN status TYPE INTEGER USING status::integer;
    END IF;
END $$;
```

**forward-compatible 论证：**
- 全新部署：V1 建 smallint → V8 改 integer → ddl-auto validate 通过 ✅
- svr-lg：V1 已执行（smallint），但临时修补已 ALTER TYPE integer。V8 的 DO 块检测到 data_type 不是 smallint（已是 integer），跳过 ALTER ✅
- flyway_schema_history 不受影响 ✅

**附加建议（可选，design 阶段决定）：** 更新 UserStatusConverter.java 第 8 行和 UserStatus.java 第 7 行的注释（"SMALLINT" → "INTEGER"），消除注释与实现的矛盾。这不影响运行时行为。

---

## Bug-5: install_pg16.sh 参数错误 + PG13 包名不匹配

**文件:** `scripts/ops/install_pg16.sh` 第 25 行 + 第 143 行

### 当前行为

THE install_pg16.sh 脚本包含 2 处错误：

**错误 1（第 143 行）：** initdb 参数错误
```bash
postgresql-16-setup --initdb
```
PGDG 官方 postgresql16-server 包提供的初始化命令是 `postgresql-16-setup initdb`（子命令无 `--` 前缀）。`--initdb` 会被解析为未知选项，命令失败。

**错误 2（第 25 行）：** PG13 包名错误
```bash
PG13_PACKAGES="postgresql-server"
```
脚本使用 PGDG 仓库安装 PG16（`postgresql16-server`），因此同环境下的 PG13 也应为 PGDG 包 `postgresql13-server`。`postgresql-server` 是 RHEL 官方仓库的包名，与 PGDG 包名不一致，导致 `rpm -q postgresql-server`（第 85 行）和 `dnf remove postgresql-server`（第 104 行）无法正确检测/清理 PG13。

svr-lg 部署时跳过脚本，手动执行 `postgresql-16-setup initdb` + `systemctl start postgresql-16` 绕过。

### 预期行为

1. [Event-driven] WHEN 脚本执行 PG16 数据目录初始化时，THEN THE 脚本 SHALL 调用 `postgresql-16-setup initdb`（无 `--` 前缀）。
2. [State-driven] WHILE 目标系统存在 PGDG 安装的 PG13 时，THEN THE 脚本 SHALL 通过 `postgresql13-server` 包名正确检测并卸载。
3. [Ubiquitous] THE 脚本 SHALL 在干净 CentOS/RHEL + PGDG 仓库系统上一次性成功安装并初始化 PG16。

### 不变行为

- 脚本的幂等性逻辑不变（PG16 已装跳过、数据目录已存在跳过）
- pg_hba.conf 配置规则不变（local=peer, 127.0.0.1=scram-sha-256）
- postgresql.conf 参数不变（shared_buffers=512MB 等）
- 环境变量 FJ_DB_PASSWORD 校验逻辑不变
- 交互确认流程不变

### 根因分析

**复现（源码确认）：**
- 第 143 行确认：`postgresql-16-setup --initdb`（带 `--`）
- 第 25 行确认：`PG13_PACKAGES="postgresql-server"`

**证据：**
- PGDG postgresql16-server 包安装的脚本位于 `/usr/pgsql-16/bin/postgresql-16-setup`，接受 `initdb` 作为位置参数（非 `--initdb` 选项）
- PGDG PG13 包名为 `postgresql13-server`（与 PG16 的 `postgresql16-server` 命名一致），非 RHEL 官方的 `postgresql-server`
- 脚本第 127 行 `dnf install -y postgresql${PG16_VERSION}-server` 确认使用 PGDG 包，因此 PG13 也应使用 PGDG 命名

**假设与验证：**
- H1（确认）：`postgresql-16-setup --initdb` → PGDG setup 脚本不识别 `--initdb` 选项 → 命令失败
- H2（确认）：`rpm -q postgresql-server` 在 PGDG 安装的 PG13 环境下返回 "not installed"（实际包名是 postgresql13-server）→ PG13 检测失败
- H3（部分确认）：第 87-88 行有 fallback 检测 `psql --version | grep -qw 13`，可部分弥补包名错误，但 `dnf remove`（第 104 行）仍用错误包名

**确认根因：**
1. PGDG setup 脚本的调用约定（位置参数 `initdb`）与脚本中的 `--initdb`（GNU 长选项风格）不一致
2. PG13 包名假设错误（用了 RHEL 官方包名而非 PGDG 包名）

**修复策略：** 直接修改脚本源文件。不涉及 Flyway，无 forward-compatible 约束。

```bash
# 第 25 行修正
PG13_PACKAGES="postgresql13-server"

# 第 143 行修正
postgresql-16-setup initdb
```

**forward-compatible 论证：** 不适用（运维脚本，非数据库迁移）。

---

## 验收标准

> **注意：** AC-3 已根据实际源码修正（export_status 为 VARCHAR(32) String，非 intake.md 所述的 INTEGER）。

1. [Ubiquitous] THE application-prod.yml SHALL NOT 包含 `spring.profiles.active` 键。
2. [Event-driven] WHEN Flyway 在全新空 PostgreSQL 16 数据库上执行完整迁移链时，THEN 所有迁移 SHALL 一次性成功，无外键违规错误。
3. [Ubiquitous] THE export_files 表 SHALL 包含 `error_message VARCHAR(1024)` 和 `export_status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS'` 列。
4. [Ubiquitous] THE users 表 `status` 列 SHALL 为 `INTEGER`（int4），与 UserStatusConverter 的 Integer 泛型一致。
5. [Event-driven] WHEN install_pg16.sh 在干净 CentOS/RHEL + PGDG 仓库系统上执行时，THEN THE 脚本 SHALL 正确初始化 PG16 数据目录且正确检测/卸载 PG13。
6. [State-driven] WHILE spring.jpa.hibernate.ddl-auto=validate 时，THE 应用 SHALL 正常启动，无 Schema-validation 错误。
7. [Ubiquitous] THE 修复 SHALL NOT 破坏已部署的 svr-lg（flyway_schema_history 中 V1-V7 记录不被删除；V8+ 为附加迁移；Bug-2 修改 V2/V3 需 svr-lg 执行一次性 flyway repair，属已知 trade-off）。

---

## 新发现（intake.md 未覆盖）

### 发现 1: export_status 类型描述错误（intake.md → 实际源码）

intake.md 第 78-79 行描述 ExportFile.java 声明 `private Integer exportStatus;`，但实际源码（ExportFile.java 第 69-70 行）为：
```java
@Column(name = "export_status", nullable = false, length = 32)
private String exportStatus = "SUCCESS";
```
export_status 是 **String**（VARCHAR 32），值为 "SUCCESS" / "FAILED"，不是 Integer。AC-3 已据此修正。

### 发现 2: file_hash 列长度不一致（V8 需一并修复）

V7 第 140 行 `file_hash VARCHAR(64)` 与 ExportFile.java 第 57 行 `@Column(length=128)` 不匹配。当 ddl-auto 恢复为 validate（AC-6）时会暴露。已在 Bug-3 根因分析中纳入 V8 修复范围。

### 发现 3: UserStatusConverter / UserStatus 注释与实现矛盾

UserStatusConverter.java 第 8 行注释 "UserStatus <-> SMALLINT" 和 UserStatus.java 第 7 行注释 "对应 users.status SMALLINT" 均声称 SMALLINT，但 Converter 泛型实际使用 Integer。这是 Bug-4 的注释误导来源。建议 design 阶段更新注释（不影响运行时）。

### 发现 4（建议，非本 WI 范围）: 全量 schema-validate 审查

本 WI 仅分析了 intake.md 列出的 5 个 bug 涉及的实体（User / ExportFile）。项目其他模块（fj-project / fj-inspection / fj-approval 等）的 @Entity 与 DB schema 之间可能存在类似的不匹配。当 ddl-auto 恢复 validate 后，这些不匹配会暴露为启动失败。建议在 design 阶段或独立 WI 中对全项目所有 @Entity 做一次 schema-validate 审查。

---

## 配置点清单

本次修复引入的可配置/外部依赖项：

| 配置项 | 位置 | 说明 |
|--------|------|------|
| `SPRING_PROFILES_ACTIVE` | 外部环境变量 | Bug-1 修复后 profile 激活依赖此变量（需部署流程设置 `=prod`） |
| V8 迁移幂等写法 | `V8__fix_schema_mismatches.sql` | ADD COLUMN IF NOT EXISTS / DO 块条件 ALTER，保证 svr-lg 幂等 |
| svr-lg flyway repair | 运维操作（一次性） | Bug-2 修改 V2/V3 后，svr-lg 升级需执行 flyway repair 同步 checksum |
