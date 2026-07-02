# 追溯矩阵 — WI-0001

> 来源：`candidates/tasks.md`（44 tasks）× `candidates/project/modules/core/design.candidate.md`（DD-1~11）× `candidates/project/modules/core/requirements.candidate.md`（REQ-1~21, NFR-1~11, BR-1~10）
> 审计维度：REQ → DD → TASK → FILE → VERIFICATION（双向闭合）

---

## 1. 需求 → 设计 → 任务

| REQ | 需求描述 | 关联 DD | 关联 TASK | 验证方式 |
|-----|---------|---------|-----------|---------|
| REQ-1 | 用户登录认证 | DD-4 | TASK-007, TASK-033 | mvn compile + npm build |
| REQ-2 | 项目级 RBAC | DD-4, 安全§7.2 | TASK-006, TASK-008, TASK-009 | mvn compile + 种子数据检查 |
| REQ-3 | 组织与人员管理 | 安全§7.2 | TASK-006, TASK-044 | mvn compile + npm build |
| REQ-4 | 检查标准库管理 | DD-11 | TASK-014, TASK-021 | mvn compile |
| REQ-5 | 项目创建与配置 | BR-1 | TASK-010, TASK-011, TASK-013 | mvn compile + SQL 检查 |
| REQ-6 | 检查表编制 | — | TASK-010, TASK-012 | mvn compile + SQL 检查 |
| REQ-7 | 检查任务派发 | BR-7 | TASK-015, TASK-016, TASK-022 | mvn compile + tsc |
| REQ-8 | 安卓离线作业 | DD-1, DD-6 | TASK-019, TASK-020, TASK-022 | tsc --noEmit |
| REQ-9 | 现场问题取证 | DD-2, DD-10, DD-11 | TASK-018, TASK-028 | mvn compile + tsc |
| REQ-10 | 日报提交 | BR-5, §9.1 | TASK-023, TASK-024, TASK-025, TASK-028 | mvn compile + tsc |
| REQ-11 | 项目问题池生成 | DD-8, DD-9, BR-3 | TASK-023, TASK-026, TASK-039 | mvn compile + npm build |
| REQ-12 | 日报确认与退回 | DD-8, BR-3 | TASK-029, TASK-030, TASK-031, TASK-032, TASK-034 | mvn compile + npm build |
| REQ-13 | 问题等级与整改期限 | BR-1 | TASK-027 | mvn compile |
| REQ-14 | 问题状态流转 | BR-6 | TASK-027, TASK-032, TASK-039 | mvn compile + npm build |
| REQ-15 | 报告生成 | BR-8 | TASK-035, TASK-036, TASK-038 | mvn compile + npm build |
| REQ-16 | 问题快照 | BR-4 | TASK-037, TASK-038 | mvn compile + npm build |
| REQ-17 | 报告草稿预览导出 | DD-3 | TASK-041 | mvn compile |
| REQ-18 | 报告审批 | BR-8 | TASK-040, TASK-043 | mvn compile + npm build |
| REQ-19 | 报告发布与固化导出 | DD-3, BR-4 | TASK-041, TASK-042, TASK-043 | mvn compile + npm build |
| REQ-20 | 通知机制（仅 App 内） | BR-2 | TASK-044 | mvn compile + npm build |
| REQ-21 | 重大问题电话通知留痕 | BR-2 | TASK-044 | mvn compile |

**覆盖统计**：REQ-1~21 共 21 条，全部覆盖 ✅

---

## 2. 设计决策 → 任务覆盖

| DD | 设计决策 | 关联 TASK | 覆盖状态 |
|----|---------|-----------|---------|
| DD-1 | WatermelonDB 离线选型 | TASK-019 | ✅ |
| DD-2 | 照片压缩存储方案 | TASK-018, TASK-028 | ✅ |
| DD-3 | poi-tl 报告导出引擎 | TASK-041 | ✅ |
| DD-4 | JWT 认证方案 | TASK-007, TASK-033 | ✅ |
| DD-5 | 接口契约规范 | TASK-003, TASK-004 | ✅ |
| DD-6 | 安卓同步协议 | TASK-017, TASK-020 | ✅ |
| DD-7 | PG 13→16 升级 | TASK-001 | ✅ |
| DD-8 | confirmed_at/locked_at 语义 | TASK-026, TASK-031 | ✅ |
| DD-9 | 后续更正终态 | TASK-026, TASK-032 | ✅ |
| DD-10 | 照片质量 V1 边界 | TASK-028 | ✅ |
| DD-11 | 标准推荐 V1 三层规则 | TASK-021 | ✅ |

