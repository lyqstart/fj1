import { Button, Descriptions, Space, Spin, Steps, Table, Tag, Image, Empty, Alert } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CORRECTION_STATUS_COLORS,
  CORRECTION_STATUS_LABELS,
  DAILY_REPORT_STATUS_COLORS,
  DAILY_REPORT_STATUS_LABELS,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  type DailyReportDetail,
  type DailyReportIssue,
  type DailyReportStatus,
  type Photo,
} from '@/api/types'
import { formatDateTime } from '@/shared/dateUtils'

export interface DailyReportDetailPanelProps {
  report: DailyReportDetail
  loading?: boolean
  /** 确认日报回调（仅 SUBMITTED 状态可调用） */
  onConfirm?: () => void
  /** 作废日报回调（非 VOIDED 状态可调用） */
  onVoid?: () => void
  /** 操作进行中（按钮 loading） */
  actionLoading?: boolean
}

const APPROVAL_STEPS = [
  { title: '草稿' },
  { title: '已提交' },
  { title: '已确认' },
]

/** 根据日报状态计算审批步骤条进度 */
function approvalProgress(status: DailyReportStatus): {
  current: number
  status: 'process' | 'error' | 'finish'
} {
  switch (status) {
    case 'DRAFT':
      return { current: 0, status: 'process' }
    case 'SUBMITTED':
      return { current: 1, status: 'process' }
    case 'RETURNED':
      return { current: 1, status: 'error' }
    case 'LOCKED':
      return { current: 2, status: 'finish' }
    case 'VOIDED':
    default:
      return { current: 0, status: 'error' }
  }
}

const issueColumns: ColumnsType<DailyReportIssue> = [
  { title: '#', dataIndex: 'seqNo', width: 56 },
  { title: '问题描述', dataIndex: 'description' },
  {
    title: '等级',
    dataIndex: 'severity',
    width: 80,
    render: (v: DailyReportIssue['severity']) => (
      <Tag color={SEVERITY_COLORS[v]}>{SEVERITY_LABELS[v]}</Tag>
    ),
  },
  {
    title: '整改状态',
    dataIndex: 'correctionStatus',
    width: 100,
    render: (v: DailyReportIssue['correctionStatus']) => (
      <Tag color={CORRECTION_STATUS_COLORS[v]}>{CORRECTION_STATUS_LABELS[v]}</Tag>
    ),
  },
]

/**
 * 日报详情面板（在 Drawer 中展示）。
 *
 * - 基本信息（检查员 / 日期 / 状态 / 时间戳）
 * - 审批流可视化（Steps）
 * - 问题列表（report.issues，前向兼容）
 * - 照片预览（report.photos，前向兼容）
 * - 审批操作区域（确认 / 作废）
 */
export function DailyReportDetailPanel({
  report,
  loading,
  onConfirm,
  onVoid,
  actionLoading,
}: DailyReportDetailPanelProps) {
  const issues: DailyReportIssue[] = report.issues ?? []
  const photos: Photo[] = report.photos ?? []
  const progress = approvalProgress(report.status)
  const canConfirm = report.status === 'SUBMITTED' && onConfirm
  const canVoid = report.status !== 'VOIDED' && onVoid

  return (
    <Spin spinning={loading}>
    <div>
      {report.status === 'VOIDED' && (
        <Alert
          type="error"
          showIcon
          message="该日报已作废"
          description="作废为终态，不可再确认或修改。"
          style={{ marginBottom: 16 }}
        />
      )}

      <Descriptions
        title="基本信息"
        column={2}
        bordered
        size="small"
        items={[
          { label: '日报 ID', children: report.id },
          { label: '项目 ID', children: report.projectId },
          { label: '检查员 ID', children: report.inspectorId },
          {
            label: '日报日期',
            children: report.reportDate,
          },
          {
            label: '状态',
            children: (
              <Tag color={DAILY_REPORT_STATUS_COLORS[report.status]}>
                {DAILY_REPORT_STATUS_LABELS[report.status]}
              </Tag>
            ),
          },
          { label: '任务 ID', children: report.taskId ?? '-' },
          { label: '提交时间', children: formatDateTime(report.submittedAt) },
          { label: '确认时间', children: formatDateTime(report.confirmedAt) },
          { label: '锁定时间', children: formatDateTime(report.lockedAt) },
        ]}
      />

      <div style={{ marginTop: 24, marginBottom: 8, fontWeight: 600 }}>审批进度</div>
      <Steps
        current={progress.current}
        status={progress.status}
        items={APPROVAL_STEPS}
        size="small"
      />

      <div style={{ marginTop: 24, marginBottom: 8, fontWeight: 600 }}>
        问题列表（{issues.length}）
      </div>
      {issues.length === 0 ? (
        <Empty description="暂无问题数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Table<DailyReportIssue>
          size="small"
          rowKey="id"
          columns={issueColumns}
          dataSource={issues}
          pagination={false}
        />
      )}

      <div style={{ marginTop: 24, marginBottom: 8, fontWeight: 600 }}>
        照片（{photos.length}）
      </div>
      {photos.length === 0 ? (
        <Empty description="暂无照片" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Image.PreviewGroup>
          <Space wrap size={[8, 8]}>
            {photos.map((p) => (
              <div
                key={p.id}
                style={{
                  width: 96,
                  fontSize: 12,
                  color: '#888',
                  textAlign: 'center',
                }}
              >
                <Image
                  width={96}
                  height={72}
                  src={p.compressedFilePath ?? undefined}
                  fallback="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5NiIgaGVpZ2h0PSI3MiIvPg=="
                />
                <div>{p.photoType ?? '照片'}</div>
              </div>
            ))}
          </Space>
        </Image.PreviewGroup>
      )}

      {(canConfirm || canVoid) && (
        <div style={{ marginTop: 24, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          <Space>
            {canConfirm && (
              <Button type="primary" loading={actionLoading} onClick={onConfirm}>
                确认日报
              </Button>
            )}
            {canVoid && (
              <Button danger loading={actionLoading} onClick={onVoid}>
                作废日报
              </Button>
            )}
          </Space>
        </div>
      )}
    </div>
    </Spin>
  )
}
