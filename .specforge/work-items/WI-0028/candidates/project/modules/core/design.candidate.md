---
design_format: structured_dd
base_spec_version: PSV-0001
---

# 飞检现场管理系统 — 应用日志系统与启动诊断 设计文档

> **Work Item**: WI-0028
> **Base Spec Version**: PSV-0001
> **生成 Agent**: sf-design
> **变更路径**: requirement_change_path
> **标准依据**: specforge_final_fused_standard_v1_1_patch1_zh.md

---

## 简介

本文档定义"飞检现场管理系统"（React Native Android 应用，代号 fj-android）应用级日志系统与启动诊断功能的技术设计。

设计目标是构建一个零外部依赖、永不抛异常的日志子系统，配合 `index.js` 启动诊断兜底组件和 Android 主题修复，彻底解决 Release APK 在华为 Nova 9（HarmonyOS）上的深灰色屏幕问题，并提供运行时诊断能力。

---

## 架构概览

```mermaid
graph TD
    subgraph "启动层 (index.js)"
        IDX[index.js]
        BES[BootErrorScreen]
        GEH[GlobalErrorHandler<br/>installGlobalErrorHandler]
    end

    subgraph "Logger 核心 (src/utils/Logger.ts)"
        LOG[Logger Singleton]
        BUF[RingBuffer<br/>max 500 entries]
        LVL[LogLevel enum]
    end

    subgraph "传输层 (Transports)"
        CT[ConsoleTransport]
        RT[RemoteTransport]
    end

    subgraph "持久化层"
        LP[LogPersistence<br/>AsyncStorage wrapper]
        AS[(AsyncStorage<br/>@fj_logs_buffer)]
    end

    subgraph "集成点 (调用方)"
        APP[App.tsx]
        AR[AppRoot.tsx]
        AC[AuthContext.tsx]
        API[ApiClient.ts]
        SE[SyncEngine]
        SCR[Screens]
    end

    subgraph "外部依赖"
        SERVER[(POST /logs/batch)]
        CLIP["@react-native-clipboard<br/>(optional)]
    end

    IDX -->|"info/error BOOT"| LOG
    IDX --> BES
    IDX --> GEH
    GEH -->|"error GLOBAL"| LOG

    LOG --> BUF
    LOG --> LVL
    BUF --> CT
    BUF --> RT
    BUF -->|"flush event"| LP
    LP --> AS

    RT -->|"POST /logs/batch"| SERVER

    APP --> LOG
    AR --> LOG
    AC --> LOG
    API --> LOG
    SE --> LOG
    SCR --> LOG

    BES -.->|"optional"| CLIP

    style IDX fill:#ffe0b2,stroke:#e65100
    style LOG fill:#c8e6c9,stroke:#1b5e20
    style BES fill:#ffcdd2,stroke:#b71c1c
    style AS fill:#bbdefb,stroke:#0d47a1
    style SERVER fill:#bbdefb,stroke:#0d47a1
```

### 依赖关系说明

- **index.js** 是唯一入口，在 `require('./App')` 前就初始化 Logger，确保启动阶段所有事件都被捕获。
- **Logger** 是单例，所有模块通过具名导出 `logger` 访问，无实例化开销。
- **Transports** 是 Logger 内部的策略对象，日志条目同时分发给所有 transport。
- **LogPersistence** 依赖 AsyncStorage（条件性），不可用时降级为纯内存模式。
- **RemoteTransport** 依赖现有 `ApiClient`（通过 DI 注入，避免循环依赖）。
- **BootErrorScreen** 是独立组件，仅当 App 导入失败时注册，依赖 Clipboard（可选）。

---

## 设计决策

### DD-1 Logger 核心架构（单例 + 级别 + 环形缓冲区）

**refs**: [REQ-1, REQ-2]
**constrained_by**: NFR-1.2 (内存 ≤256KB), NFR-3.2 (永不抛异常), Logger.ts 零 npm 依赖

Logger 以单例模式实现，内部维护 LogLevel 枚举、环形缓冲区和 transport 列表。所有公共方法包裹在 try-catch 中，确保永不抛异常。

```typescript
// src/utils/Logger.ts

/**
 * 日志级别枚举。严重性顺序：DEBUG < INFO < WARN < ERROR。
 * 使用数值便于大小比较（level >= minLevel 时才记录）。
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * 单条日志条目。所有字段为 JSON 可序列化。
 */
export interface LogEntry {
  /** ISO 8601 时间戳，如 "2026-07-06T08:30:00.123Z" */
  timestamp: string;
  /** 日志级别 */
  level: LogLevel;
  /** 模块标识，如 "BOOT", "DB", "AUTH", "API", "SYNC", "SCREEN", "GLOBAL" */
  module: string;
  /** 人类可读消息 */
  message: string;
  /** 可选的结构化数据（JSON 可序列化）。敏感信息必须由调用方脱敏。 */
  data?: unknown;
}

/**
 * Transport 接口。Logger 将每条日志分发给所有已注册的 transport。
 * 满足 A3 可替换性：ConsoleTransport / RemoteTransport 均实现此接口。
 */
export interface LogTransport {
  /** 处理单条日志条目。不得抛异常（Logger 内部已有 try-catch 兜底）。 */
  log(entry: LogEntry): void;
}

/**
 * Logger 配置。
 */
export interface LoggerConfig {
  /** 环形缓冲区容量，默认 500 */
  bufferSize: number;
  /** 自动 flush 触发阈值（0-1），默认 0.8 */
  flushThreshold: number;
  /** 最低日志级别，默认 __DEV__ ? DEBUG : INFO */
  minLevel: LogLevel;
}

/**
 * Logger 单例类。
 *
 * 使用方式：
 *   import { logger } from './utils/Logger';
 *   logger.info('DB', 'initDatabase start');
 *
 * 保证：
 *  - 所有公共方法永不抛异常（NFR-3.2）
 *  - 单条日志同步部分执行 < 1ms（NFR-1.1）
 *  - 内存占用 ≤ bufferSize × 512B（NFR-1.2）
 */
class Logger {
  private buffer: LogEntry[] = [];
  private bufferSize: number;
  private flushThreshold: number;
  private minLevel: LogLevel;
  private transports: LogTransport[] = [];
  private bufferHead: number = 0; // 环形缓冲区写入指针

  constructor(config?: Partial<LoggerConfig>) {
    this.bufferSize = config?.bufferSize ?? 500;
    this.flushThreshold = config?.flushThreshold ?? 0.8;
    this.minLevel = config?.minLevel ?? (__DEV__ ? LogLevel.DEBUG : LogLevel.INFO);
  }

  /** 注册 transport。幂等，重复注册同一实例不会重复添加。 */
  addTransport(transport: LogTransport): void

  /** DEBUG 级别日志。Release 构建下被 minLevel 过滤。 */
  debug(module: string, message: string, data?: unknown): void

  /** INFO 级别日志。 */
  info(module: string, message: string, data?: unknown): void

  /** WARN 级别日志。 */
  warn(module: string, message: string, data?: unknown): void

  /** ERROR 级别日志。 */
  error(module: string, message: string, data?: unknown): void

  /**
   * 返回缓冲区所有条目的只读快照。
   * 返回的是浅拷贝数组，调用方修改不影响内部缓冲区。
   */
  getBuffer(): LogEntry[]

  /**
   * 手动触发 flush。
   * 通知所有 flush listeners（LogPersistence、RemoteTransport）。
   */
  flush(): void

  /**
   * 注册 flush 监听器。当缓冲区达到阈值或手动 flush 时触发。
   */
  onFlush(listener: (entries: LogEntry[]) => void): void

  /** 清空缓冲区（不触发 flush）。用于测试。 */
  clear(): void
}
// Errors: 所有公共方法内部 try-catch，永不抛异常。

/** Logger 单例实例，全局导出。 */
export const logger = new Logger();
```

