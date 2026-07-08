# WI-0032 Impact Analysis

## 影响范围
- **文件**: `fj-android/android/gradle.properties`（第 37 行）
- **影响**: 关闭新架构后，Fabric 渲染器不加载，使用旧架构 Bridge 模式

## 无影响项
- 不影响 JS 代码
- 不影响 API 接口
- RN 0.74 完全支持旧架构
- 应用不依赖任何新架构独有特性