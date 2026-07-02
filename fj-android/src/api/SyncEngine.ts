/**
 * SyncEngine — 飞检安卓端增量同步引擎
 *
 * 设计依据：WI-0001 / DD-6 安卓离线同步协议 / §6.2 增量拉取 / §6.3 推送幂等 / §6.5 冲突检测
 *
 * 职责：
 *  - pull：增量拉取服务端变更（GET /api/v1/sync/pull?since=...&limit=200），
 *          分页循环直至 has_more=false，将变更批量写入本地库，并推进 last_server_seq。
 *  - push：批量推送本地 dirty 记录（sync_status='pending_push'），
 *          每条记录携带 client_uuid 实现幂等去重（§6.3），整批携带 client_batch_uuid。
 *  - fullSync：组合同步——先 push 本地变更，再 pull 服务端增量（避免新变更被旧快照覆盖）。
 *  - 冲突处理：服务端返回 4002/4003/4004（§6.5 三类冲突）时，将本地记录标记为
 *          sync_status='conflict'，V1 不做自动合并，交由 UI 人工裁决（§103.1 第4条）。
 *
 * 依赖关系（全部通过构造注入，便于单测）：
 *  - ApiClient：HTTP 通道（鉴权 / 超时 / 401 刷新 / 统一响应解析）
 *  - ClientSyncStateManager：last_server_seq 持久化 + 同步互斥锁
 *  - SyncDatabasePort：本地库读写端口（解耦 WatermelonDB，便于单测用内存实现替换）
 *
 * 同步互斥：所有 pull / push / fullSync 均在 syncStateManager.withSyncLock 内执行，
 *          避免并发导致 last_server_seq 回退或同一批 dirty 重复推送。
 *
 * 幂等性（§6.3）：
 *  - client_batch_uuid：每批生成，服务端据此去重整批（SyncBatch 幂等）。
 *  - client_uuid：每条记录携带，服务端据此 upsert 去重。
 *  - 网络重试由 ApiClient 内部 401 刷新覆盖；业务层重试（同一 batch 重新 push）天然幂等，
 *    因 client_batch_uuid 不变。
 */
import type { ApiClient } from './ApiClient';
import type { ClientSyncStateManager } from './ClientSyncStateManager';
import type { LocalTableName } from '../store/schema';

// ============== 同步状态字符串常量（与 schema.ts / §6 契约一致）==============
/** 已与服务端一致 */
const SYNC_STATUS_SYNCED = 'synced';
/** 本地有未推送变更（pull 写入的新记录也短暂处于该态直到置 synced） */
const SYNC_STATUS_CONFLICT = 'conflict';

// ============== 端点 ==============
const PULL_PATH = '/api/v1/sync/pull';
const PUSH_PATH = '/api/v1/sync/push';

/** 单次拉取的记录上限（§6.2：limit 默认 200） */
const DEFAULT_PULL_LIMIT = 200;
/** 分页拉取的安全上限（防止服务端 has_more 异常导致无限循环） */
const MAX_PULL_PAGES = 50;

/** 同步操作类型（§6.2 changes.*.op） */
export type SyncOp = 'upsert' | 'delete';

/** 单条服务端→客户端变更记录（§6.2 pull changes 内项） */
export interface ServerChangeRecord {
  /** upsert（新增/更新）或 delete（删除） */
  op: SyncOp;
  /** 服务端正式记录 ID（pull 后用于本地反查 / 覆盖） */
  server_id: string | number;
  /** 该记录的服务端版本号 */
  server_seq: number;
  /** 业务字段（不含同步元数据） */
  fields: Record<string, unknown>;
}

/** 服务端→客户端变更，按本地表名分组 */
export type PulledChangesByTable = Partial<Record<LocalTableName, ServerChangeRecord[]>>;

/** pull 接口响应的 data 部分（§6.2） */
export interface SyncPullResponse {
  /** 本次拉取后服务端最新序列号（推进 last_server_seq） */
  latest_server_seq: number;
  /** 是否还有更多变更未拉取（true 则继续分页） */
  has_more: boolean;
  /** 本页变更，按表分组 */
  changes: PulledChangesByTable;
}

/** 单条本地→服务端推送记录（dirty record 序列化前形态） */
export interface DirtyRecord {
  /** 客户端稳定 UUID，服务端据此幂等去重（§6.3） */
  client_uuid: string;
  /** upsert 或 delete */
  op: SyncOp;
  /** 该记录最后一次拉取到的服务端版本号，用于服务端冲突检测（§6.5） */
  base_server_seq: number;
  /** 业务字段（不含 server_id / sync_status / client_uuid 等同步元数据） */
  fields: Record<string, unknown>;
}

