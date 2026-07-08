# Impact Analysis — WI-0017

## 代码影响
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/navigation/AppNavigator.tsx` | 修改 | 3 个 SimplePlaceholder 替换为真实组件 + 导入 |

## 风险
| 风险 | 缓解 |
|------|------|
| 骨架代码 TypeScript 类型问题 | 已在 WI-0015 修复 tsc，预期无新错误 |
| PhotoCapture/PhotoCompressor 端口注入降级 | 骨架代码已有降级处理（DefaultCameraProvider 不可用提示） |

## 依赖
- WI-0016（InspectionStack 已建立）
- 3 个骨架屏幕已就绪
