---
requirements_format: ears
work_item_id: WI-0018
workflow_type: feature_spec
workflow_path: requirement_change_path
date: 2026-07-05
title: 照片拍摄 + 分片上传骨架激活（降级模式）需求规格（Candidate）
target_path: .specforge/project/modules/core/requirements.md
operation: append
base_spec_version: PSV-0001
---

# Requirements Candidate — WI-0018 照片拍摄 + 分片上传骨架激活（降级模式）

> 本文件为 Requirements Candidate（§8.2），拟追加写入正式规格真相源 `core/requirements.md`。
> 仅描述"做什么"与"验收什么"，不涉及架构选型与实现细节（属 sf-design 职责）。

## 简介

本规格激活飞检安卓端 `fj-android` 已就绪的照片骨架代码（`PhotoUploadQueue` 388 行 + `PhotoCapture` 296 行）的**集成路径**：新建 PhotoUploadQueue 的 React Context 注入端口，在 AppRoot 中实例化队列并通过 Provider 下发，使 WI-0017 已激活的 `IssueEvidenceScreen` 进入拍照流程时不崩溃。**降级模式**下（TD-WI0018-001）：`react-native-vision-camera` / `react-native-image-resizer` 原生模块保持屏蔽，相机端口走 `DefaultCameraProvider`（`isAvailable()=false`），UI 显示"相机未配置"提示；`PhotoUploadQueue` 实例化但队列空转（无照片可上传）。后续 WI 解除原生屏蔽后，仅需替换 `CameraPortProvider` 注入即可启用真实拍照，照片自然流入本队列。

**前置事实（仅供设计参考，不作为需求约束）**：
- `src/api/PhotoUploadQueue.ts`（388 行）：完整骨架，构造函数 `constructor(apiClient: ApiClient, reader?: PhotoChunkReader)`，默认 `FetchBlobChunkReader`；暴露 `uploadPhoto / getEntry / getAllEntries / countByStatus / resetToPending / remove` 等接口；内部使用内存 `Map` 维护队列，不直接依赖 WatermelonDB。
- `src/components/photo/PhotoCapture.tsx`（296 行）：已内置 `CameraProvider` / `GpsProvider` 端口注入机制（`CameraPortProvider` + `useCameraPorts`）；`DefaultCameraProvider.isAvailable()` 返回 `false`，`capture()` 抛出"CameraProvider 未注入"错误；按钮在不可用时显示"（相机未配置）"灰态并 Alert 提示。
- `src/di/SyncEnginePort.tsx`（WI-0015 已合并 200 行）：提供 `SyncEngineProvider` / `useSyncEngine` / `SyncEngineInitializer` 注入范式，本 WI 的 `PhotoUploadPort` 沿用同一模式。
- `src/AppRoot.tsx`（WI-0015 已合并 99 行）：`AppInner` 组件位于 `DatabaseProvider > SyncEngineInitializer` 内部，已调用 `useAuth()`，是构造 `PhotoUploadQueue`（仅需 `apiClient`）并包裹 `PhotoUploadProvider` 的理想挂载点。
- `IssueEvidenceScreen.tsx`（WI-0017 已激活 915 行）：已 `import PhotoCapture`，拍照按钮调用 `useCameraPorts()`；降级模式下按钮灰态、点击 Alert，本 WI 不修改其内部实现。

本 WI 完成后，组件树新增一层：`... > SyncEngineInitializer > PhotoUploadProvider > RootNavigator`；任意业务屏幕可通过 `usePhotoUploadQueue()` 获取队列实例（降级模式下实例存在但为空）。

## 术语表

