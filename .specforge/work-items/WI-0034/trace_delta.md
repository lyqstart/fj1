# WI-0034 Trace Delta

## 规格影响
**无规格影响**（code_only_fast_path，仅修复构建配置）

## 变更追溯

| OUT | REQ | AC | DD | TASK | FILE | EVIDENCE |
|-----|-----|----|----|------|------|----------|
| OUT-W34-1 | REQ-W34-1 | AC-W34-1 | DD-W34-1 | TASK-W34-1 | react-native.config.js | EV-W34-1 |
| OUT-W34-1 | REQ-W34-2 | AC-W34-2 | DD-W34-1 | TASK-W34-2 | package.json | EV-W34-2 |
| OUT-W34-1 | REQ-W34-3 | AC-W34-3 | DD-W34-1 | TASK-W34-3 | gradle.properties | EV-W34-3 |
| OUT-W34-1 | REQ-W34-1 | AC-W34-4 | DD-W34-1 | TASK-W34-4 | fj-app-w34-release.apk | EV-W34-4, EV-W34-5 |
| OUT-W34-1 | REQ-W34-1 | AC-W34-6 | DD-W34-1 | TASK-W34-4 | (真机测试) | EV-W34-6 |

## 语义实体

### Outcome
- **OUT-W34-1**: App 启动后不再白屏，用户能看到登录页面

### Requirements
- **REQ-W34-1**: react-native.config.js 不得屏蔽 gesture-handler/screens 的 Android 原生模块
- **REQ-W34-2**: gesture-handler 版本必须与 RN 0.74 旧架构兼容
- **REQ-W34-3**: newArchEnabled 必须设为 false 避免 C++ TurboModule 不兼容

### Acceptance Criteria
- **AC-W34-1**: config.js 清空为 module.exports = {}
- **AC-W34-2**: gesture-handler >= 2.20.2
- **AC-W34-3**: newArchEnabled=false
- **AC-W34-4**: BUILD SUCCESSFUL
- **AC-W34-5**: APK ~58MB
- **AC-W34-6**: 用户确认白屏消失

### Design Decision
- **DD-W34-1**: 旧架构 + Kotlin patch + shim 组合方案

### Tasks
- **TASK-W34-1**: 清空 react-native.config.js 屏蔽
- **TASK-W34-2**: 升级 gesture-handler
- **TASK-W34-3**: 设置 newArchEnabled=false
- **TASK-W34-4**: 构建 Release APK