# Tasks Candidate — WI-0020: 解除屏蔽 5 个 RN 原生模块

> **Work Item**: WI-0020
> **Workflow Type**: feature_spec
> **Workflow Path**: requirement_change_path
> **Base Spec Version**: PSV-0008
> **Date**: 2026-07-05
> **标准依据**: specforge_final_fused_standard_v1_1_patch1_zh.md (§8.2 Candidate, §11 Task Contract, §12.7 Changed Files Audit, §13.3 Verification)
> **作者 Agent**: sf-task-planner
> **Candidate Path**: .specforge/work-items/WI-0020/candidates/tasks.md
> **上游输入**: requirements.candidate.md (REQ-1~3), design.candidate.md (DD-1~3)

---

## 0. Extension Registry 前置检查

- `namespaces.task_types = []`（空），本 tasks 使用标准 `TASK-N` Markdown 格式，未引入新 task_type。
- 结论：**无需触发 Extension Subflow**。

---

## 1. 概述

### 1.1 任务清单总览

| TASK | 标题 | 目标文件 | 关联 DD | 关联 REQ | 依赖 |
|------|------|----------|---------|----------|------|
| TASK-1 | 修改 react-native.config.js 清空屏蔽列表 | react-native.config.js | DD-1 | REQ-1 | — |
| TASK-2 | 修复解除屏蔽后的编译错误（contingency） | PhotoCapture.tsx / AppRoot.tsx（视编译结果） | DD-2 | REQ-2 | TASK-1 |
| TASK-3 | TypeScript 类型检查 + 证据收集 | (无源码改动) | DD-3 | REQ-3.1 | TASK-1（+TASK-2 若触发） |
| TASK-4 | Docker assembleDebug 构建验证 | (无源码改动) | DD-3 | REQ-3.2 | TASK-1（+TASK-2 若触发） |

### 1.2 依赖图与并行批次

```
Batch 1 (独立):
  TASK-1 (config.js 清空屏蔽)
          │
          ▼
  TASK-2 (编译错误修复 contingency, 仅在 TASK-3/4 报错时触发)
          │
          ▼
Batch 2 (验证，可并行):
  TASK-3 (tsc --noEmit)    TASK-4 (docker assembleDebug)
```

- **并行批次**: 2 批
- **可并行 task**: Batch 2 内 TASK-3 / TASK-4（均为只读验证，文件不重叠）
- **串行 task**: TASK-1 → TASK-2（条件） → TASK-3/TASK-4
- **TASK-2 触发条件**: TASK-3 或 TASK-4 报错时回退执行；若首次 tsc/构建即通过则 TASK-2 标记 skipped

### 1.3 配置事实源声明

- `.specforge/config/prod-environment.md`：当前为 TODO 占位。verification_commands 使用项目自身构建命令（./gradlew assembleDebug / npx tsc）与标准工具（grep/test）。
- `.specforge/config/project-rules.md`：当前为 TODO 占位。task 实现遵循 design candidate §9 的 A1-A5 架构属性。

---

## 2. 任务详细合同

### TASK-1 修改 react-native.config.js 清空 5 个模块屏蔽列表

**context_block**（executor 必读）：
- **What**: 修改 `fj-android/react-native.config.js`（当前 17 行 → ~12 行），将 `dependencies` 对象中的 5 个屏蔽条目全部移除，改为空对象并保留历史注释（对应 DD-1）：
  ```javascript
  // 现状（删除 dependencies 内 5 个屏蔽条目）：
  module.exports = {
    dependencies: {
      'react-native-vision-camera': { platforms: { android: null } },
      'react-native-image-resizer': { platforms: { android: null } },
      'react-native-gesture-handler': { platforms: { android: null } },
      'react-native-safe-area-context': { platforms: { android: null } },
      'react-native-screens': { platforms: { android: null } },
    },
  };

  // 改为：
  /**
   * React Native CLI 配置（WI-0020 解除全部原生模块屏蔽）。
   * 历史：WI-0012 屏蔽 5 个模块避免编译失败，WI-0015 解除 watermelondb，
   *       WI-0020 解除剩余 5 个（vision-camera/image-resizer/gesture-handler/
   *       safe-area-context/screens），恢复完整 autolinking。
   */
  module.exports = {
    dependencies: {},
  };
  ```
