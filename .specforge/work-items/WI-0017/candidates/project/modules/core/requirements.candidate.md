---
requirements_format: ears
work_item_id: WI-0017
workflow_type: feature_spec
workflow_path: requirement_change_path
date: 2026-07-05
title: 检查中屏幕实装（TaskDetail + InspectionInProgress + IssueEvidence 集成）需求规格（Candidate）
target_path: .specforge/project/modules/core/requirements.md
operation: append
base_spec_version: PSV-0001
---

# Requirements Candidate — WI-0017 检查中屏幕实装

> 本文件为 Requirements Candidate（§8.2），拟追加写入正式规格真相源 `core/requirements.md`。
> 仅描述"做什么"与"验收什么"，不涉及架构选型与实现细节（属 sf-design 职责）。

## 简介

本规格将 WI-0016 阶段已搭建的 `InspectionStack` 中 3 个 SimplePlaceholder 占位路由（`TaskDetail` / `InspectionInProgress` / `IssueEvidence`）替换为已就绪的真实骨架屏幕，使检查员从今日任务列表进入后能完成"查看任务详情 → 启动检查 → 取证记录问题"的完整链路；同时显式保留 `SubmitReport` 占位不动，将其归属 WI-0019，并修正 AppNavigator.tsx L116 中"SubmitReport 由 WI-0017 实现"的误标。

**前置事实（仅供设计参考，不作为需求约束）**：
- `TaskDetailScreen.tsx`（261 行）：响应式订阅任务（findAndObserve）、基本信息区 + 关联检查表 ID + "开始检查"按钮（testID="start-inspection-btn"），按钮点击触发 `navigation.navigate('InspectionInProgress', { taskId })`。
- `InspectionInProgressScreen.tsx`（370 行）：进度条 + 检查条目列表（骨架阶段为空）+ `IssueCreateButton` + "提交日报（TASK-028）"按钮，点击跳转 `SubmitReport`。
- `IssueEvidenceScreen.tsx`（915 行）：拍照（`PhotoCapture`）+ 压缩（`PhotoCompressor`）+ 水印预览（`WatermarkOverlay`）+ 问题描述/严重等级/关联标准条款表单 + 保存到本地 WatermelonDB（事务内创建今日草稿日报 + 问题 + 照片记录）。
- `AppNavigator.tsx`（221 行，WI-0016 已合并）：当前 `InspectionStack` 含 5 个路由，其中 `TaskDetail` / `InspectionInProgress` / `SubmitReport` / `IssueEvidence` 4 个为 `SimplePlaceholder` 占位。
- 3 个骨架 screen 均以 `StackScreenProps<InspectionStackParamList, 'X'>` 声明 props，与 WI-0016 已固化的 `InspectionStackParamList` 类型同源。

## 术语表

| 术语 | 定义 |
|------|------|
| TaskDetailScreen | 任务详情页：展示任务基本信息（编号、名称、状态、检查员、计划日期、地点、关联检查表 formId）并提供"开始检查"入口。 |
| InspectionInProgressScreen | 检查中页面：渲染检查进度 + 检查条目逐项标记 UI（骨架阶段无条目数据）+ 问题创建入口 + 提交日报入口。 |
| IssueEvidenceScreen | 问题取证页：拍照 + 描述 + 严重等级 + 关联条款 + 保存到本地草稿日报。 |
| SimplePlaceholder | AppNavigator 内通用占位组件（接受 `title` + `subtitle?`），WI-0016 用于未实装 screen 兜底，本 WI 替换其中 3 处。 |
| InspectionStack | WI-0016 在"今日检查" Tab 内嵌的 Stack Navigator，承载 5 个路由。 |
| SubmitReport 占位 | InspectionStack 内的 SubmitReport 路由仍指向 SimplePlaceholder，真实实装属 WI-0019。 |
| IssueCreateButton | 已存在的创建问题入口按钮（69 行），由 InspectionInProgressScreen 引用，点击触发跳转到 IssueEvidence 路由。 |
| findAndObserve | WatermelonDB 响应式订阅 API，3 个 screen 均用它订阅 taskId 对应的 InspectionTaskModel。 |
| tsc --noEmit | TypeScript 类型检查模式，仅做类型校验不产出 JS。 |
| Docker 构建环境 | 镜像 `fj-builder:react-native-0.74`，承载 React Native 0.74 编译工具链。 |

