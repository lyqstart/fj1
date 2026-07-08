---
tasks_format: bugfix
work_item_id: WI-0007
workflow_type: bugfix_spec
workflow_path: requirement_change_path
source_design: design.md
source_requirements: requirements.md
base_spec_version: PSV-0001
title: 实体与 DDL Schema 不匹配修复任务拆分
total_tasks: 4
parallel_batches: 1
serial_tasks: 0
---

# Tasks — WI-0007：实体与 DDL Schema 不匹配修复

> 基于 `design.md`（5 个 DD）拆分为 4 个可执行任务。
> 5 个修复项互相独立，无文件交集，无共享代码（T5 不适用），**全部可并行执行**。

---

## 0. 任务依赖图与执行批次

### 0.1 依赖关系

```
TASK-1 (W1/DD-1, fj-sync) ──────┐
TASK-2 (W2+W3/DD-2+DD-3, fj-api)├── 全部并行，无依赖
TASK-3 (I1/DD-4, fj-issue) ─────┤
TASK-4 (I2/DD-5, fj-recommend) ─┘
```

### 0.2 执行批次

| 批次 | 任务 | 可并行 | 说明 |
|------|------|--------|------|
| Batch-1 | TASK-1, TASK-2, TASK-3, TASK-4 | ✅ 全部并行 | 4 个 task 文件无交集，无跨模块依赖 |

### 0.3 文件交集检查（并行安全性证明）

| 文件 | TASK-1 | TASK-2 | TASK-3 | TASK-4 |
|------|--------|--------|--------|--------|
| fj-sync/.../SyncBatchStatus.java | ✍ 改 | — | — | — |
| fj-sync/.../SyncBatch.java | ✍ 改 | — | — | — |
| fj-sync/.../SyncPushService.java | ✍ 改 | — | — | — |
| fj-api/.../V9__fix_enum_check_constraints.sql | — | ✍ 新建 | — | — |
| fj-issue/.../ProjectIssue.java | — | — | ✍ 改 | — |
| fj-recommend/.../StandardRecommendationResult.java | — | — | — | ✍ 改 |

**结论：** 任意两个 task 的 allowed_write_files 交集为空，全部可安全并行。

### 0.4 配置文件状态说明

- `.specforge/config/prod-environment.md`：TODO 未填充（design.md ASSUMP-1 假设生产 PostgreSQL ≥ 12）。
- `.specforge/config/project-rules.md`：TODO 未填充。
- verification_commands 基于 design.md 假设编写，不依赖未填充配置。

---

### TASK-1 SyncBatchStatus 枚举对齐 V4 DDL CHECK 约束（W1）

**context_block**（executor 必读，无需回查 design.md）：

- **What**:
  将 `fj-sync` 模块的 `SyncBatchStatus` 枚举从 `{PROCESSING, COMPLETED, FAILED}` 改为 `{RECEIVED, SUCCESS, PARTIAL, CONFLICT, FAILED}`，并更新全部 3 处引用点（默认值 + 2 处 setStatus 赋值），使其与 V4 DDL `chk_sync_batches_status` CHECK 约束完全对齐。

- **Why**:
  当前枚举值 PROCESSING/COMPLETED 不在 DDL CHECK 允许值集内（仅 FAILED 重合），导致同步推送（push）每次在创建批次记录 INSERT 时即触发 PostgreSQL CHECK 违规，同步推送功能完全不可用（缺陷 W1，对应 REQ 追溯键 W1）。

- **Refs**: DD-1（design.md §2.DD-1），REQ 追溯键 W1

- **Where**:
  - **read_files**（executor 需读取理解上下文，只读）:
    - `fj-backend/fj-api/src/main/resources/db/migration/V4__task_tables.sql`（查看 L252-254 的 chk_sync_batches_status CHECK 定义，确认权威值集）
  - **allowed_write_files**（仅可修改这 3 个文件）:
    - `fj-backend/fj-sync/src/main/java/com/fj/sync/entity/SyncBatchStatus.java`
    - `fj-backend/fj-sync/src/main/java/com/fj/sync/entity/SyncBatch.java`
    - `fj-backend/fj-sync/src/main/java/com/fj/sync/service/SyncPushService.java`
  - **forbidden_files**（禁止修改）:
    - `.specforge/work-items/WI-0007/requirements.md`（只读输入）
    - `.specforge/work-items/WI-0007/design.md`（只读输入）
    - `.specforge/work-items/WI-0007/tasks.md`（只读输入）
    - `fj-backend/fj-api/src/main/resources/db/migration/V9__fix_enum_check_constraints.sql`（TASK-2 所有）
    - `fj-backend/fj-issue/src/main/java/com/fj/issue/entity/ProjectIssue.java`（TASK-3 所有）
    - `fj-backend/fj-recommend/src/main/java/com/fj/recommend/entity/StandardRecommendationResult.java`（TASK-4 所有）
    - 任何 V4/V5 既有 Flyway 迁移脚本（INV-6：已执行迁移不可变）