- **Why**: 当前 5 个模块原生链接被屏蔽导致相机/图片压缩降级、React Navigation 用 JS fallback、SafeArea 无 notch 适配。清空屏蔽列表恢复 autolinking（REQ-1.AC1/AC2）。
- **Refs**: DD-1, REQ-1（AC1/AC2/AC3）
- **Where**:
  - read_files:
    - `/mnt/1t_back/project/fj1/fj-android/react-native.config.js`（现状 17 行，必读确认）
  - allowed_write_files: [`/mnt/1t_back/project/fj1/fj-android/react-native.config.js`]
  - forbidden_files: [所有源码 .ts/.tsx, requirements.md, design.md, tasks.md, 其余所有文件]
- **Constraints**:
  - **必须移除全部 5 个屏蔽条目**：vision-camera / image-resizer / gesture-handler / safe-area-context / screens，缺一不可（REQ-1.AC1）。
  - **保留合法 `module.exports` 结构**：`dependencies: {}` 空对象合法，不删除整个文件（REQ-1.AC3）。
  - **不修改任何 .ts/.tsx 源码**：源码修复归 TASK-2。
  - 不引入新 npm 依赖，不升级版本。
- **Done When**:
  - `grep -c "platforms: { android: null }" fj-android/react-native.config.js` 返回 `0`（5 个屏蔽条目全删）。
  - `grep -c "react-native-vision-camera" fj-android/react-native.config.js` 返回 `0`（注释内可保留模块名说明，但作为 key 必须消失；若注释提及需调整判定为注释行）。
  - `grep -cE "^module.exports" fj-android/react-native.config.js` 返回 `≥1`（结构合法）。
  - `grep -c "dependencies: {}" fj-android/react-native.config.js` 返回 `≥1`（空对象）。
  - `node -e "require('./fj-android/react-native.config.js')"` 在容器内退出码 0（语法合法，CLI 可解析）。
- **Out of Scope**: 不修改源码（归 TASK-2）；不做 tsc/构建（归 TASK-3/4）。

- **task_id**: TASK-1
- **depends_on**: []
- **expected_file_changes**: [`fj-android/react-native.config.js`（修改：17 → ~12 行）]
- **verification_commands**:
  - `grep -c "platforms: { android: null }" fj-android/react-native.config.js`（期望 `0`）
  - `grep -cE "^module.exports" fj-android/react-native.config.js`（期望 `≥1`）
  - `grep -c "dependencies: {}" fj-android/react-native.config.js`（期望 `≥1`）
  - `node -e "require('./fj-android/react-native.config.js')"`（期望退出码 0）
- **verification_evidence_expected**:
  - { command: "grep no platforms.android=null", expected_exit_code: 0, expected_output_pattern: "^0$", evidence_type: "grep_count" }
  - { command: "grep module.exports", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "node require config.js", expected_exit_code: 0, evidence_type: "node_require" }

---

### TASK-2 修复解除屏蔽后的编译错误（contingency，按需触发）

