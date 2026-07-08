# Impact Analysis — WI-0006 (全项目 @Entity schema-validate 全量审查)

**Work Item:** WI-0006
**Workflow Type:** investigation
**分析日期:** 2026-07-04
**分析者:** sf-design

---

## 1. 调查行动本身的影响

**结论：零影响（None）**

本 WI 为纯只读静态分析，不产生任何代码变更、DDL 变更、部署动作、运维动作。

| 受影响对象 | 影响等级 | 理由 |
|-----------|---------|------|
| fj-backend 源码（38 个 @Entity） | None | 只读分析，不修改任何 .java 文件 |
| Flyway DDL 文件（V1-V8） | None | 只读分析，不修改任何 .sql 文件 |
| 配置文件（application.yml 等） | None | 不修改任何配置 |
| 运行中服务 | None | 不部署、不重启、不连接 |
| svr-lg 已部署实例 | None | 不产生任何运维动作（WI-0005 已完成同步） |
| 数据库数据 | None | 不连接数据库（静态分析） |
| .specforge 治理产物 | 仅新增 | 仅在 WI-0006 目录新增调查文档 |
| 其他 WI | None | 独立执行，无交叉依赖 |
| 接口契约 / API | None | 不修改 Controller / DTO |
| 数据语义 | None | 不触碰数据结构 |

---

## 2. 调查结果的潜在影响（条件性，非本 WI 执行）

调查本身不改变系统，但其**发现**将影响后续决策。以下为条件性影响分析（实际影响由独立修复 WI 承担）：

### 2.1 若发现 Critical 不匹配

- **触发条件：** Hibernate `SchemaValidator` 在 `ddl-auto=validate` 模式下会拒绝的类型/列不匹配
- **潜在影响：** 恢复 `ddl-auto=validate` 后，下次部署或服务重启时启动失败（与 WI-0003 部署时遇到的故障同类）
- **缓解路径：** 创建独立修复 WI（高优先级）→ Flyway V9+ 迁移修复 → 本地 validate 验证 → svr-lg 同步
- **⚠️ 不在本 WI 处理**

### 2.2 若发现 Warning 不匹配

- **触发条件：** varchar 长度差异、精度差异、可空性差异（Hibernate validate 默认不校验这些维度）
- **潜在影响：** 短期不影响启动；长期存在数据截断、隐式转换、NOT NULL 约束绕过风险
- **缓解路径：** 排期修复（中优先级独立 WI）
- **⚠️ 不在本 WI 处理**

### 2.3 若发现 Info 不匹配

- **触发条件：** 命名风格差异、冗余列、文档差异
- **潜在影响：** 不影响启动，不影响数据完整性
- **缓解路径：** 记录备查，按需修复
- **⚠️ 不在本 WI 处理**

### 2.4 若无任何发现

- **结论：** WI-0004 修复的 5 个 bug 已覆盖全部 schema 不匹配问题
- **后续动作：** 可安全恢复 `ddl-auto=validate`，无需额外修复 WI

---

## 3. 对已部署 svr-lg 的影响

**结论：无影响（None）**

| 检查点 | 状态 | 说明 |
|--------|------|------|
| svr-lg schema 状态 | 不变 | WI-0005 已同步至 V8，本 WI 不触碰 |
| svr-lg 运行状态 | 不变 | 不部署、不重启 |
| svr-lg 数据 | 不变 | 不连接、不读写 |
| svr-lg 配置 | 不变 | 不修改 ddl-auto 等任何配置 |

**关键说明：** 即使调查发现新的不匹配，修复动作也在独立 WI 中执行，本 WI 全程不触碰 svr-lg。调查仅基于源码（Java + SQL）静态分析，与 svr-lg 运行时完全解耦。

---

## 4. 对 `ddl-auto=validate` 恢复的影响

**结论：本调查是恢复 validate 的前置安全网（正向影响）**

**背景链路：**
1. WI-0003 部署时发现 5 个不匹配 bug → 临时降级 `ddl-auto=none` 以恢复部署
2. WI-0004 修复 5 个 bug（V8 迁移）
3. WI-0005 将 svr-lg 同步至 V8
4. **WI-0006（本调查）：** 验证"除了已修复的 5 个 bug，是否还有其他未发现的不匹配"
5. 调查通过（无 Critical）→ 可安全恢复 `ddl-auto=validate`
6. 调查发现 Critical → 需先修复再恢复 validate

**影响定性：** 调查降低恢复 validate 的风险，不增加风险。

---

## 5. 影响矩阵汇总

| 场景 | 对源码 | 对 DDL | 对 svr-lg | 对 validate | 对接口契约 | 对数据语义 |
|------|--------|--------|-----------|------------|-----------|-----------|
| 调查执行（本 WI） | None | None | None | 正向（安全网） | None | None |
| 发现 Critical（后续 WI） | 可能调整 | V9+ 修复 | 需同步 | 阻塞恢复 | None | None |
| 发现 Warning（后续 WI） | 可能调整 | V9+ 修复 | 需同步 | 不阻塞 | None | None |
| 无发现 | None | None | None | 可恢复 | None | None |

---

## 6. Assumptions（影响分析假设）

- 假设 V1-V8 SQL 文件是 schema 的唯一真相源（无 svr-lg 上未记录的手动 ALTER）
- 假设所有 @Entity 类都被 `@EntityScan(basePackages = "com.fj")` 扫描到（已确认）
- 假设 Hibernate dialect 为 PostgreSQL，类型映射规则明确且稳定
- 假设调查期间无其他 WI 并行修改源码或 DDL

---

## 7. Limitations（影响分析局限）

- 静态分析无法发现运行时动态 schema 变更（如应用启动时执行的动态 DDL）
- 无法验证 svr-lg 实际运行时 schema（不连库），仅基于源码推断
- `@Formula` / `@Generated` 等非列映射不在分析范围，其影响未评估
- 继承映射（`@Inheritance`）的深度影响未在本阶段评估，调查中需额外注意

---

## 8. constrained_by

- `intake.md §调查约束`：只读、不连库、不改源码
- `WI-0005`：svr-lg 已同步至 V8（影响分析的基线前提）
- `WI-0004`：5 个已知 bug 已修复（影响分析的比较基线）
