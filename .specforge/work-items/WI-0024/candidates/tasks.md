# Tasks — WI-0024 生物识别指纹登录

## 任务列表

### TASK-1 新建 BiometricAuth.ts
- **文件**：`src/store/auth/BiometricAuth.ts`（新建）
- **类型**：新建
- **依赖**：无
- **对应 REQ**：REQ-1
- **对应 DD**：DD-1
- **步骤**：
  1. 导入 react-native-keychain（`import * as Keychain from 'react-native-keychain'`）
  2. 定义模块常量 `const SERVER = 'fj-biometric-auth'`
  3. 实现 `set(server, username, password)`：调用 `Keychain.setInternetCredentials(server, username, password, { accessControl: AccessControl.BIOMETRY_CURRENT_SET })`，返回 boolean
  4. 实现 `get(server)`：调用 `Keychain.getInternetCredentials(server)`，返回 `{ username, password }` 或 `null`
  5. 实现 `has(server)`：调用 `Keychain.getInternetCredentials(server)`，检查 credentials 是否存在，返回 boolean
  6. 实现 `remove(server)`：调用 `Keychain.resetInternetCredentials(server)`，返回 boolean
  7. 所有方法 try-catch 包裹，失败返回 `false` / `null`
- **验证**：tsc exit 0

### TASK-2 修改 AuthContext.tsx
- **文件**：`src/store/auth/AuthContext.tsx`（修改）
- **类型**：修改
- **依赖**：TASK-1
- **对应 REQ**：REQ-2
- **对应 DD**：DD-2
- **步骤**：
  1. 导入 BiometricAuth（`import { set, get, has, remove, SERVER } from './BiometricAuth'`）
  2. 添加状态 `biometricReady: boolean`、`biometricLoading: boolean`（初始 false）
  3. 实现 `enableBiometric(username, password)`：调用 `BiometricAuth.set(SERVER, ...)`，成功后 `setBiometricReady(true)`
  4. 实现 `disableBiometric()`：调用 `BiometricAuth.remove(SERVER)`，`setBiometricReady(false)`
  5. 在初始化 useEffect 中：检查 `BiometricAuth.has(SERVER)`，存在则调用 `get(SERVER)` 触发指纹对话框，成功后调用现有 `login(username, password)`
  6. 将 biometricReady、biometricLoading、enableBiometric、disableBiometric 加入 Context value
- **验证**：tsc exit 0

### TASK-3 修改 ProfileScreen.tsx 添加指纹开关
- **文件**：`src/screens/profile/ProfileScreen.tsx`（修改）
- **类型**：修改
- **依赖**：TASK-2
- **对应 REQ**：REQ-1
- **对应 DD**：DD-2
- **步骤**：
  1. 从 AuthContext 获取 `biometricReady`、`enableBiometric`、`disableBiometric`
  2. 添加 Switch 组件，`value={biometricReady}`
  3. `onValueChange`：`true → enableBiometric(currentUsername, currentPassword)`，`false → disableBiometric()`
  4. 添加标签文字"启用指纹登录"
- **验证**：tsc exit 0

### TASK-4 Docker 构建验证
- **文件**：无（验证任务）
- **类型**：验证
- **依赖**：TASK-1, TASK-2, TASK-3
- **对应 REQ**：REQ-1, REQ-2
- **步骤**：
  1. 执行 `tsc` 类型检查，确认 exit 0
  2. 执行 Docker 构建，确认 BUILD SUCCESSFUL
  3. 确认 package.json 无新依赖引入
- **验证**：tsc exit 0 + Docker BUILD SUCCESSFUL
