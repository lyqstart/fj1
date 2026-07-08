# Trace Delta — WI-0016: 今日检查屏幕实装（TodayInspectionScreen 激活 + 导航集成）

> **Work Item**: WI-0016
> **Workflow Type**: feature_spec
> **Workflow Path**: requirement_change_path
> **Base Spec Version**: PSV-0001
> **Date**: 2026-07-05
> **作者 Agent**: sf-task-planner
> **标准依据**: SpecForge V7 Candidate Completeness Governance
> **Path**: .specforge/work-items/WI-0016/trace_delta.md
> **上游**: intake.md, impact_analysis.md, candidates/tasks.md (TASK-1~3)
> **注**: requirements.candidate.md / design.candidate.md 由并行 Agent 生成；REQ/DD 编号为基于 intake + impact_analysis 推断的占位，正式编号由并行 Agent 落定后由 Orchestrator 对齐。

---

## 1. 追溯矩阵

> 追溯链：`REQ → AC → DD → TASK → FILE → TEST / VERIFICATION_COMMAND`

### REQ-1（TodayInspectionScreen 集成到 Today Tab）

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|---------|---------|
| REQ-1 | REQ-1.AC1（TodayInspection 作为 Today Tab 初始路由） | DD-1 | TASK-1 | fj-android/src/navigation/AppNavigator.tsx | `grep -c "component={InspectionStack}"` 期望 ≥1 |
| REQ-1 | REQ-1.AC2（嵌套 Stack Navigator 支持 TodayInspection 列表渲染） | DD-1 | TASK-1 | fj-android/src/navigation/AppNavigator.tsx | `grep -c "createStackNavigator"` 期望 ≥1 |
| REQ-1 | REQ-1.AC3（TodayInspection 路由 headerShown:false 避免双 header） | DD-1 | TASK-1 | fj-android/src/navigation/AppNavigator.tsx | `grep -c "headerShown: false"` 期望 ≥1（TodayInspection 路由 options） |
| REQ-1 | REQ-1.AC4（删除旧 TodayScreen placeholder 函数） | DD-2 | TASK-1 | fj-android/src/navigation/AppNavigator.tsx | `grep -c "function TodayScreen"` 期望 0 |

### REQ-2（TaskCard 导航契约：点击跳转 TaskDetail）

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|---------|---------|
| REQ-2 | REQ-2.AC1（TaskDetail 路由在 InspectionStack 内注册，不崩溃） | DD-1, DD-2 | TASK-1 | fj-android/src/navigation/AppNavigator.tsx | `grep -cE "name=\"TaskDetail\""` 期望 ≥1 |
| REQ-2 | REQ-2.AC2（InspectionInProgress / SubmitReport / IssueEvidence 三路由注册） | DD-2 | TASK-1 | fj-android/src/navigation/AppNavigator.tsx | 5 路由 grep 期望 5（含 TaskDetail） |
| REQ-2 | REQ-2.AC3（InspectionStackParamList 类型从 TodayInspectionScreen import，不重定义） | DD-1 | TASK-1 | fj-android/src/navigation/AppNavigator.tsx | `grep -c "InspectionStackParamList"` 期望 ≥1（type import + 泛型使用） |
| REQ-2 | REQ-2.AC4（StackNavigationProp 泛型在 tsc 期校验） | DD-1, DD-4 | TASK-1, TASK-2 | AppNavigator.tsx + TaskCard.tsx + tsc | `npx tsc --noEmit` 退出码 0（TASK-2 验证） |

### REQ-3（Tab 边界保留 + TypeScript 类型安全）

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|---------|---------|
| REQ-3 | REQ-3.AC1（IssueBasket Tab 保留 placeholder，文案不变） | DD-3 | TASK-1 | fj-android/src/navigation/AppNavigator.tsx | `grep -c "问题篮子"` 期望 ≥1（文案保留） |
| REQ-3 | REQ-3.AC2（Profile Tab 保留 placeholder，文案不变） | DD-3 | TASK-1 | fj-android/src/navigation/AppNavigator.tsx | `grep -c "我的"` 期望 ≥1（文案保留） |
| REQ-3 | REQ-3.AC3（RootTabParamList 类型不变：Today/IssueBasket/Profile） | DD-3 | TASK-1 | fj-android/src/navigation/AppNavigator.tsx | `grep -c "RootTabParamList"` 期望 ≥1 |
| REQ-3 | REQ-3.AC4（TypeScript 类型检查通过，无 any 绕过） | DD-4 | TASK-2 | (tsc 输出) | `npx tsc --noEmit` 退出码 0；`grep -c "error TS" tsc-wi16.log` 期望 0 |

### REQ-4（Docker 构建验证）

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|---------|---------|
| REQ-4 | REQ-4.AC1（assembleDebug 构建成功） | DD-4 | TASK-3 | (Docker 构建) | `./gradlew assembleDebug` 退出码 0；`grep -c "BUILD SUCCESSFUL"` build-wi16.log 期望 ≥1 |
| REQ-4 | REQ-4.AC2（app-debug.apk 产出且 size > 1 MiB） | DD-4 | TASK-3 | fj-android/android/app/build/outputs/apk/debug/app-debug.apk | `test -f` + `stat -c %s` > 1048576 |
| REQ-4 | REQ-4.AC3（@react-navigation/stack 在 Metro bundle 内可解析） | DD-4 | TASK-3 | (构建日志) | 构建退出码 0（间接证明 import 路径正确） |
| REQ-4 | REQ-4.AC4（可选：首次启动无 crash） | DD-4 | (留给手动测试) | (运行时) | 可选，本 WI 不强制验证 |

