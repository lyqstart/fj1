import { useCallback, useEffect, useState } from 'react'
import { Card, Form, InputNumber, Select, Button, Space, Tag, message, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DataTable } from '@/shared/DataTable'
import { issueApi } from '@/api/issueApi'
import { reportConfirmApi } from '@/api/reportConfirmApi'
import {
  ISSUE_STATUS_OPTIONS,
  ISSUE_STATUS_COLORS,
  ISSUE_STATUS_LABELS,
  SEVERITY_OPTIONS,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  type IssuePage,
  type IssueSeverity,
  type IssueStatus,
  type ProjectIssue,
  type RelationType,
  ReviewAction,
} from '@/api/types'
import { deadlineCountdownText, formatDateTime, isOverdue } from '@/shared/dateUtils'
import {
  IssueActionButtons,
  type IssueActionPayload,
} from './IssueActionButtons'

interface FilterValues {
  projectId: number | null
  status?: IssueStatus
  severity?: IssueSeverity
  responsiblePartyId?: number
}

/**
 * 问题复核面板（TASK-034）。
 *
 * - 多维度筛选（项目 / 状态 / 等级 / 责任单位）
 * - DataTable 展示问题池
 * - 整改期限倒计时显示 + 超期标红
 * - 通过 IssueActionButtons 执行通过 / 退回 / 调整等级 / 作废 / 关联重复
 */
export function IssueReviewPanel() {
  const [form] = Form.useForm<FilterValues>()
  const [data, setData] = useState<ProjectIssue[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [committed, setCommitted] = useState<FilterValues>({ projectId: null })

  const fetchData = useCallback(
    async (filter: FilterValues, p: number, ps: number) => {
      if (filter.projectId == null) {
        setData([])
        setTotal(0)
        return
      }
      setLoading(true)
      try {
        const res: IssuePage<ProjectIssue> = await issueApi.getIssues({
          projectId: filter.projectId,
          status: filter.status,
          severity: filter.severity,
          responsiblePartyId: filter.responsiblePartyId,
          page: p,
          pageSize: ps,
        })
        setData(res.items)
        setTotal(res.total)
      } catch (e) {
        message.error('加载问题列表失败')
        // eslint-disable-next-line no-console
        console.error(e)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void fetchData(committed, page, pageSize)
  }, [committed, page, pageSize, fetchData])

  const handleSearch = async (): Promise<void> => {
    const values = await form.validateFields()
    setCommitted(values)
    setPage(1)
  }

  const handleAction = async (
    issue: ProjectIssue,
    payload: IssueActionPayload,
  ): Promise<void> => {
    try {
      switch (payload.type) {
        case 'pass':
          await reportConfirmApi.reviewIssue(issue.id, ReviewAction.PASS, payload.comment)
          message.success('已通过复核')
          break
        case 'return':
          await reportConfirmApi.reviewIssue(
            issue.id,
            ReviewAction.RETURN,
            payload.comment,
          )
          message.success('已退回')
          break
        case 'adjust':
          await reportConfirmApi.reviewIssue(
            issue.id,
            ReviewAction.ADJUST,
            payload.comment,
            payload.newSeverity,
          )
          message.success(`等级已调整为 ${SEVERITY_LABELS[payload.newSeverity]}`)
          break
        case 'void':
          await reportConfirmApi.reviewIssue(issue.id, ReviewAction.VOID, payload.comment)
          message.success('已作废')
          break
        case 'link':
          await reportConfirmApi.linkIssue(
            issue.id,
            payload.targetIssueId,
            payload.relationType as RelationType,
          )
          message.success('关联已创建')
          break
      }
      // 刷新当前页
      await fetchData(committed, page, pageSize)
    } catch (e) {
      message.error('操作失败')
      // eslint-disable-next-line no-console
      console.error(e)
      throw e
    }
  }

  const columns: ColumnsType<ProjectIssue> = [
    { title: '问题编号', dataIndex: 'issueNo', width: 160 },
    { title: '问题描述', dataIndex: 'description', ellipsis: true },
    {
      title: '等级',
      dataIndex: 'severity',
      width: 80,
      render: (v: ProjectIssue['severity']) => (
        <Tag color={SEVERITY_COLORS[v]}>{SEVERITY_LABELS[v]}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: ProjectIssue['status']) => (
        <Tag color={ISSUE_STATUS_COLORS[v]}>{ISSUE_STATUS_LABELS[v]}</Tag>
      ),
    },
    {
      title: '整改期限',
      dataIndex: 'rectificationDeadline',
      width: 200,
      render: (v: string) => {
        const overdue = isOverdue(v)
        return (
          <span style={{ color: overdue ? '#ff4d4f' : undefined }}>
            <div>{formatDateTime(v)}</div>
            <div style={{ fontSize: 12 }}>{deadlineCountdownText(v)}</div>
          </span>
        )
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 360,
      render: (_, record) => (
        <IssueActionButtons issue={record} onAction={handleAction} />
      ),
    },
  ]

  return (
    <Card
      title={
        <Space>
          <Typography.Text strong>问题复核</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            项目 ID 为必填项
          </Typography.Text>
        </Space>
      }
    >
      <Form<FilterValues>
        form={form}
        layout="inline"
        initialValues={{ projectId: null }}
        style={{ marginBottom: 16 }}
      >
        <Form.Item
          name="projectId"
          label="项目"
          rules={[{ required: true, message: '请输入项目 ID' }]}
        >
          <InputNumber placeholder="项目 ID" style={{ width: 120 }} min={1} />
        </Form.Item>
        <Form.Item name="status" label="状态">
          <Select
            allowClear
            placeholder="全部"
            style={{ width: 140 }}
            options={ISSUE_STATUS_OPTIONS}
          />
        </Form.Item>
        <Form.Item name="severity" label="等级">
          <Select
            allowClear
            placeholder="全部"
            style={{ width: 120 }}
            options={SEVERITY_OPTIONS}
          />
        </Form.Item>
        <Form.Item name="responsiblePartyId" label="责任单位">
          <InputNumber placeholder="责任单位/人 ID" style={{ width: 160 }} min={1} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" onClick={handleSearch}>
            查询
          </Button>
        </Form.Item>
      </Form>

      <DataTable<ProjectIssue>
        columns={columns}
        dataSource={data}
        loading={loading}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={(p, ps) => {
          setPage(p)
          setPageSize(ps)
        }}
      />
    </Card>
  )
}
