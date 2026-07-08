# Change Classification — WI-0016

## 变更类型
Feature Activation — 集成已有骨架组件到导航，让今日检查屏幕对用户可见。

## 影响模块
| 模块 | 影响 |
|------|------|
| `fj-android/src/navigation/AppNavigator.tsx` | 修改：集成 TodayInspectionScreen + 嵌套 Stack Navigator |
| `fj-android/src/navigation/TodayStack.tsx` | 新建（可选）：Today Tab 内嵌 Stack |

## workflow_path 判定
requirement_change_path — 涉及用户可见功能的新增（今日检查屏幕），虽然骨架已存在但需要集成工作。
