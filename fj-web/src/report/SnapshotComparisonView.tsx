import { Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { ProjectIssue, ReportSnapshot } from '@/api/types'
import {
  SEVERITY_COLORS,
  SEVERITY_LABELS,
} from '@/api/types'

interface SnapshotComparisonViewProps {
  /** 原问题信息（只读） */
  issue?: ProjectIssue
  /** 当前快照（固化信息） */
  snapshot: ReportSnapshot
}

interface CompareRow {
  key: string
  label: string
  original: string
  snapshot: string
  changed: boolean
}

/**
 * 快照对照视图（TASK-043）。
 *
 * 以表格形式对比原问题信息与快照固化信息，变更字段高亮。
 */
export function SnapshotComparisonView({
  issue,
  snapshot,
}: SnapshotComparisonViewProps) {
  const originalSeverity = issue ? SEVERITY_LABELS[issue.severity] : '-'
  const snapshotSeverity = SEVERITY_LABELS[snapshot.severity]

  const rows: CompareRow[] = [
    {
      key: 'description',
      label: '问题描述',
      original: issue?.description ?? '-',
      snapshot: snapshot.description,
      changed: !!issue && issue.description !== snapshot.description,
    },
    {
      key: 'severity',
      label: '严重等级',
      original: originalSeverity,
      snapshot: snapshotSeverity,
      changed: !!issue && issue.severity !== snapshot.severity,
    },
    {
      key: 'category',
      label: '问题分类',
      original: issue?.category ?? '-',
      snapshot: snapshot.category ?? '-',
      changed: !!issue && (issue.category ?? '') !== (snapshot.category ?? ''),
    },
    {
      key: 'responsiblePartyId',
      label: '责任单位/人',
      original: issue?.responsiblePartyId != null ? String(issue.responsiblePartyId) : '-',
      snapshot:
        snapshot.responsiblePartyId != null ? String(snapshot.responsiblePartyId) : '-',
      changed:
        (issue?.responsiblePartyId ?? null) !== (snapshot.responsiblePartyId ?? null),
    },
    {
      key: 'note',
      label: '快照备注',
      original: '-',
      snapshot: snapshot.snapshotNote ?? '-',
      changed: !!snapshot.snapshotNote,
    },
  ]

  const columns: ColumnsType<CompareRow> = [
    { title: '字段', dataIndex: 'label', width: 120 },
    {
      title: '原问题',
      dataIndex: 'original',
      render: (v: string, row) =>
        row.key === 'severity' ? (
          <Tag color={issue ? SEVERITY_COLORS[issue.severity] : 'default'}>{v}</Tag>
        ) : (
          <Typography.Text type="secondary">{v}</Typography.Text>
        ),
    },
    {
      title: '快照',
      dataIndex: 'snapshot',
      render: (v: string, row) =>
        row.key === 'severity' ? (
          <Tag color={SEVERITY_COLORS[snapshot.severity]}>{v}</Tag>
        ) : (
          <Typography.Text mark={row.changed}>{v}</Typography.Text>
        ),
    },
  ]

  return (
    <Table<CompareRow>
      columns={columns}
      dataSource={rows}
      pagination={false}
      size="small"
      rowKey="key"
    />
  )
}