- **Constraints**:
  - **不引入新依赖**，纯枚举值重命名。
  - 枚举值必须与 V4 DDL `chk_sync_batches_status` 完全一致：`RECEIVED, SUCCESS, PARTIAL, CONFLICT, FAILED`，无多余无缺失。
  - `PARTIAL` 与 `CONFLICT` 为预留值，**不实现其使用逻辑**（DD4 YAGNI），仅在枚举中保留以对齐 DDL。
  - `FAILED` 值不变（新旧枚举均含）。
  - **持久化方式不变**：`@Enumerated(EnumType.STRING)`（SyncBatch.java 已有注解，不要动）。
  - **INV-1 不变行为**：同步推送按 `client_batch_uuid` 去重的幂等语义不变；SyncPushResponse.status 字符串值从 "PROCESSING"/"COMPLETED" 变为 "RECEIVED"/"SUCCESS" 是语义等价的对齐（假设无外部消费者硬编码匹配旧字符串，ASSUMP-3）。
  - **修改前必须全量 grep** 确认无 `if/switch/equals` 比较逻辑引用旧枚举值（design.md 已审计确认全为赋值，但 executor 需复核）。

- **Done When**（全部满足）:
  - `SyncBatchStatus.java` 枚举体为 `{RECEIVED, SUCCESS, PARTIAL, CONFLICT, FAILED}`，每个值带 JavaDoc 注释。
  - `SyncBatch.java:45` 默认值为 `SyncBatchStatus.RECEIVED`（旧 PROCESSING）。
  - `SyncPushService.java:79` 为 `batch.setStatus(SyncBatchStatus.RECEIVED)`（旧 PROCESSING）。
  - `SyncPushService.java:121` 为 `batch.setStatus(SyncBatchStatus.SUCCESS)`（旧 COMPLETED）。
  - `SyncPushService.java:72,119` 注释中 PROCESSING/COMPLETED 更新为 RECEIVED/SUCCESS。
  - `fj-sync` 模块内**无** PROCESSING / COMPLETED 残留引用。
  - `fj-sync` 模块编译通过（`mvn compile`）。

**详细修改点**（从 design.md DD-1 提取，executor 直接执行）：

1. `SyncBatchStatus.java` — 完整替换枚举体：
```java
package com.fj.sync.entity;

/**
 * 同步批次状态枚举（对应 sync_batches.status VARCHAR，§101.28）。
 * 值集与 V4__task_tables.sql 的 chk_sync_batches_status CHECK 约束完全对齐。
 */
public enum SyncBatchStatus {
    /** 已接收（服务端已接收，处理中） */
    RECEIVED,
    /** 处理完成（全部成功） */
    SUCCESS,
    /** 部分成功（部分记录冲突） */
    PARTIAL,
    /** 存在冲突 */
    CONFLICT,
    /** 处理失败 */
    FAILED
}
```

2. `SyncBatch.java:45`：
```java
// 旧: private SyncBatchStatus status = SyncBatchStatus.PROCESSING;
private SyncBatchStatus status = SyncBatchStatus.RECEIVED;
```

3. `SyncPushService.java`：
| 行号 | 旧 | 新 |
|------|----|----|
| L72（注释） | `// ===== 2. 创建批次记录（PROCESSING） =====` | `// ===== 2. 创建批次记录（RECEIVED） =====` |
| L79 | `batch.setStatus(SyncBatchStatus.PROCESSING);` | `batch.setStatus(SyncBatchStatus.RECEIVED);` |
| L119（注释） | `// ===== 4. 更新批次记录（COMPLETED） =====` | `// ===== 4. 更新批次记录（SUCCESS） =====` |
| L121 | `batch.setStatus(SyncBatchStatus.COMPLETED);` | `batch.setStatus(SyncBatchStatus.SUCCESS);` |

