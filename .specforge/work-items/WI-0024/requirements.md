---
requirements_format: ears
---

# Requirements Candidate — WI-0024 生物识别指纹登录

## 简介

本规格定义生物识别（指纹）快速登录功能的需求。用户在登录成功后可选启用"指纹登录"，启用时使用 react-native-keychain 的 AccessControl.BIOMETRY_CURRENT_SET 存储凭证；App 启动时自动检测并触发系统指纹对话框，验证通过后自动登录。无需引入新依赖。

## 术语表

| 术语 | 定义 |
|------|------|
| 生物识别凭证 | 使用 AccessControl.BIOMETRY_CURRENT_SET 存储在 keychain 中的用户登录凭证，仅当前指纹集可解锁 |
| BIOMETRY_CURRENT_SET | react-native-keychain 的访问控制模式，要求当前设备设置的生物特征通过后才能读取存储值；指纹变更后凭证自动失效 |
| 指纹登录 | 通过系统生物识别对话框验证用户指纹后，使用存储凭证自动完成登录的流程 |
| 指纹开关 | ProfileScreen 中用户启用或禁用指纹登录的 UI 控件（Switch 组件） |
| 手动登录 | 用户手动输入账号密码的常规登录方式，本功能的回退路径 |

## 需求

### REQ-1 生物识别凭证存储

**优先级**：Must

**用户故事**：作为已登录用户，我希望可以选择启用指纹登录，以便下次启动 App 时通过指纹快速登录而无需手动输入账号密码。

**验收标准**：
1. [Event-driven] WHEN 用户在 ProfileScreen 打开"启用指纹登录"开关时，THE 系统 SHALL 调用系统生物识别对话框验证当前用户指纹。
2. [Event-driven] WHEN 指纹验证通过时，THE 系统 SHALL 使用 keychain setInternetCredentials + AccessControl.BIOMETRY_CURRENT_SET 存储当前用户凭证（username + password）。
3. [Unwanted-behavior] IF 指纹验证失败或用户取消时，THEN THE 系统 SHALL 不存储任何凭证并将开关恢复为关闭状态。

### REQ-2 生物识别登录流程

**优先级**：Must

**用户故事**：作为已启用指纹登录的用户，我希望 App 启动时自动弹出指纹对话框，以便验证指纹后自动登录进入主界面，无需手动输入。

**验收标准**：
1. [Event-driven] WHEN App 启动且检测到已存储的生物识别凭证时，THE 系统 SHALL 自动触发系统指纹对话框。
2. [Event-driven] WHEN 指纹验证通过时，THE 系统 SHALL 使用存储的凭证自动完成登录并进入主界面。
3. [Unwanted-behavior] IF 生物识别凭证不存在、验证失败或用户取消时，THEN THE 系统 SHALL 回退到手动登录界面且不向用户报错。

## 配置点清单

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| keychain service name | fj-biometric-auth | keychain 存储的 service 标识，BiometricAuth 内部常量 |