**环形缓冲区实现策略**：
- 使用 `buffer[]` 数组 + `bufferHead` 写入指针。
- 当 `buffer.length < bufferSize` 时，直接 push。
- 当 `buffer.length >= bufferSize` 时，覆写 `buffer[bufferHead % bufferSize]`，然后 `bufferHead++`。
- `getBuffer()` 按写入顺序返回（从最旧到最新）。

**格式化规则**（REQ-1.4）：
```
[LEVEL] [ISO-8601 timestamp] [module] message {json data}
```
当 `data` 为 `undefined` 时省略 `{}` 部分。格式化在 ConsoleTransport 中完成，不影响缓冲区存储（缓冲区存储结构化 LogEntry）。

---

### DD-2 index.js 启动诊断（try-catch 包裹 + 降级组件）

**refs**: [REQ-5, REQ-6]
**constrained_by**: index.js 必须在 Logger 初始化后才能使用 logger

`index.js` 是 React Native 应用的 JS 入口。修改它，在 `require('./App')` 外包裹 try-catch。如果 App 模块导入失败（bundle 损坏、模块缺失、初始化异常），注册一个降级组件 `BootErrorScreen` 替代 App，确保屏幕显示明确的错误信息而非空白/深灰色。

```javascript
// fj-android/index.js (伪代码)
import { AppRegistry } from 'react-native';
import { name as appName } from './app.json';

// 必须在 require('./App') 之前初始化 Logger
import { logger, installGlobalErrorHandler } from './src/utils/Logger';

// 安装全局错误处理器（REQ-6.1）
installGlobalErrorHandler();

logger.info('BOOT', 'JS bundle executing');

let App;
let bootError = null;

try {
  logger.info('BOOT', 'Importing App module...');
  App = require('./App').default;
  logger.info('BOOT', 'App module imported successfully');
} catch (e) {
  bootError = e;
  logger.error('BOOT', 'App import FAILED', {
    message: e?.message ?? String(e),
    stack: e?.stack ?? null,
  });
}

function Root() {
  if (bootError) {
    const BootErrorScreen = require('./src/components/BootErrorScreen').default;
    return <BootErrorScreen error={bootError} />;
  }
  return <App />;
}

AppRegistry.registerComponent(appName, () => Root);
logger.info('BOOT', 'AppRegistry registered');
```

**关键设计点**：

1. **Logger 初始化在 try-catch 之前** — 确保 App 导入失败时日志已被记录。
2. **Root 组件延迟判断** — `bootError` 在模块作用域捕获，Root 函数在渲染时检查。如果 `bootError` 为 null，行为与原版完全一致（REQ-5.2）。
3. **BootErrorScreen 懒加载** — 用 `require()` 而非顶层 `import`，确保 App 导入失败时 BootErrorScreen 仍可正常加载（它在 `src/components/` 下，不依赖 App 模块链）。
4. **GlobalErrorHandler 最早安装** — 在 `require('./App')` 之前调用 `installGlobalErrorHandler()`，确保 App 导入期间的异常也被全局处理器捕获（双保险）。

**Errors**: 
- `require('./App')` 抛出任何异常 → 被捕获，`bootError` 赋值，渲染 BootErrorScreen。
- `require('./src/components/BootErrorScreen')` 失败 → 极端情况，Root 返回 null（RN 显示空白但不崩溃）。此路径概率极低，因为 BootErrorScreen 只依赖 RN 核心组件。

---

### DD-3 BootErrorScreen 组件（降级错误展示）

**refs**: [REQ-5.3]
**constrained_by**: 仅使用 RN 核心组件（View/Text/ScrollView/TouchableOpacity），零外部 UI 依赖；白色背景 #ffffff 在所有主题模式下可见

当 App 导入失败时，BootErrorScreen 在屏幕上显示完整的错误信息，包括错误消息、堆栈跟踪和复制按钮。

```typescript
// src/components/BootErrorScreen.tsx

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

interface BootErrorScreenProps {
  error: unknown;
}

interface ErrorInfo {
  message: string;
  stack: string | null;
}

/**
 * 启动失败降级组件。
 *
 * 显示内容（REQ-5.3）：
 *  - 红色 ⚠ 图标 + "启动失败" 标题
 *  - 错误消息（monospace 等宽字体）
 *  - 完整堆栈跟踪（可滚动 ScrollView）
 *  - "复制错误信息" 按钮（使用 Clipboard，可选）
 *  - 白色背景 #ffffff
 *
 * 无外部 UI 依赖，仅使用 react-native 核心组件。
 * Clipboard 为条件依赖：若 @react-native-clipboard/clipboard 未安装，隐藏复制按钮。
 */
function BootErrorScreen({ error }: BootErrorScreenProps): React.ReactElement {
  // ...
}

export default BootErrorScreen;
// Errors: 渲染期间不会抛异常（props 已在调用方规范化为 ErrorInfo）。
```

**布局规格**：

| 元素 | 样式 |
|------|------|
| 容器 | `flex:1, backgroundColor:'#ffffff', padding:24` |
| ⚠ 图标 | `fontSize:48, color:'#d32f2f, textAlign:'center'` |
| 标题 "启动失败" | `fontSize:20, fontWeight:'bold', color:'#d32f2f', textAlign:'center', marginTop:12` |
| 错误消息 | `fontSize:14, color:'#b71c1c', fontFamily:monospace, marginTop:16` |
| 堆栈 ScrollView | `flex:1, marginTop:16, maxHeight:400` |
| 堆栈文本 | `fontSize:12, color:'#757575', fontFamily:monospace` |
| 复制按钮 | `TouchableOpacity, backgroundColor:'#1976d2', borderRadius:8, paddingVertical:12, marginTop:16` |
| 复制按钮文字 | `color:'#ffffff', fontSize:14, fontWeight:'600', textAlign:'center'` |

**Clipboard 条件加载策略**：

```typescript
// 条件加载 Clipboard —— 如果 @react-native-clipboard/clipboard 未安装，
// 动态 require 会抛异常，catch 后 showCopyButton=false。
let Clipboard: { setString: (text: string) => void } | null = null;
let showCopyButton = false;
try {
  // @ts-expect-error — 条件依赖，可能未安装
  Clipboard = require('@react-native-clipboard/clipboard').default ?? null;
  showCopyButton = Clipboard !== null && typeof Clipboard.setString === 'function';
} catch {
  showCopyButton = false;
}
```

**错误信息规范化**：

