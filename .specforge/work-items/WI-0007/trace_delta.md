---
trace_format: bugfix
work_item_id: WI-0007
workflow_type: bugfix_spec
workflow_path: requirement_change_path
base_spec_version: PSV-0001
source_requirements: requirements.md
source_design: design.md
source_tasks: tasks.md
title: WI-0007 追溯矩阵
---

# Trace Delta: WI-0007

> 追溯矩阵覆盖 `requirements.md`（5 缺陷 W1/W2/W3/I1/I2 + 8 AC）→ `design.md`（5 DD）→ `tasks.md`（4 TASK）→ 文件 → 验证方式。
> 完整链路：`REQ (缺陷) → AC → DD → TASK → FILE → TEST / VERIFICATION_COMMAND`。

---

## 1. 追溯矩阵（REQ → AC → DD → TASK → FILE → VERIFICATION）

| REQ ID (缺陷) | 严重程度 | AC ID | DD ID | TASK ID | 目标文件 | 动作 | 验证方式 |
|---------------|---------|-------|-------|---------|---------|------|---------|
| W1 | Warning | AC-1, AC-8 | DD-1 | TASK-1 | `fj-backend/fj-sync/src/main/java/com/fj/sync/entity/SyncBatchStatus.java` | 修改 | grep 枚举值 {RECEIVED,SUCCESS,PARTIAL,CONFLICT,FAILED} |
| W1 | Warning | AC-8 | DD-1 | TASK-1 | `fj-backend/fj-sync/src/main/java/com/fj/sync/entity/SyncBatch.java` | 修改(L45) | grep `SyncBatchStatus.RECEIVED` |
| W1 | Warning | AC-8 | DD-1 | TASK-1 | `fj-backend/fj-sync/src/main/java/com/fj/sync/service/SyncPushService.java` | 修改(L72/79/119/121) | grep RECEIVED/SUCCESS；无 PROCESSING/COMPLETED 残留 |
| W2 | Warning | AC-2, AC-7 | DD-2 | TASK-2 | `fj-backend/fj-api/src/main/resources/db/migration/V9__fix_enum_check_constraints.sql` | **新建** | grep DROP CONSTRAINT IF EXISTS + 8 状态值 |
| W3 | Warning | AC-3, AC-7 | DD-3 | TASK-2 | `fj-backend/fj-api/src/main/resources/db/migration/V9__fix_enum_check_constraints.sql` | **新建**(同文件) | grep `ALTER COLUMN standard_library_version TYPE VARCHAR(64)` |
| I1 | Info | AC-4 | DD-4 | TASK-3 | `fj-backend/fj-issue/src/main/java/com/fj/issue/entity/ProjectIssue.java` | 修改(L76) | grep `status = IssueStatus.PENDING_CONFIRM` |
| I2 | Info | AC-5, AC-6 | DD-5 | TASK-4 | `fj-backend/fj-recommend/src/main/java/com/fj/recommend/entity/StandardRecommendationResult.java` | 修改(L33) | grep `issue_id.*nullable = false` |
| 全局 | — | AC-6 | (跨 DD) | TASK-1~4 | (全部修改文件) | — | ddl-auto=validate 启动无 SchemaValidationException |
| 全局 | — | AC-8 | (DD-1) | TASK-1 | fj-sync 模块 | — | grep 全代码库无 SyncBatchStatus.PROCESSING/COMPLETED 残留 |

---

## 2. 文件覆盖矩阵