- **依赖**: 无
- refs: [W1, DD-1, AC-1, AC-8, INV-1]
- depends_on: []
- expected_file_changes:
  - `fj-backend/fj-sync/src/main/java/com/fj/sync/entity/SyncBatchStatus.java`（修改：枚举体替换）
  - `fj-backend/fj-sync/src/main/java/com/fj/sync/entity/SyncBatch.java`（修改：L45 默认值）
  - `fj-backend/fj-sync/src/main/java/com/fj/sync/service/SyncPushService.java`（修改：L72/79/119/121）
- **verification_commands**（每条返回退出码，可用内置 Grep 工具或 grep 命令执行）:
  - `grep -c "RECEIVED" fj-backend/fj-sync/src/main/java/com/fj/sync/entity/SyncBatchStatus.java` → 期望 ≥1（退出码 0）
  - `grep -c "SUCCESS\|PARTIAL\|CONFLICT" fj-backend/fj-sync/src/main/java/com/fj/sync/entity/SyncBatchStatus.java` → 期望 ≥3（退出码 0）
  - `grep -c "SyncBatchStatus.RECEIVED" fj-backend/fj-sync/src/main/java/com/fj/sync/entity/SyncBatch.java` → 期望 ≥1（退出码 0）
  - `grep -c "SyncBatchStatus.RECEIVED" fj-backend/fj-sync/src/main/java/com/fj/sync/service/SyncPushService.java` → 期望 ≥1（退出码 0）
  - `grep -c "SyncBatchStatus.SUCCESS" fj-backend/fj-sync/src/main/java/com/fj/sync/service/SyncPushService.java` → 期望 ≥1（退出码 0）
  - `grep -rn "PROCESSING\|COMPLETED" fj-backend/fj-sync/src/main/java/` → 期望**无任何输出**（退出码 1 表示通过：无残留旧枚举值）
  - `mvn -f fj-backend/pom.xml compile -pl fj-sync -am` → 期望 BUILD SUCCESS（退出码 0）；如模块路径不同，在 fj-backend 目录执行 `mvn compile`
- **verification_evidence_expected**:
  - `command`: grep RECEIVED SyncBatchStatus.java，`expected_exit_code`: 0，`expected_output_pattern`: "RECEIVED"，`evidence_type`: test_output
  - `command`: grep PROCESSING/COMPLETED 残留检查，`expected_exit_code`: 1（无匹配），`expected_output_pattern`: （空），`evidence_type`: test_output
  - `command`: mvn compile，`expected_exit_code`: 0，`expected_output_pattern`: "BUILD SUCCESS"，`evidence_type`: build_log
- out_of_scope:
  - 不实现 PARTIAL/CONFLICT 的业务使用逻辑（DD4 YAGNI）。
  - 不修改 V4 既有迁移脚本（INV-6）。
  - 不修改 SyncPushResponse 的结构（仅 status 字段值语义等价变化，INV-1）。
  - 不增加 API 版本兼容层（ASSUMP-3）。
  - 不处理 fj-sync 模块外的任何文件。

---

### TASK-2 新建 V9 迁移扩展 CHECK 约束与列长度（W2+W3）

**context_block**（executor 必读，无需回查 design.md）：

- **What**:
  新建 Flyway 迁移文件 `V9__fix_enum_check_constraints.sql`，包含两项增量变更：
  (1) **W2**：DROP 并重建 `project_issues.status` 的 CHECK 约束 `chk_pi_status`，从 5 值扩展为 8 值（新增 RECTIFIED/CLOSED/OVERDUE）。
  (2) **W3**：将 `standard_recommendation_results.standard_library_version` 从 `VARCHAR(32)` 扩展为 `VARCHAR(64)`。

- **Why**:
  - **W2**：`IssueStatus` 枚举有 8 个值且 `IssueStatusService.TRANSITIONS` 状态机使用了全部 8 值（含整改闭环核心状态 RECTIFIED/CLOSED/OVERDUE），但 V5 DDL 的 `chk_pi_status` 仅允许 5 值，导致 markRectified/close/markOverdue 三个业务流程触发 CHECK 违规，问题池整改闭环不可用。
  - **W3**：实体声明 `@Column(length=64)` 而 DDL 为 `VARCHAR(32)`，当版本号字符串超 32 字符时写入失败，且 ddl-auto=validate 启动校验不一致。
  - V5 已执行不可改（INV-6），必须通过新建 V9 增量迁移补救。

