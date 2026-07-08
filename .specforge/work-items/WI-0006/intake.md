# Intake — WI-0006 (全项目 @Entity schema-validate 全量审查)

**来源 Work Items:** WI-0003（部署）、WI-0004（源码修复 5 个 bug）、WI-0005（svr-lg 同步）
**任务类型:** 调查（investigation）

---

## 调查问题

WI-0003 部署过程中发现了 5 个 JPA 实体与数据库 schema 不匹配的 bug（已在 WI-0004 修复）。但这 5 个 bug 是部署时偶然发现的，**项目可能还存在其他未发现的 @Entity 与 Flyway DDL 不匹配问题**。

恢复 `ddl-auto=validate` 后（WI-0005 已完成），如果还有其他不匹配，下次部署或重启时仍会启动失败。本调查的目标是**主动发现所有潜在的 @Entity / DDL 不匹配**，避免未来部署时再次遇到意外失败。

---

## 调查范围

### 包含
- fj-backend 下所有模块的 `@Entity` 注解类
  - fj-system（User, Role, UserProjectRole, Project 等）
  - fj-api（核心实体）
  - fj-export（ExportFile 已知修复）
  - fj-check（如有实体）
  - fj-report（如有实体）
  - 其他含 @Entity 的模块
- 每个实体的字段（`@Column`, `@JoinColumn`, `@Enumerated` 等 JPA 注解）与 Flyway V1-V8 DDL 的列定义对比
- 对比维度：
  - 列名（name）
  - 数据类型（VARCHAR/INTEGER/BIGINT/BOOLEAN/TEXT/JSONB 等）
  - 长度（length）
  - 可空性（nullable）
  - 精度/标度（precision, scale，针对数字类型）
  - 枚举映射（@Enumerated + AttributeConverter）
  - 关联关系（@ManyToOne, @OneToMany 的外键列）

### 不包含
- 非实体类（DTO, VO, Request, Response）
- 纯查询 SQL（native query 的正确性）
- 业务逻辑正确性
- 性能优化

---

## 调查方法

1. **枚举所有 @Entity 类**：用 grep 扫描 `@Entity` 注解，列出完整清单
2. **提取 Flyway DDL**：读取 V1-V8 所有 CREATE TABLE 和 ALTER TABLE，建立"表名 → 列定义"映射
3. **逐实体对比**：对每个 @Entity 类，读取其字段注解，与对应表的列定义逐项对比
4. **识别不匹配**：记录每个差异（类型、长度、可空性等）
5. **分类严重级别**：
   - **Critical**：会导致 ddl-auto=validate 启动失败的类型不匹配
   - **Warning**：长度差异（Hibernate validate 默认不校验 varchar length，但仍是隐患）
   - **Info**：可空性差异、命名差异（不影响启动但需注意）

---

## 预期产出

结构化调查报告 `findings_report.md`，包含：

1. **实体清单**：所有 @Entity 类的完整列表（模块/类名/对应表名）
2. **DDL 映射表**：所有表的列定义汇总
3. **不匹配清单**：每个不匹配项的详细信息
   - 实体类 + 字段
   - 表名 + 列名
   - 实体期望 vs DDL 实际
   - 严重级别（Critical/Warning/Info）
4. **建议**：针对每个不匹配项的修复建议
5. **限制**：调查的局限性

---

## 背景：已知的 5 个 bug（WI-0004 已修复）

| Bug | 实体 | 表 | 问题 | 状态 |
|-----|------|-----|------|------|
| Bug-3 | ExportFile | export_files | 缺 error_message/export_status 列 + file_hash 长度 | ✅ V8 修复 |
| Bug-4 | User (UserStatusConverter) | users | status smallint vs integer | ✅ V8 修复 |

这 5 个 bug 修复后，可能还有其他实体的类似问题未被发现。

---

## 调查约束

- 只读分析，不修改任何源码
- 禁止写入 .specforge/ 之外的治理产物
- 不连接数据库（基于源码静态分析，V1-V8 SQL + Java 实体）
- 调查完成后如发现不匹配，**修复属于单独的 WI**（不在本调查范围内）