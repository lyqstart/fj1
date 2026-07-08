# 飞检现场管理系统 — 应用日志系统与启动诊断 任务清单

> **Work Item**: WI-0028
> **生成 Agent**: sf-task-planner
> **依据文档**: requirements.candidate.md (PSV-0001) + design.candidate.md (DD-1 ~ DD-11)
> **变更路径**: requirement_change_path
> **项目根**: `/mnt/1t_back/project/fj1/fj-android`

---

## 执行概览

- **任务总数**: 8
- **并行批次**: 3
- **依赖关系**: 见下方依赖图
- **全局验证基线**: 所有 TypeScript 任务必须通过 `npx tsc --noEmit`（NFR-4.1, AC-7）

### 依赖图

```
Batch 1 (并行，无依赖):
  ├── TASK-1  Logger.ts 核心 (DD-1, DD-4, DD-9, DD-11)
  ├── TASK-3  BootErrorScreen.tsx (DD-3)
  └── TASK-7  Android 主题修复 (DD-10)

Batch 2 (并行，依赖 Batch 1):
  ├── TASK-2  RemoteTransport + LogPersistence (DD-5, DD-6)        → depends: TASK-1
  ├── TASK-4  index.js 启动诊断 (DD-2, DD-11)                      → depends: TASK-1, TASK-3
  ├── TASK-5  App.tsx + AppRoot.tsx 日志集成 (DD-7)                → depends: TASK-1
  └── TASK-6  AuthContext + ApiClient 日志集成 + 脱敏 (DD-7, DD-8) → depends: TASK-1

Batch 3 (串行，依赖全部):
  └── TASK-8  Docker Debug 构建验证                                → depends: TASK-1..TASK-7
```

### 关键工程规则

1. **Logger 永不抛异常**（NFR-3.2, REQ-1.5）：所有 Logger 公共方法内部 try-catch。
2. **零新增 npm 依赖**：Logger.ts 不引入任何新依赖；AsyncStorage/Clipboard 为条件加载（可选依赖）。
3. **Token 脱敏**（NFR-2.1/2.2, REQ-9.4）：Authorization 头 Bearer token 必须脱敏，永不写入日志。
4. **不改变业务逻辑**：集成点（TASK-4/5/6）仅添加 `logger.xxx()` 调用，不改变任何现有行为。
5. **Android 主题纯原生修改**：TASK-7 不影响任何 JS 代码。

### 全局禁止修改文件清单（所有 task 共享）

以下文件为规划产物，任何 executor **禁止修改**：
- `.specforge/work-items/WI-0028/candidates/**`（含本 tasks.md、requirements、design）
- 不属于本 task `allowed_write_files` 的其他 task 的目标文件

---

### TASK-1 创建 Logger 核心模块（单例 + 环形缓冲区 + ConsoleTransport + 全局错误处理器）

**context_block**（executor 必读）：
- **What**: 创建 `src/utils/Logger.ts`，内含 LogLevel 枚举、LogEntry 接口、Logger 单例类、ConsoleTransport（内联）、installGlobalErrorHandler 函数、initLogger 编排函数。另创建 `src/types/globals.d.ts` 声明 ErrorUtils 全局类型。
- **Why**: 这是整个日志系统的基础。所有其他 task（TASK-2/4/5/6）都依赖本模块导出的 `logger` 单例、`LogLevel`、`LogEntry` 类型。实现 REQ-1（日志核心）、REQ-2（环形缓冲区）、REQ-6（全局错误处理器）。
- **Refs**: DD-1（Logger 核心架构）、DD-4（ConsoleTransport）、DD-9（全局错误处理器）、DD-11（初始化编排）
- **Where**:
  - **read_files**: `fj-android/tsconfig.json`（确认编译目标与路径别名）、`fj-android/package.json`（确认 __DEV__ 全局声明与现有依赖）
  - **allowed_write_files**:
    - `fj-android/src/utils/Logger.ts`（新建）
    - `fj-android/src/types/globals.d.ts`（新建）
  - **forbidden_files**: `requirements.candidate.md`, `design.candidate.md`, `tasks.md`, `trace_delta.md`, `fj-android/src/components/BootErrorScreen.tsx`, `fj-android/index.js`, `fj-android/App.tsx`, `fj-android/src/AppRoot.tsx`, `fj-android/src/store/auth/AuthContext.tsx`, `fj-android/src/api/ApiClient.ts`, `fj-android/src/utils/LogPersistence.ts`, `fj-android/android/app/src/main/res/values/styles.xml`