| 文件 | 创建/修改/删除 | 涉及 REQ (缺陷) | 涉及 DD | 涉及 TASK | 涉及 AC |
|------|---------------|-----------------|---------|-----------|---------|
| `fj-backend/fj-sync/src/main/java/com/fj/sync/entity/SyncBatchStatus.java` | 修改 | W1 | DD-1 | TASK-1 | AC-1 |
| `fj-backend/fj-sync/src/main/java/com/fj/sync/entity/SyncBatch.java` | 修改 | W1 | DD-1 | TASK-1 | AC-8 |
| `fj-backend/fj-sync/src/main/java/com/fj/sync/service/SyncPushService.java` | 修改 | W1 | DD-1 | TASK-1 | AC-8 |
| `fj-backend/fj-api/src/main/resources/db/migration/V9__fix_enum_check_constraints.sql` | **创建** | W2, W3 | DD-2, DD-3 | TASK-2 | AC-2, AC-3, AC-7 |
| `fj-backend/fj-issue/src/main/java/com/fj/issue/entity/ProjectIssue.java` | 修改 | I1 | DD-4 | TASK-3 | AC-4 |
| `fj-backend/fj-recommend/src/main/java/com/fj/recommend/entity/StandardRecommendationResult.java` | 修改 | I2 | DD-5 | TASK-4 | AC-5, AC-6 |

**说明：**
- V9 文件被 W2（DD-2）和 W3（DD-3）两个缺陷共用，合并到同一 TASK-2 执行（避免新增多个迁移版本号，design.md DD-3 决策）。
- AC-6（ddl-auto=validate 启动）为全局验收标准，由全部 4 个 task 共同保证。

---

## 3. REQ → TASK 覆盖映射

| REQ (缺陷) | 覆盖 TASK | 覆盖状态 |
|-----------|-----------|---------|
| W1 | TASK-1 | ✅ 已覆盖 |
| W2 | TASK-2 | ✅ 已覆盖 |
| W3 | TASK-2 | ✅ 已覆盖 |
| I1 | TASK-3 | ✅ 已覆盖 |
| I2 | TASK-4 | ✅ 已覆盖 |

**无悬空 REQ**（每个缺陷至少关联 1 个 task）。

---

## 4. AC → TASK 验证映射

| AC ID | AC 描述 | 覆盖 TASK | 验证方式 |
|-------|---------|-----------|---------|
| AC-1 | SyncBatchStatus 枚举与 chk_sync_batches_status 完全对齐(5值) | TASK-1 | grep 枚举值 + V4 DDL 交叉确认 |
| AC-2 | project_issues.status CHECK 包含全部 8 个 IssueStatus 值 | TASK-2 | grep V9 文件含 8 状态值 |
| AC-3 | standard_library_version 为 VARCHAR(64) | TASK-2 | grep V9 文件含 VARCHAR(64) |
| AC-4 | ProjectIssue.status Java 默认值为 PENDING_CONFIRM | TASK-3 | grep ProjectIssue.java |
| AC-5 | StandardRecommendationResult.issue_id 标注 nullable=false | TASK-4 | grep 注解 |
| AC-6 | ddl-auto=validate 启动无 SchemaValidationException | TASK-1~4 | Spring Boot 启动验证（全局） |
| AC-7 | V9 迁移幂等可执行(IF EXISTS 保护) | TASK-2 | grep DROP CONSTRAINT IF EXISTS |
| AC-8 | 无 PROCESSING/COMPLETED 残留引用 | TASK-1 | grep fj-sync 无残留（全局验证） |

**无悬空 AC**（每个 AC 至少关联 1 个 task/验证）。

---

## 5. DD → TASK 覆盖映射

| DD ID | DD 描述 | refs (缺陷) | 覆盖 TASK |
|-------|---------|-------------|-----------|
| DD-1 | SyncBatchStatus 枚举对齐 V4 DDL CHECK | W1 | TASK-1 |
| DD-2 | project_issues.status CHECK 扩展为 8 值 (V9) | W2 | TASK-2 |
| DD-3 | standard_library_version 扩展 VARCHAR(64) (V9) | W3 | TASK-2 |
| DD-4 | ProjectIssue.status 默认值对齐 DDL DEFAULT | I1 | TASK-3 |
| DD-5 | StandardRecommendationResult.issue_id 补 nullable=false | I2 | TASK-4 |

**无悬空 DD**（每个 DD 至少关联 1 个 task）。

---

## 6. TASK → FILE → VERIFICATION 完整链路