```typescript
function normalizeError(error: unknown): ErrorInfo {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack ?? null };
  }
  if (typeof error === 'string') {
    return { message: error, stack: null };
  }
  return { message: JSON.stringify(error), stack: null };
}
```

---

### DD-4 ConsoleTransport（控制台输出策略）

**refs**: [REQ-1.2, REQ-1.3, REQ-1.4, REQ-6.2]
**constrained_by**: __DEV__ 全局变量；开发阶段输出到 console，Release 仅 console.error

ConsoleTransport 是 Logger 的默认 transport，负责将日志输出到 JavaScript console（Hermes/Logcat）。

```typescript
// src/utils/Logger.ts (ConsoleTransport 内联在 Logger.ts 中)

/**
 * ConsoleTransport — 将日志输出到 JavaScript console。
 *
 * 策略：
 *  - __DEV__ = true: 所有级别通过 console.log/info/warn/error 输出
 *  - __DEV__ = false: 仅 ERROR 级别通过 console.error 输出
 *    （Release 构建中 console.log/info/warn 被 Hermes 优化为 no-op，
 *     但显式过滤避免 logcat 噪音）
 *
 * 格式（REQ-1.4）：
 *  [LEVEL] [ISO-8601 timestamp] [module] message {json data}
 */
class ConsoleTransport implements LogTransport {
  log(entry: LogEntry): void {
    const formatted = this.format(entry);
    if (__DEV__) {
      // 开发构建：按级别使用对应 console 方法
      switch (entry.level) {
        case LogLevel.DEBUG: console.log(formatted); break;
        case LogLevel.INFO:  console.info(formatted); break;
        case LogLevel.WARN:  console.warn(formatted); break;
        case LogLevel.ERROR: console.error(formatted); break;
      }
    } else {
      // Release 构建：仅 ERROR 输出到 console.error（被 logcat 捕获）
      if (entry.level >= LogLevel.ERROR) {
        console.error(formatted);
      }
    }
  }

  /**
   * 格式化日志条目为字符串。
   * [LEVEL] [ISO-8601 timestamp] [module] message {json data}
   * data 为 undefined 时省略 {} 部分。
   */
  private format(entry: LogEntry): string {
    const levelName = LogLevel[entry.level] ?? 'UNKNOWN';
    const dataPart = entry.data !== undefined
      ? ' ' + safeJsonStringify(entry.data)
      : '';
    return `[${levelName}] [${entry.timestamp}] [${entry.module}] ${entry.message}${dataPart}`;
  }
}
// Errors: format() 内部 try-catch，JSON.stringify 失败时降级为 [unserializable]。
```

**safeJsonStringify**：
```typescript
function safeJsonStringify(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch {
    return '[unserializable]';
  }
}
```

---

### DD-5 RemoteTransport（远程批量上传）

**refs**: [REQ-4]
**constrained_by**: 依赖现有 ApiClient（DI 注入）；upload_debounce=30s；max_retries=3

RemoteTransport 负责将缓冲区日志批量上传到服务器。使用防抖策略避免频繁请求，失败时指数退避重试。

```typescript
// src/utils/RemoteTransport.ts

import { LogLevel, type LogEntry, type LogTransport } from './Logger';

/**
 * RemoteTransport 配置。
 */
export interface RemoteTransportConfig {
  /** 上传防抖间隔（毫秒），默认 30000 */
  uploadDebounceMs: number;
  /** 单次上传最大条目数，默认 100 */
  batchSize: number;
  /** 最大重试次数，默认 3 */
  maxRetries: number;
  /** 退避基数（毫秒），默认 2000。退避序列：base×2^0, base×2^1, base×2^2 = 2s, 4s, 8s */
  backoffBaseMs: number;
}

/**
 * ApiClient 端口接口（避免硬依赖 ApiClient 具体类，便于测试 mock）。
 */
export interface LogUploadClient {
  post(path: string, body?: unknown): Promise<unknown>;
}

/**
 * RemoteTransport — 批量上传日志到 POST {API_ROOT}/logs/batch。
 *
 * 策略（REQ-4）：
 *  - 防抖：日志产生后等待 uploadDebounceMs，期间无新日志才上传（避免频繁请求）
 *  - 批量：每次最多 batchSize 条，超出分多次
 *  - 级别过滤：Release 仅上传 INFO+，Debug 上传 DEBUG+
 *  - 重试：失败后指数退避（2s, 4s, 8s），最多 maxRetries 次
 *  - 静默失败：所有异常被吞掉，绝不影响应用（REQ-4.7, NFR-3.1）
 *
 * 注意：RemoteTransport 不直接持有 buffer 引用，而是通过 Logger.onFlush
 * 注册的 listener 接收待上传条目。
 */
class RemoteTransport {
  constructor(
    client: LogUploadClient,
    uploadPath: string,
    config?: Partial<RemoteTransportConfig>,
  );

  /**
   * 处理 flush 事件。由 Logger.onFlush 调用。
   * 内部去重、过滤、分批、防抖后上传。
   */
  handleFlush(entries: LogEntry[]): void;
}
// Errors: 所有方法内部 try-catch，网络失败/序列化失败静默吞掉。
```

**退避序列**：`2s → 4s → 8s`（`backoffBaseMs=2000, 2^0 × 2000, 2^1 × 2000, 2^2 × 2000`）

**防抖实现**：

```typescript
private debounceTimer: ReturnType<typeof setTimeout> | null = null;
private pendingEntries: LogEntry[] = [];

handleFlush(entries: LogEntry[]): void {
  try {
    // 过滤级别（REQ-4.3, REQ-4.4）
    const minUploadLevel = __DEV__ ? LogLevel.DEBUG : LogLevel.INFO;
    const filtered = entries.filter(e => e.level >= minUploadLevel);
    this.pendingEntries.push(...filtered);

    // 防抖：重置定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.uploadPending();
    }, this.config.uploadDebounceMs);
  } catch {
    // 静默失败
  }
}

private async uploadPending(): Promise<void> {
  try {
    const batch = this.pendingEntries.splice(0, this.config.batchSize);
    if (batch.length === 0) return;

    await this.uploadWithRetry(batch);
    // 如果还有剩余，继续上传下一批
    if (this.pendingEntries.length > 0) {
      this.uploadPending();
    }
  } catch {
    // 所有重试失败 → 放弃本次，条目已从 pending 移除（不阻塞）
  }
}

private async uploadWithRetry(batch: LogEntry[]): Promise<void> {
  for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
    try {
      await this.client.post(this.uploadPath, { entries: batch });
      return; // 成功
    } catch (error) {
      if (attempt < this.config.maxRetries) {
        const delay = this.config.backoffBaseMs * Math.pow(2, attempt);
        await sleep(delay);
      }
      // 最后一次失败 → 抛出，由 uploadPending catch
    }
  }
}
```

---

### DD-6 本地持久化策略（LogPersistence + AsyncStorage）

**refs**: [REQ-3]
**constrained_by**: AsyncStorage 可能为 null（未安装）；fj_logs_* 键空间；load_previous_entries=100

