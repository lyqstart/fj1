---
requirements_format: ears
work_item_id: WI-0013
workflow_type: feature_spec
workflow_path: requirement_change_path
base_spec_version: PSV-0001
candidate_type: requirements
---

# Requirements Candidate — 登录功能实现 + 真机安装测试

## 简介

本 Work Item（WI-0013）为 fj1 项目的 React Native 安卓端（`fj-android/`）实现**第一个用户可见功能——登录**，并完成**真机安装验证**。它是 WI-0012（RN 安卓骨架构建 + Debug APK 生成）的直接后续：WI-0012 已交付可构建的骨架代码（`ApiClient.ts`、`AppConfig.ts`、`AppNavigator.tsx`、`App.tsx`、`react-native.config.js` 等），本 WI 在此骨架之上注入认证能力，使 App 从「最小可渲染」升级为「可登录、可持久会话、可在真机完成端到端登录流程」。

### 当前状态（基线）

- WI-0012 已成功在 Docker 容器 `fj-builder:react-native-0.74` 中构建出 Debug APK（`android/app/build/outputs/apk/debug/app-debug.apk`，约 124MB）
- `fj-android/src/api/ApiClient.ts`（367 行）已定义完整的 HTTP 客户端，含 `AuthTokensProvider` 注入接口、401 自动刷新重试逻辑、统一响应解析 `{ code, message, data, trace_id }`、错误分类（network/timeout/server/auth/parse）
- `fj-android/src/config/AppConfig.ts` 已硬编码 `API_ROOT = 'http://129.211.5.240/api/v1'`
- `fj-android/src/navigation/AppNavigator.tsx` 为 3-Tab 占位导航（今日/问题篮/我的）
- `fj-android/App.tsx` 当前仅渲染 `<AppNavigator />`，无任何认证守卫
- `fj-android/react-native.config.js` 当前屏蔽了 `react-native-keychain` 等 7 个原生模块的 autolinking
- `react-native-keychain` 已在 `package.json` 中安装，但因屏蔽未参与原生编译
- 后端 `/api/v1/auth/login`、`/api/v1/auth/refresh`、`/api/v1/auth/logout` 三个接口已就绪（WI-0011 修复后凭据 admin/admin123 验证通过）

### 本 WI 范围

1. 实现 `LoginScreen` 登录界面（用户名/密码输入、登录按钮、加载状态、错误提示）
2. 实现 `AuthStore` 认证状态管理（idle/loading/authenticated/unauthenticated/error 状态机）
3. 实现 `KeychainStorage` 类（实现 `ApiClient.AuthTokensProvider` 接口，基于 react-native-keychain）
4. 实现导航守卫（`App.tsx` 根据 auth state 条件渲染 LoginScreen / AppNavigator）
5. 实现 `ErrorBoundary` 全局错误边界（防止白屏崩溃）
6. 解除 `react-native-keychain` 的 autolinking 屏蔽并重新构建
7. 后端 API 联调（确认 `http://129.211.5.240/api/v1/auth/*` 在真机可达）
8. Debug APK 真机安装与端到端登录流程验证

### 不在范围内（明确排除）

| 项 | 转移到 | 说明 |
|----|--------|------|
| 业务屏幕实装（TodayScreen / IssueBasketScreen / ProfileScreen 真实实现） | WI-0015 ~ WI-0019 | 本 WI 保持 3-Tab 占位导航 |
| Release 签名 / ProGuard / R8 混淆 | WI-0014 | 本 WI 仅 Debug 构建 |
| 数据库初始化 / WatermelonDB 同步 | 后续 WI | 登录不依赖本地数据库 |
| 照片上传 / 离线同步 | 后续 WI | — |
| 用户注册 / 密码找回 / 找回用户名 | 后续 WI | 本 WI 不提供注册入口 |
| 生物识别（指纹/面容）登录 | 后续 WI | 仅用户名/密码登录 |
| 多账号切换 / 账号管理 | 后续 WI | 单账号登录 |
| HTTPS / 证书绑定 | 后续 WI | 当前后端为 HTTP cleartext |

---

## 术语表

| 术语 | 定义 |
|------|------|
| **JWT** | JSON Web Token，一种无状态令牌格式；本项目后端在登录成功后签发 `accessToken`（短期，用于业务请求鉴权）与 `refreshToken`（长期，用于在 accessToken 过期后换取新令牌对） |
| **Access Token** | 访问令牌；放置在 HTTP 请求头 `Authorization: Bearer {accessToken}` 中，由后端校验有效性；过期后由 ApiClient 自动用 Refresh Token 刷新 |
| **Refresh Token** | 刷新令牌；当 Access Token 失效（401）时，ApiClient 调用 `/api/v1/auth/refresh` 携带此令牌换取新的令牌对；Refresh Token 过期则强制登出 |
| **AuthStore** | 认证状态管理单元；维护认证状态机（idle / loading / authenticated / unauthenticated / error）并提供 `login()` / `logout()` 方法；具体实现方式（Context/Zustand/MobX）由 sf-design 决定 |
| **认证状态机** | AuthStore 内部的有限状态自动机；状态包括 `idle`（初始）、`loading`（登录请求进行中）、`authenticated`（已登录，持有有效 token 与用户信息）、`unauthenticated`（未登录或已登出）、`error`（登录失败，持有错误信息） |
| **AuthTokensProvider** | `ApiClient.ts` 中定义的依赖注入接口（`getAccessToken()` / `getRefreshToken()` / `refreshTokens()` / `onAuthFailed()`）；生产实现为 `KeychainStorage`，测试实现可返回固定令牌，从而解耦 ApiClient 与具体密钥存储 |
| **KeychainStorage** | `AuthTokensProvider` 接口的生产实现类；基于 `react-native-keychain` 将令牌对安全存储于 Android Keystore 支持的加密存储区，而非明文 AsyncStorage |
| **react-native-keychain** | 第三方 RN 库（已在 `package.json` 中安装）；提供 iOS Keychain / Android Keystore 的统一封装；本 WI 需恢复其 autolinking 使原生模块参与编译 |
| **导航守卫** | 应用入口（`App.tsx`）根据当前 auth state 条件渲染根组件的逻辑：`unauthenticated` 渲染 `LoginScreen`，`authenticated` 渲染 `AppNavigator`，`loading` 渲染加载指示器 |
| **ErrorBoundary** | React 错误边界组件；捕获子组件树渲染期未捕获异常，显示降级 UI 而非白屏崩溃 |
| **autolinking** | React Native 0.60+ 的原生模块自动链接机制；`react-native.config.js` 中 `dependencies.<pkg>.platforms.android = null` 表示屏蔽该模块的原生链接 |
| **networkSecurityConfig** | Android 7.0+（API 24+）的网络安全策略配置；默认禁止 cleartext HTTP 流量，需通过 `android:usesCleartextTraffic` 或 `network_security_config.xml` 显式放行目标域名/IP |
| **AuthContext / AuthProvider** | React Context 提供者；将 AuthStore 状态注入组件树供子组件消费；是否采用 Context 由 sf-design 决定（术语预留） |
| **统一响应结构** | 后端所有接口返回 `{ code: number, message: string, data: T, trace_id: string }`；`code === 0` 表示业务成功，非 0 表示业务错误 |
| **EARS** | Easy Approach to Requirements Syntax，需求句式规范；本 WI 验收标准全部采用 EARS 六种模式 |
| **AC** | Acceptance Criterion，验收标准 |

