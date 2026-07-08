# Trace Delta — WI-0017 检查中屏幕实装（TaskDetail + InspectionInProgress + IssueEvidence 集成）

> **Work Item**: WI-0017
> **Workflow Type**: feature_spec
> **Workflow Path**: requirement_change_path
> **Base Spec Version**: PSV-0001
> **Date**: 2026-07-05
> **作者 Agent**: sf-task-planner（多角色合并 Agent）
> **标准依据**: SpecForge V7 Candidate Completeness Governance
> **Path**: .specforge/work-items/WI-0017/trace_delta.md
> **上游**: intake.md, impact_analysis.md, candidates/project/modules/core/requirements.candidate.md (REQ-1~5), candidates/project/modules/core/design.candidate.md (DD-1~3), candidates/tasks.md (TASK-1~3)

---

## 1. 追溯矩阵

> 追溯链：`REQ → AC → DD → TASK → FILE → TEST / VERIFICATION_COMMAND`

### REQ-1（TaskDetailScreen 集成）

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|---------|---------|
| REQ-1 | REQ-1.AC1（TaskDetail 路由 component 从 SimplePlaceholder 替换为 TaskDetailScreen） | DD-1 | TASK-1 | fj-android/src/navigation/AppNavigator.tsx | `grep -cE "component=\{TaskDetailScreen\}"` 期望 ≥1 |
| REQ-1 | REQ-1.AC2（点击 TaskCard 推入真实 TaskDetailScreen + findAndObserve(taskId) 订阅） | DD-1 | TASK-1 | fj-android/src/navigation/AppNavigator.tsx + fj-android/src/screens/inspection/TaskDetailScreen.tsx | `grep -c "import TaskDetailScreen"` 期望 ≥1；运行时由 TASK-3 间接验证（Metro bundle 解析） |
| REQ-1 | REQ-1.AC3（PENDING/IN_PROGRESS 状态启用 start-inspection-btn 跳转 InspectionInProgress） | DD-1 | TASK-1 | fj-android/src/screens/inspection/TaskDetailScreen.tsx（不改，已实装 testID + handleStartInspection） | 骨架事实源 L70-L72/L92-L93/L124-L134 已实装；TASK-1 激活后即可工作 |

### REQ-2（InspectionInProgressScreen 集成）

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|---------|---------|
| REQ-2 | REQ-2.AC1（InspectionInProgress 路由 component 替换为 InspectionInProgressScreen） | DD-1 | TASK-1 | fj-android/src/navigation/AppNavigator.tsx | `grep -cE "component=\{InspectionInProgressScreen\}"` 期望 ≥1 |
| REQ-2 | REQ-2.AC2（点击"开始检查"推入真实 InspectionInProgressScreen + 进度条 + IssueCreateButton + 提交日报按钮） | DD-1 | TASK-1 | fj-android/src/navigation/AppNavigator.tsx + fj-android/src/screens/inspection/InspectionInProgressScreen.tsx | `grep -c "import InspectionInProgressScreen"` 期望 ≥1；骨架事实源 L114-L163 已实装 UI |
| REQ-2 | REQ-2.AC3（条目为空时渲染"暂无检查表条目"+ "0/0 项"不崩溃） | DD-1 | TASK-1 | fj-android/src/screens/inspection/InspectionInProgressScreen.tsx（不改，已实装 empty state + 进度除零防御 L87） | 骨架事实源 L132-L139 + L87 已实装防御；TASK-1 激活后即可工作 |

### REQ-3（IssueEvidenceScreen 集成）

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|---------|---------|
| REQ-3 | REQ-3.AC1（IssueEvidence 路由 component 替换为 IssueEvidenceScreen） | DD-1 | TASK-1 | fj-android/src/navigation/AppNavigator.tsx | `grep -cE "component=\{IssueEvidenceScreen\}"` 期望 ≥1 |
| REQ-3 | REQ-3.AC2（点击 IssueCreateButton 推入真实 IssueEvidenceScreen + 表单 + 保存按钮） | DD-1 | TASK-1 | fj-android/src/navigation/AppNavigator.tsx + fj-android/src/screens/inspection/IssueEvidenceScreen.tsx | `grep -c "import IssueEvidenceScreen"` 期望 ≥1；骨架事实源 L457-L609 已实装表单 UI |
| REQ-3 | REQ-3.AC3（PhotoCapture/PhotoCompressor 端口未注入时通过骨架降级保证可渲染） | DD-1 | TASK-1 | fj-android/src/screens/inspection/IssueEvidenceScreen.tsx（不改，骨架内置 DefaultCameraProvider 降级） | 骨架事实源 L24 注释 + PhotoCapture/PhotoCompressor 组件已实装降级；本 WI 不引入新端口注入 |

### REQ-4（SubmitReport 保留占位 + 文案修正）

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|---------|---------|
| REQ-4 | REQ-4.AC1（SubmitReport 路由 component 保持 SimplePlaceholder 不替换） | DD-2 | TASK-1 | fj-android/src/navigation/AppNavigator.tsx | SubmitReport 路由仍保留 children 回调（事实源 L109-L119 结构不变） |
| REQ-4 | REQ-4.AC2（subtitle 文案从"骨架占位 — WI-0017 实现"改为"骨架占位 — WI-0019 实现"） | DD-2 | TASK-1 | fj-android/src/navigation/AppNavigator.tsx | `grep -c "WI-0019 实现"` 期望 ≥1；`grep -c "骨架占位 — WI-0017 实现"` 期望 0 |