```typescript
// src/utils/LogPersistence.ts

import type { LogEntry } from './Logger';

/**
 * AsyncStorage 端口接口（解耦具体实现）。
 * 生产使用 @react-native-async-storage/async-storage；测试可用内存 Map mock。
 */
export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/**
 * LogPersistence — 日志本地持久化。
 *
 * 策略（REQ-3）：
 *  - 存储：AsyncStorage，键 '@fj_logs_buffer'（fj_logs_* 前缀）
 *  - 触发：flush 事件 + AppState 'background'/'inactive'
 *  - 加载：Logger 初始化时，加载上一会话最近 loadPreviousEntries 条
 *  - 降级：AsyncStorage 不可用时 → 纯内存模式，记录 WARN（REQ-3.4）
 *  - 容错：写入失败静默吞掉（REQ-3.5）
 */
class LogPersistence {
  private storage: AsyncStorageLike | null = null;
  private readonly key: string = '@fj_logs_buffer';
  private readonly loadPreviousEntries: number;

  constructor(loadPreviousEntries: number = 100);

  /**
   * 初始化：尝试加载 AsyncStorage。
   * 成功 → 设置 this.storage，加载历史日志。
   * 失败 → this.storage=null，纯内存模式。
   */
  async init(): Promise<LogEntry[]>;

  /**
   * 持久化日志条目到 AsyncStorage。
   * flush 事件 / app background 时调用。
   */
  async save(entries: LogEntry[]): Promise<void>;

  /**
   * 注册 AppState 监听器，在 app 进入后台时自动 save。
   */
  attachAppStateListener(): void;
}
// Errors: init/save 内部 try-catch。AsyncStorage 不可用时降级内存模式。
```

**AsyncStorage 条件加载**：

```typescript
async init(): Promise<LogEntry[]> {
  try {
    // 条件加载 AsyncStorage
    const storage = await this.tryLoadAsyncStorage();
    if (!storage) {
      // AsyncStorage 不可用 → 降级为纯内存模式
      // 注意：此时 logger 可能尚未完全初始化，使用 console.warn 兜底
      console.warn('[LogPersistence] AsyncStorage unavailable, fallback to memory-only');
      return [];
    }
    this.storage = storage;

    // 加载上一会话日志（REQ-3.2）
    const raw = await storage.getItem(this.key);
    if (!raw) return [];
    const entries = JSON.parse(raw) as LogEntry[];
    // 只取最近 N 条
    return entries.slice(-this.loadPreviousEntries);
  } catch {
    // 读取失败 → 回退内存模式（REQ-3.4）
    return [];
  }
}

private async tryLoadAsyncStorage(): Promise<AsyncStorageLike | null> {
  try {
    // @ts-expect-error — 条件依赖
    const mod = await import('@react-native-async-storage/async-storage');
    return mod.default ?? mod;
  } catch {
    return null;
  }
}
```

**AppState 监听**：

```typescript
import { AppState, type AppStateStatus } from 'react-native';

attachAppStateListener(): void {
  const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'background' || state === 'inactive') {
      // 应用进入后台 → 持久化当前缓冲区
      this.save(logger.getBuffer()).catch(() => { /* 静默 */ });
    }
  });
}
```

---

### DD-7 集成点（调用方日志埋点规范）

**refs**: [REQ-5.4-5.6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11]
**constrained_by**: 所有集成点使用具名导出 `logger`；不修改业务逻辑

以下是各模块日志埋点的精确位置和调用规范。每个集成点只添加 `logger.xxx()` 调用，不改变任何业务逻辑。

| 模块 | 文件路径 | Module 标识 | 日志调用 | REQ |
|------|----------|-------------|----------|-----|
| **index.js** | `fj-android/index.js` | `BOOT` | `info('BOOT','JS bundle executing')`<br>`info('BOOT','Importing App module...')`<br>`info('BOOT','App module imported successfully')`<br>`error('BOOT','App import FAILED',{message,stack})`<br>`info('BOOT','AppRegistry registered')` | REQ-5 |
| **App.tsx** | `fj-android/App.tsx` | `APP` | `useEffect(() => logger.info('APP','App component mounted'),[])` | REQ-7.1 |
| **AppRoot.tsx** | `fj-android/src/AppRoot.tsx` | `DB` | `info('DB','DB init started')` (initialize 开头)<br>`info('DB','DB init succeeded')` (成功后)<br>`error('DB','DB init failed',{message,stack})` (catch 块) | REQ-7.2-7.4 |
| **AuthContext.tsx** | `fj-android/src/store/auth/AuthContext.tsx` | `AUTH` | `info('AUTH','login')` (login 方法开头，不含密码/token)<br>`info('AUTH','logout')`<br>`info('AUTH','token-refreshed')` (刷新成功)<br>`warn('AUTH','token-refresh-failed',{kind})` (刷新失败) | REQ-8 |
| **ApiClient.ts** | `fj-android/src/api/ApiClient.ts` | `API` | `debug('API',\`${method} ${path}\`)` (requestRaw 开头)<br>`debug('API',\`response ${status} ${duration_ms}ms\`)` (响应后)<br>`warn('API','request failed',{kind,message})` 或<br>`error('API','request failed',{kind,message})` | REQ-9 |
| **SyncEngine.ts** | `fj-android/src/api/SyncEngine.ts` | `SYNC` | `info('SYNC','sync started')` (fullSync 开头)<br>`debug('SYNC',\`progress ${processed}/${total}\`)` (分页拉取)<br>`info('SYNC','sync completed',{stats})` (成功后)<br>`error('SYNC','sync failed',{message})` (catch) | REQ-10 |
| **Screens** | 各 Screen 组件 | `SCREEN` | `debug('SCREEN',\`${screenName} mounted\`)` (useEffect mount) | REQ-11 |

**AuthContext 集成细节**（REQ-8 安全要求）：

```typescript
// login 方法中：
const login = async (username: string, _password: string) => {
  logger.info('AUTH', 'login', { username }); // ✅ 不记录 password
  // ... 原有逻辑
};

// token 刷新成功：
logger.info('AUTH', 'token-refreshed'); // ✅ 不含 token 值

// token 刷新失败：
logger.warn('AUTH', 'token-refresh-failed', { kind: error.kind }); // ✅ 不含 token 值
```

---

### DD-8 ApiClient Token 脱敏（HTTP 日志安全）

**refs**: [REQ-9.4, NFR-2.1, NFR-2.2]
**constrained_by**: Authorization 头中的 Bearer token 必须脱敏；永不记录 request/response body

在 ApiClient 的日志埋点中，对 Authorization 头进行脱敏处理，确保 Bearer token 明文永不写入日志。

```typescript
// src/utils/redact.ts

/**
 * 脱敏 Authorization 头。
 * "Bearer eyJhbG..." → "Bearer ***REDACTED***"
 * 非 Bearer 格式 → "***REDACTED***"
 */
export function redactAuthorization(headers: Record<string, string>): Record<string, string> {
  const result = { ...headers };
  if (result['Authorization'] || result['authorization']) {
    const key = result['Authorization'] ? 'Authorization' : 'authorization';
    const value = result[key];
    if (value.startsWith('Bearer ')) {
      result[key] = 'Bearer ***REDACTED***';
    } else {
      result[key] = '***REDACTED***';
    }
  }
  return result;
}
// Errors: 纯函数，不抛异常。输入为 null/undefined 时返回空对象。
```

