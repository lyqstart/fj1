import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  Form,
  InputNumber,
  Button,
  Tag,
  message,
  Modal,
  Input,
  Select,
  Empty,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DataTable } from '@/shared/DataTable'
import { issueApi, type IssueUpdateBody } from '@/api/issueApi'
import { useAuthStore } from '@/store/authStore'
import {
  ISSUE_STATUS_COLORS,
  ISSUE_STATUS_LABELS,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  SEVERITY_OPTIONS,
  type IssuePage,
  IssueSeverity,
  type ProjectIssue,
} from '@/api/types'
import {
  deadlineCountdownText,
  formatDateTime,
  isOverdue,
} from '@/shared/dateUtils'

const { TextArea } = Input

interface FilterValues {
  projectId: number | null
}

/**
 * 我的问题页面（TASK-039）。
 *
 * - 使用 authStore 获取当前用户 ID，按 responsiblePartyId 过滤
 * - 后续更正操作：快速编辑描述 / 等级（issueApi.updateIssue）
 *
 * 注意：后端 /issues 接口 projectId 为必填项，故本页需指定项目 ID。
 */
export function MyIssuesPage() {
  const userId = useAuthStore((s) => s.user?.id)
  const [form] = Form.useForm<FilterValues>()
  const [data, setData] = useState<ProjectIssue[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [committed, setCommitted] = useState<FilterValues>({ projectId: null })

  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editTarget, setEditTarget] = useState<ProjectIssue | null>(null)
  const [editDesc, setEditDesc] = useState('')
  const [editSeverity, setEditSeverity] = useState<IssueSeverity>(
    IssueSeverity.GENERAL,
  )

  const fetchData = useCallback(
    async (uid: number, pid: number | null, p: number, ps: number) => {
      if (pid == null) {
        setData([])
        setTotal(0)
        return
      }
      setLoading(true)
      try {
        const res: IssuePage<ProjectIssue> = await issueApi.getMyIssues(uid, {
          projectId: pid,
          page: p,
          pageSize: ps,
        })
        setData(res.items)
        setTotal(res.total)
      } catch (e) {
        message.error('加载我的问题失败')
        // eslint-disable-next-line no-console
        console.error(e)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (userId == null) return
    void fetchData(userId, committed.projectId, page, pageSize)
  }, [userId, committed, page, pageSize, fetchData])

  const handleSearch = async (): Promise<void> => {
    const values = await form.validateFields()
    setCommitted(values)
    setPage(1)
  }

  const openEdit = (issue: ProjectIssue): void => {
    setEditTarget(issue)
    setEditDesc(issue.description)
    setEditSeverity(issue.severity)
    setEditOpen(true)
  }

  const handleEditOk = async (): Promise<void> => {
    if (!editTarget) return
    const body: IssueUpdateBody = {
      description: editDesc.trim() || undefined,
      severity: editSeverity,
    }
    setEditLoading(true)
    try {
      const updated = await issueApi.updateIssue(editTarget.id, body)
      message.success('问题已更新')
      setEditOpen(false)
      setData((prev) => prev.map((it) => (it.id === updated.id ? updated : it)))
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
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => openEdit(record)}>
          编辑
        </Button>
      ),
    },
  ]

  if (userId == null) {
    return (
      <Card title="我的问题">
        <Empty description="未检测到登录用户，请先登录" />
      </Card>
    )
  }

  return (
    <Card title="我的问题">
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
          <InputNumber placeholder="项目 ID" style={{ width: 140 }} min={1} />
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

      <Modal
        title="快速编辑"
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