**context_block**（executor 必读）：
- **What**: 本 TASK 为 **contingency 任务**，仅当 TASK-3（tsc）或 TASK-4（assembleDebug）报错时触发。修复限于使编译/类型检查通过的最小必要改动，不改业务逻辑（对应 DD-2）。可能的修复点：
  1. **vision-camera CMake/NDK 配置**（DD-2.A 确定项）：若 `assembleDebug` 报 CMake 任务失败，在 `android/app/build.gradle` 或 `android/gradle.properties` 调整最小必要配置（不降级 NDK 版本）。
  2. **PhotoCapture.tsx 类型对齐**（DD-2.B contingency）：**注意路径校验**——`DefaultCameraProvider` 实际在 `src/components/photo/PhotoCapture.tsx` L114-133（影响分析标注的 `PhotoUploadPort.tsx` 有误）。仅在 tsc 报 vision-camera 类型导出相关错误时触碰类型对齐；**默认不改 `isAvailable()` 业务语义**（保持 `false`，真实相机实装属相机功能 WI，Out of Scope）。
  3. **AppRoot.tsx SafeAreaProvider 包裹**（DD-2.C contingency）：若 tsc 报 `useSafeAreaInsets` 缺少 Provider，在 `src/AppRoot.tsx` 最外层包裹 `<SafeAreaProvider>`（从 `react-native-safe-area-context` import），最小改动。
  4. **React Navigation 原生依赖 / 原生符号冲突**（DD-2.D）：定位冲突，最小必要修复。
- **Why**: 解除屏蔽后编译错误需在本 WI 内修复以通过 REQ-2（不改业务逻辑、不升级版本、不回退屏蔽，约束）。
- **Refs**: DD-2, REQ-2（AC1/AC2/AC3）
- **Where**:
  - read_files:
    - `/mnt/1t_back/project/fj1/fj-android/src/components/photo/PhotoCapture.tsx`（确认 DefaultCameraProvider L114-133）
    - `/mnt/1t_back/project/fj1/fj-android/src/di/PhotoUploadPort.tsx`（确认仅 Context，无 isAvailable）
    - `/mnt/1t_back/project/fj1/fj-android/src/AppRoot.tsx`（确认 Provider 嵌套 L71-79）
    - TASK-3/4 的错误日志（定位具体错误）
  - allowed_write_files: [`/mnt/1t_back/project/fj1/fj-android/src/components/photo/PhotoCapture.tsx`, `/mnt/1t_back/project/fj1/fj-android/src/AppRoot.tsx`, `/mnt/1t_back/project/fj1/fj-android/android/app/build.gradle`, `/mnt/1t_back/project/fj1/fj-android/android/gradle.properties`]（按实际错误按需写入，仅触碰报错相关文件）
  - forbidden_files: [react-native.config.js（TASK-1 所有）, requirements.md, design.md, tasks.md, 业务逻辑 .ts/.tsx（非编译相关）]
- **Constraints**:
  - **不改业务逻辑**（intake 约束）：`isAvailable()` 默认保持 `false`，仅在类型对齐必要时触碰类型注解，不改运行时返回值。
  - **不升级依赖版本**（intake 约束）。
  - **不回退屏蔽条目**（REQ-2.AC3）：不重新加 `platforms.android=null`。
  - **不用 `any` / `@ts-ignore` / `as unknown as` 绕过**（REQ-2.AC3 / REQ-3.AC3）。
  - **最小必要改动**：仅修复使编译/类型通过的代码，不做无关重构。
  - **若无法修复**：在验证报告记录阻塞，不绕过（REQ-2.AC3）。
- **Done When**:
  - 触发本 TASK 的 tsc/构建错误已修复（TASK-3/4 重跑通过）。
  - `grep -c "platforms: { android: null }" fj-android/react-native.config.js` 仍返回 `0`（未回退屏蔽）。
  - 无新增 `@ts-ignore` / `as any`：`grep -cE "@ts-ignore|as any" fj-android/src/` 不增加。
  - 若 TASK 未触发（首次 tsc/构建即通过），标记 `skipped` 并记录"无需修复"。
- **Out of Scope**: 不改 react-native.config.js；不做最终 tsc/构建验证（归 TASK-3/4）；不实装真实 CameraProvider；不改业务逻辑。

- **task_id**: TASK-2
- **depends_on**: [TASK-1]
- **expected_file_changes**: []（contingency，按实际错误按需写入；可能为空若 skipped）
- **verification_commands**:
  - `grep -c "platforms: { android: null }" fj-android/react-native.config.js`（期望 `0`，未回退）
  - `grep -rcE "@ts-ignore|as any" fj-android/src/`（期望不增加）
  - TASK-3/4 重跑通过（间接验证）
