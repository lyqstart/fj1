/**
 * DailyReportModel — 日报本地模型
 *
 * 设计依据：WI-0001 §101.9 DailyReport / DD-1 / §6 安卓离线同步协议
 *
 * 字段语义：
 *  - 同步字段（serverId/syncState/serverSeq/clientUuid）：见 schema.ts 顶部说明
 *  - 业务字段：与服务端 DailyReport 对齐
 *  - 时间字段：通过 @date decorator 自动从 number → Date 转换
 */
import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export const DAILY_REPORT_TABLE = 'daily_reports' as const;

/**
 * DailyReport.status 枚举（§101.9 / §102.2 状态机）
 * 确认即锁定：confirmed_at 与 locked_at 在同一事务内写入（DD-8）
 */
export const DAILY_REPORT_STATUS = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  LOCKED: '已锁定',
  RETURNED: '已退回',
  VOIDED: '已作废',
} as const;

/**
 * 通用同步状态枚举（所有需要同步的本地表共用）。
 * 见 schema.ts 顶部说明。
 */
export const SYNC_STATUS = {
  SYNCED: 'synced',
  PENDING_PUSH: 'pending_push',
  CONFLICT: 'conflict',
} as const;

export type DailyReportStatus =
  (typeof DAILY_REPORT_STATUS)[keyof typeof DAILY_REPORT_STATUS];
export type SyncStatus =
  (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS];

/**
 * 同步 payload 中业务字段的形状（不含同步元数据字段）。
 * sync engine 在构造 push payload 时使用此类型。
 */
export interface DailyReportBusinessFields {
  project_id: string;
  report_date: number;
  inspector_id: string;
  status: string;
  summary: string | null;
  submitted_at: number | null;
  confirmed_at: number | null;
  locked_at: number | null;
  weather: string | null;
}

export default class DailyReportModel extends Model {
  static table = DAILY_REPORT_TABLE;

  // ============== 同步字段（4 项，所有需同步表共用）==============
  /** 服务端对应记录 ID（首次 push 成功后回填） */
  @field('server_id') serverId!: string;
  /** 本地变更同步状态：synced | pending_push | conflict */
  @field('sync_status') syncState!: SyncStatus | string;
  /** 该记录最后一次拉取到的服务端版本号，用于 push 冲突检测（§6.5） */
  @field('server_seq') serverSeq!: number;
  /** 客户端生成的稳定 UUID，用于幂等推送去重（§6.3） */
  @field('client_uuid') clientUuid!: string;

  // ============== 业务字段 ==============
  @field('project_id') projectId!: string;
  /** 日报日期（时间戳，UTC 0:00 那一刻；用于按天聚合查询） */
  @date('report_date') reportDate!: Date;
  @field('inspector_id') inspectorId!: string;
  /** 见 DAILY_REPORT_STATUS 枚举 */
  @field('status') status!: DailyReportStatus | string;
  @field('summary') summary!: string | null;

  @date('submitted_at') submittedAt!: Date | null;
  /** 审批通过的业务动作时间（DD-8） */
  @date('confirmed_at') confirmedAt!: Date | null;
  /** 日报锁定的事务提交时间（DD-8，与 confirmed_at 同事务） */
  @date('locked_at') lockedAt!: Date | null;
  @field('weather') weather!: string | null;

  // ============== WatermelonDB 内置字段（@readonly）==============
  @readonly @date('created_at') createdAt!: Date;
  /** 等价于业务文档中的 last_modified，由框架自动维护 */
  @readonly @date('updated_at') updatedAt!: Date;
}

/**
 * 把 DailyReportModel 实例序列化为同步 payload 中需要的"业务字段对象"。
 * 同步字段（serverId/syncState/serverSeq/clientUuid）由 sync engine 单独处理，
 * 不进业务字段 payload。
 */
export function extractDailyReportBusinessFields(
  record: DailyReportModel,
): DailyReportBusinessFields {
  return {
    project_id: record.projectId,
    report_date: record.reportDate.getTime(),
    inspector_id: record.inspectorId,
    status: record.status,
    summary: record.summary,
    submitted_at: record.submittedAt ? record.submittedAt.getTime() : null,
    confirmed_at: record.confirmedAt ? record.confirmedAt.getTime() : null,
    locked_at: record.lockedAt ? record.lockedAt.getTime() : null,
    weather: record.weather,
  };
}
