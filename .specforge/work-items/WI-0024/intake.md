# WI-0024 Intake

## 目标
生物识别（指纹）快速登录 — 使用 react-native-keychain accessControl BIOMETRY，无需新依赖。

## 方案
- 登录成功后，用户可选启用"指纹登录"
- 启用时，用 keychain setInternetCredentials + AccessControl.BIOMETRY_CURRENT_SET 存储凭证
- App 启动时，如果检测到生物识别凭证，自动触发系统指纹对话框
- 指纹验证通过后，用存储的凭证自动登录

## 范围
- src/store/auth/BiometricAuth.ts — 新建（封装 keychain 生物识别）
- src/store/auth/AuthContext.tsx — 添加 biometric login 流程
- src/screens/profile/ProfileScreen.tsx — 添加"启用指纹登录"开关

## 验收标准
- BiometricAuth.ts 实现 get/set/has/remove 四个方法
- AuthContext 启动时检查生物识别
- ProfileScreen 有指纹开关
- tsc exit 0
- Docker BUILD SUCCESSFUL