- **verification_evidence_expected**:
  - { command: "grep no platforms.android=null retained", expected_exit_code: 0, expected_output_pattern: "^0$", evidence_type: "grep_count" }
  - { command: "grep no new ts-ignore/any", evidence_type: "grep_diff" }

---

### TASK-3 TypeScript 类型检查 + 证据收集

**context_block**（executor 必读）：
- **What**: 在 Docker 容器（镜像 `fj-builder:react-native-0.74`）内对 `fj-android` 工程执行 `npx tsc --noEmit`，验证：
  1. 5 个原生模块解除屏蔽后 JS 层类型导出可解析（vision-camera / image-resizer / gesture-handler / safe-area-context / screens）。
  2. React Navigation 原生依赖类型满足（gesture-handler / screens 类型）。
  3. SafeArea / gesture 类型无回归。
  4. 收集 tsc 输出日志作为 verification evidence。
  - 本 TASK **不写源码**，仅类型检查 + 证据收集。若报错回退 TASK-2 修复后重跑。
- **Why**: tsc 是类型期"软门"，覆盖模块类型导出、React Navigation 原生依赖类型、SafeArea/gesture 类型等编译器可检错误（REQ-3.AC1）。
- **Refs**: DD-3, REQ-3（AC1/AC3）
- **Where**:
  - read_files: [TASK-1 产出的 react-native.config.js（只读），TASK-2 修复的源码（若有）]
  - allowed_write_files: []（本 TASK 不修改源码；evidence 由 Orchestrator/sf-verifier 写入）
  - forbidden_files: [所有源码文件，.specforge/work-items/ 下所有文件]
- **Constraints**:
  - **Docker 执行**：分离模式 `docker run -d` + 日志轮询，不得前台阻塞；挂载用 `--mount type=bind`；镜像 `fj-builder:react-native-0.74`。
  - tsc 命令：`cd /workspace && npx tsc --noEmit`。
  - 退出码必须为 `0`。
  - 若报错：不得用 `any` / `@ts-ignore` 绕过（REQ-3.AC3）；回退 TASK-2 修复。
  - 可与 TASK-4 复用同一 Docker 容器（先 tsc 后 assembleDebug）。
  - **Write Guard 授权**：若 Docker 命令触发 hard_stop，通过 `sf_hard_stop_resolve` 重新安装 work_item 级授权（authorization_command_family=`docker_run`, authorization_image=`fj-builder:react-native-0.74`, authorization_container_targets=`[/workspace]`, authorization_expires_when=`work_item_closed`），附用户确认原话。
- **Done When**:
  - `npx tsc --noEmit` 退出码 `0`。
  - tsc 输出无 error 行：`grep -c "error TS" <tsc_log>` 返回 `0`。
  - 证据日志已收集。
- **Out of Scope**: 不修改源码（回退 TASK-2）；不写 governance 产物；不做构建（归 TASK-4）。

- **task_id**: TASK-3
- **depends_on**: [TASK-1]
- **expected_file_changes**: []
- **verification_commands**:
  - Docker 内 `cd /workspace && npx tsc --noEmit`（期望退出码 `0`）
  - `grep -c "error TS" <tsc_log>`（期望 `0`）
- **verification_evidence_expected**:
  - { command: "npx tsc --noEmit", expected_exit_code: 0, evidence_type: "tsc_output" }
  - { command: "grep error TS", expected_exit_code: 0, expected_output_pattern: "^0$", evidence_type: "tsc_log_grep" }

---

### TASK-4 Docker assembleDebug 构建验证

**context_block**（executor 必读）：
- **What**: 在 Docker 构建环境（镜像 `fj-builder:react-native-0.74`）内执行 Android Debug 构建 `./gradlew assembleDebug`，验证：
  1. 构建以退出码 0 完成，输出 `BUILD SUCCESSFUL`。
  2. vision-camera 的 CMake + NDK 原生编译任务 SUCCESS（容器已具备工具链）。
  3. gesture-handler / safe-area-context / screens / image-resizer 原生链接成功（无 `platforms.android=null` 跳过）。
  4. 产出 `app-debug.apk`，size > 1 MiB（`min_apk_size_bytes=1048576`）。
  - 本 TASK **不改源码**，仅构建验证。如失败回退 TASK-2 排查。