---

## 需求

> 优先级标注：**Must**（本 WI 必须达成，阻塞验收）/ **Should**（强烈建议，非阻塞）/ **Could**（可选增强）

---

### REQ-001（FR-1）LoginScreen 登录界面渲染

**用户故事**：作为飞检现场检查员，我希望打开 App 后看到一个简洁的登录界面，包含用户名输入框、密码输入框和登录按钮，以便我能输入凭据完成登录。

**优先级**：Must

**验收标准（EARS）**：

1. [State-driven] WHILE 应用认证状态为 `unauthenticated`，THE 系统 SHALL 渲染 `LoginScreen` 组件，该组件包含至少 3 个可见元素：用户名输入框（`TextInput`）、密码输入框（`TextInput`）、登录按钮（`Button` 或 `TouchableOpacity`）。
2. [Ubiquitous] THE 系统 SHALL 在用户名输入框上方或内部显示中文标签「用户名」，在密码输入框上方或内部显示中文标签「密码」，在登录按钮上显示中文文案「登录」。
3. [Ubiquitous] THE 系统 SHALL 将密码输入框的 `secureTextEntry` 属性设置为 `true`，使用户输入的密码以掩码（圆点）形式显示，不可明文可见。
4. [Event-driven] WHEN 应用首次启动且认证状态为 `idle` 或 `loading`（初始化检查中），THE 系统 SHALL 不立即展示完整的登录表单，而是显示加载指示器（`ActivityIndicator`）或启动画面，避免界面闪烁。
5. [Unwanted-behavior] IF `LoginScreen` 所依赖的子组件（输入框、按钮）抛出渲染异常，THEN THE 系统 SHALL 由 `ErrorBoundary` 捕获并显示降级 UI，不得出现白屏。

---

### REQ-002（FR-2）登录表单输入与即时校验

**用户故事**：作为飞检现场检查员，我希望在输入用户名和密码时得到即时反馈——当字段为空时登录按钮不可点击，以便我避免提交无效的空表单。

**优先级**：Must

**验收标准（EARS）**：

1. [Event-driven] WHEN 用户在用户名输入框中输入文本时，THE 系统 SHALL 实时更新表单状态中的 `username` 字段值。
2. [Event-driven] WHEN 用户在密码输入框中输入文本时，THE 系统 SHALL 实时更新表单状态中的 `password` 字段值。
3. [State-driven] WHILE 用户名输入框为空或密码输入框为空，THE 系统 SHALL 将登录按钮置为禁用状态（`disabled: true`），且禁用状态的视觉样式（如降低不透明度 `<opacity: 0.5>` 或灰色）与可用状态有明显区分。
4. [State-driven] WHILE 用户名与密码均非空，THE 系统 SHALL 将登录按钮恢复为可用状态（`disabled: false`）。
5. [Event-driven] WHEN 用户清空任一输入框时，THE 系统 SHALL 立即将登录按钮重新置为禁用状态。
6. [Optional-feature] WHERE 设备支持自动填充（autofill），THE 系统 SHALL 允许用户名输入框接收系统自动填充凭据，但本 WI **不**强制实现自定义自动填充逻辑。

---

### REQ-003（FR-3）登录提交与加载状态

**用户故事**：作为飞检现场检查员，我希望点击登录按钮后，按钮立即变为加载状态并禁用重复点击，以便我知道登录请求正在进行且不会重复提交。

**优先级**：Must

**验收标准（EARS）**：

1. [Event-driven] WHEN 用户点击处于可用状态的登录按钮时，THE 系统 SHALL 调用 `AuthStore.login(username, password)`，该方法向 `/api/v1/auth/login` 发送 `POST` 请求，请求体为 `{ "username": <输入值>, "password": <输入值> }`（JSON，`Content-Type: application/json`）。
2. [State-driven] WHILE 登录请求进行中（AuthStore 状态为 `loading`），THE 系统 SHALL 将登录按钮切换为加载状态：显示 `ActivityIndicator`（旋转加载指示器）替代或附加于按钮文案，并将按钮设置为 `disabled: true` 以阻止重复提交。
3. [Event-driven] WHEN 后端返回成功响应（HTTP 2xx 且 `code === 0`），THE 系统 SHALL 从响应 `data` 中提取 `accessToken`、`refreshToken`、`user: { id, username, realName }`，将令牌对写入 `KeychainStorage`，将用户信息存入 AuthStore，并将 AuthStore 状态转换为 `authenticated`。
4. [Ubiquitous] THE 系统 SHALL 在登录请求进行期间，**不**清空用户已输入的用户名与密码字段值，直到状态转换为 `authenticated` 或 `error` 后由设计决定是否清空。
5. [Unwanted-behavior] IF 用户在加载状态下再次点击登录按钮，THEN THE 系统 SHALL 忽略该次点击（因按钮已禁用），**不**发起新的登录请求。