### REQ-5（TypeScript 类型检查 + Docker 构建验证）

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|---------|---------|
| REQ-5 | REQ-5.AC1（tsc --noEmit 退出码 0，无 error TS） | DD-3 | TASK-2 | (Docker tsc 输出) | `npx tsc --noEmit` 退出码 0；`grep -c "error TS" fj-android/tsc-wi17.log` 期望 0 |
| REQ-5 | REQ-5.AC2（assembleDebug 退出码 0，产出 app-debug.apk > 1 MiB） | DD-3 | TASK-3 | fj-android/android/app/build/outputs/apk/debug/app-debug.apk | `./gradlew assembleDebug` 退出码 0；`grep -c "BUILD SUCCESSFUL" fj-android/build-wi17.log` ≥1；`stat -c %s` > 1048576 |
| REQ-5 | REQ-5.AC3（导入路径错误或类型不一致时在本 WI 内修正，不回退占位） | DD-3 | TASK-1, TASK-2, TASK-3 | fj-android/src/navigation/AppNavigator.tsx | tsc + assembleDebug 双门验证；失败时回退 TASK-1 修正（非任何/@ts-ignore 绕过） |

---

## 2. 文件覆盖

| 文件 | 创建/修改/删除 | 涉及 REQ | 涉及 TASK | 涉及 DD |
|------|----------------|---------|-----------|---------|
| fj-android/src/navigation/AppNavigator.tsx | 修改（221 → ~220 行，净变更 ±10） | REQ-1, REQ-2, REQ-3, REQ-4 | TASK-1 | DD-1, DD-2 |
| fj-android/src/screens/inspection/TaskDetailScreen.tsx | **不改**（261 行就绪骨架，由 TASK-1 import 激活） | REQ-1 | TASK-1（引用） | DD-1 |
| fj-android/src/screens/inspection/InspectionInProgressScreen.tsx | **不改**（370 行就绪骨架，由 TASK-1 import 激活） | REQ-2 | TASK-1（引用） | DD-1 |
| fj-android/src/screens/inspection/IssueEvidenceScreen.tsx | **不改**（915 行就绪骨架，由 TASK-1 import 激活） | REQ-3 | TASK-1（引用） | DD-1 |
| fj-android/src/screens/inspection/IssueCreateButton.tsx | **不改**（69 行就绪，由 InspectionInProgressScreen 引用） | REQ-3 | TASK-1（间接引用） | DD-1 |
| fj-android/src/screens/today/TodayInspectionScreen.tsx | **不改**（InspectionStackParamList 类型源，WI-0016 已合并） | REQ-1, REQ-2, REQ-3 | TASK-1（type import） | DD-1 |
| fj-android/tsc-wi17.log | 构建产物（非源码，TASK-2 证据） | REQ-5 | TASK-2 | DD-3 |
| fj-android/build-wi17.log | 构建产物（非源码，TASK-3 证据） | REQ-5 | TASK-3 | DD-3 |
| fj-android/android/app/build/outputs/apk/debug/app-debug.apk | 构建产物（非源码） | REQ-5 | TASK-3 | DD-3 |

**总计**：1 文件修改（AppNavigator.tsx），5 文件不改仅引用，3 构建产物/证据日志。

---

## 3. 覆盖统计

| 指标 | 值 |
|------|-----|
| 总 REQ 数 | 5（REQ-1 ~ REQ-5） |
| 总 AC 数 | 14（REQ-1:3 + REQ-2:3 + REQ-3:3 + REQ-4:2 + REQ-5:3） |
| 已覆盖 AC | 14 / 14 ✅ |
| 未覆盖 AC | 0 |
| 总 DD 数 | 3（DD-1 ~ DD-3） |
| 已覆盖 DD | 3 / 3 ✅ |
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
| 1 | 每个 REQ 是否至少关联一个 AC？ | ✅ 5 个 REQ 均有 AC（共 14） |
| 2 | 每个 AC 是否至少关联一个 TASK？ | ✅ 全部 AC 映射到 TASK-1/2/3 |
| 3 | 每个 DD 是否至少关联一个 TASK？ | ✅ DD-1/2 → TASK-1；DD-3 → TASK-2+3 |
| 4 | 每个 TASK 是否有明确目标文件？ | ✅ TASK-1 有源文件 AppNavigator.tsx；TASK-2/3 为类型/构建验证（allowed_write_files=[]，证据日志为目标产物） |
| 5 | 每个目标文件是否有验证方式？ | ✅ 追溯矩阵"验证方式"列每文件均有 grep / test / docker / tsc |
| 6 | trace_delta.md 是否真实写入？ | ✅ 本文件通过 sf_artifact_write 写入 |

---

## 5. Trace Delta 元信息

```json
{
  "work_item_id": "WI-0017",
  "trace_delta_version": "1.0",
  "base_spec_version": "PSV-0001",
  "requirements_count": 5,
  "acceptance_criteria_count": 14,
  "design_decisions_count": 3,
  "tasks_count": 3,
  "files_count": 9,
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
  "note": "REQ/DD 编号已由并行 sf-requirements / sf-design 落定（本 run 为多角色合并 Agent，REQ-1~5 / DD-1~3 / TASK-1~3 编号一致）"
}
```

---

**文档结束**。本 trace_delta 与 candidates/tasks.md + requirements.candidate.md + design.candidate.md 同源生成，待 Gate（trace / spec_consistency）校验。