**ApiClient 集成**：

```typescript
// ApiClient.requestRaw 中添加：
private async requestRaw<T>(method, path, init, options): Promise<T> {
  const url = this.buildUrl(path, options?.query);
  const startTime = Date.now();

  // 请求日志（REQ-9.1）—— 脱敏 headers
  logger.debug('API', `${method} ${path}`);

  try {
    const result = await this.doFetchWithAuth<T>(url, init, options, timeoutMs, false);
    const durationMs = Date.now() - startTime;
    // 响应日志（REQ-9.2）
    logger.debug('API', `response ${durationMs}ms`);
    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    if (error instanceof ApiError) {
      // 失败日志（REQ-9.3）
      const level = error.kind === 'auth' ? 'error' : 'warn';
      logger[level]('API', `request failed (${durationMs}ms)`, {
        kind: error.kind,
        code: error.code,
        httpStatus: error.httpStatus,
      });
    } else {
      logger.error('API', `request failed (${durationMs}ms)`, {
        message: error instanceof Error ? error.message : String(error),
      });
    }
    throw error; // 原样抛出，不改变 ApiClient 行为
  }
}
```

**安全保证**：
- ✅ 请求日志只记录 `method` 和 `path`，不记录 headers / body（REQ-9.4）
- ✅ 响应日志只记录 `duration_ms`，不记录 response body
- ✅ 失败日志记录 `kind/code/httpStatus`，不记录 token 或敏感数据
- ✅ `redactAuthorization` 函数可用于任何需要记录 headers 的场景（防御性设计）

---

### DD-9 全局错误处理器（ErrorUtils.setGlobalHandler）

**refs**: [REQ-6]
**constrained_by**: ErrorUtils 是 RN 运行时全局对象；__DEV__ 下显示 RedBox

```typescript
// src/utils/Logger.ts (installGlobalErrorHandler 内联)

/**
 * 安装全局未捕获异常处理器（REQ-6.1）。
 *
 * 必须在 index.js 中、require('./App') 之前调用。
 *
 * 行为（REQ-6）：
 *  - 捕获所有未处理异常，以 ERROR 级别记录到缓冲区和 console（REQ-6.2）
 *  - __DEV__ = true: 保留 RN 默认 RedBox 行为（REQ-6.3）
 *  - __DEV__ = false: 抑制 RedBox，仅记录到缓冲区（REQ-6.4）
 *  - 处理器自身异常被吞掉（REQ-6.5）
 *
 * ErrorUtils 是 React Native 运行时注入的全局对象（declare global）。
 */
export function installGlobalErrorHandler(): void {
  try {
    // @ts-expect-error — ErrorUtils 由 RN 运行时注入，无 TS 类型声明
    const ErrorUtils = global.ErrorUtils;
    if (!ErrorUtils || typeof ErrorUtils.setGlobalHandler !== 'function') {
      // 非 RN 环境（如 Jest）→ 跳过
      return;
    }

    const previousHandler = ErrorUtils.getGlobalHandler?.();

    ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      try {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : null;
        logger.error('GLOBAL', `Uncaught exception (fatal=${isFatal ?? false})`, {
          message,
          stack,
        });

        // __DEV__ 下保留默认 RedBox 行为（调用 previousHandler）
        if (__DEV__ && typeof previousHandler === 'function') {
          previousHandler(error, isFatal);
        }
        // Release 构建不调用 previousHandler → 抑制 RedBox
      } catch {
        // 处理器自身异常 → 吞掉，避免无限递归（REQ-6.5）
      }
    });
  } catch {
    // 安装失败 → 静默（Logger 仍可正常使用）
  }
}
// Errors: installGlobalErrorHandler 内部 try-catch，永不抛异常。
```

**ErrorUtils 类型声明**（补充全局类型）：

```typescript
// src/types/globals.d.ts
declare global {
  interface ErrorUtils {
    setGlobalHandler(fn: (error: unknown, isFatal?: boolean) => void): void;
    getGlobalHandler(): ((error: unknown, isFatal?: boolean) => void) | undefined;
  }
  const ErrorUtils: ErrorUtils;
}
export {};
```

---

### DD-10 Android 主题修复（消除深灰色背景）

**refs**: [REQ-12]
**constrained_by**: Theme.AppCompat.Light.NoActionBar；values-night 强制 Light；不改变 JS 行为

修改 Android 原生层主题配置，将 DayNight（随系统暗色模式切换）改为固定 Light，消除 HarmonyOS 暗色模式下 React Native 首次渲染前的深灰色背景。

**文件 1：`android/app/src/main/res/values/styles.xml`（修改）**

```xml
<!-- 修改前 -->
<style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">

<!-- 修改后 -->
<style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">
```

完整文件：
```xml
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="android:editTextBackground">@drawable/rn_edit_text_material</item>
        <item name="android:windowBackground">#ffffff</item>
    </style>
</resources>
```

**文件 2：`android/app/src/main/res/values-night/styles.xml`（新建）**

```xml
<resources>
    <!-- 强制 Light 主题，即使在系统暗色模式下也使用白色背景。
         消除 HarmonyOS 暗色模式下 DayNight 主题产生的深灰色背景。 -->
    <style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="android:editTextBackground">@drawable/rn_edit_text_material</item>
        <item name="android:windowBackground">#ffffff</item>
    </style>
</resources>
```

**设计要点**：

1. **values + values-night 双覆盖** — Android 在暗色模式下优先读取 `values-night/`，两个目录都设为 Light 主题，确保所有模式下背景为白色。
2. **显式 windowBackground** — 额外添加 `android:windowBackground=#ffffff`，确保 Activity 窗口背景在主题应用时就为白色，早于任何 ContentView 渲染。
3. **AppCompat.Light.NoActionBar** — 保持 NoActionBar 特性（无标题栏），与原 DayNight 版本行为一致，仅切换亮/暗基色。
4. **纯原生修改** — 不影响任何 JS 代码，不引入新的 Gradle 依赖。

---

### DD-11 Logger 初始化编排

**refs**: [REQ-1, REQ-3, REQ-4]
**constrained_by**: Logger 单例必须在首次使用前完成 transport 注册和持久化加载

Logger 单例在模块加载时创建，但 transport 注册和历史日志加载需要在 index.js 中显式编排。