| 术语 | 定义 |
|------|------|
| PhotoUploadQueue | 飞检安卓端照片分片上传队列（388 行骨架），负责分片上传 / 断点续传 / 指数退避重试 / 完成确认；构造依赖 `ApiClient`，文件读取依赖可注入的 `PhotoChunkReader`。 |
| PhotoUploadPort | 本 WI 新建的 React Context 注入端口（`src/di/PhotoUploadPort.tsx`），将 `PhotoUploadQueue` 实例下发给组件树，范式与 `SyncEnginePort` 一致。 |
| PhotoUploadProvider | `PhotoUploadPort` 导出的 React Context Provider 组件，接受 `queue` 实例 prop 并注入 Context。 |
| usePhotoUploadQueue | `PhotoUploadPort` 导出的 hook，消费 Context 获取 `PhotoUploadQueue` 实例；未挂载 Provider 时返回 `null`（降级）。 |
| DefaultCameraProvider | `PhotoCapture.tsx` 内置的默认相机端口实现，`isAvailable()` 恒返回 `false`，`capture()` 抛错；本 WI 降级模式下唯一可用的相机端口。 |
| CameraPortProvider | `PhotoCapture.tsx` 内置的相机 + GPS 端口注入 Provider；后续 WI 解除 vision-camera 屏蔽后通过它注入真实实现。 |
| TD-WI0018-001 | 本 WI 的技术决策记录：照片链路降级模式契约 —— 相机不可用提示 + 队列空转，原生模块屏蔽留给后续 WI。 |
| 降级模式 | 相机原生模块（vision-camera / image-resizer）保持屏蔽，使用 DefaultCameraProvider，UI 明确提示"相机未配置"，PhotoUploadQueue 实例化但无照片可传的运行形态。 |
| FetchBlobChunkReader | `PhotoUploadQueue` 内置的默认分片读取实现，基于 `fetch(file://)` + `Blob.slice`，适用中小图/调试；生产大图应注入原生 IO 实现。 |
| vision-camera | `react-native-vision-camera`，原生相机模块；本 WI 保持屏蔽（CameraX 编译风险），解除属后续 WI。 |
| image-resizer | `react-native-image-resizer`，原生图片压缩模块；本 WI 保持屏蔽，解除属后续 WI。 |
| ApiClient | 飞检安卓端 HTTP 通道（WI-0013 已激活），`PhotoUploadQueue` 通过其 `postFormData` / `post` 上传分片与完成确认。 |
| SyncEngineInitializer | WI-0015 的 SyncEngine 初始化组件，本 WI 的 PhotoUploadProvider 挂载于其内部。 |
| tsc --noEmit | TypeScript 类型检查模式，仅校验类型不产出 JS。 |
| Docker 构建环境 | 镜像 `fj-builder:react-native-0.74`，承载 React Native 0.74 编译工具链。 |

## 需求

### REQ-1 PhotoUploadPort 注入端口新建

**用户故事**：作为业务屏幕开发者，我希望有一个 React Context 注入端口（与 `SyncEnginePort` 同范式）将 `PhotoUploadQueue` 实例下发到整棵组件树，以便任意需要照片上传能力的屏幕（如 `IssueEvidenceScreen`、未来的上传调度器）通过 hook 获取可用实例，而不必通过模块级全局变量传递。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 在 `fj-android/src/di/PhotoUploadPort.tsx`（新建）中导出三个符号：`PhotoUploadProvider`（React 组件，接受 `queue: PhotoUploadQueue | null` 与 `children` props）、`usePhotoUploadQueue`（hook，返回 `PhotoUploadQueue | null`）、`PhotoUploadContext`（React Context，默认值为 `null`）。
2. [Ubiquitous] THE 系统 SHALL 让 `PhotoUploadProvider` 通过 `createContext` + `Context.Provider` 把传入的 `queue` 实例注入 Context，不在此组件内部构造 `PhotoUploadQueue`（实例由调用方 AppRoot 构造并作为 prop 传入，保持单一职责与可测试性）。
3. [Unwanted-behavior] IF `usePhotoUploadQueue()` 在未挂载 `PhotoUploadProvider` 的组件子树中被调用, THEN THE 系统 SHALL 返回 `null`（不抛错），由调用方降级处理。

**优先级**：Must

**依赖**：WI-0015（SyncEnginePort 范式 + ApiClient 已激活）、PhotoUploadQueue 骨架已就绪

---

### REQ-2 PhotoUploadQueue 实例化（基于 ApiClient）

**用户故事**：作为 AppRoot，我希望在应用就绪后基于 `useAuth().apiClient` 实例化一个真实的 `PhotoUploadQueue`（采用默认 `FetchBlobChunkReader`），以便照片上传能力在 App 全局可用；降级模式下虽然队列空转，但实例就位可供未来 WI 直接消费。