- **Constraints**:
  - LogLevel 枚举：DEBUG=0, INFO=1, WARN=2, ERROR=3（数值便于比较）
  - 环形缓冲区：容量 500，满时 FIFO 覆盖最旧条目；getBuffer() 返回浅拷贝按时间排序
  - 级别过滤：minLevel 默认 `__DEV__ ? DEBUG : INFO`
  - 格式化：`[LEVEL] [ISO-8601 timestamp] [module] message {json data}`，data 为 undefined 时省略 `{}`
  - 所有公共方法（debug/info/warn/error/getBuffer/flush/clear/addTransport/onFlush）**必须** try-catch 包裹，永不抛异常（NFR-3.2）
  - safeJsonStringify：循环引用等异常返回 `[unserializable]`
  - ConsoleTransport：__DEV__ 下按级别用 console.log/info/warn/error；Release 仅 ERROR 走 console.error
  - installGlobalErrorHandler：通过 `global.ErrorUtils.setGlobalHandler` 安装；__DEV__ 保留 RedBox（调用 previousHandler），Release 抑制；自身异常吞掉（REQ-6.5）
  - initLogger：注册 ConsoleTransport（同步）+ 异步加载历史（不阻塞）+ 注册 flush listener + AppState 监听
  - 导出：`logger` 单例实例、`installGlobalErrorHandler` 函数、`initLogger` 函数、`LogLevel`、`LogEntry`、`LogTransport`、`LoggerConfig` 类型
  - Logger.ts 零 npm 依赖（仅 TS 标准库 + react-native 全局）
- **Done When**:
  - `src/utils/Logger.ts` 存在且导出 `logger`、`installGlobalErrorHandler`、`initLogger`、`LogLevel`
  - `src/types/globals.d.ts` 存在且声明 ErrorUtils 全局接口
  - Logger 所有公共方法包裹在 try-catch 中（grep 可验证）
  - `npx tsc --noEmit` 退出码 0
- **out_of_scope**: RemoteTransport（TASK-2）、LogPersistence（TASK-2）、BootErrorScreen（TASK-3）、index.js 修改（TASK-4）、任何业务模块集成（TASK-5/6）

- **依赖**: 无
- **refs**: [DD-1, DD-4, DD-9, DD-11, REQ-1, REQ-2, REQ-6]
- **expected_file_changes**:
  - 新建 `fj-android/src/utils/Logger.ts`
  - 新建 `fj-android/src/types/globals.d.ts`
- **verification_commands**:
  - `test -f fj-android/src/utils/Logger.ts`
  - `test -f fj-android/src/types/globals.d.ts`
  - `grep -c "export const logger" fj-android/src/utils/Logger.ts`
  - `grep -c "export function installGlobalErrorHandler" fj-android/src/utils/Logger.ts`
  - `grep -c "export async function initLogger" fj-android/src/utils/Logger.ts`
  - `grep -c "enum LogLevel" fj-android/src/utils/Logger.ts`
  - `cd fj-android && npx tsc --noEmit`（退出码必须为 0）
- **verification_evidence_expected**:
  - command: `cd fj-android && npx tsc --noEmit`, expected_exit_code: 0, evidence_type: typecheck_output
  - command: `test -f fj-android/src/utils/Logger.ts`, expected_exit_code: 0, evidence_type: file_existence
  - command: `grep -c "export const logger" ...`, expected_exit_code: 0, expected min count: 1, evidence_type: content_check

---

### TASK-2 创建 RemoteTransport + LogPersistence（远程上传与本地持久化）

**context_block**（executor 必读）：
- **What**: 创建 `src/utils/LogPersistence.ts`，内含两个类：(1) LogPersistence — AsyncStorage 条件加载、保存/加载历史日志、AppState 后台监听；(2) RemoteTransport — 防抖批量上传、指数退避重试。两者均实现静默失败。
- **Why**: 实现 REQ-3（本地持久化，跨会话日志）和 REQ-4（远程上传，运维远程诊断）。依赖 TASK-1 的 `LogLevel`、`LogEntry`、`LogTransport`、`logger` 单例。
- **Refs**: DD-5（RemoteTransport）、DD-6（LogPersistence）
- **Where**:
  - **read_files**: `fj-android/src/utils/Logger.ts`（TASK-1 产出，确认导出的类型）、`fj-android/package.json`（确认 AsyncStorage/Clipboard 是否已安装，决定条件加载策略）
  - **allowed_write_files**:
    - `fj-android/src/utils/LogPersistence.ts`（新建）
  - **forbidden_files**: `requirements.candidate.md`, `design.candidate.md`, `tasks.md`, `trace_delta.md`, `fj-android/src/utils/Logger.ts`, `fj-android/src/components/BootErrorScreen.tsx`, `fj-android/index.js`, 其他 task 目标文件
