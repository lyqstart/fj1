# Tasks — WI-0006 (全项目 @Entity schema-validate 审查)

> **工作流类型**: investigation（只读调查，不修改任何源代码）
> **调查对象**: fj-backend 下 38 个 @Entity 实体类 × Flyway V1-V8（40 张表）
> **预期产出**: findings_report.md（通过 sf_artifact_write 写入 WI-0006 目录）
> **执行模式**: 严格串行（TASK-1 → TASK-2 → TASK-3 → TASK-4）

## 任务总览

| TASK | 阶段 | 描述 | depends_on |
|------|------|------|------------|
| TASK-1 | 0+1 | 枚举 @Entity 实体 + 建立实体↔DDL 表映射 | - |
| TASK-2 | 2 | 构建 DDL 完整字段字典（CREATE + V8 ALTER 合并） | TASK-1 |
| TASK-3 | 3 | 逐实体 7 维字段对比 | TASK-2 |
| TASK-4 | 4+5 | 分类严重级别 + 生成 findings_report.md | TASK-3 |

**只读约束**: 所有 task 的 `allowed_write_files` 为空（源码零修改）。调查笔记/findings 统一通过 `sf_artifact_write` 写入 `.specforge/work-items/WI-0006/`（governance 产物），严禁修改任何项目源代码。

---

### TASK-1 阶段 0+1：枚举 @Entity 实体 + 建立实体↔DDL 表映射

**context_block**（executor 必读）：
- **What**:
  1. 用 grep 扫描 `fj-backend/` 下所有 `@Entity` 注解类，生成完整实体清单（含模块路径、类全限定名、`@Table(name=...)` 映射表名）
  2. 读取 V1-V8 全部 8 个 SQL 文件，提取所有 `CREATE TABLE` 语句，记录表名清单
  3. 建立双向映射：实体 ↔ 表，每个映射项标记状态 `matched`（实体有对应表）/ `orphan-entity`（实体无对应表）/ `orphan-table`（表无对应实体）
- **Why**: 为后续字段级对比提供基础清单（满足 AC-1、AC-2 的覆盖前提）。映射是 TASK-2/3 的前置输入，缺它无法判断哪个实体对应哪张表。
- **Refs**: 调查方法第 1 步（requirements.md L23）；intake.md 调查范围（L18-26）
- **Where**:
  - `read_files`（只读审查范围）:
    - `fj-backend/**/entity/**/*.java`（38 个 @Entity 类，分布于 fj-system/fj-recommend/fj-sync/fj-export/fj-approval/fj-report/fj-issue/fj-inspection/fj-project/fj-common）
    - `fj-backend/fj-api/src/main/resources/db/migration/V1__base_tables.sql`
    - `fj-backend/fj-api/src/main/resources/db/migration/V2__seed_data.sql`
    - `fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql`
    - `fj-backend/fj-api/src/main/resources/db/migration/V4__task_tables.sql`
    - `fj-backend/fj-api/src/main/resources/db/migration/V5__daily_report_tables.sql`
    - `fj-backend/fj-api/src/main/resources/db/migration/V6__approval_tables.sql`
    - `fj-backend/fj-api/src/main/resources/db/migration/V7__report_tables.sql`
    - `fj-backend/fj-api/src/main/resources/db/migration/V8__fix_schema_mismatches.sql`
  - `allowed_write_files`: `[]`（源码零修改；调查笔记通过 sf_artifact_write 写入 WI-0006）
  - `forbidden_files`: 所有项目源代码文件（只读）；requirements.md、design.md、tasks.md、intake.md
- **Constraints**:
  - 只读分析，禁止修改任何 .java / .sql / 配置文件
  - 实体清单必须覆盖全部 38 个 @Entity（grep `@Entity` 排除 `@EntityScan` 后应为 38）
  - 表清单必须覆盖 V1-V8 全部 CREATE TABLE（预期 40 张表）
  - 区分 `@Entity` 与 `@EntityScan`（FjApplication.java 的 @EntityScan 不是实体，必须排除）
  - 读取 SQL 时使用 `src/main/resources/db/migration/` 源文件，忽略 `target/classes/` 编译复制品
- **Done When**:
  - 实体清单条目数 = 38（排除 @EntityScan）
  - 表清单条目数 = 40
  - 每个实体条目含：模块名、类全限定名、@Table(name) 值、映射状态
  - 每个表条目含：表名、来源 V 版本、列数（仅计数，详细列定义留给 TASK-2）
  - 无 orphan-entity 或 orphan-table 被遗漏（如有需记录并说明原因）
