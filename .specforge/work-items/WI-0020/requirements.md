---
requirements_format: ears
work_item_id: WI-0020
workflow_type: feature_spec
workflow_path: requirement_change_path
date: 2026-07-05
title: 解除屏蔽 5 个 RN 原生模块需求规格（Candidate）
target_path: .specforge/project/modules/core/requirements.md
operation: append
base_spec_version: PSV-0008
---

# Requirements Candidate — WI-0020 解除屏蔽 5 个 RN 原生模块

> 本文件为 Requirements Candidate（§8.2），拟追加写入正式规格真相源 `core/requirements.md`。
> 仅描述"做什么"与"验收什么"，不涉及架构选型与实现细节（属 sf-design 职责）。

## 简介

本规格将飞检安卓端 `fj-android` 当前在 `react-native.config.js` 中屏蔽的 5 个 React Native 原生模块全部解除屏蔽，恢复 React Native CLI 的原生 autolinking，并修复因解除屏蔽而暴露的编译错误，最终通过 TypeScript 类型检查与 Docker Debug 构建。

被解除屏蔽的 5 个原生模块：

| 模块 | 屏蔽前状态 | 解除屏蔽后作用 |
|------|-----------|---------------|
| `react-native-vision-camera` | `platforms.android = null`（原生链接关闭） | 启用 CMake + NDK 原生相机管线（容器已具备工具链） |
| `react-native-image-resizer` | `platforms.android = null` | 启用原生图片压缩（替代降级 JS 压缩） |
| `react-native-gesture-handler` | `platforms.android = null` | 启用原生手势导航（React Navigation 标准依赖） |
| `react-native-safe-area-context` | `platforms.android = null` | 启用 SafeAreaProvider 原生 notch/刘海屏适配 |
| `react-native-screens` | `platforms.android = null` | 启用原生屏幕栈管理（React Navigation 标准依赖，内存优化） |

解除屏蔽后，相机/图片压缩功能脱离降级模式，React Navigation 获得原生手势与原生屏幕优化，SafeArea 支持 notch 适配。

**前置事实（仅供设计参考，不作为需求约束）**：
- `react-native.config.js`（17 行）当前 `dependencies` 对象列出 5 个模块，每个 `{ platforms: { android: null } }`，注释标注"临时屏蔽可能编译失败的原生模块 autolinking"。
- `vision-camera` 需要 CMake + NDK，容器镜像 `fj-builder:react-native-0.74` 已具备该工具链（intake 约束）。
- `gesture-handler` / `safe-area-context` / `screens` 是 React Navigation 标准依赖，JS 层已 import 但原生链接被屏蔽（降级为 JS fallback）。
- 影响分析列出两个可能的代码修复点：①相机降级开关；②SafeAreaProvider 包裹。**注意**：影响分析标注的 `src/di/PhotoUploadPort.tsx` 路径与实际代码事实不符——`DefaultCameraProvider` 实际定义于 `src/components/photo/PhotoCapture.tsx`（L114-133），`PhotoUploadPort.tsx` 仅为 React Context 注入端口（不含 `isAvailable` 实现）。本候选以代码事实源为准，设计阶段需校验。

## 术语表

| 术语 | 定义 |
|------|------|
| autolinking | React Native CLI 在构建期自动链接 `node_modules` 中原生模块（Android 的 Gradle / CMake）的机制。 |
| 屏蔽 | 通过 `react-native.config.js` 的 `dependencies.<pkg>.platforms.android = null` 关闭某模块在 Android 平台的原生链接。 |
| 降级模式 | 原生链接被屏蔽时，JS 层 import 仍可用但运行时回退到非原生实现（如 JS 手势、无 SafeArea 适配）。 |
| vision-camera | `react-native-vision-camera`，原生相机模块，依赖 CMake + Android NDK 编译原生层。 |
| image-resizer | `react-native-image-resizer`，原生图片压缩/缩放模块。 |
| gesture-handler | `react-native-gesture-handler`，React Navigation 标准依赖，提供原生手势识别。 |
| safe-area-context | `react-native-safe-area-context`，React Navigation 标准依赖，提供 SafeAreaProvider notch 适配。 |
| screens | `react-native-screens`，React Navigation 标准依赖，提供原生屏幕栈管理。 |
| DefaultCameraProvider | 定义于 `src/components/photo/PhotoCapture.tsx`（L114-133）的相机降级实现，`isAvailable()` 当前返回 `false`，`capture()` 抛错。 |
| fj-builder:react-native-0.74 | 项目约定的 Docker 构建镜像，承载 RN 0.74 + CMake + NDK 工具链。 |
| tsc --noEmit | TypeScript 类型检查模式，仅校验类型不产出 JS。 |
| BUILD SUCCESSFUL | Gradle 构建成功标志，对应退出码 0。 |