- **Constraints**:
  - **LogPersistence**:
    - AsyncStorage 键：`@fj_logs_buffer`（fj_logs_* 前缀，REQ-3.3）
    - 条件加载：try `import('@react-native-async-storage/async-storage')`，失败则降级纯内存模式并 console.warn（REQ-3.4）
    - init()：加载上一会话最近 100 条；loadPreviousEntries 可配置
    - save(entries)：JSON.stringify 后 setItem；写入失败静默吞掉（REQ-3.5）
    - attachAppStateListener()：AppState 'background'/'inactive' 时自动 save
    - 所有方法内部 try-catch
  - **RemoteTransport**:
    - 依赖注入 LogUploadClient 端口接口（`post(path, body)`），避免硬依赖 ApiClient
    - 防抖：uploadDebounceMs=30000（30s）；setTimeout 重置
    - 批量：batchSize=100，超出分多次上传
    - 级别过滤：__DEV__ 上传 DEBUG+，Release 上传 INFO+
    - 重试：maxRetries=3，退避序列 2s/4s/8s（backoffBaseMs=2000 × 2^attempt）
    - 所有失败静默吞掉（REQ-4.7, NFR-3.1），绝不抛异常
    - handleFlush(entries)：由 Logger.onFlush 调用
  - 导出：`LogPersistence` 类、`RemoteTransport` 类、`LogUploadClient` 接口、`AsyncStorageLike` 接口、`RemoteTransportConfig` 接口
- **Done When**:
  - `src/utils/LogPersistence.ts` 存在并导出 LogPersistence、RemoteTransport、LogUploadClient
  - RemoteTransport 包含防抖（setTimeout）和重试（maxRetries=3）逻辑
  - LogPersistence 包含 AsyncStorage 条件加载（try-catch 降级）
  - `npx tsc --noEmit` 退出码 0
- **out_of_scope**: Logger 核心（TASK-1）、ApiClient 改动（TASK-6）、initLogger 中实际注册 RemoteTransport（由 TASK-4 index.js 编排或后续集成）

- **依赖**: TASK-1（使用 LogLevel、LogEntry、LogTransport、logger 类型）
- **refs**: [DD-5, DD-6, REQ-3, REQ-4]
- **expected_file_changes**:
  - 新建 `fj-android/src/utils/LogPersistence.ts`
- **verification_commands**:
  - `test -f fj-android/src/utils/LogPersistence.ts`
  - `grep -c "class RemoteTransport" fj-android/src/utils/LogPersistence.ts`
  - `grep -c "class LogPersistence" fj-android/src/utils/LogPersistence.ts`
  - `grep -c "maxRetries" fj-android/src/utils/LogPersistence.ts`
  - `grep -c "@fj_logs_buffer" fj-android/src/utils/LogPersistence.ts`
  - `cd fj-android && npx tsc --noEmit`（退出码必须为 0）
- **verification_evidence_expected**:
  - command: `cd fj-android && npx tsc --noEmit`, expected_exit_code: 0, evidence_type: typecheck_output
  - command: `grep -c "class RemoteTransport" ...`, expected_exit_code: 0, min count: 1, evidence_type: content_check

---

### TASK-3 创建 BootErrorScreen 降级错误展示组件

**context_block**（executor 必读）：
- **What**: 创建 `src/components/BootErrorScreen.tsx`，一个纯 React Native 组件，props 为 `{ error: unknown }`，显示红色"启动失败"标题、错误消息（monospace）、可滚动堆栈跟踪、"复制错误信息"按钮（Clipboard 条件加载）。
- **Why**: 实现 REQ-5.3。当 App 模块导入失败时（TASK-4 的 try-catch 捕获），屏幕显示明确错误信息而非空白/深灰色，让用户和开发者立即看到失败原因。
- **Refs**: DD-3（BootErrorScreen 组件）
- **Where**:
  - **read_files**: `fj-android/package.json`（确认 @react-native-clipboard/clipboard 是否已安装）
  - **allowed_write_files**:
    - `fj-android/src/components/BootErrorScreen.tsx`（新建）
  - **forbidden_files**: `requirements.candidate.md`, `design.candidate.md`, `tasks.md`, `trace_delta.md`, `fj-android/src/utils/Logger.ts`, `fj-android/index.js`, 其他 task 目标文件
- **Constraints**:
  - 仅使用 RN 核心组件：View、Text、ScrollView、TouchableOpacity、StyleSheet（零外部 UI 依赖）
  - 白色背景 `#ffffff`（在亮色和暗色所有主题模式下均可见，REQ-5.3）
  - 红色 ⚠ 图标 + "启动失败" 标题（#d32f2f）
  - 错误消息 monospace 等宽字体（#b71c1c）
  - 完整堆栈跟踪（可滚动 ScrollView，maxHeight:400，#757575 monospace）
  - "复制错误信息" 按钮：try 加载 @react-native-clipboard/clipboard，失败则隐藏按钮（showCopyButton=false）
  - normalizeError(error)：Error→{message,stack}；string→{message,stack:null}；其他→JSON.stringify
  - 点击复制按钮后显示"已复制"反馈（useState）
  - 组件签名：`function BootErrorScreen({ error }: BootErrorScreenProps): React.ReactElement`
  - 默认导出：`export default BootErrorScreen`
  - 渲染期间不抛异常（props 已规范化）