- **Refs**: DD-2（design.md §2.DD-2），DD-3（design.md §2.DD-3），REQ 追溯键 W2、W3

- **Where**:
  - **read_files**（executor 需读取理解上下文，只读）:
    - `fj-backend/fj-api/src/main/resources/db/migration/V5__daily_report_tables.sql`（确认现有 chk_pi_status 在 L234、standard_library_version 在 L300 的既有定义）
    - `fj-backend/fj-issue/src/main/java/com/fj/issue/entity/IssueStatus.java`（确认 8 值枚举的准确拼写）
  - **allowed_write_files**（仅可新建这 1 个文件）:
    - `fj-backend/fj-api/src/main/resources/db/migration/V9__fix_enum_check_constraints.sql`
  - **forbidden_files**（禁止修改）:
    - `.specforge/work-items/WI-0007/requirements.md`、`design.md`、`tasks.md`（只读输入）
    - 任何 V1-V8 既有 Flyway 迁移脚本（INV-6：已执行迁移不可变，修改会触发 FlywayValidateException）
    - `fj-sync/.../SyncBatchStatus.java`、`SyncBatch.java`、`SyncPushService.java`（TASK-1 所有）
    - `fj-issue/.../ProjectIssue.java`（TASK-3 所有）
    - `fj-recommend/.../StandardRecommendationResult.java`（TASK-4 所有）

- **Constraints**:
  - **必须是新建文件**，文件名 `V9__fix_enum_check_constraints.sql`（V1-V8 已存在，V9 是正确下一版本号）。
  - **不修改任何 V1-V8 既有迁移脚本**（INV-6）。
  - **W2 CHECK 为超集扩展**：新 8 值必须包含旧 5 值 `{VALID, PENDING_CONFIRM, SUSPENDED, VOIDED, CORRECTED}`，新增 `{RECTIFIED, CLOSED, OVERDUE}`，顺序按 design.md：`VALID, PENDING_CONFIRM, RECTIFIED, CLOSED, OVERDUE, SUSPENDED, VOIDED, CORRECTED`。
  - **AC-7 幂等性**：DROP 必须使用 `IF EXISTS` 保护；依赖 Flyway 版本控制保证 ADD CONSTRAINT 不重复执行。
  - **W3 用标准 SQL**（非 PL/pgSQL DO 块），保持与 V1-V8 编写风格一致。
  - **数据兼容性**（INV-5）：旧 5 值是新 8 值真子集，VARCHAR(32)→64 不截断，无需数据回填。
  - 状态值字符串拼写必须与 `IssueStatus` 枚举 `name()` 完全一致（大写下划线）。

- **Done When**（全部满足）:
  - `V9__fix_enum_check_constraints.sql` 文件存在。
  - 文件包含 `DROP CONSTRAINT IF EXISTS chk_pi_status`。
  - 文件包含 `ADD CONSTRAINT chk_pi_status CHECK (status IN ('VALID', 'PENDING_CONFIRM', 'RECTIFIED', 'CLOSED', 'OVERDUE', 'SUSPENDED', 'VOIDED', 'CORRECTED'))`，恰好 8 个值。
  - 文件包含 `ALTER TABLE standard_recommendation_results ALTER COLUMN standard_library_version TYPE VARCHAR(64)`。
  - SQL 语法正确（PostgreSQL 方言）。

**V9 文件完整内容**（从 design.md §3.1 提取，executor 直接写入）：