## 需求

### REQ-1 解除 5 个原生模块的 autolinking 屏蔽

**用户故事**：作为安卓端开发者，我希望 `react-native.config.js` 不再屏蔽 vision-camera / image-resizer / gesture-handler / safe-area-context / screens 五个原生模块，以便 React Native CLI 在构建期能自动链接这些模块的原生层，使相机、图片压缩、手势导航、SafeArea、原生屏幕栈全部脱离降级模式。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 修改 `fj-android/react-native.config.js`,使其不再包含 `react-native-vision-camera` / `react-native-image-resizer` / `react-native-gesture-handler` / `react-native-safe-area-context` / `react-native-screens` 这 5 个键的 `platforms: { android: null }` 屏蔽条目（dependencies 对象清空为 `{}` 或整段注释保留历史说明）。
2. [Event-driven] WHEN React Native CLI 在构建期读取 `react-native.config.js`, THE 系统 SHALL 对上述 5 个模块恢复默认 autolinking 行为（即 CLI 视它们为普通依赖，按各自包内 `react-native.config.js` / 原生目录约定自动链接 Android 原生代码）。
3. [Unwanted-behavior] IF `react-native.config.js` 改动导致语法错误或 CLI 解析失败, THEN THE 系统 SHALL 在本 WI 内修正（保留合法的 `module.exports` 结构），不通过删除整个配置文件或回退屏蔽条目绕过。

**优先级**：Must

**依赖**：无（本 WI 起点）

---

### REQ-2 修复因解除屏蔽而暴露的编译错误

**用户故事**：作为安卓端开发者，我希望解除屏蔽后出现的所有编译错误（CMake / Gradle / Java / Kotlin / TypeScript）在本 WI 内被修复，以便 5 个模块的原生链接与 JS 引用能同时通过类型检查与构建，而不需要新建 WI 中断流程。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 确保 `react-native-vision-camera` 的 CMake + NDK 原生编译在 Docker 容器（镜像 `fj-builder:react-native-0.74`，工具链已具备）内成功，不通过屏蔽 vision-camera 或降级 NDK 版本绕过。
2. [Event-driven] WHEN 解除屏蔽后 TypeScript 类型检查或 Gradle 构建报错（如 React Navigation 原生依赖缺失、SafeAreaProvider 未包裹、相机降级开关需要调整、原生符号冲突）, THE 系统 SHALL 在本 WI 内定位并修复，修复限于使编译通过的最小必要改动，不改变现有业务逻辑（约束）。
3. [Unwanted-behavior] IF 某个编译错误无法在本 WI 范围内修复或修复会破坏现有业务逻辑, THEN THE 系统 SHALL 在验证报告中明确记录未解决项与阻塞原因，不通过 `any` / `@ts-ignore` / 回退屏蔽条目 / 升级依赖版本（约束）绕过。

**优先级**：Must

**依赖**：REQ-1（解除屏蔽先行，编译错误随后暴露与修复）

---

### REQ-3 TypeScript 类型检查 + Docker Debug 构建验证

**用户故事**：作为安卓端开发者 / 发布工程师，我希望本 WI 的屏蔽解除与编译修复改动通过 TypeScript 严格类型检查与 Docker Debug 构建，以便确信 5 个原生模块已成功链接、整个工程可成功打包进 APK 而不引入编译回归。

**验收标准**：

1. [Event-driven] WHEN 在 `fj-android` 工程根目录（或 Docker 容器内 `/workspace`）执行 `npx tsc --noEmit`, THE 系统 SHALL 以退出码 `0` 完成，无任何 TypeScript 类型错误（含 5 个原生模块的 JS 层类型导出、React Navigation 原生依赖类型、SafeArea/gesture 类型）。
2. [Event-driven] WHEN 在 Docker 容器（镜像 `fj-builder:react-native-0.74`）内执行 `./gradlew assembleDebug`, THE 系统 SHALL 以退出码 `0` 完成（输出 `BUILD SUCCESSFUL`），产出 `fj-android/android/app/build/outputs/apk/debug/app-debug.apk` 且文件大小 > `<min_apk_size_bytes: 1048576>`（可配置，默认 1 MiB）。
3. [Unwanted-behavior] IF 类型检查或构建失败且无法在本 WI 内修复, THEN THE 系统 SHALL 不通过屏蔽条目回退 / `any` / `@ts-ignore` / 依赖升级绕过（约束），并在验证报告中如实记录失败。

