# Trace Delta — WI-0019: 问题篮子 + 提交日报屏幕集成

> **Work Item**: WI-0019
> **Workflow Type**: feature_spec
> **Workflow Path**: requirement_change_path
> **Base Spec Version**: PSV-0001
> **Date**: 2026-07-05
> **作者 Agent**: sf-task-planner
> **标准依据**: SpecForge V7 Candidate Completeness Governance
> **Path**: .specforge/work-items/WI-0019/candidates/trace_delta.md
> **上游**: requirements.candidate.md (REQ-1~3), design.candidate.md (DD-1~2), candidates/tasks.md (TASK-1~3)

---

## 1. 追溯矩阵

> 追溯链：`REQ → AC → DD → TASK → FILE → TEST / VERIFICATION_COMMAND`

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|---------|---------|
| REQ-1 (IssueBasket Tab 集成) | REQ-1.AC1 | DD-1（改动 A+B） | TASK-1 | fj-android/src/navigation/AppNavigator.tsx | `grep "import IssueBasketScreen from"` ≥1 + `grep -cE "^function IssueBasketScreen"` = 0（本地占位已删） |
| REQ-1 | REQ-1.AC2 | DD-1（改动 B） | TASK-1 | fj-android/src/navigation/AppNavigator.tsx | `grep "component={IssueBasketScreen}"` ≥1（Tab.Screen 指向 import 真实屏幕）+ options 保留 |
| REQ-1 | REQ-1.AC3 | DD-1 | TASK-1, TASK-2 | fj-android/src/navigation/AppNavigator.tsx | tsc 退出码 0（无类型错误，不通过 any/@ts-ignore 绕过） |
| REQ-2 (SubmitReport 路由集成) | REQ-2.AC1 | DD-1（改动 A+C） | TASK-1 | fj-android/src/navigation/AppNavigator.tsx | `grep "import SubmitReportScreen from"` ≥1 + `grep "component={SubmitReportScreen}"` ≥1（children 回调已替换） |
| REQ-2 | REQ-2.AC2 | DD-1（改动 C） | TASK-1 | fj-android/src/navigation/AppNavigator.tsx | `grep "headerTitle: '提交日报'"` ≥1 + `name="SubmitReport"` 保留 |
| REQ-2 | REQ-2.AC3 | DD-1 | TASK-1, TASK-2 | fj-android/src/screens/submit/SubmitReportScreen.tsx（不改） | 依赖骨架既有降级逻辑（离线提示/按钮禁用），构建通过保证可渲染；运行时 E2E 留后续 WI |
| REQ-3 (tsc + Docker 验证) | REQ-3.AC1 | DD-2 | TASK-2 | (tsc 输出) | Docker 内 `npx tsc --noEmit` 退出码 0，`grep "error TS" <log>` = 0 |
| REQ-3 | REQ-3.AC2 | DD-2 | TASK-3 | fj-android/android/app/build/outputs/apk/debug/app-debug.apk | Docker assembleDebug 退出码 0 + APK 存在 + size > 1048576 |
| REQ-3 | REQ-3.AC3 | DD-2 | TASK-2, TASK-3 | (失败处理) | 失败时不通过 any/@ts-ignore/回退 SimplePlaceholder 绕过（约束） |

---

## 2. 文件覆盖

| 文件 | 创建/修改/删除 | 涉及 REQ | 涉及 TASK | 涉及 DD |
|------|----------------|---------|-----------|---------|
| fj-android/src/navigation/AppNavigator.tsx | 修改（206→~210 行） | REQ-1, REQ-2 | TASK-1 | DD-1 |
| fj-android/src/screens/issue-basket/IssueBasketScreen.tsx | **不改**（仅被 import） | REQ-1 | TASK-1（read_files 确认 export default） | DD-1 |
| fj-android/src/screens/submit/SubmitReportScreen.tsx | **不改**（仅被 import） | REQ-2 | TASK-1（read_files 确认 export default） | DD-1 |
| fj-android/src/screens/today/TodayInspectionScreen.tsx | **不改**（InspectionStackParamList 定义源） | REQ-2 | TASK-1（read_files 确认路由表） | DD-1 |
| fj-android/android/app/build/outputs/apk/debug/app-debug.apk | 构建产物（非源码） | REQ-3 | TASK-3 | DD-2 |

**总计**：1 文件修改（AppNavigator.tsx），3 文件不改仅引用/确认，1 构建产物。无新建文件。

---

## 3. 覆盖统计

| 指标 | 值 |
|------|-----|
| 总 REQ 数 | 3（REQ-1 ~ REQ-3） |
| 总 AC 数 | 9（REQ-1:3 + REQ-2:3 + REQ-3:3） |
| 已覆盖 AC | 9 / 9 ✅ |
| 未覆盖 AC | 0 |
| 总 DD 数 | 2（DD-1 ~ DD-2） |
| 已覆盖 DD | 2 / 2 ✅ |
| 总 TASK 数 | 3（TASK-1 ~ TASK-3） |
| 已关联 REQ 的 TASK | 3 / 3 ✅ |
| 已关联 DD 的 TASK | 3 / 3 ✅ |
| 无悬空 REQ | ✅（每个 REQ 至少 1 个 TASK 覆盖） |
| 无悬空 DD | ✅（每个 DD 至少 1 个 TASK） |
| 无悬空 TASK | ✅（每个 TASK 至少 1 个 DD + 1 个 REQ） |
| 每个目标文件有验证方式 | ✅（见追溯矩阵"验证方式"列） |

---

## 4. 自检（V7 强制）

| # | 自问自答 | 答案 |
|---|---------|------|
| 1 | 每个 REQ 是否至少关联一个 AC？ | ✅ 3 个 REQ 均有 3 个 AC（共 9） |
| 2 | 每个 AC 是否至少关联一个 TASK？ | ✅ 全部 AC 映射到 TASK-1（代码改动）或 TASK-2/3（验证）；REQ-2.AC3 依赖 SubmitReportScreen 骨架既有降级逻辑，由 TASK-2/3 构建通过间接保证可渲染 |
| 3 | 每个 DD 是否至少关联一个 TASK？ | ✅ DD-1→TASK-1; DD-2→TASK-2 + TASK-3 |
| 4 | 每个 TASK 是否有明确目标文件？ | ✅ TASK-1(AppNavigator.tsx 修改); TASK-2/3 为类型/构建验证（allowed_write_files=[]） |
| 5 | 每个目标文件是否有验证方式？ | ✅ 追溯矩阵"验证方式"列每文件均有 grep/test/docker/tsc |
| 6 | trace_delta.md 是否真实写入？ | ✅ 本文件通过 sf_artifact_write 写入 |

---

## 5. Trace Delta 元信息

```json
{
  "work_item_id": "WI-0019",
  "trace_delta_version": "1.0",
  "base_spec_version": "PSV-0001",
  "requirements_count": 3,
  "acceptance_criteria_count": 9,
  "design_decisions_count": 2,
  "tasks_count": 3,
  "files_count": 5,
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
  "verification_methods": ["grep", "test -f", "wc -l", "docker assembleDebug", "stat size", "npx tsc --noEmit"]
}
```

---

**文档结束**。本 trace_delta 与 candidates/tasks.md 同源生成，待 Gate（trace / spec_consistency）校验。
