import { useCallback, useMemo, useState } from 'react'
import {
  Card,
  Tabs,
  Form,
  InputNumber,
  Select,
  Button,
  Tag,
  Drawer,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DataTable } from '@/shared/DataTable'
import { reportConfirmApi } from '@/api/reportConfirmApi'
import {
  DAILY_REPORT_STATUS_OPTIONS,
  DAILY_REPORT_STATUS_COLORS,
  DAILY_REPORT_STATUS_LABELS,
  type DailyReport,
  type DailyReportDetail,
  DailyReportStatus,
} from '@/api/types'
import { useAuthStore } from '@/store/authStore'
import { formatDateTime } from '@/shared/dateUtils'
import { DailyReportDetailPanel } from './DailyReportDetailPanel'
import { IssueReviewPanel } from './IssueReviewPanel'

interface FilterValues {
  projectId?: number
  date?: string // YYYY-MM-DD（DatePicker value 绑定由外层 state 管理）
  inspectorId?: number
  status?: DailyReportStatus
}

const PAGE_SIZE = 10

/**
 * 日报确认工作台（TASK-034）。
 *
 * Tab 1「日报确认」：
 *   - 日报列表（多条件筛选：项目 / 日期 / 检查员 / 状态）
 *   - 点击行展开详情 Drawer（DailyReportDetailPanel）
 *   - 确认 / 作废操作（使用当前用户作为审批人）
 * Tab 2「问题复核」：复用 IssueReviewPanel
 */
export function DailyReportConfirmPage() {
  const [activeTab, setActiveTab] = useState('reports')
  const [form] = Form.useForm<FilterValues>()
  const [reports, setReports] = useState<DailyReport[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [detail, setDetail] = useState<DailyReportDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const userId = useAuthStore((s) => s.user?.id)

  const fetchReports = useCallback(async (filter: FilterValues) => {
    setLoading(true)
    try {
      const list = await reportConfirmApi.getDailyReports({
        projectId: filter.projectId,
        date: filter.date,
        inspectorId: filter.inspectorId,
        status: filter.status,
      })
      setReports(list)
      setPage(1)
    } catch (e) {
      message.error('加载日报列表失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSearch = async (): Promise<void> => {
    const values = await form.validateFields()
    await fetchReports(values)
  }

  const openDetail = useCallback(async (record: DailyReport) => {
    setDrawerOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      const d = await reportConfirmApi.getDailyReportDetail(record.id)
      setDetail(d)
    } catch (e) {
      // 详情接口未嵌入字段时退化为列表行数据
      setDetail(record)
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const refreshDetail = useCallback(
    async (id: number) => {
      try {
        const d = await reportConfirmApi.getDailyReportDetail(id)
        setDetail(d)
      } catch {
        setDetail(null)
      }
    },
    [],
  )

  const handleConfirm = async (): Promise<void> => {
    if (!detail || userId == null) return
    setActionLoading(true)
    try {
      await reportConfirmApi.confirmReport(detail.id, userId)
      message.success('日报已确认（确认即锁定）')
      await refreshDetail(detail.id)
      // 同步刷新列表中该行状态
      setReports((prev) =>
        prev.map((r) => (r.id === detail.id ? { ...r, status: DailyReportStatus.LOCKED } : r)),
      )
    } catch (e) {
      message.error('确认失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setActionLoading(false)
    }
  }

  const handleVoid = async (): Promise<void> => {
    if (!detail || userId == null) return
    setActionLoading(true)
    try {
      await reportConfirmApi.voidReport(detail.id, userId)
      message.success('日报已作废')
      await refreshDetail(detail.id)
      setReports((prev) =>
        prev.map((r) => (r.id === detail.id ? { ...r, status: DailyReportStatus.VOIDED } : r)),
      )
    } catch (e) {
      message.error('作废失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setActionLoading(false)
    }
  }

  // 客户端分页（后端日报列表为 List，非分页）
  const pagedReports = useMemo(() => {
    const start = (page - 1) * pageSize
    return reports.slice(start, start + pageSize)
  }, [reports, page, pageSize])

  const columns: ColumnsType<DailyReport> = [
    { title: '日报日期', dataIndex: 'reportDate', width: 120 },
    { title: '检查员 ID', dataIndex: 'inspectorId', width: 100 },
    { title: '项目 ID', dataIndex: 'projectId', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (v: DailyReportStatus) => (
        <Tag color={DAILY_REPORT_STATUS_COLORS[v]}>{DAILY_REPORT_STATUS_LABELS[v]}</Tag>
      ),
    },
    { title: '提交时间', dataIndex: 'submittedAt', width: 160, render: formatDateTime },
    { title: '确认时间', dataIndex: 'confirmedAt', width: 160, render: formatDateTime },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => openDetail(record)}>
          查看详情
        </Button>
      ),
    },
  ]

  return (
    <Card>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'reports',
            label: '日报确认',
            children: (
              <>
                <Form<FilterValues>
                  form={form}
                  layout="inline"
                  style={{ marginBottom: 16 }}
                >
                  <Form.Item name="projectId" label="项目">
                    <InputNumber placeholder="项目 ID" style={{ width: 120 }} min={1} />
                  </Form.Item>
                  <Form.Item name="inspectorId" label="检查员">
                    <InputNumber placeholder="检查员 ID" style={{ width: 140 }} min={1} />
                  </Form.Item>
                  <Form.Item name="status" label="状态">
                    <Select
                      allowClear
                      placeholder="全部"
                      style={{ width: 140 }}
                      options={DAILY_REPORT_STATUS_OPTIONS}
                    />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" onClick={handleSearch}>
                      查询
                    </Button>
                  </Form.Item>
                </Form>

                <DataTable<DailyReport>
                  columns={columns}
                  dataSource={pagedReports}
                  loading={loading}
                  page={page}
                  pageSize={pageSize}
                  total={reports.length}
                  onPageChange={(p, ps) => {
                    setPage(p)
                    setPageSize(ps)
                  }}
                />
              </>
            ),
          },
          {
            key: 'review',
            label: '问题复核',
            children: <IssueReviewPanel />,
          },
        ]}
      />

      <Drawer
        title="日报详情"
        width={640}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
      >
        {detail ? (
          <DailyReportDetailPanel
            report={detail}
            loading={detailLoading}
            actionLoading={actionLoading}
            onConfirm={handleConfirm}
            onVoid={handleVoid}
          />
        ) : (
          <Typography.Text type="secondary">加载中…</Typography.Text>
        )}
      </Drawer>
    </Card>
  )
}
