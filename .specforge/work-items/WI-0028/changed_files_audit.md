# Changed Files Audit

Work Item: WI-0028
Command: Logger system + boot diagnostics + theme fix + Release build
Timestamp: 2026-07-06T07:04:48.472Z
Data Source: debug_hint.actual_changed_files (deprecated fallback; not a trusted Runtime source)
Policy Source: hard_stop_resolution.jsonl (1) + write_guard_authorizations.jsonl (27)

## Result: PASS

- Total files: 10
- In scope: 10
- Out of scope: 0
- Violations: 0
- Remote ops entries: 0
- Blocked write attempts: 4
- Historical/resolved blocked write attempts: 4
- Authorization-resolved blocked write attempts: 1
- Unresolved blocked write attempts: 0

## Remote Ops Entries

None.

## Blocked Write Attempts

- Total blocked write attempts: 4
- Historical/resolved: 4
- Authorization-resolved: 1
- Unresolved: 0
- Hard stop resolutions: 1
- Project-level write_guard authorizations: 27

### Historical / Resolved Blocked Writes

- [create] /**
 * LogPersistence — 飞检安卓端日志持久化模块（WI-0028 TASK-2）
 *
 * 设计依据：日志系统持久化层 / 离线日志缓冲 / 远程批量上传
 *
 * 职责：
 *  - RemoteLogTransport：通过 fetch POST 到后端 /logs/batch，静默失败
 *  - LocalPersistence：基于 AsyncStorage 的本地缓冲持久化（缺失时优雅降级）
 *  - LogPersistenceManager：组合上述两者，提供 30s 防抖批量上传
 *
 * 零硬依赖：
 *  - AsyncStorage 通过动态 require 加载；缺失 / 不可用时 hasAsyncStorage=false，
 *    相关方法静默返回，不抛出
 *  - fetch 为 RN 运行时全局，无需 import
 *  - 不依赖 ApiClient，避免循环依赖（与 ApiClient 解耦）
 *
 * 不变性：
 *  - 所有公开方法均为 async 且永不抛出（内部 try-catch 兜底）
 *  - upload / save / load / scheduleFlush 任何场景下都不会导致调用方崩溃
 */

import type { LogEntry } from './Logger';
import { API_ROOT } from '../config/AppConfig';

/** 远程日志批量上传端点（API_ROOT + '/logs/batch'）。 */
const REMOTE_LOG_ENDPOINT = `${API_ROOT}/logs/batch`;

/** 本地 AsyncStorage 缓冲键名。 */
const LOCAL_STORAGE_KEY = '@fj_logs_buffer';

/** scheduleFlush 防抖延迟（毫秒）。 */
const FLUSH_DEBOUNCE_MS = 30_000;

/ ---- AsyncStorage 动态加载（优雅降级）-------------------------------------
/
/ AsyncStorage 为可选依赖：未安装 / 运行时不可用时降级为 hasAsyncStorage=false。
/ require 由 metro bundler 在运行时支持，包裹 try-catch 以兼容未安装场景。

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */
/** 动态加载的 AsyncStorage 模块（可能为 null）。 */
let asyncStorage: any = null;
/** AsyncStorage 是否可用（运行时探测结果）。 */
let hasAsyncStorage = false;

try {
  / 动态 require：模块缺失时抛出，被 catch 捕获后降级
  const mod: any = require('@react-native-async-storage/async-storage');
  / RN 包通常 export default；兼容 module.exports = AsyncStorage 的旧式导出
  asyncStorage = mod?.default ?? mod ?? null;
  hasAsyncStorage = asyncStorage != null && typeof asyncStorage.setItem === 'function';
} catch {
  hasAsyncStorage = false;
  asyncStorage = null;
}
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */

/ ---- RemoteLogTransport ---------------------------------------------------