- **expected_file_changes**: `[]`（调查只读）
- **verification_commands**:
  - `grep -rn "@Entity$" fj-backend --include="*.java" | grep -v "@EntityScan" | wc -l` → 期望输出 `38`（exit 0 通过；输出≠38 则调查不完整）
  - `grep -rhoi "CREATE TABLE[[:space:]]\+[a-z_]*" fj-backend/fj-api/src/main/resources/db/migration/*.sql | sort -u | wc -l` → 期望输出 `40`（exit 0；输出≠40 则 DDL 未完全提取）
  - 读取本 task 产出的调查笔记，确认含「实体清单」「表清单」「映射状态表」三节且每个实体均有 matched/orphan 标记
- **verification_evidence_expected**:
  - `{ "command": "grep @Entity ... | wc -l", "expected_exit_code": 0, "expected_output_pattern": "38", "evidence_type": "investigation_coverage" }`
  - `{ "command": "grep CREATE TABLE ... | wc -l", "expected_exit_code": 0, "expected_output_pattern": "40", "evidence_type": "investigation_coverage" }`
- **out_of_scope**:
  - 不做字段级对比（属 TASK-3）
  - 不解析 ALTER TABLE（属 TASK-2）
  - 不修改任何源码

---

### TASK-2 阶段 2：构建 DDL 完整字段字典

**context_block**（executor 必读）：
- **What**:
  1. 解析 V1-V8 所有 `CREATE TABLE` 的列定义，提取每列：列名、数据类型、长度/精度标度、`NOT NULL`/可空、默认值
  2. 解析 V8（及任何版本中）`ALTER TABLE ... ADD COLUMN / ALTER COLUMN / DROP COLUMN`，按 V1→V8 版本顺序合并进字段字典，得到**最终生效 schema**
  3. 对每张表输出字段字典：`表名 → [ {列名, 类型, 长度, 可空, 默认值} ]`
- **Why**: TASK-3 字段对比需要"DDL 实际值"作为基准。若只读 CREATE TABLE 不应用 ALTER，会用过时 schema 对比，产生假阳性（满足 AC-2）。
- **Refs**: 调查方法第 2 步（requirements.md L24）；intake.md 已知 Bug-3/4（V8 修复，证明 ALTER 合并的必要性，intake.md L76-78）
- **Where**:
  - `read_files`（只读）:
    - `fj-backend/fj-api/src/main/resources/db/migration/V1__base_tables.sql` ... `V8__fix_schema_mismatches.sql`（8 个文件，同 TASK-1）
    - TASK-1 产出的表清单（作为索引）
  - `allowed_write_files`: `[]`
  - `forbidden_files`: 所有项目源代码；governance 规格文件
- **Constraints**:
  - 只读分析
  - **ALTER 合并顺序严格按 V1→V8 版本号**：后版本覆盖前版本
  - V8 的 ALTER 必须全部应用（intake.md 已确认 V8 修复了 export_files / users 等表）
  - 字段字典必须覆盖 40 张表的全部列
  - PostgreSQL 特有类型（JSONB/TEXT/SERIAL/BIGSERIAL/TIMESTAMPTZ）原样记录，不做类型推断
- **Done When**:
  - 40 张表每张表都有完整字段字典
  - V8 的所有 ALTER TABLE 已被识别并合并（合并前后状态可追溯）
  - 每列记录 5 个属性：列名、类型、长度/精度、可空、默认值
  - 字段字典中表的列总数 = 各 CREATE TABLE 列数 ± ALTER 增减（可手工抽查 3 张表核对）
- **expected_file_changes**: `[]`
- **verification_commands**:
  - `grep -c "ALTER TABLE" fj-backend/fj-api/src/main/resources/db/migration/V8__fix_schema_mismatches.sql` → 期望 exit 0（输出为 ALTER 数量，需>0 证明已识别修复点）
  - 读取本 task 字段字典笔记，确认 40 张表均有字段条目，且 V8 ALTER 已标注「已合并」
  - 抽查校验：字段字典中 `export_files` 表应含 `error_message` 和 `export_status` 列（V8 新增，Bug-3 修复）；`users.status` 应为修正后类型
- **verification_evidence_expected**:
  - `{ "command": "grep -c ALTER TABLE V8...", "expected_exit_code": 0, "expected_output_pattern": "[1-9][0-9]*", "evidence_type": "investigation_coverage" }`