**覆盖统计**：DD-1~11 共 11 条，全部覆盖 ✅

---

## 3. 业务规则 → 任务覆盖

| BR | 业务规则 | 关联 TASK | 覆盖状态 |
|----|---------|-----------|---------|
| BR-1 | 整改期限规则（一般+7/较大+3/重大当日） | TASK-010(配置), TASK-027(计算) | ✅ |
| BR-2 | 仅 App 内通知，无外部推送 | TASK-044 | ✅ |
| BR-3 | 确认即锁定（日报不可改） | TASK-026, TASK-031 | ✅ |
| BR-4 | 报告发布即固化（快照不可改） | TASK-037, TASK-042 | ✅ |
| BR-5 | 日报状态机（草稿→待确认→已确认/已退回） | TASK-025, TASK-031 | ✅ |
| BR-6 | 问题状态机（待整改→已整改→已关闭/超期） | TASK-027, TASK-032 | ✅ |
| BR-7 | 任务状态机（待派发→待接收→进行中→已完成） | TASK-016 | ✅ |
| BR-8 | 报告状态机（草稿→审批中→待发布→已发布/已退回） | TASK-036, TASK-040 | ✅ |
| BR-9 | MVP 范围阶段 1-7 不收敛 | TASK-001~044（全部） | ✅ |
| BR-10 | 双端职责划分（Web 管理 / 安卓现场） | 安卓: TASK-019~022,028; Web: TASK-033~039,043,044 | ✅ |

**覆盖统计**：BR-1~10 共 10 条，全部覆盖 ✅

---

## 4. 非功能需求 → 设计支撑

| NFR | 非功能需求 | 支撑设计 | 验证方式 |
|-----|----------|---------|---------|
| NFR-1 | 列表查询 P95 ≤ 800ms | DD-7§4.3 内存调优 + DB 索引 | TASK-004(调优), TASK-005(索引); 压测 |
| NFR-2 | 详情页 P95 ≤ 600ms | 同上 | 同上 |
| NFR-3 | 日报提交 P95 ≤ 2s | 异步照片上传 | TASK-025, TASK-028; 接口压测 |
| NFR-4 | 审批操作 P95 ≤ 1s | 审批引擎单事务 | TASK-030; 接口压测 |
| NFR-5 | 草稿导出≤60s / 固化≤120s | DD-3 poi-tl + 超时控制 | TASK-041; 导出性能测试 |
| NFR-6 | 10-20 并发 + EditLock | §10.1 并发编辑锁 | TASK-044; 并发测试 |
| NFR-7 | 99.9%+ 可用性 | 单机裸机 + systemd + 监控 | 全局架构; 运维保障 |
| NFR-8 | 500任务/3000问题/10000照片/200报告 | DB Schema 设计 + server_seq | TASK-005~007; 容量测试 |
| NFR-9 | 完整离线作业 | DD-1 WatermelonDB + DD-6 同步 | TASK-019,020,028; 离线场景测试 |
| NFR-10 | HTTPS + BCrypt + RBAC + 文件鉴权 + 越权留痕 | §7 安全设计全链路 | TASK-007,008,044; 安全扫描 |
| NFR-11 | 同步失败重试不丢数据 | DD-6 幂等推送 + 指数退避 | TASK-017,020; 同步可靠性测试 |

**覆盖统计**：NFR-1~11 共 11 条，全部有设计支撑 ✅

---

## 5. 文件 → Task 映射（模块级汇总）

