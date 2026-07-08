# Impact Analysis — WI-0013

## Work Item: WI-0013
## Date: 2026-07-05

---

## 1. 影响范围

### 1.1 代码影响

| 文件/目录 | 操作 | 影响描述 |
|-----------|------|----------|
| `fj-android/src/screens/auth/LoginScreen.tsx` | 新增 | 登录界面组件 |
| `fj-android/src/store/auth/AuthStore.ts` | 新增 | 认证状态管理（login/logout/refresh） |
| `fj-android/src/store/auth/AuthContext.tsx` | 新增 | React Context for auth state |
| `fj-android/src/api/KeychainStorage.ts` | 新增 | AuthTokensProvider 实现（react-native-keychain） |
| `fj-android/src/components/ErrorBoundary.tsx` | 新增 | 全局错误边界 |
| `fj-android/src/navigation/AppNavigator.tsx` | 修改 | 集成 auth 守卫 |
| `fj-android/App.tsx` | 修改 | 条件渲染 + ErrorBoundary + AuthProvider |
| `fj-android/react-native.config.js` | 修改 | 解除 keychain 屏蔽 |
| `fj-android/android/app/src/main/AndroidManifest.xml` | 可能修改 | cleartext HTTP 权限（如未配置） |

### 1.2 构建影响

- react-native-keychain 解除 autolinking 屏蔽后，需要重新 `assembleDebug`
- keychain 原生模块会引入额外的 .so / Java 类
- 预期 APK 体积可能略增（+1-2MB）

### 1.3 运行时影响

- App 启动行为改变：先检查 token → 决定显示 Login 还是 Main
- 网络请求：首次发起真实 HTTP 请求到 `http://129.211.5.240`

### 1.4 无影响项

- 后端：无需修改（API 已就绪）
- 数据库：无需初始化 WatermelonDB（留到后续 WI）
- 其他业务屏幕：保持占位状态

## 2. 风险评估

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| keychain autolinking 编译失败 | 中 | 高 | 预留编译验证 task，如失败则 fallback 到 AsyncStorage |
| Android 9 cleartext HTTP 被阻止 | 低 | 高 | 检查 AndroidManifest networkSecurityConfig |
| 真机无 adb 环境 | 中 | 低 | 备选方案：手动拷贝 APK 安装 |
| token 存储格式不兼容 | 低 | 低 | keychain 标准 InternetCredentials 格式 |

## 3. 依赖项

| 依赖 | 类型 | 状态 |
|------|------|------|
| react-native-keychain | npm package | 已在 package.json（WI-0012 安装） |
| 后端 /api/v1/auth/login | API | ✅ 已就绪（WI-0011 修复后验证通过） |
| Docker 构建环境 | 工具链 | ✅ 就绪（fj-builder:react-native-0.74 + AUTH 授权） |

## 4. 回滚方案

如 keychain autolinking 导致构建失败：
1. 回退 react-native.config.js（重新屏蔽 keychain）
2. 使用 AsyncStorage 替代 keychain（安全性降低但功能可用）
3. 不影响 WI-0012 已完成的骨架代码