```sql
-- ============================================================================
-- V9: 修复枚举/CHECK/长度不匹配（WI-0007）
-- ============================================================================
-- 来源：WI-0006 全量 Schema 审查发现的 5 个不匹配中的 DDL 相关项（W2 + W3）
-- 设计：见 .specforge/work-items/WI-0007/design.md（DD-2 + DD-3）
-- 类型：forward-compatible 增量迁移（宽松化 + 扩展，不破坏现有数据）
-- 幂等：是（DROP 使用 IF EXISTS，ALTER TYPE 可重复执行）
-- ============================================================================

-- ----- W2: 扩展 project_issues.status CHECK 约束（5→8 值） -----
-- 根因：V5 chk_pi_status 是项目早期版本，未随 TASK-026/027 业务扩展同步更新
-- IssueStatus 枚举（8值）+ IssueStatusService.TRANSITIONS（完整状态机）需要全部 8 个状态
-- 缺失的 3 个：RECTIFIED（已整改）/ CLOSED（已关闭）/ OVERDUE（超期）—— 整改闭环核心状态
-- 兼容性：旧 5 值是新 8 值的真子集，DROP+重建为超集不拒绝任何现有行
ALTER TABLE project_issues DROP CONSTRAINT IF EXISTS chk_pi_status;
ALTER TABLE project_issues ADD CONSTRAINT chk_pi_status CHECK (
    status IN ('VALID', 'PENDING_CONFIRM', 'RECTIFIED', 'CLOSED', 'OVERDUE',
               'SUSPENDED', 'VOIDED', 'CORRECTED')
);

-- ----- W3: 扩展 standard_library_version 长度（32→64） -----
-- 根因：V5 DDL 编写时对版本号长度估算不足（32），实体已声明 64
-- 存储内容：推荐时使用的标准库版本（取自 StandardDocument.version）
-- 兼容性：VARCHAR 扩展不截断数据（PG 12+ 仅更新元数据，不锁表）
ALTER TABLE standard_recommendation_results
    ALTER COLUMN standard_library_version TYPE VARCHAR(64);
```

- **依赖**: 无
- refs: [W2, W3, DD-2, DD-3, AC-2, AC-3, AC-7, INV-2, INV-5, INV-6]
- depends_on: []
- expected_file_changes:
  - `fj-backend/fj-api/src/main/resources/db/migration/V9__fix_enum_check_constraints.sql`（**新建**）
- **verification_commands**（每条返回退出码）:
  - `test -f fj-backend/fj-api/src/main/resources/db/migration/V9__fix_enum_check_constraints.sql` → 期望退出码 0（文件存在）
  - `grep -c "DROP CONSTRAINT IF EXISTS chk_pi_status" fj-backend/fj-api/src/main/resources/db/migration/V9__fix_enum_check_constraints.sql` → 期望 ≥1（退出码 0）
  - `grep -c "RECTIFIED\|CLOSED\|OVERDUE" fj-backend/fj-api/src/main/resources/db/migration/V9__fix_enum_check_constraints.sql` → 期望 ≥3（退出码 0，新增 3 个状态值出现）
  - `grep -c "VARCHAR(64)" fj-backend/fj-api/src/main/resources/db/migration/V9__fix_enum_check_constraints.sql` → 期望 ≥1（退出码 0）
  - `grep -c "ALTER COLUMN standard_library_version TYPE VARCHAR(64)" fj-backend/fj-api/src/main/resources/db/migration/V9__fix_enum_check_constraints.sql` → 期望 ≥1（退出码 0）
- **verification_evidence_expected**:
  - `command`: test -f V9.sql，`expected_exit_code`: 0，`evidence_type`: file_existence
  - `command`: grep DROP CONSTRAINT IF EXISTS，`expected_exit_code`: 0，`expected_output_pattern`: "DROP CONSTRAINT IF EXISTS"，`evidence_type`: test_output
  - `command`: grep VARCHAR(64)，`expected_exit_code`: 0，`expected_output_pattern`: "VARCHAR(64)"，`evidence_type`: test_output
- out_of_scope:
  - 不修改 V4/V5 既有迁移脚本（INV-6）。
  - 不写 undo/回滚脚本到 V9 文件（回滚 SQL 仅供运维紧急用，见 design.md §3.3）。
  - 不在 svr-lg 生产环境执行 flyway migrate（属运维操作，另立 ops_task WI 或合并到验证阶段）。
  - 不修改 IssueStatus 枚举值（8 值是正确业务设计）。
  - 不实现 PL/pgSQL DO 块幂等版本（依赖 Flyway 版本控制，design.md §3.2）。

---

### TASK-3 ProjectIssue.status 默认值对齐 DDL DEFAULT（I1）

**context_block**（executor 必读，无需回查 design.md）：

- **What**:
  将 `ProjectIssue.java:76` 的 status 字段 Java 默认值从 `IssueStatus.VALID` 改为 `IssueStatus.PENDING_CONFIRM`，对齐 V5 DDL `DEFAULT 'PENDING_CONFIRM'`。

