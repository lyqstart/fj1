# Trace Delta — WI-0006 (全项目 @Entity schema-validate 审查)

> **工作流**: investigation（只读调查）
> **追溯链**: GOAL → AC → 调查阶段 → TASK → 审查文件范围（只读）→ VERIFICATION
> **说明**: investigation 的「任务→文件」是**只读审查范围**，非修改文件。所有 task 的 allowed_write_files=[]。

---

## 一、调查目标 → 验收标准

| GOAL | 描述 | 对应 AC |
|------|------|---------|
| G1 | 枚举并审查所有 @Entity 实体类 | AC-1 |
| G2 | 提取所有 Flyway DDL 表的列定义 | AC-2 |
| G3 | 对每个不匹配项给出严重级别分类 | AC-3 |
| G4 | 为 Critical/Warning 项提供修复建议 | AC-4 |
| G5 | 报告记录调查局限性 | AC-5 |

---

## 二、验收标准 → 调查阶段

| AC | 内容 | 调查阶段 | 验证方式 |
|----|------|----------|----------|
| AC-1 | 所有 38 个 @Entity 类已被审查 | 阶段 0+1（枚举）+ 阶段 3（对比） | grep @Entity 计数=38；对比结果含 38 实体条目 |
| AC-2 | 所有 40 张表的列定义已被提取 | 阶段 2（DDL 字典） | grep CREATE TABLE 计数=40；字典含 40 表字段 |
| AC-3 | 每个不匹配项有明确严重级别分类 | 阶段 4（分类） | 报告中每项 ∈ {Critical,Warning,Info} |
| AC-4 | 每个 Critical/Warning 项有具体修复建议 | 阶段 4（建议） | 报告修复建议章节覆盖全部 Critical/Warning |
| AC-5 | 报告包含调查限制说明 | 阶段 5（报告） | 报告含「调查限制」章节 |

---

## 三、调查阶段 → 任务

| 调查阶段 | TASK | 描述 | depends_on |
|----------|------|------|------------|
| 阶段 0+1 枚举与映射 | TASK-1 | 枚举 38 实体 + 40 表 + 双向映射 | - |
| 阶段 2 DDL 字典 | TASK-2 | 解析 CREATE TABLE + V8 ALTER 合并为最终字段字典 | TASK-1 |
| 阶段 3 字段对比 | TASK-3 | 38 实体 × 7 维对比，产出不匹配清单 | TASK-2 |
| 阶段 4+5 分类与报告 | TASK-4 | 严重级别分类 + 修复建议 + findings_report.md | TASK-3 |

---

## 四、任务 → 审查范围（只读）

| TASK | 审查文件范围（只读） | 操作 | allowed_write_files |
|------|---------------------|------|---------------------|
| TASK-1 | `fj-backend/**/entity/**/*.java`（38 实体，提取 @Table 映射）；`fj-backend/fj-api/src/main/resources/db/migration/V1..V8.sql`（提取表名） | 读取 @Entity/@Table + CREATE TABLE 表名 | `[]` |
| TASK-2 | `fj-backend/fj-api/src/main/resources/db/migration/V1..V8.sql`（提取列定义 + ALTER 合并） | 解析列定义，应用 V8 ALTER | `[]` |
| TASK-3 | 38 个 @Entity 类（@Column/@JoinColumn/@Enumerated/@ManyToOne 注解） | 7 维字段对比 | `[]` |
| TASK-4 | TASK-1/2/3 产出（清单/字典/对比结果） | 分类 + 生成 findings_report.md（写入 WI 目录） | `[]`（源码）；findings_report 经 sf_artifact_write |

> **注**: findings_report.md 为 governance 产物，通过 `sf_artifact_write` 写入 `.specforge/work-items/WI-0006/`，不计入源码 allowed_write_files。

---

## 五、覆盖统计

| 维度 | 数值 | 状态 |
|------|------|------|
| 调查目标 (GOAL) | 5 | 全部有 AC 覆盖 ✓ |
| 验收标准 (AC) | 5 | 全部有 TASK 覆盖 ✓ |
| 调查阶段 | 5（0-5） | 全部有 TASK 覆盖 ✓ |
| @Entity 实体 | 38 | TASK-1 枚举 + TASK-3 对比全覆盖 ✓ |
| DDL 表 | 40 | TASK-1 枚举 + TASK-2 字典全覆盖 ✓ |
| 对比维度 | 7 | TASK-3 全覆盖 ✓ |
| 严重级别 | 3（Critical/Warning/Info） | TASK-4 全覆盖 ✓ |

---

## 六、悬空检查

- 无悬空 GOAL（每个 G 有 AC）✓
- 无悬空 AC（每个 AC 有 TASK）✓
- 无悬空 TASK（每个 TASK 有审查范围）✓
- 无悬空审查范围（每个审查范围指向真实存在的文件）✓

---

## 七、AC → TASK 完整映射核验

| AC | 主覆盖 TASK | 辅助覆盖 |
|----|------------|----------|
| AC-1（38 实体审查） | TASK-3（逐实体对比） | TASK-1（枚举建立清单） |
| AC-2（40 表列定义） | TASK-2（DDL 字典） | TASK-1（表枚举） |
| AC-3（严重级别分类） | TASK-4 | - |
| AC-4（修复建议） | TASK-4 | - |
| AC-5（调查限制） | TASK-4 | - |
