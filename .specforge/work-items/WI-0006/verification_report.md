# Findings Report — WI-0006 (全项目 @Entity schema-validate 审查)

**Investigator:** sf-investigator  
**Investigated at:** 2026-07-04T02:20Z  
**Workflow:** investigation / requirement_change_path  
**Conclusion:** ✅ 0 Critical（ddl-auto=validate 启动将通过），⚠️ 3 Warning（运行时写操作风险）

---

## 调查结论

### 核心问题回答

**"恢复 ddl-auto=validate 后，是否还有未发现的 @Entity / DDL 不匹配？"**

**答案：没有会导致启动失败的 Critical 不匹配。** WI-0004 的 V8 修复已解决所有启动级问题。本次审查发现的 5 个差异均为非启动级（Hibernate validate 不校验 varchar length / nullable / CHECK 内容），不会导致启动失败。

但有 3 个 Warning 级问题会在**特定业务操作时**导致运行时写失败（PostgreSQL CHECK 约束违规或 varchar 长度超限）。

### 数据摘要

| 指标 | 值 |
|------|-----|
| @Entity 类审查 | 38/38 (100%) |
| CREATE TABLE 提取 | 40/40 (100%) |
| 对比维度 | 7（列存在性/列名/类型/长度/可空性/精度/枚举映射） |
| Critical（启动失败级） | **0** |
| Warning（运行时写风险） | **3** |
| Info（规范差异） | **2** |
| 干净实体（无任何差异） | 35/38 |
| 无实体表 | 2（role_permissions=JoinTable, major_issue_notification_records=待实现） |

### ddl-auto=validate 启动预测

**✅ 将通过。** 0 个 Critical 意味着 Hibernate schema-validation 不会报告任何列类型/缺失错误。svr-lg 已在 WI-0005 验证过 validate 启动成功（V8 应用后），本次调查确认没有遗漏的其他不匹配。

---

## 数据和证据

### 发现清单

#### W1: SyncBatch.status — 枚举值与 CHECK 约束冲突 [Warning]

| 维度 | 详情 |
|------|------|
| 实体 | `fj-sync/.../entity/SyncBatch.java:45` |
| 表/列 | `sync_batches.status` |
| DDL | `V4__task_tables.sql:238,252-254`: VARCHAR(32) CHECK (status IN ('RECEIVED','SUCCESS','PARTIAL','CONFLICT','FAILED')) DEFAULT 'RECEIVED' |
| 实体枚举 | `SyncBatchStatus.java:6-14`: {PROCESSING, COMPLETED, FAILED} |
| 冲突 | 实体的 PROCESSING/COMPLETED 不在 DDL CHECK 中；DDL 的 RECEIVED/SUCCESS/PARTIAL/CONFLICT 不在枚举中。仅 FAILED 重合 |
| 运行时影响 | 插入 PROCESSING（实体默认）或 COMPLETED 会触发 PostgreSQL CHECK 违规 → INSERT 失败 |
| validate 影响 | 无（Hibernate validate 不校验 CHECK 内容） |
| **修复建议** | **(A) 修改枚举对齐 DDL**（推荐）：SyncBatchStatus 改为 {RECEIVED, SUCCESS, PARTIAL, CONFLICT, FAILED}，SyncBatch 默认值改 RECEIVED。理由：DDL 的状态语义更完整（含冲突/部分成功），V4 已是既有约定 |

#### W2: ProjectIssue.status — 枚举值超出 CHECK 约束 [Warning]

| 维度 | 详情 |
|------|------|
| 实体 | `fj-issue/.../entity/ProjectIssue.java:76` |
| 表/列 | `project_issues.status` |
| DDL | `V5__daily_report_tables.sql:215,234-236`: VARCHAR(32) CHECK (status IN ('VALID','PENDING_CONFIRM','SUSPENDED','VOIDED','CORRECTED')) DEFAULT 'PENDING_CONFIRM' |
| 实体枚举 | `IssueStatus.java:20-29`: {VALID, PENDING_CONFIRM, RECTIFIED, CLOSED, OVERDUE, SUSPENDED, VOIDED, CORRECTED} |
| 冲突 | 实体多出 RECTIFIED、CLOSED、OVERDUE 三个状态。IssueStatus 注释（L11-16）明确描述了这些状态的业务语义 |
| 运行时影响 | 业务流程推进到 RECTIFIED/CLOSED/OVERDUE 时 UPDATE 触发 CHECK 违规 |
| validate 影响 | 无 |
| **修复建议** | **修改 DDL（新建 V9 迁移）**：DROP + 重建 CHECK 约束为 8 个值。理由：实体枚举反映完整状态机，DDL CHECK 是 V5 旧版本 |

#### W3: StandardRecommendationResult.standard_library_version — 长度差异 [Warning]

