# Tasks Candidate — WI-0016: 今日检查屏幕实装（TodayInspectionScreen 激活 + 导航集成）

> **Work Item**: WI-0016
> **Workflow Type**: feature_spec
> **Workflow Path**: requirement_change_path
> **Base Spec Version**: PSV-0001
> **Date**: 2026-07-05
> **标准依据**: specforge_final_fused_standard_v1_1_patch1_zh.md (§8.2 Candidate, §11 Task Contract, §12.7 Changed Files Audit, §13.3 Verification)
> **作者 Agent**: sf-task-planner
> **Candidate Path**: .specforge/work-items/WI-0016/candidates/tasks.md
> **上游输入**: intake.md (32 行), impact_analysis.md (17 行), 现有源码骨架（AppNavigator 139 / TodayInspectionScreen 218 / TaskCard 141）
> **注**: requirements.candidate.md / design.candidate.md 由 sf-requirements / sf-design 并行生成；本文档基于 intake + impact_analysis + 现有代码事实先行规划，REQ/DD 编号为推断占位，正式 REQ/DD 由并行 Agent 落定后由 Orchestrator 对齐。

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
| TASK-1 | AppNavigator 集成（嵌套 Stack + TodayInspectionScreen 激活） | fj-android/src/navigation/AppNavigator.tsx | DD-1, DD-2, DD-3 | REQ-1, REQ-2, REQ-3 | — |
| TASK-2 | TypeScript 类型检查（Docker tsc --noEmit） | (无源码改动，类型验证) | DD-4 | REQ-3, REQ-4 | TASK-1 |
| TASK-3 | Docker assembleDebug + APK 验证 | (无源码改动，构建验证) | DD-4 | REQ-4 | TASK-1 |

> 注：TodayInspectionScreen.tsx / TaskCard.tsx 已是 WI-0016 前置就绪的骨架（218 / 141 行），**本 WI 不修改它们**；本 WI 的唯一源码改动点为 AppNavigator.tsx 的"激活集成"层。

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

- `.specforge/config/prod-environment.md`：当前为 TODO 占位（未填充）。verification_commands 使用跨平台标准工具（grep / test / wc / node）与项目自身构建命令（Docker 内 `./gradlew assembleDebug` / `npx tsc --noEmit`），不依赖第三方 CLI（rg / jq / fd）。
- `.specforge/config/project-rules.md`：当前为 TODO 占位。task 实现遵循相邻文件风格（AppNavigator 现有 JSDoc 注释风格、`React.ReactElement` 返回类型、`StyleSheet.create` 模式），不引入新依赖（`@react-navigation/stack` ^6.3.29 已在 package.json L18 安装）。

---

## 2. 任务详细合同

### TASK-1 AppNavigator 集成（嵌套 Stack + TodayInspectionScreen 激活）