- **out_of_scope**:
  - 不读取 Java 实体字段（属 TASK-3）
  - 不分类严重级别（属 TASK-4）
  - 不修改 SQL 文件

---

### TASK-3 阶段 3：逐实体 7 维字段对比

**context_block**（executor 必读）：
- **What**:
  对 TASK-1 清单中的 38 个 @Entity 类，逐个读取字段上的 JPA 注解（`@Column`/`@JoinColumn`/`@Enumerated`/`@Table`/`@ManyToOne` 等），与 TASK-2 字段字典中对应表的列定义做 **7 维对比**：
  1. **列名**：`@Column(name=)` / 驼峰转下划线默认值 vs DDL 列名
  2. **数据类型**：Java 类型（String/Integer/Long/Boolean/BigDecimal/LocalDateTime/enum）vs SQL 类型（VARCHAR/INTEGER/BIGINT/BOOLEAN/NUMERIC/TIMESTAMPTZ/JSONB）
  3. **长度**：`@Column(length=)` vs `VARCHAR(n)` 的 n
  4. **可空性**：`@Column(nullable=)` vs `NOT NULL`
  5. **精度/标度**：`@Column(precision=, scale=)` vs `NUMERIC(p,s)`（数字类型）
  6. **枚举映射**：`@Enumerated(ORDINAL/STRING)` 或自定义 `AttributeConverter` vs SQL 存储类型（smallint/integer/varchar）
  7. **外键关联**：`@JoinColumn(name=)` / `@ManyToOne` 外键列 vs DDL 外键列定义及类型
  对每个差异记录：实体类.字段、表名.列名、实体期望值、DDL 实际值、差异维度
- **Why**: 这是调查的核心，直接产出"不匹配清单"（AC-1 的实质内容）。7 维覆盖确保不遗漏 ddl-auto=validate 会校验的维度。
- **Refs**: 调查方法第 3 步（requirements.md L25）；intake.md 对比维度（L27-34）；已知 Bug-3/4 是 7 维中"类型/长度/枚举"差异的实例
- **Where**:
  - `read_files`（只读）: 38 个 @Entity 类（TASK-1 清单）+ TASK-2 字段字典
  - `allowed_write_files`: `[]`
  - `forbidden_files`: 所有项目源代码（只读审查）；governance 规格文件
- **Constraints**:
  - 只读分析，禁止修改 .java 文件
  - **必须覆盖全部 38 个实体，无遗漏**（AC-1）
  - 每个实体的每个持久化字段（@Column/@JoinColumn/@Id 注解或基本映射字段）都必须对比
  - 已知 Bug-3/4 修复项（ExportFile、User）应被识别为"已修复，当前匹配"以验证方法有效性
  - `@Transient` 透传字段和非持久化字段跳过
  - 继承（@Inheritance）和 @MappedSuperclass 的字段需追溯到父类一并对比
- **Done When**:
  - 38 个实体每个都有对比结果记录（matched 全通过 或 列出差异项）
  - 每个差异项含 5 要素：实体.字段 / 表.列 / 实体期望 / DDL 实际 / 差异维度（7 维之一或多个）
  - 不匹配项总数已统计（即使为 0 也要明确声明"零不匹配"）
  - 已知 Bug-3/4 在当前 V8 后状态被验证为"已修复"
- **expected_file_changes**: `[]`
- **verification_commands**:
  - 读取本 task 对比结果笔记，确认含 38 个实体条目（与 TASK-1 清单 1:1 对应）
  - `grep -rn "@Entity$" fj-backend --include="*.java" | grep -v "@EntityScan" | wc -l` → `38`（复核审查覆盖率，exit 0）
  - 抽查：对比结果中应能找到 ExportFile 和 User 两个实体的条目，且标注当前状态（验证 V8 修复是否被识别）
- **verification_evidence_expected**:
  - `{ "command": "grep @Entity ... | wc -l", "expected_exit_code": 0, "expected_output_pattern": "38", "evidence_type": "investigation_coverage" }`
- **out_of_scope**:
  - 不分类严重级别（属 TASK-4）
  - 不给修复建议（属 TASK-4）
  - 不验证 native query 正确性
  - 不修改实体类

---

### TASK-4 阶段 4+5：分类严重级别 + 生成 findings_report.md

