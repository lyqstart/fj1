# WI-0022 Intake

## 目标
构建最终 Release APK（含所有 WI-0020/0021 增强功能），使用 WI-0014 的签名配置。

## 范围
- Docker assembleRelease 构建
- ProGuard/R8 混淆（已在 WI-0014 配置）
- 签名验证

## 验收标准
- BUILD SUCCESSFUL
- apksigner verify 通过
- Release APK 可安装