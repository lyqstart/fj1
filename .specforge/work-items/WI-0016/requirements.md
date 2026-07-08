---
requirements_format: ears
work_item_id: WI-0016
workflow_type: feature_spec
workflow_path: requirement_change_path
date: 2026-07-05
title: 今日检查屏幕实装（TodayInspectionScreen 激活 + 导航集成）需求规格（Candidate）
target_path: .specforge/project/modules/core/requirements.md
operation: replace
base_spec_version: PSV-0001
---

# Requirements — WI-0016 今日检查屏幕实装（TodayInspectionScreen 激活 + 导航集成）

> 本文件为 Requirements Candidate（§8.2），拟替换写入正式规格真相源 `core/requirements.md`。
> 仅描述"做什么"与"验收什么"，不涉及架构选型与实现细节（属 sf-design 职责）。

## 简介

本规格激活飞检安卓端 `fj-android` 的**今日检查屏幕（TodayInspectionScreen）与导航骨架**，让检查员打开 App 后通过底部 Tab "今日检查" 看到当日的检查任务列表，并能从任务卡片安全地跳转到任务详情等子页面（详情等子页面以占位组件先打通导航链路，避免崩溃）。

**前置事实（仅供设计参考，不作为需求约束）**：
- `TodayInspectionScreen.tsx`（218 行骨架）已实现：`useDatabase()` 注入、`query.observe()` 响应式订阅、按 `planned_date` 过滤当日任务、排除 `已取消`、`RefreshControl` 下拉刷新触发 `syncEngine.fullSync()`、空状态 UI、`FlatList` 渲染 `TaskCard`。
- `TaskCard.tsx`（141 行骨架）已实现：`useNavigation<StackNavigationProp<InspectionStackParamList,'TaskDetail'>>()`、点击 `navigation.navigate('TaskDetail', { taskId })`、`StatusBadge` 状态色块。
- `InspectionStackParamList` 类型已在 `TodayInspectionScreen.tsx` L46-52 声明：`TodayInspection` / `TaskDetail { taskId }` / `InspectionInProgress { taskId }` / `SubmitReport { taskId }` / `IssueEvidence { taskId; taskItemId? }`。
- `AppNavigator.tsx`（139 行骨架）当前为纯 `BottomTabNavigator` + 3 个 `PlaceholderScreen`，**未挂载任何真实业务屏幕**，且**没有嵌套 Stack Navigator**，导致 `TaskCard` 调用 `navigation.navigate('TaskDetail')` 时会因路由表无 `TaskDetail` 而崩溃。
- WI-0015 已激活 `DatabaseProvider` 与 `SyncEngineProvider`，故 `TodayInspectionScreen` 内 `useDatabase()` / `useSyncEngine()` 可正常取到非 null 实例。

本 WI 完成后，App 的"今日检查" Tab 将渲染真实任务列表；任务卡片可点击进入 TaskDetail（占位先打通链路）；TaskDetail / InspectionInProgress / SubmitReport / IssueEvidence 四个未实装 screen 用通用占位组件兜底，确保后续 WI-0017~0020 能在已就绪的导航骨架上独立实装而不相互阻塞。

## 术语表

| 术语 | 定义 |
|------|------|
| TodayInspectionScreen | 今日检查列表页，渲染检查员当日（按 `planned_date` 过滤）的检查任务，是"今日检查" Tab 的首页。 |
| TaskCard | 单条检查任务的卡片组件，点击触发到 `TaskDetail` 的跳转。 |
| AppNavigator | 应用根导航组件，当前由 `createBottomTabNavigator` 构成，承载 Today / IssueBasket / Profile 三个底部 Tab。 |
| BottomTabNavigator | `@react-navigation/bottom-tabs` 提供的底部标签栏导航器。 |
| Stack Navigator | `@react-navigation/stack` 提供的栈式导航器，负责 Tab 内多 screen 的推入/弹出（如 TodayInspection → TaskDetail）。 |
| InspectionStack | "今日检查" Tab 内嵌的 Stack Navigator，承载检查流程相关子页面（TodayInspection / TaskDetail / InspectionInProgress / SubmitReport / IssueEvidence）。 |
| InspectionStackParamList | InspectionStack 的路由参数表类型，已在 `TodayInspectionScreen.tsx` 导出，本 WI 在 AppNavigator 中复用同一份类型以保证跳转调用类型一致。 |
| Placeholder（占位 Screen） | 通用占位组件，接受 `title` + `subtitle`，用于未实装 screen（TaskDetail 等）以避免导航路由表缺失导致的崩溃。 |
| 路由表 | Stack Navigator 中已注册的全部路由名称集合；未在路由表中注册的 `navigate(name)` 调用会在运行时抛错。 |
| 导航崩溃 | 调用 `navigation.navigate` 跳转到路由表中不存在的 screen 时，React Navigation 抛出 "The action 'NAVIGATE' with payload {...} was not handled by any navigator" 错误。 |
| Today Tab | 底部 Tab 中的"今日检查"标签页，本 WI 将其 `component` 从 placeholder 改为 InspectionStack。 |
| IssueBasket Tab | 底部 Tab 中的"问题篮子"标签页，WI-0019 实装，本 WI 保留占位。 |
| Profile Tab | 底部 Tab 中的"我的"标签页，WI-0020 实装，本 WI 保留占位。 |
| Docker 构建环境 | 镜像 `fj-builder:react-native-0.74`，承载 React Native 0.74 编译工具链，所有 APK 构建均在该容器内执行。 |
| tsc --noEmit | TypeScript 编译器的类型检查模式，仅做类型校验不产出 JS 文件。 |

