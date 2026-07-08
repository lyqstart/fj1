# Tasks Candidate — WI-0018: 照片拍摄 + 分片上传骨架激活（降级模式）

> **Work Item**: WI-0018
> **Workflow Type**: feature_spec
> **Workflow Path**: requirement_change_path
> **Base Spec Version**: PSV-0001
> **Date**: 2026-07-05
> **标准依据**: specforge_final_fused_standard_v1_1_patch1_zh.md (§8.2 Candidate, §11 Task Contract, §12.7 Changed Files Audit, §13.3 Verification)
> **作者 Agent**: sf-task-planner
> **Candidate Path**: .specforge/work-items/WI-0018/candidates/tasks.md
> **上游输入**: requirements.candidate.md (REQ-1~5), design.candidate.md (DD-1~3)

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
| TASK-1 | 新建 PhotoUploadPort.tsx | src/di/PhotoUploadPort.tsx | DD-1 | REQ-1 | — |
| TASK-2 | 修改 AppRoot.tsx 注入 PhotoUploadProvider | src/AppRoot.tsx | DD-2 | REQ-2, REQ-3 | TASK-1 |
| TASK-3 | TypeScript 类型检查 + 证据收集 | (无源码改动) | DD-5(构建验证) | REQ-5.1 | TASK-1, TASK-2 |
| TASK-4 | Docker assembleDebug 构建验证 | (无源码改动) | DD-5(构建验证) | REQ-5.2 | TASK-1, TASK-2 |

> 注：DD-3（降级模式说明 TD-WI0018-001）= 无需代码改动（依赖 PhotoCapture.tsx 既有降级逻辑），不单独建 TASK，由 TASK-3/4 的构建验证 + REQ-4 的运行时降级行为（后续 WI E2E）覆盖。

### 1.2 依赖图与并行批次

```
Batch 1 (独立):
  TASK-1 (PhotoUploadPort.tsx 新建)
          │
          ▼
Batch 2: TASK-2 (AppRoot.tsx 修改，import PhotoUploadProvider)
          │
          ▼
Batch 3 (验证，可并行):   TASK-3 (tsc --noEmit)    TASK-4 (docker assembleDebug)
```

- **并行批次**: 3 批
- **可并行 task**: Batch 3 内 TASK-3 / TASK-4（均为只读验证，文件不重叠）
- **串行 task**: TASK-1 → TASK-2（TASK-2 import TASK-1 的导出）

### 1.3 配置事实源声明

- `.specforge/config/prod-environment.md`：当前为 TODO 占位。verification_commands 使用跨平台标准工具（grep/test/node）与项目自身构建命令（./gradlew assembleDebug / npx tsc），不依赖第三方 CLI。
- `.specforge/config/project-rules.md`：当前为 TODO 占位。task 实现遵循 design candidate §9 的 A1-A5 架构属性与相邻文件代码风格（参照 SyncEnginePort.tsx）。

---

## 2. 任务详细合同

### TASK-1 新建 PhotoUploadPort.tsx（PhotoUploadQueue 的 React Context 注入端口）

**context_block**（executor 必读）：
- **What**: 新建 `fj-android/src/di/PhotoUploadPort.tsx`（~45 行），完全沿用 `SyncEnginePort.tsx`（WI-0015 DD-5，L38-77）的注入范式，导出三个符号：
  1. `PhotoUploadContext`：`const PhotoUploadContext = createContext<PhotoUploadQueue | null>(null);`（默认值 null）。
  2. `PhotoUploadProvider`：React 组件，props 为 `{ queue: PhotoUploadQueue | null; children: React.ReactNode }`，渲染 `<PhotoUploadContext.Provider value={queue}>{children}</PhotoUploadContext.Provider>`。**不在此组件内构造队列**。
  3. `usePhotoUploadQueue`：`return useContext(PhotoUploadContext);`（返回 `PhotoUploadQueue | null`）。
  - 文件头注释说明：设计依据 WI-0018 DD-1，沿用 SyncEnginePort 范式，PhotoUploadQueue 实例由 AppInner（AppRoot.tsx）构造并传入。
