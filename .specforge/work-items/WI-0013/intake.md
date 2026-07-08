# Intake — WI-0013

## Work Item: WI-0013
## Title: 登录功能实现 + 真机安装测试
## Date: 2026-07-05
## Requester: 用户
## Workflow: feature_spec / requirement_change_path

---

## 1. 需求来源

WI-0012 已完成 React Native Android 骨架构建（TASK-1~7），成功生成 Debug APK。
本 WI 是 WI-0012 的后续，实现第一个用户可见功能：**登录**，并进行真机安装验证。

## 2. 核心目标

1. **实现登录界面和认证流程**——用户输入用户名/密码，调用后端 `/api/v1/auth/login` 获取 JWT token
2. **Token 安全存储**——使用 react-native-keychain 存储 access/refresh token
3. **导航守卫**——未登录时显示 LoginScreen，登录成功后进入主 AppNavigator
4. **真机安装测试**——将 Debug APK 安装到真实 Android 设备，验证 App 能启动并完成登录

## 3. 范围

### IN-SCOPE（本 WI 做）
- LoginScreen 组件（用户名/密码输入、登录按钮、错误提示、加载状态）
- AuthStore / 认证状态管理（登录中 / 已登录 / 未登录 / 登录失败）
- KeychainStorage 类（实现 ApiClient.AuthTokensProvider 接口，基于 react-native-keychain）
- 导航守卫（App.tsx 根据 auth state 切换 LoginScreen / AppNavigator）
- ErrorBoundary 包装（防止白屏崩溃）
- SplashScreen（可选，如 RN 内置即可）
- 后端 API 联调（确认 `http://129.211.5.240/api/v1/auth/login` 可达）
- Debug APK 真机安装验证

### OUT-OF-SCOPE（本 WI 不做）
- 业务屏幕实装（TodayScreen / IssueBasketScreen / ProfileScreen 真实实现 → WI-0015~0019）
- Release 签名 / ProGuard（→ WI-0014）
- 数据库初始化 / WatermelonDB 同步（→ 后续 WI）
- 照片上传 / 离线同步（→ 后续 WI）
- 用户注册 / 密码找回

## 4. 已有骨架代码（WI-0012 遗产）

| 文件 | 说明 | 本 WI 需要做的 |
|------|------|---------------|
| `src/api/ApiClient.ts` | 完整 HTTP 客户端（367行），已定义 AuthTokensProvider 接口 | 注入 KeychainStorage 实现 |
| `src/config/AppConfig.ts` | `API_ROOT='http://129.211.5.240/api/v1'` | 无需修改 |
| `src/navigation/AppNavigator.tsx` | 3-Tab 占位导航 | 增加登录守卫 |
| `App.tsx` | 最小入口，渲染 `<AppNavigator />` | 改为根据 auth state 条件渲染 |
| `babel.config.js` | 已配置 decorators + class-properties | 无需修改（WI-0012 已还原） |
| `react-native.config.js` | 屏蔽 7 个原生模块 | 需评估：keychain 是否需要解除屏蔽 |

## 5. 后端登录 API 契约（已就绪）

### POST /api/v1/auth/login
- Request: `{ "username": "admin", "password": "admin123" }`
- Response: `{ "code": 0, "data": { "accessToken": "...", "refreshToken": "...", "user": { "id": 1, "username": "admin", "realName": "管理员" } } }`

### POST /api/v1/auth/refresh
- Request: `{ "refreshToken": "..." }`
- Response: 同 login

### POST /api/v1/auth/logout
- Header: `Authorization: Bearer {accessToken}`
- Response: `{ "code": 0, "data": null }`

### 已验证凭据
- admin / admin123（WI-0011 修复后）

## 6. 技术约束

- react-native-keychain 需要 Android 原生 autolinking（WI-0012 的 react-native.config.js 屏蔽了它，需解除屏蔽）
- 构建：仍使用 Docker `fj-builder:react-native-0.74` 容器
- APK：Debug 模式即可（不需要 Release 签名）
- 真机安装：adb install 或手动安装

## 7. 验收标准（预期）

1. App 启动后显示登录界面
2. 输入正确凭据后进入主界面（3-Tab 导航）
3. 输入错误凭据显示错误提示
4. 登录状态持久化（杀进程重启后保持登录）
5. Debug APK 能安装到真实 Android 设备并运行

## 8. 风险

- react-native-keychain autolinking 可能引入额外的原生编译
- Android 9.0 (API 28) cleartext HTTP 需要确认 networkSecurityConfig
- 真机测试需要用户有 Android 设备和 adb 环境