- **Why**:
  Java 默认值 VALID 与 DDL DEFAULT 'PENDING_CONFIRM' 语义不同（VALID=已入池活跃状态，PENDING_CONFIRM=待确认/待审核入池）。虽然 `IssuePoolService.generateFromDailyReport()` 总是显式 setStatus(VALID) 覆盖默认值，正常入池流程不受影响，但在边界场景（直接 `new ProjectIssue()` 未设 status 即 save）会产生语义不一致隐患，且 ddl-auto=validate 严格校验下不一致。修复为防御性对齐（缺陷 I1）。

- **Refs**: DD-4（design.md §2.DD-4），REQ 追溯键 I1

- **Where**:
  - **read_files**（executor 需读取理解上下文，只读）:
    - `fj-backend/fj-issue/src/main/java/com/fj/issue/entity/IssueStatus.java`（确认 PENDING_CONFIRM 枚举值存在及拼写）
    - `fj-backend/fj-issue/src/main/java/com/fj/issue/service/IssuePoolService.java`（确认 L98 显式 setStatus(VALID) 覆盖默认值，理解 INV-3 安全性）
  - **allowed_write_files**（仅可修改这 1 个文件）:
    - `fj-backend/fj-issue/src/main/java/com/fj/issue/entity/ProjectIssue.java`
  - **forbidden_files**（禁止修改）:
    - `.specforge/work-items/WI-0007/requirements.md`、`design.md`、`tasks.md`（只读输入）
    - `fj-sync/.../SyncBatchStatus.java`、`SyncBatch.java`、`SyncPushService.java`（TASK-1 所有）
    - `fj-backend/fj-api/src/main/resources/db/migration/V9__fix_enum_check_constraints.sql`（TASK-2 所有）
    - `fj-backend/fj-recommend/src/main/java/com/fj/recommend/entity/StandardRecommendationResult.java`（TASK-4 所有）
    - `IssuePoolService.java`、`IssueStatusService.java`、`IssueStatus.java`（只读，INV-2/INV-3 不变行为）
    - 任何 V1-V8 既有 Flyway 迁移脚本（INV-6）

- **Constraints**:
  - **仅改 1 行**：`ProjectIssue.java:76` 的字段默认值初始化语句。
  - **不修改** `@Enumerated`、`@Column` 注解（仅改赋值右侧的枚举值）。
  - **INV-3 不变行为**：`IssuePoolService.generateFromDailyReport()` 入池后问题状态仍为 VALID（因为它显式 setStatus(VALID) 覆盖默认值）。改默认值不得影响入池流程——executor 需确认 IssuePoolService 仍显式设置。
  - **不修改 IssueStatus 枚举**、`IssueStatusService.TRANSITIONS` 状态机（INV-2）。
  - `PENDING_CONFIRM` 必须是 IssueStatus 枚举中已存在的值（executor 需读取确认）。

- **Done When**（全部满足）:
  - `ProjectIssue.java:76` 为 `private IssueStatus status = IssueStatus.PENDING_CONFIRM;`（旧 `IssueStatus.VALID`）。
  - `fj-issue` 模块编译通过。
  - IssuePoolService.java 未被修改（INV-3 入池逻辑不变）。

**详细修改点**：

```java
// ProjectIssue.java:76（修复前）
private IssueStatus status = IssueStatus.VALID;
// ProjectIssue.java:76（修复后）
private IssueStatus status = IssueStatus.PENDING_CONFIRM;
```

- **依赖**: 无
- refs: [I1, DD-4, AC-4, INV-3]
- depends_on: []
- expected_file_changes:
  - `fj-backend/fj-issue/src/main/java/com/fj/issue/entity/ProjectIssue.java`（修改：L76 默认值 VALID → PENDING_CONFIRM）
- **verification_commands**（每条返回退出码）:
  - `grep -n "status = IssueStatus.PENDING_CONFIRM" fj-backend/fj-issue/src/main/java/com/fj/issue/entity/ProjectIssue.java` → 期望 ≥1 匹配（退出码 0）
  - `grep -c "status = IssueStatus.VALID" fj-backend/fj-issue/src/main/java/com/fj/issue/entity/ProjectIssue.java` → 期望 0 匹配（退出码 1 表示通过：旧默认值已移除）
  - `grep -c "setStatus(IssueStatus.VALID)" fj-backend/fj-issue/src/main/java/com/fj/issue/service/IssuePoolService.java` → 期望 ≥1（退出码 0，确认 INV-3：入池显式覆盖逻辑仍在，未被误改）
  - `mvn -f fj-backend/pom.xml compile -pl fj-issue -am` → 期望 BUILD SUCCESS（退出码 0）；如模块路径不同，在 fj-backend 目录执行 `mvn compile`
