# Intake — WI-0016

## Work Item: WI-0016
## Title: 今日检查屏幕实装（TodayInspectionScreen 激活 + 导航集成）
## Date: 2026-07-05
## Workflow: feature_spec / requirement_change_path

## 核心目标

激活 TodayInspectionScreen（已有 218 行骨架）和 TaskCard（已有 141 行骨架），集成到 AppNavigator，让检查员打开 App 能看到今日检查任务列表。

## 范围

### IN-SCOPE
1. AppNavigator.tsx：TodayScreen placeholder 替换为 TodayInspectionScreen（真实组件）
2. 每个 Tab 内嵌 Stack Navigator（用于 TaskDetail/InspectionInProgress 等子页面跳转）
3. TodayInspectionScreen 验证（响应式订阅 + 下拉刷新 + 空状态）
4. TaskCard 验证（点击导航）
5. TypeScript 类型检查通过
6. Docker 构建验证

### OUT-OF-SCOPE
- TaskDetailScreen / InspectionInProgressScreen 实装（WI-0017）
- IssueBasket / Profile 屏幕（WI-0019 / WI-0020）
- 照片上传（WI-0018）
- 单元测试基础设施（独立 WI）

## 技术现状
- TodayInspectionScreen.tsx（218 行骨架，useDatabase + observe + RefreshControl + FlatList）
- TaskCard.tsx（141 行骨架，useNavigation + StatusBadge）
- AppNavigator.tsx（139 行，BottomTab + 3 个 PlaceholderScreen）
- 骨架已基本完整，主要工作是"激活集成"