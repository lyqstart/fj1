---
bugfix_format: systematic
work_item_id: WI-0007
---

# Bugfix 分析：实体与 DDL Schema 不匹配修复

> 基于 WI-0006 全量 Schema 审查（38 个 @Entity 类 vs 40 张表）发现的 5 个非启动级不匹配问题。
> 本文档全部内容已经源码静态分析验证，引用了实际行号与实际枚举值/CHECK 约束。

## 缺陷清单

| 编号 | 严重程度 | 类型 | 缺陷摘要 |
|------|---------|------|---------|
| W1 | Warning | 枚举值不一致 | SyncBatchStatus 枚举（3 值）与 sync_batches.status CHECK 约束（5 值）冲突，仅 FAILED 重合 |
| W2 | Warning | 枚举值不一致 | IssueStatus 枚举（8 值）超出 project_issues.status CHECK 约束（5 值），缺 RECTIFIED/CLOSED/OVERDUE |
| W3 | Warning | 长度不一致 | standard_library_version 实体 @Column(length=64) vs DDL VARCHAR(32) |
| I1 | Info | 默认值不一致 | ProjectIssue.status Java 默认 IssueStatus.VALID vs DDL DEFAULT 'PENDING_CONFIRM'，语义不同 |
| I2 | Info | 可空性不一致 | StandardRecommendationResult.issue_id 实体无 nullable 注解（默认可空）vs DDL NOT NULL |

---

## 1. 当前行为（Current Behavior）

### W1：SyncBatchStatus 枚举值与 sync_batches.status CHECK 约束冲突

当前 `SyncBatchStatus` 枚举定义了 3 个值：

- `PROCESSING`（已接收/处理中）
- `COMPLETED`（处理完成）
- `FAILED`（处理失败）

而 V4 迁移脚本 `sync_batches` 表的 CHECK 约束 `chk_sync_batches_status` 允许 5 个值：

- `RECEIVED`、`SUCCESS`、`PARTIAL`、`CONFLICT`、`FAILED`

两侧值集仅 `FAILED` 一个值重合。`PROCESSING` 与 `COMPLETED` 均不在 CHECK 允许范围内。

**触发路径（静态分析确认）：**

1. `SyncBatch.java:45` 字段默认值初始化为 `SyncBatchStatus.PROCESSING`。
2. `SyncPushService.push()` 在 `SyncPushService.java:79` 执行 `batch.setStatus(SyncBatchStatus.PROCESSING)`，随即 `syncBatchRepository.save(batch)`（第 80 行）执行 INSERT。
3. PostgreSQL 在 INSERT 时校验 `chk_sync_batches_status`，发现 `'PROCESSING'` 不在允许值集中，抛出 `new row for relation "sync_batches" violates check constraint "chk_sync_batches_status"`。
4. 即使 INSERT 阶段被绕过，`SyncPushService.java:121` 在推送完成后执行 `batch.setStatus(SyncBatchStatus.COMPLETED)`，UPDATE 时再次触发 CHECK 违规。

**影响范围：** 同步推送（push）功能完全不可用——每次推送在创建批次记录时即失败。

### W2：IssueStatus 枚举值超出 project_issues.status CHECK 约束

当前 `IssueStatus` 枚举定义了 8 个值：

- `VALID`、`PENDING_CONFIRM`、`RECTIFIED`、`CLOSED`、`OVERDUE`、`SUSPENDED`、`VOIDED`、`CORRECTED`

而 V5 迁移脚本 `project_issues` 表的 CHECK 约束 `chk_pi_status` 仅允许 5 个值：

- `VALID`、`PENDING_CONFIRM`、`SUSPENDED`、`VOIDED`、`CORRECTED`

缺少的 3 个值：`RECTIFIED`、`CLOSED`、`OVERDUE`——恰好是问题池整改生命周期中最关键的状态。

**触发路径（静态分析确认）：**

`IssueStatusService` 的状态机 `TRANSITIONS` 邻接表使用了全部 8 个枚举值。以下三个业务流程会写入不在 CHECK 允许范围内的状态，触发 PostgreSQL CHECK 违规：

