# Change Classification — WI-0007

## 基本信息

- **Work Item:** WI-0007
- **来源:** WI-0006 全项目 schema 审查（3 Warning + 2 Info）
- **变更类型:** bugfix（schema 不匹配修复）
- **风险等级:** 低-中
- **workflow_type:** bugfix_spec
- **workflow_path:** requirement_change_path

## 变更分类

### 类型：bugfix（缺陷修复）

本次变更修复 WI-0006 审查发现的 5 个 schema 不匹配问题。这些问题不会导致启动失败，但在特定业务操作时会触发 PostgreSQL 约束违规导致运行时写失败。

### 性质：源码修复 + 增量迁移

| 修复项 | 性质 | 影响层 |
|--------|------|--------|
| W1 SyncBatchStatus 枚举 | 源码修改（Java） | fj-sync 模块 |
| W2 ProjectIssue CHECK 约束 | 增量迁移（V9 SQL） | fj-api 迁移目录 |
| W3 standard_library_version 长度 | 增量迁移（V9 SQL） | fj-api 迁移目录 |
| I1 ProjectIssue 默认值 | 源码修改（Java） | fj-issue 模块 |
| I2 issue_id nullable | 源码修改（Java） | fj-recommend 模块 |

## 风险评估

### 低风险项

- **W2/W3 V9 迁移**：CHECK 约束扩展（5→8 值）是宽松化变更，不会拒绝任何现有数据；VARCHAR(32)→VARCHAR(64) 是扩展变更，不截断数据。两者均为 forward-compatible。
- **I1/I2 实体注解**：仅修改 JPA 元数据注解（nullable, 默认值），不改变字段语义。

### 中风险项

- **W1 SyncBatchStatus 枚举重命名**：PROCESSING→RECEIVED、COMPLETED→SUCCESS 是枚举值变更，需同步修改 3 个调用点（SyncBatch.java:45, SyncPushService.java:79,121）。调用点少且集中（均在 fj-sync 模块内），可控。

### 回滚方案

- Java 修改：git revert
- V9 迁移：flyway undo 不支持，但可通过 V10 回滚迁移（DROP+重建旧 CHECK, ALTER TYPE VARCHAR(32)）。考虑到宽松化变更无需回滚，不预先创建 V10。

## 范围边界

### 包含

- 5 个修复项（W1/W2/W3/I1/I2）
- 1 个新迁移文件 V9
- 5 个 Java 源文件修改

### 不包含

- svr-lg 部署 V9 迁移（属于 ops_task，可合并到验证阶段或单独 WI）
- 前端/API 契约变更（枚举存储为 STRING，API 行为不变）
- 性能优化、重构

## 前向兼容性

✅ V9 是增量迁移，不修改 V1-V8 任何已有迁移文件。
✅ 枚举值存储为 STRING，数据库层扩展 CHECK 不影响已存数据。
✅ 字段长度扩展（32→64）不截断任何现有值。

## 关联

- 前置：WI-0006（发现来源）
- 前置：WI-0004/0005（V8 修复已部署，V9 在 V8 之后）
- 无后置依赖