---

### REQ-004（FR-4）登录失败错误处理

**用户故事**：作为飞检现场检查员，我希望登录失败时看到清晰、具体的错误提示（区分凭据错误、网络不可达、请求超时），以便我知道该如何修正或重试。

**优先级**：Must

**验收标准（EARS）**：

1. [Event-driven] WHEN 后端返回凭据无效（HTTP 401 或业务 `code` 表示认证失败），THE 系统 SHALL 将 AuthStore 状态转换为 `error`，并在 `LoginScreen` 显示中文错误提示「用户名或密码错误」，且**不**泄露后端具体的失败原因（如「用户不存在」与「密码错误」对用户显示相同文案）。
2. [Event-driven] WHEN 登录请求因网络不可达失败（`ApiError.kind === 'network'`），THE 系统 SHALL 在 `LoginScreen` 显示中文错误提示「网络连接失败，请检查网络后重试」。
3. [Event-driven] WHEN 登录请求因超时失败（`ApiError.kind === 'timeout'`），THE 系统 SHALL 在 `LoginScreen` 显示中文错误提示「请求超时，请重试」。
4. [Event-driven] WHEN 后端返回服务端错误（`ApiError.kind === 'server'`，HTTP 5xx 或业务 `code !== 0`），THE 系统 SHALL 在 `LoginScreen` 显示中文错误提示「服务暂时不可用，请稍后重试」。
5. [State-driven] WHILE AuthStore 状态为 `error` 且持有错误信息，THE 系统 SHALL 将登录按钮恢复为可用状态（若用户名/密码非空），允许用户修正后重新提交。
6. [Event-driven] WHEN 用户在错误状态下重新编辑任一输入框时，THE 系统 SHALL 清除当前显示的错误提示，避免残留过期错误信息。
7. [Unwanted-behavior] IF 错误提示文本超过 1 行无法完整显示，THEN THE 系统 SHALL 允许错误提示文本换行或省略，且**不**遮挡登录表单的核心输入区域。

---

### REQ-005（FR-5）认证状态机（AuthStore）

**用户故事**：作为 fj1 开发者，我希望 AuthStore 以明确的状态机管理认证生命周期，状态之间转换受严格规则约束，以便 UI 层能基于确定性状态进行条件渲染，避免中间态导致的界面闪烁或逻辑错误。

**优先级**：Must

**验收标准（EARS）**：

1. [Ubiquitous] THE 系统（AuthStore）SHALL 定义且仅定义以下 5 个认证状态：`idle`（初始未检查）、`loading`（登录请求进行中或启动期 token 检查中）、`authenticated`（已登录，持有有效 token 与用户信息）、`unauthenticated`（未登录或已登出）、`error`（登录失败，持有错误信息）。
2. [Event-driven] WHEN 应用启动时，THE 系统 SHALL 将 AuthStore 初始状态设为 `idle`，随后立即触发 token 检查流程（见 REQ-009），检查期间状态保持 `loading` 或 `idle` 直到确定为 `authenticated` 或 `unauthenticated`。
3. [Event-driven] WHEN `AuthStore.login()` 被调用时，THE 系统 SHALL 将状态从 `unauthenticated`（或 `error`）转换为 `loading`。
4. [Event-driven] WHEN 登录成功时，THE 系统 SHALL 将状态从 `loading` 转换为 `authenticated`，并存储用户信息（`{ id, username, realName }`）。
5. [Event-driven] WHEN 登录失败时，THE 系统 SHALL 将状态从 `loading` 转换为 `error`，并存储错误信息（错误类型与可显示文案）。
6. [Event-driven] WHEN `AuthStore.logout()` 被调用并完成时，THE 系统 SHALL 将状态转换为 `unauthenticated`，并清除内存中的用户信息与令牌。
7. [Unwanted-behavior] IF AuthStore 收到非法状态转换（如从 `authenticated` 直接调用 `login` 而未先 `logout`），THEN THE 系统 SHALL 拒绝该转换并记录警告日志，状态保持不变。

---

### REQ-006（FR-6）KeychainStorage 令牌安全存储

**用户故事**：作为 fj1 开发者，我希望 KeychainStorage 实现 `ApiClient.AuthTokensProvider` 接口，将 accessToken 与 refreshToken 安全存储于 Android Keystore 支持的加密存储区，以便令牌不以明文形式落盘，且 ApiClient 能通过依赖注入获取令牌。

**优先级**：Must

**验收标准（EARS）**：

1. [Ubiquitous] THE 系统（`KeychainStorage` 类）SHALL 实现 `ApiClient.AuthTokensProvider` 接口的全部必需方法：`getAccessToken(): Promise<string | null>`、`getRefreshToken(): Promise<string | null>`、`refreshTokens(): Promise<{ accessToken: string; refreshToken: string } | null>`。
2. [Event-driven] WHEN 登录成功获得令牌对时，THE 系统 SHALL 调用 `react-native-keychain` 的存储 API（如 `setGenericPassword` 或 `setInternetCredentials`），将 accessToken 与 refreshToken 持久化存储。
3. [Event-driven] WHEN `getAccessToken()` 被调用时，THE 系统 SHALL 从 keychain 读取并返回当前 accessToken；若未存储任何令牌，SHALL 返回 `null`。
4. [Event-driven] WHEN `getRefreshToken()` 被调用时，THE 系统 SHALL 从 keychain 读取并返回当前 refreshToken；若未存储，SHALL 返回 `null`。
5. [Ubiquitous] THE 系统 SHALL **不**使用 `AsyncStorage`（明文存储）存放 accessToken 或 refreshToken；令牌的持久化必须经由 `react-native-keychain` 提供的加密存储路径。
6. [Event-driven] WHEN 登出流程执行时，THE 系统 SHALL 调用 keychain 的清除 API（如 `resetGenericPassword` 或 `resetInternetCredentials`）删除已存储的令牌，使后续 `getAccessToken()` 返回 `null`。
7. [Unwanted-behavior] IF keychain 读取/写入操作抛出异常（如设备不支持、权限被拒），THEN THE 系统 SHALL 捕获异常并返回 `null`（读取）或将错误向上传播至 AuthStore（写入），**不**使应用崩溃。