/** 本地 dirty 记录，按表分组 */
export type DirtyRecords = Partial<Record<LocalTableName, DirtyRecord[]>>;

/** push 成功后被服务端接受的记录回执（§6.3 results） */
export interface PushAcceptedRecord {
  client_uuid: string;
  /** 服务端分配的正式 ID（首次创建时回填本地） */
  server_id: string | number;
  /** 服务端分配的新版本号（回填本地 server_seq） */
  server_seq: number;
  /** created（新建）或 updated（更新） */
  status: string;
}

/** push 时检测到的冲突（§6.5 三类冲突） */
export interface PushConflict {
  client_uuid: string;
  /** 业务错误码：4002=server_seq冲突 / 4003=日报已退回 / 4004=任务已取消 */
  error_code: number;
  /** 服务端当前版本数据（供 UI 展示对比） */
  server_version?: Record<string, unknown>;
  message: string;
}

/** push 接口响应的 data 部分（§6.3） */
export interface SyncPushResponse {
  /** 服务端 SyncBatch 主键 */
  sync_batch_id: string;
  /** push 完成后服务端最新序列号 */
  server_seq_after: number;
  /** 各表被接受的记录回执 */
  results: Partial<Record<LocalTableName, PushAcceptedRecord[]>>;
  /** 各表检测到的冲突（可能为空） */
  conflicts?: Partial<Record<LocalTableName, PushConflict[]>>;
}

/** pull 操作对外暴露的结果 */
export interface SyncPullResult {
  /** 本次拉取推进到的最新 last_server_seq */
  latest_server_seq: number;
  /** 全部分页合并后的变更（按表分组），has_more 已耗尽 */
  changes: PulledChangesByTable;
  /** 本次实际写入本地的记录总数 */
  pulled_count: number;
}

/** push 操作对外暴露的结果 */
export interface SyncPushResult {
  sync_batch_id: string;
  server_seq_after: number;
  /** 被接受的记录（已回填 server_id 并标记 synced） */
  accepted: Partial<Record<LocalTableName, PushAcceptedRecord[]>>;
  /** 检测到的冲突（已标记本地 sync_status='conflict'） */
  conflicts: Partial<Record<LocalTableName, PushConflict[]>>;
  /** 本批推送的记录总数 */
  pushed_count: number;
  /** 是否存在冲突（便于上层决定是否弹出冲突 UI） */
  has_conflicts: boolean;
}

/**
 * 本地库读写端口（解耦 WatermelonDB）。
 *
 * 生产实现基于 @nozbe/watermelondb 的 collection.query + database.batch；
 * 测试实现可用内存 Map 替换。SyncEngine 仅依赖此 4 个方法，不直接触碰 ORM 细节。
 */
export interface SyncDatabasePort {
  /**
   * 收集所有 sync_status='pending_push' 的本地变更，按表分组。
   * 实现应遍历所有同步表（见 TABLE_NAMES），返回 dirty 记录。
   */
  collectDirtyRecords(): Promise<DirtyRecords>;
  /**
   * 将 pull 拉取的服务端变更批量写入本地（upsert 新增/更新，delete 软删），
   * 写入后这些记录 sync_status='synced'。
   * @returns 实际处理的记录数（用于结果统计）
   */
  applyPulledChanges(changes: PulledChangesByTable): Promise<number>;
  /**
   * push 成功后，按 client_uuid 回填 server_id / server_seq，并置 sync_status='synced'。
   */
  applyAcceptedRecords(accepted: Partial<Record<LocalTableName, PushAcceptedRecord[]>>): Promise<void>;
  /**
   * 将冲突记录标记为 sync_status='conflict'（V1 不自动合并，§103.1 第4条）。
   * 实现可同时缓存 server_version 供冲突 UI 读取。
   */
  markConflictRecords(conflicts: Partial<Record<LocalTableName, PushConflict[]>>): Promise<void>;
}

/** SyncEngine 构造选项 */
export interface SyncEngineOptions {
  /** 当前项目 ID（push body 必填，pull 可选过滤） */
  projectId?: string;
  /** 单次 pull 的 limit，默认 200 */
  pullLimit?: number;
}

/**
 * 合并分页 changes：把新一页的变更追加到累计按表分组的结构里。
 * 不做去重——分页之间 server_seq 单调递增，理论上不会出现同一记录跨页重复。
 */
function mergeChanges(
  acc: PulledChangesByTable,
  page: PulledChangesByTable,
): PulledChangesByTable {
  for (const table of Object.keys(page) as LocalTableName[]) {
    const incoming = page[table];
    if (!incoming || incoming.length === 0) {
      continue;
    }
    if (!acc[table]) {
      acc[table] = [];
    }
    (acc[table] as ServerChangeRecord[]).push(...incoming);
  }
  return acc;
}

