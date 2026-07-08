# WI-0034 Intake

## 变更描述
移除 react-native.config.js 中对 react-native-gesture-handler 和 react-native-screens 的原生模块屏蔽，让它们的 Android 原生模块正常编译链接。

## 白屏根因（决定性证据）
服务器日志显示：
```
2026-07-06T17:28:15.533Z [INFO] [BOOT] JS bundle executing, importing App module...
2026-07-06T17:28:15.547Z [ERROR] [BOOT] App module import FAILED 
  {message=TurboModuleRegistry.getEnforcing(...): 'RNGestureHandlerModule' could not be found}
```

**依赖链崩溃**：
```
App.tsx → NavigationContainer → react-native-gesture-handler 
  → TurboModuleRegistry.getEnforcing('RNGestureHandlerModule') 
  → ❌ 原生模块未注册（被 react-native.config.js 屏蔽）
```

## 为什么会这样
- WI-0020 因新架构不兼容临时屏蔽了这两个库的 Android 原生模块
- 但 JS 代码仍然 import 这两个库（通过 react-navigation 导航容器）
- WI-0032 已关闭新架构（newArchEnabled=false），旧架构下这两个库完全兼容
- 所以屏蔽已经没有必要，反而成为白屏根因

## 修复
`react-native.config.js` 内容改为空配置（`{}`），恢复 autolinking 默认行为。

## 守卫条件检查
- ✅ 无需求/设计/架构变更
- ✅ unknowns=[]
- ✅ code_only_fast_path 适用