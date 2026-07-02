import { Button, Descriptions, Drawer, Space, Tag, Typography } from 'antd'
import {
  CORRECTION_STATUS_COLORS,
  CORRECTION_STATUS_LABELS,
  ISSUE_STATUS_COLORS,
  ISSUE_STATUS_LABELS,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  type ProjectIssue,
} from '@/api/types'
import {
  deadlineCountdownText,
  formatDateTime,
  isOverdue,
} from '@/shared/dateUtils'

export interface IssueDetailDrawerProps {
  open: boolean
  issue: ProjectIssue | null
  onClose: () => void
  /** 后续更正操作入口回调 */
  onCorrect?: (issue: ProjectIssue) => void
  /** 更正操作进行中（按钮 loading） */
  correctLoading?: boolean
}

/**
 * 问题详情抽屉（TASK-039）。
 *
 * - Descriptions 展示问题完整字段
 * - 整改期限倒计时展示 + 超期标红
 * - 后续更正操作入口按钮
 */
export function IssueDetailDrawer({
  open,
  issue,
  onClose,
  onCorrect,
  correctLoading,
}: IssueDetailDrawerProps) {
  const canCorrect =
    issue != null &&
    onCorrect != null &&
    issue.status !== 'CLOSED' &&
    issue.status !== 'VOIDED'

  const handleCorrect = (): void => {
    if (issue && onCorrect) onCorrect(issue)
  }

  return (
    <Drawer
      title="问题详情"
      width={560}
      open={open}
      onClose={onClose}
      destroyOnClose
    >
      {!issue ? (
        <Typography.Text type="secondary">加载中…</Typography.Text>
      ) : (
        <>
          <Descriptions
            column={2}
            bordered
            size="small"
            items={[
              { label: '问题编号', children: issue.issueNo },
              { label: '问题 ID', children: issue.id },
              { label: '项目 ID', children: issue.projectId },
              {
                label: '等级',
                children: (
                  <Tag color={SEVERITY_COLORS[issue.severity]}>
                    {SEVERITY_LABELS[issue.severity]}
                  </Tag>
                ),
              },
              {
                label: '状态',
                children: (
                  <Tag color={ISSUE_STATUS_COLORS[issue.status]}>
                    {ISSUE_STATUS_LABELS[issue.status]}
                  </Tag>
                ),
              },
              {
                label: '整改状态',
                children: (
                  <Tag color={CORRECTION_STATUS_COLORS[issue.correctionStatus]}>
                    {CORRECTION_STATUS_LABELS[issue.correctionStatus]}
                  </Tag>
                ),
              },
              { label: '分类', children: issue.category ?? '-' },
              {
                label: '责任单位/人 ID',
                children: issue.responsiblePartyId ?? '-',
              },
              { label: '来源日报 ID', children: issue.sourceReportId ?? '-' },
              { label: '来源问题 ID', children: issue.sourceIssueId ?? '-' },
              {
                label: '整改期限',
                children: (
                  <span
                    style={{
                      color: isOverdue(issue.rectificationDeadline)
                        ? '#ff4d4f'
                        : undefined,
                    }}
                  >
                    <div>{formatDateTime(issue.rectificationDeadline)}</div>
                    <div style={{ fontSize: 12 }}>
                      {deadlineCountdownText(issue.rectificationDeadline)}
                    </div>
                  </span>
                ),
              },
              { label: '确认时间', children: formatDateTime(issue.confirmedAt) },
              { label: '锁定时间', children: formatDateTime(issue.lockedAt) },
              { label: '创建时间', children: formatDateTime(issue.createdAt) },
            ]}
          />

          <div style={{ marginTop: 16, marginBottom: 8, fontWeight: 600 }}>
            问题描述
          </div>
          <Typography.Paragraph>{issue.description}</Typography.Paragraph>

          {canCorrect && (
            <div
              style={{
                marginTop: 24,
                borderTop: '1px solid #f0f0f0',
                paddingTop: 16,
              }}
            >
              <Space>
                <Button
                  type="primary"
                  loading={correctLoading}
                  onClick={handleCorrect}
                >
                  后续更正
                </Button>
              </Space>
            </div>
          )}
        </>
      )}
    </Drawer>
  )
}