**验收标准**：

1. [Event-driven] WHEN AppRoot 处于 `ready` 状态（数据库初始化成功）且 `AppInner` 组件渲染时, THE 系统 SHALL 调用 `useAuth()` 获取 `apiClient`，并在 `apiClient` 非 null 时通过 `new PhotoUploadQueue(apiClient)`（采用默认 `FetchBlobChunkReader`，不显式传 reader）构造一个 `PhotoUploadQueue` 实例。
2. [State-driven] WHILE `PhotoUploadProvider` 已挂载且 `PhotoUploadQueue` 实例已构造完成, THE 系统 SHALL 保证在被 `PhotoUploadProvider` 包裹的任意子组件中调用 `usePhotoUploadQueue()` 返回**同一个稳定**的 `PhotoUploadQueue` 实例（引用相等），不因每次 render 重建（须用 `useMemo` 稳定引用，依赖数组为 `[apiClient]`）。
3. [Unwanted-behavior] IF `apiClient` 为 `null`（认证尚未就绪）, THEN THE 系统 SHALL 不构造 `PhotoUploadQueue`（`useMemo` 返回 `null`），并将 `null` 传入 `PhotoUploadProvider`，下游 `usePhotoUploadQueue()` 返回 `null` 由屏幕层降级，不抛出未捕获异常。

**优先级**：Must

**依赖**：REQ-1（PhotoUploadPort 注入端口）、WI-0015 DD-5.1（AuthContext 已通过 Context 暴露 `apiClient`）

---

### REQ-3 AppRoot 集成 PhotoUploadProvider

**用户故事**：作为业务屏幕，我希望 App 根组件把 `PhotoUploadProvider` 挂载在 `DatabaseProvider` / `SyncEngineInitializer` 之内、`RootNavigator` 之外，以便所有业务屏幕既能拿到同步引擎，也能拿到照片上传队列，且嵌套顺序满足各 Provider 的依赖约束。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 在 `fj-android/src/AppRoot.tsx` 中维持如下从外到内的组件嵌套顺序：`DatabaseProvider` > `SyncEngineInitializer` > `PhotoUploadProvider`（NEW）> `AppInner`（含 `RootNavigator`）；本 WI 不改动 loading / error 分支与 `DatabaseProvider` / `SyncEngineInitializer` 的现有挂载。
2. [Ubiquitous] THE 系统 SHALL 将 `PhotoUploadQueue` 实例的构造与 `PhotoUploadProvider` 的包裹集中在 `AppInner` 组件内（`AppInner` 已位于 `AuthProvider` + `DatabaseProvider` + `SyncEngineInitializer` 子树中，`useAuth()` 可用），不在 `AppRoot` 顶层或 `App.tsx` 中构造。
3. [Event-driven] WHEN 任意 `RootNavigator` 子屏幕（如 `IssueEvidenceScreen`）调用 `usePhotoUploadQueue()`, THE 系统 SHALL 返回 REQ-2 构造的非 null `PhotoUploadQueue` 实例（在 `apiClient` 就绪前提下），屏幕层可调用 `getAllEntries()` / `countByStatus(...)` 等查询接口。

**优先级**：Must

**依赖**：REQ-1、REQ-2

---

### REQ-4 IssueEvidenceScreen 降级模式验证（相机不可用提示）

**用户故事**：作为检查员，我希望在 `IssueEvidenceScreen`（WI-0017 已激活）点击拍照按钮时，因原生相机模块未解除屏蔽而看到明确的"相机未配置"提示（而非崩溃或无响应），同时照片上传队列保持空转无副作用，以便 App 其余功能不受影响、后续 WI 解除屏蔽后即可启用真实拍照。

**验收标准**：

