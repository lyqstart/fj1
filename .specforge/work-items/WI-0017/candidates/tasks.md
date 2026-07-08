# Tasks Candidate — WI-0017 检查中屏幕实装（TaskDetail + InspectionInProgress + IssueEvidence 集成）

> **Work Item**: WI-0017
> **Workflow Type**: feature_spec
> **Workflow Path**: requirement_change_path
> **Base Spec Version**: PSV-0001
> **Date**: 2026-07-05
> **标准依据**: specforge_final_fused_standard_v1_1_patch1_zh.md (§8.2 Candidate, §11 Task Contract, §12.7 Changed Files Audit, §13.3 Verification)
> **作者 Agent**: sf-task-planner（多角色合并 Agent）
> **Candidate Path**: .specforge/work-items/WI-0017/candidates/tasks.md
> **上游输入**: intake.md (31 行), impact_analysis.md (16 行), requirements.candidate.md (5 REQ / 14 AC), design.candidate.md (DD-1/2/3), 现有源码骨架（AppNavigator 221 / TaskDetailScreen 261 / InspectionInProgressScreen 370 / IssueEvidenceScreen 915 / IssueCreateButton 69）

---

## 0. Extension Registry 前置检查（v1.1 强制）

- 读取 `.specforge/project/extension_registry.json`：`namespaces.task_types = []`（空）。
- 本 tasks 使用标准 `TASK-N` Markdown 格式，未引入任何新 task_type / 结构化扩展类型。
- 结论：**无需触发 Extension Subflow**，可直接产出 Candidate。

---

## 1. 概述

### 1.1 任务清单总览

| TASK | 标题 | 目标文件 | 关联 DD | 关联 REQ | 依赖 |
|------|------|----------|---------|----------|------|
| TASK-1 | AppNavigator.tsx 集成 3 个真实 screen + SubmitReport 占位文案修正 | fj-android/src/navigation/AppNavigator.tsx | DD-1, DD-2 | REQ-1, REQ-2, REQ-3, REQ-4 | — |
| TASK-2 | TypeScript 类型检查（Docker tsc --noEmit） | (无源码改动，类型验证) | DD-3 | REQ-5.1 | TASK-1 |
| TASK-3 | Docker assembleDebug + APK 验证 | (无源码改动，构建验证) | DD-3 | REQ-5.2, REQ-5.3 | TASK-1 |

> 注：TaskDetailScreen.tsx / InspectionInProgressScreen.tsx / IssueEvidenceScreen.tsx / IssueCreateButton.tsx 均为 WI-0017 前置就绪的骨架（261 / 370 / 915 / 69 行），**本 WI 不修改它们**；本 WI 的唯一源码改动点为 AppNavigator.tsx 的"激活集成"层。

### 1.2 依赖图与并行批次

```
Batch 1 (源码):
   TASK-1 (AppNavigator.tsx)
              │
              ▼
Batch 2 (验证，可并行):
   TASK-2 (Docker tsc --noEmit)      TASK-3 (Docker assembleDebug + APK)
```

- **并行批次**: 2 批
- **可并行 task**: Batch 2 内 TASK-2 / TASK-3（同源验证 TASK-1 产出，互不写文件，可并行）
- **串行 task**: TASK-1 → (TASK-2 || TASK-3)

### 1.3 配置事实源声明

- `.specforge/config/prod-environment.md`：当前为 TODO 占位（未填充）。verification_commands 使用跨平台标准工具（grep / test / wc）与项目自身构建命令（Docker 内 `./gradlew assembleDebug` / `npx tsc --noEmit`），不依赖第三方 CLI。
- `.specforge/config/project-rules.md`：当前为 TODO 占位。task 实现遵循相邻文件风格（AppNavigator 现有 JSDoc 注释风格、`React.ReactElement` 返回类型），不引入新依赖（`@react-navigation/stack` 已在 WI-0016 确认安装）。

---

## 2. 任务详细合同

### TASK-1 AppNavigator.tsx 集成 3 个真实 screen + SubmitReport 占位文案修正

