# Intake — WI-0007 (修复 WI-0006 schema 审查发现的不匹配)

**来源 Work Item:** WI-0006（全项目 @Entity schema-validate 审查）
**发现时间:** 2026-07-04（WI-0006 调查）
**严重级别:** 中（3 个 Warning 会在特定业务操作时导致运行时写失败，2 个 Info 是规范差异）

---

## 背景

WI-0006 对全项目 38 个 @Entity 类与 40 张表进行了 7 维全量对比审查，发现 5 个非启动级不匹配问题（0 Critical / 3 Warning / 2 Info）。这些问题不会导致 ddl-auto=validate 启动失败（Hibernate validate 不校验 varchar length / nullable / CHECK 内容），但在特定业务操作时会触发 PostgreSQL 约束违规导致写失败。

本 WI 在源码层面根本修复这 5 个问题。

---

## 缺陷清单

### W1: SyncBatch.status 枚举值与 DDL CHECK 约束冲突

**文件:**
- `fj-backend/fj-sync/src/main/java/com/fj/sync/entity/SyncBatch.java:45`（@Enumerated 字段）
- `fj-backend/fj-sync/src/main/java/com/fj/sync/entity/SyncBatchStatus.java:6-14`（枚举定义）
- `fj-backend/fj-api/src/main/resources/db/migration/V4__task_tables.sql:238,252-254`（DDL CHECK）

**当前行为:**
实体枚举 SyncBatchStatus 有 3 个值：{PROCESSING, COMPLETED, FAILED}。
DDL CHECK 约束允许 5 个值：{RECEIVED, SUCCESS, PARTIAL, CONFLICT, FAILED}。
仅 FAILED 重合。

当 SyncBatch 新建时，Java 默认值为 PROCESSING，INSERT 时会触发 PostgreSQL CHECK 违规：
```
ERROR: new row for relation "sync_batches" violates check constraint
```

**预期行为:**
枚举值与 DDL CHECK 约束完全对齐。

**修复方案（推荐 A：修改枚举对齐 DDL）:**
DDL 的状态语义更完整（含冲突/部分成功），且 V4 已是既有约定。修改枚举 SyncBatchStatus 为 {RECEIVED, SUCCESS, PARTIAL, CONFLICT, FAILED}，同步修改 SyncBatch 的 Java 默认值为 RECEIVED。

注意：需要检查 SyncBatchStatus 的所有引用点（grep），确保调用方代码适配新枚举值。如果业务逻辑中有 `if (status == PROCESSING)` 之类的判断，需要映射到新的等价值。

---

### W2: ProjectIssue.status 枚举值超出 DDL CHECK 约束

**文件:**
- `fj-backend/fj-issue/src/main/java/com/fj/issue/entity/ProjectIssue.java:76`
- `fj-backend/fj-issue/src/main/java/com/fj/issue/entity/IssueStatus.java:20-29`
- `fj-backend/fj-api/src/main/resources/db/migration/V5__daily_report_tables.sql:215,234-236`

**当前行为:**
实体枚举 IssueStatus 有 8 个值：{VALID, PENDING_CONFIRM, RECTIFIED, CLOSED, OVERDUE, SUSPENDED, VOIDED, CORRECTED}。
DDL CHECK 约束仅允许 5 个：{VALID, PENDING_CONFIRM, SUSPENDED, VOIDED, CORRECTED}。
缺少 RECTIFIED, CLOSED, OVERDUE 三个状态。

IssueStatus 注释（L11-16）明确描述了 RECTIFIED/CLOSED/OVERDUE 的业务语义，说明这些是设计内的状态，DDL CHECK 约束过时。

当业务流程推进到 RECTIFIED/CLOSED/OVERDUE 时，UPDATE 触发 CHECK 违规。

**预期行为:**
DDL CHECK 约束包含枚举的所有值。

**修复方案（修改 DDL，新建 V9 迁移）:**
实体枚举反映了完整的业务状态机，DDL CHECK 是 V5 时的旧版本。新建 V9 迁移扩展 CHECK 约束：
```sql
ALTER TABLE project_issues DROP CONSTRAINT chk_pi_status;
ALTER TABLE project_issues ADD CONSTRAINT chk_pi_status CHECK (status IN ('VALID','PENDING_CONFIRM','RECTIFIED','CLOSED','OVERDUE','SUSPENDED','VOIDED','CORRECTED'));
```
注意：需确认 V5 中 chk_pi_status 的实际约束名（可能不是 chk_pi_status，需要读取 V5 确认）。

