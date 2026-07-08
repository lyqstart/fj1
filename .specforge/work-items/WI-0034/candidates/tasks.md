# WI-0034 Tasks

## Semantic Closure Declaration

<!-- semantic_closure
{
  "outcomes": [
    {"id": "OUT-W34-1", "description": "App 启动后不再白屏，用户能看到登录页面"}
  ],
  "requirements": [
    {"id": "REQ-W34-1", "description": "react-native.config.js 不得屏蔽 gesture-handler/screens 的 Android 原生模块", "outcome": "OUT-W34-1"},
    {"id": "REQ-W34-2", "description": "gesture-handler 版本必须与 RN 0.74 旧架构兼容", "outcome": "OUT-W34-1"},
    {"id": "REQ-W34-3", "description": "newArchEnabled 必须设为 false 避免 C++ TurboModule 不兼容", "outcome": "OUT-W34-1"}
  ],
  "design_decisions": [
    {"id": "DD-W34-1", "description": "使用旧架构 + Kotlin patch + ViewManagerWithGeneratedInterface shim 组合方案", "requirement": "REQ-W34-2"}
  ],
  "tasks": [
    {"id": "TASK-W34-1", "description": "清空 react-native.config.js 屏蔽", "design": "DD-W34-1", "file": "fj-android/react-native.config.js"},
    {"id": "TASK-W34-2", "description": "升级 gesture-handler 到 ^2.20.2", "design": "DD-W34-1", "file": "fj-android/package.json"},
    {"id": "TASK-W34-3", "description": "设置 newArchEnabled=false", "design": "DD-W34-1", "file": "fj-android/android/gradle.properties"},
    {"id": "TASK-W34-4", "description": "构建 Release APK", "design": "DD-W34-1", "file": "fj-android/fj-app-w34-release.apk"}
  ],
  "evidence": [
    {"id": "EV-W34-1", "task": "TASK-W34-1", "type": "file_content"},
    {"id": "EV-W34-2", "task": "TASK-W34-2", "type": "file_content"},
    {"id": "EV-W34-3", "task": "TASK-W34-3", "type": "file_content"},
    {"id": "EV-W34-4", "task": "TASK-W34-4", "type": "build_log"},
    {"id": "EV-W34-5", "task": "TASK-W34-4", "type": "artifact"},
    {"id": "EV-W34-6", "task": "TASK-W34-4", "type": "user_confirmation"}
  ]
}
-->

## Task 1: 清空 react-native.config.js 屏蔽

**文件**: `fj-android/react-native.config.js`

改为：
```js
module.exports = {};
```

**verification**: grep 确认不再含 `android:null` 屏蔽

## Task 2: 升级 gesture-handler + 关闭新架构 + 构建 Release APK

- `package.json`: gesture-handler `^2.16.2` → `^2.20.2`
- `gradle.properties`: `newArchEnabled=true` → `newArchEnabled=false`
- Clean build（原生模块配置变更）

**verification**: APK 存在 + 用户确认白屏消失