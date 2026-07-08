# WI-0020 Intake

## 背景
fj-android RN App 核心功能骨架已完成（WI-0012~0019），但 react-native.config.js 仍屏蔽 5 个原生模块以避免编译失败：
- react-native-vision-camera
- react-native-image-resizer
- react-native-gesture-handler
- react-native-safe-area-context
- react-native-screens

这些模块的原生链接被设为 `platforms: { android: null }`，导致：
1. 相机/图片压缩功能处于降级模式（DefaultCameraProvider.isAvailable()=false）
2. React Navigation 使用 JS fallback（无原生手势/原生屏幕优化）
3. SafeArea 不支持 notch/刘海屏

## 目标
解除全部 5 个模块的屏蔽，恢复原生 autolinking，修复编译问题，确保 BUILD SUCCESSFUL。

## 范围
- react-native.config.js 清空屏蔽列表
- 修复因解除屏蔽导致的编译错误（CMake/Gradle/Java/Kotlin）
- 确保现有功能不受影响（tsc + Debug APK 构建）

## 约束
- 不改变现有业务逻辑
- 不升级依赖版本
- 使用 Docker fj-builder:react-native-0.74 构建

## 验收标准
- react-native.config.js dependencies 为空或注释
- tsc exit 0
- Docker assembleDebug BUILD SUCCESSFUL
- APK 可正常安装