/**
 * SyncDatabaseAdapter — SyncDatabasePort 的生产实现（基于 WatermelonDB）
 *
 * 设计依据：WI-0015 DD-4 / REQ-4 / §6 安卓离线同步协议
 *
 * 职责：
 *  - 实现 src/api/SyncEngine.ts 中 SyncDatabasePort 接口的 4 个方法：
 *      collectDirtyRecords / applyPulledChanges / applyAcceptedRecords / markConflictRecords
 *  - 通过 WatermelonDB 的 collection.query + Q.where 筛选 sync_status='pending_push'。
 *  - 通过 database.batch + database.write 在原子事务内批量写入。
 *  - 仅注册 4 个本地表（daily_reports / daily_report_issues / photos / inspection_tasks）。
 *
 * 范围声明（Out of Scope）：
 *  - project_issues / notifications / standard_clauses 三表 Model 未注册（后续 WI），
 *    pull 拉到这三表变更时 console.warn 跳过（REQ-4 / DD-4 范围声明）。
 *  - 不处理物理删除同步（_status=deleted），业务删除走软删。
 */
import { Database, Q, Model } from '@nozbe/watermelondb';

import type {
  SyncDatabasePort,
  DirtyRecords,
  DirtyRecord,
  PulledChangesByTable,
  ServerChangeRecord,
  PushAcceptedRecord,
  PushConflict,
} from '../api/SyncEngine';
import type { LocalTableName } from './schema';
import { SYNC_STATUS } from '../api/SyncEngine';

import DailyReportModel, {
  extractDailyReportBusinessFields,
} from './models/DailyReportModel';
import DailyReportIssueModel from './models/DailyReportIssueModel';
import PhotoModel from './models/PhotoModel';
import InspectionTaskModel from './models/InspectionTaskModel';

// ============== TableName → Model 映射 ==============
/**
 * 已注册同步表 → WatermelonDB Model 类映射。
 * SyncEngine 通过表名（LocalTableName）分发 upsert/delete，
 * 本表用于把表名映射到对应的 collection 与 extract/apply 函数。
 *
 * 仅 4 表注册（DD-4 范围）；project_issues / notifications / standard_clauses 留给后续 WI。
 */
const TABLE_TO_MODEL = {
  daily_reports: DailyReportModel,
  daily_report_issues: DailyReportIssueModel,
  photos: PhotoModel,
  inspection_tasks: InspectionTaskModel,
} as const;

/** 已注册同步表名集合（TABLE_TO_MODEL 的 keyof） */
type RegisteredTableName = keyof typeof TABLE_TO_MODEL;

/** 判断表名是否在本 Adapter 注册范围内 */
function isRegisteredTable(table: LocalTableName): table is RegisteredTableName {
  return Object.prototype.hasOwnProperty.call(TABLE_TO_MODEL, table);
}

// ============== 业务字段 extract / apply（每表一份）==============
//
// 4 表的业务字段提取与回填函数。Date 字段需 number ↔ Date 转换（@date decorator 要求）。
// daily_reports 复用 Model 自带的 extractDailyReportBusinessFields；
// 其余 3 表在此内联（每表 ~10 行）。

/** daily_report_issues 业务字段 → Record（用于 push payload） */
function extractIssueFields(r: DailyReportIssueModel): Record<string, unknown> {
  return {
    daily_report_id: r.dailyReportId,
    project_id: r.projectId,
    task_item_id: r.taskItemId,
    issue_description: r.issueDescription,
    severity: r.severity,
    status: r.status,
    issue_quality_status: r.issueQualityStatus,
    photo_count: r.photoCount,
    professional: r.professional,
    category_l1: r.categoryL1,
    category_l2: r.categoryL2,
    device_type: r.deviceType,
    recommended_clause_ids: JSON.stringify(r.recommendedClauseIds ?? []),
    recommended_reason: r.recommendedReason,
  };
}

/** photos 业务字段 → Record */
function extractPhotoFields(r: PhotoModel): Record<string, unknown> {
  return {
    daily_report_issue_id: r.dailyReportIssueId,
    project_id: r.projectId,
    local_file_path: r.localFilePath,
    remote_file_path: r.remoteFilePath,
    photo_type: r.photoType,
    captured_at: r.capturedAt.getTime(),
    compressed_file_hash: r.compressedFileHash,
    original_file_hash: r.originalFileHash,
    original_local_path: r.originalLocalPath,
    longitude: r.longitude,
    latitude: r.latitude,
    gps_status: r.gpsStatus,
    file_upload_status: r.fileUploadStatus,
    upload_retries: r.uploadRetries,
    is_late_uploaded: r.isLateUploaded,
    uploaded_at: r.uploadedAt ? r.uploadedAt.getTime() : null,
  };
}