**context_block**（executor 必读）：
- **What**: 对 `fj-android/src/navigation/AppNavigator.tsx`（当前 221 行，WI-0016 已合并）执行最小替换式集成，目标 ~230 行。具体操作：
  1. **新增 3 个 import**（紧邻 L23 `import TodayInspectionScreen` 与 L24 `import type { InspectionStackParamList }` 之后）：
     ```tsx
     import TaskDetailScreen from '../screens/inspection/TaskDetailScreen';
     import InspectionInProgressScreen from '../screens/inspection/InspectionInProgressScreen';
     import IssueEvidenceScreen from '../screens/inspection/IssueEvidenceScreen';
     ```
  2. **替换 TaskDetail 路由**（当前 L87-L97）：删除 children 渲染回调 `{() => (<SimplePlaceholder title="任务详情" subtitle="骨架占位 — WI-0017 实现" />)}`，改为 `component={TaskDetailScreen}`，保留 `options={{ headerTitle: '任务详情' }}`：
     ```tsx
     <InspectionStack.Screen
       name="TaskDetail"
       component={TaskDetailScreen}
       options={{ headerTitle: '任务详情' }}
     />
     ```
  3. **替换 InspectionInProgress 路由**（当前 L98-L108）：同样删除 children 回调，改为 `component={InspectionInProgressScreen}`，保留 `options={{ headerTitle: '检查中' }}`：
     ```tsx
     <InspectionStack.Screen
       name="InspectionInProgress"
       component={InspectionInProgressScreen}
       options={{ headerTitle: '检查中' }}
     />
     ```
  4. **替换 IssueEvidence 路由**（当前 L120-L130）：同样删除 children 回调，改为 `component={IssueEvidenceScreen}`，保留 `options={{ headerTitle: '问题证据' }}`：
     ```tsx
     <InspectionStack.Screen
       name="IssueEvidence"
       component={IssueEvidenceScreen}
       options={{ headerTitle: '问题证据' }}
     />
     ```
  5. **修正 SubmitReport 占位 subtitle 文案**（当前 L116）：保留 SubmitReport 路由的 children 回调结构不动，仅把 subtitle 从 `'骨架占位 — WI-0017 实现'` 改为 `'骨架占位 — WI-0019 实现'`（消除归属误标）：
     ```tsx
     <InspectionStack.Screen
       name="SubmitReport"
       options={{ headerTitle: '提交日报' }}
     >
       {() => (
         <SimplePlaceholder
           title="提交日报"
           subtitle="骨架占位 — WI-0019 实现"
         />
       )}
     </InspectionStack.Screen>
     ```
  6. **更新文件头 JSDoc 注释**（L1-L16）：在 WI-0016 已写的注释基础上更新，说明 WI-0017 已激活 TaskDetail / InspectionInProgress / IssueEvidence 三个真实 screen，SubmitReport 占位由 WI-0019 替换；保留对 IssueBasket / Profile 由 WI-0019 / WI-0020 替换的说明。
  7. **保留 SimplePlaceholder 组件定义**（L41-L65）：仍被 SubmitReport 路由 + IssueBasket/Profile Tab 占位使用，**禁止删除**。
  8. **保留 RootTabParamList 与 Tab.Navigator 结构**：Tab 路由表（Today / IssueBasket / Profile）与 Tab.Screen 接线完全不变。