/**
 * 远程日志传输：通过 fetch 将日志批量 POST 到后端 /logs/batch。
 *
 * 设计：
 *  - 直接使用 fetch（不依赖 ApiClient，避免循环依赖）
 *  - 静默失败：网络错误 / 非 2xx 响应均被捕获，仅 console.warn
 *  - 永不抛出：upload 始终 resolve（void），不 reject
 */
export class RemoteLogTransport {
  /** 日志上传目标 URL。 */
  private readonly endpoint: string;

  /**
   * @param endpoint 日志上传 URL；默认使用 REMOTE_LOG_ENDPOINT（来自 AppConfig）
   */
  constructor(endpoint: string = REMOTE_LOG_ENDPOINT) {
    this.endpoint = endpoint;
  }

  /**
   * 批量上传日志到后端。
   *
   * @param entries 待上传的日志条目数组；空数组直接返回
   * @returns 永不 reject；失败时仅 console.warn
   */
  async upload(entries: LogEntry[]): Promise<void> {
    try {
      if (!entries || entries.length === 0) {
        return;
      }

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entries),
      });

      if (!response.ok) {
        console.warn(
          `[RemoteLogTransport] upload non-OK status: ${response.status} ${response.statusText}`,
        );
      }
    } catch (err) {
      / 静默失败：网络错误 / 序列化错误均不抛出
      console.warn('[RemoteLogTransport] upload failed:', err);
    }
  }
}

/ ---- LocalPersistence ----------------------------------------------------

/**
 * 本地日志持久化：基于 AsyncStorage 的 JSON 缓冲存储。
 *
 * 优雅降级：AsyncStorage 不可用时（hasAsyncStorage=false），
 * save / load / clear 均静默返回，不抛出。
 */
export class LocalPersistence {
  /** AsyncStorage 缓冲键名。 */
  private readonly storageKey: string;