## 需求

### REQ-1 AppNavigator 集成 TodayInspectionScreen

**用户故事**：作为检查员，我希望打开 App 后点击底部"今日检查" Tab 能看到真实的当日检查任务列表（而非骨架占位文字），以便我立即了解今天有哪些检查任务需要执行。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 在 `fj-android/src/navigation/AppNavigator.tsx` 中将"今日检查" Tab 的 `component` 从当前的 `TodayScreen`（返回 `PlaceholderScreen`）替换为真实 `TodayInspectionScreen` 组件（从 `../screens/today/TodayInspectionScreen` 导入）。
2. [Ubiquitous] THE 系统 SHALL 保留 `IssueBasket` Tab 与 `Profile` Tab 的占位 `component` 不变（分别由 WI-0019 / WI-0020 实装），不在本 WI 替换这两个 Tab。
3. [Event-driven] WHEN App 启动并渲染到"今日检查" Tab, THE 系统 SHALL 实际挂载 `TodayInspectionScreen` 组件，使其内部 `useDatabase()` / `useSyncEngine()` 能取到 WI-0015 注入的非 null 实例，并执行 `query.observe()` 响应式订阅。
4. [State-driven] WHILE 本地数据库无当日检查任务（`planned_date` 落在今日区间且 `status != 已取消` 的记录数为 0）, THE 系统 SHALL 渲染 `TodayInspectionScreen` 的空状态 UI（含"今日暂无检查任务"文案与"下拉刷新以同步最新任务"提示），而非崩溃或白屏。
5. [Unwanted-behavior] IF 替换过程中意外删除了 `IssueBasket` 或 `Profile` Tab 的 `<Tab.Screen>` 注册, THEN THE 系统 SHALL 被本 WI 的 TypeScript 类型检查（REQ-4）拦截 —— `RootTabParamList` 要求三个 Tab name 全部存在。

**优先级**：Must

**依赖**：REQ-2（Tab 内嵌 Stack 决定 `component` 指向的是 Stack 还是直接 screen）、WI-0015（DatabaseProvider / SyncEngineProvider 已激活）

---

### REQ-2 Tab 内嵌 Stack Navigator

**用户故事**：作为检查员，我希望在"今日检查" Tab 内能从任务列表跳转到任务详情、检查进行中、提交报告、问题证据等子页面，且这些子页面跳转不会跳出当前 Tab、不影响其他 Tab，以便我在检查流程内顺畅地推入/返回多个子页面。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 在"今日检查" Tab 内嵌一个 Stack Navigator（`InspectionStack`），其路由表必须覆盖 `<inspection_stack_routes_count: 5>` 个路由：`TodayInspection` / `TaskDetail` / `InspectionInProgress` / `SubmitReport` / `IssueEvidence`，路由参数类型复用 `TodayInspectionScreen.tsx` 已导出的 `InspectionStackParamList`。
2. [Ubiquitous] THE 系统 SHALL 将 `InspectionStack` 中尚未实装的 screen（`TaskDetail` / `InspectionInProgress` / `SubmitReport` / `IssueEvidence` 共 `<unimplemented_screens_count: 4>` 个）的 `component` 设为通用占位组件（接受 `title` + `subtitle` props），避免跳转到未注册路由导致的导航崩溃。
3. [Ubiquitous] THE 系统 SHALL 在底部 Tab 的"今日检查" Tab 上将 `component` 指向 `InspectionStack`（而非直接指向 `TodayInspectionScreen`），使 Tab 内具备栈式推入/弹出的能力。
4. [Optional-feature] WHERE 后续 WI-0019（IssueBasket）/ WI-0020（Profile）需要子页面跳转, THE 系统 SHALL 允许在对应 Tab 内嵌各自的 Stack Navigator（本 WI 不强制实现，但 AppNavigator 的结构不得阻碍后续添加）。
5. [Unwanted-behavior] IF 检查员在 `InspectionStack` 已推入 `TaskDetail` 等子页面的状态下切换到底部其他 Tab 再切回, THE 系统 SHALL 保持 `InspectionStack` 的栈状态（React Navigation 默认行为，不得通过强制 reset 破坏）。

