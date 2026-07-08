# Change Classification — WI-0018

## 变更类型
Infrastructure Activation（降级模式） — 激活照片上传队列骨架，不解除原生模块屏蔽。

## 影响模块
| 模块 | 影响 |
|------|------|
| `fj-android/src/di/PhotoUploadPort.tsx` | 新建（可选）：PhotoUploadQueue 的 React 注入端口 |
| `fj-android/src/AppRoot.tsx` | 可能修改：注入 PhotoUploadQueue 实例 |

## workflow_path 判定
requirement_change_path — 涉及多个模块协调（PhotoUploadQueue + IssueEvidenceScreen 集成）。