- **verification_evidence_expected**:
  - `command`: grep PENDING_CONFIRM，`expected_exit_code`: 0，`expected_output_pattern`: "status = IssueStatus.PENDING_CONFIRM"，`evidence_type`: test_output
  - `command`: grep 旧 VALID 默认值，`expected_exit_code`: 1（无匹配），`evidence_type`: test_output
  - `command`: grep IssuePoolService VALID，`expected_exit_code`: 0，`expected_output_pattern`: "setStatus(IssueStatus.VALID)"，`evidence_type`: test_output
  - `command`: mvn compile，`expected_exit_code`: 0，`expected_output_pattern`: "BUILD SUCCESS"，`evidence_type`: build_log
- out_of_scope:
  - 不修改 IssueStatus 枚举值。
  - 不修改 IssuePoolService 入池逻辑（INV-3）。
  - 不修改 IssueStatusService 状态机（INV-2）。
  - 不修改 V5 DDL DEFAULT（V5 不可变，INV-6）。
  - 不处理 fj-issue 模块外的任何文件。

---

### TASK-4 StandardRecommendationResult.issue_id 补 nullable=false（I2）

**context_block**（executor 必读，无需回查 design.md）：

- **What**:
  为 `StandardRecommendationResult.java:33-34` 的 `issueId` 字段的 `@Column` 注解添加 `nullable = false`，对齐 V5 DDL `issue_id BIGINT NOT NULL`。

- **Why**:
  当前 `@Column(name = "issue_id")` 未声明 nullable，JPA 默认 nullable=true，与 DDL NOT NULL 矛盾。同实体内 projectId（L29）和 clauseId（L37）均正确标注了 nullable=false，唯独 issueId 遗漏。在 ddl-auto=validate 下会校验失败（缺陷 I2，对应 AC-5、AC-6）。

- **Refs**: DD-5（design.md §2.DD-5），REQ 追溯键 I2

- **Where**:
  - **read_files**（executor 需读取理解上下文，只读）:
    - `fj-backend/fj-recommend/src/main/java/com/fj/recommend/entity/StandardRecommendationResult.java`（确认 L29 projectId、L37 clauseId 的 nullable=false 写法，保持风格一致）
  - **allowed_write_files**（仅可修改这 1 个文件）:
    - `fj-backend/fj-recommend/src/main/java/com/fj/recommend/entity/StandardRecommendationResult.java`
  - **forbidden_files**（禁止修改）:
    - `.specforge/work-items/WI-0007/requirements.md`、`design.md`、`tasks.md`（只读输入）
    - `fj-sync/.../SyncBatchStatus.java`、`SyncBatch.java`、`SyncPushService.java`（TASK-1 所有）
    - `fj-backend/fj-api/src/main/resources/db/migration/V9__fix_enum_check_constraints.sql`（TASK-2 所有）
    - `fj-backend/fj-issue/src/main/java/com/fj/issue/entity/ProjectIssue.java`（TASK-3 所有）
    - 任何 V1-V8 既有 Flyway 迁移脚本（INV-6）

- **Constraints**:
  - **仅改 1 行注解**：`@Column(name = "issue_id")` → `@Column(name = "issue_id", nullable = false)`。
  - **不修改** `private Long issueId;` 字段声明本身（类型不变）。
  - **风格一致**：nullable = false 的写法（空格、引号）与同实体 projectId/clauseId 保持一致。
  - **INV-4 不变行为**：DDL 已强制 NOT NULL，补注解仅消除 validate 模式校验差异，不改变运行时写入行为（推荐结果始终关联到具体问题）。
  - 不修改 standardLibraryVersion 的 length=64（那是 W3 由 DDL 侧对齐，非本 task）。

- **Done When**（全部满足）:
  - `StandardRecommendationResult.java:33` 为 `@Column(name = "issue_id", nullable = false)`。
  - `fj-recommend` 模块编译通过。

**详细修改点**：

```java
// StandardRecommendationResult.java:33-34（修复前）
@Column(name = "issue_id")
private Long issueId;
// StandardRecommendationResult.java:33-34（修复后）
@Column(name = "issue_id", nullable = false)
private Long issueId;
```

