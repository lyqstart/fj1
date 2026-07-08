# Change Classification — WI-0005 (svr-lg 同步 WI-0004 源码修复)

> Work Item: WI-0005
> Workflow Type: ops_task
> 分类时间: 2026-07-04
> 分类者: sf-design
> 标准依据: specforge_final_fused_standard_v1_1_patch1_zh.md

---

## 1. 变更摘要

将 WI-0004 修复后的源码（V3 系统占位项目修复、V8 schema 不匹配修复、ddl-auto 恢复 validate）同步到已运行的 svr-lg (10.0.12.12)，使服务器运行干净的修复版本。

**构建约束关键事实（Orchestrator 确认）：** 本地无 maven/JDK17，svr-lg 无 javac/maven，**无法标准构建 jar**。采用 jar 内部文件修补（zip/unzip）方案替代重新打包。

---

## 2. 变更类型

| 维度 | 分类 |
|------|------|
| **变更大类** | ops_task（运维操作） |
| **变更子类** | 生产环境源码同步（hot-patch via jar 内部修补） |
| **是否数据库变更** | ✅ 是（Flyway repair + V8 迁移） |
| **是否服务停机** | ✅ 是（fj1-api 停机 2-5 分钟，预估含缓冲 5-10 分钟） |
| **是否配置变更** | ✅ 是（外部 application-prod.yml ddl-auto: none → validate） |
| **是否代码变更** | ❌ 否（源码已在 WI-0004 修复，本 WI 不改源码） |

---

## 3. 变更范围

### 3.1 服务器端变更对象（svr-lg 10.0.12.12）

| # | 变更对象 | 变更内容 | 变更方式 | 可回滚 |
|---|----------|----------|----------|--------|
| 1 | `/opt/fj1/api/fj-api-1.0.0.jar` 内部 `BOOT-INF/classes/db/migration/V3__project_tables.sql` | 更新为修复版（含 INSERT projects(0)） | `zip -u` 更新 jar 内文件 | ✅ jar 备份 |
| 2 | `/opt/fj1/api/fj-api-1.0.0.jar` 内部 `BOOT-INF/classes/db/migration/V8__fix_schema_mismatches.sql` | 新增 V8 迁移文件 | `zip` 添加 jar 内文件 | ✅ jar 备份 |
| 3 | `/opt/fj1/api/application-prod.yml`（外部覆盖配置） | `ddl-auto: none` → `validate` | 文件编辑（cp 覆盖） | ✅ yml 备份 |
| 4 | PostgreSQL `flyway_schema_history` 表 | V3 的 checksum 字段更新（repair） | Flyway CLI repair 或 SQL UPDATE | ✅ history 导出备份 |
| 5 | PostgreSQL schema（export_files / users 表） | V8 迁移应用（幂等：补列 + 扩展类型） | Flyway migrate（Spring Boot 启动时自动执行） | ✅ pg_dump 备份 |
| 6 | `/opt/flyway-9.22.3/`（临时） | 安装 Flyway CLI（仅用于 repair） | 下载 + 解压 | ✅ 可删除（操作完成后清理） |
| 7 | `/tmp/flyway-migrations/`（临时） | 迁移文件工作目录（V1-V8） | 从 jar 提取 + 覆盖 V3 + 添加 V8 | ✅ 可删除 |

### 3.2 不变更的对象

- ❌ 源码仓库（`/mnt/1t_back/project/fj1/fj-backend/**`）— WI-0004 已修复，本 WI 只读
- ❌ systemd unit（`/etc/systemd/system/fj-api.service`）— 已正确设置 SPRING_PROFILES_ACTIVE=prod
- ❌ `.env` 文件（`/opt/fj1/api/.env`）— 机密不变
- ❌ nginx 配置 — 不受影响
- ❌ PostgreSQL 服务本身 — 不重启，仅操作 fj1_inspect 数据库
- ❌ jar 内其他文件（Java class、其他 yml、其他迁移文件）— 仅修补 V3 + 添加 V8

---

## 4. 风险等级

**整体风险等级：中（Medium）**

### 风险等级评定依据

| 风险因子 | 等级 | 说明 |
|----------|------|------|
| 停机影响 | 中 | fj1-api 停机 2-5 分钟（预估含缓冲 5-10 分钟），部署窗口内执行 |
| 数据丢失风险 | **低** | V8 是幂等 schema 修复（补列/扩展类型），不删除数据；pg_dump 全量备份可回滚 |
| 回滚可行性 | **高** | jar/yml/flyway_history/数据库四重备份，可独立回滚 |
| 不可逆操作 | 中 | Flyway repair 修改 checksum（可通过 history 导出回滚） |
| 网络依赖 | 中 | Flyway CLI 下载需外网（有 fallback 镜像） |
| 业务影响 | 低 | fj_inspect 数据库仅有种子数据（admin 账号、角色、字典），无真实业务数据 |

### 风险等级矩阵

```
影响程度:    低           中           高
发生概率:
高           ─           ─           ─
中           ─     [整体风险: 中]    ─
低           ✅          ─           ─
```

---

## 5. 破坏性操作清单（需用户确认）

以下操作标记为破坏性（`is_destructive=true`），执行前需用户确认：

| 步骤 | 操作 | 破坏性原因 | requires_user_confirmation |
|------|------|------------|---------------------------|
| D1 | Flyway repair（更新 flyway_schema_history V3 checksum） | 修改 Flyway 元数据，影响后续迁移校验 | ✅ true |
| E1 | 停止 fj1-api 服务 | 服务停机，用户不可访问 | ✅ true |
| E2 | zip 修补 jar（更新 V3 + 添加 V8） | 修改运行时 jar 文件 | ❌ false（有 jar 备份） |
| F1 | 启动 fj1-api（触发 V8 迁移） | 执行数据库 schema 变更 | ❌ false（V8 幂等 + 有 DB 备份） |

