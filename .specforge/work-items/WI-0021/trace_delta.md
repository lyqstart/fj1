---
trace_format: trace_delta
work_item_id: WI-0021
workflow_type: feature_spec
workflow_path: requirement_change_path
date: 2026-07-05
title: App 增强 Trace Delta（Token 刷新 + HTTPS + UI Theme）
base_spec_version: PSV-0008
generated_by: sf-task-planner
---

# Trace Delta: WI-0021

> 本文件由 sf-task-planner 在生成 tasks.md 时一并产出（V7 追溯产物强制输出规则）。
> 提供完整追溯矩阵：REQ → AC → DD → TASK → FILE → TEST / VERIFICATION_COMMAND。

## 追溯矩阵

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|---------|---------|
| REQ-1 | AC1 | DD-1 | TASK-1 | `src/api/ApiClient.ts`（拦截器） | `grep isExpiringSoon`；`npx tsc --noEmit` exit 0 |
| REQ-1 | AC1 | DD-1 | TASK-2 | `src/store/auth/AuthContext.tsx`（定时器） | `grep setInterval + 600000`；`npx tsc --noEmit` exit 0 |
| REQ-1 | AC2 | DD-1 | TASK-1 | `src/api/ApiClient.ts`（单飞锁 singleFlightRefresh） | `grep export const singleFlightRefresh + finally`；tsc exit 0 |
| REQ-1 | AC2 | DD-1 | TASK-2 | `src/store/auth/AuthContext.tsx`（复用单飞实例） | `grep singleFlightRefresh`（复用 TASK-1）；tsc exit 0 |
| REQ-1 | AC3 | DD-1 | TASK-1 | `src/api/ApiClient.ts`（失败→logout） | `grep logout`；tsc exit 0（不修改 logout） |
| REQ-1 | AC3 | DD-1 | TASK-2 | `src/store/auth/AuthContext.tsx`（失败→logout） | `grep clearInterval`；tsc exit 0 |
| REQ-2 | AC1 | DD-2 | TASK-3 | `android/app/src/main/res/xml/network_security_config.xml`（新建） | `test -f`；`grep domain-config`；Docker `BUILD SUCCESSFUL` |
| REQ-2 | AC2 | DD-2 | TASK-3 | `android/app/src/main/AndroidManifest.xml`（修改） | `grep networkSecurityConfig`；Docker `BUILD SUCCESSFUL` |
| REQ-2 | AC3 | DD-2 | TASK-3 | `android/app/src/main/res/xml/network_security_config.xml`（白名单） | `grep 129.211.5.240 + cleartextTrafficPermitted="true"` |
| REQ-3 | AC1 | DD-3 | TASK-4 | `src/theme/colors.ts`、`src/theme/spacing.ts`、`src/theme/typography.ts`、`src/theme/index.ts`（新建） | `test -f` ×4；`grep as const`；`grep export ≥3`；tsc exit 0 |
| REQ-3 | AC2 | DD-3 | TASK-4 | `src/theme/index.ts`（barrel 入口，供屏幕引用） | `grep export ≥3`；屏幕渐进式引用属后续（非本 WI 强制） |
| REQ-3 | AC3 | DD-3 | TASK-4 | `src/theme/*.ts`（as const 类型安全） | `npx tsc --noEmit` exit 0（TS2339 编译期拦截） |
| 全局基线 | tsc | — | TASK-5 | 全部 TS 改动文件 | `npx tsc --noEmit` exit 0 |
| 全局基线 | gradle | — | TASK-5 | `network_security_config.xml`、`AndroidManifest.xml` | Docker `./gradlew assembleDebug` → `BUILD SUCCESSFUL` exit 0 |

## 文件覆盖

| 文件 | 创建/修改/删除 | 涉及 REQ | 涉及 TASK |
|------|----------------|---------|-----------|
| `src/api/ApiClient.ts` | 修改 | REQ-1.AC1, REQ-1.AC2, REQ-1.AC3 | TASK-1 |
| `src/store/auth/AuthContext.tsx` | 修改 | REQ-1.AC1, REQ-1.AC2, REQ-1.AC3 | TASK-2 |
| `android/app/src/main/res/xml/network_security_config.xml` | 创建 | REQ-2.AC1, REQ-2.AC3 | TASK-3 |
| `android/app/src/main/AndroidManifest.xml` | 修改 | REQ-2.AC2 | TASK-3 |
| `src/theme/colors.ts` | 创建 | REQ-3.AC1, REQ-3.AC3 | TASK-4 |
| `src/theme/spacing.ts` | 创建 | REQ-3.AC1, REQ-3.AC3 | TASK-4 |
| `src/theme/typography.ts` | 创建 | REQ-3.AC1, REQ-3.AC3 | TASK-4 |
| `src/theme/index.ts` | 创建 | REQ-3.AC1, REQ-3.AC2 | TASK-4 |

## 覆盖统计

- 总 REQ 数：3（REQ-1, REQ-2, REQ-3）
- 总 AC 数：9（REQ-1×3 + REQ-2×3 + REQ-3×3）
- 已覆盖 AC：9 / 9（100%）
- 未覆盖 AC：0
- 无悬空 REQ：✅（每个 REQ 至少 1 个 TASK）
- 无悬空 DD：✅（DD-1→TASK-1/2，DD-2→TASK-3，DD-3→TASK-4）
- 无悬空 TASK：✅（每个 TASK 至少 1 个 REQ/DD ref）
- 全局验证基线覆盖：✅（tsc + gradle → TASK-5）

## 自检（Trace Delta）

| # | 自问自答 | 答案 |
|---|---------|------|
| 1 | 每个 REQ 是否至少关联一个 AC？ | 是。REQ-1×3AC, REQ-2×3AC, REQ-3×3AC。 |
| 2 | 每个 AC 是否至少关联一个 TASK？ | 是。9/9 AC 均映射到 TASK。 |
| 3 | 每个 DD 是否至少关联一个 TASK？ | 是。DD-1→TASK-1/2, DD-2→TASK-3, DD-3→TASK-4。 |
| 4 | 每个 TASK 是否有明确目标文件？ | 是。8 个文件全部列入 allowed_write_files。 |
| 5 | 每个目标文件是否有验证方式？ | 是。每文件至少 1 条 verification_command。 |
| 6 | trace_delta.md 是否真实写入？ | 是。本文件已通过 sf_artifact_write 写入。 |