- **Why**: 构建是"硬门"，覆盖 tsc 无法发现的原生编译（CMake/NDK/Gradle）与打包问题（REQ-3.AC2）。vision-camera 的 CMake 编译是本 WI 核心风险点。
- **Refs**: DD-3, DD-2.A, REQ-3（AC2/AC3）
- **Where**:
  - read_files: [TASK-1 产出的 react-native.config.js（只读确认屏蔽已清），TASK-2 修复的源码（若有）]
  - allowed_write_files: []（构建产物 app-debug.apk 在 build/ 目录，属构建输出非源码）
  - forbidden_files: [所有源码文件，.specforge/ 下所有文件]
- **Constraints**（⚠️ Docker 构建关键注意事项）:
  - **必须用分离模式**：`docker run -d` + 日志轮询（`docker logs -f <cid>` 或定期 `docker logs --tail`），不得前台阻塞（CMake 构建耗时长）。
  - **挂载优先用 `--mount type=bind`**：避免 `-v host:container` 的 `:` 被 Write Guard 误判。示例：`--mount type=bind,source=/mnt/1t_back/project/fj1/fj-android,target=/workspace`。
  - **Gradle 缓存隔离**：加 `--mount type=bind,source=/mnt/1t_back/project/fj1/.gradle-home,target=/root/.gradle` 或 `--project-cache-dir=/tmp/gradle-project-cache` 避免 stale lock。
  - **镜像**：`fj-builder:react-native-0.74`。
  - **构建命令**：`cd /workspace && cd android && ./gradlew assembleDebug`。
  - **Write Guard 授权**：WI-0018 授权已失效，需通过 `sf_hard_stop_resolve` 重新安装 work_item 级授权（authorization_command_family=`docker_run`, authorization_image=`fj-builder:react-native-0.74`, authorization_container_targets=`[/workspace]`, authorization_host_path_prefix=`/mnt/1t_back/project/fj1/fj-android`, authorization_expires_when=`work_item_closed`, authorization_intent=`docker_volume_mount`），附用户确认原话。
  - **失败处理分支**：
    - CMake 任务失败（vision-camera）→ 回退 TASK-2 DD-2.A，确认 NDK 路径 / ABI，最小必要 gradle 配置（不降级）。
    - 原生符号冲突 → TASK-2 DD-2.D 定位冲突模块。
    - JS 打包失败 → 回查 TASK-1 配置 + TASK-2 类型修复。
  - **不通过回退屏蔽绕过**：REQ-3.AC3 明确禁止重新加 `platforms.android=null`。
- **Done When**:
  - 构建命令退出码 `0` + 输出含 `BUILD SUCCESSFUL`。
  - 构建日志含 vision-camera CMake 任务 SUCCESS（`:react-native-vision-camera` 编译成功）。
  - `app-debug.apk` 存在：`test -f fj-android/android/app/build/outputs/apk/debug/app-debug.apk`。
  - APK 大小 > 1 MiB：`stat -c %s <apk>` > 1048576。
- **Out of Scope**: 不做 Release 构建；不做 E2E 运行时验证；不修改源码（回退 TASK-2）；tsc 归 TASK-3。

- **task_id**: TASK-4
- **depends_on**: [TASK-1]
- **expected_file_changes**: []（构建产物非源码）
- **verification_commands**:
  - `docker run -d --mount type=bind,... fj-builder:react-native-0.74 sh -c "cd /workspace/android && ./gradlew assembleDebug"` + 日志轮询（期望退出码 `0` + `BUILD SUCCESSFUL`）
  - 构建日志含 `:react-native-vision-camera` 编译 SUCCESS（期望匹配）
  - `test -f fj-android/android/app/build/outputs/apk/debug/app-debug.apk && echo OK`（期望 stdout `OK`）
  - `stat -c %s fj-android/android/app/build/outputs/apk/debug/app-debug.apk`（期望 > 1048576）