- **Done When**:
  - `src/components/BootErrorScreen.tsx` 存在并默认导出 BootErrorScreen
  - 使用 View/Text/ScrollView/TouchableOpacity（无外部 UI 库 import）
  - 包含 Clipboard 条件加载 try-catch
  - 包含 normalizeError 函数
  - `npx tsc --noEmit` 退出码 0
- **out_of_scope**: Logger 集成（TASK-1）、index.js 注册逻辑（TASK-4）

- **依赖**: 无（纯组件，不依赖 Logger）
- **refs**: [DD-3, REQ-5.3]
- **expected_file_changes**:
  - 新建 `fj-android/src/components/BootErrorScreen.tsx`
- **verification_commands**:
  - `test -f fj-android/src/components/BootErrorScreen.tsx`
  - `grep -c "export default BootErrorScreen" fj-android/src/components/BootErrorScreen.tsx`
  - `grep -c "ScrollView" fj-android/src/components/BootErrorScreen.tsx`
  - `grep -c "normalizeError" fj-android/src/components/BootErrorScreen.tsx`
  - `grep -c "#ffffff" fj-android/src/components/BootErrorScreen.tsx`
  - `cd fj-android && npx tsc --noEmit`（退出码必须为 0）
- **verification_evidence_expected**:
  - command: `cd fj-android && npx tsc --noEmit`, expected_exit_code: 0, evidence_type: typecheck_output
  - command: `grep -c "export default BootErrorScreen" ...`, expected_exit_code: 0, min count: 1, evidence_type: content_check

---

### TASK-4 修改 index.js 实现启动诊断（try-catch 包裹 + 降级组件注册）

**context_block**（executor 必读）：
- **What**: 修改 `fj-android/index.js`（项目根目录）。在 `require('./App')` 前导入 Logger 并安装全局错误处理器；将 `require('./App')` 包裹在 try-catch 中；成功注册 App，失败注册 BootErrorScreen 降级组件；记录启动阶段日志。
- **Why**: 实现 REQ-5（启动诊断）的核心入口。这是解决"深灰色屏幕"问题的关键——当 bundle 加载或 App 导入失败时，能立即显示错误而非空白。Logger 必须在 try-catch 之前初始化，确保导入失败时日志已被记录。
- **Refs**: DD-2（index.js 启动诊断）、DD-11（初始化编排）
- **Where**:
  - **read_files**: `fj-android/index.js`（现有内容）、`fj-android/src/utils/Logger.ts`（TASK-1，确认导出）、`fj-android/src/components/BootErrorScreen.tsx`（TASK-3，确认默认导出）、`fj-android/app.json`（确认 appName）
  - **allowed_write_files**:
    - `fj-android/index.js`（修改）
  - **forbidden_files**: `requirements.candidate.md`, `design.candidate.md`, `tasks.md`, `trace_delta.md`, `fj-android/src/utils/Logger.ts`, `fj-android/src/components/BootErrorScreen.tsx`, 其他 task 目标文件
- **Constraints**:
  - 导入顺序：(1) import { logger, installGlobalErrorHandler, initLogger } from './src/utils/Logger'；(2) installGlobalErrorHandler()（在 require('./App') 之前）；(3) initLogger().catch(()=>{})（异步，不 await，不阻塞启动）
  - try { App = require('./App').default; logger.info('BOOT','App module imported successfully') } catch (e) { bootError = e; logger.error('BOOT','App import FAILED',{message,stack}) }
  - Root 组件：bootError 非空时 require('./src/components/BootErrorScreen').default 渲染；否则渲染 App（行为与原版一致，REQ-5.2）
  - BootErrorScreen 懒加载（require 而非顶层 import），确保 App 导入失败时仍可加载
  - 启动日志：'JS bundle executing'、'Importing App module...'、'App module imported successfully'/'App import FAILED'、'AppRegistry registered'
  - AppRegistry.registerComponent(appName, () => Root)
  - 保留原有 import（AppRegistry、appName from app.json）
  - **不改变 App 正常启动时的任何行为**（REQ-5.2）
- **Done When**:
  - index.js 包含 `import { logger, installGlobalErrorHandler, initLogger } from './src/utils/Logger'`
  - index.js 在 require('./App') 前调用 installGlobalErrorHandler()
  - index.js 包含 try-catch 包裹 require('./App')
  - index.js 包含 BootErrorScreen 懒加载逻辑
  - index.js 包含 Root 函数判断 bootError
  - `npx tsc --noEmit` 退出码 0（若 index.js 在 tsc 检查范围内）或构建通过
- **out_of_scope**: Logger.ts 实现（TASK-1）、BootErrorScreen 实现（TASK-3）、App.tsx 内部逻辑（TASK-5）

- **依赖**: TASK-1（Logger 模块）、TASK-3（BootErrorScreen 组件）
- **refs**: [DD-2, DD-11, REQ-5, REQ-6]
- **expected_file_changes**:
  - 修改 `fj-android/index.js`
