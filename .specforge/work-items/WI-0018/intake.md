# Intake — WI-0018

## Work Item: WI-0018
## Title: 照片拍摄 + 分片上传骨架激活（降级模式）
## Date: 2026-07-05

## 核心目标

激活照片相关骨架代码的集成，确保 IssueEvidenceScreen 中 PhotoCapture / PhotoUploadQueue 路径不崩溃。**降级模式**：vision-camera / image-resizer 原生模块暂不解除屏蔽，使用 DefaultCameraProvider（不可用降级提示）。

## 范围

### IN-SCOPE
1. PhotoUploadQueue 实例化 + 注入到 SyncEnginePort 或 AppRoot
2. IssueEvidenceScreen 中照片流程路径验证（降级模式：相机不可用提示）
3. TypeScript 验证
4. Docker 构建验证

### OUT-OF-SCOPE
- 解除 vision-camera 屏蔽（CameraX 编译风险大，留给后续 WI）
- 解除 image-resizer 屏蔽（同上）
- 真实拍照功能（需要原生模块解除屏蔽）
- 后端照片上传端到端测试

## 降级策略（TD-WI0018-001）
- DefaultCameraProvider.isAvailable() = false
- IssueEvidenceScreen 拍照按钮显示"相机未配置"提示
- PhotoUploadQueue 实例化但无照片可上传（queue 为空）
- 后续 WI 解除屏蔽后替换 Provider 即可启用真实拍照

## 技术现状
- PhotoCapture.tsx（296 行）：DefaultCameraProvider + DefaultGpsProvider 已实现
- PhotoCompressor.tsx：骨架
- PhotoUploadQueue.ts（388 行）：完整骨架
- WatermarkOverlay.tsx：骨架