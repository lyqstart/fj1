import { request } from '@/api/client'
import type {
  IssuePage,
  IssueSeverity,
  IssueStatus,
  ProjectIssue,
} from '@/api/types'

/** 问题池分页查询参数（projectId 为后端必填项） */
export interface IssueQuery {
  projectId: number
  status?: IssueStatus
  severity?: IssueSeverity
  /** 责任单位 / 责任人 ID（前端筛选参数） */
  responsiblePartyId?: number
  page?: number
  pageSize?: number
}

/** 问题部分更新体（PUT /issues/{id}，仅更新非空字段） */
export interface IssueUpdateBody {
  description?: string
  severity?: IssueSeverity
  category?: string
}

/**
 * 项目问题池 API 封装（TASK-039）。
 */
export const issueApi = {
  /** 多条件分页查询问题 */
  getIssues: (params: IssueQuery) =>
    request<IssuePage<ProjectIssue>>({ url: '/issues', method: 'get', params }),

  /** 查看问题详情 */
  getIssueDetail: (id: number) =>
    request<ProjectIssue>({ url: `/issues/${id}`, method: 'get' }),

  /** 编辑问题描述 / 等级 / 分类 */
  updateIssue: (id: number, data: IssueUpdateBody) =>
    request<ProjectIssue>({ url: `/issues/${id}`, method: 'put', data }),

  /** 查询分配给指定用户的问题（按 responsiblePartyId 过滤） */
  getMyIssues: (
    assigneeId: number,
    params: Omit<IssueQuery, 'responsiblePartyId'>,
  ) =>
    request<IssuePage<ProjectIssue>>({
      url: '/issues',
      method: 'get',
      params: { ...params, responsiblePartyId: assigneeId },
    }),
}
