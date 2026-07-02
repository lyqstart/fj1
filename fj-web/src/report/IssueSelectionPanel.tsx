import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Input, List, Button, Tag, Empty, Space, Spin, message } from 'antd'
import type { ProjectIssue } from '@/api/types'
import {
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  type IssuePage,
} from '@/api/types'
import { issueApi } from '@/api/issueApi'

interface IssueSelectionPanelProps {
  /** 当前编辑报告所属项目（必填，问题池查询依赖） */
  projectId: number | null
  /** 已选问题 ID 列表 */
  selectedIssueIds: number[]
  /** 选中变化回调 */
  onChange: (issueIds: number[]) => void
}

/**
 * 问题选择面板（TASK-043）。
 *
 * 双栏布局：左侧为可选问题池（按项目查询），右侧为已选问题。
 * 支持关键字搜索与添加/移除操作。
 */
export function IssueSelectionPanel({
  projectId,
  selectedIssueIds,
  onChange,
}: IssueSelectionPanelProps) {
  const [candidates, setCandidates] = useState<ProjectIssue[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')

  const fetchCandidates = useCallback(async (pid: number | null) => {
    if (pid == null) {
      setCandidates([])
      return
    }
    setLoading(true)
    try {
      const res: IssuePage<ProjectIssue> = await issueApi.getIssues({
        projectId: pid,
        page: 1,
        pageSize: 50,
      })
      setCandidates(res.items)
    } catch (e) {
      message.error('加载问题池失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchCandidates(projectId)
  }, [projectId, fetchCandidates])

  const selectable = useMemo(
    () => candidates.filter((it) => !selectedIssueIds.includes(it.id)),
    [candidates, selectedIssueIds],
  )

  const selected = useMemo(
    () =>
      candidates.filter((it) => selectedIssueIds.includes(it.id)),
    [candidates, selectedIssueIds],
  )

  const filteredSelectable = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return selectable
    return selectable.filter(
      (it) =>
        it.issueNo.toLowerCase().includes(kw) ||
        it.description.toLowerCase().includes(kw),
    )
  }, [selectable, keyword])

  const handleAdd = (issue: ProjectIssue): void => {
    onChange([...selectedIssueIds, issue.id])
  }

  const handleRemove = (issue: ProjectIssue): void => {
    onChange(selectedIssueIds.filter((id) => id !== issue.id))
  }

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <Card
        title="可选问题"
        size="small"
        style={{ flex: 1 }}
        extra={
          <Input.Search
            allowClear
            placeholder="搜索编号/描述"
            size="small"
            style={{ width: 180 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        }
      >
        {projectId == null ? (
          <Empty description="请先填写项目 ID" />
        ) : (
          <Spin spinning={loading}>
            <List<ProjectIssue>
              size="small"
              dataSource={filteredSelectable}
              locale={{ emptyText: '无可选问题' }}
              style={{ maxHeight: 360, overflow: 'auto' }}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      key="add"
                      type="link"
                      size="small"
                      onClick={() => handleAdd(item)}
                    >
                      添加
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>{item.issueNo}</span>
                        <Tag color={SEVERITY_COLORS[item.severity]}>
                          {SEVERITY_LABELS[item.severity]}
                        </Tag>
                      </Space>
                    }
                    description={item.description}
                  />
                </List.Item>
              )}
            />
          </Spin>
        )}
      </Card>

      <Card title={`已选问题（${selected.length}）`} size="small" style={{ flex: 1 }}>
        <List<ProjectIssue>
          size="small"
          dataSource={selected}
          locale={{ emptyText: '尚未选择问题' }}
          style={{ maxHeight: 360, overflow: 'auto' }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="remove"
                  type="link"
                  size="small"
                  danger
                  onClick={() => handleRemove(item)}
                >
                  移除
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <span>{item.issueNo}</span>
                    <Tag color={SEVERITY_COLORS[item.severity]}>
                      {SEVERITY_LABELS[item.severity]}
                    </Tag>
                  </Space>
                }
                description={item.description}
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}
