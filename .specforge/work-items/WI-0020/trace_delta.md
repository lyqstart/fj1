# Trace Delta — WI-0020: 解除屏蔽 5 个 RN 原生模块

> **Work Item**: WI-0020
> **Workflow Type**: feature_spec
> **Workflow Path**: requirement_change_path
> **Base Spec Version**: PSV-0008
> **Date**: 2026-07-05
> **作者 Agent**: sf-task-planner
> **标准依据**: SpecForge V7 Candidate Completeness Governance
> **Path**: .specforge/work-items/WI-0020/trace_delta.md
> **上游**: requirements.candidate.md (REQ-1~3), design.candidate.md (DD-1~3), candidates/tasks.md (TASK-1~4)

---

## 1. 追溯矩阵

> 追溯链：`REQ → AC → DD → TASK → FILE → TEST / VERIFICATION_COMMAND`

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|---------|---------|
| REQ-1 (解除 5 模块屏蔽) | REQ-1.AC1 | DD-1 | TASK-1 | fj-android/react-native.config.js | `grep -c "platforms: { android: null }"` = 0（5 屏蔽条目全删）+ `grep "dependencies: {}"` ≥1 |
| REQ-1 | REQ-1.AC2 | DD-1 | TASK-1 | fj-android/react-native.config.js | `node -e "require(...)"` 退出码 0（CLI 可解析，恢复 autolinking） |
| REQ-1 | REQ-1.AC3 | DD-1 | TASK-1 | fj-android/react-native.config.js | `grep -cE "^module.exports"` ≥1（结构合法，不删除文件） |
| REQ-2 (编译错误修复) | REQ-2.AC1 | DD-2.A | TASK-2, TASK-4 | fj-android/android/app/build.gradle（contingency） | 构建日志含 `:react-native-vision-camera` CMake SUCCESS（容器 CMake+NDK 可用，不降级） |
| REQ-2 | REQ-2.AC2 | DD-2.B/C/D | TASK-2 | fj-android/src/components/photo/PhotoCapture.tsx / AppRoot.tsx（contingency） | tsc/构建报错已修复（TASK-3/4 重跑通过）；`isAvailable()` 业务语义不变（默认 false） |
| REQ-2 | REQ-2.AC3 | DD-2 | TASK-2 | (失败处理) | 失败时不回退屏蔽 / 不用 any/@ts-ignore / 不升级版本（约束）；`grep "platforms: { android: null }"` 仍 = 0 |
| REQ-3 (tsc + Docker 验证) | REQ-3.AC1 | DD-3 | TASK-3 | (tsc 输出) | Docker 内 `npx tsc --noEmit` 退出码 0，`grep "error TS" <log>` = 0 |
| REQ-3 | REQ-3.AC2 | DD-3 | TASK-4 | fj-android/android/app/build/outputs/apk/debug/app-debug.apk | Docker assembleDebug 退出码 0 + `BUILD SUCCESSFUL` + APK 存在 + size > 1048576 |
| REQ-3 | REQ-3.AC3 | DD-3 | TASK-3, TASK-4 | (失败处理) | 失败时不回退屏蔽 / 不用 any/@ts-ignore 绕过（约束） |

---

## 2. 文件覆盖

| 文件 | 创建/修改/删除 | 涉及 REQ | 涉及 TASK | 涉及 DD |
|------|----------------|---------|-----------|---------|
| fj-android/react-native.config.js | 修改（17→~12 行） | REQ-1 | TASK-1 | DD-1 |
| fj-android/src/components/photo/PhotoCapture.tsx | **可能修改**（contingency，类型对齐） | REQ-2 | TASK-2 | DD-2.B |
| fj-android/src/di/PhotoUploadPort.tsx | **不改**（路径校验：仅 Context，无 isAvailable） | — | TASK-2（read_files 确认） | DD-2.B |
| fj-android/src/AppRoot.tsx | **可能修改**（contingency，SafeAreaProvider 包裹） | REQ-2 | TASK-2 | DD-2.C |
| fj-android/android/app/build.gradle | **可能修改**（contingency，CMake/NDK 配置） | REQ-2 | TASK-2 | DD-2.A |
| fj-android/android/gradle.properties | **可能修改**（contingency） | REQ-2 | TASK-2 | DD-2.A |
| fj-android/android/app/build/outputs/apk/debug/app-debug.apk | 构建产物（非源码） | REQ-3 | TASK-4 | DD-3 |

