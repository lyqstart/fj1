# Change Classification — WI-0006 (全项目 @Entity schema-validate 全量审查)

**Work Item:** WI-0006
**Workflow Type:** investigation
**分析日期:** 2026-07-04
**分析者:** sf-design
**来源 Work Items:** WI-0003（部署发现 bug）、WI-0004（修复 5 bug）、WI-0005（svr-lg 同步）

---

## 1. 变更类型判定

**判定结果：`investigation`（调查分析，只读）**

**依据：**
- 本 Work Item 不修改任何源码、DDL、配置文件
- 仅执行只读静态分析（grep 扫描 + 文件读取 + 逐项对比）
- 产出为调查报告（`findings_report.md`），不含可执行变更
- 若发现不匹配，修复行动属于独立 WI（见 §5 后续动作）
- 完全符合 intake.md §任务类型："调查（investigation）"

---

## 2. 变更范围

### 2.1 包含（只读分析对象）

| 维度 | 范围 | 探查数量 |
|------|------|---------|
| 代码模块 | fj-backend 下所有业务模块 | 12 个模块 |
| @Entity 类 | 所有 JPA 实体（`@EntityScan(basePackages="com.fj")` 扫描） | 38 个 |
| Flyway 迁移文件 | V1-V8 全部 | 8 个文件 |
| DDL 表定义 | CREATE TABLE 语句 | 40 张表 |
| ALTER 修复 | V8 的 schema 不匹配修复 | 3 处 ALTER |
| 对比维度 | 列名/类型/长度/可空性/精度/枚举/关联 | 7 维 |

### 2.2 不包含

- DTO / VO / Request / Response 类（非 @Entity）
- Native SQL 查询（@Query native）的正确性
- 业务逻辑正确性
- 性能 / 索引优化
- 数据迁移脚本正确性

### 2.3 模块 @Entity 分布（探查确认）

| 模块 | @Entity 数 | 代表性实体 |
|------|-----------|-----------|
| fj-system | 7 | User, Role, Permission, Organization, DataDictionary, UserProjectRole, ProjectOrganization |
| fj-project | 8 | Project, ProjectConfig, InspectionTask, Equipment, LocationDetail, ProjectInspectionForm, InspectionFormItem, CheckItemStandardBinding |
| fj-inspection | 5 | DailyReport, DailyReportTask, DailyReportIssue, DailyReportInspectedParty, Photo |
| fj-approval | 4 | ApprovalFlowConfig, ApprovalInstance, ApprovalTask, ApprovalRecord |
| fj-recommend | 4 | StandardDocument, StandardClause, StandardIssueTemplate, StandardRecommendationResult |
| fj-common | 3 | OperationLog, Notification, EditLock |
| fj-sync | 2 | SyncBatch, ClientSyncState |
| fj-issue | 2 | ProjectIssue, IssueRelation |
| fj-report | 2 | Report, ReportIssueSnapshot |
| fj-export | 1 | ExportFile |
| fj-api | 0 | （仅 @EntityScan 入口，无实体） |
| fj-auth | 0 | （无实体） |
| **合计** | **38** | |

### 2.4 DDL 表分布（探查确认）

| 版本 | 文件 | 表数 |
|------|------|------|
| V1 | V1__base_tables.sql | 9 |
| V3 | V3__project_tables.sql | 9 |
| V4 | V4__task_tables.sql | 8 |
| V5 | V5__daily_report_tables.sql | 8 |
| V6 | V6__approval_tables.sql | 3 |
| V7 | V7__report_tables.sql | 3 |
| V8 | V8__fix_schema_mismatches.sql | 0（ALTER 修复，无新表） |
| **合计** | | **40** |

**初步观察（待调查核实）：**
- 表数(40) − @Entity 数(38) = 2 张表可能无对应 @Entity：
  - `role_permissions`（疑似多对多关联表，无 @Entity 属正常模式）
  - `major_issue_notification_records`（疑似遗漏实体或纯日志表，需调查核实）

---

## 3. 风险等级

**判定结果：`低（Low）`**

**理由：**

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 源码修改 | ✅ 无 | 全程只读分析 |
| DDL 修改 | ✅ 无 | 仅读取 V1-V8 |
| 运行时状态 | ✅ 无 | 不部署、不重启、不连接 |
| svr-lg 影响 | ✅ 无 | 不产生任何运维动作 |
| 数据语义 | ✅ 无影响 | 不触碰数据结构 |
| 接口契约 | ✅ 无影响 | 不修改 API/DTO |
| .specforge 产物 | 仅新增 | 仅在 WI-0006 目录写调查文档 |

**残余风险：** 调查结论的误报/漏报可能导致后续修复 WI 范围偏差 → 通过"7 维对比 + 双人复核 + 严重级别分类"缓解。

---

## 4. 影响维度评估

| 维度 | 影响 | 说明 |
|------|------|------|
| 数据语义 | None | 不修改任何数据结构 |
| 接口契约 | None | 不修改 API/DTO |
| 运行状态 | None | 不触碰运行中服务 |
| 已部署 svr-lg | None | 调查不产生部署动作 |
| ddl-auto=validate | 间接（正向） | 调查是恢复 validate 的前置安全网 |
| 后续 WI | 间接 | 调查发现将驱动独立的修复 WI |

---

## 5. 后续动作（不属于本 WI）

调查完成后：
1. **若发现 Critical 不匹配** → 创建独立修复 WI（高优先级），含 Flyway V9+ 迁移 + 可选 @Entity 调整，修复后必须在 svr-lg 同步前完成本地 validate 验证
2. **若仅发现 Warning/Info** → 排期修复（中/低优先级），不阻塞恢复 validate
3. **若无发现** → 确认 WI-0004 的 5 bug 已覆盖全部问题，可放心恢复 `ddl-auto=validate`

---

## 6. constrained_by

- `intake.md §调查约束`：只读分析、禁止改源码、不连数据库、禁止写 .specforge/ 之外产物
- `prod-environment.md`：无约束（文件为 TODO 占位）
- `project-rules.md`：无约束（文件为 TODO 占位）
- `WI-0005`：svr-lg 已同步至 V8（调查基线）

---

## Out of Scope

- 修复任何 @Entity / DDL 不匹配（属于独立 WI）
- Native SQL 查询正确性验证
- 业务逻辑正确性验证
- 性能优化、索引优化
- 数据迁移脚本正确性
- 连接数据库验证运行时 schema

---

## Assumptions（变更分类假设）

- 假设 V1-V8 SQL 文件是 schema 的唯一真相源（无未记录的手动 ALTER）
- 假设 `@EntityScan(basePackages = "com.fj")` 覆盖所有实体（已确认 FjApplication.java:30）
- 假设无运行时动态 schema 变更