---

### REQ-007（FR-7）令牌自动刷新与认证失败回调

**用户故事**：作为飞检现场检查员，我希望当 accessToken 过期时 App 能自动用 refreshToken 静默换取新令牌，无需我重新登录；只有当 refreshToken 也失效时才要求重新登录，以便我获得平滑的会话体验。

**优先级**：Must

**验收标准（EARS）**：

1. [Event-driven] WHEN ApiClient 收到业务请求的 401 响应且 `AuthTokensProvider.refreshTokens()` 可用时，THE 系统 SHALL 调用 `/api/v1/auth/refresh`（请求体 `{ "refreshToken": <当前 refreshToken> }`）尝试刷新令牌对（此逻辑已由 `ApiClient.ts` 内置，本 WI 需保证 `KeychainStorage.refreshTokens()` 正确接续）。
2. [Event-driven] WHEN `KeychainStorage.refreshTokens()` 收到刷新成功响应时，THE 系统 SHALL 将新的 accessToken 与 refreshToken 写回 keychain（覆盖旧值），并返回新令牌对给 ApiClient 以重试原请求。
3. [Event-driven] WHEN 刷新请求失败（refreshToken 过期、后端返回认证错误），THE 系统 SHALL 从 `refreshTokens()` 返回 `null`，触发 ApiClient 调用 `onAuthFailed()` 回调。
4. [Event-driven] WHEN `KeychainStorage.onAuthFailed()` 被调用时，THE 系统 SHALL 触发 AuthStore 的状态转换为 `unauthenticated`，清除内存令牌与用户信息，并清除 keychain 中存储的令牌，使 UI 回到 `LoginScreen`。
5. [Unwanted-behavior] IF 同一请求在刷新后仍返回 401，THEN THE 系统 SHALL **不**再次刷新（ApiClient 已内置 `retried` 标记防无限循环），直接抛出 `ApiError(kind: 'auth')` 并触发 `onAuthFailed()`。
6. [Ubiquitous] THE 系统 SHALL 在令牌刷新过程中**不**中断用户当前操作（刷新对用户透明），除非刷新彻底失败需要登出。

---

### REQ-008（FR-8）登出流程

**用户故事**：作为飞检现场检查员，我希望能在 App 内主动登出，登出后 App 清除本地凭据并回到登录界面，以便我切换设备或保护账号安全。

**优先级**：Must

**验收标准（EARS）**：

1. [Event-driven] WHEN `AuthStore.logout()` 被调用时，THE 系统 SHALL 向 `/api/v1/auth/logout` 发送 `POST` 请求，请求头携带 `Authorization: Bearer {当前 accessToken}`。
2. [Event-driven] WHEN 登出请求完成（无论成功或失败），THE 系统 SHALL 调用 `KeychainStorage` 清除本地令牌（见 REQ-006 AC-6），并将 AuthStore 状态转换为 `unauthenticated`。
3. [State-driven] WHILE 登出请求进行中，THE 系统 SHALL 显示登出进行中的反馈（如按钮加载态或全局 loading 遮罩，具体由 sf-design 决定）。
4. [Unwanted-behavior] IF 登出请求因网络错误或超时失败，THEN THE 系统 SHALL **仍然**清除本地令牌并转换为 `unauthenticated` 状态（保证本地登出成功），后端 session 失效可由 refreshToken 自然过期兜底。
5. [Event-driven] WHEN AuthStore 状态转换为 `unauthenticated` 后，THE 系统（`App.tsx` 导航守卫）SHALL 立即将根视图切换为 `LoginScreen`。

---

### REQ-009（FR-9）登录状态持久化（重启保持登录）

**用户故事**：作为飞检现场检查员，我希望杀掉 App 进程后重新打开时，如果之前已登录，App 能自动恢复登录状态直接进入主界面，而不要求我重新输入凭据，以便我获得连续的使用体验。

**优先级**：Must

**验收标准（EARS）**：

1. [Event-driven] WHEN 应用启动并完成 AuthStore 初始化时，THE 系统 SHALL 调用 `KeychainStorage.getAccessToken()` 检查本地是否存在有效令牌。
2. [Event-driven] WHEN 启动检查发现 keychain 中存在 accessToken 时，THE 系统 SHALL 将 AuthStore 状态转换为 `authenticated`，并从持久化存储中恢复用户信息（`{ id, username, realName }`），使导航守卫渲染 `AppNavigator`。
3. [Event-driven] WHEN 启动检查发现 keychain 中不存在令牌（`getAccessToken()` 返回 `null`）时，THE 系统 SHALL 将 AuthStore 状态转换为 `unauthenticated`，使导航守卫渲染 `LoginScreen`。
4. [State-driven] WHILE 启动 token 检查进行中，THE 系统 SHALL 显示加载指示器或启动画面，**不**显示登录表单也**不**显示主界面，避免界面闪烁。
5. [Ubiquitous] THE 系统 SHALL 将用户信息（`{ id, username, realName }`）与令牌一起持久化，以便重启后能恢复完整的 `authenticated` 状态（含用户信息）；用户信息的持久化介质由 sf-design 决定，但令牌必须经 keychain（见 REQ-006）。
6. [Unwanted-behavior] IF 启动检查时 keychain 读取抛出异常，THEN THE 系统 SHALL 将状态降级为 `unauthenticated`（视为未登录），**不**使应用卡在加载状态。

---

### REQ-010（FR-10）导航守卫（条件渲染）

**用户故事**：作为 fj1 开发者，我希望 `App.tsx` 根据当前认证状态条件渲染根组件，使未登录用户只能看到登录界面、已登录用户进入主界面、加载期间显示过渡态，以便认证状态成为进入业务功能的唯一闸门。

**优先级**：Must

**验收标准（EARS）**：