**context_block**（executor 必读）：
- **What**:
  1. 对 TASK-3 产出的所有不匹配项，按以下规则分类严重级别：
     - **Critical**：类型不匹配（会导致 ddl-auto=validate 启动失败，如 String vs INTEGER、enum-ORDINAL vs varchar）
     - **Warning**：长度差异、精度差异（Hibernate validate 默认不校验 varchar length，但其他部署配置下可能是隐患）
     - **Info**：可空性差异、命名差异、默认值差异（不影响 validate 启动但需记录）
  2. 对每个 Critical / Warning 项，给出**具体修复建议**（改实体 or 改 DDL，二选一并说明理由）
  3. 汇总生成 `findings_report.md`，通过 `sf_artifact_write` 写入 WI-0006 目录
  4. 在报告中包含**调查限制说明**章节
- **Why**: 直接满足 AC-3（分类）、AC-4（修复建议）、AC-5（调查限制）。findings_report.md 是本 WI 的最终交付物。
- **Refs**: 调查方法第 4-5 步（requirements.md L25-26）；intake.md 严重级别定义（L50-54）；预期产出（intake.md L57-70）
- **Where**:
  - `read_files`（只读）: TASK-3 对比结果、TASK-1/2 清单
  - `allowed_write_files`: `[]`（源码零修改；findings_report.md 通过 sf_artifact_write 写入 WI 目录，属 governance 产物）
  - `forbidden_files`: 所有项目源代码；requirements.md/design.md/tasks.md/intake.md（只读）
- **Constraints**:
  - 严重级别必须遵循 intake.md 的三档定义（Critical/Warning/Info），不得自创级别
  - 每个不匹配项必须有且仅有一个严重级别（AC-3）
  - 每个 Critical/Warning 必须有修复建议（AC-4）；Info 项修复建议可选
  - 报告必须含「调查限制」章节（AC-5），至少说明：静态分析不连库、不验证 native query、不覆盖 DTO、枚举推断假设等
  - 修复建议属于"建议"，不在本 WI 执行（intake.md L88-89）
  - findings_report.md 结构遵循 intake.md L57-70：实体清单 / DDL 映射 / 不匹配清单 / 建议 / 限制
- **Done When**:
  - findings_report.md 已通过 sf_artifact_write 写入 WI-0006
  - 报告含 5 个必备章节：①实体清单(38) ②DDL 映射表(40) ③不匹配清单(每项含严重级别) ④修复建议(Critical/Warning 每项有) ⑤调查限制
  - 每个不匹配项的严重级别 ∈ {Critical, Warning, Info}
  - Critical/Warning 项的修复建议具体到"改哪个文件哪个字段"或"加哪个 ALTER"
- **expected_file_changes**: `[]`（源码零修改；仅 WI 目录新增 findings_report.md，属 governance 产物）
- **verification_commands**:
  - 读取 `.specforge/work-items/WI-0006/` 下 findings_report 相关产物，确认含 5 个章节标题（实体清单 / DDL 映射 / 不匹配清单 / 修复建议 / 调查限制）
  - 在报告中 grep 严重级别关键字：`Critical`、`Warning`、`Info` 应至少各出现一次（或明确声明某级别零项）
  - 复核每个不匹配项均标注了严重级别（无"未分类"残留）
- **verification_evidence_expected**:
  - `{ "command": "read findings_report 5 章节", "expected_exit_code": 0, "expected_output_pattern": "调查限制", "evidence_type": "investigation_report" }`
- **out_of_scope**:
  - 不执行任何修复（修复属后续单独 WI）
  - 不修改源码
  - 不连接数据库验证
  - 不审查 DTO/VO/native query

---

## 自检清单（提交前完成）

- [x] 每个 AC 都有对应 task 覆盖（AC-1→TASK-1/3, AC-2→TASK-1/2, AC-3/4/5→TASK-4）
- [x] 每个 task 的 context_block 充分（What/Why/Refs/Where/Constraints/Done When 齐全）
- [x] verification_commands 真能机器跑（grep/wc/read，返回 exit code）
- [x] 串行链：TASK-1→2→3→4，无循环依赖，无并行冲突
- [x] 共享数据：TASK-1 清单 / TASK-2 字典通过 depends_on 链式传递，无复制粘贴
- [x] investigation 语境：所有 task allowed_write_files=[]（源码零修改）
- [x] 38 实体 / 40 表 / 5 AC / 7 维度全部有 task 覆盖
- [x] Contract 完整性：每个 task 含 task_id/refs/depends_on/context_block/expected_file_changes/verification_commands/verification_evidence_expected/out_of_scope