| 模块/目录 | 涉及 TASK | 文件数（预估） | 操作类型 |
|-----------|-----------|--------------|---------|
| `scripts/ops/` + `deploy/config/` | TASK-001 | 3 | 创建 |
| `fj-backend/pom.xml` + 各子模块 pom | TASK-002 | 14 | 创建 |
| `fj-backend/fj-common/` (response/exception/enume/dto/config) | TASK-003 | 8 | 创建 |
| `fj-backend/fj-common/` (notification/audit/concurrent) | TASK-044 | 8 | 创建 |
| `fj-backend/fj-api/` (Application/config/yml) | TASK-004 | 6 | 创建 |
| `fj-backend/fj-api/.../db/migration/` | TASK-005~010,015,023,029,035 | 7 | 创建 |
| `fj-backend/fj-system/` | TASK-006 | 12 | 创建 |
| `fj-backend/fj-auth/` (jwt 包) | TASK-007 | 7 | 创建 |
| `fj-backend/fj-auth/` (rbac 包) | TASK-008 | 4 | 创建 |
| `fj-backend/fj-project/` (project 包) | TASK-011 | 5 | 创建 |
| `fj-backend/fj-project/` (inspection-form 包) | TASK-012 | 6 | 创建 |
| `fj-backend/fj-project/` (task/location 包) | TASK-016 | 6 | 创建 |
| `fj-backend/fj-approval/` (config 包) | TASK-013 | 4 | 创建 |
| `fj-backend/fj-approval/` (engine 包) | TASK-030 | 6 | 创建 |
| `fj-backend/fj-recommend/` (standard 包) | TASK-014 | 6 | 创建 |
| `fj-backend/fj-recommend/` (recommend 包) | TASK-021 | 3 | 创建 |
| `fj-backend/fj-sync/` (sync 协议) | TASK-017 | 7 | 创建 |
| `fj-backend/fj-sync/` (photo 包) | TASK-018 | 4 | 创建 |
| `fj-backend/fj-inspection/` (entity/repo) | TASK-024 | 8 | 创建 |
| `fj-backend/fj-inspection/` (submit service) | TASK-025 | 3 | 创建 |
| `fj-backend/fj-inspection/` (confirm service) | TASK-031 | 2 | 创建 |
| `fj-backend/fj-issue/` (entity/pool) | TASK-026 | 5 | 创建 |
| `fj-backend/fj-issue/` (status service) | TASK-027 | 3 | 创建 |
| `fj-backend/fj-issue/` (review service) | TASK-032 | 3 | 创建 |
| `fj-backend/fj-report/` (entity/gen service) | TASK-036 | 4 | 创建 |
| `fj-backend/fj-report/` (snapshot service) | TASK-037 | 4 | 创建 |
| `fj-backend/fj-report/` (approval service) | TASK-040 | 2 | 创建 |
| `fj-backend/fj-report/` (publish service) | TASK-042 | 2 | 创建 |
| `fj-backend/fj-export/` | TASK-041 | 6 | 创建 |
| `fj-android/` (骨架+schema) | TASK-019 | 12 | 创建 |
| `fj-android/src/api/` | TASK-020 | 5 | 创建 |
| `fj-android/src/screens/today,inspection/` | TASK-022 | 5 | 创建 |
| `fj-android/src/screens/inspection,issue-basket,submit/` + `components/photo/` | TASK-028 | 6 | 创建 |
| `fj-web/` (骨架+登录) | TASK-033 | 14 | 创建 |
| `fj-web/src/report-confirm/` | TASK-034 | 5 | 创建 |
| `fj-web/src/report/` | TASK-038 | 5 | 创建 |
| `fj-web/src/issue-pool/` | TASK-039 | 4 | 创建 |
| `fj-web/src/approval/` | TASK-043 | 4 | 创建 |
| `fj-web/src/system/` | TASK-044 | 5 | 创建 |

**预估总文件数**：约 210 个（后端 ~140 + Web ~37 + 安卓 ~28 + 配置/脚本 ~5）

---

## 6. 覆盖完整性检查

- [x] 所有 REQ（21 条）都有至少一个 TASK → ✅
- [x] 所有 DD（11 条）都有至少一个 TASK → ✅
- [x] 所有 BR（10 条）都有至少一个 TASK → ✅
- [x] 所有 NFR（11 条）都有设计支撑 → ✅
- [x] 所有 TASK（44 个）都有 verification_commands → ✅
- [x] 所有 TASK（44 个）都有明确的修改文件列表 → ✅
- [x] 无悬空 REQ（无 REQ 未被任何 TASK 引用）→ ✅
- [x] 无悬空 DD（无 DD 未被任何 TASK 引用）→ ✅
- [x] 无悬空 TASK（无 TASK 未引用任何 REQ/DD）→ ✅
- [x] 文件冲突检查：同模块内并行 task 通过包/目录隔离 → ✅（详见下方冲突矩阵）

---

## 7. 文件冲突矩阵（并行安全性检查）

以下模块被多个 task 修改，通过**包级别隔离**确保无文件重叠：

