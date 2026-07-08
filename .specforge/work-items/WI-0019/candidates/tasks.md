# Tasks Candidate — WI-0019: 问题篮子 + 提交日报屏幕集成

> **Work Item**: WI-0019
> **Workflow Type**: feature_spec
> **Workflow Path**: requirement_change_path
> **Base Spec Version**: PSV-0001
> **Date**: 2026-07-05
> **标准依据**: specforge_final_fused_standard_v1_1_patch1_zh.md (§8.2 Candidate, §11 Task Contract, §12.7 Changed Files Audit, §13.3 Verification)
> **作者 Agent**: sf-task-planner
> **Candidate Path**: .specforge/work-items/WI-0019/candidates/tasks.md
> **上游输入**: requirements.candidate.md (REQ-1~3), design.candidate.md (DD-1~2)

---

## 0. Extension Registry 前置检查

- 读取 `.specforge/project/extension_registry.json`，`namespaces.task_types = []`（空）。
- 本 tasks 使用标准 `TASK-N` Markdown 格式，未引入任何新 task_type / 结构化扩展类型。
- 结论：**无需触发 Extension Subflow**，可直接产出 Candidate。

---

## 1. 概述

### 1.1 任务清单总览

| TASK | 标题 | 目标文件 | 关联 DD | 关联 REQ | 依赖 |
|------|------|----------|---------|----------|------|
| TASK-1 | 修改 AppNavigator.tsx 集成两个真实屏幕 | src/navigation/AppNavigator.tsx | DD-1 | REQ-1, REQ-2 | — |
| TASK-2 | TypeScript 类型检查 + 证据收集 | (无源码改动) | DD-2 | REQ-3.1 | TASK-1 |
| TASK-3 | Docker assembleDebug 构建验证 | (无源码改动) | DD-2 | REQ-3.2 | TASK-1 |

### 1.2 依赖图与并行批次

```
Batch 1 (独立):
  TASK-1 (AppNavigator.tsx 修改)
          │
          ▼
Batch 2 (验证，可并行):   TASK-2 (tsc --noEmit)    TASK-3 (docker assembleDebug)
```

- **并行批次**: 2 批
- **可并行 task**: Batch 2 内 TASK-2 / TASK-3（均为只读验证，文件不重叠）
- **串行 task**: TASK-1 → TASK-2/TASK-3

### 1.3 配置事实源声明

- `.specforge/config/prod-environment.md`：当前为 TODO 占位。verification_commands 使用跨平台标准工具（grep/test/node）与项目自身构建命令（./gradlew assembleDebug / npx tsc），不依赖第三方 CLI。
- `.specforge/config/project-rules.md`：当前为 TODO 占位。task 实现遵循 design candidate §9 的 A1-A5 架构属性与相邻文件代码风格。

---

## 2. 任务详细合同

### TASK-1 修改 AppNavigator.tsx 集成 IssueBasketScreen + SubmitReportScreen

**context_block**（executor 必读）：
- **What**: 修改 `fj-android/src/navigation/AppNavigator.tsx`（当前 206 行 → ~210 行），三处改动（对应 DD-1 改动 A/B/C）：
  1. **改动 A — 新增 imports**（L23-27 现有 import 区之后，紧跟 IssueEvidenceScreen import）：
     ```typescript
     import IssueBasketScreen from '../screens/issue-basket/IssueBasketScreen';
     import SubmitReportScreen from '../screens/submit/SubmitReportScreen';
     ```
     风格对齐现有 `import IssueEvidenceScreen from '../screens/inspection/IssueEvidenceScreen';`（L27，无花括号 default import）。
  2. **改动 B — 删除 IssueBasket 本地占位函数**（删 L120-131 整段，含 JSDoc 注释 + 函数体）：
     ```typescript
     // 删除以下整段（消除与 import 的 Duplicate identifier 命名冲突）：
     /**
      * IssueBasket Tab 占位（WI-0019 替换为真实 screen）。
      */
     function IssueBasketScreen(): React.ReactElement {
       return (
         <SimplePlaceholder
           title="问题篮子"
           subtitle="骨架占位 — 离线草拟的问题清单，待提交到日报"
         />
       );
     }
     ```
     ProfileScreen（L136-143）保留不动；SimplePlaceholder 组件（L58-68）保留（ProfileScreen 仍引用）。
  3. **改动 C — SubmitReport 路由改为 component 形式**（改 L100-110）：
     ```typescript
     // 现状（children 回调，替换）：
     <InspectionStack.Screen
       name="SubmitReport"
       options={{ headerTitle: '提交日报' }}
     >
       {() => (
         <SimplePlaceholder
           title="提交日报"
           subtitle="骨架占位 — WI-0017 实现"
         />
       )}
     </InspectionStack.Screen>

     // 改为（component 形式）：
     <InspectionStack.Screen
       name="SubmitReport"
       component={SubmitReportScreen}
       options={{ headerTitle: '提交日报' }}
     />
     ```
  4. **IssueBasket Tab JSX（L171-175）不改**：`<Tab.Screen name="IssueBasket" component={IssueBasketScreen} options={{ title: '问题篮子', tabBarLabel: '问题篮子' }} />` 中的 `component={IssueBasketScreen}` 现在自动解析到 import 的真实屏幕（本地同名函数已删除），无需改动 JSX。
