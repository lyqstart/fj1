import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card,
  Form,
  InputNumber,
  Select,
  Button,
  Tag,
  message,
  Modal,
  Input,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DataTable } from '@/shared/DataTable'
import { issueApi, type IssueUpdateBody } from '@/api/issueApi'
import {
  ISSUE_STATUS_OPTIONS,
  ISSUE_STATUS_COLORS,
  ISSUE_STATUS_LABELS,
  SEVERITY_OPTIONS,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  type IssuePage,
  IssueSeverity,
  type IssueStatus,
  type ProjectIssue,
} from '@/api/types'
import {
  deadlineCountdownText,
  formatDateTime,
  isOverdue,
} from '@/shared/dateUtils'
import { IssueDetailDrawer } from './IssueDetailDrawer'

const { TextArea } = Input

type DeadlineFilter = 'all' | 'overdue' | 'upcoming'

const DEADLINE_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '仅超期', value: 'overdue' },
  { label: '未超期', value: 'upcoming' },
]

interface FilterValues {
  projectId: number | null
  status?: IssueStatus
  severity?: IssueSeverity
  responsiblePartyId?: number
  deadline?: DeadlineFilter
}

/**
 * 问题池页面（TASK-039）。
 *
 * - 多维度筛选：项目(必填) / 状态 / 等级 / 责任单位（服务端）
 *   + 整改期限超期情况（客户端过滤当前页，后端暂不支持该维度）
 * - 点击行打开 IssueDetailDrawer 查看详情
 * - 详情抽屉「后续更正」入口：编辑描述 / 等级
 * - 超期行整改期限标红
 */
export function IssuePoolPage() {
  const [form] = Form.useForm<FilterValues>()
  const [data, setData] = useState<ProjectIssue[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [committed, setCommitted] = useState<FilterValues>({
    projectId: null,
    deadline: 'all',
  })

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [current, setCurrent] = useState<ProjectIssue | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editDesc, setEditDesc] = useState('')
  const [editSeverity, setEditSeverity] = useState<IssueSeverity>(
    IssueSeverity.GENERAL,
  )

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
    setCommitted({ ...values, deadline: values.deadline ?? 'all' })
    setPage(1)
  }

  // 整改期限超期情况：客户端过滤当前页（后端暂不支持该维度）
  const displayData = useMemo(() => {
    const dl = committed.deadline ?? 'all'
    if (dl === 'all') return data
    return data.filter((it) => {
      const od = isOverdue(it.rectificationDeadline)
      return dl === 'overdue' ? od : !od
    })
  }, [data, committed.deadline])

  const openDetail = (record: ProjectIssue): void => {
    setCurrent(record)
    setDrawerOpen(true)
  }

  const handleCorrect = (issue: ProjectIssue): void => {
    setEditDesc(issue.description)
    setEditSeverity(issue.severity)
    setCurrent(issue)
    setEditOpen(true)
  }

  const handleEditOk = async (): Promise<void> => {
    if (!current) return
    const body: IssueUpdateBody = {
      description: editDesc.trim() || undefined,
      severity: editSeverity,
    }
    setEditLoading(true)
    try {
      const updated = await issueApi.updateIssue(current.id, body)
      message.success('问题已更新')
      setEditOpen(false)
      setCurrent(updated)
      await fetchData(committed, page, pageSize)
    } catch (e) {
      message.error('更新失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setEditLoading(false)
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
      title: '责任单位/人',
      dataIndex: 'responsiblePartyId',
      width: 120,
      render: (v: ProjectIssue['responsiblePartyId']) => v ?? '-',
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
  ]

  return (
    <Card title="问题池">
      <Form<FilterValues>
        form={form}
        layout="inline"
        initialValues={{ projectId: null, deadline: 'all' }}
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
        <Form.Item name="deadline" label="整改期限">
          <Select style={{ width: 120 }} options={DEADLINE_OPTIONS} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" onClick={handleSearch}>
            查询
          </Button>
        </Form.Item>
      </Form>

      <DataTable<ProjectIssue>
        columns={columns}
        dataSource={displayData}
        loading={loading}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={(p, ps) => {
          setPage(p)
          setPageSize(ps)
        }}
        onRow={(record: ProjectIssue) => ({
          onClick: () => openDetail(record),
          style: { cursor: 'pointer' },
        })}
      />

      <IssueDetailDrawer
        open={drawerOpen}
        issue={current}
        onClose={() => setDrawerOpen(false)}
        onCorrect={handleCorrect}
        correctLoading={editLoading}
      />

      <Modal
        title="后续更正"
        open={editOpen}
        confirmLoading={editLoading}
        onCancel={() => setEditOpen(false)}
        onOk={handleEditOk}
        destroyOnClose
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 6 }}>问题描述：</div>
          <TextArea
            rows={3}
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            maxLength={500}
            showCount
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 6 }}>等级：</div>
          <Select
            style={{ width: '100%' }}
            value={editSeverity}
            onChange={setEditSeverity}
            options={SEVERITY_OPTIONS}
          />
        </div>
      </Modal>
    </Card>
  )
}
