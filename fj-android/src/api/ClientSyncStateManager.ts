/**
 * ClientSyncStateManager — 客户端同步状态管理
 *
 * 设计依据：WI-0001 / DD-6.1 / §101.28 ClientSyncState
 *
 * 职责：
 *  - 管理 last_server_seq（增量拉取游标，§6.2）：从持久化存储读写
 *  - 管理 last_synced_at（最近成功同步时间，用于 UI 展示）
 *  - 同步锁（互斥）：防止 pull / push 并发执行导致 server_seq 回退或脏写
 *
 * 持久化端口（KeyValueStorage）：
 *  - 生产实现基于 @react-native-async-storage/async-storage；
 *  - 通过依赖注入避免硬编码原生模块，便于单测用内存实现替换。
 *
 * 命名空间：
 *  - 同步状态键按 projectId 命名空间隔离，支持多项目切换。
 */
import type { LocalTableName } from '../store/schema';

/**
 * 键值存储接口（AsyncStorage 注入端口）。
 * 签名与 @react-native-async-storage/async-storage 对齐。
 */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** 同步状态键前缀 */
const SYNC_KEY_PREFIX = 'fj.sync';
/** 默认项目命名空间（未指定 projectId 时使用） */
const DEFAULT_PROJECT_NS = '_global';

/**
 * 同步状态管理器。
 *
 * @example
 * const mgr = new ClientSyncStateManager(asyncStorage, 'P001');
 * await mgr.setLastServerSeq(12345);
 * const seq = await mgr.getLastServerSeq(); // 12345
 */
export class ClientSyncStateManager {
  private readonly storage: KeyValueStorage;
  private readonly projectNs: string;

  /** 同步互斥锁：串行化所有同步操作 */
  private lockChain: Promise<void> = Promise.resolve();
  /** 是否正在同步中（供 UI 查询） */
  private syncing = false;

  constructor(storage: KeyValueStorage, projectId?: string) {
    this.storage = storage;
    this.projectNs = projectId ?? DEFAULT_PROJECT_NS;
  }

  /** last_server_seq 的存储键 */
  private get lastServerSeqKey(): string {
    return `${SYNC_KEY_PREFIX}.${this.projectNs}.last_server_seq`;
  }

  /** last_synced_at 的存储键 */
  private get lastSyncedAtKey(): string {
    return `${SYNC_KEY_PREFIX}.${this.projectNs}.last_synced_at`;
  }

  /**
   * 读取 last_server_seq（增量拉取游标）。
   * @returns 上次拉取到的最大 server_seq；从未同步过返回 0。
   */
  async getLastServerSeq(): Promise<number> {
    const raw = await this.storage.getItem(this.lastServerSeqKey);
    if (raw === null || raw === undefined) {
      return 0;
    }
    const seq = Number(raw);
    return Number.isFinite(seq) ? seq : 0;
  }

  /**
   * 直接设置 last_server_seq。
   * 注意：通常应使用 updateLastServerSeq（取 max，防止回退）。
   */
  async setLastServerSeq(seq: number): Promise<void> {
    if (!Number.isFinite(seq) || seq < 0) {
      throw new Error(`ClientSyncStateManager: 非法的 server_seq=${seq}`);
    }
    await this.storage.setItem(this.lastServerSeqKey, String(seq));
  }

  /**
   * 更新 last_server_seq（仅当新值更大时才写入，防止回退）。
   * @returns 更新后的 last_server_seq
   */
  async updateLastServerSeq(seq: number): Promise<number> {
    const current = await this.getLastServerSeq();
    const next = Math.max(current, seq);
    if (next !== current) {
      await this.setLastServerSeq(next);
    }
    return next;
  }

  /** 读取最近一次成功同步时间戳（毫秒）；从未同步返回 null */
  async getLastSyncedAt(): Promise<number | null> {
    const raw = await this.storage.getItem(this.lastSyncedAtKey);
    if (raw === null || raw === undefined) {
      return null;
    }
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : null;
  }

  /** 记录最近一次成功同步时间为当前时刻（毫秒） */
  async markSyncedNow(): Promise<void> {
    await this.storage.setItem(this.lastSyncedAtKey, String(Date.now()));
  }

  /** 清除当前项目的同步状态（用户切换项目 / 登出时调用） */
  async clear(): Promise<void> {
    await this.storage.removeItem(this.lastServerSeqKey);
    await this.storage.removeItem(this.lastSyncedAtKey);
  }

  /**
   * 同步锁：串行化执行同步操作。
   *
   * 同一时刻只允许一个 pull/push 执行，避免并发导致：
   *  - last_server_seq 回退
   *  - 同一批 dirty record 被重复 push
   *  - WatermelonDB 写入冲突
   *
   * @param fn - 受保护的异步操作
   * @returns fn 的返回值
   */
  async withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
    // 排到锁链末尾，等待前一个操作完成
    const previous = this.lockChain;
    let release!: () => void;
    this.lockChain = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    this.syncing = true;
    try {
      return await fn();
    } finally {
      this.syncing = false;
      release();
    }
  }

  /** 是否正在同步中（供 UI 展示 loading） */
  isSyncing(): boolean {
    return this.syncing;
  }
}

/**
 * 各本地表的 dirty 记录数计数键（可选：用于 UI 展示"待同步 N 条"）。
 * 此处仅提供键名约定，具体计数由上层业务维护。
 */
export function dirtyCountKey(projectId: string | undefined, table: LocalTableName): string {
  return `${SYNC_KEY_PREFIX}.${projectId ?? DEFAULT_PROJECT_NS}.dirty_count.${table}`;
}
