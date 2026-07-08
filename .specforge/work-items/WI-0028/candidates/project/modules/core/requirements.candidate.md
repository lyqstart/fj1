---
requirements_format: ears
---

# 飞检现场管理系统 — 应用日志系统与启动诊断 需求规格

> **Work Item**: WI-0028
> **Base Spec Version**: PSV-0001
> **生成 Agent**: sf-requirements
> **变更路径**: requirement_change_path

---

## 简介

本文档定义"飞检现场管理系统"（React Native Android 应用，代号 fj-android）的应用级日志系统与启动诊断功能需求。

### 背景

Release APK 在华为 Nova 9（HarmonyOS）上显示**深灰色屏幕**，React Native 未渲染。WI-0026（ProGuard 修复）和 WI-0027（无 ProGuard 诊断版）均未解决问题，根因不明，缺少运行时诊断手段。本 Work Item 通过以下手段解决：

1. **全应用日志系统**：分级日志、内存环形缓冲区、本地持久化、远程上传。
2. **启动诊断**：`index.js` 包裹 try-catch + 降级错误展示组件，确保导入失败时屏幕显示明确错误而非空白。
3. **Android 主题修复**：将 `DayNight` 主题改为固定 `Light`，消除 HarmonyOS 暗色模式下 React Native 首次渲染前的深灰色背景。

### 范围

- **范围内**：Logger 核心、内存缓冲区、本地持久化、远程上传、启动诊断、全局错误处理、关键路径日志集成、Android 主题修复。
- **范围外**：后端日志接收接口实现（已有端点 `{API_ROOT}/logs/batch`）、日志可视化 Web 后台、iOS 平台适配（仅 Android）。

---

## 术语表

| 术语 | 定义 |
|------|------|
| **环形缓冲区（Ring Buffer）** | 固定大小的循环队列数据结构，满时覆盖最旧条目（FIFO 淘汰），保证内存占用恒定。 |
| **EARS** | Easy Approach to Requirements Syntax，需求句式规范，使用 WHEN/WHILE/WHERE/IF/THEN/THE/SHALL 关键词。 |
| **Flush** | 将内存缓冲区中的日志条目持久化到本地存储和/或上传到远程服务器的操作。 |
| **AsyncStorage** | React Native 提供的异步键值对持久化存储 API。 |
| **ApiClient** | 飞检安卓端统一 HTTP 客户端（`fj-android/src/api/ApiClient.ts`），基于全局 fetch 封装。 |
| **BootError** | 启动失败时注册的降级 React Native 组件，替代 App 显示错误信息。 |
| **ErrorUtils.setGlobalHandler** | React Native 运行时提供的全局未捕获异常处理器安装接口。 |
| **令牌脱敏（Token Redaction）** | 将 Authorization 头中的 Bearer 令牌替换为 `***`，确保令牌明文不写入日志。 |
| **`__DEV__`** | React Native 构建时注入的全局布尔变量，开发构建为 true，Release 构建为 false。 |
| **HarmonyOS** | 华为鸿蒙操作系统，本问题的目标设备运行环境。 |
| **指数退避（Exponential Backoff）** | 重试策略，每次重试等待时间按指数增长（如 1s, 2s, 4s），避免服务器过载。 |
| **防抖（Debounce）** | 在连续触发的事件中，仅执行最后一次（或满足时间窗口后执行一次）的控制策略。 |
| **AppRegistry** | React Native 用于注册根组件的全局 API。 |
| **DayNight 主题** | Android AppCompat 主题，根据系统暗色模式自动切换亮/暗配色。HarmonyOS 暗色模式下产生深灰色背景。 |

---

## 需求

### REQ-1 日志核心（Logger Core）

**优先级**: Must

**用户故事**: 作为开发者，我希望有一个统一的日志记录器，以便在应用任何位置记录分级日志而不影响应用稳定性。

**验收标准**:

1. [Ubiquitous] THE 系统 SHALL 提供四个日志级别常量：DEBUG、INFO、WARN、ERROR，且严重性顺序为 DEBUG < INFO < WARN < ERROR。
2. [State-driven] WHILE `__DEV__` 为 true，THE 系统 SHALL 将最低日志级别设为 DEBUG 并将所有日志输出到 JavaScript console。
3. [State-driven] WHILE `__DEV__` 为 false（Release 构建），THE 系统 SHALL 将最低日志级别设为 INFO 并禁止 DEBUG 级别日志输出到 console。
4. [Ubiquitous] THE 系统 SHALL 将每条日志格式化为 `[LEVEL] [ISO-8601 timestamp] [module] message {json data}`，其中 data 为可选的 JSON 序列化对象；当 data 缺省时省略 `{}` 部分。
5. [Unwanted-behavior] IF 日志记录过程中发生任何异常，THEN THE 系统 SHALL 吞掉该异常（try-catch 包裹）且不得向调用方抛出，以确保日志记录永不中断应用执行。
6. [Ubiquitous] THE 系统 SHALL 以单例模式实现 Logger，并通过具名导出 `logger` 实例供全局访问。

---

### REQ-2 内存环形缓冲区（In-Memory Ring Buffer）

**优先级**: Must

**用户故事**: 作为开发者，我希望日志在内存中保留最近的若干条记录，以便在应用运行时快速读取和诊断，即使在离线状态下也能查看历史日志。

**验收标准**:

1. [Ubiquitous] THE 系统 SHALL 维护一个固定大小的环形缓冲区，默认容量为 <ring_buffer_size: 500>（可配置）条日志条目。
2. [Ubiquitous] THE 系统 SHALL 在每个缓冲区条目中包含 timestamp、level、module、message 字段，以及可选的 data 字段。
3. [Event-driven] WHEN 缓冲区已满且有新日志写入，THE 系统 SHALL 覆盖最旧的条目（FIFO 淘汰），保证缓冲区大小恒定不超过容量上限。
4. [Event-driven] WHEN 调用方调用 `logger.getBuffer()`，THE 系统 SHALL 返回当前缓冲区内所有条目的只读快照数组。
5. [Event-driven] WHEN 缓冲区已填充量达到容量阈值 <flush_threshold: 80%>（可配置），THE 系统 SHALL 触发一次自动 flush 事件以通知持久化与上传子系统。

---

### REQ-3 本地持久化（Local Persistence）

**优先级**: Should

**用户故事**: 作为运维人员，我希望日志持久化到本地存储，以便应用重启后仍能读取上一会话的日志用于问题排查。

**验收标准**:

1. [Event-driven] WHEN flush 事件触发或应用进入后台状态，THE 系统 SHALL 将当前缓冲区内容持久化到 AsyncStorage。
2. [Event-driven] WHEN 应用启动时，THE 系统 SHALL 从 AsyncStorage 加载上一会话最近的 <load_previous_entries: 100>（可配置）条日志到内存缓冲区。
3. [Ubiquitous] THE 系统 SHALL 使用 `fj_logs_*` 前缀作为 AsyncStorage 键空间，以避免与其他功能键冲突。
4. [Unwanted-behavior] IF AsyncStorage 不可用或读取失败，THEN THE 系统 SHALL 回退为仅内存缓冲区模式并记录一条 WARN 日志，不得阻塞应用启动。
5. [Unwanted-behavior] IF 持久化写入操作失败，THEN THE 系统 SHALL 吞掉错误并继续运行，不影响后续日志记录和缓冲区正常工作。

---

### REQ-4 远程上传（Remote Upload）

**优先级**: Should

**用户故事**: 作为运维人员，我希望日志能批量上传到服务器，以便在用户设备不可达时仍能远程诊断问题。

**验收标准**:

1. [Event-driven] WHEN 触发日志上传时，THE 系统 SHALL 通过现有 ApiClient 向端点 `POST {API_ROOT}/logs/batch` 发送批量日志。
2. [Ubiquitous] THE 系统 SHALL 上传的 payload 格式为 `{ entries: [{ timestamp, level, module, message, data }] }`。
3. [State-driven] WHILE 处于 Release 构建（`__DEV__` 为 false），THE 系统 SHALL 仅上传 INFO 及以上级别的日志条目。
4. [State-driven] WHILE 处于开发构建（`__DEV__` 为 true），THE 系统 SHALL 上传 DEBUG 及以上级别的日志条目。
5. [Event-driven] WHEN 自上次上传以来经过 <upload_debounce: 30s>（可配置）或缓冲区达到阈值，THE 系统 SHALL 执行一次防抖上传。
6. [Unwanted-behavior] IF 上传请求失败，THEN THE 系统 SHALL 以指数退避策略重试，最多重试 <max_retries: 3>（可配置）次。
7. [Unwanted-behavior] IF 所有重试均失败，THEN THE 系统 SHALL 放弃本次上传且不得影响应用任何功能（非阻塞），失败条目保留在缓冲区等待下次上传周期。

