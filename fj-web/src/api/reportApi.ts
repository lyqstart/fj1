import { request } from '@/api/client'
import type {
  ApprovalRecord,
  ExportFile,
  IssuePage,
  Report,
  ReportSnapshot,
  ReportStatus,
} from '@/api/types'

/** 报告生成请求体（POST /reports/generate） */
export interface ReportGenerateBody {
  projectId: number
  title: string
  periodStart: string
  periodEnd: string
}

/** 报告部分更新体（PUT /reports/{id}，仅更新非空字段） */
export interface ReportUpdateBody {
  title?: string
  periodStart?: string
  periodEnd?: string
}

/** 报告列表查询参数（GET /reports） */
export interface ReportQuery {
  projectId?: number
  status?: ReportStatus
  page?: number
  pageSize?: number
}

/** 快照更新体（PUT /reports/{reportId}/snapshots/{snapshotId}） */
export interface SnapshotUpdateBody {
  description?: string
  snapshotNote?: string
}

/**
 * 报告生产 / 审批 / 发布 API 封装（TASK-043）。
 *
 * 全部走 client.ts 的 request() —— 校验 code===0 后返回 data，否则抛 ApiError。
 */
export const reportApi = {
  /** 生成报告草稿 */
  generate: (data: ReportGenerateBody) =>
    request<Report>({ url: '/reports/generate', method: 'post', data }),

  /** 分页查询报告列表 */
  list: (params?: ReportQuery) =>
    request<IssuePage<Report>>({ url: '/reports', method: 'get', params }),

  /** 查看报告详情 */
  detail: (id: number) =>
    request<Report>({ url: `/reports/${id}`, method: 'get' }),

  /** 更新报告基本信息 */
  update: (id: number, data: ReportUpdateBody) =>
    request<Report>({ url: `/reports/${id}`, method: 'put', data }),

  /** 选择/替换报告关联问题 */
  selectIssues: (id: number, issueIds: number[]) =>
    request<Report>({ url: `/reports/${id}/select-issues`, method: 'post', data: { issueIds } }),

  /** 提交审批：DRAFT → IN_APPROVAL */
  submitApproval: (id: number, submitterId: number) =>
    request<Report>({ url: `/reports/${id}/submit-approval`, method: 'post', data: { submitterId } }),

  /** 审批通过：IN_APPROVAL → APPROVED */
  approve: (id: number, approverId: number, comment: string) =>
    request<Report>({
      url: `/reports/${id}/approve`,
      method: 'post',
      data: { approverId, comment },
    }),

  /** 审批退回：IN_APPROVAL → REJECTED */
  reject: (id: number, approverId: number, comment: string) =>
    request<Report>({
      url: `/reports/${id}/reject`,
      method: 'post',
      data: { approverId, comment },
    }),

  /** 发布报告：APPROVED → PUBLISHED */
  publish: (id: number, publisherId: number) =>
    request<Report>({ url: `/reports/${id}/publish`, method: 'post', data: { publisherId } }),

  /** 查询报告问题快照列表 */
  getSnapshots: (id: number) =>
    request<ReportSnapshot[]>({ url: `/reports/${id}/snapshots`, method: 'get' }),

  /** 编辑快照（固化问题信息） */
  editSnapshot: (reportId: number, snapshotId: number, data: SnapshotUpdateBody) =>
    request<ReportSnapshot>({
      url: `/reports/${reportId}/snapshots/${snapshotId}`,
      method: 'put',
      data,
    }),

  /** 新增问题快照（从问题池加入问题） */
  addSnapshot: (reportId: number, issueId: number) =>
    request<ReportSnapshot>({
      url: `/reports/${reportId}/snapshots`,
      method: 'post',
      data: { issueId },
    }),

  /** 删除快照 */
  removeSnapshot: (reportId: number, snapshotId: number) =>
    request<void>({
      url: `/reports/${reportId}/snapshots/${snapshotId}`,
      method: 'delete',
    }),

  /** 导出草稿预览 Word */
  exportDraft: (id: number) =>
    request<ExportFile>({ url: `/reports/${id}/export/draft-preview`, method: 'post' }),

  /** 导出正式发布 Word */
  exportOfficial: (id: number) =>
    request<ExportFile>({ url: `/reports/${id}/export/official-publish`, method: 'post' }),

  /** 查询报告导出文件记录 */
  getExportFiles: (id: number) =>
    request<ExportFile[]>({ url: `/reports/${id}/export-files`, method: 'get' }),

  /** 查询审批记录（审批历史） */
  getApprovalRecords: (id: number) =>
    request<ApprovalRecord[]>({ url: `/reports/${id}/approvals`, method: 'get' }),
}