- **verification_commands**:
  - `grep -c "installGlobalErrorHandler" fj-android/index.js`
  - `grep -c "try" fj-android/index.js`
  - `grep -c "BootErrorScreen" fj-android/index.js`
  - `grep -c "AppRegistry.registerComponent" fj-android/index.js`
  - `cd fj-android && npx tsc --noEmit`（退出码必须为 0）
- **verification_evidence_expected**:
  - command: `cd fj-android && npx tsc --noEmit`, expected_exit_code: 0, evidence_type: typecheck_output
  - command: `grep -c "installGlobalErrorHandler" fj-android/index.js`, expected_exit_code: 0, min count: 1, evidence_type: content_check

---

### TASK-5 集成 Logger 到 App.tsx + AppRoot.tsx（应用与数据库生命周期日志）

**context_block**（executor 必读）：
- **What**: 在 `App.tsx` 添加 logger 导入和组件挂载日志；在 `src/AppRoot.tsx` 的 initDatabase 调用前后添加 DB 初始化日志（开始/成功/失败）。仅添加 logger 调用，不改变任何业务逻辑。
- **Why**: 实现 REQ-7（应用与数据库生命周期日志）。记录 App 挂载和数据库初始化的关键阶段，以便诊断启动阶段失败的具体位置——这是定位"深灰色屏幕"根因的诊断手段。
- **Refs**: DD-7（集成点埋点规范）
- **Where**:
  - **read_files**: `fj-android/App.tsx`（现有内容，找到 useEffect 位置）、`fj-android/src/AppRoot.tsx`（现有内容，找到 initDatabase 调用）、`fj-android/src/utils/Logger.ts`（TASK-1，确认 logger 导出）
  - **allowed_write_files**:
    - `fj-android/App.tsx`（修改）
    - `fj-android/src/AppRoot.tsx`（修改）
  - **forbidden_files**: `requirements.candidate.md`, `design.candidate.md`, `tasks.md`, `trace_delta.md`, `fj-android/src/utils/Logger.ts`, `fj-android/index.js`, 其他 task 目标文件
- **Constraints**:
  - **App.tsx**: 添加 `import { logger } from './src/utils/Logger'`；在组件内添加 `useEffect(() => { logger.info('APP', 'App component mounted'); }, [])`（module 标识 'APP'）
  - **AppRoot.tsx**: 添加 `import { logger } from './utils/Logger'`（注意路径相对 src/AppRoot.tsx）；在 initDatabase 调用前 `logger.info('DB', 'DB init started')`；成功后 `logger.info('DB', 'DB init succeeded', { schema: 'v1' })`；catch 块 `logger.error('DB', 'DB init failed', { message, stack })`（module 标识 'DB'）
  - **不改变任何现有业务逻辑**——只插入 logger.xxx() 调用
  - 保持现有 import 风格和代码结构
- **Done When**:
  - App.tsx 包含 logger 导入和 'App component mounted' 日志
  - AppRoot.tsx 包含 'DB init started'、'DB init succeeded'/'DB init failed' 日志
  - `npx tsc --noEmit` 退出码 0
- **out_of_scope**: AuthContext（TASK-6）、ApiClient（TASK-6）、Logger 实现（TASK-1）

- **依赖**: TASK-1（logger 单例）
- **refs**: [DD-7, REQ-7]
- **expected_file_changes**:
  - 修改 `fj-android/App.tsx`
  - 修改 `fj-android/src/AppRoot.tsx`
- **verification_commands**:
  - `grep -c "logger.info('APP'" fj-android/App.tsx`
  - `grep -c "logger.info('DB'" fj-android/src/AppRoot.tsx`
  - `grep -c "logger.error('DB'" fj-android/src/AppRoot.tsx`
  - `cd fj-android && npx tsc --noEmit`（退出码必须为 0）
- **verification_evidence_expected**:
  - command: `cd fj-android && npx tsc --noEmit`, expected_exit_code: 0, evidence_type: typecheck_output
  - command: `grep -c "logger.info('APP'" fj-android/App.tsx`, expected_exit_code: 0, min count: 1, evidence_type: content_check

---

### TASK-6 集成 Logger 到 AuthContext + ApiClient（认证/HTTP 日志 + Token 脱敏）

**context_block**（executor 必读）：
- **What**: (1) 创建 `src/utils/redact.ts`（Token 脱敏纯函数）；(2) 在 `AuthContext.tsx` 的 login/logout/token-refresh 添加 logger 调用；(3) 在 `ApiClient.ts` 的请求/响应/失败添加 logger 调用，并对任何记录的 headers 使用 redactAuthorization 脱敏。
- **Why**: 实现 REQ-8（认证事件日志）和 REQ-9（HTTP 请求响应日志与令牌脱敏）。运维需排查认证和网络问题，同时确保 Bearer token 明文永不写入日志（NFR-2.1/2.2 安全要求）。
- **Refs**: DD-7（集成点埋点）、DD-8（ApiClient Token 脱敏）
- **Where**:
  - **read_files**: `fj-android/src/store/auth/AuthContext.tsx`（现有内容，找到 login/logout/refresh）、`fj-android/src/api/ApiClient.ts`（现有内容，找到 requestRaw/doFetchWithAuth）、`fj-android/src/utils/Logger.ts`（TASK-1，确认 logger 导出）
  - **allowed_write_files**:
    - `fj-android/src/utils/redact.ts`（新建）
    - `fj-android/src/store/auth/AuthContext.tsx`（修改）
    - `fj-android/src/api/ApiClient.ts`（修改）
  - **forbidden_files**: `requirements.candidate.md`, `design.candidate.md`, `tasks.md`, `trace_delta.md`, `fj-android/src/utils/Logger.ts`, `fj-android/App.tsx`, `fj-android/src/AppRoot.tsx`, 其他 task 目标文件