```typescript
// src/utils/Logger.ts — 初始化辅助函数

/**
 * 初始化 Logger 子系统。
 * 在 index.js 中、installGlobalErrorHandler() 之后、require('./App') 之前调用。
 *
 * 步骤：
 *  1. 注册 ConsoleTransport（同步）
 *  2. 加载历史日志到缓冲区（异步，不阻塞启动）
 *  3. 注册 LogPersistence flush listener
 *  4. 注册 RemoteTransport flush listener（需要 ApiClient，延迟到 AuthContext 中）
 *  5. 附加 AppState 监听器
 *
 * 注意：RemoteTransport 依赖 ApiClient，而 ApiClient 在 AuthContext 中创建。
 * 因此 RemoteTransport 的注册延迟到 AuthContext useEffect 中。
 */
export async function initLogger(): Promise<void> {
  try {
    // 1. ConsoleTransport（同步，立即可用）
    logger.addTransport(new ConsoleTransport());

    // 2-3. LogPersistence（异步加载历史 + 注册 flush listener）
    const persistence = new LogPersistence(100);
    const previousEntries = await persistence.init();
    if (previousEntries.length > 0) {
      // 将历史日志注入缓冲区（不触发 flush）
      for (const entry of previousEntries) {
        logger.injectEntry(entry);
      }
      logger.info('LOGGER', `Loaded ${previousEntries.length} entries from previous session`);
    }

    // 注册 flush listener
    logger.onFlush((entries) => {
      persistence.save(entries).catch(() => {});
    });

    // 5. AppState 监听
    persistence.attachAppStateListener();

    logger.info('LOGGER', 'Logger subsystem initialized');
  } catch {
    // 初始化失败 → 降级为纯 ConsoleTransport
    // ConsoleTransport 已在步骤 1 注册，即使后续步骤失败也有基本日志能力
  }
}
```

**index.js 编排顺序**：

```javascript
// 1. 导入 Logger（同步，创建单例 + 注册 ConsoleTransport）
import { logger, installGlobalErrorHandler, initLogger } from './src/utils/Logger';

// 2. 安装全局错误处理器（同步）
installGlobalErrorHandler();

// 3. 初始化 Logger（异步，不 await —— 不阻塞启动）
initLogger().catch(() => {});

// 4. 记录启动日志
logger.info('BOOT', 'JS bundle executing');

// 5. try-catch 导入 App
try {
  App = require('./App').default;
  logger.info('BOOT', 'App module imported successfully');
} catch (e) {
  bootError = e;
  logger.error('BOOT', 'App import FAILED', { message: e?.message, stack: e?.stack });
}
```

**为何 initLogger 不 await**：
- `initLogger` 中的 AsyncStorage 加载是异步的，await 会延迟 App 渲染。
- ConsoleTransport 在第一步同步注册，即使 AsyncStorage 未加载完成，日志仍会输出到 console。
- 历史日志注入缓冲区是异步的，完成后自然可见，不影响启动时序。

---

## 数据模型

### LogEntry（内存缓冲区 + 持久化 + 上传 payload 共用）

```typescript
interface LogEntry {
  timestamp: string;   // ISO 8601, "2026-07-06T08:30:00.123Z"
  level: LogLevel;     // 0=DEBUG, 1=INFO, 2=WARN, 3=ERROR
  module: string;      // "BOOT" | "APP" | "DB" | "AUTH" | "API" | "SYNC" | "SCREEN" | "GLOBAL" | "LOGGER"
  message: string;     // 人类可读消息
  data?: unknown;      // 可选结构化数据（JSON 可序列化，已脱敏）
}
```

### AsyncStorage 存储结构

```json
// Key: @fj_logs_buffer
// Value: JSON 字符串
[
  {
    "timestamp": "2026-07-06T08:30:00.123Z",
    "level": 1,
    "module": "BOOT",
    "message": "JS bundle executing"
  },
  {
    "timestamp": "2026-07-06T08:30:00.456Z",
    "level": 1,
    "module": "DB",
    "message": "DB init started"
  }
]
```

### 远程上传 Payload

```json
// POST {API_ROOT}/logs/batch
{
  "entries": [
    {
      "timestamp": "2026-07-06T08:30:00.123Z",
      "level": 1,
      "module": "BOOT",
      "message": "JS bundle executing"
    }
  ]
}
```

### Module 标识常量表

| 常量值 | 使用位置 | REQ |
|--------|----------|-----|
| `BOOT` | index.js 启动阶段 | REQ-5 |
| `APP` | App.tsx 挂载 | REQ-7 |
| `DB` | AppRoot.tsx 数据库初始化 | REQ-7 |
| `AUTH` | AuthContext.tsx 认证事件 | REQ-8 |
| `API` | ApiClient.ts HTTP 请求 | REQ-9 |
| `SYNC` | SyncEngine.ts 同步引擎 | REQ-10 |
| `SCREEN` | 各 Screen 组件 | REQ-11 |
| `GLOBAL` | 全局错误处理器 | REQ-6 |
| `LOGGER` | Logger 自身初始化 | DD-11 |

---

## 错误处理策略汇总

| 组件 | 失败场景 | 处理策略 | REQ |
|------|----------|----------|-----|
| Logger.debug/info/warn/error | 任何内部异常 | try-catch 吞掉，永不抛出 | REQ-1.5, NFR-3.2 |
| Logger.getBuffer() | 缓冲区读取异常 | 返回空数组 `[]` | NFR-3.2 |
| ConsoleTransport.format | JSON.stringify 失败 | 降级为 `[unserializable]` | DD-4 |
| RemoteTransport.upload | 网络失败 | 指数退避重试 3 次（2s/4s/8s），最终放弃 | REQ-4.6, REQ-4.7 |
| LogPersistence.save | AsyncStorage 写入失败 | 静默吞掉，不影响后续日志 | REQ-3.5 |
| LogPersistence.init | AsyncStorage 不可用 | 降级为纯内存模式 | REQ-3.4 |
| LogPersistence.load | JSON 解析失败 | 返回空数组，不阻塞启动 | REQ-3.4 |
| installGlobalErrorHandler | 安装失败 | 静默跳过，Logger 仍可用 | DD-9 |
| GlobalHandler callback | 处理异常时自身出错 | try-catch 吞掉，避免无限递归 | REQ-6.5 |
| BootErrorScreen | Clipboard 不可用 | 隐藏复制按钮 | DD-3 |
| BootErrorScreen | error 非 Error 类型 | normalizeError 规范化为字符串 | DD-3 |

---

## 组件接口汇总

### Logger（单例）

```typescript
interface ILogger {
  debug(module: string, message: string, data?: unknown): void;
  info(module: string, message: string, data?: unknown): void;
  warn(module: string, message: string, data?: unknown): void;
  error(module: string, message: string, data?: unknown): void;
  getBuffer(): LogEntry[];
  flush(): void;
  clear(): void;
  addTransport(transport: LogTransport): void;
  onFlush(listener: (entries: LogEntry[]) => void): void;
  injectEntry(entry: LogEntry): void;  // 内部方法，用于加载历史日志
}
// Errors: 所有方法永不抛异常
```

### LogTransport（接口，A3 可替换性）

```typescript
interface LogTransport {
  log(entry: LogEntry): void;
}
// 实现类：ConsoleTransport（DD-4）
// Errors: 实现方应自行 try-catch，Logger 也有兜底
```

### LogPersistence

```typescript
interface ILogPersistence {
  init(): Promise<LogEntry[]>;
  save(entries: LogEntry[]): Promise<void>;
  attachAppStateListener(): void;
}
// Errors: init/save 内部 try-catch，AsyncStorage 不可用时降级
```

### RemoteTransport

```typescript
interface IRemoteTransport {
  handleFlush(entries: LogEntry[]): void;
}
// Errors: 静默失败，永不抛异常
```

### LogUploadClient（端口接口，DD-4 抽象验证）