**context_block**（executor 必读）：
- **What**: 对 `fj-android/src/navigation/AppNavigator.tsx`（当前 139 行）执行激活集成改造，目标 ~250 行。具体操作：
  1. **新增 import**：
     - `import { createStackNavigator } from '@react-navigation/stack';`（来自 `@react-navigation/stack` ^6.3.29，已安装，与 TaskCard.tsx L18 的 `StackNavigationProp` 同源）
     - `import TodayInspectionScreen from '../screens/today/TodayInspectionScreen';`
     - `import type { InspectionStackParamList } from '../screens/today/TodayInspectionScreen';`（5 路由类型已在该文件 L46-52 导出）
  2. **新建 `SimplePlaceholder` 通用占位组件**：取代现有 `PlaceholderScreen`，签名 `function SimplePlaceholder({ title, subtitle }: { title: string; subtitle?: string }): React.ReactElement`。用于：
     - IssueBasket / Profile Tab（沿用现有文案）
     - Stack 内未实装 screen（TaskDetail / InspectionInProgress / SubmitReport / IssueEvidence）
  3. **新建 `InspectionStack` 组件**：`const Stack = createStackNavigator<InspectionStackParamList>();`，注册 5 个路由：
     - `TodayInspection` → `TodayInspectionScreen`（options: `title: '今日检查'`, `headerShown: false` —— Today Tab 已有 header，避免双 header）
     - `TaskDetail` → `() => <SimplePlaceholder title="任务详情" subtitle="骨架占位 — WI-0017 实现" />`（options: `title: '任务详情'`）
     - `InspectionInProgress` → 同样 SimplePlaceholder（subtitle: `'WI-0017'`）
     - `SubmitReport` → 同样 SimplePlaceholder（subtitle: `'WI-0017'`）
     - `IssueEvidence` → 同样 SimplePlaceholder（subtitle: `'WI-0018'`）
  4. **修改 Tab.Navigator 的 Today Tab**：
     - **删除** 现有 `TodayScreen` 函数（51-58 行的 placeholder 包装器）
     - 将 `name="Today"` 的 `component={TodayScreen}` 改为 `component={InspectionStack}`
     - Today Tab 的 `options.title` 保持 `'今日检查'`
  5. **保留 IssueBasket / Profile**：仍指向 `SimplePlaceholder`（沿用现有文案），不改路由结构。
  6. **保留** `RootTabParamList` 类型（Tab 路由表不变：Today / IssueBasket / Profile）。
  7. **更新文件头 JSDoc**：注明 WI-0016 已激活 TodayInspectionScreen + 嵌套 Stack；未实装 screen 占位由 WI-0017/0018 替换。
- **Why**: TodayInspectionScreen（218 行骨架）和 TaskCard（141 行骨架）已就绪，但 AppNavigator 当前 Today Tab 指向 placeholder，且**无 Stack Navigator** → TaskCard.tsx L41 的 `navigation.navigate('TaskDetail', { taskId })` 会在运行时崩溃（路由未注册）。本 TASK 是激活今日检查屏的**唯一源码改动点**：让 TodayInspectionScreen 真正渲染 + 为 TaskCard 提供可用的 Stack 上下文。WI-0015 已激活 DatabaseProvider/SyncEngineInitializer，故 TodayInspectionScreen 内 `useDatabase()` / `useSyncEngine()` 在运行时已可用。
- **Refs**: DD-1（嵌套 Stack 架构）, DD-2（占位策略）, DD-3（Tab 边界）, REQ-1（TodayInspectionScreen 集成）, REQ-2（TaskCard 导航契约）, REQ-3（Tab 边界保留）
- **Where**:
  - read_files:
    - `/mnt/1t_back/project/fj1/fj-android/src/navigation/AppNavigator.tsx`（待改目标，139 行）
    - `/mnt/1t_back/project/fj1/fj-android/src/screens/today/TodayInspectionScreen.tsx`（默认导出 + InspectionStackParamList 类型 L46-52）
    - `/mnt/1t_back/project/fj1/fj-android/src/screens/today/TaskCard.tsx`（确认 StackNavigationProp 用法 L18, L28, L41）
    - `/mnt/1t_back/project/fj1/fj-android/src/navigation/RootNavigator.tsx`（确认 AppNavigator 被引用 L22, L54）
  - allowed_write_files: [`/mnt/1t_back/project/fj1/fj-android/src/navigation/AppNavigator.tsx`]
  - forbidden_files: [TodayInspectionScreen.tsx, TaskCard.tsx, RootNavigator.tsx, AppRoot.tsx, App.tsx, requirements.md, design.md, tasks.md, package.json, 其余所有文件]