## 需求

### REQ-1 TaskDetailScreen 集成

**用户故事**：作为检查员，我希望点击今日检查列表中的任务卡片后进入真实的任务详情页（而非占位文字），看到任务基本信息、关联检查表 ID，并能通过"开始检查"按钮进入检查中页面，以便决定是否启动本次检查。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 在 `fj-android/src/navigation/AppNavigator.tsx` 的 `InspectionStack` 内将 `TaskDetail` 路由的 `component` 从 `SimplePlaceholder`（WI-0016 占位回调用 `() => <SimplePlaceholder title="任务详情" subtitle="骨架占位 — WI-0017 实现" />`）替换为真实 `TaskDetailScreen` 组件（从 `'../screens/inspection/TaskDetailScreen'` 默认导入），并删除该路由的 children 渲染回调。
2. [Event-driven] WHEN 检查员点击 `TaskCard` 触发 `navigation.navigate('TaskDetail', { taskId })`, THE 系统 SHALL 推入真实 `TaskDetailScreen`，通过 `route.params.taskId` 接收任务 ID，并在 `useEffect` 内调用 `database.get(INSPECTION_TASK_TABLE).findAndObserve(taskId)` 响应式订阅任务记录（订阅在卸载时通过 `subscription.unsubscribe()` 清理）。
3. [State-driven] WHILE 任务状态为 `TASK_STATUS.PENDING` 或 `TASK_STATUS.IN_PROGRESS`, THE 系统 SHALL 启用 `testID="start-inspection-btn"` 按钮（文案"开始检查"），点击后调用 `navigation.navigate('InspectionInProgress', { taskId })`；其他状态下按钮禁用并显示"当前状态不可开始检查"。

**优先级**：Must

**依赖**：WI-0016（InspectionStack 已注册 TaskDetail 路由）

---

### REQ-2 InspectionInProgressScreen 集成

**用户故事**：作为检查员，我希望在任务详情页点击"开始检查"后进入真实的检查中页面（而非占位），看到检查进度、检查条目列表（即便骨架阶段为空也需明确提示）、问题创建入口和提交日报入口，以便持续推进检查流程。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 在 `AppNavigator.tsx` 的 `InspectionStack` 内将 `InspectionInProgress` 路由的 `component` 从 `SimplePlaceholder` 替换为真实 `InspectionInProgressScreen` 组件（从 `'../screens/inspection/InspectionInProgressScreen'` 默认导入），并删除该路由的 children 渲染回调。
2. [Event-driven] WHEN 检查员在 `TaskDetailScreen` 点击"开始检查"按钮进入 `InspectionInProgress` 路由, THE 系统 SHALL 推入真实 `InspectionInProgressScreen`，订阅 `taskId` 任务、渲染进度条（`completedCount / totalCount`）+ 检查条目列表 + `IssueCreateButton` + `testID="submit-report-btn"` 提交日报按钮。
3. [Unwanted-behavior] IF 本地数据库无 `inspection_form_items`（骨架阶段 schema 未含此表，`items` state 为空数组）, THEN THE 系统 SHALL 渲染空状态提示"暂无检查表条目"（含骨架代码已有的说明文案），进度文本显示"已检 0 / 共 0 项"，不崩溃、不抛出 `findAndObserve` 错误。

**优先级**：Must

**依赖**：REQ-1（"开始检查"按钮跳转目标必须先在路由表注册真实 component）

---

### REQ-3 IssueEvidenceScreen 集成