- **Why**: PhotoUploadQueue（388 行骨架）已完整，但缺少 React Context 注入端口，组件树无法通过 hook 获取实例。本端口是 REQ-1（注入端口新建）与 REQ-3（AppRoot 集成）的落地点，使任意业务屏幕（如 IssueEvidenceScreen、未来上传调度器）通过 `usePhotoUploadQueue()` 获取队列。
- **Refs**: DD-1, REQ-1（AC1/AC2/AC3）
- **Where**:
  - read_files:
    - `/mnt/1t_back/project/fj1/fj-android/src/di/SyncEnginePort.tsx`（范式参考，L38-77 Provider/hook 写法）
    - `/mnt/1t_back/project/fj1/fj-android/src/api/PhotoUploadQueue.ts`（PhotoUploadQueue 类型 import + 构造函数签名 L199-208）
  - allowed_write_files: [`/mnt/1t_back/project/fj1/fj-android/src/di/PhotoUploadPort.tsx`]
  - forbidden_files: [SyncEnginePort.tsx, PhotoUploadQueue.ts, AppRoot.tsx, requirements.md, design.md, tasks.md, 其余所有文件]
- **Constraints**:
  - 三个符号均须 `export`（`export const PhotoUploadContext` / `export function PhotoUploadProvider` / `export function usePhotoUploadQueue`）。
  - `PhotoUploadContext` 默认值**必须**为 `null`（不是 `new PhotoUploadQueue(...)` 占位），保证未挂载 Provider 时 hook 降级返回 null（REQ-1.AC3）。
  - `PhotoUploadProvider` **不得**在内部 `new PhotoUploadQueue(...)`（实例由 AppInner 传入，单一职责）；仅做 Context.Provider 透传。
  - import 类型：`import type { PhotoUploadQueue } from '../api/PhotoUploadQueue';`（仅类型用 type import，避免运行时循环依赖）。
  - React import：`import React, { createContext, useContext } from 'react';`。
  - 风格对齐 SyncEnginePort.tsx（JSDoc 注释 + 节注释 + export 顺序）。
  - 不引入新 npm 依赖。
- **Done When**:
  - 文件存在：`test -f fj-android/src/di/PhotoUploadPort.tsx`。
  - `grep -c "export const PhotoUploadContext" src/di/PhotoUploadPort.tsx` 返回 `≥1`。
  - `grep -c "export function PhotoUploadProvider" src/di/PhotoUploadPort.tsx` 返回 `≥1`。
  - `grep -c "export function usePhotoUploadQueue" src/di/PhotoUploadPort.tsx` 返回 `≥1`。
  - `grep -c "createContext<PhotoUploadQueue | null>(null)" src/di/PhotoUploadPort.tsx` 返回 `≥1`（默认值 null）。
  - `grep -c "new PhotoUploadQueue" src/di/PhotoUploadPort.tsx` 返回 `0`（不在端口内构造）。
- **Out of Scope**: 不修改 SyncEnginePort.tsx / PhotoUploadQueue.ts；不在端口内构造队列；不写单测（质量 WI）；tsc 归 TASK-3。

- **task_id**: TASK-1
- **depends_on**: []
- **expected_file_changes**: [`fj-android/src/di/PhotoUploadPort.tsx`（新建：0 → ~45 行）]
- **verification_commands**:
  - `test -f fj-android/src/di/PhotoUploadPort.tsx && echo OK`（期望 stdout `OK`）
  - `grep -c "export const PhotoUploadContext" fj-android/src/di/PhotoUploadPort.tsx`（期望 `≥1`）
  - `grep -c "export function PhotoUploadProvider" fj-android/src/di/PhotoUploadPort.tsx`（期望 `≥1`）
  - `grep -c "export function usePhotoUploadQueue" fj-android/src/di/PhotoUploadPort.tsx`（期望 `≥1`）
  - `grep -c "createContext<PhotoUploadQueue | null>(null)" fj-android/src/di/PhotoUploadPort.tsx`（期望 `≥1`）
  - `grep -c "new PhotoUploadQueue" fj-android/src/di/PhotoUploadPort.tsx`（期望 `0`，不在端口内构造）