1. **标记已整改**：`IssueStatusService.markRectified()`（第 75 行）将 status 设为 `RECTIFIED`。当问题推进到已整改阶段时，UPDATE 触发 CHECK 违规。
2. **关闭问题**：`IssueStatusService.close()`（第 87 行）将 status 设为 `CLOSED`。当整改验证通过需闭环时，UPDATE 触发 CHECK 违规。
3. **超期标记**：`IssueStatusService.markOverdue()`（第 135 行）将 status 设为 `OVERDUE`（由 `OverdueDetectionJob` 批量调用）。整改期限过期后自动标记超期时触发 CHECK 违规。

**影响范围：** 问题池整改闭环流程不可用——问题无法完成整改、关闭和超期检测。

### W3：standard_library_version 列长度不足

当前 `StandardRecommendationResult.standardLibraryVersion` 字段标注为 `@Column(name = "standard_library_version", length = 64)`（`StandardRecommendationResult.java:49`），允许 64 字符。

而 V5 迁移脚本 `standard_recommendation_results.standard_library_version` 定义为 `VARCHAR(32)`（`V5__daily_report_tables.sql:300`）。

**触发路径：** 当 `StandardRecommendationService` 写入的版本号字符串长度超过 32 字符时，PostgreSQL 抛出 `value too long for type character varying(32)`。在 Hibernate `ddl-auto=validate` 模式下，因实体声明 64 vs DDL 实际 32 的差异也会在启动时校验失败。

### I1：ProjectIssue.status 默认值与 DDL DEFAULT 不一致

当前 `ProjectIssue.status` 字段在 `ProjectIssue.java:76` 初始化为 `IssueStatus.VALID`：

```java
private IssueStatus status = IssueStatus.VALID;
```

而 V5 迁移脚本 `project_issues.status` 定义了 `DEFAULT 'PENDING_CONFIRM'`（`V5__daily_report_tables.sql:215`）。

两者语义不同：

- `VALID` = 有效/待整改（已进入问题池的活跃状态）
- `PENDING_CONFIRM` = 待确认（尚未审核入池）

当一个 `ProjectIssue` 实体在 Java 层以默认值创建但未显式设置 status 时（例如直接 `new ProjectIssue()` 后 save），Hibernate 会发送 `status='VALID'`，而 DDL 层若依赖 DEFAULT 则期望 `PENDING_CONFIRM`。在 `ddl-auto=validate` 下不会报错（validate 不检查 DEFAULT），但语义不一致会在边界场景产生隐患。

### I2：StandardRecommendationResult.issue_id 可空性不一致

当前 `StandardRecommendationResult.issueId` 字段标注为 `@Column(name = "issue_id")`（`StandardRecommendationResult.java:33`），未声明 `nullable` 属性。

JPA 规范中 `@Column` 的 `nullable` 默认值为 `true`（可空）。因此实体层认为 `issue_id` 允许 NULL。

而 V5 迁移脚本 `standard_recommendation_results.issue_id` 定义为 `BIGINT NOT NULL`（`V5__daily_report_tables.sql:296`）。

两侧可空性不一致：实体层允许写入 NULL，但 DDL 层禁止 NULL。在 `ddl-auto=validate` 下会校验失败（nullable 不匹配）。

---

## 2. 预期行为（Expected Behavior）

### W1：枚举值与 CHECK 约束完全对齐

`SyncBatchStatus` 枚举值对齐为 DDL CHECK 约束的 5 个值：

| 新枚举值 | 语义 | 原值映射 |
|---------|------|---------|
| `RECEIVED` | 已接收（服务端已接收，处理中） | ← PROCESSING |
| `SUCCESS` | 处理完成（全部成功） | ← COMPLETED |
| `PARTIAL` | 部分成功（预留值） | 新增 |
| `CONFLICT` | 检测到冲突（预留值） | 新增 |
| `FAILED` | 处理失败 | 不变 |

**验收标准：**

