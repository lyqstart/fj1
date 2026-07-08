# Impact Analysis — WI-0018

## 代码影响
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/di/PhotoUploadPort.tsx` | 新建 | PhotoUploadQueue 的 React Context 注入端口 |
| `src/AppRoot.tsx` | 修改 | 实例化 PhotoUploadQueue 并通过 Provider 注入 |

## 风险
| 风险 | 缓解 |
|------|------|
| 降级模式相机不可用 | UI 明确提示"相机未配置"，不影响其他功能 |
| PhotoUploadQueue 无照片可传 | 队列空转，无副作用 |

## 依赖
- WI-0015（Database + ApiClient 已激活）
- PhotoUploadQueue / PhotoCapture 骨架已就绪