**优先级**：Must

**依赖**：REQ-1、REQ-3

---

### REQ-3 TaskCard 导航验证

**用户故事**：作为检查员，我希望点击任务列表中的某张任务卡片能进入该任务的详情页（即便详情页当前是占位），以便确认导航链路已打通、为 WI-0017 实装真实详情页做好准备。

**验收标准**：

1. [Event-driven] WHEN 检查员点击 `TaskCard`（`testID="task-card-{taskId}"`）, THE 系统 SHALL 通过 `navigation.navigate('TaskDetail', { taskId: task.id })` 在 `InspectionStack` 栈顶推入 `TaskDetail` 路由，且 `taskId` 参数被正确传递。
2. [Ubiquitous] THE 系统 SHALL 保证 `TaskCard` 内的 `useNavigation<StackNavigationProp<InspectionStackParamList, 'TaskDetail'>>()` 类型与 `InspectionStack` 实际声明的路由参数类型一致（同一份 `InspectionStackParamList`），不得出现类型不匹配。
3. [State-driven] WHILE `TaskDetail` 目标 screen 仍为通用占位组件（WI-0017 尚未实装）, THE 系统 SHALL 在点击 `TaskCard` 后正常推入占位 screen 并显示其 `title` + `subtitle`，不抛出 "route not found" 或 "navigation.navigate not handled" 错误。

**优先级**：Must

**依赖**：REQ-2（`TaskDetail` 必须先在 `InspectionStack` 路由表中注册）

---

### REQ-4 TypeScript 类型检查

**用户故事**：作为安卓端开发者，我希望本 WI 的所有改动（AppNavigator 重构、InspectionStack 声明、占位组件、导入路径）通过 TypeScript 严格类型检查，以便在 CI 阶段提前发现路由表与组件 props 类型不匹配问题。

**验收标准**：

1. [Event-driven] WHEN 在 `fj-android` 工程根目录执行 `npx tsc --noEmit`（或 `package.json` 中配置的 typecheck 脚本）, THE 系统 SHALL 以退出码 0 完成，无任何 TypeScript 类型错误。
2. [Ubiquitous] THE 系统 SHALL 保证 `InspectionStack` 的路由表类型与 `InspectionStackParamList`（从 `TodayInspectionScreen.tsx` 复用导入）完全一致，`createStackNavigator<InspectionStackParamList>()` 的泛型参数不得被 `any` 绕过，且 `TaskCard` 的 `StackNavigationProp<InspectionStackParamList, 'TaskDetail'>` 与之同源。

**优先级**：Must

**依赖**：REQ-1、REQ-2、REQ-3

---

### REQ-5 Docker 构建验证

**用户故事**：作为发布工程师，我希望在 Docker 构建环境中以可重复的命令验证：本 WI 的导航重构改动可成功编译进 Debug APK，以便确信改动在 CI 流水线中可重现且不破坏既有构建。

**验收标准**：

1. [Event-driven] WHEN 在 Docker 容器（镜像 `fj-builder:react-native-0.74` 或等效构建镜像）内执行 Android Debug 构建命令（如 `./gradlew assembleDebug` 或项目约定的构建入口）, THE 系统 SHALL 以退出码 0 完成构建。
2. [Event-driven] WHEN 构建成功完成, THE 系统 SHALL 在 `fj-android/android/app/build/outputs/apk/debug/` 目录下产出名为 `app-debug.apk` 的文件，且文件大小 > `<min_apk_size_bytes: 1048576>`（可配置，默认 1 MiB）。
3. [Unwanted-behavior] IF 构建过程中因本 WI 引入的新导入（如 `@react-navigation/stack` 未安装、`TodayInspectionScreen` 导入路径错误）导致编译失败, THEN THE 系统 SHALL 在本 WI 内修复（如补全依赖、修正相对路径），不通过回退导航骨架回避问题。

**优先级**：Must

**依赖**：REQ-1、REQ-2、REQ-3、REQ-4

---

## 非目标（Out of Scope）

以下事项**不属于**本 WI 范围，如有需要应另立 WI：

