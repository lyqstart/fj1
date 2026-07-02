/**
 * DailyReportIssueModel — 日报问题本地模型
 *
 * 设计依据：WI-0001 §101.10 DailyReportIssue / DD-1 / §6 安卓离线同步协议
 *
 * 业务说明：
 *  - 该表既存服务端 pull 下来的问题，也存客户端离线创建的待推送问题。
 *  - 客户端创建的记录，client_uuid 必填，server_id 为空字符串直到 push 成功。
 *  - 关联的推荐标准条款 ID 数组以 JSON 字符串形式存于 recommended_clause_ids。
 */
import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, json } from '@nozbe/watermelondb/decorators';

import { SYNC_STATUS } from './DailyReportModel';

export const DAILY_REPORT_ISSUE_TABLE = 'daily_report_issues' as const;

/**
 * DailyReportIssue.status 枚举（§101.10 / §102.3 联动规则表）
 */
export const ISSUE_STATUS = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  RETURNED: '已退回',
  VOIDED: '已作废',
} as const;

/**
 * 问题质量状态（§101.10 issue_quality_status）
 */
export const ISSUE_QUALITY_STATUS = {
  PENDING_CONFIRM: '待确认',
  VALID: '有效',
  INVALID: '无效',
} as const;

/**
 * 问题严重等级（§101.10 severity）
 */
export const ISSUE_SEVERITY = {
  NORMAL: '一般',
  MAJOR: '较大',
  CRITICAL: '重大',
} as const;

export type IssueStatus =
  (typeof ISSUE_STATUS)[keyof typeof ISSUE_STATUS];
export type IssueQualityStatus =
  (typeof ISSUE_QUALITY_STATUS)[keyof typeof ISSUE_QUALITY_STATUS];
export type IssueSeverity =
  (typeof ISSUE_SEVERITY)[keyof typeof ISSUE_SEVERITY];

/** 推荐标准条款 ID 数组的解析器（@json decorator 必须提供） */
function parseClauseIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string');
  }
  return [];
}

export default class DailyReportIssueModel extends Model {
  static table = DAILY_REPORT_ISSUE_TABLE;

  // ============== 同步字段 ==============
  @field('server_id') serverId!: string;
  @field('sync_status') syncState!: string;
  @field('server_seq') serverSeq!: number;
  @field('client_uuid') clientUuid!: string;

  // ============== 业务字段 ==============
  /** 所属日报（关联 daily_reports.id） */
  @field('daily_report_id') dailyReportId!: string;
  @field('project_id') projectId!: string;
  /** 来源检查项 ID（可空，表外问题无来源） */
  @field('task_item_id') taskItemId!: string | null;
  /** 问题描述（必填） */
  @field('issue_description') issueDescription!: string;
  /** 严重等级：一般|较大|重大 */
  @field('severity') severity!: IssueSeverity | string;
  /** 见 ISSUE_STATUS 枚举 */
  @field('status') status!: IssueStatus | string;
  /** 质量状态：待确认|有效|无效（见 ISSUE_QUALITY_STATUS） */
  @field('issue_quality_status') issueQualityStatus!: IssueQualityStatus | string | null;

  /** 该问题下的照片数（缓存计数，避免每次 count 查询） */
  @field('photo_count') photoCount!: number;

  // 三层匹配维度（DD-11 §69.2 分类匹配用）
  @field('professional') professional!: string | null;
  @field('category_l1') categoryL1!: string | null;
  @field('category_l2') categoryL2!: string | null;
  @field('device_type') deviceType!: string | null;

  // 离线推荐结果（DD-11）
  @json('recommended_clause_ids', parseClauseIds) recommendedClauseIds!: string[];
  @field('recommended_reason') recommendedReason!: string | null;

  // ============== WatermelonDB 内置字段 ==============
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}

/**
 * 判断该问题是否需要 push 到服务端。
 * 用法：sync engine 用此方法筛选本地变更。
 */
export function isIssuePendingPush(record: DailyReportIssueModel): boolean {
  return record.syncState === SYNC_STATUS.PENDING_PUSH;
}