---

### W3: StandardRecommendationResult.standard_library_version 长度差异

**文件:**
- `fj-backend/fj-recommend/src/main/java/com/fj/recommend/entity/StandardRecommendationResult.java:49`（@Column(length=64)）
- `fj-backend/fj-api/src/main/resources/db/migration/V5__daily_report_tables.sql:300`（VARCHAR(32)）

**当前行为:**
实体声明 @Column(length=64)，DDL 为 VARCHAR(32)。标准库版本号超 32 字符时（如 'GB50251-2024-Rev3-amendment'）触发 varchar_length violation。

**修复方案（V9 迁移 ALTER TYPE）:**
合并到 W2 的 V9 迁移：
```sql
ALTER TABLE standard_recommendation_results ALTER COLUMN standard_library_version TYPE VARCHAR(64);
```

---

### I1: ProjectIssue.status 默认值差异

**文件:** 同 W2

**当前行为:**
Java 字段默认 IssueStatus.VALID，DDL DEFAULT 'PENDING_CONFIRM'。语义不同（VALID=有效/待整改 vs PENDING_CONFIRM=待确认）。

**修复方案:**
确认业务期望的初始状态。根据 IssueStatus 注释，新创建的问题初始状态应是 PENDING_CONFIRM（待确认）。修改实体 Java 默认值为 IssueStatus.PENDING_CONFIRM。

---

### I2: StandardRecommendationResult.issue_id 可空性差异

**文件:**
- `fj-backend/fj-recommend/src/main/java/com/fj/recommend/entity/StandardRecommendationResult.java:33-34`
- `fj-backend/fj-api/src/main/resources/db/migration/V5__daily_report_tables.sql:296`（NOT NULL）

**当前行为:**
实体 @Column(name="issue_id") 无 nullable=false（JPA 默认可空），DDL 为 NOT NULL。

**修复方案:**
修改实体添加 nullable=false：`@Column(name="issue_id", nullable=false)`

---

## 修复策略汇总

| 问题 | 修复方式 | 涉及文件 | forward-compatible |
|------|---------|---------|-------------------|
| W1 | 修改 Java 枚举对齐 DDL | SyncBatchStatus.java, SyncBatch.java, 调用方 | N/A（非迁移） |
| W2 | 新建 V9 迁移扩展 CHECK | V9__fix_enum_check_constraints.sql（新建） | ✅ 增量迁移 |
| W3 | 合并到 V9 | 同上 V9 | ✅ 增量迁移 |
| I1 | 修改实体默认值 | ProjectIssue.java | N/A（非迁移） |
| I2 | 修改实体 nullable | StandardRecommendationResult.java | N/A（非迁移） |

**V9 迁移内容（合并 W2+W3）：**
- DROP + 重建 project_issues 的 status CHECK 约束（8 个值）
- ALTER standard_recommendation_results.standard_library_version TYPE VARCHAR(64)
- 幂等设计（如果 CHECK 已是目标值则跳过；VARCHAR TYPE 用 IF NOT EXISTS 不可用，直接 ALTER）

**注意：** V9 需要同步到 svr-lg（类似 WI-0005 的 jar 修补 + flyway migrate），但这属于部署活动，可合并到本 WI 的验证阶段或单独 ops_task。

## 验收标准

- AC-1: SyncBatchStatus 枚举值与 sync_batches.status CHECK 约束完全对齐
- AC-2: project_issues.status CHECK 约束包含所有 8 个 IssueStatus 枚举值
- AC-3: standard_recommendation_results.standard_library_version 为 VARCHAR(64)
- AC-4: ProjectIssue.status Java 默认值为 PENDING_CONFIRM（与 DDL DEFAULT 一致）
- AC-5: StandardRecommendationResult.issue_id 标注 nullable=false
- AC-6: ddl-auto=validate 下应用正常启动
- AC-7: V9 迁移幂等（全新库和 svr-lg 均可执行）
- AC-8: SyncBatchStatus 的所有引用点已适配新枚举值（无编译错误）

## 不变行为

- fj1 系统功能行为不变（API 契约、UI、业务流程）
- 已部署的 svr-lg 数据库数据不丢失
- V9 是 forward-compatible 增量迁移（不改 V1-V8）

## 关联证据

- WI-0006 verification_report.md / findings_report（完整调查报告，含 5 个发现的代码位置和行号）
- WI-0006 evidence/evidence_manifest.json（证据清单）