/** 统计各表变更总数 */
function countChanges(changes: PulledChangesByTable): number {
  let n = 0;
  for (const table of Object.keys(changes) as LocalTableName[]) {
    n += changes[table]?.length ?? 0;
  }
  return n;
}

/**
 * 生成 RFC 4122 v4 风格 UUID。
 *
 * 注意（降级实现，同 store/database.ts）：基于 Math.random。
 * 生产环境应替换为 react-native-get-random-values 提供的 crypto.getRandomValues
 * 或 crypto.randomUUID。骨架阶段保留此实现以避免引入额外依赖。
 */
function generateUuid(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += '-';
      continue;
    }
    if (i === 14) {
      out += '4'; // version 4
      continue;
    }
    let r = Math.floor(Math.random() * 16);
    if (i === 19) {
      r = (r & 0x3) | 0x8; // variant
    }
    out += hex[r];
  }
  return out;
}

/**
 * 飞检增量同步引擎。
 *
 * @example
 * const engine = new SyncEngine(apiClient, syncStateMgr, dbPort, { projectId: 'P001' });
 * await engine.fullSync();
 */
export class SyncEngine {
  private readonly apiClient: ApiClient;
  private readonly syncStateManager: ClientSyncStateManager;
  private readonly database: SyncDatabasePort;
  private readonly projectId?: string;
  private readonly pullLimit: number;

  constructor(
    apiClient: ApiClient,
    syncStateManager: ClientSyncStateManager,
    database: SyncDatabasePort,
    options?: SyncEngineOptions,
  ) {
    this.apiClient = apiClient;
    this.syncStateManager = syncStateManager;
    this.database = database;
    this.projectId = options?.projectId;
    this.pullLimit = options?.pullLimit ?? DEFAULT_PULL_LIMIT;
  }

  /**
   * 增量拉取：从 lastServerSeq 开始分页拉取服务端变更并写入本地。
   *
   * 流程（在同步锁内）：
   *  1. GET /api/v1/sync/pull?since={seq}&limit={pullLimit}[&project_id=...][&entity_types=...]
   *  2. database.applyPulledChanges(resp.changes)
   *  3. seq ← resp.latest_server_seq；若 has_more=true 则回到步骤 1
   *  4. updateLastServerSeq(seq)（取 max 防回退）
   *
   * @param lastServerSeq - 起始游标；通常传 syncStateManager.getLastServerSeq()
   * @param options.entityTypes - 可选，只拉取部分实体类型（减少弱网传输量，§6.2）
   */
  async pull(
    lastServerSeq: number,
    options?: { entityTypes?: readonly LocalTableName[] },
  ): Promise<SyncPullResult> {
    return this.syncStateManager.withSyncLock(async () => {
      const accumulated: PulledChangesByTable = {};
      let seq = lastServerSeq;
      let totalPulled = 0;
      let hasMore = false;
      let pages = 0;

      do {
        const resp = await this.apiClient.get<SyncPullResponse>(PULL_PATH, {
          query: {
            since: seq,
            limit: this.pullLimit,
            project_id: this.projectId,
            entity_types: options?.entityTypes?.join(','),
          },
        });

        const pageWritten = await this.database.applyPulledChanges(resp.changes);
        totalPulled += pageWritten;
        mergeChanges(accumulated, resp.changes);

        // 推进游标（响应里的 latest_server_seq 是该页之后的最新序号）
        if (typeof resp.latest_server_seq === 'number') {
          seq = resp.latest_server_seq;
        }
        hasMore = resp.has_more === true;
        pages += 1;
      } while (hasMore && pages < MAX_PULL_PAGES);

      // 推进持久化的 last_server_seq（取 max，防止回退，§6.2）
      await this.syncStateManager.updateLastServerSeq(seq);

      return {
        latest_server_seq: seq,
        changes: accumulated,
        pulled_count: totalPulled,
      };
    });
  }