1. [Optional-feature] WHERE `DefaultCameraProvider.isAvailable()` 返回 `false`（降级模式，TD-WI0018-001）, THE 系统 SHALL 在 `IssueEvidenceScreen` 的拍照按钮（`PhotoCapture` 组件）上显示文案"拍照取证（相机未配置）"并应用灰态样式（`buttonUnavailable`），不调用任何原生相机 API。
2. [Event-driven] WHEN 检查员在降级模式下点击拍照按钮, THE 系统 SHALL 弹出 `Alert`（标题"相机未配置"）说明"当前未注入原生相机模块。请在 native 集成 react-native-image-picker 或 expo-camera 后，通过 CameraPortProvider 注入实现。"，不抛出未捕获异常、不导航离开当前屏幕。
3. [State-driven] WHILE 处于降级模式且无任何照片被捕获, THE 系统 SHALL 保证 `PhotoUploadQueue` 实例的 `getAllEntries()` 返回空数组、`countByStatus('uploading')` 返回 `0`、`countByStatus('pending')` 返回 `0`（队列空转，无网络请求、无副作用）。

**优先级**：Must

**依赖**：REQ-3、WI-0017（IssueEvidenceScreen 已激活）、PhotoCapture 骨架降级逻辑已就绪

---

### REQ-5 TypeScript 类型检查 + Docker 构建验证

**用户故事**：作为安卓端开发者 / 发布工程师，我希望本 WI 的集成改动通过 TypeScript 严格类型检查与 Docker Debug 构建，以便确信新建的 `PhotoUploadPort.tsx` 类型正确、`AppRoot.tsx` 的 Provider 嵌套类型对齐、整个改动可成功打包进 APK 而不引入原生编译回归。

**验收标准**：

1. [Event-driven] WHEN 在 `fj-android` 工程根目录（或 Docker 容器内 `/workspace`）执行 `npx tsc --noEmit`, THE 系统 SHALL 以退出码 `0` 完成，无任何 TypeScript 类型错误（含 `PhotoUploadPort.tsx` 的 Context / Provider / hook 签名、`AppRoot.tsx` 中 `PhotoUploadProvider` 的 props 类型、`PhotoUploadQueue` 构造函数参数对齐）。
2. [Event-driven] WHEN 在 Docker 容器（镜像 `fj-builder:react-native-0.74`）内执行 `./gradlew assembleDebug`, THE 系统 SHALL 以退出码 `0` 完成，产出 `fj-android/android/app/build/outputs/apk/debug/app-debug.apk` 且文件大小 > `<min_apk_size_bytes: 1048576>`（可配置，默认 1 MiB）。
3. [Unwanted-behavior] IF 类型检查或构建失败（如 `PhotoUploadPort` 导出缺失、`AppRoot` import 路径错误、Provider 嵌套破坏 `useAuth` / `useDatabase` 的 Context 边界）, THEN THE 系统 SHALL 在本 WI 内修正，不通过 `any` / `@ts-ignore` / `as unknown as` 绕过类型错误，也不通过回退 `PhotoUploadProvider` 挂载回避问题。

**优先级**：Must

**依赖**：REQ-1、REQ-2、REQ-3、REQ-4

---

## 非目标（Out of Scope）

以下事项**不属于**本 WI 范围，如有需要应另立 WI：

1. **解除 vision-camera 屏蔽** — CameraX 编译风险大，留给后续 WI；本 WI 保持屏蔽，相机走 `DefaultCameraProvider` 降级。
2. **解除 image-resizer 屏蔽** — 同上，照片压缩原生模块保持屏蔽。
3. **真实拍照功能** — 需原生相机模块解除屏蔽 + 注入真实 `CameraProvider`，属后续 WI。
4. **真实照片分片上传端到端测试** — 需后端 `/api/v1/photos/upload-chunk` + `/complete` 就绪 + 真实照片文件；本 WI 仅激活队列实例化与注入，队列空转。
5. **PhotoUploadQueue 内部逻辑修改** — 388 行骨架已完整（分片 / 断点续传 / 退避 / 完成确认），本 WI 不改其内部实现，仅做 React 接线。
6. **PhotoCapture / PhotoCompressor / WatermarkOverlay 内部修改** — 骨架已含降级逻辑，本 WI 不修改其内部实现。
7. **照片上传调度器 / 后台重试任务** — 队列的调度（定时拉起 `uploadPhoto`）属后续 WI；本 WI 仅保证实例可被获取。
8. **IssueEvidenceScreen 内部业务逻辑改动** — WI-0017 已激活该屏幕，本 WI 仅依赖其既有降级行为，不修改其代码。
9. **原生 `PhotoChunkReader` 实现** — 生产大图应注入基于 `react-native-fs` / 自定义 native module 的实现；本 WI 使用默认 `FetchBlobChunkReader`（降级模式下不会被调用）。
10. **单元测试 / E2E 测试套件** — 本 WI 仅保证 TypeScript 类型检查 + Docker 构建通过。
11. **Release APK 构建** — 本 WI 仅产出 Debug APK；Release 签名与 ProGuard 由 WI-0014 负责。