---

## 6. 变更分类决策记录

### 6.1 为何不用标准 mvn 构建？

**决策：不构建，采用 jar 内部修补。**

理由：
1. 本地（/mnt/1t_back/project/fj1）仅有 JDK 8，无 maven，无 mvnw — 无法构建
2. svr-lg 仅有 JRE 17（无 javac），无 maven — 无法构建
3. 安装 JDK17 + maven 的成本和风险高于 jar 修补
4. jar 修补方案已在 WI-0003 中验证可行（zip 修补 yml 成功）
5. 仅需修改 jar 内 2 个 SQL 文件，修补面极小且可控

### 6.2 为何需要 Flyway repair？

**决策：必须执行 Flyway repair。**

理由：
1. WI-0004 修改了 V3 源文件（新增 INSERT projects(0)），改变了文件 checksum
2. svr-lg 的 flyway_schema_history 记录的是旧 V3 的 checksum
3. 外部 yml `validate-on-migrate: true` — 启动时 Flyway 会校验所有已应用迁移的 checksum
4. checksum 不匹配 → Flyway 抛 `FlywayValidateException` → 应用启动失败
5. **必须先 repair 同步 checksum，再启动服务**

### 6.3 为何选择 Flyway CLI 方案（方案 A）而非手算 checksum（方案 B）？

**决策：推荐方案 A（Flyway CLI），fallback 方案 B。**

| 维度 | 方案 A（Flyway CLI） | 方案 B（Python 手算 checksum） | 方案 C（临时关 validate） |
|------|---------------------|-------------------------------|--------------------------|
| 可靠性 | ✅ 高（官方工具） | ❌ 低（CRC32 变种算法复杂） | ⚠️ 中（跳过校验有隐患） |
| 网络依赖 | ⚠️ 需下载 CLI | ✅ 无 | ✅ 无 |
| 后续影响 | ✅ 无（一次性 repair） | ✅ 无 | ❌ checksum 仍不匹配，下次重启又失败 |
| 操作复杂度 | 中（下载+配置+执行） | 高（算法实现+验证） | 低（改配置重启） |
| 版本兼容风险 | ⚠️ 需匹配 Flyway 版本 | ✅ 无版本问题 | ✅ 无 |

**结论：** 方案 A 最可靠。若网络不通或版本不兼容，fallback 到方案 B。方案 C 仅作为紧急 fallback（不推荐，因未解决根本问题）。

---

## 7. 回滚策略概览

| 回滚场景 | 回滚操作 | 回滚耗时 |
|----------|----------|----------|
| jar 修补失败 | 恢复 `/opt/fj1/api/fj-api-1.0.0.jar.bak.WI0005` | < 1 分钟 |
| 外部 yml 修改失败 | 恢复 `/opt/fj1/api/application-prod.yml.bak.WI0005` | < 1 分钟 |
| Flyway repair 失败 | `psql < flyway_history_backup.sql` 恢复 history | < 2 分钟 |
| V8 迁移失败 | `pg_restore` 或 `psql < fj_inspect_backup.sql` | < 5 分钟 |
| ddl-auto=validate 启动失败 | 恢复 yml ddl-auto=none + 恢复旧 jar | < 3 分钟 |
| health 检查失败 | 恢复旧 jar + 重启 | < 3 分钟 |

**详细回滚步骤见 ops_plan.md「回滚方案」章节。**

---

## 8. 前置条件检查清单

在开始操作前，必须确认以下前置条件全部满足：

| # | 前置条件 | 验证命令 | 必须 |
|---|----------|----------|------|
| 1 | svr-lg 可通过 `ssh lg` 访问（root） | `ssh lg 'hostname'` | ✅ |
| 2 | fj1-api 当前健康（health=UP） | `ssh lg 'curl -s localhost:8080/api/actuator/health'` | ✅ |
| 3 | PostgreSQL 16 运行中 | `ssh lg 'systemctl is-active postgresql-16'` | ✅ |
| 4 | svr-lg 有 zip/unzip 命令 | `ssh lg 'which zip unzip'` | ✅ |
| 5 | svr-lg 磁盘空间充足（>500MB） | `ssh lg 'df -h /opt /tmp'` | ✅ |
| 6 | 本地修复后的 V3/V8 文件存在 | `ls fj-backend/.../V3__*.sql V8__*.sql` | ✅ |
| 7 | 本地修复后的 yml 模板存在 | `ls deploy/config/application-prod.yml` | ✅ |
| 8 | .env 文件存在（含 DB_PASSWORD） | `ssh lg 'ls /opt/fj1/api/.env'` | ✅ |
| 9 | 已确认部署窗口（用户同意停机） | 用户确认 | ✅ |

---

## 自检

| 检查项 | 通过 |
|--------|------|
| 变更类型明确（ops_task） | ✅ |
| 变更范围完整列举（7 个变更对象） | ✅ |
| 不变更对象明确（6 项） | ✅ |
| 风险等级评定（中）有依据 | ✅ |
| 破坏性操作标记（4 项） | ✅ |
| 回滚策略可用（6 种场景） | ✅ |
| 前置条件检查清单（9 项） | ✅ |
| 构建约束已体现（jar 修补方案） | ✅ |
| Flyway repair 必要性已论证 | ✅ |
| 方案选择有对比（A/B/C） | ✅ |
