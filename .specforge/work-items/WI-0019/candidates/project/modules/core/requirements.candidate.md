---
requirements_format: ears
work_item_id: WI-0019
workflow_type: feature_spec
workflow_path: requirement_change_path
date: 2026-07-05
title: 问题篮子 + 提交日报屏幕集成需求规格（Candidate）
target_path: .specforge/project/modules/core/requirements.md
operation: append
base_spec_version: PSV-0001
---

# Requirements Candidate — WI-0019 问题篮子 + 提交日报屏幕集成

> 本文件为 Requirements Candidate（§8.2），拟追加写入正式规格真相源 `core/requirements.md`。
> 仅描述"做什么"与"验收什么"，不涉及架构选型与实现细节（属 sf-design 职责）。

## 简介

本规格将飞检安卓端 `fj-android` 已就绪的两个屏幕骨架集成到 AppNavigator 导航树：
1. **IssueBasketScreen（464 行骨架，`screens/issue-basket/`）**：今日草稿问题列表页，替换 AppNavigator 中 IssueBasket Tab 的占位组件（当前为 AppNavigator.tsx L124-131 内联定义的同名本地函数 `IssueBasketScreen`，仅渲染 SimplePlaceholder）。
2. **SubmitReportScreen（607 行骨架，`screens/submit/`）**：提交日报 + 同步状态页，替换 AppNavigator 的 InspectionStack 内 `SubmitReport` 路由的占位渲染（当前 L100-110 为 children 回调返回 SimplePlaceholder）。

集成后，检查员可通过底部 Tab 直接进入"问题篮子"查看今日草拟问题，并在检查流程中导航到"提交日报"页触发同步。

**前置事实（仅供设计参考，不作为需求约束）**：
- AppNavigator.tsx（206 行骨架）：底部 3 Tab（Today / IssueBasket / Profile）；Today Tab 内嵌 InspectionStack（5 路由：TodayInspection / TaskDetail / InspectionInProgress / SubmitReport / IssueEvidence）。当前 IssueBasket Tab（L171-175）挂载同名本地占位函数，SubmitReport 路由（L100-110）为 children 回调占位。
- IssueBasketScreen.tsx（464 行骨架）：`export default function IssueBasketScreen(...)`，含 FlatList 草稿问题渲染、删除/编辑草稿、底部"提交"按钮导航到 SubmitReport。
- SubmitReportScreen.tsx（607 行骨架）：`export default function SubmitReportScreen(...)`，含今日检查总结、照片/文本同步状态、提交按钮触发 `useSyncEngine().fullSync()`，依赖 `route.params.taskId`。
- SubmitReportScreen 依赖 WI-0015 的 SyncEnginePort（已合并），IssueBasketScreen 依赖 WatermelonDB（WI-0015 已激活）。

## 术语表

| 术语 | 定义 |
|------|------|
| AppNavigator | 飞检安卓端根导航组件（206 行骨架），管理底部 Tab 与 InspectionStack 嵌套路由。 |
| IssueBasket Tab | AppNavigator 底部 Tab 之一，渲染问题篮子页；当前挂载同名本地占位函数（L171-175）。 |
| SubmitReport 路由 | InspectionStack 内 5 个路由之一，渲染提交日报页；当前为 children 回调占位（L100-110）。 |
| IssueBasketScreen | 问题篮子页真实实现（464 行骨架，`screens/issue-basket/IssueBasketScreen.tsx`），`export default`，含草稿问题列表与提交入口。 |
| SubmitReportScreen | 提交日报页真实实现（607 行骨架，`screens/submit/SubmitReportScreen.tsx`），`export default`，含同步状态展示与提交触发。 |
| SimplePlaceholder | AppNavigator.tsx 内联定义的通用占位组件（L58-68），渲染标题 + 副标题文本。 |
| 名称冲突 | AppNavigator.tsx L124 本地定义的占位函数 `IssueBasketScreen` 与真实屏幕默认导出同名，集成时必须移除本地占位避免 import 命名冲突。 |
| InspectionStack | Today Tab 内的嵌套 Stack Navigator，5 路由对应检查员核心工作流。 |
| InspectionStackParamList | InspectionStack 的路由参数表类型，定义于 TodayInspectionScreen.tsx。 |
| tsc --noEmit | TypeScript 类型检查模式，仅校验类型不产出 JS。 |
| Docker 构建环境 | 镜像 `fj-builder:react-native-0.74`，承载 React Native 0.74 编译工具链。 |

