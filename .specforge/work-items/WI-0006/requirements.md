# Candidate Requirements — WI-0006 (全项目 @Entity schema-validate 审查)

## 调查目标

发现 fj1 项目所有 @Entity 类与 Flyway DDL（V1-V8）之间的不匹配问题，避免未来部署时 ddl-auto=validate 启动失败。

## 调查范围

### 包含
- fj-backend 下 12 个模块的所有 @Entity 类（38 个）
- Flyway V1-V8 的所有 CREATE TABLE 和 ALTER TABLE（40 张表）
- 对比维度：列名、数据类型、长度、可空性、精度标度、枚举映射、外键关联

### 不包含
- DTO/VO/Request/Response 类
- Native query 正确性
- 业务逻辑
- 性能优化

## 调查方法

1. 枚举所有 @Entity 类（grep）
2. 提取 V1-V8 DDL 建立表→列字典
3. 逐实体逐字段对比（7 个维度）
4. 分类严重级别（Critical/Warning/Info）
5. 生成结构化报告

## 预期产出

findings_report.md：
- 实体清单（38 个）
- DDL 映射表（40 张表）
- 不匹配清单（每个含实体/表/字段/期望/实际/严重级别）
- 修复建议
- 调查限制

## 验收标准

- AC-1: 所有 38 个 @Entity 类已被审查
- AC-2: 所有 40 张表的列定义已被提取
- AC-3: 每个不匹配项有明确的严重级别分类
- AC-4: 每个 Critical/Warning 项有具体的修复建议
- AC-5: 报告包含调查限制说明