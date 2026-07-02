import { request } from '@/api/client'
import type {
  DailyReport,
  DailyReportDetail,
  DailyReportStatus,
  IssueRelation,
  IssueSeverity,
  ProjectIssue,
  RelationType,
  ReviewAction,
} from '@/api/types'

/** 日报多条件查询参数（GET /daily-reports，均可选） */
export interface DailyReportQuery {
  projectId?: number
  /** 业务日期 YYYY-MM-DD */
  date?: string
  inspectorId?: number
  status?: DailyReportStatus
}

/** 问题复核请求体（POST /issues/{id}/review） */
export interface ReviewRequestBody {
  action: ReviewAction
  comment: string
  newSeverity?: IssueSeverity
}

/** 问题关联请求体（POST /issues/{id}/relations） */
export interface LinkRelationBody {
  targetIssueId: number
  relationType: RelationType
}

/**
 * 日报确认 / 问题复核 API 封装（TASK-034）。
 *
 * 全部走 client.ts 的 request() —— 校验 code===0 后返回 data，否则抛 ApiError。
 */
export const reportConfirmApi = {
  /** 多条件查询日报列表（后端返回 List，非分页） */
  getDailyReports: (params?: DailyReportQuery) =>
    request<DailyReport[]>({ url: '/daily-reports', method: 'get', params }),

  /** 查看日报详情 */
  getDailyReportDetail: (id: number) =>
    request<DailyReportDetail>({ url: `/daily-reports/${id}`, method: 'get' }),

  /** 发起日报确认审批：SUBMITTED → LOCKED（DD-8 确认即锁定） */
  confirmReport: (id: number, approverId: number) =>
    request<DailyReport>({
      url: `/daily-reports/${id}/confirm`,
      method: 'post',
      data: { approverId },
    }),

  /** 作废日报：任意非 VOIDED → VOIDED（终态，DD-9） */
  voidReport: (id: number, voiderId: number) =>
    request<DailyReport>({
      url: `/daily-reports/${id}/void`,
      method: 'post',
      data: { voiderId },
    }),

  /** 组长复核问题（PASS/RETURN/ADJUST/VOID/CORRECT） */
  reviewIssue: (
    id: number,
    action: ReviewAction,
    comment: string,
    newSeverity?: IssueSeverity,
  ) =>
    request<ProjectIssue>({
      url: `/issues/${id}/review`,
      method: 'post',
      data: { action, comment, newSeverity } satisfies ReviewRequestBody,
    }),

  /** 创建问题关联（重复 / 相似） */
  linkIssue: (id: number, targetIssueId: number, relationType: RelationType) =>
    request<IssueRelation>({
      url: `/issues/${id}/relations`,
      method: 'post',
      data: { targetIssueId, relationType } satisfies LinkRelationBody,
    }),

  /** 查询问题关联列表 */
  getIssueRelations: (id: number) =>
    request<IssueRelation[]>({ url: `/issues/${id}/relations`, method: 'get' }),
}