## 需求

### REQ-1 IssueBasket Tab 集成（替换占位为真实 IssueBasketScreen）

**用户故事**：作为检查员，我希望点击底部"问题篮子"Tab 时看到真实的今日草稿问题列表页（而非"骨架占位"文本），以便我能浏览、删除、编辑今日草拟的问题并最终提交到日报。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 在 `fj-android/src/navigation/AppNavigator.tsx` 中通过 `import IssueBasketScreen from '../screens/issue-basket/IssueBasketScreen';` 引入真实屏幕组件，并移除文件内 L124-131 同名的本地占位函数 `function IssueBasketScreen()`（消除命名冲突），使 IssueBasket Tab 的 `component` 属性指向真实屏幕。
2. [Event-driven] WHEN AppNavigator 渲染 IssueBasket Tab 时, THE 系统 SHALL 将真实 `IssueBasketScreen` 组件挂载为该 Tab 的 `component`，保留现有 Tab 配置（`name="IssueBasket"`、`options={{ title: '问题篮子', tabBarLabel: '问题篮子' }}`）不变。
3. [Unwanted-behavior] IF 集成后 IssueBasketScreen 因 props / navigation 类型不匹配导致运行时崩溃或类型错误, THEN THE 系统 SHALL 在本 WI 内修正（如 navigation prop 注入、跨导航器类型对齐），不通过 `any` / `@ts-ignore` / 回退占位组件绕过。

**优先级**：Must

**依赖**：IssueBasketScreen.tsx（464 行骨架）已就绪、WI-0015（WatermelonDB / SyncEnginePort 已激活）

---

### REQ-2 SubmitReport 路由集成（替换占位为真实 SubmitReportScreen）

**用户故事**：作为检查员，我希望在检查流程中导航到"提交日报"页时看到真实的今日检查总结、同步状态与提交按钮（而非"骨架占位"文本），以便我能触发 SyncEngine 同步并查看提交结果。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 在 `fj-android/src/navigation/AppNavigator.tsx` 中通过 `import SubmitReportScreen from '../screens/submit/SubmitReportScreen';` 引入真实屏幕组件，并将 InspectionStack 内 `SubmitReport` 路由从当前的 children 渲染回调（返回 SimplePlaceholder）改为 `component={SubmitReportScreen}` 形式。
2. [Ubiquitous] THE 系统 SHALL 保留 `SubmitReport` 路由的现有配置（`name="SubmitReport"`、`options={{ headerTitle: '提交日报' }}`）不变，仅替换渲染方式（children 回调 → component 属性）。
3. [Unwanted-behavior] IF SubmitReportScreen 因 `route.params.taskId` 缺失或 SyncEngine 未注入而无法正常渲染, THEN THE 系统 SHALL 依赖 SubmitReportScreen 骨架内既有的降级逻辑（离线提示 / 按钮禁用）处理，本 WI 不修改其内部实现，不通过回退占位绕过集成。

**优先级**：Must

**依赖**：SubmitReportScreen.tsx（607 行骨架）已就绪、WI-0015（SyncEnginePort 已激活）

---

### REQ-3 TypeScript 类型检查 + Docker 构建验证

**用户故事**：作为安卓端开发者 / 发布工程师，我希望本 WI 的 AppNavigator 集成改动通过 TypeScript 严格类型检查与 Docker Debug 构建，以便确信两个真实屏幕的 import / 组件类型对齐、路由参数表匹配、整个改动可成功打包进 APK 而不引入编译回归。

**验收标准**：

1. [Event-driven] WHEN 在 `fj-android` 工程根目录（或 Docker 容器内 `/workspace`）执行 `npx tsc --noEmit`, THE 系统 SHALL 以退出码 `0` 完成，无任何 TypeScript 类型错误（含 IssueBasketScreen / SubmitReportScreen 的 import、`component` 属性的组件类型、InspectionStackParamList 路由表匹配）。
2. [Event-driven] WHEN 在 Docker 容器（镜像 `fj-builder:react-native-0.74`）内执行 `./gradlew assembleDebug`, THE 系统 SHALL 以退出码 `0` 完成，产出 `fj-android/android/app/build/outputs/apk/debug/app-debug.apk` 且文件大小 > `<min_apk_size_bytes: 1048576>`（可配置，默认 1 MiB）。
3. [Unwanted-behavior] IF 类型检查或构建失败（如 import 路径错误、navigation prop 类型不匹配、路由表定义缺失）, THEN THE 系统 SHALL 在本 WI 内修正，不通过 `any` / `@ts-ignore` / 回退占位组件绕过。