  constructor(storageKey: string = LOCAL_STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  /** AsyncStorage 是否可用（运行时探测结果）。 */
  isAvailable(): boolean {
    return hasAsyncStorage;
  }

  /**
   * 将日志条目数组 JSON.stringify 后保存到 AsyncStorage。
   *
   * @param entries 待保存的日志条目；不可用时静默返回
   */
  async save(entries: LogEntry[]): Promise<void> {
    try {
      if (!hasAsyncStorage || asyncStorage == null) {
        return;
      }
      const payload = JSON.stringify(entries);
      await asyncStorage.setItem(this.storageKey, payload);
    } catch (err) {
      console.warn('[LocalPersistence] save failed:', err);
    }
  }

  /**
   * 从 AsyncStorage 加载并解析日志条目数组。
   *
   * @returns 解析成功返回 LogEntry[]；不可用 / 解析失败 / 空键 / 非数组均返回 []
   */
  async load(): Promise<LogEntry[]> {
    try {
      if (!hasAsyncStorage || asyncStorage == null) {
        return [];
      }
      const raw = await asyncStorage.getItem(this.storageKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed as LogEntry[];
    } catch (err) {
      console.warn('[LocalPersistence] load failed:', err);
      return [];
    }
  }

  /** 清空本地缓冲（辅助方法；不可用时静默返回）。 */
  async clear(): Promise<void> {
    try {
      if (!hasAsyncStorage || asyncStorage == null) {
        return;
      }
      await asyncStorage.removeItem(this.storageKey);
    } catch (err) {
      console.warn('[LocalPersistence] clear failed:', err);
    }
  }
}

/ ---- LogPersistenceManager ------------------------------------------------

/**
 * 日志持久化管理器：组合 RemoteLogTransport + LocalPersistence，
 * 提供 30s 防抖批量上传能力。
 *
 * 典型用法：
 * ```ts
 * const manager = new LogPersistenceManager();
 * / 每次 logger 写入后调度一次 flush（30s 内多次调用合并为一次）
 * manager.scheduleFlush(() => logger.getBuffer());
 * ```
 *
 * 不变性：scheduleFlush / cancelScheduledFlush 永不抛出。
 */
export class LogPersistenceManager {
  private readonly remoteTransport: RemoteLogTransport;
  private readonly localPersistence: LocalPersistence;

  /** 防抖定时器句柄；null 表示无待执行的 flush。 */
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    remoteTransport: RemoteLogTransport = new RemoteLogTransport(),
    localPersistence: LocalPersistence = new LocalPersistence(),
  ) {
    this.remoteTransport = remoteTransport;
    this.localPersistence = localPersistence;
  }

  /** 上传日志条目到远程（静默失败）。 */
  async flushToRemote(entries: LogEntry[]): Promise<void> {
    try {
      await this.remoteTransport.upload(entries);
    } catch (err) {
      / 兜底：upload 内部已捕获，此处仅为双保险
      console.warn('[LogPersistenceManager] flushToRemote failed:', err);
    }
  }

  /** 保存日志条目到本地 AsyncStorage（静默失败）。 */
  async saveToLocal(entries: LogEntry[]): Promise<void> {
    try {
      await this.localPersistence.save(entries);
    } catch (err) {
      console.warn('[LogPersistenceManager] saveToLocal failed:', err);
    }
  }

  /** 从本地 AsyncStorage 加载日志条目（失败返回 []）。 */
  async loadFromLocal(): Promise<LogEntry[]> {
    try {
      return await this.localPersistence.load();
    } catch (err) {
      console.warn('[LogPersistenceManager] loadFromLocal failed:', err);
      return [];
    }
  }

  /**
   * 调度一次防抖 flush：30s 内多次调用仅触发一次远程上传。
   *
   * @param getEntries 获取待上传日志的回调（在 flush 真正触发时调用，
   *                   保证拿到最新缓冲快照，而非调度时刻的快照）
   */
  scheduleFlush(getEntries: () => LogEntry[]): void {
    try {
      / 取消已挂起的定时器，重新计时（防抖语义）
      if (this.flushTimer !== null) {
        clearTimeout(this.flushTimer);
      }
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        try {
          const entries = getEntries();
          / 异步上传，不阻塞定时器回调；错误在 flushToRemote 内部已捕获
          void this.flushToRemote(entries).catch(() => {
            / 双保险：flushToRemote 已 try-catch，此处仅为满足 Promise 链
          });
        } catch (err) {
          console.warn('[LogPersistenceManager] scheduled flush callback failed:', err);
        }
      }, FLUSH_DEBOUNCE_MS);
    } catch (err) {
      console.warn('[LogPersistenceManager] scheduleFlush failed:', err);
    }
  }

  /** 取消已挂起的防抖 flush（如应用退出 / 模块卸载时调用）。 */
  cancelScheduledFlush(): void {
    try {
      if (this.flushTimer !== null) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
      }
    } catch {
      / 取消失败永不抛出
    }
  }
}
 → write_guard_authorization_resolved (Blocked attempt is covered by project-level write_guard_authorizations.jsonl entry authorization_id=AUTH-1783272709784. The attempt remains visible, but this scoped authorization prevents it from being treated as unresolved.)
- [modify] /root/.gradle/gradle.properties → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [modify] /build/build-wi28.log → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [delete] fjw28 → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)

### Unresolved Blocked Writes

None.

## Entries

- [modify] fj-android/src/utils/Logger.ts → in_scope
- [modify] fj-android/src/utils/LogPersistence.ts → in_scope
- [modify] fj-android/src/components/BootErrorScreen.tsx → in_scope
- [modify] fj-android/index.js → in_scope
- [modify] fj-android/App.tsx → in_scope
- [modify] fj-android/src/AppRoot.tsx → in_scope
- [modify] fj-android/src/store/auth/AuthContext.tsx → in_scope
- [modify] fj-android/src/api/ApiClient.ts → in_scope
- [modify] fj-android/android/app/src/main/res/values/styles.xml → in_scope
- [modify] fj-android/android/app/src/main/res/values-night/styles.xml → in_scope