/** inspection_tasks 业务字段 → Record */
function extractTaskFields(r: InspectionTaskModel): Record<string, unknown> {
  return {
    project_id: r.projectId,
    task_no: r.taskNo,
    task_name: r.taskName,
    form_id: r.formId,
    assigned_to: r.assignedTo,
    status: r.status,
    planned_date: r.plannedDate ? r.plannedDate.getTime() : null,
    completed_at: r.completedAt ? r.completedAt.getTime() : null,
    location_id: r.locationId,
    location_name_snapshot: r.locationNameSnapshot,
    assigned_org_id: r.assignedOrgId,
  };
}

/** 把 Model 实例转为 DirtyRecord（按表分发） */
function toDirtyRecord(
  table: RegisteredTableName,
  record: Model,
): DirtyRecord | null {
  switch (table) {
    case 'daily_reports':
      return {
        client_uuid: (record as DailyReportModel).clientUuid,
        op: 'upsert',
        base_server_seq: (record as DailyReportModel).serverSeq ?? 0,
        fields: extractDailyReportBusinessFields(record as DailyReportModel) as unknown as Record<string, unknown>,
      };
    case 'daily_report_issues':
      return {
        client_uuid: (record as DailyReportIssueModel).clientUuid,
        op: 'upsert',
        base_server_seq: (record as DailyReportIssueModel).serverSeq ?? 0,
        fields: extractIssueFields(record as DailyReportIssueModel),
      };
    case 'photos':
      return {
        client_uuid: (record as PhotoModel).clientUuid,
        op: 'upsert',
        base_server_seq: (record as PhotoModel).serverSeq ?? 0,
        fields: extractPhotoFields(record as PhotoModel),
      };
    case 'inspection_tasks':
      return {
        client_uuid: (record as InspectionTaskModel).clientUuid,
        op: 'upsert',
        base_server_seq: (record as InspectionTaskModel).serverSeq ?? 0,
        fields: extractTaskFields(record as InspectionTaskModel),
      };
    default:
      return null;
  }
}

// ============== 辅助：可空数字/日期转换 ==============
function toNullableDate(ts: unknown): Date | null {
  if (ts === null || ts === undefined) return null;
  const n = Number(ts);
  return Number.isFinite(n) ? new Date(n) : null;
}

function toNullableString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function toNullableNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 把 pull 拉取的 fields（snake_case Record）映射到 WatermelonDB Model 的
 * camelCase + Date 字段，返回适合 collection.prepareCreate / record.prepareUpdate
 * 的 "raw row" 对象（含同步元数据字段 server_id/sync_status/server_seq/client_uuid）。
 */
function buildRowFromPull(
  table: RegisteredTableName,
  change: ServerChangeRecord,
): Record<string, unknown> {
  const f = change.fields ?? {};
  // 通用：Date 字段（number → Date）按 schema 已知字段做转换
  const dateFieldMap: Record<RegisteredTableName, string[]> = {
    daily_reports: ['report_date', 'submitted_at', 'confirmed_at', 'locked_at'],
    daily_report_issues: [],
    photos: ['captured_at', 'uploaded_at'],
    inspection_tasks: ['planned_date', 'completed_at'],
  };
  const row: Record<string, unknown> = {
    server_id: String(change.server_id),
    sync_status: SYNC_STATUS.SYNCED,
    server_seq: change.server_seq,
    client_uuid: typeof f.client_uuid === 'string' ? f.client_uuid : '',
  };
  for (const [k, v] of Object.entries(f)) {
    if (dateFieldMap[table].includes(k)) {
      row[k] = toNullableDate(v);
    } else {
      row[k] = v;
    }
  }
  return row;
}

// ============== Adapter 主体 ==============
/**
 * SyncDatabasePort 的 WatermelonDB 生产实现。
 *
 * @example
 * const adapter = new SyncDatabaseAdapter(database);
 * const dirty = await adapter.collectDirtyRecords();
 */
export class SyncDatabaseAdapter implements SyncDatabasePort {
  constructor(private readonly database: Database) {}

  // ---------- 1. collectDirtyRecords ----------
  async collectDirtyRecords(): Promise<DirtyRecords> {
    const result: DirtyRecords = {};
    for (const table of Object.keys(TABLE_TO_MODEL) as RegisteredTableName[]) {
      const collection = this.database.get<Model>(TABLE_TO_MODEL[table].table);
      // 查询 sync_status='pending_push' 的本地变更记录（§6.3 push 输入）
      const pending = await collection
        .query(Q.where('sync_status', 'pending_push'))
        .fetch();
      if (pending.length === 0) {
        continue;
      }
      const dirty: DirtyRecord[] = [];
      for (const record of pending) {
        const dr = toDirtyRecord(table, record);
        if (dr) {
          dirty.push(dr);
        }
      }
      if (dirty.length > 0) {
        result[table as LocalTableName] = dirty;
      }
    }
    return result;
  }