**优先级**：Must

**依赖**：REQ-1、REQ-2

---

## 非目标（Out of Scope）

以下事项**不属于**本 WI 范围，如有需要应另立 WI：

1. **IssueBasketScreen / SubmitReportScreen 内部逻辑修改** — 两个屏幕骨架（464 + 607 行）已完整，本 WI 仅做 AppNavigator 接线（import + 路由挂载），不改其内部实现。
2. **真实同步冲突 UI 人工裁决** — intake OUT-OF-SCOPE。
3. **照片上传完成态展示** — 依赖 WI-0018 真实拍照（intake OUT-OF-SCOPE）。
4. **Profile Tab 集成** — 属 WI-0020 范围，本 WI 不触碰 Profile Tab / ProfileScreen。
5. **InspectionStackParamList 类型扩展** — 若两个屏幕已引用该类型表，本 WI 不修改类型定义文件（TodayInspectionScreen.tsx）。
6. **SimplePlaceholder 组件移除** — 移除 IssueBasket 占位后，SimplePlaceholder 仍被 Profile Tab 使用，保留不删。
7. **单元测试 / E2E 测试套件** — 本 WI 仅保证 TypeScript 类型检查 + Docker 构建通过。
8. **Release APK 构建** — 本 WI 仅产出 Debug APK。

## 配置点清单

| 配置项 | 默认值 | 位置 | 说明 |
|--------|--------|------|------|
| `min_apk_size_bytes` | 1048576 (1 MiB) | REQ-3.2 | 验证 `app-debug.apk` 非空的最小体积阈值，与 WI-0015 / WI-0017 / WI-0018 同源。 |

---

## 自检（Self-Check）

| # | 自问自答 | 答案 |
|---|---------|------|
| 1 | 是否有含"等"/"包括但不限于"的未拆分需求？ | 否。REQ-1/REQ-2 分别针对 IssueBasket Tab 与 SubmitReport 路由，各自独立编号；每条 AC 点名具体文件、行号、属性名（component / options / headerTitle）。 |
| 2 | 每条 AC 是否含可测量值或可执行命令？ | 是。`import ... from '...'`、`component={...}`、保留 options 不变、`npx tsc --noEmit` 退出码 0、APK size > 1048576 字节、退出码 0。 |
| 3 | 是否避免编写设计/任务/代码内容？ | 是。仅描述"必须集成哪个真实屏幕"、"保留哪些路由配置"、"验证什么"；具体 import 写法、占位函数移除策略由 DD 决定，TASK 由 sf-task-planner 拆分。 |
| 4 | 是否覆盖 intake 的全部 IN-SCOPE 项？ | 是。①IssueBasket Tab 集成 → REQ-1；②SubmitReport 路由集成 → REQ-2；③tsc + Docker → REQ-3。 |
| 5 | 是否识别并标注了名称冲突风险？ | 是，REQ-1.AC1 显式要求移除 L124-131 同名本地占位函数以消除命名冲突，术语表独立定义"名称冲突"。 |
| 6 | 是否声明 REQ 之间的依赖关系？ | 是，每个 REQ 末尾标注"依赖"；REQ-3 依赖 REQ-1 + REQ-2。 |
| 7 | 是否覆盖 SubmitReport 的降级路径？ | 是，REQ-2.AC3 声明依赖 SubmitReportScreen 既有降级逻辑（taskId 缺失 / SyncEngine 未注入），不在本 WI 修改其内部。 |
| 8 | 是否避免读取 host-profile.json / prod-environment.md？ | 是，全程未读取技术事实源，仅基于业务行为与代码骨架事实。 |
| 9 | 非功能性需求是否可测量？ | 是，REQ-3 用退出码 0、APK size > 1048576 字节，不用"应该高效"。 |