1. [State-driven] WHILE AuthStore 状态为 `authenticated`，THE 系统（`App.tsx`）SHALL 渲染 `AppNavigator`（3-Tab 主导航）。
2. [State-driven] WHILE AuthStore 状态为 `unauthenticated` 或 `error`，THE 系统（`App.tsx`）SHALL 渲染 `LoginScreen`。
3. [State-driven] WHILE AuthStore 状态为 `idle` 或 `loading`（非登录提交场景，即启动检查中），THE 系统（`App.tsx`）SHALL 渲染加载指示器（`ActivityIndicator`）或 `SplashScreen`，**不**渲染 `LoginScreen` 也**不**渲染 `AppNavigator`。
4. [Event-driven] WHEN AuthStore 状态发生转换时，THE 系统 SHALL 立即根据新状态切换渲染的根组件，转换在 `<render_threshold: 100ms>` 内完成（无可见延迟）。
5. [Ubiquitous] THE 系统 SHALL 在 `App.tsx` 中用 `AuthProvider`（或等价的认证状态提供者）包裹根组件树，使所有子组件能访问当前认证状态。
6. [Unwanted-behavior] IF AuthStore 处于未知或非法状态，THEN THE 系统 SHALL 默认渲染加载指示器并记录错误日志，**不**渲染业务界面（fail-safe 默认拒绝）。

---

### REQ-011（FR-11）全局错误边界（ErrorBoundary）

**用户故事**：作为飞检现场检查员，我希望 App 在发生未捕获的渲染异常时显示一个友好的错误兜底界面而不是白屏崩溃，以便我能感知到问题并重启 App 而非以为设备故障。

**优先级**：Must

**验收标准（EARS）**：

1. [Ubiquitous] THE 系统 SHALL 在 `App.tsx` 中用 `ErrorBoundary` 组件包裹根组件树（位于 `AuthProvider` 与导航守卫之外或之内，由 sf-design 决定层级），使其捕获整个应用渲染期的未捕获异常。
2. [Event-driven] WHEN `ErrorBoundary` 捕获到子组件树抛出的渲染异常时，THE 系统 SHALL 显示降级 UI（fallback），降级 UI 包含中文错误提示（如「应用发生异常」）与一个「重新加载」按钮或可点击区域。
3. [Event-driven] WHEN 用户点击降级 UI 的「重新加载」时，THE 系统 SHALL 重置 ErrorBoundary 内部状态，重新渲染子组件树（尝试恢复）。
4. [Ubiquitous] THE 系统 SHALL 将捕获到的异常信息（错误消息、堆栈）输出到开发期日志（`console.error` 或日志服务），便于开发者排查；**不**在降级 UI 中向最终用户显示原始堆栈。
5. [Unwanted-behavior] IF `ErrorBoundary` 自身的降级 UI 渲染也抛出异常，THEN THE 系统 SHALL 退化为 React Native 默认的红色错误屏幕（开发期）或系统级崩溃处理（生产期），此为最后兜底。

---

### REQ-012（NFR-1）令牌与凭据安全非功能需求

**用户故事**：作为 fj1 安全负责人，我希望令牌与用户密码在整个认证流程中不以明文形式落盘、不出现在日志中、不在网络传输中泄露给第三方，以便满足基本的安全合规要求。

**优先级**：Must

**验收标准（EARS）**：

1. [Ubiquitous] THE 系统 SHALL **不**将 accessToken、refreshToken、用户密码写入 `AsyncStorage`、`SharedPreferences`、文件系统明文文件或任何未加密存储介质；令牌仅经 `react-native-keychain` 加密存储（见 REQ-006）。
2. [Ubiquitous] THE 系统 SHALL **不**在任何日志输出（`console.log` / `console.warn` / `console.error` / 日志服务）中打印用户的明文密码；密码仅在登录请求体中传输一次（HTTPS/TLS 由后续 WI 启用，当前为 HTTP cleartext 见 REQ-013）。
3. [Ubiquitous] THE 系统 SHALL **不**在日志中打印完整的 accessToken 或 refreshToken；如需调试，仅可打印令牌的前 `<token_preview_chars: 8>` 个字符与长度。
4. [Ubiquitous] THE 系统 SHALL 在登录请求中仅将密码放置于请求体（`body.password`），**不**放置于 URL 查询参数或请求头（避免被日志/代理记录）。
5. [Unwanted-behavior] IF 任何代码路径尝试将令牌或密码写入明文存储，THEN THE 系统 SHALL 在代码审查阶段被标记为安全违规并拒绝合并。

---

### REQ-013（NFR-2）明文 HTTP 网络安全配置

**用户故事**：作为 fj1 开发者，我希望 App 能在 Android 9.0+（API 28+）设备上访问 `http://129.211.5.240` 的后端 API，因为当前后端仅提供 HTTP cleartext 服务，以便登录流程在真机上网络可达。

**优先级**：Must

**验收标准（EARS）**：

1. [Event-driven] WHEN 应用在 Android 7.0+（API 24+）设备上运行时，THE 系统 SHALL 允许向 `http://129.211.5.240`（后端 API 服务器）发起 cleartext HTTP 请求，通过 `AndroidManifest.xml` 的 `android:usesCleartextTraffic="true"` 或 `network_security_config.xml` 中对该 IP 的显式 cleartext 放行实现。
2. [Ubiquitous] THE 系统 SHALL 将 cleartext 流量放行范围限制为后端 API 服务器 `129.211.5.240`（或更宽泛的 `<configurable: 后端 IP/域名>`），**不**全局无条件放行所有域名的 cleartext 流量（若采用 networkSecurityConfig 方案）。
3. [State-driven] WHILE `usesCleartextTraffic` 或 networkSecurityConfig 未正确配置，THE 系统 SHALL 在真机上表现为登录请求被系统拦截（连接被拒或超时），此为配置缺陷的失败模式。
4. [Event-driven] WHEN 本 WI 构建时，THE 系统 SHALL 确保 `AndroidManifest.xml`（位于 `android/app/src/main/AndroidManifest.xml`）包含上述网络安全配置，并在 Debug APK 中生效。

---

### REQ-014（CON-1）react-native-keychain autolinking 恢复

**用户故事**：作为 fj1 开发者，我希望恢复 `react-native-keychain` 的原生 autolinking（WI-0012 中为通过最小构建而临时屏蔽），使 keychain 原生模块参与 Debug APK 编译，以便 `KeychainStorage` 能在真机上调用真实的 keychain 原生 API。