**用户故事**：作为检查员，我希望在检查过程中通过 `IssueCreateButton` 进入真实的问题取证页（而非占位），填写问题描述、严重等级、关联条款并保存到本地草稿，以便现场记录发现的问题。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 在 `AppNavigator.tsx` 的 `InspectionStack` 内将 `IssueEvidence` 路由的 `component` 从 `SimplePlaceholder` 替换为真实 `IssueEvidenceScreen` 组件（从 `'../screens/inspection/IssueEvidenceScreen'` 默认导入），并删除该路由的 children 渲染回调。
2. [Event-driven] WHEN 检查员从 `IssueCreateButton` 或其他入口触发 `navigation.navigate('IssueEvidence', { taskId, taskItemId? })`, THE 系统 SHALL 推入真实 `IssueEvidenceScreen`，通过 `route.params` 接收 `{ taskId, taskItemId? }`，订阅 `taskId` 任务，渲染任务上下文（责任单位/位置/检查员）+ 拍照入口（`PhotoCapture`）+ 问题描述输入 + 严重等级选择 + 关联标准条款输入 + `testID="issue-save-btn"` 保存按钮。
3. [Optional-feature] WHERE `PhotoCapture` / `PhotoCompressor` 的原生端口（`DefaultCameraProvider` / `ImageResizerProvider`）未注入, THE 系统 SHALL 通过骨架代码已有的降级处理（`DefaultCameraProvider` 不可用提示）保证 `IssueEvidenceScreen` 页面可渲染不崩溃；本 WI 不引入新的端口注入（属后续 WI 范围）。

**优先级**：Must

**依赖**：REQ-2（`IssueCreateButton` 在 `InspectionInProgressScreen` 内渲染，必须先激活该 screen）

---

### REQ-4 SubmitReport 保留占位（WI-0019 负责）

**用户故事**：作为发布工程师 / 后续 WI 规划者，我希望本 WI 显式保留 `SubmitReport` 路由的占位不动，并修正 AppNavigator.tsx L116 当前"骨架占位 — WI-0017 实现"的误标为指向 WI-0019，以便后续 WI 边界清晰、不留歧义。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 在 `AppNavigator.tsx` 的 `InspectionStack` 内保留 `SubmitReport` 路由的 `component` 为 `SimplePlaceholder`（不替换为真实 screen），`SubmitReportScreen` 真实实装属 WI-0019 范围，本 WI 不实现。
2. [Unwanted-behavior] IF 检查员在 `InspectionInProgressScreen` 点击 `testID="submit-report-btn"` 按钮触发 `navigation.navigate('SubmitReport', { taskId })`, THEN THE 系统 SHALL 推入 `SubmitReport` 占位组件；占位 `subtitle` 文案须从当前的"骨架占位 — WI-0017 实现"更正为指向 WI-0019（如"骨架占位 — WI-0019 实现"），以消除归属歧义。

**优先级**：Must

**依赖**：REQ-2（`InspectionInProgressScreen` 内"提交日报"按钮是触发 SubmitReport 的入口）

---

### REQ-5 TypeScript 类型检查 + Docker 构建验证

**用户故事**：作为安卓端开发者 / 发布工程师，我希望本 WI 的集成改动通过 TypeScript 严格类型检查与 Docker Debug 构建，以便确信 3 个真实 screen 的 props 类型与 `InspectionStackParamList` 一致、导入路径正确、可成功打包进 APK。

**验收标准**：

1. [Event-driven] WHEN 在 `fj-android` 工程根目录执行 `npx tsc --noEmit`, THE 系统 SHALL 以退出码 0 完成，无任何 TypeScript 类型错误（含 3 个新导入的真实 screen 的 `StackScreenProps<InspectionStackParamList, 'TaskDetail' | 'InspectionInProgress' | 'IssueEvidence'>` 类型契约对齐、`component={XxxScreen}` 签名兼容 `createStackNavigator<InspectionStackParamList>` 的泛型要求）。
2. [Event-driven] WHEN 在 Docker 容器（镜像 `fj-builder:react-native-0.74`）内执行 `./gradlew assembleDebug`, THE 系统 SHALL 以退出码 0 完成，产出 `fj-android/android/app/build/outputs/apk/debug/app-debug.apk` 且文件大小 > `<min_apk_size_bytes: 1048576>`（可配置，默认 1 MiB）。
3. [Unwanted-behavior] IF 集成过程中因导入路径错误（如 `'./screens/inspection'` 拼错、`TaskDetailScreen` 默认导出缺失）或 `InspectionStackParamList` 路由参数与 screen 期望的 `route.params` 不一致导致 tsc 或构建失败, THEN THE 系统 SHALL 在本 WI 内修正，不通过回退占位或 `any` / `@ts-ignore` 绕过。

**优先级**：Must

**依赖**：REQ-1、REQ-2、REQ-3、REQ-4

---

## 非目标（Out of Scope）