- **依赖**: 无
- refs: [I2, DD-5, AC-5, AC-6, INV-4]
- depends_on: []
- expected_file_changes:
  - `fj-backend/fj-recommend/src/main/java/com/fj/recommend/entity/StandardRecommendationResult.java`（修改：L33 @Column 注解补 nullable = false）
- **verification_commands**（每条返回退出码）:
  - `grep -n "issue_id.*nullable = false\|nullable = false.*issue_id" fj-backend/fj-recommend/src/main/java/com/fj/recommend/entity/StandardRecommendationResult.java` → 期望 ≥1（退出码 0）
  - `grep -A1 "issue_id" fj-backend/fj-recommend/src/main/java/com/fj/recommend/entity/StandardRecommendationResult.java` → 期望输出含 `nullable = false`（退出码 0）
  - `mvn -f fj-backend/pom.xml compile -pl fj-recommend -am` → 期望 BUILD SUCCESS（退出码 0）；如模块路径不同，在 fj-backend 目录执行 `mvn compile`
- **verification_evidence_expected**:
  - `command`: grep issue_id nullable，`expected_exit_code`: 0，`expected_output_pattern`: "nullable = false"，`evidence_type`: test_output
  - `command`: mvn compile，`expected_exit_code`: 0，`expected_output_pattern`: "BUILD SUCCESS"，`evidence_type`: build_log
- out_of_scope:
  - 不修改 standardLibraryVersion 的 length 属性（W3 由 DDL 侧 V9 对齐）。
  - 不修改 projectId/clauseId 的注解（它们已正确）。
  - 不修改 V5 DDL（INV-6）。
  - 不处理 fj-recommend 模块外的任何文件。

---

## 5. 全局验证（所有 TASK 完成后）

以下验证不绑定单个 task，在所有 4 个 task 完成后执行：

- **AC-6（全局）**：`ddl-auto=validate` 模式下应用正常启动，无 SchemaValidationException。
  - verification: 配置 `spring.jpa.hibernate.ddl-auto=validate` 后 `mvn spring-boot:run`（或 @SpringBootTest），期望启动无异常。
- **AC-8（全局）**：全代码库无 SyncBatchStatus 旧枚举值残留。
  - verification: `grep -rn "SyncBatchStatus.PROCESSING\|SyncBatchStatus.COMPLETED" fj-backend/` → 期望无输出。

---

## 6. 覆盖统计

| 维度 | 数量 | 明细 |
|------|------|------|
| 总缺陷（REQ 追溯键） | 5 | W1, W2, W3, I1, I2 |
| 总 DD | 5 | DD-1 ~ DD-5 |
| 总 AC | 8 | AC-1 ~ AC-8 |
| 总 TASK | 4 | TASK-1 ~ TASK-4 |
| 总文件变更 | 6 | 5 改 + 1 新建 |
| 并行批次 | 1 | Batch-1（4 task 全并行） |
| 串行 task | 0 | 无 |
| 共享代码 task | 0 | 无（T5 不适用） |
| 无悬空 REQ | ✅ | 全部 REQ 有 task 覆盖 |
| 无悬空 DD | ✅ | 全部 DD 有 task 覆盖 |
| 无悬空 TASK | ✅ | 全部 task 有明确目标文件 |
| 所有 task 有 context_block | ✅ | |
| 所有 task 有 verification | ✅ | |

---

## 7. 自检清单（提交前）

- [x] 每个 DD 都有对应的 task 覆盖（DD-1→TASK-1, DD-2+DD-3→TASK-2, DD-4→TASK-3, DD-5→TASK-4）
- [x] 每个 task 的 context_block 充分（executor 不需要回查 design.md）
- [x] verification_commands 真能机器跑（grep/test/mvn 均返回退出码）
- [x] 并行批次内 task 互相独立（allowed_write_files 无交集）
- [x] 无共享代码需先建独立 task（T5 不适用）
- [x] allowed_write_files 路径具体无通配符（§12.7 合规）
- [x] forbidden_files 包含 requirements/design/tasks 及其他 task 写文件
- [x] 每个 task 标题格式为 `### TASK-N`（Knowledge Graph 解析要求）
- [x] 每个 REQ 至少关联一个 AC
- [x] 每个 AC 至少关联一个 TASK
