# Design Candidate — WI-0024 生物识别指纹登录

## 简介

本设计文档定义生物识别指纹登录功能的技术方案，包括 BiometricAuth 工具类设计和 AuthContext 集成方案。基于现有 react-native-keychain 依赖，无新依赖引入。

## 设计决策

### DD-1 BiometricAuth 工具类设计

**决策**：新建 `src/store/auth/BiometricAuth.ts`，封装 react-native-keychain 的生物识别存储能力，对外暴露 4 个方法。

**接口定义**：

```typescript
const SERVER = 'fj-biometric-auth';

// 存储凭证（启用指纹登录时调用，触发系统生物识别验证）
async function set(server: string, username: string, password: string): Promise<boolean>

// 读取凭证（指纹验证通过后调用，系统自动要求生物识别）
async function get(server: string): Promise<{ username: string; password: string } | null>

// 检查是否存在生物识别凭证（不触发验证）
async function has(server: string): Promise<boolean>

// 清除凭证（禁用指纹登录时调用）
async function remove(server: string): Promise<boolean>
```

**实现要点**：
- `set`：调用 `Keychain.setInternetCredentials(server, username, password, { accessControl: AccessControl.BIOMETRY_CURRENT_SET })`，系统会先弹出指纹对话框验证后才写入
- `get`：调用 `Keychain.getInternetCredentials(server)`，系统自动要求当前指纹验证，返回 `{ username, password }` 或 `null`
- `has`：调用 `Keychain.getInternetCredentials(server)` 检查 credentials 是否存在（仅判断存在性，不依赖验证结果）
- `remove`：调用 `Keychain.resetInternetCredentials(server)`
- 所有方法 try-catch 包裹，失败时返回 `false` 或 `null`，不向上抛出异常

**替代方案**：
- 方案 A（未选）：`setGenericPassword` + accessControl — 仅支持单账号场景，扩展性差
- 方案 B（已选）：`setInternetCredentials` — 支持多账号场景，server 参数可区分不同凭证
选择方案 B。

### DD-2 AuthContext 集成方案

**决策**：修改 `src/store/auth/AuthContext.tsx`，在 App 初始化阶段增加生物识别登录路径作为可选分支。

**集成点**：

1. **初始化阶段**（mount useEffect）：
   - 调用 `BiometricAuth.has(SERVER)` 检查是否存在凭证
   - 如果存在，设置 `biometricReady = true`
   - 调用 `BiometricAuth.get(SERVER)` 触发系统指纹对话框
   - 验证通过后调用现有 `login(username, password)` 方法自动登录

2. **状态扩展**：

```typescript
biometricReady: boolean       // 是否检测到生物识别凭证
biometricLoading: boolean     // 生物识别验证进行中
enableBiometric(): Promise<void>   // 启用（ProfileScreen 调用）
disableBiometric(): Promise<void>  // 禁用
```

3. **流程图**：

```
App mount
  → BiometricAuth.has(SERVER)?
    → true:  BiometricAuth.get(SERVER) [系统指纹对话框]
               → 成功: login(username, password) → 主界面
               → 失败/取消: 显示手动登录
    → false: 显示手动登录
```

4. **ProfileScreen 集成**：
   - 添加 Switch 组件，`value={biometricReady}`
   - `onValueChange`：`true → enableBiometric()`，`false → disableBiometric()`
   - 标签文字："启用指纹登录"

**不影响现有登录**：生物识别路径是独立的可选分支，手动登录逻辑（`login(username, password)`）完全不变。回退路径确保用户始终能通过手动方式登录。