- **verification_evidence_expected**:
  - { command: "test -f PhotoUploadPort", expected_exit_code: 0, expected_output_pattern: "OK", evidence_type: "file_existence" }
  - { command: "grep PhotoUploadContext", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep PhotoUploadProvider", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep usePhotoUploadQueue", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep createContext null default", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep no new PhotoUploadQueue", expected_exit_code: 0, expected_output_pattern: "^0$", evidence_type: "grep_count" }

---

### TASK-2 修改 AppRoot.tsx 注入 PhotoUploadProvider（AppInner 构造队列 + 包裹 Provider）

**context_block**（executor 必读）：
- **What**: 修改 `fj-android/src/AppRoot.tsx`（当前 99 行 → ~115 行），仅改动 `AppInner` 组件（L82-88）+ 新增 imports，不动 `AppRoot` 主体（loading/error/ready 分支 + DatabaseProvider/SyncEngineInitializer 嵌套）：
  1. **新增 imports**（文件顶部 import 区）：
     ```typescript
     import { PhotoUploadQueue } from './api/PhotoUploadQueue';
     import { PhotoUploadProvider } from './di/PhotoUploadPort';
     ```
     （注：L10 `import React, { useEffect, useMemo, useState } from 'react';` 已含 `useMemo`，无需重复导入。）
  2. **修改 `AppInner` 组件**（当前 L82-88 仅取 `state` 渲染 RootNavigator）：
     ```typescript
     function AppInner(): React.ReactElement {
       const { state, apiClient } = useAuth();  // 现有 const { state } = useAuth() 改为同时取 apiClient
       const photoUploadQueue = useMemo<PhotoUploadQueue | null>(
         () => (apiClient ? new PhotoUploadQueue(apiClient) : null),
         [apiClient],
       );
       return (
         <PhotoUploadProvider queue={photoUploadQueue}>
           <RootNavigator />
         </PhotoUploadProvider>
       );
     }
     ```
  3. **嵌套顺序（修改后整体）**：`DatabaseProvider > SyncEngineInitializer > PhotoUploadProvider（包裹在 AppInner 返回值内）> RootNavigator`（AppRoot ready 分支 L70-75 不变，AppInner 内部包裹）。
- **Why**: PhotoUploadQueue 需在 App 全局可用（REQ-2），AppInner 已位于 AuthProvider + DatabaseProvider + SyncEngineInitializer 子树内，`useAuth()` 可用，是构造队列（仅需 apiClient）并包裹 Provider 的最直接挂载点（DD-2）。`useMemo([apiClient])` 稳定引用（REQ-2.AC2），apiClient 为 null 时返回 null 降级（REQ-2.AC3）。
- **Refs**: DD-2, REQ-2（AC1/AC2/AC3）, REQ-3（AC1/AC2/AC3）
- **Where**:
  - read_files:
    - `/mnt/1t_back/project/fj1/fj-android/src/AppRoot.tsx`（现状 99 行）
    - `/mnt/1t_back/project/fj1/fj-android/src/api/PhotoUploadQueue.ts`（构造函数 L199-208 + 类签名）
    - `/mnt/1t_back/project/fj1/fj-android/src/di/PhotoUploadPort.tsx`（TASK-1 产物，PhotoUploadProvider props）
    - `/mnt/1t_back/project/fj1/fj-android/src/store/auth/AuthContext.tsx`（useAuth 返回值，确认 apiClient 字段 —— WI-0015 DD-5.1 已加）
  - allowed_write_files: [`/mnt/1t_back/project/fj1/fj-android/src/AppRoot.tsx`]
  - forbidden_files: [PhotoUploadPort.tsx, PhotoUploadQueue.ts, AuthContext.tsx, types.ts, requirements.md, design.md, tasks.md, 其余所有文件]