| 模块 | Task A（先） | Task B（后） | 隔离方式 | 冲突风险 |
|------|-------------|-------------|---------|---------|
| `fj-common/` | TASK-003 (response/exception/enume/dto/config 包) | TASK-044 (notification/audit/concurrent 包) | 不同 Java 包 | ✅ 无冲突 |
| `fj-auth/` | TASK-007 (jwt/security 包) | TASK-008 (rbac 包) | 不同 Java 包，串行依赖 | ✅ 无冲突 |
| `fj-project/` | TASK-011 (project 包) | TASK-012 (inspection-form 包) → TASK-016 (task/location 包) | 不同包，串行依赖链 | ✅ 无冲突 |
| `fj-approval/` | TASK-013 (config 包) | TASK-030 (engine 包) | 不同包，串行依赖 | ✅ 无冲突 |
| `fj-recommend/` | TASK-014 (standard 包) | TASK-021 (recommend 包) | 不同包，串行依赖 | ✅ 无冲突 |
| `fj-sync/` | TASK-017 (sync 协议) | TASK-018 (photo 包) | 不同包，串行依赖 | ✅ 无冲突 |
| `fj-inspection/` | TASK-024 (entity/repo) | TASK-025 (submit) → TASK-031 (confirm) | 不同类文件，串行依赖链 | ✅ 无冲突 |
| `fj-issue/` | TASK-026 (entity/pool) | TASK-027 (status) → TASK-032 (review) | 不同类文件，串行依赖链 | ✅ 无冲突 |
| `fj-report/` | TASK-036 (gen) | TASK-037 (snapshot) → TASK-040 (approval) → TASK-042 (publish) | 不同包，串行依赖链 | ✅ 无冲突 |
| `fj-web/` | TASK-033 (骨架+auth) | TASK-034/038/039/043/044 (各业务目录) | 不同 src 子目录 | ✅ 无冲突 |
| `fj-android/` | TASK-019 (骨架+store) | TASK-020 (api) → TASK-022/028 (screens) | 不同 src 子目录 | ✅ 无冲突 |
| `db/migration/` | 各 V{N} 迁移 task | — | 不同版本号文件 | ✅ 无冲突 |

**结论**：44 个 task 之间不存在并行文件冲突。同模块多 task 通过包隔离 + 串行依赖保证安全。

---

## 8. 依赖关系拓扑（关键路径）

```
TASK-001 (PG升级)
  └→ TASK-002 (Maven骨架)
       └→ TASK-003 (fj-common)
            └→ TASK-004 (fj-api配置)
                 └→ TASK-005 (V1基础表)
                      ├→ TASK-006 (fj-system实体)
                      │    ├→ TASK-007 (JWT认证)
                      │    │    └→ TASK-008 (RBAC权限)
                      │    │         └→ TASK-009 (V2种子数据)
                      │    │         └→ TASK-011 (Project CRUD) ──┐
                      │    │              └→ TASK-012 (检查表)    │
                      │    │              └→ TASK-016 (任务派发)   │ ← TASK-010 (V3项目表)
                      │    └→ TASK-013 (审批配置)                 │ ← TASK-015 (V4任务表)
                      │    └→ TASK-014 (标准库)                    │
                      │         └→ TASK-021 (标准推荐)             │
                      │    └→ TASK-024 (日报实体) ← TASK-023 (V5日报表)
                      │         └→ TASK-025 (日报提交)
                      │         └→ TASK-026 (问题池) ← [日报确认依赖]
                      │              └→ TASK-027 (状态流转+期限)
                      │                   └→ TASK-032 (问题复核) ← TASK-030 (审批引擎)
                      │                                     ← TASK-031 (日报确认锁定)
                      │    └→ TASK-036 (报告生成) ← TASK-035 (V7报告表)
                      │         └→ TASK-037 (问题快照)
                      │              └→ TASK-040 (报告审批) → TASK-042 (发布固化)
                      │                                      ← TASK-041 (导出引擎)
                      ├→ TASK-017 (同步协议) → TASK-018 (照片上传)
                      └→ TASK-044 (横切服务)

TASK-019 (安卓骨架) → TASK-020 (同步引擎) → TASK-022 (检查页面) → TASK-028 (问题取证+日报)
TASK-033 (Web骨架) → TASK-034/038/039/043/044 (各Web页面)
```

**关键路径**（最长依赖链）：TASK-001→002→003→004→005→006→024→026→031→036→037→041→042（13 步）