- **Constraints**:
  - 使用 `@react-navigation/stack` 的 `createStackNavigator`（**非** `@react-navigation/native-stack`）—— 与 TaskCard.tsx L18 的 `StackNavigationProp` import 同源，确保泛型契约一致。
  - `InspectionStackParamList` 类型**必须**从 `TodayInspectionScreen.tsx` import，**不得**在本文件重定义（避免双源真相，REQ-2.AC3）。
  - `TodayInspection` 路由的 header 设置为 `headerShown: false`（避免 BottomTab header + Stack header 双 header）。
  - 5 个 Stack 路由名严格匹配 `InspectionStackParamList` 的 key：`TodayInspection` / `TaskDetail` / `InspectionInProgress` / `SubmitReport` / `IssueEvidence`（TS 泛型会强制校验，但 executor 需主动对齐）。
  - SimplePlaceholder 用于 4 个占位 Stack screen + 2 个占位 Tab（IssueBasket / Profile），**禁止**为未实装 screen 创建独立文件（DD-2 占位策略：内联 + 注释指向后续 WI）。
  - 删除旧 `TodayScreen` 函数（51-58 行）后，**确认**无其他引用（grep 全仓 `TodayScreen` 仅在 AppNavigator 内）。
  - IssueBasket / Profile Tab 的文案保持现有 JSDoc 注释中的中文（"问题篮子" / "我的"）。
  - 不引入新 npm 依赖；不修改 package.json；不修改 native 层（gradle/manifest）。
  - 文件最终行数目标 ~250 行（上限 300，下限 200；超限需审视是否内联过深）。
  - **依赖事实**：WI-0015 已激活 AppRoot.tsx → `<DatabaseProvider><SyncEngineInitializer><AppInner><RootNavigator /><AppNavigator />`，TodayInspectionScreen 内 `useDatabase()` 在运行时返回非 null；本 TASK 无需改 AppRoot.tsx。
- **Done When**:
  - `grep -c "createStackNavigator" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥1`。
  - `grep -c "import TodayInspectionScreen" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥1`。
  - `grep -c "InspectionStackParamList" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥1`（type import + createStackNavigator 泛型）。
  - `grep -c "InspectionStack" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥2`（组件定义 + Tab component 引用）。
  - `grep -cE "name=\"TodayInspection\"|name=\"TaskDetail\"|name=\"InspectionInProgress\"|name=\"SubmitReport\"|name=\"IssueEvidence\"" fj-android/src/navigation/AppNavigator.tsx` 返回 `5`（5 路由全注册）。
  - `grep -c "component={InspectionStack}" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥1`（Today Tab 切换）。
  - `grep -c "SimplePlaceholder" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥6`（1 定义 + 4 Stack 占位 + 2 Tab 占位，或合理等价分布）。
  - 旧 TodayScreen 函数已删除：`grep -c "function TodayScreen" fj-android/src/navigation/AppNavigator.tsx` 返回 `0`。
  - `wc -l fj-android/src/navigation/AppNavigator.tsx` 行数落在 `200 ~ 300`。
  - RootNavigator 引用未断：`grep -c "AppNavigator" fj-android/src/navigation/RootNavigator.tsx` 仍 `≥1`（被动验证，确认未误删 default export）。
- **Out of Scope**: 不修改 TodayInspectionScreen.tsx / TaskCard.tsx（已是就绪骨架）；不实装 TaskDetail / InspectionInProgress / SubmitReport / IssueEvidence 真实 screen（WI-0017 / WI-0018）；不集成 IssueBasket / Profile 真实屏（WI-0019 / WI-0020）；不修改 AppRoot.tsx / RootNavigator.tsx；tsc 类型检查归 TASK-2；Docker 构建归 TASK-3。

