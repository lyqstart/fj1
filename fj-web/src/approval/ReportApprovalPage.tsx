import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  Button,
  Space,
  Tag,
  Modal,
  Input,
  Form,
  message,
  Typography,
  Drawer,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DataTable } from '@/shared/DataTable'
import { reportApi } from '@/api/reportApi'
import {
  REPORT_STATUS_COLORS,
  REPORT_STATUS_LABELS,
  type ApprovalRecord,
  type IssuePage,
  type Report,
  ReportStatus,
} from '@/api/types'
import { useAuthStore } from '@/store/authStore'
import { formatDateTime } from '@/shared/dateUtils'
import { ApprovalHistoryPanel } from './ApprovalHistoryPanel'

const { TextArea } = Input

interface ApproveForm {
  comment: string
}

/**
 * 报告审批处理页（TASK-043）。
 *
 * - 待审批报告列表（默认筛选 IN_APPROVAL）
 * - 点击行打开 Drawer 查看详情与审批历史
 * - 通过 / 退回操作（含审批意见输入）
 */
export function ReportApprovalPage() {
  const userId = useAuthStore((s) => s.user?.id)
  const [list, setList] = useState<Report[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [current, setCurrent] = useState<Report | null>(null)
  const [records, setRecords] = useState<ApprovalRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'approve' | 'reject'>('approve')
  const [form] = Form.useForm<ApproveForm>()

  const fetchList = useCallback(
    async (status: ReportStatus, p: number, ps: number) => {
      setLoading(true)
      try {
        const res: IssuePage<Report> = await reportApi.list({
          status,
          page: p,
          pageSize: ps,
        })
        setList(res.items)
        setTotal(res.total)
      } catch (e) {
        message.error('加载审批列表失败')
        // eslint-disable-next-line no-console
        console.error(e)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void fetchList(ReportStatus.IN_APPROVAL, page, pageSize)
  }, [page, pageSize, fetchList])

  const openDetail = useCallback(async (report: Report) => {
    setDrawerOpen(true)
    setCurrent(report)
    setRecords([])
    setRecordsLoading(true)
    try {
      const recs = await reportApi.getApprovalRecords(report.id)
      setRecords(recs)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setRecordsLoading(false)
    }
  }, [])

  const openAction = (mode: 'approve' | 'reject'): void => {
    setModalMode(mode)
    form.resetFields()
    setModalOpen(true)
  }

  const handleAction = async (): Promise<void> => {
    if (!current || userId == null) return
    const values = await form.validateFields()
    setActionLoading(true)
    try {
      const updated =
        modalMode === 'approve'
          ? await reportApi.approve(current.id, userId, values.comment.trim())
          : await reportApi.reject(current.id, userId, values.comment.trim())
      message.success(modalMode === 'approve' ? '已通过审批' : '已退回')
      setCurrent(updated)
      setModalOpen(false)
      await fetchList(ReportStatus.IN_APPROVAL, page, pageSize)
    } catch (e) {
      message.error('操作失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setActionLoading(false)
    }
  }

  const columns: ColumnsType<Report> = [
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
    { title: '提交时间', dataIndex: 'submittedAt', width: 160, render: formatDateTime },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => openDetail(record)}>
          审批
        </Button>
      ),
    },
  ]

  return (
    <Card title="报告审批">
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        仅展示审批中（IN_APPROVAL）的报告
      </Typography.Text>
      <DataTable<Report>
        columns={columns}
        dataSource={list}
        loading={loading}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={(p, ps) => {
          setPage(p)
          setPageSize(ps)
        }}
      />

      <Drawer
        title="报告审批"
        width={560}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
      >
        {current ? (
          <>
            <Typography.Title level={5}>{current.title}</Typography.Title>
            <Space style={{ marginBottom: 12 }}>
              <Tag color={REPORT_STATUS_COLORS[current.status]}>
                {REPORT_STATUS_LABELS[current.status]}
              </Tag>
              <Typography.Text type="secondary">
                {current.reportNo} · v{current.reportVersion}
              </Typography.Text>
            </Space>
            <Typography.Paragraph type="secondary">
              时间范围：{current.periodStart} ~ {current.periodEnd}
            </Typography.Paragraph>

            <Space style={{ marginBottom: 24 }}>
              <Button
                type="primary"
                onClick={() => openAction('approve')}
                loading={actionLoading}
              >
                通过
              </Button>
              <Button danger onClick={() => openAction('reject')} loading={actionLoading}>
                退回
              </Button>
            </Space>

            <Typography.Title level={5}>审批记录</Typography.Title>
            <ApprovalHistoryPanel records={records} loading={recordsLoading} />
          </>
        ) : (
          <Typography.Text type="secondary">加载中…</Typography.Text>
        )}
      </Drawer>

      <Modal
        title={modalMode === 'approve' ? '审批通过' : '审批退回'}
        open={modalOpen}
        confirmLoading={actionLoading}
        onCancel={() => setModalOpen(false)}
        onOk={handleAction}
        destroyOnClose
      >
        <Form<ApproveForm> form={form} layout="vertical">
          <Form.Item
            name="comment"
            label="审批意见"
            rules={[{ required: true, message: '请输入审批意见' }]}
          >
            <TextArea rows={4} maxLength={500} showCount placeholder="请输入审批意见" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