- **Constraints**:
  - **redact.ts**: `redactAuthorization(headers)`：`Bearer xxx` → `Bearer ***REDACTED***`；非 Bearer → `***REDACTED***`；纯函数，输入 null/undefined 返回空对象，不抛异常
  - **AuthContext.tsx**（module 标识 'AUTH'）：
    - login 开头：`logger.info('AUTH', 'login', { username })`（**绝不记录 password/token**，REQ-8.1）
    - login 成功：`logger.info('AUTH', 'login success')`
    - login 失败：`logger.error('AUTH', 'login failed', { message })`
    - logout：`logger.info('AUTH', 'logout')`
    - token 刷新成功：`logger.debug('AUTH', 'token refresh')`（**不含 token 值**）
    - token 刷新失败：`logger.warn('AUTH', 'token refresh failed', { message })`
  - **ApiClient.ts**（module 标识 'API'）：
    - 请求开头：`logger.debug('API', \`${method} ${path}\`)`（只记 method+path，不记 headers/body）
    - 响应后：`logger.debug('API', \`response ${status} ${duration}ms\`)`（只记 status+耗时）
    - 失败：`logger.warn('API', 'request failed', { url, status, message })` 或 `logger.error(...)`
    - **任何记录 headers 的场景必须先 redactAuthorization**（REQ-9.4）
    - 原样抛出错误，不改变 ApiClient 异常处理行为
  - **不改变任何现有业务逻辑**
- **Done When**:
  - redact.ts 存在并导出 redactAuthorization
  - AuthContext.tsx 包含 login/logout/refresh 的 logger 调用，且不含 password/token 明文
  - ApiClient.ts 包含请求/响应/失败的 logger 调用
  - ApiClient.ts 中任何 headers 记录前调用 redactAuthorization
  - `npx tsc --noEmit` 退出码 0
- **out_of_scope**: Logger 实现（TASK-1）、RemoteTransport 注册（TASK-2 产出，注册由后续编排）、App.tsx/AppRoot.tsx（TASK-5）

- **依赖**: TASK-1（logger 单例 + 类型）
- **refs**: [DD-7, DD-8, REQ-8, REQ-9]
- **expected_file_changes**:
  - 新建 `fj-android/src/utils/redact.ts`
  - 修改 `fj-android/src/store/auth/AuthContext.tsx`
  - 修改 `fj-android/src/api/ApiClient.ts`
- **verification_commands**:
  - `test -f fj-android/src/utils/redact.ts`
  - `grep -c "redactAuthorization" fj-android/src/utils/redact.ts`
  - `grep -c "logger.info('AUTH'" fj-android/src/store/auth/AuthContext.tsx`
  - `grep -c "logger.debug('API'" fj-android/src/api/ApiClient.ts`
  - `grep -c "REDACTED" fj-android/src/utils/redact.ts`
  - `cd fj-android && npx tsc --noEmit`（退出码必须为 0）
- **verification_evidence_expected**:
  - command: `cd fj-android && npx tsc --noEmit`, expected_exit_code: 0, evidence_type: typecheck_output
  - command: `grep -c "REDACTED" fj-android/src/utils/redact.ts`, expected_exit_code: 0, min count: 1, evidence_type: content_check

---

### TASK-7 Android 主题修复（消除深灰色背景）

**context_block**（executor 必读）：
- **What**: (1) 修改 `android/app/src/main/res/values/styles.xml`，将 AppTheme 的 parent 从 `Theme.AppCompat.DayNight.NoActionBar` 改为 `Theme.AppCompat.Light.NoActionBar`；(2) 新建 `android/app/src/main/res/values-night/styles.xml`，同样使用 Light 主题，强制暗色模式下白色背景。
- **Why**: 实现 REQ-12（Android 主题修复）。华为 Nova 9 / HarmonyOS 暗色模式下，DayNight 主题在 React Native 首次渲染前显示深灰色背景。改为固定 Light 主题 + values-night 覆盖，确保所有模式下背景为白色。这是解决"深灰色屏幕"的原生层修复。
- **Refs**: DD-10（Android 主题修复）
- **Where**:
  - **read_files**: `fj-android/android/app/src/main/res/values/styles.xml`（现有内容，确认 AppTheme 定义和现有 item）
  - **allowed_write_files**:
    - `fj-android/android/app/src/main/res/values/styles.xml`（修改）
    - `fj-android/android/app/src/main/res/values-night/styles.xml`（新建）
  - **forbidden_files**: `requirements.candidate.md`, `design.candidate.md`, `tasks.md`, `trace_delta.md`, 所有 JS/TS 文件（本 task 仅改 Android 原生资源）