---

## 2. 文件覆盖

| 文件 | 创建/修改/删除 | 涉及 REQ | 涉及 TASK | 涉及 DD |
|------|----------------|---------|-----------|---------|
| fj-android/src/navigation/AppNavigator.tsx | 修改（139 → ~250 行） | REQ-1, REQ-2, REQ-3 | TASK-1 | DD-1, DD-2, DD-3 |
| fj-android/src/screens/today/TodayInspectionScreen.tsx | **不改**（已是 218 行就绪骨架，由 TASK-1 import 激活） | REQ-1, REQ-2 | TASK-1（引用） | DD-1 |
| fj-android/src/screens/today/TaskCard.tsx | **不改**（已是 141 行就绪骨架，StackNavigationProp 在 TASK-1 提供的 Stack 上下文内可用） | REQ-2 | TASK-1（引用） | DD-1 |
| fj-android/src/navigation/RootNavigator.tsx | **不改**（仍 `<AppNavigator />`） | REQ-1 | TASK-1（被动验证未断引用） | — |
| fj-android/src/AppRoot.tsx | **不改**（WI-0015 已完成 DatabaseProvider/SyncEngineInitializer 嵌套） | — | — | — |
| fj-android/tsc-wi16.log | 构建产物（非源码，TASK-2 证据） | REQ-3 | TASK-2 | DD-4 |
| fj-android/build-wi16.log | 构建产物（非源码，TASK-3 证据） | REQ-4 | TASK-3 | DD-4 |
| fj-android/android/app/build/outputs/apk/debug/app-debug.apk | 构建产物（非源码） | REQ-4 | TASK-3 | DD-4 |

**总计**：1 文件修改（AppNavigator.tsx），3 文件不改仅引用，3 构建产物/证据日志。

---

## 3. 覆盖统计

| 指标 | 值 |
|------|-----|
| 总 REQ 数 | 4（REQ-1 ~ REQ-4） |
| 总 AC 数 | 15（REQ-1:4 + REQ-2:4 + REQ-3:4 + REQ-4:4 = 16；剔除 REQ-4.AC4 可选后核心 AC 15） |
| 已覆盖 AC | 15 / 15 ✅（REQ-4.AC4 标可选，不计入硬性覆盖） |
| 未覆盖 AC | 0 |
| 总 DD 数 | 4（DD-1 ~ DD-4） |
| 已覆盖 DD | 4 / 4 ✅ |
| 总 TASK 数 | 3（TASK-1 ~ TASK-3） |
| 已关联 REQ 的 TASK | 3 / 3 ✅ |
| 已关联 DD 的 TASK | 3 / 3 ✅ |
| 无悬空 REQ | ✅（每个 REQ 至少 1 个 TASK） |
| 无悬空 DD | ✅（每个 DD 至少 1 个 TASK） |
| 无悬空 TASK | ✅（每个 TASK 至少 1 个 DD + 1 个 REQ） |
| 每个目标文件有验证方式 | ✅（见追溯矩阵"验证方式"列） |

---

## 4. 自检（V7 强制）

| # | 自问自答 | 答案 |
|---|---------|------|
| 1 | 每个 REQ 是否至少关联一个 AC？ | ✅ 4 个 REQ 均有 AC（共 15+） |
| 2 | 每个 AC 是否至少关联一个 TASK？ | ✅ 全部 AC 映射到 TASK-1/2/3 |
| 3 | 每个 DD 是否至少关联一个 TASK？ | ✅ DD-1/2/3 → TASK-1；DD-4 → TASK-2+3 |
| 4 | 每个 TASK 是否有明确目标文件？ | ✅ TASK-1 有源文件 AppNavigator.tsx；TASK-2/3 为类型/构建验证（allowed_write_files=[]，证据日志为目标产物） |
| 5 | 每个目标文件是否有验证方式？ | ✅ 追溯矩阵"验证方式"列每文件均有 grep / test / docker / tsc |
| 6 | trace_delta.md 是否真实写入？ | ✅ 本文件通过 sf_artifact_write 写入 |

---

## 5. Trace Delta 元信息

```json
{
  "work_item_id": "WI-0016",
  "trace_delta_version": "1.0",
  "base_spec_version": "PSV-0001",
  "requirements_count": 4,
  "acceptance_criteria_count": 15,
  "design_decisions_count": 4,
  "tasks_count": 3,
  "files_count": 8,
  "coverage": {
    "requirements_covered": true,
    "acceptance_criteria_covered": true,
    "design_decisions_covered": true,
    "tasks_covered": true,
    "files_covered": true,
    "no_dangling_req": true,
    "no_dangling_dd": true,
    "no_dangling_task": true
  },
  "verification_methods": ["grep", "test -f", "wc -l", "docker assembleDebug", "stat size", "npx tsc --noEmit", "build log grep"],
  "note": "REQ/DD 编号为基于 intake + impact_analysis 推断的占位 ID，正式编号待并行 sf-requirements / sf-design 落定后由 Orchestrator 对齐"
}
```

---

**文档结束**。本 trace_delta 与 candidates/tasks.md 同源生成，待 Gate（trace / spec_consistency）校验。