- **Why**: WI-0016 已建立 InspectionStack + 4 个 SimplePlaceholder 占位；3 个目标 screen 骨架（261 + 370 + 915 行）已就绪，但 AppNavigator 仍指向占位，导致检查员点击 TaskCard 后只看到占位文字而非真实任务详情。本 TASK 是激活检查中流程屏的**唯一源码改动点**：让 3 个真实 screen 真正挂载到 InspectionStack 路由表，使 TaskDetail → InspectionInProgress → IssueEvidence 的导航链路全部走真实业务骨架。同时修正 SubmitReport 的归属误标，避免给 WI-0019 留歧义。
- **Refs**: DD-1（最小替换式集成方案）, DD-2（SubmitReport 占位 + 文案修正）, REQ-1.1（TaskDetail 替换）, REQ-2.1（InspectionInProgress 替换）, REQ-3.1（IssueEvidence 替换）, REQ-4.1/4.2（SubmitReport 占位保留 + 文案修正）
- **Where**:
  - read_files:
    - `/mnt/1t_back/project/fj1/fj-android/src/navigation/AppNavigator.tsx`（待改目标，221 行）
    - `/mnt/1t_back/project/fj1/fj-android/src/screens/inspection/TaskDetailScreen.tsx`（确认默认导出 + props 类型 L36-L44）
    - `/mnt/1t_back/project/fj1/fj-android/src/screens/inspection/InspectionInProgressScreen.tsx`（确认默认导出 + props 类型 L37-L44）
    - `/mnt/1t_back/project/fj1/fj-android/src/screens/inspection/IssueEvidenceScreen.tsx`（确认默认导出 + props 类型 L75-L91）
    - `/mnt/1t_back/project/fj1/fj-android/src/screens/today/TodayInspectionScreen.tsx`（确认 InspectionStackParamList 类型定义 L46-L52，5 路由名 + 参数）
  - allowed_write_files: [`/mnt/1t_back/project/fj1/fj-android/src/navigation/AppNavigator.tsx`]
  - forbidden_files: [TaskDetailScreen.tsx, InspectionInProgressScreen.tsx, IssueEvidenceScreen.tsx, IssueCreateButton.tsx, TodayInspectionScreen.tsx, TaskCard.tsx, RootNavigator.tsx, AppRoot.tsx, App.tsx, requirements.md, design.md, tasks.md, package.json, 其余所有文件]
- **Constraints**:
  - **不得修改 InspectionStackParamList 类型**：5 路由名（TodayInspection / TaskDetail / InspectionInProgress / SubmitReport / IssueEvidence）严格匹配 TodayInspectionScreen.tsx 已导出的类型；本 TASK 仅 import 复用，不重定义。
  - **不得新增 / 删除路由**：InspectionStack 内 5 个 `<InspectionStack.Screen>` 数量保持为 5；仅替换其中 3 个的 `component` 字段，1 个的 subtitle 字符串。
  - **不得删除 SimplePlaceholder 组件定义**：仍被 SubmitReport 路由 + IssueBasket/Profile Tab 占位使用（事实源 L139-L158 IssueBasketScreen / ProfileScreen 内部调用 SimplePlaceholder）。
  - **3 个目标路由必须删除 children 渲染回调**：React Navigation 不允许 `component` 与 `children` 同时存在；保留 children 会导致 tsc / 运行时错误。
  - **headerTitle 中文文案保持 WI-0016 已固化的字符串**：TaskDetail → "任务详情"，InspectionInProgress → "检查中"，IssueEvidence → "问题证据"，SubmitReport → "提交日报"。本 TASK 不调整这些字符串。
  - **导入路径必须用相对路径**（`'../screens/inspection/XxxScreen'`），不引入 barrel `index.ts`、不用 `@/` alias（项目未配置 path alias）。
  - **不引入新 npm 依赖**；不修改 package.json；不修改 native 层（gradle/manifest）。
  - **文件最终行数**：当前 221 行；新增 3 行 import + JSDoc 注释更新约 +5 行；删除 3 段 children 回调（每段约 6 行 × 3 = -18 行）；净变更约 -10 行；最终预期 ~210~230 行（区间 200~250）。
  - **依赖事实**：WI-0015 已激活 AppRoot.tsx 的 DatabaseProvider / SyncEngineProvider；WI-0016 已激活 InspectionStack；本 TASK 无需改 AppRoot / RootNavigator。