- **Why**: IssueBasketScreen（464 行）与 SubmitReportScreen（607 行）骨架已完整，但 AppNavigator 仍挂载占位组件。本地占位函数 `IssueBasketScreen`（L124）与 import 默认导出同名，必须删除以消除 `Duplicate identifier` 编译错误（REQ-1.AC1）。SubmitReport 路由改 component 形式是 React Navigation 标准挂载方式，自动注入 navigation/route props（REQ-2.AC1）。
- **Refs**: DD-1, REQ-1（AC1/AC2/AC3）, REQ-2（AC1/AC2/AC3）
- **Where**:
  - read_files:
    - `/mnt/1t_back/project/fj1/fj-android/src/navigation/AppNavigator.tsx`（现状 206 行，必读确认行号）
    - `/mnt/1t_back/project/fj1/fj-android/src/screens/issue-basket/IssueBasketScreen.tsx`（确认 export default 签名 L90）
    - `/mnt/1t_back/project/fj1/fj-android/src/screens/submit/SubmitReportScreen.tsx`（确认 export default 签名 L105）
  - allowed_write_files: [`/mnt/1t_back/project/fj1/fj-android/src/navigation/AppNavigator.tsx`]
  - forbidden_files: [IssueBasketScreen.tsx, SubmitReportScreen.tsx, TodayInspectionScreen.tsx, requirements.md, design.md, tasks.md, 其余所有文件]
- **Constraints**:
  - **必须删除本地占位函数 `IssueBasketScreen`（L120-131）**：含 JSDoc 注释 + 函数体完整删除，否则与 import 产生 `Duplicate identifier` 编译错误。
  - **不修改 ProfileScreen（L136-143）与 SimplePlaceholder（L58-68）**：ProfileScreen 仍为占位（WI-0020 实装），SimplePlaceholder 被 ProfileScreen 引用。
  - **不修改两个真实屏幕的内部实现**：仅 import + 挂载，intake OUT-OF-SCOPE。
  - **SubmitReport 路由保留 `name="SubmitReport"` 与 `options={{ headerTitle: '提交日报' }}`**：仅替换渲染方式（children → component），REQ-2.AC2。
  - **不修改 InspectionStackParamList 类型定义**（TodayInspectionScreen.tsx）：本 WI 不扩展类型表。
  - import 路径：`'../screens/issue-basket/IssueBasketScreen'` 与 `'../screens/submit/SubmitReportScreen'`（从 navigation/ 目录出发的相对路径）。
  - 不引入新 npm 依赖。
- **Done When**:
  - `grep -c "import IssueBasketScreen from" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥1`。
  - `grep -c "import SubmitReportScreen from" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥1`。
  - `grep -cE "^function IssueBasketScreen" fj-android/src/navigation/AppNavigator.tsx` 返回 `0`（本地占位函数已删）。
  - `grep -c "component={SubmitReportScreen}" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥1`。
  - `grep -c "component={IssueBasketScreen}" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥1`（Tab.Screen，现指向 import）。
  - `grep -c "SimplePlaceholder" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥1`（ProfileScreen 仍引用，SimplePlaceholder 保留）。
  - 现有结构保留：`grep -c "ProfileScreen" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥2`、`grep -c "InspectionStackScreen" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥2`、`grep -c "RootTabParamList" fj-android/src/navigation/AppNavigator.tsx` 返回 `≥1`。
  - `wc -l fj-android/src/navigation/AppNavigator.tsx` 行数在 195~220 之间（目标 ~210）。
- **Out of Scope**: 不修改 IssueBasketScreen.tsx / SubmitReportScreen.tsx 内部；不修改 ProfileScreen / SimplePlaceholder；不修改 InspectionStackParamList 类型；tsc 归 TASK-2；Docker 归 TASK-3。

