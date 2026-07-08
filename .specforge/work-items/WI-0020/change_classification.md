# WI-0020 变更分类

## 分类
- 类型: 技术债务解除 + 功能启用
- 复杂度: 高（原生模块编译，可能涉及 CMake/NDK）
- 风险: 中（vision-camera 需要 CMake/NDK 编译，可能耗时长）

## 影响模块
1. react-native-vision-camera (v4.x) — 需要 CMake + NDK 编译原生 C++ 代码
2. react-native-image-resizer — Java/Kotlin 原生模块
3. react-native-gesture-handler — React Navigation 核心依赖
4. react-native-safe-area-context — React Navigation 核心依赖
5. react-native-screens — React Navigation 核心依赖

## 风险评估
- vision-camera 是最大风险点：需要 CMake 3.30.5 + NDK 27.1（容器已具备）
- gesture-handler/safe-area-context/screens 是 RN 导航标准依赖，编译风险低
- image-resizer 是简单 Java 模块，风险低

## 策略
一次性解除全部屏蔽，统一编译验证。如某个模块编译失败，针对性修复（不回退屏蔽）。