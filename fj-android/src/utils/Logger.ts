/**
 * Logger — 飞检安卓端统一日志模块（WI-0028）
 *
 * 设计依据：日志系统核心模块 / 离线日志缓冲 / 全局异常兜底
 *
 * 职责：
 *  - 提供分级日志（DEBUG / INFO / WARN / ERROR），低于 minLevel 的日志被丢弃
 *  - 维护一个容量 500 的环形日志缓冲（ring buffer），供后续上传 / 导出
 *  - 缓冲超过 400 条时触发 flush（远程上传占位，后续 WI 接入）
 *  - 所有日志操作包裹在 try-catch 中：Logger 永不抛出，避免日志本身导致崩溃
 *  - installGlobalErrorHandler：接管 RN 全局未捕获异常，DEV 保留红框、Release 仅入缓冲
 *
 * 零 npm 依赖：仅使用 RN 运行时全局（__DEV__ / ErrorUtils / console / Date）。
 *
 * 类型说明：
 *  __DEV__ 与 ErrorUtils 已由 react-native 类型
 *  （node_modules/react-native/types/index.d.ts）作为全局 `declare global` 提供。
 *  本文件不再重复 declare global，否则会触发 TS2300 redeclare 错误。
 */

import { LogPersistenceManager } from './LogPersistence';

/** 日志级别（数值越大优先级越高）。 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/** 单条日志的结构化记录。 */
export interface LogEntry {
  /** ISO 8601 时间戳（new Date().toISOString()） */
  timestamp: string;
  /** 日志级别 */
  level: LogLevel;
  /** 来源模块名（用于过滤 / 归类） */
  module: string;
  /** 日志正文 */
  message: string;
  /** 可选附加数据（任意结构，原样保留） */
  data?: unknown;
}

/** 环形缓冲最大容量（超出后丢弃最旧条目）。 */
const MAX_BUFFER_SIZE = 500;

/** 触发 flush 的缓冲阈值（缓冲长度超过该值即调用 flush）。 */
const FLUSH_THRESHOLD = 400;