| TASK ID | 目标文件 | verification_commands（摘要） |
|---------|---------|------------------------------|
| TASK-1 | SyncBatchStatus.java | grep RECEIVED/SUCCESS/PARTIAL/CONFLICT/FAILED 存在 |
| TASK-1 | SyncBatch.java | grep `SyncBatchStatus.RECEIVED` 存在 |
| TASK-1 | SyncPushService.java | grep RECEIVED/SUCCESS 存在；PROCESSING/COMPLETED 无残留 |
| TASK-1 | (模块) | mvn compile fj-sync → BUILD SUCCESS |
| TASK-2 | V9__fix_enum_check_constraints.sql | test -f 文件存在；grep DROP IF EXISTS；grep 8状态值；grep VARCHAR(64) |
| TASK-3 | ProjectIssue.java | grep `PENDING_CONFIRM` 存在；旧 VALID 默认值已移除 |
| TASK-3 | IssuePoolService.java (只读验证) | grep `setStatus(IssueStatus.VALID)` 仍在（INV-3 不变行为） |
| TASK-3 | (模块) | mvn compile fj-issue → BUILD SUCCESS |
| TASK-4 | StandardRecommendationResult.java | grep `issue_id.*nullable = false` 存在 |
| TASK-4 | (模块) | mvn compile fj-recommend → BUILD SUCCESS |

---

## 7. INV（不变行为）→ TASK 保护映射

| INV ID | 不变行为描述 | 保护 TASK | 验证方式 |
|--------|-------------|-----------|---------|
| INV-1 | 同步推送幂等语义不变 | TASK-1 | grep 确认无 if/switch/equals 比较逻辑被破坏；SyncPushResponse 仅值语义等价变化 |
| INV-2 | 问题池状态机流转规则不变 | TASK-2(DDL), TASK-3 | IssueStatusService.TRANSITIONS 未被修改（forbidden） |
| INV-3 | 问题池入池流程初始状态不变 | TASK-3 | grep IssuePoolService 仍有 setStatus(VALID) 显式覆盖 |
| INV-4 | 标准推荐结果关联关系不变 | TASK-4 | 仅注解对齐，写入行为不变 |
| INV-5 | 现有已迁移数据不受影响 | TASK-2 | CHECK 为超集扩展，VARCHAR 扩展不截断 |
| INV-6 | DDL 迁移版本顺序不变 | TASK-2 | V9 为新建文件，V1-V8 未被修改（forbidden） |

---

## 8. 覆盖统计

| 指标 | 值 |
|------|-----|
| 总 REQ 数（缺陷） | 5 (W1, W2, W3, I1, I2) |
| 总 AC 数 | 8 (AC-1 ~ AC-8) |
| 已覆盖 AC | 8 / 8 = 100% |
| 未覆盖 AC | 0 |
| 总 DD 数 | 5 (DD-1 ~ DD-5) |
| 已覆盖 DD | 5 / 5 = 100% |
| 总 TASK 数 | 4 (TASK-1 ~ TASK-4) |
| 总文件数 | 6（5 修改 + 1 新建） |
| 无悬空 REQ | ✅ 是 |
| 无悬空 DD | ✅ 是 |
| 无悬空 TASK | ✅ 是 |
| 无悬空 AC | ✅ 是 |
| 每个 TASK 有明确目标文件 | ✅ 是 |
| 每个目标文件有验证方式 | ✅ 是 |

---

## 9. 自检（trace_delta 完整性）

- [x] 1. 每个 REQ 是否至少关联一个 AC？ ✅（W1→AC-1/8, W2→AC-2/7, W3→AC-3/7, I1→AC-4, I2→AC-5/6）
- [x] 2. 每个 AC 是否至少关联一个 TASK？ ✅（全部 8 个 AC 有 TASK 覆盖）
- [x] 3. 每个 DD 是否至少关联一个 TASK？ ✅（5 个 DD 全部映射到 TASK）
- [x] 4. 每个 TASK 是否有明确目标文件？ ✅（allowed_write_files 精确到文件）
- [x] 5. 每个目标文件是否有验证方式？ ✅（grep/test/mvn）
- [x] 6. trace_delta.md 是否真实写入？ ✅（本文件通过 sf_artifact_write 写入）