```typescript
interface LogUploadClient {
  post(path: string, body?: unknown): Promise<unknown>;
}
// 实现类：ApiClient（已有，满足接口）
// 测试 Mock：MemoryLogUploadClient（测试用）
// 满足 DD4：≥2 调用点（生产 ApiClient + 测试 Mock）
```

---

## 测试策略

### 单元测试

| 测试目标 | 测试框架 | 关键用例 |
|----------|----------|----------|
| Logger 级别过滤 | Jest | DEBUG 在 Release 被过滤；ERROR 在所有模式输出 |
| 环形缓冲区 | Jest | 满 500 条后覆写最旧；getBuffer 返回正确顺序 |
| Logger 永不抛异常 | Jest | 传入循环引用 data、null module、超长 message 不崩溃 |
| ConsoleTransport 格式化 | Jest | 格式符合 `[LEVEL] [timestamp] [module] message {data}`；data 缺省时无 `{}` |
| safeJsonStringify | Jest | 循环引用返回 `[unserializable]` |
| redactAuthorization | Jest | Bearer token 替换为 `***REDACTED***`；非 Bearer 也脱敏 |
| LogPersistence 降级 | Jest | AsyncStorage=null 时返回空数组不崩溃 |
| RemoteTransport 重试 | Jest | 3 次失败后放弃；成功后不重试 |
| RemoteTransport 防抖 | Jest | 30s 内多次 flush 只触发一次上传 |
| normalizeError | Jest | Error 对象、字符串、未知类型均正确规范化 |

### 属性测试（PBT）

| 属性 | 描述 |
|------|------|
| **P1: Logger 永不抛异常** | 对于任意输入（含 null、undefined、循环引用、超长字符串），Logger 方法不抛异常 |
| **P2: 缓冲区大小恒定** | 对于任意数量的 log 调用，`getBuffer().length <= bufferSize` |
| **P3: 缓冲区 FIFO 顺序** | 对于连续 N 条日志（N > bufferSize），getBuffer 返回最近 bufferSize 条，顺序正确 |
| **P4: 级别过滤单调性** | 如果 minLevel=L，则 getBuffer 中不存在 level < L 的条目 |
| **P5: Token 脱敏完备性** | 对于包含 `Bearer xxx` 的任意 headers，redactAuthorization 后不含原始 token 子串 |
| **P6: 格式化幂等性** | 对于同一 LogEntry，format 多次调用结果一致 |

### 集成测试

| 测试场景 | 验证点 |
|----------|--------|
| index.js 启动成功路径 | App 正常渲染，BOOT 日志写入缓冲区 |
| index.js 启动失败路径 | BootErrorScreen 渲染，错误信息正确显示 |
| App → Logger → ConsoleTransport | App.tsx mount 日志出现在 console |
| ApiClient → Logger | 请求/响应/失败日志正确记录，token 被脱敏 |
| Logger flush → LogPersistence → AsyncStorage | flush 后 AsyncStorage 有数据 |
| Logger flush → RemoteTransport → ApiClient | flush 后 POST /logs/batch 被调用 |

### E2E 测试

| 场景 | 验证点 |
|------|--------|
| Debug 构建正常启动 | 应用正常渲染，logcat 中可见 BOOT 日志 |
| Release 构建正常启动 | 应用正常渲染，白色背景（非深灰色） |
| Release 构建 App 导入失败 | BootErrorScreen 显示，错误信息可读 |
| HarmonyOS 暗色模式启动 | 白色背景（非深灰色），REQ-12.3 |
| 网络可用时日志上传 | POST /logs/batch 收到日志 |
| 网络不可用时日志上传失败 | 应用不受影响，重试 3 次后放弃 |

### 兼容性测试

| 环境 | 验证点 |
|------|--------|
| Hermes 引擎（Release） | console.error 被 logcat 捕获 |
| 华为 Nova 9 / HarmonyOS | 暗色模式下白色背景 |
| TypeScript tsc --noEmit | 退出码 0，无类型错误（NFR-4.1） |
| AsyncStorage 未安装 | 降级为纯内存模式，不崩溃 |

---

## 正确性属性（用于属性测试）

1. **Logger.liveness**：对于任意 `logger.xxx()` 调用，方法必定返回（不抛异常、不 hang）。
2. **Buffer.bounded**：`logger.getBuffer().length` 始终 `<= bufferSize`（默认 500）。
3. **Buffer.orderPreserving**：`getBuffer()` 返回的条目按写入时间单调递增。
4. **LevelFilter.monotonic**：`minLevel` 设为 L 时，缓冲区和 console 中不存在 `level < L` 的条目。
5. **TokenRedaction.complete**：`redactAuthorization(h)` 的结果中，`Authorization` 值不含原始 token 的任何非前缀子串。
6. **Persistence.nonBlocking**：`LogPersistence.init()` 和 `save()` 不抛异常，失败时降级而非崩溃。
7. **RemoteTransport.silentFailure**：`handleFlush()` 在网络完全不可用时，不抛异常、不影响调用方。
8. **BootDiagnostics.fallback**：当 `require('./App')` 抛异常时，`Root` 组件渲染 BootErrorScreen 而非 null。

---

## Out of Scope（不做什么）

1. **后端日志接收接口实现** — `{API_ROOT}/logs/batch` 端点已存在，本 WI 不涉及后端开发。
2. **日志可视化 Web 后台** — 运维查看日志的方式不在本 WI 范围。
3. **iOS 平台适配** — 仅针对 Android（HarmonyOS），iOS 主题和 BootErrorScreen 行为可能不同。
4. **日志搜索/过滤 UI** — ProfileScreen 中的日志查看按钮是可选的低优先级功能，不在核心 REQ 中。
5. **结构化日志查询语言** — 日志为非结构化文本 + 可选 JSON data，不支持类 SQL 查询。
6. **日志加密存储** — AsyncStorage 中的日志为明文 JSON，不做加密（设备本地存储，物理安全由 OS 保证）。
7. **日志轮转/清理** — AsyncStorage 中的 `@fj_logs_buffer` 每次覆盖写入，不做多代轮转。
8. **WebSocket 实时日志推送** — 仅支持 HTTP 批量上传，不支持实时流。
9. **日志采样** — 所有符合条件的日志全量记录，不做采样降频。
10. **多进程日志** — 仅主 JS 线程日志，不覆盖原生层（Java/Kotlin）日志。

---

## Assumptions（设计假设）