- **Constraints**:
  - values/styles.xml：parent 改为 `Theme.AppCompat.Light.NoActionBar`
  - values-night/styles.xml：新建，parent 同样 `Theme.AppCompat.Light.NoActionBar`（强制 Light 即使系统暗色模式）
  - 保留现有 item（如 `android:editTextBackground` 引用 `@drawable/rn_edit_text_material`）
  - 添加 `<item name="android:windowBackground">#ffffff</item>`（显式白色窗口背景，早于 ContentView 渲染）
  - 纯原生 XML 修改，不影响任何 JS 代码，不引入新 Gradle 依赖
  - 不改变 NoActionBar 特性
- **Done When**:
  - values/styles.xml 中 AppTheme parent 为 `Theme.AppCompat.Light.NoActionBar`
  - values-night/styles.xml 存在且 AppTheme parent 为 `Theme.AppCompat.Light.NoActionBar`
  - 两个文件均包含 `android:windowBackground` 为 `#ffffff`
  - 不再包含 `DayNight`
  - 构建通过（TASK-8 验证）
- **out_of_scope**: 任何 JS/TS 代码、Logger、BootErrorScreen、Gradle 配置

- **依赖**: 无（纯 Android 原生修改，与 JS 任务完全独立）
- **refs**: [DD-10, REQ-12]
- **expected_file_changes**:
  - 修改 `fj-android/android/app/src/main/res/values/styles.xml`
  - 新建 `fj-android/android/app/src/main/res/values-night/styles.xml`
- **verification_commands**:
  - `grep -c "Theme.AppCompat.Light.NoActionBar" fj-android/android/app/src/main/res/values/styles.xml`
  - `test -f fj-android/android/app/src/main/res/values-night/styles.xml`
  - `grep -c "Theme.AppCompat.Light.NoActionBar" fj-android/android/app/src/main/res/values-night/styles.xml`
  - `grep -c "#ffffff" fj-android/android/app/src/main/res/values/styles.xml`
  - `! grep -c "DayNight" fj-android/android/app/src/main/res/values/styles.xml`（DayNight 必须不存在，期望退出码非 0 即无匹配）
- **verification_evidence_expected**:
  - command: `grep -c "Theme.AppCompat.Light.NoActionBar" ...`, expected_exit_code: 0, min count: 1, evidence_type: content_check
  - command: `test -f .../values-night/styles.xml`, expected_exit_code: 0, evidence_type: file_existence
  - 注：完整构建验证由 TASK-8 执行

---

### TASK-8 Docker Debug 构建与整体验证