/** LogLevel -> 显示名（用于 console 输出前缀）。按 enum 数值顺序索引。 */
const LEVEL_NAMES: readonly string[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

/**
 * 飞检统一日志器（单例）。
 *
 * 使用：
 * ```ts
 * import { logger } from '../utils/Logger';
 * logger.info('SyncEngine', 'start full sync', { count: 12 });
 * ```
 *
 * 不变性：
 *  - 任何对外方法（debug/info/warn/error/getBuffer/clearBuffer/flush）均不抛异常。
 *  - buffer 长度恒 ≤ MAX_BUFFER_SIZE。
 */
export class Logger {
  private static instance: Logger;

  /** 最低输出级别：DEV 全量（DEBUG），Release 仅 INFO 及以上。 */
  private minLevel: LogLevel = __DEV__ ? LogLevel.DEBUG : LogLevel.INFO;

  /** 日志环形缓冲（最新追加到末尾，超出容量从头部丢弃）。 */
  private buffer: LogEntry[] = [];

  /** 持久化管理器（懒加载）：组合 RemoteLogTransport + LocalPersistence（WI-0029）。 */
  private persistenceManager: LogPersistenceManager | null = null;

  /** 周期 flush 定时器句柄；null 表示未启动。 */
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  /** 私有构造：保证全局唯一实例（单例）。 */
  private constructor() {}

  /** 单例获取：首次调用创建实例，后续直接返回缓存实例。 */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
      // 启动周期 flush 定时器（5s）；setup 内部已 try-catch，永不抛出
      Logger.instance.startPeriodicFlush();
    }
    return Logger.instance;
  }

  // ---- 分级日志 API -------------------------------------------------------

  debug(module: string, message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, module, message, data);
  }

  info(module: string, message: string, data?: unknown): void {
    this.log(LogLevel.INFO, module, message, data);
  }

  warn(module: string, message: string, data?: unknown): void {
    this.log(LogLevel.WARN, module, message, data);
  }

  error(module: string, message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, module, message, data);
  }

  // ---- 缓冲管理 -----------------------------------------------------------

  /** 返回缓冲的浅拷贝（调用方可安全遍历 / 序列化，不影响内部缓冲）。 */
  getBuffer(): LogEntry[] {
    return this.buffer.slice();
  }

  /** 清空缓冲。 */
  clearBuffer(): void {
    this.buffer = [];
  }

  /**
   * Flush buffered logs to remote server.
   * Called automatically when buffer reaches threshold, or by periodic timer.
   */
  flush(): void {
    try {
      const manager = this.ensurePersistenceManager();
      if (manager && this.buffer.length > 0) {
        const snapshot = [...this.buffer];
        void manager.flushToRemote(snapshot).catch(() => {});
      }
    } catch {
      // flush must never throw
    }
  }

  // ---- 内部实现 -----------------------------------------------------------

  /**
   * 懒加载持久化管理器：首次调用时构造 LogPersistenceManager。
   * 构造失败（如依赖缺失）时降级为 null，flush 静默跳过，永不抛出。
   */
  private ensurePersistenceManager(): LogPersistenceManager | null {
    if (this.persistenceManager === null) {
      try {
        this.persistenceManager = new LogPersistenceManager();
      } catch {
        this.persistenceManager = null;
      }
    }
    return this.persistenceManager;
  }

  /**
   * 启动周期 flush 定时器（每 5 秒触发一次 flush）。
   * 幂等：已启动时直接返回；setup 失败永不抛出。
   */
  private startPeriodicFlush(): void {
    if (this.flushTimer !== null) return;
    try {
      this.flushTimer = setInterval(() => {
        this.flush();
      }, 5000);
    } catch {
      // timer setup must never throw
    }
  }

  /**
   * 统一日志写入核心。
   * 全流程包裹 try-catch：任何环节（时间戳生成 / 缓冲操作 / console）失败均被吞掉，
   * 保证 Logger 永不导致调用方崩溃。
   */
  private log(level: LogLevel, module: string, message: string, data?: unknown): void {
    try {
      // 1. 级别过滤：低于 minLevel 直接跳过
      if (level < this.minLevel) {
        return;
      }

      // 2. 构造日志条目（ISO 时间戳）
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        module,
        message,
        data,
      };

      // 3. 入缓冲（环形：超出容量丢弃最旧条目）
      this.buffer.push(entry);
      if (this.buffer.length > MAX_BUFFER_SIZE) {
        this.buffer.shift();
      }

      // 4. console 输出（格式：[LEVEL] [module] message + 可选 data）
      this.writeToConsole(level, entry);

      // 5. 缓冲超过阈值则触发 flush
      if (this.buffer.length > FLUSH_THRESHOLD) {
        this.flush();
      }

      // 6. ERROR 级别立即 flush（崩溃前必须上传，不等定时器）
      if (level === LogLevel.ERROR) {
        this.flush();
      }
    } catch {
      // Logger 永不抛出
    }
  }

  /** 按级别选择 console 方法并输出格式化日志。 */
  private writeToConsole(level: LogLevel, entry: LogEntry): void {
    const prefix = `[${LEVEL_NAMES[level]}] [${entry.module}] ${entry.message}`;
    switch (level) {
      case LogLevel.DEBUG:
        if (entry.data !== undefined) {
          console.log(prefix, entry.data);
        } else {
          console.log(prefix);
        }
        break;
      case LogLevel.INFO:
        if (entry.data !== undefined) {
          console.info(prefix, entry.data);
        } else {
          console.info(prefix);
        }
        break;
      case LogLevel.WARN:
        if (entry.data !== undefined) {
          console.warn(prefix, entry.data);
        } else {
          console.warn(prefix);
        }
        break;
      case LogLevel.ERROR:
        if (entry.data !== undefined) {
          console.error(prefix, entry.data);
        } else {
          console.error(prefix);
        }
        break;
      // 无 default：enum 仅 4 个值，均已覆盖
    }
  }
}

/** 全局日志单例（应用内统一通过此实例记录日志）。 */
export const logger = Logger.getInstance();

/**
 * 安装 React Native 全局未捕获异常处理器。
 *
 * 行为：
 *  - 使用 ErrorUtils.setGlobalHandler 接管所有未捕获 JS 异常
 *  - 异常被记录到 logger 缓冲并输出到 console
 *  - DEV：保留默认处理器行为（红框 / LogBox），便于开发期即时发现
 *  - Release：不再调用默认处理器（抑制红框），仅入缓冲等待后续上传
 *
 * 安装过程包裹 try-catch，永不抛出。
 * 幂等性说明：重复安装会捕获上一次（首次为默认红框）处理器并链式调用，
 * DEV 下红框仍可正常显示。
 */
export function installGlobalErrorHandler(): void {
  try {
    // 在覆盖前捕获当前处理器（默认为 RN 红框 / LogBox 处理器）
    const previousHandler = ErrorUtils.getGlobalHandler();

    ErrorUtils.setGlobalHandler((error, isFatal) => {
      // 记录到缓冲 + console（logger.error 内部已 try-catch）
      logger.error(
        'GlobalErrorHandler',
        isFatal ? 'Fatal uncaught exception' : 'Uncaught exception',
        error,
      );

      if (__DEV__) {
        // DEV：委托给原默认处理器，保留红框行为
        try {
          previousHandler(error, isFatal);
        } catch {
          // 委托失败不抛出
        }
      }
      // Release：红框已被抑制，异常仅留在缓冲中等待上传
    });
  } catch {
    // 安装失败永不抛出
  }
}
