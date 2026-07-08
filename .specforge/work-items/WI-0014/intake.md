# Intake — WI-0014

## Work Item: WI-0014
## Title: Release 签名 + ProGuard/R8 混淆
## Date: 2026-07-05
## Workflow: feature_spec / requirement_change_path

## 核心目标

生成可分发的 Release APK：配置签名密钥、启用 ProGuard/R8 代码混淆和资源压缩。

## 范围

### IN-SCOPE
1. 生成 Release 签名密钥（keystore）
2. 配置 `android/app/build.gradle` 的 signingConfigs.release
3. 创建 `proguard-rules.pro`（保留 RN/keychain/watermelondb 反射类）
4. 启用 `buildTypes.release` 的 minifyEnabled + shrinkResources
5. Docker 容器内执行 `assembleRelease` 构建
6. 验证 Release APK 产物

### OUT-OF-SCOPE
- ABI Split（留给后续优化）
- 应用商店发布配置
- 签名密钥的 HSM/硬件安全模块管理

## 技术约束
- 构建环境：Docker `fj-builder:react-native-0.74`
- 密钥由 AI 生成（用户预先决策）
- ProGuard 规则需覆盖：react-native-keychain、watermelondb（虽然当前屏蔽但类文件仍在）、Hermes、OkHttp