**优先级**：Must

**依赖**：REQ-1、REQ-2

---

## 非目标（Out of Scope）

以下事项**不属于**本 WI 范围，如有需要应另立 WI：

1. **业务逻辑修改** — intake 约束"不改变现有业务逻辑"，本 WI 仅恢复原生链接与修复编译。
2. **依赖版本升级** — intake 约束"不升级依赖版本"，5 个模块锁定当前 `package.json` 版本。
3. **Release APK 构建** — 本 WI 仅产出 Debug APK（沿用 WI-0015~0019 验证基准）。
4. **运行时 E2E 验证** — 真实相机拍照 / 图片压缩 / 手势导航 / SafeArea 渲染的运行时验证留给后续质量 WI，本 WI 仅保证类型 + 构建通过。
5. **新增 RnCameraProvider 实装** — 真实 vision-camera 拍照实现（替代 DefaultCameraProvider 抛错）属相机功能实装 WI，本 WI 仅保证原生链接成功，不注入新 CameraProvider 实现。
6. **单元测试 / E2E 测试套件** — 本 WI 仅保证 TypeScript 类型检查 + Docker 构建通过。
7. **新增第六个原生模块** — 仅限 intake 列出的 5 个模块。

## 配置点清单

| 配置项 | 默认值 | 位置 | 说明 |
|--------|--------|------|------|
| `min_apk_size_bytes` | 1048576 (1 MiB) | REQ-3.2 | 验证 `app-debug.apk` 非空的最小体积阈值，与 WI-0015~0019 同源。 |

---

## 自检（Self-Check）

| # | 自问自答 | 答案 |
|---|---------|------|
| 1 | 是否有含"等"/"包括但不限于"的未拆分需求？ | 否。REQ-1（解除屏蔽）/REQ-2（编译修复）/REQ-3（验证）各自独立编号；每条 AC 点名具体模块、文件、命令、退出码。 |
| 2 | 每条 AC 是否含可测量值或可执行命令？ | 是。`platforms.android=null` 屏蔽条目移除、`npx tsc --noEmit` 退出码 0、`assembleDebug` 退出码 0 + `BUILD SUCCESSFUL`、APK size > 1048576 字节。 |
| 3 | 是否避免编写设计/任务/代码内容？ | 是。仅描述"解除哪些屏蔽"、"修复什么类别的错误"、"验证什么"；具体 config.js 写法、CMake 配置、修复策略由 DD 决定，TASK 由 sf-task-planner 拆分。 |
| 4 | 是否覆盖 intake 的全部 IN-SCOPE 项？ | 是。①config.js 清空屏蔽列表 → REQ-1；②修复编译错误（CMake/Gradle/Java/Kotlin）→ REQ-2；③tsc + Debug APK 构建 → REQ-3。 |
| 5 | 是否识别并标注了影响分析的路径错误？ | 是，简介"前置事实"与术语表明确指出 `DefaultCameraProvider` 实际位于 `PhotoCapture.tsx` 而非影响分析标注的 `PhotoUploadPort.tsx`，以代码事实源为准。 |
| 6 | 是否声明 REQ 之间的依赖关系？ | 是，每个 REQ 末尾标注"依赖"；REQ-2 依赖 REQ-1；REQ-3 依赖 REQ-1+REQ-2。 |
| 7 | 是否标注了约束（不改业务逻辑/不升级版本）？ | 是，REQ-2.AC2 / AC3 与 Out of Scope 明确约束，与 intake 一致。 |
| 8 | 是否避免读取 host-profile.json / prod-environment.md？ | 是，全程未读取技术事实源，仅基于 intake、impact_analysis、代码骨架事实。 |
| 9 | 非功能性需求是否可测量？ | 是，REQ-3 用退出码 0、`BUILD SUCCESSFUL`、APK size > 1048576 字节，不用"应该高效"。 |