**总计**：1 文件确定修改（config.js），4 文件 contingency（视编译结果），1 文件路径校验不改，1 构建产物。无新建文件。

---

## 3. 覆盖统计

| 指标 | 值 |
|------|-----|
| 总 REQ 数 | 3（REQ-1 ~ REQ-3） |
| 总 AC 数 | 9（REQ-1:3 + REQ-2:3 + REQ-3:3） |
| 已覆盖 AC | 9 / 9 ✅ |
| 未覆盖 AC | 0 |
| 总 DD 数 | 3（DD-1 ~ DD-3） |
| 已覆盖 DD | 3 / 3 ✅ |
| 总 TASK 数 | 4（TASK-1 ~ TASK-4） |
| 已关联 REQ 的 TASK | 4 / 4 ✅ |
| 已关联 DD 的 TASK | 4 / 4 ✅ |
| 无悬空 REQ | ✅（每个 REQ 至少 1 个 TASK 覆盖） |
| 无悬空 DD | ✅（每个 DD 至少 1 个 TASK） |
| 无悬空 TASK | ✅（每个 TASK 至少 1 个 DD + 1 个 REQ） |
| 每个目标文件有验证方式 | ✅（见追溯矩阵"验证方式"列） |

---

## 4. 自检（V7 强制）

| # | 自问自答 | 答案 |
|---|---------|------|
| 1 | 每个 REQ 是否至少关联一个 AC？ | ✅ 3 个 REQ 均有 3 个 AC（共 9） |
| 2 | 每个 AC 是否至少关联一个 TASK？ | ✅ 全部 AC 映射到 TASK-1（config）或 TASK-2（修复）或 TASK-3/4（验证） |
| 3 | 每个 DD 是否至少关联一个 TASK？ | ✅ DD-1→TASK-1; DD-2→TASK-2; DD-3→TASK-3+TASK-4 |
| 4 | 每个 TASK 是否有明确目标文件？ | ✅ TASK-1(config.js); TASK-2(contingency 4 文件); TASK-3/4 验证（allowed_write_files=[]） |
| 5 | 每个目标文件是否有验证方式？ | ✅ 追溯矩阵"验证方式"列每文件均有 grep/test/node/docker/tsc |
| 6 | trace_delta.md 是否真实写入？ | ✅ 本文件通过 sf_artifact_write 写入 |

---

## 5. Trace Delta 元信息

```json
{
  "work_item_id": "WI-0020",
  "trace_delta_version": "1.0",
  "base_spec_version": "PSV-0008",
  "requirements_count": 3,
  "acceptance_criteria_count": 9,
  "design_decisions_count": 3,
  "tasks_count": 4,
  "files_count": 7,
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
  "verification_methods": ["grep", "test -f", "node require", "docker assembleDebug", "stat size", "npx tsc --noEmit", "BUILD SUCCESSFUL grep"],
  "path_corrections": [
    {
      "impact_analysis_claim": "DefaultCameraProvider.isAvailable() 在 src/di/PhotoUploadPort.tsx",
      "code_fact": "DefaultCameraProvider 在 src/components/photo/PhotoCapture.tsx L114-133；PhotoUploadPort.tsx 仅 React Context",
      "resolution": "以代码事实源 PhotoCapture.tsx 为准"
    }
  ]
}
```

---

**文档结束**。本 trace_delta 与 candidates/tasks.md 同源生成，待 Gate（trace / spec_consistency）校验。