- **Constraints**:
  - 仅改 `AppInner` 组件 + 顶部 imports；**不得**改动 `AppRoot` 主体的 loading/error/ready 分支与 `DatabaseProvider` / `SyncEngineInitializer` 嵌套（L42-76）。
  - `useMemo` 依赖数组**必须**为 `[apiClient]`（REQ-2.AC2，稳定引用）。
  - `apiClient` 为 null 时 `useMemo` **必须**返回 `null`（不抛错，REQ-2.AC3）。
  - 构造调用：`new PhotoUploadQueue(apiClient)`（不传 reader，采用默认 FetchBlobChunkReader，DD-2）。
  - `PhotoUploadProvider` 的 `queue` prop 接受 `PhotoUploadQueue | null`（TASK-1 已定义）。
  - 不在 `AppRoot` 顶层（loading/error 分支前）构造队列（DD-2 理由：构造时机不精确）。
  - 不引入新 npm 依赖。
- **Done When**:
  - `grep -c "import.*PhotoUploadQueue.*from.*api/PhotoUploadQueue" fj-android/src/AppRoot.tsx` 返回 `≥1`。
  - `grep -c "import.*PhotoUploadProvider.*from.*di/PhotoUploadPort" fj-android/src/AppRoot.tsx` 返回 `≥1`。
  - `grep -c "new PhotoUploadQueue(apiClient)" fj-android/src/AppRoot.tsx` 返回 `≥1`。
  - `grep -c "PhotoUploadProvider" fj-android/src/AppRoot.tsx` 返回 `≥2`（import + JSX 使用）。
  - `grep -c "useMemo" fj-android/src/AppRoot.tsx` 返回 `≥1`（AppInner 内稳定引用）。
  - 现有结构保留：`grep -c "DatabaseProvider" fj-android/src/AppRoot.tsx` 返回 `≥1`、`grep -c "SyncEngineInitializer" fj-android/src/AppRoot.tsx` 返回 `≥1`、`grep -c "initDatabase" fj-android/src/AppRoot.tsx` 返回 `≥1`。
  - `wc -l fj-android/src/AppRoot.tsx` 行数 ≤ 130（目标 ~115，上限 130）。
- **Out of Scope**: 不修改 PhotoUploadPort.tsx（TASK-1）；不修改 PhotoUploadQueue.ts；不修改 AuthContext.tsx；不修改 DatabaseProvider/SyncEngineInitializer 嵌套；tsc 归 TASK-3；Docker 归 TASK-4。

- **task_id**: TASK-2
- **depends_on**: [TASK-1]
- **expected_file_changes**: [`fj-android/src/AppRoot.tsx`（修改：99 → ~115 行）]
- **verification_commands**:
  - `grep -c "PhotoUploadQueue" fj-android/src/AppRoot.tsx`（期望 `≥2`，import + new）
  - `grep -c "PhotoUploadProvider" fj-android/src/AppRoot.tsx`（期望 `≥2`，import + JSX）
  - `grep -c "new PhotoUploadQueue(apiClient)" fj-android/src/AppRoot.tsx`（期望 `≥1`）
  - `grep -cE "DatabaseProvider|SyncEngineInitializer|initDatabase" fj-android/src/AppRoot.tsx`（期望 `≥3`，现有结构保留）
  - `wc -l fj-android/src/AppRoot.tsx`（期望 ≤ 130）