  /**
   * 批量推送本地 dirty 记录到服务端。
   *
   * 流程（在同步锁内）：
   *  1. 收集 dirty（changes 未传则从本地库读取 sync_status='pending_push' 的记录）
   *  2. 若无 dirty，直接返回空成功结果
   *  3. 生成 client_batch_uuid（幂等键），取当前 last_server_seq 作为 base_server_seq
   *  4. POST /api/v1/sync/push（body: client_batch_uuid + base_server_seq + project_id + changes）
   *  5. accepted → database.applyAcceptedRecords（回填 server_id，置 synced）
   *     conflicts → database.markConflictRecords（置 sync_status='conflict'，不自动合并）
   *  6. server_seq_after > 0 → updateLastServerSeq
   *
   * 幂等性（§6.3）：client_batch_uuid + client_uuid 保证网络重试或重复调用不产生重复记录。
   *
   * @param changes - 可选，显式传入 dirty 记录；省略则从本地库自动收集
   */
  async push(changes?: DirtyRecords): Promise<SyncPushResult> {
    return this.syncStateManager.withSyncLock(async () => {
      const dirty: DirtyRecords = changes ?? (await this.database.collectDirtyRecords());

      const pushedCount = countDirtyRecords(dirty);
      if (pushedCount === 0) {
        // 无待推送变更：返回空成功结果，不发起请求
        const emptySeq = await this.syncStateManager.getLastServerSeq();
        return {
          sync_batch_id: '',
          server_seq_after: emptySeq,
          accepted: {},
          conflicts: {},
          pushed_count: 0,
          has_conflicts: false,
        };
      }

      const clientBatchUuid = generateUuid();
      const baseServerSeq = await this.syncStateManager.getLastServerSeq();

      const body = {
        client_batch_uuid: clientBatchUuid,
        base_server_seq: baseServerSeq,
        project_id: this.projectId,
        changes: serializeDirtyForPush(dirty),
      };

      const resp = await this.apiClient.post<SyncPushResponse>(PUSH_PATH, body);

      const accepted = resp.results ?? {};
      const conflicts = resp.conflicts ?? {};
      const hasConflicts = hasAnyConflict(conflicts);

      // 回填被接受的记录（server_id / server_seq → 本地，sync_status='synced'）
      await this.database.applyAcceptedRecords(accepted);
      // 标记冲突记录（sync_status='conflict'，V1 人工裁决）
      if (hasConflicts) {
        await this.database.markConflictRecords(conflicts);
      }

      // 推进 last_server_seq（push 也可能推进服务端 seq）
      if (typeof resp.server_seq_after === 'number' && resp.server_seq_after > 0) {
        await this.syncStateManager.updateLastServerSeq(resp.server_seq_after);
      }

      return {
        sync_batch_id: resp.sync_batch_id,
        server_seq_after: resp.server_seq_after,
        accepted,
        conflicts,
        pushed_count: pushedCount,
        has_conflicts: hasConflicts,
      };
    });
  }

  /**
   * 组合同步：先 push 本地变更，再 pull 服务端增量。
   *
   * 先 push 后 pull 的原因：确保本地刚产生的变更先落库（拿到 server_id），
   * 随后 pull 能拉到包含本次 push 在内的最新服务端状态，避免新变更被旧快照覆盖。
   */
  async fullSync(): Promise<{ pull: SyncPullResult; push: SyncPushResult }> {
    const pushResult = await this.push();
    const lastSeq = pushResult.server_seq_after;
    const pullResult = await this.pull(lastSeq);
    return { pull: pullResult, push: pushResult };
  }
}

/**
 * 将本地 dirty 记录序列化为 push body 期望的 changes 结构（§6.3）。
 * 每条记录输出 { client_uuid, op, base_server_seq, fields }，剔除本地同步元数据。
 */
function serializeDirtyForPush(
  dirty: DirtyRecords,
): Partial<Record<LocalTableName, Array<{
  client_uuid: string;
  op: SyncOp;
  base_server_seq: number;
  fields: Record<string, unknown>;
}>>> {
  const out: Partial<Record<LocalTableName, Array<{
    client_uuid: string;
    op: SyncOp;
    base_server_seq: number;
    fields: Record<string, unknown>;
  }>>> = {};
  for (const table of Object.keys(dirty) as LocalTableName[]) {
    const records = dirty[table];
    if (!records || records.length === 0) {
      continue;
    }
    out[table] = records.map((r) => ({
      client_uuid: r.client_uuid,
      op: r.op,
      base_server_seq: r.base_server_seq,
      fields: r.fields,
    }));
  }
  return out;
}

/** 统计 dirty 记录总数 */
function countDirtyRecords(dirty: DirtyRecords): number {
  let n = 0;
  for (const table of Object.keys(dirty) as LocalTableName[]) {
    n += dirty[table]?.length ?? 0;
  }
  return n;
}

/** 是否存在任意冲突记录 */
function hasAnyConflict(
  conflicts: Partial<Record<LocalTableName, PushConflict[]>>,
): boolean {
  for (const table of Object.keys(conflicts) as LocalTableName[]) {
    if ((conflicts[table]?.length ?? 0) > 0) {
      return true;
    }
  }
  return false;
}

// 导出同步状态字符串常量，供 database port 实现方复用（避免魔法字符串）。
export const SYNC_STATUS = {
  SYNCED: SYNC_STATUS_SYNCED,
  CONFLICT: SYNC_STATUS_CONFLICT,
} as const;