- **AC-1**：`SyncBatchStatus` 枚举值与 `sync_batches.status` 的 CHECK 约束 `chk_sync_batches_status` 完全对齐（5 个值：RECEIVED/SUCCESS/PARTIAL/CONFLICT/FAILED），无多余、无缺失。
- **AC-8**：`SyncBatchStatus` 所有引用点已适配新枚举值，编译通过，无残留 PROCESSING/COMPLETED 引用：
  - `SyncBatch.java:45` 默认值改为 `RECEIVED`
  - `SyncPushService.java:79` 改为 `SyncBatchStatus.RECEIVED`
  - `SyncPushService.java:121` 改为 `SyncBatchStatus.SUCCESS`

### W2：DDL CHECK 约束扩展为 8 值

`project_issues.status` 的 CHECK 约束 `chk_pi_status` 扩展为包含全部 8 个 IssueStatus 枚举值：`VALID/PENDING_CONFIRM/RECTIFIED/CLOSED/OVERDUE/SUSPENDED/VOIDED/CORRECTED`。

通过新建 V9 迁移脚本执行 `ALTER TABLE ... DROP CONSTRAINT chk_pi_status` 后重建为 8 值版本。

**验收标准：**

- **AC-2**：`project_issues.status` 的 CHECK 约束包含所有 8 个 IssueStatus 枚举值。
- **AC-7**：V9 迁移幂等可执行（重复执行不报错，使用 `IF EXISTS` 保护）。

### W3：DDL 列长度扩展为 VARCHAR(64)

`standard_recommendation_results.standard_library_version` 扩展为 `VARCHAR(64)`，与实体声明一致。合并到 V9 迁移脚本。

**验收标准：**

- **AC-3**：`standard_recommendation_results.standard_library_version` 为 `VARCHAR(64)`。

### I1：实体默认值对齐 DDL DEFAULT

`ProjectIssue.status` 的 Java 默认值改为 `IssueStatus.PENDING_CONFIRM`，与 DDL `DEFAULT 'PENDING_CONFIRM'` 一致。

`IssuePoolService.generateFromDailyReport()` 在入池时已显式执行 `issue.setStatus(IssueStatus.VALID)`（`IssuePoolService.java:98`），因此改默认值不影响正常入池流程。

**验收标准：**

- **AC-4**：`ProjectIssue.status` 的 Java 默认值为 `PENDING_CONFIRM`。

### I2：实体标注 nullable=false

`StandardRecommendationResult.issueId` 的 `@Column` 添加 `nullable = false`，与 DDL `NOT NULL` 一致。

**验收标准：**

- **AC-5**：`StandardRecommendationResult.issue_id` 标注 `nullable=false`。

### 全局验收标准

- **AC-6**：`ddl-auto=validate` 模式下应用正常启动，无 SchemaValidationException。

---

## 3. 不变行为（Invariant Behavior）

> 以下行为是修复过程中**必须保持不变**的现有行为，修复不得破坏它们。

### INV-1：同步推送幂等语义不变

- 同步推送（push）按 `client_batch_uuid` 去重的幂等行为不变。
- `SyncPushResponse.status` 序列化的值语义不变（RECEIVED=已接收，SUCCESS=处理完成），对外行为与原 PROCESSING/COMPLETED 在语义上一一对应。

### INV-2：问题池状态机流转规则不变

- `IssueStatusService.TRANSITIONS` 邻接表的全部流转规则（VALID→RECTIFIED→CLOSED、VALID→OVERDUE、SUSPENDED↔VALID、VOIDED→CORRECTED→CLOSED 等）不得修改。
- 所有状态流转守卫（`guardTransition`）的非法跳转抛异常行为不变。
- `OverdueDetectionJob` 的超期检测逻辑不变。

### INV-3：问题池入池流程初始状态不变

- `IssuePoolService.generateFromDailyReport()` 生成的 ProjectIssue 初始 status 仍为 `VALID`（显式设置）。
- 改变 Java 默认值（I1）不得影响入池后的问题状态——入池问题仍以 VALID 状态进入问题池。

### INV-4：标准推荐结果关联关系不变