- **verification_evidence_expected**:
  - { command: "docker assembleDebug", expected_exit_code: 0, expected_output_pattern: "BUILD SUCCESSFUL", evidence_type: "build_log" }
  - { command: "grep vision-camera CMake SUCCESS", evidence_type: "build_log_grep" }
  - { command: "test -f app-debug.apk", expected_exit_code: 0, expected_output_pattern: "OK", evidence_type: "file_existence" }
  - { command: "stat apk size", expected_exit_code: 0, evidence_type: "file_size" }

---

## 3. 自检（Self-Check）

| # | 自问自答 | 答案 |
|---|---------|------|
| 1 | 每个 DD 都有对应的 task 覆盖吗？ | ✅ DD-1→TASK-1; DD-2→TASK-2; DD-3→TASK-3+TASK-4 |
| 2 | 每个 REQ 都有 task 覆盖吗？ | ✅ REQ-1→TASK-1; REQ-2→TASK-2; REQ-3→TASK-3+TASK-4 |
| 3 | 每个 task 的 context_block 是否充分？ | ✅ 每个 task 含 What/Why/Refs/Where/Constraints/Done When/Out of Scope，含代码对照 |
| 4 | verification_commands 是否真能机器跑？ | ✅ 全部用 grep/test/node/docker/gradlew/tsc |
| 5 | 并行批次内的 task 是否互相独立？ | ✅ Batch2: TASK-3/TASK-4 只读验证（allowed_write_files=[]） |
| 6 | contingency TASK 是否标注触发条件？ | ✅ TASK-2 明确"仅当 TASK-3/4 报错时触发，否则 skipped" |
| 7 | allowed_write_files 是否具体？ | ✅ TASK-1 为 config.js 绝对路径；TASK-2 列出 4 个 contingency 文件；TASK-3/4 为 [] |
| 8 | forbidden_files 是否包含规格文档？ | ✅ 每个 task 显式排除 requirements/design/tasks |
| 9 | done_when 每条是否可验证？ | ✅ 每条对应 grep/test/docker 命令 |
| 10 | Docker TASK 是否标注分离模式/挂载/授权？ | ✅ TASK-3/4 Constraints 含 docker run -d / --mount / Write Guard 授权失效 / project-cache-dir |
| 11 | 是否覆盖 vision-camera CMake 风险？ | ✅ TASK-4 Done When + 失败分支明确 CMake SUCCESS 验证 |
| 12 | 是否避免 T6 大小超限？ | ✅ TASK-1 ~12 行；TASK-2 contingency 最小改动；TASK-3/4 无源码 |

---

## 4. 完成报告

```json
{
  "status": "success",
  "files_changed": [
    ".specforge/work-items/WI-0020/candidates/tasks.md",
    ".specforge/work-items/WI-0020/trace_delta.md"
  ],
  "structure": {
    "tasks_count": 4,
    "parallel_batches": 2,
    "batch1_independent": ["TASK-1"],
    "batch1_contingency": ["TASK-2"],
    "batch2_verification": ["TASK-3", "TASK-4"],
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
    "TASK-2 为 contingency 任务，首次 tsc/构建通过则 skipped，避免过度设计",
    "DD-2.B 明确 DefaultCameraProvider.isAvailable() 默认不改（保持 false），真实相机实装属相机功能 WI",
    "影响分析标注的 PhotoUploadPort.tsx 路径有误，TASK-2 已校验为 PhotoCapture.tsx",
    "运行时 E2E 验证留给后续质量 WI，本 WI 仅保证类型 + 构建通过"
  ]
}
```

---

**文档结束**。本 Candidate 待 Gate（required_files / schema / trace / spec_consistency / candidate_manifest）通过 + User Decision 后，由 Merge Runner 写入正式 tasks 真相源。