## 配置点清单

| 配置项 | 默认值 | 位置 | 说明 |
|--------|--------|------|------|
| `min_apk_size_bytes` | 1048576 (1 MiB) | REQ-5.2 | 验证 `app-debug.apk` 非空的最小体积阈值，与 WI-0015 / WI-0017 同源。 |

---

## 自检（Self-Check）

| # | 自问自答 | 答案 |
|---|---------|------|
| 1 | 是否有含"等"/"包括但不限于"的未拆分需求？ | 否。REQ-1.1 明确三个导出符号（Provider/hook/Context）；REQ-3.1 显式列出嵌套顺序每一层；降级模式约束都点名 `DefaultCameraProvider.isAvailable()=false` 与 `getAllEntries()` 返回空数组等具体可验证事实，不写"等提示"。 |
| 2 | 每条 AC 是否含可测量值或可执行命令？ | 是。`usePhotoUploadQueue()` 返回 `null`/非 null、`useMemo` 依赖 `[apiClient]`、引用相等、`Alert` 标题"相机未配置"、`getAllEntries()` 空数组、`countByStatus` 返回 `0`、`npx tsc --noEmit` 退出码 0、APK size > 1048576 字节。 |
| 3 | 是否避免编写设计/任务/代码内容？ | 是。仅描述"必须存在哪些导出符号"、"嵌套顺序"、"降级行为契约"；具体 Context 实现、import 写法、组件接线由 DD 决定，TASK 由 sf-task-planner 拆分。 |
| 4 | 是否覆盖 intake 的全部 IN-SCOPE 项？ | 是。①PhotoUploadPort 新建 → REQ-1；②PhotoUploadQueue 实例化 + 注入 → REQ-2 + REQ-3；③IssueEvidenceScreen 降级验证 → REQ-4；④tsc + Docker → REQ-5。 |
| 5 | 是否标注了 TD-WI0018-001 降级契约？ | 是，REQ-4.1/4.2/4.3 三条 AC 共同覆盖"相机不可用提示 + 队列空转无副作用"；术语表 + 非目标 1~4 隔离原生模块解除屏蔽。 |
| 6 | 是否覆盖"队列空转无副作用"关键风险？ | 是，REQ-4.3 显式要求 `getAllEntries()` 空 + `countByStatus` 为 0 + 无网络请求。 |
| 7 | 是否覆盖嵌套顺序 `DatabaseProvider > SyncEngineInitializer > PhotoUploadProvider > AppInner`？ | 是，REQ-3.1 显式声明，REQ-3.2 补充构造集中在 AppInner。 |
| 8 | 是否声明与 WI-0015 / WI-0017 / 后续 WI 的边界？ | 是，每个 REQ 末尾"依赖"章节 + 非目标 1~11 共同隔离。 |
| 9 | 是否处理了"apiClient 为 null 时仍渲染"边界？ | 是，REQ-2.3 显式要求 useMemo 返回 null + Provider 接受 null + 下游降级不抛错。 |
| 10 | 是否声明 REQ 之间的依赖关系？ | 是，每个 REQ 末尾标注"依赖"。 |
| 11 | 是否避免读取 host-profile.json / prod-environment.md？ | 是，全程未读取技术事实源，仅基于业务行为描述与代码骨架事实（intake.md + impact_analysis.md + 已读源码注释）。 |
| 12 | PhotoUploadQueue 构造依赖是否与代码事实一致？ | 是，基于 `PhotoUploadQueue.ts` L205 `constructor(apiClient: ApiClient, reader?: PhotoChunkReader)`，REQ-2.1 明确仅传 `apiClient`、采用默认 reader，不臆造 Database 依赖。 |