- **task_id**: TASK-1
- **depends_on**: []
- **expected_file_changes**: [`fj-android/src/navigation/AppNavigator.tsx`（修改：139 → ~250 行）]
- **verification_commands**:
  - `grep -c "createStackNavigator" fj-android/src/navigation/AppNavigator.tsx`（期望 `≥1`）
  - `grep -cE "import TodayInspectionScreen|InspectionStackParamList|InspectionStack|SimplePlaceholder" fj-android/src/navigation/AppNavigator.tsx`（期望 `≥4`）
  - `grep -cE "name=\"TodayInspection\"|name=\"TaskDetail\"|name=\"InspectionInProgress\"|name=\"SubmitReport\"|name=\"IssueEvidence\"" fj-android/src/navigation/AppNavigator.tsx`（期望 `5`）
  - `grep -c "component={InspectionStack}" fj-android/src/navigation/AppNavigator.tsx`（期望 `≥1`）
  - `grep -c "function TodayScreen" fj-android/src/navigation/AppNavigator.tsx`（期望 `0`，旧 placeholder 已删）
  - `wc -l fj-android/src/navigation/AppNavigator.tsx`（期望 200 ~ 300）
- **verification_evidence_expected**:
  - { command: "grep createStackNavigator", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep imports+symbols", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep 5 routes", expected_exit_code: 0, expected_output_pattern: "^5$", evidence_type: "grep_count" }
  - { command: "grep component={InspectionStack}", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep old TodayScreen absent", expected_exit_code: 0, expected_output_pattern: "^0$", evidence_type: "grep_count" }
  - { command: "wc -l", expected_exit_code: 0, evidence_type: "line_count" }

---

### TASK-2 TypeScript 类型检查（Docker tsc --noEmit）

**context_block**（executor 必读）：
- **What**: 在 Docker 容器（镜像 `fj-builder:react-native-0.74`）内对 `fj-android` 工程执行 TypeScript 类型检查 `npx tsc --noEmit`（或 package.json 中配置的 typecheck 脚本 `npm run typecheck`），验证 TASK-1 改动后的类型正确性：
  1. `createStackNavigator<InspectionStackParamList>()` 的路由名与 `InspectionStackParamList` key 严格对齐。
  2. `TodayInspection` 路由的 component 类型与 `InspectionStackParamList['TodayInspection']` 一致（undefined 参数）。
  3. SimplePlaceholder 内联回调的返回类型为 `React.ReactElement`。
  4. TaskCard.tsx L28 的 `StackNavigationProp<InspectionStackParamList, 'TaskDetail'>` 在 Stack 上下文内可用（运行时由 TASK-3 间接验证）。
  - 本 TASK **不写源码**，仅类型检查 + 证据收集。verification_report / evidence_manifest 的正式写入由 Orchestrator 通过 sf-verifier 完成。
- **Why**: tsc 是类型期"软门"，与 TASK-3 的编译期"硬门"互补。WI-0015 已修复类型系统（database.ts 简化、SyncDatabaseAdapter 类型对齐、AppRoot 组件树类型），TASK-1 新增的 Stack 泛型需要 tsc 验证不会引入新类型错误（如路由名拼写错、Screen component 签名不匹配）。tsc 通过是 REQ-3.AC1 的硬性完成条件。
- **Refs**: DD-4, REQ-3（AC1/AC2）, REQ-4（AC3）
- **Where**:
  - read_files: [TASK-1 产出的 AppNavigator.tsx + TodayInspectionScreen.tsx + TaskCard.tsx + 全仓 TS 源（只读）]
  - allowed_write_files: []（本 TASK 不修改源码；evidence 收集产物由 Orchestrator/sf-verifier 写入 governance 路径）
  - forbidden_files: [所有源码文件, `.specforge/work-items/` 下所有文件（governance 产物由 sf-verifier 写）]
- **Constraints**（⚠️ Docker 关键注意事项）:
  - **必须用分离模式**：`docker run -d`（后台运行）+ 日志轮询（`docker logs -f <cid>` 或定期 `docker logs --tail`），不得用 `docker run` 前台阻塞（构建耗时长，易超时）。
  - **挂载优先用 `--mount type=bind`**：避免 `-v host:container` 中的 `:` 被 Write Guard 误判为危险模式。
  - **Gradle 缓存隔离**：使用项目约定的 gradle cache volume，避免 stale lock。
  - **镜像**：`fj-builder:react-native-0.74`（项目约定）。
  - **Write Guard 授权**：WI-0014 已安装的 `write_guard_authorization` 可能随 WI-0014 关闭失效。若 Docker 命令触发 hard_stop，需通过 `sf_hard_stop_resolve` 重新安装 work_item 级授权（`authorization_command_family=docker_run`，`authorization_image=fj-builder:react-native-0.74`，`authorization_container_targets=["/build"]`，`authorization_expires_when=work_item_closed`），并附用户确认原话。
  - **参考命令模板**（与 TASK-3 可复用同一容器或独立）：
    ```bash
    docker run -d --name fj-tsc-wi16 \
      --mount type=bind,source=/mnt/1t_back/project/fj1/fj-android,destination=/build \
      --mount type=volume,source=fj1-gradle-v2,destination=/root/.gradle \
      -w /build \
      fj-builder:react-native-0.74 \
      bash -c "npx tsc --noEmit 2>&1 | tee /build/tsc-wi16.log; echo EXIT_CODE=$? >> /build/tsc-wi16.log"
    ```
  - **失败处理**：tsc 报错时不得用 `any` / `@ts-ignore` / `as unknown as` 绕过（REQ-3.AC2，与 WI-0015 REQ-4.AC9 同源纪律）；回退到 TASK-1 修复类型对齐。
  - 退出码必须为 `0`（无类型错误）。
  - 证据收集：tsc stdout/stderr 完整日志 + 退出码，供 sf-verifier 写入 evidence_manifest。
- **Done When**:
  - `npx tsc --noEmit` 退出码 `0`。
  - tsc 输出无 error 行：`grep -c "error TS" fj-android/tsc-wi16.log` 返回 `0`。
  - 证据日志 `fj-android/tsc-wi16.log` 已生成（包含 `EXIT_CODE=0` 标记）。
- **Out of Scope**: 不修改源码（回退 TASK-1）；不写 governance 产物（sf-verifier 负责）；不做 Release 构建；不做单测；可与 TASK-3 共享 Docker 容器或独立。

- **task_id**: TASK-2
- **depends_on**: [TASK-1]
- **expected_file_changes**: []
- **verification_commands**:
  - Docker 内 `npx tsc --noEmit`（期望退出码 `0`，证据保存在 `fj-android/tsc-wi16.log`）
  - `grep -c "error TS" fj-android/tsc-wi16.log`（期望 `0`）
  - `grep -c "EXIT_CODE=0" fj-android/tsc-wi16.log`（期望 `≥1`）
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
  - 本 TASK **不改源码**，仅构建验证。如构建失败需修复，回退到 TASK-1（或评估是否有 native 模块缺失，但 TASK-1 不引入新 native 依赖，预期不会触发 native 问题）。
- **Why**: TASK-1 修改了 AppNavigator.tsx（纯 TS/JSX 改动，无 native），Metro bundler 会重新打包该文件。assembleDebug 是"硬门"，验证：
  - TS 编译通过（与 TASK-2 互补，但 assembleDebug 走 Metro + Android Gradle 双管道）。
  - 未引入运行时崩溃的 import 路径错误（如 `@react-navigation/stack` 在 bundle 内可解析）。
  - APK 文件可正常产出（intake 关键风险 6）。
  REQ-4.AC1/AC2 的硬性完成条件。
- **Refs**: DD-4, REQ-4（AC1/AC2）, REQ-3（AC3 间接：编译期再次校验类型）
- **Where**:
  - read_files: [TASK-1 产出的 AppNavigator.tsx 及全仓源码（只读）]
  - allowed_write_files: []（本 TASK 不修改源码；构建产物 app-debug.apk 在 build/ 目录，属构建输出非源码改动）
  - forbidden_files: [所有源码文件, `.specforge/` 下所有文件]
- **Constraints**（⚠️ Docker 构建关键注意事项）:
  - **必须用分离模式**：`docker run -d`（后台运行）+ 日志轮询，不得用 `docker run` 前台阻塞（assembleDebug 耗时 5~15 分钟）。
  - **挂载**：`--mount type=bind,source=/mnt/1t_back/project/fj1/fj-android,destination=/build` + gradle cache volume。
  - **构建命令**（参考用户提供的模板 + WI-0015 TASK-7 经验）：
    ```bash
    docker run -d --name fj-build-wi16 \
      --mount type=bind,source=/mnt/1t_back/project/fj1/fj-android,destination=/build \
      --mount type=volume,source=fj1-gradle-v2,destination=/root/.gradle \
      -w /build/android \
      fj-builder:react-native-0.74 \
      bash -c "/build/android/gradlew -p /build/android assembleDebug --no-daemon -x lint --project-cache-dir=/tmp/gradle-project-cache 2>&1 | tee /build/build-wi16.log; echo EXIT_CODE=$? >> /build/build-wi16.log"
    ```
  - **Write Guard 授权**：同 TASK-2，若 Docker 命令触发 hard_stop，通过 `sf_hard_stop_resolve` 安装 work_item 级授权（`authorization_command_family=docker_run`，`authorization_image=fj-builder:react-native-0.74`，`authorization_container_targets=["/build", "/build/android"]`，`authorization_host_path_prefix=/mnt/1t_back/project/fj1/fj-android`，`authorization_expires_when=work_item_closed`），并附用户确认原话。
  - **失败处理分支**（DD-4）：
    - Metro bundle 错误（如 `Module not found`）→ 检查 AppNavigator.tsx 的 import 路径（回退 TASK-1）。
    - `@react-navigation/stack` 解析失败 → 检查 package.json L18 是否仍为 `^6.3.29`，确认 `node_modules` 已安装（容器内可 `ls node_modules/@react-navigation/stack`）。
    - 其余 native 编译错误 → 多半与 TASK-1 无关（TASK-1 无 native 改动），但仍需排查是否 WI-0015 引入的回归。
  - APK 输出路径：`fj-android/android/app/build/outputs/apk/debug/app-debug.apk`。
- **Done When**:
  - 构建命令退出码 `0`（`BUILD SUCCESSFUL`）。
  - `app-debug.apk` 存在：`test -f fj-android/android/app/build/outputs/apk/debug/app-debug.apk`。
  - APK 大小 > 1 MiB：`stat -c %s fj-android/android/app/build/outputs/apk/debug/app-debug.apk` > 1048576。
  - 构建日志含 `BUILD SUCCESSFUL`：`grep -c "BUILD SUCCESSFUL" fj-android/build-wi16.log` ≥ 1。
  - 构建日志含 `EXIT_CODE=0` 标记。
- **Out of Scope**: 不做 Release 构建（DD-4 仅 Debug）；不做 E2E 运行时验证（REQ-4.AC4 可选，留给手动测试或后续 WI）；不修改源码（如需修复回退 TASK-1）；tsc 归 TASK-2；不做单测。

- **task_id**: TASK-3
- **depends_on**: [TASK-1]
- **expected_file_changes**: []（构建产物 app-debug.apk 非源码）
- **verification_commands**:
  - Docker 内 `assembleDebug`（期望退出码 `0`，证据 `fj-android/build-wi16.log`）
  - `test -f fj-android/android/app/build/outputs/apk/debug/app-debug.apk && echo OK`（期望 stdout `OK`）
  - `stat -c %s fj-android/android/app/build/outputs/apk/debug/app-debug.apk`（期望 > 1048576）
  - `grep -c "BUILD SUCCESSFUL" fj-android/build-wi16.log`（期望 `≥1`）
  - `grep -c "EXIT_CODE=0" fj-android/build-wi16.log`（期望 `≥1`）
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
| 1 | 每个 DD 都有对应的 task 覆盖吗？ | ✅ DD-1/2/3 → TASK-1；DD-4 → TASK-2+3 |
| 2 | 每个 REQ 都有 task 覆盖吗？ | ✅ REQ-1/2/3 → TASK-1；REQ-3 → TASK-1+2；REQ-4 → TASK-2+3 |
| 3 | 每个 task 的 context_block 是否充分（executor 不需回查 design.md）？ | ✅ 每个 task 含 What/Why/Refs/Where(read+allowed_write+forbidden)/Constraints/Done When/Out of Scope；TASK-1 含 7 步具体改造指令 + import 代码片段 + 路由清单 |
| 4 | verification_commands 是否真能机器跑（返回退出码）？ | ✅ 全部用 grep/test/wc/docker/tsc，均可返回 0/非0；TASK-2/3 的 Docker 命令通过日志文件 EXIT_CODE 标记判定 |
| 5 | 并行批次内的 task 是否互相独立（文件不重叠）？ | ✅ Batch 2 内 TASK-2 / TASK-3 的 allowed_write_files 均为 `[]`，互不写文件，可并行；TASK-1 单独 Batch 1 |
| 6 | 有没有共享代码需要先建独立 task？ | ✅ 无需；InspectionStackParamList 已在 TodayInspectionScreen.tsx 导出（WI-0016 前置就绪），TASK-1 直接 import 复用，不重定义 |
| 7 | allowed_write_files 是否具体（无通配符/目录）？ | ✅ TASK-1 为单一具体文件绝对路径；TASK-2/3 为 `[]`（验证型 task） |
| 8 | 并行 task 的 allowed_write_files 是否不重叠？ | ✅ TASK-2/3 均 `[]`，无重叠 |
| 9 | forbidden_files 是否包含 requirements/design/tasks？ | ✅ TASK-1 forbidden_files 显式排除 requirements.md/design.md/tasks.md 及其他 task 写文件；TASK-2/3 排除所有源码 + governance 路径 |
| 10 | done_when 每条是否可通过 verification_commands 验证？ | ✅ 每条 done_when 对应至少一条 grep/test/wc 命令 |
| 11 | Docker TASK 是否标注分离模式/挂载/授权约束？ | ✅ TASK-2/3 的 Constraints 含 `docker run -d` / `--mount type=bind` / Write Guard 授权失效处理 / project-cache-dir / 完整命令模板 |
| 12 | 是否避免 T6 大小超限（单 task >200 行源码改动）？ | ✅ TASK-1 目标 ~250 行（单一文件激活集成，改动集中且单一 DD-1/2/3 强相关，未跨组件耦合）；TASK-2/3 无源码改动 |

---

## 4. 完成报告

```json
{
  "status": "success",
  "files_changed": [
    ".specforge/work-items/WI-0016/candidates/tasks.md",
    ".specforge/work-items/WI-0016/trace_delta.md"
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
    "TodayInspectionScreen.tsx (218 行) 与 TaskCard.tsx (141 行) 已是 WI-0016 前置就绪骨架，本 WI 不修改它们，仅由 TASK-1 在 AppNavigator 层激活集成",
    "TaskDetail / InspectionInProgress / SubmitReport / IssueEvidence 4 个子 screen 用 SimplePlaceholder 占位，真实实装留给 WI-0017 / WI-0018（intake OUT-OF-SCOPE 明确）",
    "IssueBasket / Profile Tab 保留 SimplePlaceholder，真实实装留给 WI-0019 / WI-0020（intake OUT-OF-SCOPE 明确）",
    "REQ/DD 编号为基于 intake + impact_analysis 推断的占位 ID，正式编号由并行 sf-requirements / sf-design 落定后由 Orchestrator 对齐 trace_delta"
  ]
}
```

---

**文档结束**。本 Candidate 待 Gate（required_files / schema / trace / spec_consistency / candidate_manifest）通过 + User Decision 后，由 Merge Runner 写入正式 tasks 真相源。