- **Done When**:
  - `grep -c "import TaskDetailScreen" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥1`。
  - `grep -c "import InspectionInProgressScreen" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥1`。
  - `grep -c "import IssueEvidenceScreen" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥1`。
  - `grep -cE "component=\{TaskDetailScreen\}" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥1`。
  - `grep -cE "component=\{InspectionInProgressScreen\}" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥1`。
  - `grep -cE "component=\{IssueEvidenceScreen\}" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥1`。
  - `grep -c "WI-0019 实现" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥1`（SubmitReport 文案已修正）。
  - `grep -c "骨架占位 — WI-0017 实现" fj-android/src/navigation/AppNavigator.tsx` 返回 `0`（原 SubmitReport 误标已清除；TaskDetail/InspectionInProgress/IssueEvidence 三处占位 subtitle 也已随 children 回调删除而消失）。
  - `grep -c "function SimplePlaceholder" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥1`（组件定义保留）。
  - `grep -cE "name=\"TodayInspection\"|name=\"TaskDetail\"|name=\"InspectionInProgress\"|name=\"SubmitReport\"|name=\"IssueEvidence\"" fj-android/src/navigation/AppNavigator.tsx` 返回 `5`（5 路由全注册，数量不变）。
  - `wc -l fj-android/src/navigation/AppNavigator.tsx` 行数落在 `200 ~ 250`。
- **Out of Scope**: 不修改 3 个 screen 内部业务逻辑（骨架已就绪）；不实装 SubmitReportScreen（WI-0019）；不实装 PhotoCapture/PhotoCompressor 原生端口（WI-0018）；不集成 IssueBasket / Profile 真实屏（WI-0019 / WI-0020）；不修改 AppRoot.tsx / RootNavigator.tsx / TodayInspectionScreen.tsx / TaskCard.tsx；tsc 类型检查归 TASK-2；Docker 构建归 TASK-3；不新增 unit/E2E 测试。

- **task_id**: TASK-1
- **depends_on**: []
- **expected_file_changes**: [`fj-android/src/navigation/AppNavigator.tsx`（修改：221 → ~220 行，净变更约 ±10 行）]
- **verification_commands**:
  - `grep -c "import TaskDetailScreen" fj-android/src/navigation/AppNavigator.tsx`（期望 `≥1`）
  - `grep -c "import InspectionInProgressScreen" fj-android/src/navigation/AppNavigator.tsx`（期望 `≥1`）
  - `grep -c "import IssueEvidenceScreen" fj-android/src/navigation/AppNavigator.tsx`（期望 `≥1`）
  - `grep -cE "component=\{TaskDetailScreen\}|component=\{InspectionInProgressScreen\}|component=\{IssueEvidenceScreen\}" fj-android/src/navigation/AppNavigator.tsx`（期望 `3`）
  - `grep -c "WI-0019 实现" fj-android/src/navigation/AppNavigator.tsx`（期望 `≥1`）
  - `grep -c "骨架占位 — WI-0017 实现" fj-android/src/navigation/AppNavigator.tsx`（期望 `0`）
  - `grep -c "function SimplePlaceholder" fj-android/src/navigation/AppNavigator.tsx`（期望 `≥1`）
  - `grep -cE "name=\"TodayInspection\"|name=\"TaskDetail\"|name=\"InspectionInProgress\"|name=\"SubmitReport\"|name=\"IssueEvidence\"" fj-android/src/navigation/AppNavigator.tsx`（期望 `5`）
  - `wc -l fj-android/src/navigation/AppNavigator.tsx`（期望 200 ~ 250）