---

### REQ-5 启动诊断（Boot Diagnostics）— 关键

**优先级**: Must

**用户故事**: 作为开发者，我希望在 React Native bundle 加载或 App 模块导入失败时，设备屏幕能显示明确的错误信息而非空白或深灰色屏幕，以便用户和开发者能立即看到失败原因。

**验收标准**:

1. [Event-driven] WHEN `index.js` 执行时，THE 系统 SHALL 将 `require('./App')` 调用包裹在 try-catch 块中。
2. [Event-driven] WHEN App 模块成功导入，THE 系统 SHALL 正常执行 `AppRegistry.registerComponent(appName, App)`，行为与未修改前完全一致。
3. [Unwanted-behavior] IF App 模块导入抛出异常，THEN THE 系统 SHALL 注册一个名为 `BootError` 的降级组件替代 App，该组件 MUST 显示以下全部内容：
   - 红色错误图标 + 标题"启动失败"
   - 错误消息（monospace 等宽字体）
   - 完整堆栈跟踪（可滚动视图）
   - "复制错误"按钮（点击后将错误文本复制到系统剪贴板）
   - 白色背景 `#ffffff`（在亮色和暗色所有主题模式下均保持可见）
4. [Event-driven] WHEN JS bundle 开始执行，THE 系统 SHALL 记录启动阶段日志 "JS bundle executing"。
5. [Event-driven] WHEN App 模块成功导入，THE 系统 SHALL 记录启动阶段日志 "App module imported"。
6. [Event-driven] WHEN AppRegistry 注册完成，THE 系统 SHALL 记录启动阶段日志 "AppRegistry registered"。

---

### REQ-6 全局错误处理器（Global Error Handler）

**优先级**: Must

**用户故事**: 作为开发者，我希望捕获所有未处理的运行时异常，以便记录到日志缓冲区用于后续上传诊断，避免错误被静默吞掉。

**验收标准**:

1. [Event-driven] WHEN 应用启动时，THE 系统 SHALL 通过 `ErrorUtils.setGlobalHandler` 安装全局未捕获异常处理器。
2. [Event-driven] WHEN 未捕获异常发生时，THE 系统 SHALL 将错误（含 message 和 stack）以 ERROR 级别记录到日志缓冲区并输出到 console。
3. [Optional-feature] WHERE `__DEV__` 为 true，THE 系统 SHALL 显示 React Native 默认红框（RedBox）以辅助开发调试。
4. [Optional-feature] WHERE `__DEV__` 为 false（Release 构建），THE 系统 SHALL 抑制红框显示，仅将错误记录到缓冲区等待后续上传。
5. [Unwanted-behavior] IF 全局处理器自身在处理错误时抛出异常，THEN THE 系统 SHALL 吞掉该异常以避免无限递归崩溃。

---

### REQ-7 应用与数据库生命周期日志

**优先级**: Must

**用户故事**: 作为开发者，我希望记录 App 组件挂载和数据库初始化的关键阶段，以便诊断启动阶段失败的具体位置。

**验收标准**:

1. [Event-driven] WHEN `App.tsx` 组件挂载完成，THE 系统 SHALL 以 INFO 级别记录日志 "App component mounted"。
2. [Event-driven] WHEN `AppRoot.tsx` 开始执行数据库初始化，THE 系统 SHALL 以 INFO 级别记录日志 "DB init started"。
3. [Event-driven] WHEN 数据库初始化成功，THE 系统 SHALL 以 INFO 级别记录日志 "DB init succeeded"。
4. [Unwanted-behavior] IF 数据库初始化失败，THEN THE 系统 SHALL 以 ERROR 级别记录日志 "DB init failed" 并附带错误详情（message + stack）。

---

### REQ-8 认证事件日志

**优先级**: Must

**用户故事**: 作为运维人员，我希望记录用户登录、登出和令牌刷新事件，以便排查认证相关问题。

**验收标准**:

1. [Event-driven] WHEN 用户执行登录操作时，THE 系统 SHALL 以 INFO 级别记录 "login" 事件，且不得在日志中记录密码或令牌明文。
2. [Event-driven] WHEN 用户执行登出操作时，THE 系统 SHALL 以 INFO 级别记录 "logout" 事件。
3. [Event-driven] WHEN 令牌刷新成功时，THE 系统 SHALL 以 INFO 级别记录 "token-refreshed" 事件（不含令牌值）。
4. [Unwanted-behavior] IF 令牌刷新失败，THEN THE 系统 SHALL 以 WARN 级别记录 "token-refresh-failed" 并附带错误分类。

---

### REQ-9 HTTP 请求响应日志与令牌脱敏

**优先级**: Must

**用户故事**: 作为运维人员，我希望记录所有 HTTP 请求和响应（含耗时），以便诊断网络层问题，同时确保 Authorization 头中的令牌不被泄露到日志。

**验收标准**:

1. [Event-driven] WHEN ApiClient 发起 HTTP 请求时，THE 系统 SHALL 以 DEBUG 级别记录请求方法（method）和 URL。
2. [Event-driven] WHEN ApiClient 收到 HTTP 响应时，THE 系统 SHALL 以 DEBUG 级别记录 HTTP 状态码（status）和请求耗时（duration_ms）。
3. [Unwanted-behavior] IF HTTP 请求失败（网络错误、超时或服务端错误），THEN THE 系统 SHALL 以 WARN 或 ERROR 级别记录失败详情及错误分类（network/timeout/server/auth/parse）。
4. [Ubiquitous] THE 系统 SHALL 在记录任何 HTTP 日志时对 Authorization 头中的 Bearer 令牌进行脱敏处理（替换为 `***`），确保令牌明文永不写入日志缓冲区或上传到服务器。

---

### REQ-10 同步引擎日志

**优先级**: Should

**用户故事**: 作为运维人员，我希望记录同步引擎的启动、进度和完成事件，以便诊断数据同步失败问题。

**验收标准**:

1. [Event-driven] WHEN 同步引擎开始同步时，THE 系统 SHALL 以 INFO 级别记录 "sync started"。
2. [Event-driven] WHEN 同步进度更新时，THE 系统 SHALL 以 DEBUG 级别记录同步进度（已处理条数 / 总条数）。
3. [Event-driven] WHEN 同步完成时，THE 系统 SHALL 以 INFO 级别记录 "sync completed" 并附带同步统计摘要。
4. [Unwanted-behavior] IF 同步失败，THEN THE 系统 SHALL 以 ERROR 级别记录 "sync failed" 并附带错误详情。

---

### REQ-11 屏幕生命周期日志

**优先级**: Should

**用户故事**: 作为开发者，我希望记录每个屏幕的挂载事件（DEBUG 级别），以便在开发阶段追踪用户导航路径用于调试。

**验收标准**:

1. [Event-driven] WHEN 任一屏幕组件挂载时，THE 系统 SHALL 以 DEBUG 级别记录日志，module 字段为屏幕标识名称。
2. [State-driven] WHILE 处于 Release 构建（`__DEV__` 为 false）且最低日志级别为 INFO，THE 系统 SHALL 自动过滤掉 DEBUG 级别的屏幕挂载日志，使其不写入缓冲区、不上传。

---

### REQ-12 Android 主题修复（消除深灰色背景）

**优先级**: Must

**用户故事**: 作为用户，我希望应用启动时（React Native 渲染前）背景为白色而非深灰色，以便在 HarmonyOS 暗色模式下不会看到难看的深灰色闪烁。

**验收标准**:

1. [Ubiquitous] THE 系统 SHALL 将 `android/app/src/main/res/values/styles.xml` 中 `AppTheme` 的 parent 属性从 `Theme.AppCompat.DayNight.NoActionBar` 修改为 `Theme.AppCompat.Light.NoActionBar`。
2. [Ubiquitous] THE 系统 SHALL 创建 `android/app/src/main/res/values-night/styles.xml` 文件，其中 `AppTheme` 的 parent 同样设为 `Theme.AppCompat.Light.NoActionBar`，以在系统暗色模式下强制使用 Light 主题。
3. [State-driven] WHILE 设备处于暗色模式（dark mode），THE 系统 SHALL 在 React Native 首次渲染前显示白色背景（`#ffffff`），而非 HarmonyOS DayNight 主题默认的深灰色背景。