  // ---------- 2. applyPulledChanges ----------
  async applyPulledChanges(changes: PulledChangesByTable): Promise<number> {
    let processed = 0;
    for (const table of Object.keys(changes) as LocalTableName[]) {
      const records = changes[table];
      if (!records || records.length === 0) {
        continue;
      }
      if (!isRegisteredTable(table)) {
        console.warn(
          `[SyncDatabaseAdapter] 表 ${table} 未注册，跳过 ${records.length} 条 pull 变更`,
        );
        continue;
      }
      await this.database.write(async () => {
        const batchOps: Array<() => Promise<void>> = [];
        for (const change of records) {
          const existing = await this.findByServerId(table, change.server_id);
          const row = buildRowFromPull(table, change);
          if (change.op === 'delete') {
            if (existing) {
              batchOps.push(() => existing.markAsDeleted() as unknown as Promise<void>);
              processed += 1;
            }
            continue;
          }
          if (existing) {
            batchOps.push(() => {
              for (const [k, v] of Object.entries(row)) {
                (existing as unknown as Record<string, unknown>)[k] = v;
              }
              return Promise.resolve();
            });
          } else {
            batchOps.push(() =>
              this.database.get<Model>(TABLE_TO_MODEL[table].table).prepareCreate((r) => {
                const target = r as unknown as Record<string, unknown>;
                for (const [k, v] of Object.entries(row)) {
                  target[k] = v;
                }
              }) as unknown as Promise<void>,
            );
          }
          processed += 1;
        }
        if (batchOps.length > 0) {
          await this.database.batch(...(batchOps as never[]));
        }
      });
    }
    return processed;
  }

  // ---------- 3. applyAcceptedRecords ----------
  async applyAcceptedRecords(
    accepted: Partial<Record<LocalTableName, PushAcceptedRecord[]>>,
  ): Promise<void> {
    for (const table of Object.keys(accepted) as LocalTableName[]) {
      const list = accepted[table];
      if (!list || list.length === 0) continue;
      if (!isRegisteredTable(table)) {
        console.warn(
          `[SyncDatabaseAdapter] 表 ${table} 未注册，跳过 ${list.length} 条 accepted 回执`,
        );
        continue;
      }
      await this.database.write(async () => {
        const batchOps: Array<() => Promise<void>> = [];
        for (const acc of list) {
          const local = await this.findByClientUuid(table, acc.client_uuid);
          if (!local) continue;
          batchOps.push(() => {
            const target = local as unknown as Record<string, unknown>;
            target.server_id = String(acc.server_id);
            target.server_seq = toNumber(acc.server_seq);
            target.sync_status = SYNC_STATUS.SYNCED;
            return Promise.resolve();
          });
        }
        if (batchOps.length > 0) {
          await this.database.batch(...(batchOps as never[]));
        }
      });
    }
  }

  // ---------- 4. markConflictRecords ----------
  async markConflictRecords(
    conflicts: Partial<Record<LocalTableName, PushConflict[]>>,
  ): Promise<void> {
    for (const table of Object.keys(conflicts) as LocalTableName[]) {
      const list = conflicts[table];
      if (!list || list.length === 0) continue;
      if (!isRegisteredTable(table)) {
        console.warn(
          `[SyncDatabaseAdapter] 表 ${table} 未注册，跳过 ${list.length} 条冲突`,
        );
        continue;
      }
      await this.database.write(async () => {
        const batchOps: Array<() => Promise<void>> = [];
        for (const c of list) {
          const local = await this.findByClientUuid(table, c.client_uuid);
          if (!local) continue;
          batchOps.push(() => {
            (local as unknown as Record<string, unknown>).sync_status =
              SYNC_STATUS.CONFLICT;
            return Promise.resolve();
          });
        }
        if (batchOps.length > 0) {
          await this.database.batch(...(batchOps as never[]));
        }
      });
    }
  }

  // ---------- 私有辅助 ----------
  private async findByServerId(
    table: RegisteredTableName,
    serverId: string | number,
  ): Promise<Model | null> {
    if (serverId === null || serverId === undefined || serverId === '') {
      return null;
    }
    const collection = this.database.get<Model>(TABLE_TO_MODEL[table].table);
    const matches = await collection
      .query(Q.where('server_id', String(serverId)))
      .fetch();
    return matches.length > 0 ? matches[0] : null;
  }

  private async findByClientUuid(
    table: RegisteredTableName,
    clientUuid: string,
  ): Promise<Model | null> {
    if (!clientUuid) return null;
    const collection = this.database.get<Model>(TABLE_TO_MODEL[table].table);
    const matches = await collection
      .query(Q.where('client_uuid', clientUuid))
      .fetch();
    return matches.length > 0 ? matches[0] : null;
  }
}

// 仅用于让 toNullableString/toNullableNumber 在未使用时不被 tree-shake 误删（保留以备后续扩展）
void toNullableString;
void toNullableNumber;