- `StandardRecommendationResult.issue_id` 与日报问题的外键关联语义不变。
- 添加 `nullable=false` 仅约束实体注解，不改变现有业务写入行为（推荐结果始终关联到具体问题）。

### INV-5：现有已迁移数据不受影响

- W1：V4 的 CHECK 约束值集不变（枚举向 DDL 对齐，DDL 不动）。
- W2：V9 扩展 CHECK 为 8 值是超集，现有 5 值范围内的数据全部兼容。
- W3：VARCHAR(32)→VARCHAR(64) 是长度扩展，现有数据全部兼容。

### INV-6：DDL 迁移版本顺序不变

- V9 迁移不得修改 V4/V5 既有迁移脚本（Flyway 已执行迁移不可变更）。
- V9 必须是增量迁移，不依赖回填或数据修正。

---

## 4. 根因分析（Root Cause Analysis）

### W1 根因：枚举设计未对齐 V4 DDL 的 CHECK 约束值集

**证据：**

- `SyncBatchStatus.java:6-14` 枚举值为 {PROCESSING, COMPLETED, FAILED}。
- `V4__task_tables.sql:252-254` CHECK 约束值为 {RECEIVED, SUCCESS, PARTIAL, CONFLICT, FAILED}。
- 枚举的 JavaDoc 注释引用了"§101.28"规格编号，说明设计意图是同一规格，但枚举命名（PROCESSING/COMPLETED）与 DDL 命名（RECEIVED/SUCCESS）采用了不同的词汇。

**根因结论：** `SyncBatchStatus` 枚举在实现时使用了自选命名（PROCESSING/COMPLETED/FAILED），未参照同源的 V4 DDL CHECK 约束定义（RECEIVED/SUCCESS/PARTIAL/CONFLICT/FAILED），导致两侧值集仅 FAILED 重合。这是实体与 DDL 同步审查缺失的典型表现——同一业务概念在 Java 层和 SQL 层各自独立命名，缺少单一真相源。

**被排除的假设：**

- ~~"DDL CHECK 约束写错了"~~：DDL 的 5 值 {RECEIVED/SUCCESS/PARTIAL/CONFLICT/FAILED} 更精细地描述了同步批次生命周期（含 PARTIAL 部分成功、CONFLICT 冲突），是更完整的版本。修复方向是将枚举对齐 DDL，而非反向。
- ~~"枚举是旧版本，DDL 是新版本"~~：两者在同一 V4 迁移中引入，属同时期产物，无版本先后，纯粹是同步审查缺失。

### W2 根因：V5 DDL CHECK 约束是旧版本，未随 IssueStatus 业务扩展同步更新

**证据：**

- `IssueStatus.java:20-29` 枚举有 8 个值，JavaDoc 明确标注"综合 TASK-026（问题池生命周期）和 TASK-027（整改状态机）的全部状态"。
- `IssueStatusService.TRANSITIONS`（第 40-54 行）定义了完整的状态机，邻接表覆盖全部 8 个值，且 markRectified/close/markOverdue 方法分别写入 RECTIFIED/CLOSED/OVERDUE。
- `V5__daily_report_tables.sql:234-236` CHECK 约束仅允许 5 个值，且 V5 注释（第 213-214 行）描述的状态机是"VALID/PENDING_CONFIRM/SUSPENDED/VOIDED/CORRECTED"——明显缺少 RECTIFIED/CLOSED/OVERDUE 三个整改闭环状态。

**根因结论：** `project_issues` 表的 DDL（V5）定义于项目早期，当时的状态机仅有 5 个基础状态（VALID/PENDING_CONFIRM/SUSPENDED/VOIDED/CORRECTED）。后续业务扩展（TASK-026 + TASK-027）在 `IssueStatus` 枚举和 `IssueStatusService` 状态机中新增了 RECTIFIED（已整改）、CLOSED（已关闭）、OVERDUE（超期）三个状态，但未回头更新 V5 的 CHECK 约束。DDL 迁移的不可变性（Flyway 已执行迁移不可修改）使得这一遗漏必须通过新迁移（V9）补救。

**被排除的假设：**

