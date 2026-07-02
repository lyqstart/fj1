import { useState } from 'react'
import { Button, Space, Modal, Input, Select, Radio, type RadioChangeEvent } from 'antd'
import {
  SEVERITY_OPTIONS,
  type IssueSeverity,
  type ProjectIssue,
  RelationType,
} from '@/api/types'

const { TextArea } = Input

/**
 * 复核动作载荷（discriminated union）。
 * 调用方（IssueReviewPanel）据此分发到对应 API。
 */
export type IssueActionPayload =
  | { type: 'pass'; comment: string }
  | { type: 'return'; comment: string }
  | { type: 'adjust'; newSeverity: IssueSeverity; comment: string }
  | { type: 'void'; comment: string }
  | { type: 'link'; targetIssueId: number; relationType: RelationType }

export interface IssueActionButtonsProps {
  issue: ProjectIssue
  /** 动作执行回调；可返回 Promise，期间弹窗按钮 loading */
  onAction: (issue: ProjectIssue, payload: IssueActionPayload) => void | Promise<void>
  /** 是否禁用所有按钮（如已关闭/作废/已纠正终态） */
  disabled?: boolean
}

type ActiveModal = 'pass' | 'return' | 'adjust' | 'void' | 'link' | null

/**
 * 问题复核操作按钮组（通过 / 退回 / 调整等级 / 作废 / 关联重复）。
 *
 * 每个动作均通过弹窗确认后回调 onAction；不在组件内部直接发请求，
 * 保持状态由调用方统一管理。
 */
export function IssueActionButtons({
  issue,
  onAction,
  disabled,
}: IssueActionButtonsProps) {
  const [active, setActive] = useState<ActiveModal>(null)
  const [submitting, setSubmitting] = useState(false)
  const [comment, setComment] = useState('')
  const [newSeverity, setNewSeverity] = useState<IssueSeverity>(issue.severity)
  const [targetIssueId, setTargetIssueId] = useState<number | null>(null)
  const [relationType, setRelationType] = useState<RelationType>(RelationType.DUPLICATE)

  const isTerminal =
    issue.status === 'CLOSED' ||
    issue.status === 'VOIDED' ||
    issue.status === 'CORRECTED'
  const allDisabled = disabled || isTerminal

  const open = (m: ActiveModal): void => {
    setComment('')
    setNewSeverity(issue.severity)
    setTargetIssueId(null)
    setRelationType(RelationType.DUPLICATE)
    setActive(m)
  }

  const handleOk = async (): Promise<void> => {
    if (!active) return
    let payload: IssueActionPayload | null = null
    switch (active) {
      case 'pass':
        payload = { type: 'pass', comment }
        break
      case 'return':
        if (!comment.trim()) return
        payload = { type: 'return', comment }
        break
      case 'adjust':
        payload = { type: 'adjust', newSeverity, comment }
        break
      case 'void':
        payload = { type: 'void', comment }
        break
      case 'link':
        if (targetIssueId === null) return
        payload = { type: 'link', targetIssueId, relationType }
        break
      default:
        return
    }
    setSubmitting(true)
    try {
      await onAction(issue, payload)
      setActive(null)
    } finally {
      setSubmitting(false)
    }
  }

  const requiresComment = active === 'return'

  return (
    <>
      <Space size="small" wrap>
        <Button size="small" type="primary" disabled={allDisabled} onClick={() => open('pass')}>
          通过
        </Button>
        <Button size="small" disabled={allDisabled} onClick={() => open('return')}>
          退回
        </Button>
        <Button size="small" disabled={allDisabled} onClick={() => open('adjust')}>
          调整等级
        </Button>
        <Button size="small" danger disabled={allDisabled} onClick={() => open('void')}>
          作废
        </Button>
        <Button size="small" disabled={allDisabled} onClick={() => open('link')}>
          关联重复
        </Button>
      </Space>

      <Modal
        title="复核操作"
        open={active !== null}
        confirmLoading={submitting}
        onCancel={() => setActive(null)}
        onOk={handleOk}
        okButtonProps={{ disabled: requiresComment && !comment.trim() }}
        destroyOnClose
      >
        {active === 'adjust' && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 6 }}>新等级：</div>
            <Select
              style={{ width: '100%' }}
              value={newSeverity}
              onChange={setNewSeverity}
              options={SEVERITY_OPTIONS}
            />
          </div>
        )}
        {active === 'link' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 6 }}>目标问题 ID：</div>
              <Input
                type="number"
                placeholder="请输入目标问题 ID"
                value={targetIssueId ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  setTargetIssueId(v === '' ? null : Number(v))
                }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 6 }}>关联类型：</div>
              <Radio.Group
                value={relationType}
                onChange={(e: RadioChangeEvent) => setRelationType(e.target.value)}
              >
                <Radio value={RelationType.DUPLICATE}>重复</Radio>
                <Radio value={RelationType.SIMILAR}>相似</Radio>
              </Radio.Group>
            </div>
          </>
        )}
        {active !== 'link' && (
          <div>
            <div style={{ marginBottom: 6 }}>
              {active === 'return' ? '退回意见（必填）：' : '备注意见：'}
            </div>
            <TextArea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={active === 'return' ? '请填写退回意见' : '选填'}
              maxLength={500}
              showCount
            />
          </div>
        )}
      </Modal>
    </>
  )
}
