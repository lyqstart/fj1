# Intake — WI-0019

## Work Item: WI-0019
## Title: 问题篮子 + 提交日报屏幕集成
## Date: 2026-07-05

## 核心目标
将 IssueBasketScreen（464 行骨架）和 SubmitReportScreen（607 行骨架）集成到 AppNavigator：IssueBasket Tab 替换占位，SubmitReport 路由替换占位。

## 范围
### IN-SCOPE
1. AppNavigator IssueBasket Tab 集成 IssueBasketScreen
2. InspectionStack SubmitReport 路由集成 SubmitReportScreen
3. tsc + Docker 验证

### OUT-OF-SCOPE
- 真实同步冲突 UI 人工裁决
- 照片上传完成态展示（依赖 WI-0018 真实拍照）

## 技术现状
- IssueBasketScreen.tsx（464 行骨架）：今日草稿问题列表
- SubmitReportScreen.tsx（607 行骨架）：提交日报 + 同步状态