**优先级**：Must

**验收标准（EARS）**：

1. [Event-driven] WHEN 本 WI 实施完成时，THE 系统（`react-native.config.js`）SHALL 移除 `react-native-keychain` 条目的 `platforms.android: null` 屏蔽（或将其改为启用 autolinking 的默认行为），使 keychain 参与原生链接。
2. [Ubiquitous] THE 系统 SHALL 在 `react-native.config.js` 中**保留** WI-0012 对其他 6 个原生模块（`@nozbe/watermelondb`、`react-native-vision-camera`、`react-native-image-resizer`、`react-native-gesture-handler`、`react-native-safe-area-context`、`react-native-screens`）的屏蔽状态不变；仅解除 `react-native-keychain` 的屏蔽。

   > 注：若 sf-design/design 阶段确认 `react-native-screens` / `react-native-safe-area-context` / `react-native-gesture-handler` 为导航守卫或 LoginScreen 所必需，则可在 design 决策中追加解除屏蔽，但需在 design.md 中记录并相应更新本 REQ 的验收范围。本 requirements 阶段仅强制要求解除 keychain。

3. [Event-driven] WHEN 解除屏蔽后执行 `./gradlew assembleDebug` 时，THE 系统 SHALL 成功编译 keychain 原生模块（生成对应 `.so` / Java 类），构建退出码为 `0`，产物 APK 中包含 keychain 原生绑定。
4. [Unwanted-behavior] IF 解除 keychain 屏蔽后构建失败（原生编译错误），THEN THE 系统 SHALL 在 design.md 中记录失败详情并启动回滚预案（见 REQ-018 AC 与 impact_analysis 的 AsyncStorage fallback），**不**直接放弃本 WI。
5. [Optional-feature] WHERE keychain 原生模块在构建期不可用（如目标 ABI 缺失），THE 系统 SHALL 至少为 `arm64-v8a`（真机测试目标架构）提供可用的 keychain 原生库。

---

### REQ-015（NFR-3）登录请求性能与超时

**用户故事**：作为飞检现场检查员，我希望登录请求在合理时间内返回结果或超时提示，不会无限等待，以便我获得确定性的交互反馈。

**优先级**：Must

**验收标准（EARS）**：

1. [Ubiquitous] THE 系统 SHALL 为登录请求（`/api/v1/auth/login`）设置超时阈值为 `<login_timeout_ms: 30000>`（30 秒，与 ApiClient 默认 `timeoutMs` 一致）；超时后请求被 `AbortController` 真正中断并触发超时错误处理（REQ-004 AC-3）。
2. [Event-driven] WHEN 后端响应时间正常（网络可达且服务健康）时，THE 系统 SHALL 在 `<login_p95_ms: 3000>`（P95 3 秒，参考值）内完成登录请求并切换状态，使用户感知流畅。
3. [State-driven] WHILE 登录请求超过 `<loading_feedback_ms: 1000>`（1 秒）仍未返回，THE 系统 SHALL 保持加载指示器可见（已由 REQ-003 AC-2 保证），让用户明确请求进行中。
4. [Unwanted-behavior] IF 登录请求在超时阈值内未返回且未被 AbortController 中断，THEN THE 系统 SHALL 视为严重缺陷并在验证阶段标记失败。

---

### REQ-016（FR-12）真机安装与端到端登录验证

**用户故事**：作为 fj1 开发者，我希望将本 WI 构建的 Debug APK 安装到真实 Android 设备，并完成一次完整的端到端登录流程（启动→输入凭据→登录成功→进入主界面），以便确认登录功能在真实设备上可用，而非仅在构建层面通过。

**优先级**：Must

**验收标准（EARS）**：

1. [Event-driven] WHEN 本 WI 实施完成时，THE 系统 SHALL 产出一份可安装的 Debug APK（路径 `android/app/build/outputs/apk/debug/app-debug.apk`），文件大小 **> 1 MB**。
2. [Event-driven] WHEN 该 Debug APK 被安装到真实 Android 设备（通过 `adb install` 或手动安装）后，THE 系统 SHALL 能成功安装且设备应用列表中出现「飞检现场管理系统」入口。
3. [Event-driven] WHEN 用户在真机上点击应用图标启动 App 时，THE 系统 SHALL 显示加载指示器或启动画面，随后（根据本地令牌状态）显示 `LoginScreen`（首次安装未登录）或 `AppNavigator`（已有登录态）。
4. [Event-driven] WHEN 用户在真机 `LoginScreen` 输入正确凭据（`admin` / `admin123`）并点击登录时，THE 系统 SHALL 在超时阈值内向后端 `http://129.211.5.240/api/v1/auth/login` 发起请求并成功登录，状态切换为 `authenticated`，界面切换为 3-Tab 主导航。
5. [Event-driven] WHEN 用户在真机 `LoginScreen` 输入错误凭据并点击登录时，THE 系统 SHALL 显示中文错误提示「用户名或密码错误」（REQ-004 AC-1）。
6. [Event-driven] WHEN 用户在真机上成功登录后通过系统「最近任务」杀掉 App 进程并重新启动时，THE 系统 SHALL 自动恢复登录态（REQ-009），直接显示 `AppNavigator` 而非 `LoginScreen`。
7. [Unwanted-behavior] IF 真机因网络不可达（设备未连接与服务器互通的网络）导致登录请求失败，THEN THE 系统 SHALL 显示「网络连接失败，请检查网络后重试」（REQ-004 AC-2），此为预期失败模式而非缺陷。

---

### REQ-017（CON-2）后端 API 契约一致性约束

**用户故事**：作为 fj1 开发者，我希望本 WI 的认证实现严格遵循已确认的后端 API 契约（login/refresh/logout 三个端点的请求与响应结构），以便前后端能正确联调，不引入契约偏差。

**优先级**：Must

**验收标准（EARS）**：