- **verification_evidence_expected**:
  - { command: "grep import TaskDetailScreen", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep import InspectionInProgressScreen", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep import IssueEvidenceScreen", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep component={XxxScreen}", expected_exit_code: 0, expected_output_pattern: "^3$", evidence_type: "grep_count" }
  - { command: "grep WI-0019 实现", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep WI-0017 实现 absent", expected_exit_code: 0, expected_output_pattern: "^0$", evidence_type: "grep_count" }
  - { command: "grep SimplePlaceholder retained", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep 5 routes", expected_exit_code: 0, expected_output_pattern: "^5$", evidence_type: "grep_count" }
  - { command: "wc -l", expected_exit_code: 0, evidence_type: "line_count" }

---

### TASK-2 TypeScript 类型检查（Docker tsc --noEmit）

**context_block**（executor 必读）：
- **What**: 在 Docker 容器（镜像 `fj-builder:react-native-0.74`）内对 `fj-android` 工程执行 TypeScript 类型检查 `npx tsc --noEmit`（或 package.json 中配置的 typecheck 脚本 `npm run typecheck`），验证 TASK-1 改动后的类型正确性：
  1. 3 个新 import 的默认导出存在（TaskDetailScreen / InspectionInProgressScreen / IssueEvidenceScreen 均 `export default function`）。
  2. 3 个 `<InspectionStack.Screen name="X" component={XxxScreen} />` 的 `name` 字面量与 `InspectionStackParamList` 的 key 严格对齐。
  3. 3 个 `XxxScreen` 的 props 类型 `StackScreenProps<InspectionStackParamList, 'X'>` 与 `component` 期望的 `React.ComponentType<StackScreenProps<InspectionStackParamList, 'X'>>` 兼容（同源 InspectionStackParamList）。
  4. 3 个目标路由不再保留 `children` 渲染回调（与 `component` 互斥）。
  - 本 TASK **不写源码**，仅类型检查 + 证据收集。verification_report / evidence_manifest 的正式写入由 Orchestrator 通过 sf-verifier 完成。
- **Why**: tsc 是类型期"软门"，与 TASK-3 的编译期"硬门"互补。WI-0015 已修复类型系统、WI-0016 已通过 tsc 验证 InspectionStack 结构，TASK-1 新增的 3 个真实 screen 集成需要 tsc 验证不会引入新类型错误（如默认导出缺失、children 与 component 共存、props 类型不匹配）。tsc 通过是 REQ-5.1 的硬性完成条件。
- **Refs**: DD-3, REQ-5.1
- **Where**:
  - read_files: [TASK-1 产出的 AppNavigator.tsx + 3 个 screen + TodayInspectionScreen.tsx + 全仓 TS 源（只读）]
  - allowed_write_files: []（本 TASK 不修改源码；evidence 收集产物由 Orchestrator/sf-verifier 写入 governance 路径）
  - forbidden_files: [所有源码文件, `.specforge/work-items/` 下所有文件（governance 产物由 sf-verifier 写）]
- **Constraints**（⚠️ Docker 关键注意事项）:
  - **必须用分离模式**：`docker run -d`（后台运行）+ 日志轮询（`docker logs -f <cid>` 或定期 `docker logs --tail`），不得用 `docker run` 前台阻塞（构建耗时长，易超时）。
  - **挂载优先用 `--mount type=bind`**：避免 `-v host:container` 中的 `:` 被 Write Guard 误判为危险模式。
  - **Gradle 缓存隔离**：使用项目约定的 gradle cache volume，避免 stale lock。
  - **镜像**：`fj-builder:react-native-0.74`（项目约定）。
  - **Write Guard 授权**：WI-0014 / WI-0015 / WI-0016 已安装的 `write_guard_authorization` 可能随前序 WI 关闭失效。若 Docker 命令触发 hard_stop，需通过 `sf_hard_stop_resolve` 重新安装 work_item 级授权（`authorization_command_family=docker_run`，`authorization_image=fj-builder:react-native-0.74`，`authorization_container_targets=["/build"]`，`authorization_host_path_prefix=/mnt/1t_back/project/fj1/fj-android`，`authorization_expires_when=work_item_closed`），并附用户确认原话。
  - **参考命令模板**（与 TASK-3 可复用同一容器或独立）：
    ```bash
    docker run -d --name fj-tsc-wi17 \
      --mount type=bind,source=/mnt/1t_back/project/fj1/fj-android,destination=/build \
      --mount type=volume,source=fj1-gradle-v2,destination=/root/.gradle \
      -w /build \
      fj-builder:react-native-0.74 \
      bash -c "npx tsc --noEmit 2>&1 | tee /build/tsc-wi17.log; echo EXIT_CODE=$? >> /build/tsc-wi17.log"
    ```
  - **失败处理**：tsc 报错时不得用 `any` / `@ts-ignore` / `as unknown as` 绕过（REQ-5.3）；回退到 TASK-1 修正导入路径 / 清理 children 回调 / 对齐 props 类型。
  - 退出码必须为 `0`（无类型错误）。
  - 证据收集：tsc stdout/stderr 完整日志 + 退出码，供 sf-verifier 写入 evidence_manifest。
- **Done When**:
  - `npx tsc --noEmit` 退出码 `0`。
  - tsc 输出无 error 行：`grep -c "error TS" fj-android/tsc-wi17.log` 返回 `0`。
  - 证据日志 `fj-android/tsc-wi17.log` 已生成（包含 `EXIT_CODE=0` 标记）。
- **Out of Scope**: 不修改源码（回退 TASK-1）；不写 governance 产物（sf-verifier 负责）；不做 Release 构建；不做单测；可与 TASK-3 共享 Docker 容器或独立。

- **task_id**: TASK-2
- **depends_on**: [TASK-1]
- **expected_file_changes**: []
- **verification_commands**:
  - Docker 内 `npx tsc --noEmit`（期望退出码 `0`，证据保存在 `fj-android/tsc-wi17.log`）
  - `grep -c "error TS" fj-android/tsc-wi17.log`（期望 `0`）
  - `grep -c "EXIT_CODE=0" fj-android/tsc-wi17.log`（期望 `≥1`）
- **verification_evidence_expected**:
  - { command: "npx tsc --noEmit", expected_exit_code: 0, evidence_type: "tsc_output" }
  - { command: "grep error TS", expected_exit_code: 0, expected_output_pattern: "^0$", evidence_type: "tsc_log_grep" }
  - { command: "grep EXIT_CODE=0", expected_exit_code: 0, evidence_type: "tsc_log_marker" }

---

### TASK-3 Docker assembleDebug + APK 验证

**context_block**（executor 必读）：
- **What**: 在 Docker 构建环境（镜像 `fj-builder:react-native-0.74`）内执行 Android Debug 构建 `./gradlew assembleDebug`，验证 TASK-1 改动后能产出可用 APK：
  1. 构建命令退出码 `0`（`BUILD SUCCESSFUL`）。
  2. 产出 `app-debug.apk`，文件大小 > 1 MiB（`min_apk_size_bytes=1048576`）。
  3. 构建日志含 `BUILD SUCCESSFUL` 字样。
  - 本 TASK **不改源码**，仅构建验证。如构建失败需修复，回退到 TASK-1（TASK-1 不引入新 native 依赖，预期不会触发 native 问题）。
- **Why**: TASK-1 修改了 AppNavigator.tsx（纯 TS/JSX 改动，无 native），Metro bundler 会重新打包该文件 + 3 个新 import 的 screen（共 ~1546 行骨架代码）。assembleDebug 是"硬门"，验证：
  - TS 编译通过（与 TASK-2 互补，但 assembleDebug 走 Metro + Android Gradle 双管道）。
  - 3 个新导入的 screen 文件路径在 Metro bundle 内可解析（如 `'../screens/inspection/TaskDetailScreen'` 真实存在）。
  - APK 文件可正常产出（intake 关键风险）。
  REQ-5.2 / REQ-5.3 的硬性完成条件。
- **Refs**: DD-3, REQ-5.2, REQ-5.3
- **Where**:
  - read_files: [TASK-1 产出的 AppNavigator.tsx 及全仓源码（只读）]
  - allowed_write_files: []（本 TASK 不修改源码；构建产物 app-debug.apk 在 build/ 目录，属构建输出非源码改动）
  - forbidden_files: [所有源码文件, `.specforge/` 下所有文件]
- **Constraints**（⚠️ Docker 构建关键注意事项）:
  - **必须用分离模式**：`docker run -d`（后台运行）+ 日志轮询，不得用 `docker run` 前台阻塞（assembleDebug 耗时 5~15 分钟）。
  - **挂载**：`--mount type=bind,source=/mnt/1t_back/project/fj1/fj-android,destination=/build` + gradle cache volume。
  - **构建命令**（参考 WI-0016 TASK-3 已验证模板）：
    ```bash
    docker run -d --name fj-build-wi17 \
      --mount type=bind,source=/mnt/1t_back/project/fj1/fj-android,destination=/build \
      --mount type=volume,source=fj1-gradle-v2,destination=/root/.gradle \
      -w /build/android \
      fj-builder:react-native-0.74 \
      bash -c "/build/android/gradlew -p /build/android assembleDebug --no-daemon -x lint --project-cache-dir=/tmp/gradle-project-cache 2>&1 | tee /build/build-wi17.log; echo EXIT_CODE=$? >> /build/build-wi17.log"
    ```
  - **Write Guard 授权**：同 TASK-2，若 Docker 命令触发 hard_stop，通过 `sf_hard_stop_resolve` 安装 work_item 级授权（`authorization_command_family=docker_run`，`authorization_image=fj-builder:react-native-0.74`，`authorization_container_targets=["/build", "/build/android"]`，`authorization_host_path_prefix=/mnt/1t_back/project/fj1/fj-android`，`authorization_expires_when=work_item_closed`），并附用户确认原话。
  - **失败处理分支**（DD-3）：
    - Metro bundle 错误（如 `Module not found`）→ 检查 AppNavigator.tsx 的 3 个 import 路径（回退 TASK-1）。
    - 3 个 screen 默认导出缺失 → 事实源已确认均为 `export default function`，多为路径拼写错。
    - 其余 native 编译错误 → 多半与 TASK-1 无关（TASK-1 无 native 改动），但仍需排查是否 WI-0016 引入的回归。
  - APK 输出路径：`fj-android/android/app/build/outputs/apk/debug/app-debug.apk`。
- **Done When**:
  - 构建命令退出码 `0`（`BUILD SUCCESSFUL`）。
  - `app-debug.apk` 存在：`test -f fj-android/android/app/build/outputs/apk/debug/app-debug.apk`。
  - APK 大小 > 1 MiB：`stat -c %s fj-android/android/app/build/outputs/apk/debug/app-debug.apk` > 1048576。
  - 构建日志含 `BUILD SUCCESSFUL`：`grep -c "BUILD SUCCESSFUL" fj-android/build-wi17.log` ≥ 1。
  - 构建日志含 `EXIT_CODE=0` 标记。
- **Out of Scope**: 不做 Release 构建（DD-3 仅 Debug）；不做 E2E 运行时验证（运行时人工验证 5 步属可选，留给手动测试）；不修改源码（如需修复回退 TASK-1）；tsc 归 TASK-2；不做单测。

- **task_id**: TASK-3
- **depends_on**: [TASK-1]
- **expected_file_changes**: []（构建产物 app-debug.apk 非源码）
- **verification_commands**:
  - Docker 内 `assembleDebug`（期望退出码 `0`，证据 `fj-android/build-wi17.log`）
  - `test -f fj-android/android/app/build/outputs/apk/debug/app-debug.apk && echo OK`（期望 stdout `OK`）
  - `stat -c %s fj-android/android/app/build/outputs/apk/debug/app-debug.apk`（期望 > 1048576）
  - `grep -c "BUILD SUCCESSFUL" fj-android/build-wi17.log`（期望 `≥1`）
  - `grep -c "EXIT_CODE=0" fj-android/build-wi17.log`（期望 `≥1`）
- **verification_evidence_expected**:
  - { command: "docker assembleDebug", expected_exit_code: 0, evidence_type: "build_log" }
  - { command: "test -f app-debug.apk", expected_exit_code: 0, expected_output_pattern: "OK", evidence_type: "file_existence" }
  - { command: "stat apk size", expected_exit_code: 0, evidence_type: "file_size" }
  - { command: "grep BUILD SUCCESSFUL", expected_exit_code: 0, evidence_type: "build_log_grep" }
  - { command: "grep EXIT_CODE=0", expected_exit_code: 0, evidence_type: "build_log_marker" }

---

## 3. 自检（Self-Check）

| # | 自问自答 | 答案 |
|---|---------|------|
| 1 | 每个 DD 都有对应的 task 覆盖吗？ | ✅ DD-1/2 → TASK-1；DD-3 → TASK-2+3 |
| 2 | 每个 REQ 都有 task 覆盖吗？ | ✅ REQ-1/2/3/4 → TASK-1；REQ-5 → TASK-2+3 |
| 3 | 每个 task 的 context_block 是否充分（executor 不需回查 design.md）？ | ✅ 每个 task 含 What/Why/Refs/Where(read+allowed_write+forbidden)/Constraints/Done When/Out of Scope；TASK-1 含 8 步具体改造指令 + 完整代码片段 + import 路径 + 路由清单 |
| 4 | verification_commands 是否真能机器跑（返回退出码）？ | ✅ 全部用 grep/test/wc/docker/tsc，均可返回 0/非0；TASK-2/3 的 Docker 命令通过日志文件 EXIT_CODE 标记判定 |
| 5 | 并行批次内的 task 是否互相独立（文件不重叠）？ | ✅ Batch 2 内 TASK-2 / TASK-3 的 allowed_write_files 均为 `[]`，互不写文件，可并行；TASK-1 单独 Batch 1 |
| 6 | 有没有共享代码需要先建独立 task？ | ✅ 无需；InspectionStackParamList 已在 TodayInspectionScreen.tsx 导出（WI-0016 前置就绪），3 个 screen 已 `export default`，TASK-1 直接 import 复用，不重定义 |
| 7 | allowed_write_files 是否具体（无通配符/目录）？ | ✅ TASK-1 为单一具体文件绝对路径；TASK-2/3 为 `[]`（验证型 task） |
| 8 | 并行 task 的 allowed_write_files 是否不重叠？ | ✅ TASK-2/3 均 `[]`，无重叠 |
| 9 | forbidden_files 是否包含 requirements/design/tasks？ | ✅ TASK-1 forbidden_files 显式排除 requirements.md/design.md/tasks.md 及其他 task 写文件；TASK-2/3 排除所有源码 + governance 路径 |
| 10 | done_when 每条是否可通过 verification_commands 验证？ | ✅ 每条 done_when 对应至少一条 grep/test/wc 命令 |
| 11 | Docker TASK 是否标注分离模式/挂载/授权约束？ | ✅ TASK-2/3 的 Constraints 含 `docker run -d` / `--mount type=bind` / Write Guard 授权失效处理 / project-cache-dir / 完整命令模板 |
| 12 | 是否避免 T6 大小超限（单 task >200 行源码改动）？ | ✅ TASK-1 目标 ~220 行（净变更 ±10 行，仅替换 3 个 component + 1 处 subtitle + import + JSDoc，集中在 AppNavigator.tsx 单一文件）；TASK-2/3 无源码改动 |

---

## 4. 完成报告

```json
{
  "status": "success",
  "files_changed": [
    ".specforge/work-items/WI-0017/candidates/tasks.md",
    ".specforge/work-items/WI-0017/trace_delta.md"
  ],
  "structure": {
    "tasks_count": 3,
    "parallel_batches": 2,
    "batch1_source": ["TASK-1"],
    "batch2_verification_parallel": ["TASK-2", "TASK-3"],
    "all_tasks_have_context_block": true,
    "all_tasks_have_verification": true
  },
  "trace_delta": {
    "generated": true,
    "requirements_covered": true,
    "design_decisions_covered": true,
    "tasks_covered": true,
    "files_covered": true
  },
  "self_check": { "passed": [1,2,3,4,5,6,7,8,9,10,11,12], "failed": [] },
  "out_of_scope_observations": [
    "TaskDetailScreen.tsx (261) / InspectionInProgressScreen.tsx (370) / IssueEvidenceScreen.tsx (915) / IssueCreateButton.tsx (69) 均为 WI-0017 前置就绪骨架，本 WI 不修改它们，仅由 TASK-1 在 AppNavigator 层激活集成",
    "SubmitReportScreen 真实实装留给 WI-0019（本 WI 仅修正 SubmitReport 占位的 subtitle 文案归属误标）",
    "PhotoCapture / PhotoCompressor 原生端口注入留给 WI-0018（本 WI 仅激活 IssueEvidenceScreen 骨架，端口走骨架内置降级）"
  ]
}
```

---

**文档结束**。本 Candidate 待 Gate（required_files / schema / trace / spec_consistency / candidate_manifest）通过 + User Decision 后，由 Merge Runner 写入正式 tasks 真相源。