---

## 非功能性需求

### NFR-1 性能

1. [Ubiquitous] THE 系统 SHALL 保证日志记录操作（单条 log 调用）的同步部分执行时间 < 1ms（异步持久化和上传不计入）。
2. [Ubiquitous] THE 系统 SHALL 保证环形缓冲区的内存占用不超过 <ring_buffer_size: 500> 条 × 平均每条 512 字节 ≈ 256 KB。

### NFR-2 安全

1. [Ubiquitous] THE 系统 SHALL 确保密码、Bearer 令牌、refresh token 等敏感凭证的明文永不写入任何日志条目。
2. [Ubiquitous] THE 系统 SHALL 在 HTTP 请求日志中对 Authorization 头进行脱敏（替换为 `***`）。

### NFR-3 可靠性

1. [Ubiquitous] THE 系统 SHALL 保证日志子系统的任何故障（持久化失败、上传失败、序列化异常）不得导致应用崩溃或功能异常。
2. [Ubiquitous] THE 系统 SHALL 保证 Logger 的所有公共方法（debug/info/warn/error/getBuffer）永不抛出异常。

### NFR-4 兼容性

1. [Ubiquitous] THE 系统 SHALL 在 TypeScript 编译（`tsc --noEmit`）下退出码为 0，无类型错误。
2. [Ubiquitous] THE 系统 SHALL 在 Debug 构建和 Release 构建下均能成功编译和打包。

---

## 系统级验收标准映射

以下为 Work Item 级别的端到端验收标准，映射到具体 REQ：

| AC 编号 | 描述 | 映射 REQ |
|---------|------|----------|
| AC-1 | Logger.debug/info/warn/error 方法工作且不抛异常 | REQ-1.5, NFR-3.2 |
| AC-2 | 缓冲区存储条目且 `getBuffer()` 返回它们 | REQ-2.2, REQ-2.4 |
| AC-3 | App 模块导入失败时屏幕显示错误信息（非深灰色） | REQ-5.3 |
| AC-4 | ErrorUtils 全局处理器捕获未捕获异常 | REQ-6.1, REQ-6.2 |
| AC-5 | 网络可用时日志上传到服务器 | REQ-4.1, REQ-4.5 |
| AC-6 | Release APK 在 RN 渲染前显示白色背景（非深灰色） | REQ-12.1, REQ-12.2, REQ-12.3 |
| AC-7 | TypeScript 编译通过（tsc 退出码 0） | NFR-4.1 |
| AC-8 | Debug 构建成功 | NFR-4.2 |

---

## 配置点清单

| 配置项 | 标记 | 默认值 | 说明 |
|--------|------|--------|------|
| 环形缓冲区容量 | `<ring_buffer_size: 500>` | 500 条 | 内存中保留的最大日志条目数 |
| Flush 触发阈值 | `<flush_threshold: 80%>` | 80% | 缓冲区填充率达到此比例时触发自动 flush |
| 启动加载历史条数 | `<load_previous_entries: 100>` | 100 条 | 应用启动时从本地存储加载的上一会话日志条数 |
| 上传防抖间隔 | `<upload_debounce: 30s>` | 30 秒 | 两次远程上传之间的最小时间间隔 |
| 最大重试次数 | `<max_retries: 3>` | 3 次 | 远程上传失败后的最大重试次数 |

---

## 需求依赖关系

```
REQ-1 (Logger Core)
  ├── REQ-2 (Ring Buffer)        — 依赖 Logger 的级别和格式定义
  ├── REQ-6 (Global Handler)     — 依赖 Logger 的 error 方法
  ├── REQ-7 ~ REQ-11 (集成点)     — 依赖 Logger 实例
  └── REQ-5 (Boot Diagnostics)   — 依赖 Logger 记录启动阶段

REQ-2 (Ring Buffer)
  ├── REQ-3 (Local Persistence)  — 持久化缓冲区内容
  └── REQ-4 (Remote Upload)      — 上传缓冲区内容

REQ-4 (Remote Upload)
  └── 依赖现有 ApiClient

REQ-12 (Theme Fix)
  └── 独立（Android 原生层修改，不依赖 Logger）
```