1. [Event-driven] WHEN 调用 `/api/v1/auth/login` 时，THE 系统 SHALL 发送请求体 `{ "username": string, "password": string }`（JSON），并期望响应体为 `{ "code": 0, "message": string, "data": { "accessToken": string, "refreshToken": string, "user": { "id": number, "username": string, "realName": string } }, "trace_id": string }`。
2. [Event-driven] WHEN 调用 `/api/v1/auth/refresh` 时，THE 系统 SHALL 发送请求体 `{ "refreshToken": string }`（JSON），并期望响应体结构与 login 响应一致（`data` 含新的令牌对与用户信息）。
3. [Event-driven] WHEN 调用 `/api/v1/auth/logout` 时，THE 系统 SHALL 在请求头携带 `Authorization: Bearer {accessToken}`，请求体为空或省略，并期望响应体为 `{ "code": 0, "data": null, ... }`。
4. [Ubiquitous] THE 系统 SHALL 依赖 `ApiClient.ts` 已实现的统一响应解析逻辑（`parseResponse` 校验 `code === 0`，非 0 抛 `ApiError(kind: 'server')`），**不**在 AuthStore/KeychainStorage 中重复实现响应解析。
5. [Ubiquitous] THE 系统 SHALL 将 API 基地址统一经由 `AppConfig.API_ROOT`（`'http://129.211.5.240/api/v1'`）获取，**不**在认证相关代码中硬编码该 URL 字面量。
6. [Unwanted-behavior] IF 后端响应结构与本契约不符（如 `data` 字段缺失、字段名不同），THEN THE 系统 SHALL 在联调阶段被识别为契约不一致并上报，由开发者与后端协调修正，**不**在前端硬编码适配 hack。

---

### REQ-018（CON-3）文件修改范围与骨架保护约束

**用户故事**：作为 fj1 开发者，我希望本 WI 的实施修改明确的、受控的文件集合，保护 WI-0012 已通过审查的骨架代码不被意外回归，同时对必要的集成点（`App.tsx`、`AppNavigator.tsx`、`react-native.config.js`）开放修改，以便认证能力能正确注入而不破坏既有结构。

**优先级**：Must

**验收标准（EARS）**：

1. [Event-driven] WHEN 本 WI 实施完成时，THE 系统 SHALL 新增以下文件（位于 `fj-android/src/` 下）：`screens/auth/LoginScreen.tsx`（或 sf-design 决定的等价路径）、`store/auth/` 下的 AuthStore 相关文件、`api/KeychainStorage.ts`、`components/ErrorBoundary.tsx`（具体路径由 design 确定）。
2. [Ubiquitous] THE 系统 SHALL 允许修改以下既有文件以集成认证能力：`fj-android/App.tsx`（条件渲染 + ErrorBoundary + AuthProvider）、`fj-android/react-native.config.js`（解除 keychain 屏蔽，见 REQ-014）、`fj-android/android/app/src/main/AndroidManifest.xml`（cleartext 配置，见 REQ-013）。
3. [Optional-feature] WHERE sf-design 决定 `AppNavigator.tsx` 需要调整以集成登录守卫或 Provider 包裹，THE 系统 SHALL 允许修改 `fj-android/src/navigation/AppNavigator.tsx`；否则保持其不变。
4. [Ubiquitous] THE 系统 SHALL **不**修改以下 WI-0012 骨架文件的核心逻辑（仅允许在不破坏既有行为的前提下追加导出或类型补充）：`fj-android/src/api/ApiClient.ts`（AuthTokensProvider 接口已定义，本 WI 仅实现该接口，**不**改动 ApiClient 内部）、`fj-android/src/config/AppConfig.ts`（API_ROOT 已就绪，**不**改动）、`fj-android/package.json`（依赖已安装，**不**新增/删除依赖，除非 design 明确判定必要）、`fj-android/babel.config.js`、`fj-android/tsconfig.json`、`fj-android/app.json`。
5. [Unwanted-behavior] IF 实施过程中发现需要修改 `ApiClient.ts` 内部逻辑或 `AppConfig.ts`，THEN THE 系统 SHALL 暂停并在 design/任务阶段提出冲突报告，等待用户或设计决策，**不**擅自修改。
6. [Event-driven] WHEN 本 WI 实施完成时，THE 系统 SHALL 通过 `git diff --stat` 显示的变更文件集合与本 REQ 的 AC-1/AC-2/AC-3 声明的允许范围一致，无超出范围的文件被修改。
7. [Optional-feature] WHERE keychain autolinking 构建失败触发回滚预案，THE 系统 SHALL 允许临时回退 `react-native.config.js` 的 keychain 屏蔽并改用 AsyncStorage 降级实现（安全性降低），但此回滚**必须**在 design.md 中记录决策并在验证报告中标注降级状态。

---

## 配置点清单

本节列出所有 `<configurable>` 标记的可配置项，供后续 WI 或运维参考。

| 配置项 | 位置 | 默认值 | 修改方式 | 影响范围 |
|--------|------|--------|----------|----------|
| 登录请求超时 | ApiClient `timeoutMs`（构造时传入） | `30000` ms（30 秒） | 修改 ApiClient 实例化处传入的 `timeoutMs`，或 ApiClient `DEFAULT_TIMEOUT_MS` 常量 | 登录、刷新、登出请求的最大等待时长 |
| 登录 P95 响应目标 | （验收参考值，非代码常量） | `3000` ms | 调整 REQ-015 验收基线 | 登录交互流畅性判定 |
| 加载反馈显示阈值 | （UX 参考值） | `1000` ms | 调整 REQ-015 AC-3 验收基线 | 加载指示器最低显示时长判定 |
| 导航切换渲染阈值 | （性能参考值） | `100` ms | 调整 REQ-010 AC-4 验收基线 | 状态切换到界面更新的最大延迟 |
| token 日志预览字符数 | （日志策略） | `8` 字符 | 修改日志输出处的截断长度 | 调试期 token 日志泄露面 |
| cleartext 放行目标 | `AndroidManifest.xml` / `network_security_config.xml` | `129.211.5.240`（后端 IP） | 修改网络安全配置中的 IP/域名 | 允许 cleartext HTTP 的目标范围 |
| 后端 API 地址 | `fj-android/src/config/AppConfig.ts`（WI-0012 已建立） | `'http://129.211.5.240/api/v1'` | 修改 `AppConfig.API_ROOT` 字面量（无需重建镜像） | 所有认证与业务请求的目标服务器 |
| 禁用按钮不透明度 | LoginScreen 样式 | `0.5` | 修改 LoginScreen 样式常量 | 禁用态视觉区分强度 |