以下事项**不属于**本 WI 范围，如有需要应另立 WI：

1. **SubmitReportScreen 真实实装** — 属 WI-0019，本 WI 仅保留占位 + 修正误标。
2. **照片拍摄 + 上传链路实装（PhotoCapture/PhotoCompressor 原生端口注入）** — 属 WI-0018，本 WI 仅激活 `IssueEvidenceScreen` 的骨架，原生端口仍走骨架内置降级。
3. **检查表条目（`inspection_form_items`）数据接入** — 本地 schema 未含该表，3 个 screen 已以"骨架阶段为空 + 占位提示"形式工作；条目数据接入属后续 WI。
4. **`standard_clauses` 推荐列表（DD-11 离线推荐引擎）** — `IssueEvidenceScreen` 已用手动文本输入兜底，本 WI 不实装推荐列表。
5. **3 个 screen 内部业务逻辑改动** — TaskDetailScreen (261) / InspectionInProgressScreen (370) / IssueEvidenceScreen (915) 骨架已就绪，本 WI 仅在 AppNavigator 层做 component 替换，不修改其内部实现。
6. **单元测试 / E2E 测试套件** — 本 WI 仅保证 TypeScript 类型检查 + Docker 构建通过。
7. **Release APK 构建** — 本 WI 仅产出 Debug APK；Release 签名与 ProGuard 由 WI-0014 负责。
8. **Tab 图标 / 启动屏 / 主题美化** — UI 美化不在本 WI 范围。

## 配置点清单

| 配置项 | 默认值 | 位置 | 说明 |
|--------|--------|------|------|
| `min_apk_size_bytes` | 1048576 (1 MiB) | REQ-5.2 | 验证 `app-debug.apk` 非空的最小体积阈值，与 WI-0016 REQ-5.2 同源。 |

---

## 自检（Self-Check）

| # | 自问自答 | 答案 |
|---|---------|------|
| 1 | 是否有含"等"/"包括但不限于"的未拆分需求？ | 否。REQ-1.1/2.1/3.1 三处替换逐一明确路由名；REQ-4.1 显式声明 SubmitReport 保留占位；所有"骨架阶段为空"约束都点名为 `inspection_form_items` 表未含的具体事实，不写"等数据"。 |
| 2 | 每条 AC 是否含可测量值或可执行命令？ | 是。`testID="start-inspection-btn"` / `testID="submit-report-btn"` / `testID="issue-save-btn"`、`findAndObserve(taskId)`、`navigation.navigate('InspectionInProgress', { taskId })`、tsc 退出码 0、APK size > 1048576 字节、subtitle 文案变更前后对照。 |
| 3 | 是否避免编写设计/任务/代码内容？ | 是。仅描述"哪些路由 component 必须替换为哪个真实 screen"、"骨架 screen 应执行哪些业务行为"（属需求层事实约束）；具体 import 写法、component 接线方式由 DD 决定，TASK 由 sf-task-planner 拆分。 |
| 4 | 是否覆盖 intake 的全部 IN-SCOPE 项？ | 是。①TaskDetail → REQ-1；②InspectionInProgress → REQ-2；③IssueEvidence → REQ-3；④SubmitReport 保留占位 → REQ-4；⑤tsc + Docker → REQ-5。 |
| 5 | 是否处理了"骨架 screen 缺数据时不崩溃"关键风险？ | 是，REQ-2.3 显式要求条目为空时渲染"暂无检查表条目"+ "0/0 项"不崩溃；REQ-3.3 显式要求 PhotoCapture/Compressor 端口未注入时通过骨架降级保证可渲染。 |
| 6 | 是否声明与 WI-0016 / WI-0018 / WI-0019 的边界？ | 是，每个 REQ 末尾"依赖"章节 + 非目标 1~4 共同隔离（WI-0016 提供 InspectionStack 占位、WI-0018 实装照片原生端口、WI-0019 实装 SubmitReport）。 |
| 7 | 是否声明 REQ 之间的依赖关系？ | 是，每个 REQ 末尾标注"依赖"。 |
| 8 | 是否避免读取 host-profile.json / prod-environment.md？ | 是，全程未读取技术事实源，仅基于业务行为描述与代码骨架事实（intake.md + impact_analysis.md + 已读源码注释）。 |
