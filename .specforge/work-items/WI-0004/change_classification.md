# Change Classification — WI-0004

**Work Item:** WI-0004 (fj1 源码 bug 修复)
**变更类型:** bugfix（源码缺陷修复）
**来源:** WI-0003 首次部署 svr-lg 时发现的 5 个源码 bug
**分析模式:** bugfix_spec

---

## 1. 变更范围总览

本次变更修复 5 个独立的源码 bug，跨越 4 个技术域：

| Bug | 技术域 | 涉及文件 | Flyway 约束 | 可直接改源文件 |
|-----|--------|----------|-------------|----------------|
| Bug-1 | Spring Boot 配置 | `deploy/config/application-prod.yml` | 无关 | ✅ 是 |
| Bug-2 | SQL 迁移链顺序 | `V2__seed_data.sql` + `V3__project_tables.sql` | **受约束** | ❌ 见下文论证 |
| Bug-3 | SQL schema + JPA 实体不匹配 | `V7__report_tables.sql` + `ExportFile.java` | 受约束 | V8+ forward 可行 |
| Bug-4 | SQL 列类型 + JPA Converter 不匹配 | `V1__base_tables.sql` + `UserStatusConverter.java` | 受约束 | V8+ forward 可行 |
| Bug-5 | 运维脚本 | `scripts/ops/install_pg16.sh` | 无关 | ✅ 是 |

---

## 2. 各 Bug 风险等级评估

### Bug-1: application-prod.yml spring.profiles.active — 风险：低

- **变更性质:** 删除 2 行配置（`spring.profiles.active` 键）
- **风险点:** 删除后 profile 激活依赖外部环境变量 `SPRING_PROFILES_ACTIVE`。若部署流程未设置该变量，应用将以默认 profile（无 profile）启动，可能加载错误配置。
- **缓解:** 部署流程（systemd unit / 启动脚本）应已设置 `SPRING_PROFILES_ACTIVE=prod`，需在 design 阶段确认。
- **数据语义影响:** 无
- **接口契约影响:** 无

### Bug-2: V2 种子数据 FK 违规 — 风险：高（forward-compatible 技术限制）

- **变更性质:** SQL 迁移链顺序逻辑修正
- **风险点:** 此 bug **无法通过 V8+ forward-only 迁移修复**（详见根因分析）。V3 的 `ADD CONSTRAINT` 在 V8 之前执行即失败，迁移链中断，V8 永远不会执行。修改源 V 文件是唯一根本解法，但会改变 Flyway checksum，影响已部署的 svr-lg。
- **缓解:** svr-lg 升级前需执行一次性 `flyway repair` 同步 checksum；或在部署文档中记录此约束。
- **数据语义影响:** 无（仅影响迁移执行过程，不改最终 schema 语义）
- **接口契约影响:** 无

### Bug-3: V7 export_files 缺列 — 风险：中

- **变更性质:** V8 新增迁移补列 + 可能修改 file_hash 长度
- **风险点:**
  1. export_files 缺 `error_message` / `export_status` 两列 — V8 ADD COLUMN 可修复
  2. **新发现:** `file_hash` 列 VARCHAR(64) 与实体 `@Column(length=128)` 不匹配 — 需 V8 ALTER COLUMN TYPE
  3. svr-lg 临时修补已手动 ADD 了 error_message/export_status 列，V8 需用 `IF NOT EXISTS` 幂等
- **缓解:** V8 迁移使用幂等写法（ADD COLUMN IF NOT EXISTS / 条件 ALTER）
- **数据语义影响:** 无（新增 nullable 列 + 扩展 varchar 长度，不改变已有数据语义）
- **接口契约影响:** export API 响应新增 error_message/export_status 字段（原本实体已有，只是 DB 缺列）

### Bug-4: users.status 类型不匹配 — 风险：中

- **变更性质:** V8 修改列类型 smallint → integer
- **风险点:** ALTER COLUMN TYPE 在 PostgreSQL 中会重写表（大表有性能影响）。users 表当前数据量极小（仅 admin 种子账号），无性能风险。
- **缓解:** V8 使用条件判断（DO 块检查当前类型），避免 svr-lg 上重复 ALTER
- **数据语义影响:** 无（0/1/2 的值在 smallint 和 integer 中语义一致）
- **接口契约影响:** 无

### Bug-5: install_pg16.sh 脚本错误 — 风险：低

- **变更性质:** 修正 2 处脚本逻辑（initdb 参数 + PG13 包名）
- **风险点:** 无（运维脚本，不影响运行中的应用）
- **缓解:** 无需缓解
- **数据语义影响:** 无
- **接口契约影响:** 无

---

## 3. 是否影响数据语义 / 接口契约

| Bug | 数据语义 | 接口契约 | 说明 |
|-----|----------|----------|------|
| Bug-1 | 无 | 无 | 配置变更，不改数据/接口 |
| Bug-2 | 无 | 无 | 迁移过程修正，最终 schema 不变 |
| Bug-3 | 无 | **轻微** | export API 响应结构补全（实体已声明，DB 补齐） |
| Bug-4 | 无 | 无 | 列类型扩展（smallint→int），值域不变 |
| Bug-5 | 无 | 无 | 运维脚本，与应用无关 |

**结论:** 本次变更不破坏任何已发布的数据语义或接口契约。Bug-3 的接口变化是"补全"而非"破坏"——实体早已声明字段，只是 DB 缺列导致运行时失败。

---

## 4. forward-compatible 分类

| Bug | forward-compatible 可行性 | 修复路径 |
|-----|---------------------------|----------|
| Bug-1 | N/A（非 Flyway） | 直接改 application-prod.yml |
| Bug-2 | ❌ **不可行**（技术限制） | 必须修改源 V2/V3 文件 + svr-lg flyway repair |
| Bug-3 | ✅ 可行 | 新增 V8 迁移（ADD COLUMN + ALTER TYPE） |
| Bug-4 | ✅ 可行 | 新增 V8 迁移（ALTER COLUMN TYPE） |
| Bug-5 | N/A（非 Flyway） | 直接改 install_pg16.sh |

**关键裁决:** Bug-2 是本次变更中唯一无法纯 forward-only 修复的 bug。此结论基于 Flyway 的执行模型（按版本号顺序、单事务、失败即停），有明确的技术依据，需在 design 阶段和用户确认。