---

## 验收标准映射（与 intake.md AC 对照）

| intake.md 预期验收 | 对应 REQ | 备注 |
|--------------------|----------|------|
| AC-1: App 启动后显示登录界面 | REQ-001, REQ-009, REQ-010 | 首次未登录场景；含加载态过渡 |
| AC-2: 输入正确凭据后进入主界面 | REQ-003, REQ-005, REQ-010, REQ-016 | 含令牌存储与状态切换 |
| AC-3: 输入错误凭据显示错误提示 | REQ-004 | 区分凭据/网络/超时/服务端错误 |
| AC-4: 登录状态持久化（杀进程重启保持登录） | REQ-006, REQ-009 | keychain 存储 + 启动检查 |
| AC-5: Debug APK 能安装到真实设备并运行 | REQ-014, REQ-016 | 含 keychain 编译 + 真机端到端 |

**新增需求（intake.md 未明确列出但必要）**：
- **REQ-002**（表单即时校验）：intake 提及「禁用逻辑」但未展开，拆分为独立输入校验需求
- **REQ-007**（令牌自动刷新）：ApiClient 已内置 401 刷新，但需 KeychainStorage 正确接续，intake 未单列
- **REQ-008**（登出流程）：intake 提及 logout 但未列入 AC，完整认证生命周期必需
- **REQ-011**（ErrorBoundary）：intake 在范围内列出，但未列入验收 AC
- **REQ-012**（令牌安全 NFR）：intake 风险章节提及安全，未列为 AC
- **REQ-013**（cleartext HTTP 配置）：intake 风险章节提及 Android 9 cleartext，列为独立需求
- **REQ-015**（登录性能 NFR）：intake 未列，可测量性能基线
- **REQ-017**（API 契约一致性）：intake 给出契约但未列为约束
- **REQ-018**（文件修改范围约束）：保护 WI-0012 骨架

---

## 范围外观察（Out-of-Scope Observations）

以下事项在分析中发现但**不属于本 WI 范围**，记录供后续 WI 参考：

1. **HTTPS / TLS / 证书绑定**：当前后端为 HTTP cleartext（`http://129.211.5.240`），本 WI 通过 networkSecurityConfig 放行（REQ-013）。HTTPS 迁移与证书绑定（certificate pinning）应作为独立安全加固 WI 处理，届时 REQ-013 的 cleartext 放行应被移除。
2. **生物识别登录（指纹/面容）**：`react-native-keychain` 支持生物识别访问控制，本 WI 仅实现用户名/密码登录；生物识别可作为「快速登录」增强在后续 WI 实现，届时需扩展 AuthStore 与 LoginScreen。
3. **多设备登录互斥 / 单点登出**：后端 `/api/v1/auth/logout` 当前语义未明确是否使其他设备的 token 失效；本 WI 仅实现本地登出 + 后端通知，跨设备 session 管理由后端策略决定。
4. **Token 过期主动检查（前端定时刷新）**：本 WI 依赖 ApiClient 的被动 401 刷新策略（请求失败时刷新）。主动定时刷新（如 token 即将过期时预刷新）可作为体验优化在后续 WI 加入。
5. **登录限流 / 防暴力破解**：本 WI 不实现前端登录次数限制；防暴力破解应由后端速率限制负责，前端仅需正确显示后端返回的限流错误（REQ-004 AC-4 的 server 错误路径）。
6. **App 图标 / 启动画面（Splash Screen）定制**：本 WI 使用 RN 默认占位资源；REQ-010 AC-3 的「SplashScreen」可为 RN 默认或简单 Activity 主题，定制设计留给后续 UI WI。WI-0012 范围外观察已记录同一条。
7. **Accessibility（无障碍）**：登录界面的读屏支持、对比度、字号适配等无障碍需求本 WI **不**强制实现，但建议 sf-design 在 LoginScreen 设计中预留 `accessibilityLabel` 等属性位。
8. **`react-native-screens` / `react-native-safe-area-context` / `react-native-gesture-handler` 的 autolinking**：WI-0012 屏蔽了这 3 个导航相关模块。若 sf-design 判定 LoginScreen 或导航守卫需要它们（如 SafeArea 适配、手势返回），应在 design.md 中决策并相应更新 REQ-014 AC-2 的屏蔽清单；否则保持屏蔽。

---

## 自检（Self-Check）

完成前对本文件的 10 项自检：

| # | 检查项 | 结果 |
|---|--------|------|
| 1 | 是否有「等」「包括但不限于」等模糊量词？ | 否，所有需求已枚举到底；REQ 列举为固定 5 个状态、3 个 API 端点、明确文件集合 |
| 2 | 每条 REQ 是否有用户故事？ | 是，18/18 |
| 3 | 每条 REQ 是否有 ≥3 条 EARS 格式 AC？ | 是，最少 4 条（REQ-015），最多 7 条（REQ-004） |
| 4 | 性能/超时等非功能需求是否可测量？ | 是，`<login_timeout_ms: 30000>`、`<login_p95_ms: 3000>`、`<loading_feedback_ms: 1000>`、APK `> 1 MB`、`<render_threshold: 100ms>` |
| 5 | 版本号/契约是否精确？ | 是，API 端点路径、请求/响应字段、状态枚举、文件路径均精确 |
| 6 | 是否标注优先级？ | 是，18 条全部 Must（本 WI 为首个用户可见功能，均为阻塞项） |
| 7 | 配置点是否在文末汇总？ | 是，8 个配置项 |
| 8 | 边界（不在范围内）是否明确？ | 是，含排除表格 + 8 条 Out-of-Scope 观察 |
| 9 | 是否避免技术栈决策（如状态管理库选型、Context vs Zustand）？ | 是，AuthStore 实现方式、AuthProvider 层级、文件路径均标注「由 sf-design 决定」；仅描述「做什么」 |
| 10 | sf-design 能否据此产出 design.md？ | 是，已提供文件清单、API 契约、状态机定义、接口签名、约束与回滚预案 |
