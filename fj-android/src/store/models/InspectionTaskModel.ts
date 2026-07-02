/**
 * InspectionTaskModel — 检查任务本地模型
 *
 * 设计依据：WI-0001 §101.7 InspectionTask / §101.22 多任务日报 / DD-1
 *
 * 业务说明：
 *  - 任务由服务端派发（pull 下来），客户端可在离线状态下开始/完成。
 *  - 任务取消属于 §6.5 第 3 类冲突：服务端任务已取消但本地仍在编辑 → 返回 4004。
 *  - 一份日报可关联多个任务（§101.22 多任务日报整体操作），任务关联在 daily_report_tasks 表，
 *    骨架阶段不在本地维护该关联表，由日报提交时聚合。
 */
import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export const INSPECTION_TASK_TABLE = 'inspection_tasks' as const;

/**
 * InspectionTask.status 枚举（§101.7 / §102 检查任务状态机）
 */
export const TASK_STATUS = {
  PENDING: '待开始',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
} as const;

export type TaskStatus =
  (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export default class InspectionTaskModel extends Model {
  static table = INSPECTION_TASK_TABLE;

  // ============== 同步字段 ==============
  @field('server_id') serverId!: string;
  @field('sync_status') syncState!: string;
  @field('server_seq') serverSeq!: number;
  @field('client_uuid') clientUuid!: string;

  // ============== 业务字段 ==============
  @field('project_id') projectId!: string;
  @field('task_no') taskNo!: string;
  @field('task_name') taskName!: string;
  /** 引用的已发布检查表 ID（检查表本身不下发到本地，提交时按 form_id 走服务端校验） */
  @field('form_id') formId!: string | null;
  @field('assigned_to') assignedTo!: string;
  /** 见 TASK_STATUS 枚举 */
  @field('status') status!: TaskStatus | string;

  @date('planned_date') plannedDate!: Date | null;
  @date('completed_at') completedAt!: Date | null;

  /** 位置信息（快照形式，避免基础数据改名影响历史任务） */
  @field('location_id') locationId!: string | null;
  @field('location_name_snapshot') locationNameSnapshot!: string | null;
  @field('assigned_org_id') assignedOrgId!: string | null;

  // ============== WatermelonDB 内置字段 ==============
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}

/**
 * 判断任务是否处于可编辑状态（服务端取消的任务不允许继续提交，§6.5 第 3 类冲突）。
 */
export function isTaskEditable(record: InspectionTaskModel): boolean {
  return (
    record.status === TASK_STATUS.PENDING ||
    record.status === TASK_STATUS.IN_PROGRESS
  );
}
