# Intake — WI-0017

## Work Item: WI-0017
## Title: 检查中屏幕实装（TaskDetail + InspectionInProgress + IssueEvidence 集成）
## Date: 2026-07-05

## 核心目标

将已存在的 3 个骨架屏幕集成到 AppNavigator 的 InspectionStack（替换 WI-0016 的 SimplePlaceholder），让检查员从今日任务进入后能完成完整的检查-取证-问题记录流程。

## 范围

### IN-SCOPE
1. AppNavigator.tsx：4 个 SimplePlaceholder 替换为真实组件
   - TaskDetail → TaskDetailScreen
   - InspectionInProgress → InspectionInProgressScreen
   - IssueEvidence → IssueEvidenceScreen
   - SubmitReport 保留 SimplePlaceholder（WI-0019 实装）
2. TypeScript 类型检查
3. Docker 构建验证

### OUT-OF-SCOPE
- SubmitReportScreen 实装（WI-0019）
- 照片拍摄 + 上传（WI-0018）
- 单元测试

## 技术现状（骨架已就绪）
- TaskDetailScreen.tsx（261 行）：任务详情 + "开始检查"按钮
- InspectionInProgressScreen.tsx（370 行）：逐项检查 UI（合格/不合格切换 + 进度条 + IssueCreateButton）
- IssueEvidenceScreen.tsx（915 行）：问题取证表单（描述/严重等级/照片关联）
- IssueCreateButton.tsx（69 行）：创建问题入口按钮