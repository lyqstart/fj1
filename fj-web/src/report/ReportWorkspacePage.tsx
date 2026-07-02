import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Button,
  Space,
  Tag,
  message,
  Divider,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { DataTable } from '@/shared/DataTable'
import type { ColumnsType } from 'antd/es/table'
import { reportApi } from '@/api/reportApi'
import {
  REPORT_STATUS_COLORS,
  REPORT_STATUS_LABELS,
  type IssuePage,
  type Report,
  ReportStatus,
} from '@/api/types'
import { useAuthStore } from '@/store/authStore'
import { formatDateTime } from '@/shared/dateUtils'
import { IssueSelectionPanel } from './IssueSelectionPanel'

interface GenerateForm {
  projectId: number
  title: string
  range?: [dayjs.Dayjs, dayjs.Dayjs]
}

/**
 * 报告生产工作台（TASK-043）。
 *
 * - 上部：生成草稿表单（项目 / 标题 / 时间范围 + 生成按钮）
 * - 生成后：报告基本信息编辑 + 问题清单管理（IssueSelectionPanel）
 * - 提交审批按钮（DRAFT → IN_APPROVAL）
 * - 下部：已生成报告列表（DataTable），可跳转快照编辑
 */
export function ReportWorkspacePage() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id)
  const [form] = Form.useForm<GenerateForm>()

  const [current, setCurrent] = useState<Report | null>(null)
  const [selectedIssueIds, setSelectedIssueIds] = useState<number[]>([])
  const [editTitle, setEditTitle] = useState('')
  const [generateLoading, setGenerateLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)

  const [list, setList] = useState<Report[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [listLoading, setListLoading] = useState(false)

  const fetchList = useCallback(
    async (p: number, ps: number) => {
      setListLoading(true)
      try {
        const res: IssuePage<Report> = await reportApi.list({
          page: p,
          pageSize: ps,
        })
        setList(res.items)
        setTotal(res.total)
      } catch (e) {
        message.error('加载报告列表失败')
        // eslint-disable-next-line no-console
        console.error(e)
      } finally {
        setListLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void fetchList(page, pageSize)
  }, [page, pageSize, fetchList])

  const handleGenerate = async (): Promise<void> => {
    const values = await form.validateFields()
    if (!values.range) {
      message.warning('请选择时间范围')
      return
    }
    setGenerateLoading(true)
    try {
      const report = await reportApi.generate({
        projectId: values.projectId,
        title: values.title,
        periodStart: values.range[0].format('YYYY-MM-DD'),
        periodEnd: values.range[1].format('YYYY-MM-DD'),
      })
      message.success(`草稿已生成：${report.reportNo}`)
      setCurrent(report)
      setEditTitle(report.title)
      setSelectedIssueIds([])
    } catch (e) {
      message.error('生成草稿失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setGenerateLoading(false)
    }
  }

  const handleSaveBase = async (): Promise<void> => {
    if (!current) return
    setSaveLoading(true)
    try {
      const updated = await reportApi.update(current.id, { title: editTitle })
      message.success('报告信息已保存')
      setCurrent(updated)
    } catch (e) {
      message.error('保存失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setSaveLoading(false)
    }
  }

  const handleSelectIssues = async (): Promise<void> => {
    if (!current) return
    try {
      const updated = await reportApi.selectIssues(current.id, selectedIssueIds)
      setCurrent(updated)
      message.success('问题清单已更新')
    } catch (e) {
      message.error('问题清单更新失败')
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }

  const handleSubmitApproval = async (): Promise<void> => {
    if (!current || userId == null) return
    setSubmitLoading(true)
    try {
      const updated = await reportApi.submitApproval(current.id, userId)
      message.success('已提交审批')
      setCurrent(updated)
      await fetchList(page, pageSize)
    } catch (e) {
      message.error('提交审批失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setSubmitLoading(false)
    }
  }

  const listColumns: ColumnsType<Report> = [
    { title: '报告编号', dataIndex: 'reportNo', width: 160 },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    {
      title: '版本',
      dataIndex: 'reportVersion',
      width: 80,
      render: (v: number) => `v${v}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: ReportStatus) => (
        <Tag color={REPORT_STATUS_COLORS[v]}>{REPORT_STATUS_LABELS[v]}</Tag>
      ),
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 160, render: formatDateTime },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => navigate(`/reports/${record.id}/snapshots`)}
        >
          编辑快照
        </Button>
      ),
    },
  ]

  const isDraft = current?.status === ReportStatus.DRAFT

  return (
    <Card title="报告生产工作台">
      <Form<GenerateForm>
        form={form}
        layout="inline"
        style={{ marginBottom: 16 }}
      >
        <Form.Item
          name="projectId"
          label="项目"
          rules={[{ required: true, message: '请输入项目 ID' }]}
        >
          <InputNumber placeholder="项目 ID" style={{ width: 120 }} min={1} />
        </Form.Item>
        <Form.Item
          name="title"
          label="标题"
          rules={[{ required: true, message: '请输入报告标题' }]}
        >
          <Input placeholder="报告标题" style={{ width: 240 }} maxLength={100} />
        </Form.Item>
        <Form.Item
          name="range"
          label="时间范围"
          rules={[{ required: true, message: '请选择时间范围' }]}
        >
          <DatePicker.RangePicker style={{ width: 260 }} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" loading={generateLoading} onClick={handleGenerate}>
            生成草稿
          </Button>
        </Form.Item>
      </Form>

      {current ? (
        <Card
          size="small"
          style={{ marginBottom: 16 }}
          title={
            <Space>
              <Typography.Text strong>{current.reportNo}</Typography.Text>
              <Tag color={REPORT_STATUS_COLORS[current.status]}>
                {REPORT_STATUS_LABELS[current.status]}
              </Tag>
            </Space>
          }
        >
          <Space style={{ marginBottom: 12 }}>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              style={{ width: 320 }}
              disabled={!isDraft}
              placeholder="报告标题"
            />
            <Button onClick={handleSaveBase} loading={saveLoading} disabled={!isDraft}>
              保存信息
            </Button>
            <Button
              onClick={handleSelectIssues}
              disabled={!isDraft}
            >
              同步问题清单
            </Button>
            <Button
              type="primary"
              onClick={handleSubmitApproval}
              loading={submitLoading}
              disabled={!isDraft}
            >
              提交审批
            </Button>
          </Space>
          <Divider style={{ margin: '8px 0' }} />
          <IssueSelectionPanel
            projectId={current.projectId}
            selectedIssueIds={selectedIssueIds}
            onChange={setSelectedIssueIds}
          />
        </Card>
      ) : (
        <Typography.Text type="secondary">
          生成草稿后可在此编辑报告信息与问题清单
        </Typography.Text>
      )}

      <Divider />

      <DataTable<Report>
        columns={listColumns}
        dataSource={list}
        loading={listLoading}
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