**context_block**（executor 必读）：
- **What**: 在所有代码任务（TASK-1~TASK-7）完成后，使用项目既有的 Docker 构建环境执行 Debug APK 构建，验证 TypeScript 编译通过、Android 构建成功（BUILD SUCCESSFUL）、APK 产物合理。
- **Why**: 实现 AC-7（tsc 退出码 0）、AC-8（Debug 构建成功）、NFR-4（兼容性）。这是 Work Item 级别的端到端验收，确保所有模块集成后整体可构建。
- **Refs**: NFR-4、AC-7、AC-8（系统级验收标准）
- **Where**:
  - **read_files**: `fj-android/Dockerfile` 或项目既有的 Docker 构建脚本、`fj-android/android/gradlew`、`fj-android/package.json`
  - **allowed_write_files**: 无（本 task 为纯构建验证，不修改任何源码；仅产生构建产物如 android/app/build/outputs/apk/*.apk）
  - **forbidden_files**: 所有源码文件（本 task 不修改代码）
- **Constraints**:
  - 使用项目既有 Docker 构建环境（不引入新构建工具）
  - 构建命令顺序：(1) TypeScript 检查 `npx tsc --noEmit`；(2) Android Debug 构建
  - 验证 BUILD SUCCESSFUL 出现在构建输出
  - 记录 APK 大小（合理性检查，不硬性阈值）
  - 若构建失败，记录失败日志并报告（不强行修复，回退给 debugger）
  - 本 task **只读验证**，不修改源码；如发现编译错误，应报告具体错误而非自行修改（修改属于对应 TASK 的范围）
- **Done When**:
  - `npx tsc --noEmit` 退出码 0
  - Docker Debug 构建输出包含 "BUILD SUCCESSFUL"
  - APK 产物文件存在
  - 构建日志已记录
- **out_of_scope**: 修复任何编译/构建错误（属于对应 TASK 的 executor 范围）、Release 构建、单元测试编写

- **依赖**: TASK-1, TASK-2, TASK-3, TASK-4, TASK-5, TASK-6, TASK-7（全部完成后才能整体验证）
- **refs**: [NFR-4, AC-7, AC-8]
- **expected_file_changes**: 无（纯构建验证）
- **verification_commands**:
  - `cd fj-android && npx tsc --noEmit`（退出码必须为 0）
  - Docker Debug 构建（具体命令依项目既有构建脚本，期望输出含 "BUILD SUCCESSFUL"）
  - `test -f fj-android/android/app/build/outputs/apk/debug/app-debug.apk`（或对应产物路径）
- **verification_evidence_expected**:
  - command: `cd fj-android && npx tsc --noEmit`, expected_exit_code: 0, evidence_type: typecheck_output
  - command: Docker build, expected_output_pattern: "BUILD SUCCESSFUL", evidence_type: build_log
  - command: APK existence, expected_exit_code: 0, evidence_type: artifact_existence

---

## 验收标准映射（AC → TASK）

| AC 编号 | 描述 | 覆盖 TASK | 覆盖 REQ |
|---------|------|-----------|----------|
| AC-1 | Logger.debug/info/warn/error 方法工作且不抛异常 | TASK-1 | REQ-1.5, NFR-3.2 |
| AC-2 | 缓冲区存储条目且 getBuffer() 返回它们 | TASK-1 | REQ-2.2, REQ-2.4 |
| AC-3 | App 模块导入失败时屏幕显示错误信息（非深灰色） | TASK-3, TASK-4 | REQ-5.3 |
| AC-4 | ErrorUtils 全局处理器捕获未捕获异常 | TASK-1 | REQ-6.1, REQ-6.2 |
| AC-5 | 网络可用时日志上传到服务器 | TASK-2 | REQ-4.1, REQ-4.5 |
| AC-6 | Release APK 在 RN 渲染前显示白色背景（非深灰色） | TASK-7 | REQ-12.1, REQ-12.2, REQ-12.3 |
| AC-7 | TypeScript 编译通过（tsc 退出码 0） | TASK-1~TASK-6, TASK-8 | NFR-4.1 |
| AC-8 | Debug 构建成功 | TASK-7, TASK-8 | NFR-4.2 |

---

## 范围外观察（out_of_scope_observations）

以下设计决策/需求**未包含在本 tasks.md 的 8 个 task 中**，属于后续工作或已声明为 Should 优先级：

1. **REQ-10 同步引擎日志（SyncEngine.ts）** — Should 优先级。设计 DD-7 已定义埋点规范（sync started/progress/completed/failed），但本批 task 未拆出独立集成 task。建议后续作为增量 task 处理。
2. **REQ-11 屏幕生命周期日志（各 Screen 组件）** — Should 优先级。涉及多文件批量改动，建议用统一的 HOC/工具函数集中处理后再拆 task，避免逐屏改动。
3. **RemoteTransport 在 AuthContext 中的实际注册** — DD-11 说明 RemoteTransport 依赖 ApiClient 实例（在 AuthContext 中创建）。TASK-2 创建了 RemoteTransport 类，但将其注册到 Logger.onFlush 的编排（需从 useAuth 获取 apiClient）未在本批 task 显式拆分，可作为 TASK-6 的延伸或后续增量。
4. **prod-environment.md / project-rules.md 当前为 TODO 占位** — 配置文件尚未填充。verification_commands 使用 `npx tsc --noEmit` 作为通用类型检查基线，待配置填充后需复核生产最低版本要求。

> 注：以上为规划阶段观察，不影响本批 8 个 task 的独立可执行性。REQ-10/REQ-11 为 Should 优先级，可在核心 Must 需求（REQ-1~9, REQ-12）交付后增量处理。

---

## Task Contract 完整性自检

| 检查项 | 结果 |
|--------|------|
| 每个 task 的 refs 非空且引用存在的 REQ/DD | ✅ |
| 每个 task 的 allowed_write_files 路径具体（无通配符） | ✅ |
| 每个 task 的 forbidden_files 包含规划产物和其他 task 文件 | ✅ |
| 每个 task 的 verification_commands 可机器执行（返回退出码） | ✅ |
| 每个 task 的 done_when 可通过 verification_commands 验证 | ✅ |
| 每个 task 的 out_of_scope 明确排除 | ✅ |
| 每个 DD 至少关联一个 TASK | ✅（DD-1/4/9/11→T1, DD-5/6→T2, DD-3→T3, DD-2/11→T4, DD-7→T5/T6, DD-8→T6, DD-10→T7） |
| 并行批次内 task 的 allowed_write_files 无交集 | ✅（Batch 1: T1/T3/T7 文件互斥；Batch 2: T2/T4/T5/T6 文件互斥） |
| 共享代码（Logger）先于依赖方创建 | ✅（TASK-1 在 Batch 1，依赖方在 Batch 2） |