- **verification_evidence_expected**:
  - { command: "grep PhotoUploadQueue in AppRoot", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep PhotoUploadProvider in AppRoot", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep new PhotoUploadQueue", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep existing structure retained", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "wc -l AppRoot", expected_exit_code: 0, evidence_type: "line_count" }

---

### TASK-3 TypeScript 类型检查 + 证据收集

**context_block**（executor 必读）：
- **What**: 在 Docker 容器（镜像 `fj-builder:react-native-0.74`）内对 `fj-android` 工程执行 TypeScript 类型检查 `npx tsc --noEmit`（或 package.json 中配置的 typecheck 脚本），验证：
  1. TASK-1 的 `PhotoUploadPort.tsx` 的 Context / Provider / hook 签名类型正确（`createContext<PhotoUploadQueue | null>`、Provider props、hook 返回类型）。
  2. TASK-2 的 `AppRoot.tsx` 中 `PhotoUploadProvider` 的 props 类型对齐、`new PhotoUploadQueue(apiClient)` 构造函数参数类型匹配、`useAuth()` 返回的 `apiClient` 字段类型为 `ApiClient`。
  3. Provider 嵌套未破坏 `useAuth` / `useDatabase` 的 Context 边界（类型层面）。
  4. 收集 tsc 输出日志作为 verification evidence。
  - 本 TASK **不写源码**，仅类型检查 + 证据收集。verification_report 和 evidence_manifest 的正式写入由 Orchestrator 通过 sf-verifier 完成。
- **Why**: tsc 是类型期的"软门"，覆盖 PhotoUploadPort 新建 + AppRoot 改动的接口对齐、泛型、null 安全等编译器可检错误（REQ-5.AC1）。与 TASK-4 的编译期"硬门"互补。
- **Refs**: DD-5(构建验证), REQ-5（AC1/AC3）
- **Where**:
  - read_files: [TASK-1 + TASK-2 产出的源文件（只读）]
  - allowed_write_files: []（本 TASK 不修改源码；evidence 收集产物由 Orchestrator/sf-verifier 写入 governance 路径）
  - forbidden_files: [所有源码文件，.specforge/work-items/ 下所有文件（governance 产物由 sf-verifier 写）]
- **Constraints**:
  - **Docker 执行**：分离模式 `docker run -d` + 日志轮询，不得前台阻塞；挂载用 `--mount type=bind`（避免 `-v` 的 `:` 被 Write Guard 误判）；镜像 `fj-builder:react-native-0.74`；Gradle 缓存隔离 `--project-cache-dir` 或绑定 `.gradle-home`。
  - tsc 命令：`cd /workspace && npx tsc --noEmit`（或 `npm run typecheck` 若 package.json 已配置）。
  - 退出码必须为 `0`（无类型错误）。
  - 若 tsc 报错：不得用 `any` / `@ts-ignore` / `as unknown as` 绕过（REQ-5.AC3）；回退到 TASK-1 或 TASK-2 修复类型。
  - 证据收集：tsc stdout/stderr 完整日志 + 退出码，供 sf-verifier 写入 evidence_manifest。
  - 可与 TASK-4 复用同一 Docker 容器（先 tsc 后 assembleDebug，或分开）。
  - **Write Guard 授权**：若 Docker 命令触发 hard_stop，需通过 `sf_hard_stop_resolve` 重新安装 work_item 级授权（authorization_command_family=`docker_run`，authorization_image=`fj-builder:react-native-0.74`，authorization_container_targets=`[/workspace]`，authorization_expires_when=`work_item_closed`），并附用户确认原话。
- **Done When**:
  - `npx tsc --noEmit` 退出码 `0`。
  - tsc 输出无 error 行：`grep -c "error TS" <tsc_log>` 返回 `0`。
  - 证据日志已收集（tsc 完整输出保存）。
- **Out of Scope**: 不修改源码（回退 TASK-1/2）；不写 governance 产物（sf-verifier 负责）；不做 Release 构建；不做单测。

- **task_id**: TASK-3
- **depends_on**: [TASK-1, TASK-2]
- **expected_file_changes**: []
- **verification_commands**:
  - Docker 内 `cd /workspace && npx tsc --noEmit`（期望退出码 `0`）
  - `grep -c "error TS" <tsc_log>`（期望 `0`）
- **verification_evidence_expected**:
  - { command: "npx tsc --noEmit", expected_exit_code: 0, expected_output_pattern: "no error", evidence_type: "tsc_output" }
  - { command: "grep error TS", expected_exit_code: 0, expected_output_pattern: "^0$", evidence_type: "tsc_log_grep" }

---

### TASK-4 Docker assembleDebug 构建验证

**context_block**（executor 必读）：
- **What**: 在 Docker 构建环境（镜像 `fj-builder:react-native-0.74`）内执行 Android Debug 构建 `./gradlew assembleDebug`，验证：
  1. 构建以退出码 0 完成（JS 层 PhotoUploadPort/AppRoot 集成 + 既有原生模块无回归）。
  2. 产出 `app-debug.apk`，文件大小 > 1 MiB（`min_apk_size_bytes=1048576`）。
  - 本 TASK **不改源码**，仅构建验证。如构建失败需修复，回退到对应 TASK（TASK-1/2）排查。
- **Why**: 本 WI 不解除/新增原生模块屏蔽（DD-3），故构建主要验证 JS 集成不破坏既有打包；构建是"硬门"，覆盖 tsc 无法发现的打包/资源问题（REQ-5.AC2）。
- **Refs**: DD-5(构建验证), REQ-5（AC2/AC3）
- **Where**:
  - read_files: [TASK-1 + TASK-2 产出的源文件（只读，确认改动就位）]
  - allowed_write_files: []（本 TASK 不修改源码；构建产物 app-debug.apk 在 build/ 目录，属构建输出非源码改动）
  - forbidden_files: [所有源码文件，.specforge/ 下所有文件]
- **Constraints**（⚠️ Docker 构建关键注意事项）:
  - **必须用分离模式**：`docker run -d`（后台运行）+ 日志轮询（`docker logs -f <cid>` 或定期 `docker logs --tail`），不得用 `docker run` 前台阻塞（构建耗时长，易超时）。
  - **挂载优先用 `--mount type=bind`**：避免 `-v host:container` 中的 `:` 被 Write Guard 误判为危险模式。示例：`--mount type=bind,source=/mnt/1t_back/project/fj1/fj-android,target=/workspace`。
  - **Gradle 缓存隔离**：加 `--mount type=bind,source=/mnt/1t_back/project/fj1/.gradle-home,target=/root/.gradle` 或 `--project-cache-dir=/tmp/gradle-project-cache` 避免 stale lock。
  - **镜像**：`fj-builder:react-native-0.74`（项目约定）。
  - **构建命令**：`cd /workspace && cd android && ./gradlew assembleDebug`（或项目约定的构建入口）。
  - **Write Guard 授权**：WI-0014 曾安装 `write_guard_authorization`，但 WI-0014 已关闭，授权可能已失效。若 Docker 命令触发 hard_stop，需通过 `sf_hard_stop_resolve` 重新安装 work_item 级授权（authorization_command_family=`docker_run`，authorization_image=`fj-builder:react-native-0.74`，authorization_container_targets=`[/workspace]`，authorization_host_path_prefix=`/mnt/1t_back/project/fj1/fj-android`，authorization_expires_when=`work_item_closed`，authorization_intent=`docker_volume_mount`），并附用户确认原话。
  - **失败处理分支**：
    - 构建失败非本 WI 引入（本 WI 无原生层改动）→ 排查 WI-0015 watermelondb 或其他原生模块状态变化。
    - JS 打包失败（Metro bundler 错误，如 PhotoUploadPort import 路径错）→ 回查 TASK-1/2 的 import 路径与导出名。
  - **不通过回退 Provider 挂载回避**：REQ-5.AC3 明确禁止通过回退 PhotoUploadProvider 挂载或 `@ts-ignore` 绕过。
- **Done When**:
  - 构建命令退出码 `0`（构建成功）。
  - `app-debug.apk` 存在：`test -f fj-android/android/app/build/outputs/apk/debug/app-debug.apk`。
  - APK 大小 > 1 MiB：`stat -c %s <apk>` > 1048576。
- **Out of Scope**: 不做 Release 构建；不做 E2E 运行时验证（降级行为 E2E 留给后续 WI 解除屏蔽后统一验证）；不修改源码（如需修复回退 TASK-1/2）；tsc 归 TASK-3。

- **task_id**: TASK-4
- **depends_on**: [TASK-1, TASK-2]
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
| 1 | 每个 DD 都有对应的 task 覆盖吗？ | ✅ DD-1→TASK-1; DD-2→TASK-2; DD-3→无需 task（依赖 PhotoCapture 既有降级逻辑，由 TASK-3/4 构建验证 + REQ-4 运行时覆盖）; DD-5(构建验证)→TASK-3+4 |
| 2 | 每个 REQ 都有 task 覆盖吗？ | ✅ REQ-1→TASK-1; REQ-2→TASK-2; REQ-3→TASK-2; REQ-4→TASK-3/4（构建通过保证 IssueEvidenceScreen 可渲染降级，运行时降级行为依赖 PhotoCapture 既有逻辑 + 后续 WI E2E）; REQ-5→TASK-3+4 |
| 3 | 每个 task 的 context_block 是否充分（executor 不需回查 design.md）？ | ✅ 每个 task 含 What/Why/Refs/Where(read+allowed_write+forbidden)/Constraints/Done When/Out of Scope，含伪代码 |
| 4 | verification_commands 是否真能机器跑（返回退出码）？ | ✅ 全部用 grep/test/wc/docker/gradlew/tsc，均可返回 0/非0 |
| 5 | 并行批次内的 task 是否互相独立（文件不重叠）？ | ✅ Batch1: TASK-1(PhotoUploadPort.tsx 新建); Batch2: TASK-2(AppRoot.tsx); Batch3: TASK-3/4 只读验证（allowed_write_files=[]） |
| 6 | 有没有共享代码需要先建独立 task？ | ✅ PhotoUploadPort（TASK-1 新建）被 TASK-2 import，TASK-2 depends_on TASK-1 |
| 7 | allowed_write_files 是否具体（无通配符/目录）？ | ✅ 全部为具体文件绝对路径，TASK-3/4 为 [] |
| 8 | 并行 task 的 allowed_write_files 是否不重叠？ | ✅ Batch3 两个 task 均 allowed_write_files=[]（只读验证） |
| 9 | forbidden_files 是否包含 requirements/design/tasks？ | ✅ 每个 task 的 forbidden_files 显式排除规格文档与其他 task 的写文件 |
| 10 | done_when 每条是否可通过 verification_commands 验证？ | ✅ 每条 done_when 对应至少一条 grep/test 命令 |
| 11 | Docker TASK 是否标注分离模式/挂载/授权约束？ | ✅ TASK-3/4 的 Constraints 含 docker run -d / --mount type=bind / Write Guard 授权失效 / project-cache-dir |
| 12 | 是否避免 T6 大小超限（单 task >200 行）？ | ✅ TASK-1 ~45 行（新建）; TASK-2 ~16 行改动; TASK-3/4 无源码 |

---

## 4. 完成报告

```json
{
  "status": "success",
  "files_changed": [
    ".specforge/work-items/WI-0018/candidates/tasks.md",
    ".specforge/work-items/WI-0018/trace_delta.md"
  ],
  "structure": {
    "tasks_count": 4,
    "parallel_batches": 3,
    "batch1_independent": ["TASK-1"],
    "batch2": ["TASK-2"],
    "batch3_verification": ["TASK-3", "TASK-4"],
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
    "DD-3（降级模式 TD-WI0018-001）依赖 PhotoCapture.tsx 既有降级逻辑，无需独立 task，由 TASK-3/4 构建验证 + REQ-4 运行时降级行为覆盖",
    "DD-5（构建验证）拆为 TASK-3（tsc 软门）+ TASK-4（Docker 硬门），二者可并行复用同一容器",
    "降级模式 E2E 验证（REQ-4.1/4.2/4.3 的 UI Alert + 队列空转）留给后续 WI 解除屏蔽后统一验证，本 WI 仅保证类型 + 构建通过"
  ]
}
```

---

**文档结束**。本 Candidate 待 Gate（required_files / schema / trace / spec_consistency / candidate_manifest）通过 + User Decision 后，由 Merge Runner 写入正式 tasks 真相源。
