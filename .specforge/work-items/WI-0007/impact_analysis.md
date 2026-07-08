# Impact Analysis — WI-0007

## 影响范围总览

| 维度 | 影响 |
|------|------|
| 后端模块 | fj-sync, fj-issue, fj-recommend, fj-api(migration) |
| 源文件修改 | 5 个 Java 文件 |
| 新增文件 | 1 个 SQL 迁移（V9） |
| 数据库表 | sync_batches（间接）, project_issues, standard_recommendation_results |
| 前端 | 无影响 |
| API 契约 | 无影响（枚举按 STRING 持久化，外部行为不变） |
| 已有数据 | 无破坏（CHECK 宽松化 + VARCHAR 扩展） |

---

## 逐项影响分析

### W1: SyncBatchStatus 枚举对齐

**修改文件：**
1. `fj-backend/fj-sync/src/main/java/com/fj/sync/entity/SyncBatchStatus.java`
   - 枚举值：{PROCESSING, COMPLETED, FAILED} → {RECEIVED, SUCCESS, PARTIAL, CONFLICT, FAILED}
2. `fj-backend/fj-sync/src/main/java/com/fj/sync/entity/SyncBatch.java:45`
   - 默认值：`SyncBatchStatus.PROCESSING` → `SyncBatchStatus.RECEIVED`
3. `fj-backend/fj-sync/src/main/java/com/fj/sync/service/SyncPushService.java`
   - L79: `setStatus(PROCESSING)` → `setStatus(RECEIVED)`
   - L121: `setStatus(COMPLETED)` → `setStatus(SUCCESS)`
   - L72 注释: "创建批次记录（PROCESSING）" → "（RECEIVED）"
   - L119 注释: "更新批次记录（COMPLETED）" → "（SUCCESS）"

**调用点审计（grep 确认，共 3 处引用）：**
- SyncBatch.java:45 — 字段默认值 ✓
- SyncPushService.java:79 — 批次创建时设置 ✓
- SyncPushService.java:121 — 批次完成时设置 ✓
- 无其他引用（无 if 判断、无 switch、无比较逻辑引用 PROCESSING/COMPLETED）

**枚举值映射：**
| Java 旧值 | Java 新值 | DDL CHECK | 语义 |
|-----------|-----------|-----------|------|
| PROCESSING | RECEIVED | RECEIVED ✓ | 已接收（服务端已接收，处理中） |
| COMPLETED | SUCCESS | SUCCESS ✓ | 处理完成（全部成功） |
| — | PARTIAL | PARTIAL | 部分成功（新增，当前未使用，预留） |
| — | CONFLICT | CONFLICT | 存在冲突（新增，当前未使用，预留） |
| FAILED | FAILED | FAILED ✓ | 处理失败 |

**影响评估：** 低风险。调用点仅 3 处，全部在 fj-sync 模块内，无跨模块引用。

---

### W2: ProjectIssue.status CHECK 约束扩展

**修改文件：**
1. `fj-backend/fj-api/src/main/resources/db/migration/V9__fix_enum_check_constraints.sql`（新建）

**V9 SQL 内容：**
```sql
-- W2: 扩展 project_issues.status CHECK 约束（5→8 值）
-- IssueStatus 枚举有 8 个值，V5 chk_pi_status 仅允许 5 个
-- IssueStatusService.TRANSITIONS 实际使用全部 8 个状态
ALTER TABLE project_issues DROP CONSTRAINT IF EXISTS chk_pi_status;
ALTER TABLE project_issues ADD CONSTRAINT chk_pi_status CHECK (
    status IN ('VALID', 'PENDING_CONFIRM', 'RECTIFIED', 'CLOSED', 'OVERDUE',
               'SUSPENDED', 'VOIDED', 'CORRECTED')
);

-- W3: 扩展 standard_library_version 长度（32→64）
ALTER TABLE standard_recommendation_results
    ALTER COLUMN standard_library_version TYPE VARCHAR(64);
```

**现有数据兼容性：**
- 当前 5 个允许值是 8 个的子集，DROP+重建不会拒绝任何现有行。
- 宽松化变更，无需数据迁移。

**约束名确认：** V5 L234 `CONSTRAINT chk_pi_status`（已确认）。

**影响评估：** 低风险。宽松化 CHECK 约束，forward-compatible。

---

### W3: standard_library_version 长度扩展

合并到 W2 的 V9 迁移（见上方 ALTER TYPE）。

**影响评估：** 低风险。VARCHAR 扩展不截断数据。

---

### I1: ProjectIssue.status 默认值统一

**修改文件：**
1. `fj-backend/fj-issue/src/main/java/com/fj/issue/entity/ProjectIssue.java:76`
   - `private IssueStatus status = IssueStatus.VALID;` → `IssueStatus.PENDING_CONFIRM;`

**语义对齐：**
- DDL DEFAULT 'PENDING_CONFIRM'（V5 L215）
- IssueStatus 注释 L10: PENDING_CONFIRM = "待确认（待审核入池）"
- IssuePoolService.java:98 在入池时设置 VALID（业务逻辑层确认入池）
- 因此实体的初始默认值应为 PENDING_CONFIRM（待确认），由业务逻辑在确认后推进到 VALID

**影响评估：** 低风险。仅影响 new ProjectIssue() 未显式设置 status 时的默认值。实际业务代码（IssuePoolService）会显式设置 status，此修改是防御性对齐。

---

### I2: StandardRecommendationResult.issue_id nullable

**修改文件：**
1. `fj-backend/fj-recommend/src/main/java/com/fj/recommend/entity/StandardRecommendationResult.java:33-34`
   - `@Column(name="issue_id")` → `@Column(name="issue_id", nullable=false)`

**影响评估：** 低风险。DDL 已是 NOT NULL，实体注解对齐不影响运行时（ddl-auto=validate 不校验 nullable）。

---

## 跨模块依赖

```
fj-sync (W1) ────────────────────── 独立，无跨模块依赖
fj-issue (I1) ───────────────────── 独立，无跨模块依赖
fj-recommend (I2) ───────────────── 独立，无跨模块依赖
fj-api/migration (W2+W3, V9) ────── 独立，新文件无冲突
```

**结论：5 个修复项互相独立，无文件冲突，可并行执行。**

---

## 部署影响

- V9 迁移需在 svr-lg 执行 `flyway migrate`
- jar 包需重新构建或 zip 修补（V9 添加到 jar）
- 部署活动可在验证阶段合并执行，或创建单独 ops_task WI

## 不变行为

- API 响应格式不变
- 前端交互不变
- 业务流程语义不变
- 已有数据库数据不丢失