- **task_id**: TASK-1
- **depends_on**: []
- **expected_file_changes**: [`fj-android/src/navigation/AppNavigator.tsx`（修改：206 → ~210 行）]
- **verification_commands**:
  - `grep -c "import IssueBasketScreen from" fj-android/src/navigation/AppNavigator.tsx`（期望 `≥1`）
  - `grep -c "import SubmitReportScreen from" fj-android/src/navigation/AppNavigator.tsx`（期望 `≥1`）
  - `grep -cE "^function IssueBasketScreen" fj-android/src/navigation/AppNavigator.tsx`（期望 `0`，本地占位已删）
  - `grep -c "component={SubmitReportScreen}" fj-android/src/navigation/AppNavigator.tsx`（期望 `≥1`）
  - `grep -cE "ProfileScreen|SimplePlaceholder" fj-android/src/navigation/AppNavigator.tsx`（期望 `≥2`，保留）
  - `wc -l fj-android/src/navigation/AppNavigator.tsx`（期望 195~220）
- **verification_evidence_expected**:
  - { command: "grep import IssueBasketScreen", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep import SubmitReportScreen", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep no local IssueBasketScreen function", expected_exit_code: 0, expected_output_pattern: "^0$", evidence_type: "grep_count" }
  - { command: "grep component SubmitReportScreen", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep retained ProfileScreen/SimplePlaceholder", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "wc -l AppNavigator", expected_exit_code: 0, evidence_type: "line_count" }

---

### TASK-2 TypeScript 类型检查 + 证据收集

**context_block**（executor 必读）：
- **What**: 在 Docker 容器（镜像 `fj-builder:react-native-0.74`）内对 `fj-android` 工程执行 TypeScript 类型检查 `npx tsc --noEmit`（或 package.json 中配置的 typecheck 脚本），验证：
  1. TASK-1 的 `import IssueBasketScreen` / `import SubmitReportScreen` 路径正确、默认导出类型对齐。
  2. 本地占位函数 `IssueBasketScreen` 已删除，无 `Duplicate identifier 'IssueBasketScreen'` 编译错误。
  3. SubmitReport 路由 `component={SubmitReportScreen}` 的组件类型与 `InspectionStackParamList` 路由表匹配。
  4. IssueBasket Tab `component={IssueBasketScreen}` 的组件类型对齐（Tab 屏幕不需 route.params）。
  5. 收集 tsc 输出日志作为 verification evidence。
  - 本 TASK **不写源码**，仅类型检查 + 证据收集。verification_report 和 evidence_manifest 的正式写入由 Orchestrator 通过 sf-verifier 完成。
- **Why**: tsc 是类型期的"软门"，覆盖 import 路径、命名冲突消除、组件类型对齐、路由表匹配等编译器可检错误（REQ-3.AC1）。与 TASK-3 的编译期"硬门"互补。
- **Refs**: DD-2, REQ-3（AC1/AC3）
- **Where**:
  - read_files: [TASK-1 产出的 AppNavigator.tsx（只读）]
  - allowed_write_files: []（本 TASK 不修改源码；evidence 收集产物由 Orchestrator/sf-verifier 写入 governance 路径）
  - forbidden_files: [所有源码文件，.specforge/work-items/ 下所有文件（governance 产物由 sf-verifier 写）]
- **Constraints**:
  - **Docker 执行**：分离模式 `docker run -d` + 日志轮询，不得前台阻塞；挂载用 `--mount type=bind`（避免 `-v` 的 `:` 被 Write Guard 误判）；镜像 `fj-builder:react-native-0.74`。
  - tsc 命令：`cd /workspace && npx tsc --noEmit`（或 `npm run typecheck` 若 package.json 已配置）。
  - 退出码必须为 `0`（无类型错误）。
  - 若 tsc 报错：不得用 `any` / `@ts-ignore` / `as unknown as` 绕过（REQ-3.AC3）；回退到 TASK-1 修复（如确认本地占位函数已删、import 路径正确）。
  - 证据收集：tsc stdout/stderr 完整日志 + 退出码，供 sf-verifier 写入 evidence_manifest。
  - 可与 TASK-3 复用同一 Docker 容器（先 tsc 后 assembleDebug）。
  - **Write Guard 授权**：若 Docker 命令触发 hard_stop，需通过 `sf_hard_stop_resolve` 重新安装 work_item 级授权（authorization_command_family=`docker_run`，authorization_image=`fj-builder:react-native-0.74`，authorization_container_targets=`[/workspace]`，authorization_expires_when=`work_item_closed`），并附用户确认原话。
- **Done When**:
  - `npx tsc --noEmit` 退出码 `0`。
  - tsc 输出无 error 行：`grep -c "error TS" <tsc_log>` 返回 `0`。
  - 证据日志已收集（tsc 完整输出保存）。
- **Out of Scope**: 不修改源码（回退 TASK-1）；不写 governance 产物（sf-verifier 负责）；不做 Release 构建；不做单测。

- **task_id**: TASK-2
- **depends_on**: [TASK-1]
- **expected_file_changes**: []
- **verification_commands**:
  - Docker 内 `cd /workspace && npx tsc --noEmit`（期望退出码 `0`）
  - `grep -c "error TS" <tsc_log>`（期望 `0`）
- **verification_evidence_expected**:
  - { command: "npx tsc --noEmit", expected_exit_code: 0, expected_output_pattern: "no error", evidence_type: "tsc_output" }
  - { command: "grep error TS", expected_exit_code: 0, expected_output_pattern: "^0$", evidence_type: "tsc_log_grep" }

---

### TASK-3 Docker assembleDebug 构建验证

**context_block**（executor 必读）：
- **What**: 在 Docker 构建环境（镜像 `fj-builder:react-native-0.74`）内执行 Android Debug 构建 `./gradlew assembleDebug`，验证：
  1. 构建以退出码 0 完成（JS 层 AppNavigator 集成 + 既有原生模块无回归）。
  2. 产出 `app-debug.apk`，文件大小 > 1 MiB（`min_apk_size_bytes=1048576`）。
  - 本 TASK **不改源码**，仅构建验证。如构建失败需修复，回退到 TASK-1 排查。
- **Why**: 本 WI 不新增原生模块（仅 JS 层 import 切换），故构建主要验证 JS 集成不破坏既有打包；构建是"硬门"，覆盖 tsc 无法发现的打包/资源问题（REQ-3.AC2）。
- **Refs**: DD-2, REQ-3（AC2/AC3）
- **Where**:
  - read_files: [TASK-1 产出的 AppNavigator.tsx（只读，确认改动就位）]
  - allowed_write_files: []（本 TASK 不修改源码；构建产物 app-debug.apk 在 build/ 目录，属构建输出非源码改动）
  - forbidden_files: [所有源码文件，.specforge/ 下所有文件]
- **Constraints**（⚠️ Docker 构建关键注意事项）:
  - **必须用分离模式**：`docker run -d`（后台运行）+ 日志轮询（`docker logs -f <cid>` 或定期 `docker logs --tail`），不得用 `docker run` 前台阻塞（构建耗时长，易超时）。
  - **挂载优先用 `--mount type=bind`**：避免 `-v host:container` 中的 `:` 被 Write Guard 误判为危险模式。示例：`--mount type=bind,source=/mnt/1t_back/project/fj1/fj-android,target=/workspace`。
  - **Gradle 缓存隔离**：加 `--mount type=bind,source=/mnt/1t_back/project/fj1/.gradle-home,target=/root/.gradle` 或 `--project-cache-dir=/tmp/gradle-project-cache` 避免 stale lock。
  - **镜像**：`fj-builder:react-native-0.74`（项目约定）。
  - **构建命令**：`cd /workspace && cd android && ./gradlew assembleDebug`（或项目约定的构建入口）。
  - **Write Guard 授权**：WI-0018 曾安装 work_item 级授权，但 WI-0018 已关闭，授权可能已失效。若 Docker 命令触发 hard_stop，需通过 `sf_hard_stop_resolve` 重新安装 work_item 级授权（authorization_command_family=`docker_run`，authorization_image=`fj-builder:react-native-0.74`，authorization_container_targets=`[/workspace]`，authorization_host_path_prefix=`/mnt/1t_back/project/fj1/fj-android`，authorization_expires_when=`work_item_closed`，authorization_intent=`docker_volume_mount`），并附用户确认原话。
  - **失败处理分支**：
    - 构建失败非本 WI 引入（本 WI 无原生层改动）→ 排查 WI-0015 watermelondb 或其他原生模块状态变化。
    - JS 打包失败（Metro bundler 错误，如 import 路径错）→ 回查 TASK-1 的 import 路径与本地占位函数删除完整性。
  - **不通过回退占位绕过**：REQ-3.AC3 明确禁止通过回退 SimplePlaceholder 或 `@ts-ignore` 绕过。
- **Done When**:
  - 构建命令退出码 `0`（构建成功）。
  - `app-debug.apk` 存在：`test -f fj-android/android/app/build/outputs/apk/debug/app-debug.apk`。
  - APK 大小 > 1 MiB：`stat -c %s <apk>` > 1048576。
- **Out of Scope**: 不做 Release 构建；不做 E2E 运行时验证（留给后续质量 WI）；不修改源码（如需修复回退 TASK-1）；tsc 归 TASK-2。

- **task_id**: TASK-3
- **depends_on**: [TASK-1]
- **expected_file_changes**: []（构建产物 app-debug.apk 非源码）
- **verification_commands**:
  - `docker run -d --mount type=bind,... fj-builder:react-native-0.74 sh -c "cd /workspace/android && ./gradlew assembleDebug"` + 日志轮询（期望退出码 `0`）
  - `test -f fj-android/android/app/build/outputs/apk/debug/app-debug.apk && echo OK`（期望 stdout `OK`）
  - `stat -c %s fj-android/android/app/build/outputs/apk/debug/app-debug.apk`（期望 > 1048576）
- **verification_evidence_expected**:
  - { command: "docker assembleDebug", expected_exit_code: 0, evidence_type: "build_log" }
  - { command: "test -f app-debug.apk", expected_exit_code: 0, expected_output_pattern: "OK", evidence_type: "file_existence" }
  - { command: "stat apk size", expected_exit_code: 0, evidence_type: "file_size" }

---

## 3. 自检（Self-Check）

| # | 自问自答 | 答案 |
|---|---------|------|
| 1 | 每个 DD 都有对应的 task 覆盖吗？ | ✅ DD-1→TASK-1; DD-2（验证策略）→TASK-2 + TASK-3 |
| 2 | 每个 REQ 都有 task 覆盖吗？ | ✅ REQ-1→TASK-1（IssueBasket Tab）; REQ-2→TASK-1（SubmitReport 路由）; REQ-3→TASK-2 + TASK-3 |
| 3 | 每个 task 的 context_block 是否充分（executor 不需回查 design.md）？ | ✅ 每个 task 含 What/Why/Refs/Where(read+allowed_write+forbidden)/Constraints/Done When/Out of Scope，含伪代码与删除/替换对照 |
| 4 | verification_commands 是否真能机器跑（返回退出码）？ | ✅ 全部用 grep/test/wc/docker/gradlew/tsc，均可返回 0/非0 |
| 5 | 并行批次内的 task 是否互相独立（文件不重叠）？ | ✅ Batch1: TASK-1(AppNavigator.tsx 修改); Batch2: TASK-2/TASK-3 只读验证（allowed_write_files=[]） |
| 6 | 有没有共享代码需要先建独立 task？ | ✅ IssueBasket/SubmitReport 两个真实屏幕已存在（不改），无需前置 task |
| 7 | allowed_write_files 是否具体（无通配符/目录）？ | ✅ TASK-1 为 AppNavigator.tsx 具体绝对路径，TASK-2/3 为 [] |
| 8 | 并行 task 的 allowed_write_files 是否不重叠？ | ✅ Batch2 两个 task 均 allowed_write_files=[]（只读验证） |
| 9 | forbidden_files 是否包含 requirements/design/tasks？ | ✅ 每个 task 的 forbidden_files 显式排除规格文档与其他 task 的写文件 |
| 10 | done_when 每条是否可通过 verification_commands 验证？ | ✅ 每条 done_when 对应至少一条 grep/test 命令 |
| 11 | Docker TASK 是否标注分离模式/挂载/授权约束？ | ✅ TASK-2/3 的 Constraints 含 docker run -d / --mount type=bind / Write Guard 授权失效 / project-cache-dir |
| 12 | 是否避免 T6 大小超限（单 task >200 行）？ | ✅ TASK-1 ~10 行改动（3 处）; TASK-2/3 无源码 |

---

## 4. 完成报告

```json
{
  "status": "success",
  "files_changed": [
    ".specforge/work-items/WI-0019/candidates/tasks.md",
    ".specforge/work-items/WI-0019/candidates/trace_delta.md"
  ],
  "structure": {
    "tasks_count": 3,
    "parallel_batches": 2,
    "batch1_independent": ["TASK-1"],
    "batch2_verification": ["TASK-2", "TASK-3"],
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
    "本 WI 仅修改 1 个文件（AppNavigator.tsx），无新建文件，改动面最小",
    "DD-2（验证策略）拆为 TASK-2（tsc 软门）+ TASK-3（Docker 硬门），二者可并行复用同一容器",
    "运行时 E2E 验证（真实屏幕渲染 / 降级提示）留给后续质量 WI，本 WI 仅保证类型 + 构建通过"
  ]
}
```

---

**文档结束**。本 Candidate 待 Gate（required_files / schema / trace / spec_consistency / candidate_manifest）通过 + User Decision 后，由 Merge Runner 写入正式 tasks 真相源。