1. **TaskDetailScreen / InspectionInProgressScreen 实装** — 属 WI-0017，本 WI 仅以占位组件打通导航链路。
2. **照片上传 screen（IssueEvidence 真实实现）** — 属 WI-0018，本 WI 仅注册路由 + 占位。
3. **SubmitReport 真实实现** — 日报提交流程属后续 WI，本 WI 仅注册路由 + 占位。
4. **IssueBasket 屏幕** — 属 WI-0019，本 WI 保留 `IssueBasket` Tab 占位不动。
5. **Profile 屏幕** — 属 WI-0020，本 WI 保留 `Profile` Tab 占位不动。
6. **TodayInspectionScreen / TaskCard 业务逻辑改动** — 这两个组件骨架（218 / 141 行）已就绪，本 WI 不修改其内部实现，仅通过导航集成"激活"它们。
7. **单元测试与集成测试套件** — 本 WI 仅保证 TypeScript 类型检查 + Docker 构建通过；为导航集成编写测试留给后续质量 WI。
8. **Release APK 构建** — 本 WI 仅产出 Debug APK；Release 签名与 ProGuard 由 WI-0014 负责。
9. **Tab 图标 / 启动屏 / 主题美化** — UI 美化不在本 WI 范围，本 WI 仅保证导航功能正确。
10. **深链（Deep Linking）与导航持久化** — 不在本 WI 范围。
11. **SafeAreaProvider 集成** — safe-area-context 仍处于屏蔽状态，本 WI 不解除其屏蔽（沿用 WI-0015 决策）。

## 配置点清单

| 配置项 | 默认值 | 位置 | 说明 |
|--------|--------|------|------|
| `inspection_stack_routes_count` | 5 | REQ-2.1 | InspectionStack 路由表中路由数量（TodayInspection / TaskDetail / InspectionInProgress / SubmitReport / IssueEvidence）。新增或合并路由时需更新。 |
| `unimplemented_screens_count` | 4 | REQ-2.2 | InspectionStack 中当前用占位组件兜底的 screen 数量（TaskDetail / InspectionInProgress / SubmitReport / IssueEvidence）。每有一个被真实实装（WI-0017/0018 等）需递减。 |
| `min_apk_size_bytes` | 1048576 (1 MiB) | REQ-5.2 | 验证 `app-debug.apk` 非空的最小体积阈值。 |

---

## 自检（Self-Check）

| # | 自问自答 | 答案 |
|---|---------|------|
| 1 | 是否有含"等"/"包括但不限于"的未拆分需求？ | 否。REQ-2.1 将 5 个路由全部枚举（不写"等子页面"）；REQ-2.2 将 4 个未实装 screen 全部枚举；REQ-1.2 明确两个保留占位的 Tab。 |
| 2 | 每条 AC 是否含可测量值或可执行命令？ | 是（`tsc --noEmit` 退出码 0、`./gradlew assembleDebug` 退出码 0、`app-debug.apk` 体积 ≥ 1 MiB、`testID="task-card-{taskId}"`、`useDatabase() !== null`、路由表 5 个路由全部注册等）。 |
| 3 | 是否避免编写设计/任务/代码内容？ | 是。未规定 Stack 文件拆分方式、未给组件签名、未拆任务、未选型；仅描述"必须挂载哪些 screen / 路由表覆盖哪些 name"。文件路径仅在"目标改动文件"层面提及（属需求范围的事实约束），未规定实现。 |
| 4 | 是否覆盖 intake 的全部 IN-SCOPE 项（6 项）？ | 是：①TodayScreen placeholder → TodayInspectionScreen → REQ-1；②Tab 内嵌 Stack → REQ-2；③TodayInspectionScreen 验证 → REQ-1.3/1.4（响应式订阅 + 空状态）；④TaskCard 验证 → REQ-3；⑤TypeScript 检查 → REQ-4；⑥Docker 构建 → REQ-5。 |
| 5 | 是否处理了"目标 screen 未实装导致导航崩溃"关键风险？ | 是，REQ-2.2 显式要求 4 个未实装 screen 用占位兜底；REQ-3.3 显式要求点击 TaskCard 后正常推入占位不崩溃。 |
| 6 | 是否声明了 InspectionStackParamList 类型的来源与复用？ | 是，REQ-2.1 + REQ-4.2 + 术语表三处共同说明类型来自 TodayInspectionScreen.tsx 导出、AppNavigator 复用同一份。 |
| 7 | 是否声明与 WI-0015 / WI-0017~0020 的边界？ | 是，依赖章节 + 非目标 1~5 共同隔离（WI-0015 提供 Provider、WI-0017 实装详情、WI-0018 照片、WI-0019 IssueBasket、WI-0020 Profile）。 |
| 8 | 是否处理了"切换 Tab 后回来栈状态保持"？ | 是，REQ-2.5 显式要求不得强制 reset 破坏栈状态。 |
| 9 | 是否声明 REQ 之间的依赖关系？ | 是，每个 REQ 末尾标注"依赖"。 |
| 10 | 是否避免读取 host-profile.json / prod-environment.md？ | 是，全程未读取技术事实源，仅基于业务行为描述与代码骨架事实。 |
