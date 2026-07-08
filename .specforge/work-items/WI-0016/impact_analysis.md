# Impact Analysis — WI-0016

## 代码影响
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/navigation/AppNavigator.tsx` | 修改 | TodayScreen placeholder → TodayInspectionScreen 真实组件；嵌套 Stack Navigator |
| `src/navigation/TodayStack.tsx` | 新建 | Today Tab 内嵌 Stack（Today / TaskDetail / InspectionInProgress / SubmitReport / IssueEvidence 路由表）|

## 风险
| 风险 | 缓解 |
|------|------|
| TaskDetail 等目标 screen 未实装导致导航崩溃 | 路由表中只注册已实装的 screen，未实装用 placeholder |
| WatermelonDB observe 在空库时无数据 | UI 已有空状态处理（emptyList） |

## 依赖
- WI-0015（DatabaseProvider 已激活）
- TodayInspectionScreen / TaskCard 骨架已就绪
