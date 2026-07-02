import { Timeline, Typography, Tag, Spin, Empty } from 'antd'
import type { ApprovalRecord } from '@/api/types'
import { formatDateTime } from '@/shared/dateUtils'

interface ApprovalHistoryPanelProps {
  records: ApprovalRecord[]
  loading?: boolean
}

/**
 * 审批记录历史（TASK-043）。
 *
 * 以 Timeline 展示审批流程：每步包含审批人、操作、意见、时间。
 */
export function ApprovalHistoryPanel({
  records,
  loading,
}: ApprovalHistoryPanelProps) {
  if (loading) {
    return <Spin />
  }
  if (records.length === 0) {
    return <Empty description="暂无审批记录" />
  }
  return (
    <Timeline
      items={records.map((r) => {
        const isApprove = r.action === 'APPROVE'
        return {
          color: isApprove ? 'green' : 'red',
          children: (
            <div>
              <div>
                <Tag color={isApprove ? 'success' : 'error'}>
                  {isApprove ? '通过' : '退回'}
                </Tag>
                <Typography.Text type="secondary">
                  审批人 ID: {r.approverId} · {formatDateTime(r.createdAt)}
                </Typography.Text>
              </div>
              {r.comment ? (
                <Typography.Paragraph style={{ marginTop: 4, marginBottom: 0 }}>
                  意见：{r.comment}
                </Typography.Paragraph>
              ) : null}
            </div>
          ),
        }
      })}
    />
  )
}