1. **假设 `ErrorUtils.setGlobalHandler` 在 React Native 0.74+ Hermes 引擎中可用** — 这是 RN 运行时标准 API，已在现有项目中隐式依赖。
2. **假设 `@react-native-async-storage/async-storage` 可能已安装** — 设计支持条件加载，未安装时降级为纯内存模式。需在实现阶段确认 package.json。
3. **假设 `@react-native-clipboard/clipboard` 可能已安装** — BootErrorScreen 条件加载，未安装时隐藏复制按钮。
4. **假设后端 `POST /logs/batch` 端点已实现并接受 `{ entries: LogEntry[] }` 格式** — 根据 intake.md 说明，该端点已存在。
5. **假设 ApiClient 实例在 AuthContext 中创建并可被 RemoteTransport 获取** — RemoteTransport 注册延迟到 AuthContext useEffect，需要从 useAuth() 获取 apiClient。
6. **假设 Hermes 引擎在 Release 构建中将 `console.error` 输出到 logcat** — 这是 RN/Hermes 标准行为。
7. **假设 `Theme.AppCompat.Light.NoActionBar` 在目标 Android compileSdkVersion 中可用** — AppCompat 是标准 AndroidX 库，已在项目中使用。
8. **假设单条日志平均大小 ≤ 512 字节** — 用于内存预算估算（500 × 512B = 256KB）。超长 message/data 不做截断（由调用方控制）。
9. **假设应用并发日志量低（< 100 条/秒）** — 日志系统不是高频写入场景，环形缓冲区 + 同步写入不会成为性能瓶颈。
10. **假设华为 Nova 9 / HarmonyOS 的暗色模式可通过 values-night 覆盖** — Android 标准暗色模式机制，HarmonyOS 兼容 Android 主题系统。

---

## 配置点清单

| 配置项 | 标记 | 默认值 | 位置 | REQ |
|--------|------|--------|------|-----|
| 环形缓冲区容量 | `bufferSize` | 500 | LoggerConfig | REQ-2.1 |
| Flush 触发阈值 | `flushThreshold` | 0.8 (80%) | LoggerConfig | REQ-2.5 |
| 启动加载历史条数 | `loadPreviousEntries` | 100 | LogPersistence constructor | REQ-3.2 |
| 上传防抖间隔 | `uploadDebounceMs` | 30000 (30s) | RemoteTransportConfig | REQ-4.5 |
| 单次上传最大条数 | `batchSize` | 100 | RemoteTransportConfig | DD-5 |
| 最大重试次数 | `maxRetries` | 3 | RemoteTransportConfig | REQ-4.6 |
| 退避基数 | `backoffBaseMs` | 2000 (2s) | RemoteTransportConfig | DD-5 |
| AsyncStorage 键 | `key` | `@fj_logs_buffer` | LogPersistence | REQ-3.3 |
| 上传端点 | `uploadPath` | `/logs/batch` | RemoteTransport constructor | REQ-4.1 |

---

## 好架构 5 属性自检

### A1 单一职责

| 组件 | "我是 X" 陈述 | ✅/❌ |
|------|---------------|-------|
| Logger | 我是日志记录器，负责接收日志、存储到缓冲区、分发给 transport | ✅ 一句话说清 |
| ConsoleTransport | 我是控制台输出策略，负责把日志格式化输出到 console | ✅ |
| RemoteTransport | 我是远程上传策略，负责防抖、批量、重试上传日志到服务器 | ✅ |
| LogPersistence | 我是本地持久化策略，负责 AsyncStorage 读写和降级 | ✅ |
| BootErrorScreen | 我是启动失败降级 UI，负责在屏幕上显示错误信息 | ✅ |
| installGlobalErrorHandler | 我是全局错误捕获器，负责把未捕获异常记录到 Logger | ✅ |
| redactAuthorization | 我是 token 脱敏函数，负责把 Authorization 头中的 token 替换为 *** | ✅ |

### A2 显式依赖

Mermaid 架构图已包含所有组件间的箭头：
- index.js → Logger, BootErrorScreen, installGlobalErrorHandler
- Logger → RingBuffer, Transports
- Transports → ConsoleTransport, RemoteTransport
- RemoteTransport → ApiClient（通过 LogUploadClient 端口）
- LogPersistence → AsyncStorage（条件依赖）
- App/AppRoot/AuthContext/ApiClient/SyncEngine/Screens → Logger

**验证**：代码中所有 import/call 关系在图中均有对应箭头。 ✅

### A3 可替换性

| 组件 | Interface | 调用方依赖 interface？ | Mock 可行？ |
|------|-----------|------------------------|-------------|
| LogTransport | `LogTransport` | Logger 依赖 interface | ✅ 可注入 MockTransport |
| LogPersistence | `ILogPersistence` | Logger flush listener 依赖 interface | ✅ 可注入 MemoryPersistence |
| LogUploadClient | `LogUploadClient` | RemoteTransport 依赖 interface | ✅ 可注入 MemoryLogUploadClient |
| Logger | 具名单例 `logger` | 所有调用方依赖单例 | ⚠️ 单例不可 mock，但 getBuffer() 可验证 |

**验证**：所有可替换组件均有 interface 定义，调用方依赖 interface 而非具体 class。 ✅

### A4 失败可观测

| 组件 | 失败路径 | 事件/日志/异常落点 |
|------|----------|---------------------|
| Logger.xxx | 内部异常 | try-catch 吞掉（NFR-3.2），不观测（设计决策：日志不应产生日志） |
| ConsoleTransport | format 失败 | 降级为 `[unserializable]` |
| RemoteTransport | 上传失败 | 重试 3 次后放弃，条目从 pending 移除 |
| LogPersistence | 读写失败 | console.warn（内存模式），静默（写入失败） |
| installGlobalErrorHandler | 安装失败 | 静默跳过 |
| BootErrorScreen | Clipboard 不可用 | 隐藏复制按钮 |
| ApiClient | 请求失败 | logger.warn/error 记录到缓冲区 |

**验证**：每条失败路径都有明确处理策略。 ✅

### A5 边界明确

- **Out of Scope** 段：10 项明确"不做什么"。 ✅
- **Assumptions** 段：10 项明确"假设什么"。 ✅

---

## 文件清单（实现阶段产出）

| 文件路径 | 操作 | DD | REQ |
|----------|------|-----|-----|
| `fj-android/src/utils/Logger.ts` | 新建 | DD-1, DD-4, DD-9, DD-11 | REQ-1, REQ-2, REQ-6 |
| `fj-android/src/utils/RemoteTransport.ts` | 新建 | DD-5 | REQ-4 |
| `fj-android/src/utils/LogPersistence.ts` | 新建 | DD-6 | REQ-3 |
| `fj-android/src/utils/redact.ts` | 新建 | DD-8 | REQ-9.4 |
| `fj-android/src/components/BootErrorScreen.tsx` | 新建 | DD-3 | REQ-5.3 |
| `fj-android/src/types/globals.d.ts` | 新建 | DD-9 | REQ-6 |
| `fj-android/index.js` | 修改 | DD-2, DD-11 | REQ-5, REQ-6 |
| `fj-android/App.tsx` | 修改 | DD-7 | REQ-7.1 |
| `fj-android/src/AppRoot.tsx` | 修改 | DD-7 | REQ-7.2-7.4 |
| `fj-android/src/store/auth/AuthContext.tsx` | 修改 | DD-7 | REQ-8 |
| `fj-android/src/api/ApiClient.ts` | 修改 | DD-7, DD-8 | REQ-9 |
| `fj-android/src/api/SyncEngine.ts` | 修改 | DD-7 | REQ-10 |
| `fj-android/src/screens/**/*.tsx` | 修改 | DD-7 | REQ-11 |
| `fj-android/android/app/src/main/res/values/styles.xml` | 修改 | DD-10 | REQ-12.1 |
| `fj-android/android/app/src/main/res/values-night/styles.xml` | 新建 | DD-10 | REQ-12.2 |