| 维度 | 详情 |
|------|------|
| 实体 | `fj-recommend/.../entity/StandardRecommendationResult.java:49` |
| 表/列 | `standard_recommendation_results.standard_library_version` |
| DDL | `V5__daily_report_tables.sql:300`: VARCHAR(32) |
| 实体 | `@Column(length = 64)` |
| 冲突 | 实体声明 64，DDL 为 32 |
| 运行时影响 | 标准库版本号超 32 字符时（如 'GB50251-2024-Rev3-amendment'）触发 varchar_length violation |
| validate 影响 | 无（Hibernate validate 默认不校验 varchar length） |
| **修复建议** | **(A) 新建 V9 迁移** ALTER TYPE VARCHAR(64)（推荐）。理由：StandardDocument.version 也是 VARCHAR(32)，若版本号可能超长则两处都应扩展 |

#### I1: ProjectIssue.status — 默认值差异 [Info]

| 维度 | 详情 |
|------|------|
| 实体 | Java 默认 IssueStatus.VALID |
| DDL | DEFAULT 'PENDING_CONFIRM' |
| 冲突 | 语义不同：VALID（有效/待整改）vs PENDING_CONFIRM（待确认） |
| **修复建议** | 确认业务期望的初始状态，统一两者 |

#### I2: StandardRecommendationResult.issue_id — 可空性差异 [Info]

| 维度 | 详情 |
|------|------|
| 实体 | `@Column(name="issue_id")` 无 nullable=false → JPA 默认可空 |
| DDL | `issue_id BIGINT NOT NULL` |
| 冲突 | 实体可空 vs DDL 非空 |
| **修复建议** | 修改实体添加 nullable=false |

---

### 方法验证（正确性证明）

WI-0004 的 V8 修复项被正确识别为"V8 后已匹配"（无假阳性）：

| 已知 Bug | V8 修复 | 本次审查结果 |
|----------|---------|------------|
| ExportFile.error_message | V8 L7 ADD COLUMN VARCHAR(1024) | ✅ 实体 @Column(length=1024) → 匹配 |
| ExportFile.export_status | V8 L8 ADD COLUMN VARCHAR(32) | ✅ 实体 @Column(length=32) → 匹配 |
| ExportFile.file_hash | V8 L11 ALTER TYPE VARCHAR(128) | ✅ 实体 @Column(length=128) → 匹配 |
| User.status 类型 | V8 L16-26 SMALLINT→INTEGER | ✅ UserStatusConverter<Integer> → 匹配 |

这证明了 V8 ALTER 合并逻辑和 7 维对比方法有效。

---

## 建议

### 优先级排序

| 优先级 | 问题 | 建议 | 工作量 | 风险 |
|--------|------|------|--------|------|
| **P1** | W2 ProjectIssue 枚举 vs CHECK | 新建 V9 迁移扩展 CHECK 约束 | 小（1 个 SQL） | 中（业务流程会触发） |
| **P2** | W1 SyncBatch 枚举 vs CHECK | 修改枚举对齐 DDL | 中（枚举+默认值+调用方） | 中（同步功能会触发） |
| **P3** | W3 长度差异 | V9 ALTER TYPE VARCHAR(64) | 小（1 个 SQL） | 低（仅超长版本号触发） |
| **P4** | I1 默认值差异 | 确认业务语义后统一 | 小 | 低 |
| **P5** | I2 可空性 | 实体加 nullable=false | 小 | 低 |

### 综合建议

W1 和 W2 可以合并到一个新的 bugfix_spec WI（V9 迁移 + 枚举对齐）。W3 也可纳入同一 V9。I1/I2 可在同一个 WI 顺便修复。

---

## 限制

1. **静态分析**：未连接 PostgreSQL 实际执行 schema validate；结论基于源码人工对比
2. **未覆盖 native query**：@Query SQL 的正确性未审查（超出范围）
3. **未覆盖 DTO/VO**：非 @Entity 类未审查
4. **CHECK 约束对比**：基于枚举 name() 字符串与 DDL CHECK 的文本匹配；本项目全用 @Enumerated(STRING)，无 ordinal 风险
5. **Hibernate validate 行为假设**：假设标准 Spring Boot 3 + Hibernate 6 的 validate 行为（校验列存在性 + SQL type family，不校验 varchar length / nullable / CHECK 内容）
6. **columnDefinition 属性**：如 columnDefinition="jsonb" 在 validate 模式下通常被忽略，故 String+columnDefinition vs JSONB 不报为不匹配
7. **BaseEntity 继承**：37 个继承 BaseEntity 的实体的公共字段（id/server_seq/created_at/updated_at/created_by/updated_by）已批量验证；ApprovalRecord 不继承 BaseEntity，已单独验证
8. **未审查索引/外键/触发器/函数**：仅审查列级 schema