- ~~"枚举多了不该有的状态"~~：TRANSITIONS 状态机的流转规则（RECTIFIED→CLOSED、VALID→OVERDUE）是完整的业务闭环设计，枚举值是正确的。修复方向是扩展 DDL，而非删减枚举。

### W3 根因：V5 DDL 长度估算不足

**证据：**

- `StandardRecommendationResult.java:49` 实体声明 `length = 64`。
- `V5__daily_report_tables.sql:300` DDL 声明 `VARCHAR(32)`。
- 该字段存储"推荐时使用的标准库版本（取自 StandardDocument.version）"。

**根因结论：** V5 DDL 编写时对版本号字符串长度的估算不足（32 字符），而实体设计者考虑到语义化版本号（如 `v1.2.3-beta+build20240101`）可能较长，声明了 64。两者在独立编写时未做交叉校验，导致 DDL 落后于实体设计。修复方向是将 DDL 扩展到 64（向后兼容，不丢数据）。

### I1 根因：实体默认值未与 DDL DEFAULT 对齐

**证据：**

- `ProjectIssue.java:76` Java 默认 `IssueStatus.VALID`。
- `V5__daily_report_tables.sql:215` DDL `DEFAULT 'PENDING_CONFIRM'`。
- `IssuePoolService.java:98` 入池时显式 `issue.setStatus(IssueStatus.VALID)`，说明业务流程不依赖默认值。

**根因结论：** 实体字段的 Java 默认值（VALID）是在开发时按"最常见状态"直觉设置的，未参照同源 DDL 的 DEFAULT 子句。由于 `IssuePoolService` 总是显式设置 status，该默认值在实际业务流程中未被触发，因此缺陷等级为 Info（非运行时故障）。但语义不一致会在 ddl-auto=validate 的严格校验和边界场景（直接构造实体）中产生隐患。

### I2 根因：实体注解遗漏 nullable=false

**证据：**

- `StandardRecommendationResult.java:33` `@Column(name = "issue_id")` 无 `nullable` 属性。
- `V5__daily_report_tables.sql:296` `issue_id BIGINT NOT NULL`。
- 同实体内 `projectId`（第 29 行）和 `clauseId`（第 37 行）均正确标注了 `nullable = false`，唯独 `issueId` 遗漏。

**根因结论：** 纯粹的注解遗漏——开发者编写该实体时，projectId 和 clauseId 的 nullable=false 意识到位，但 issueId 字段遗漏了同样的注解。JPA `@Column` 默认 `nullable=true` 与 DDL `NOT NULL` 矛盾，在 ddl-auto=validate 下会校验失败。

---

## 附：证据索引（静态分析源码引用）

| 缺陷 | 源文件 | 关键行号 |
|------|--------|---------|
| W1 | `fj-sync/.../entity/SyncBatchStatus.java` | 6-14 |
| W1 | `fj-sync/.../entity/SyncBatch.java` | 45（默认值） |
| W1 | `fj-sync/.../service/SyncPushService.java` | 79, 121, 134, 174 |
| W1 | `fj-api/.../V4__task_tables.sql` | 252-254 |
| W2 | `fj-issue/.../entity/IssueStatus.java` | 20-29 |
| W2 | `fj-issue/.../entity/ProjectIssue.java` | 76 |
| W2 | `fj-issue/.../service/IssueStatusService.java` | 40-54, 75, 87, 135 |
| W2 | `fj-api/.../V5__daily_report_tables.sql` | 234-236 |
| W3 | `fj-recommend/.../entity/StandardRecommendationResult.java` | 49 |
| W3 | `fj-api/.../V5__daily_report_tables.sql` | 300 |
| I1 | `fj-issue/.../entity/ProjectIssue.java` | 76 |
| I1 | `fj-issue/.../service/IssuePoolService.java` | 98（显式设 VALID） |
| I1 | `fj-api/.../V5__daily_report_tables.sql` | 215 |
| I2 | `fj-recommend/.../entity/StandardRecommendationResult.java` | 33 |
| I2 | `fj-api/.../V5__daily_report_tables.sql` | 296 |