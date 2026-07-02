import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Button,
  Space,
  Input,
  Form,
  message,
  Typography,
  List,
  Tag,
  Popconfirm,
  Spin,
} from 'antd'
import { useParams } from 'react-router-dom'
import { reportApi } from '@/api/reportApi'
import {
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  type Report,
  type ReportSnapshot,
} from '@/api/types'
import { SnapshotComparisonView } from './SnapshotComparisonView'

const { TextArea } = Input

interface SnapshotEditForm {
  description: string
  snapshotNote: string
}

/**
 * 快照编辑页（TASK-043）。
 *
 * 左侧：原问题信息 + 快照列表；右侧：选中快照的编辑表单 + 对照视图。
 */
export function ReportSnapshotEditorPage() {
  const params = useParams<{ id: string }>()
  const reportId = Number(params.id)

  const [report, setReport] = useState<Report | null>(null)
  const [snapshots, setSnapshots] = useState<ReportSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState<ReportSnapshot | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [addIssueId, setAddIssueId] = useState<number | null>(null)
  const [addLoading, setAddLoading] = useState(false)
  const [form] = Form.useForm<SnapshotEditForm>()

  const fetchData = useCallback(async (id: number) => {
    setLoading(true)
    try {
      const [r, snaps] = await Promise.all([
        reportApi.detail(id),
        reportApi.getSnapshots(id),
      ])
      setReport(r)
      setSnapshots(snaps)
      if (snaps.length > 0) {
        setActive(snaps[0])
        form.setFieldsValue({
          description: snaps[0].description,
          snapshotNote: snaps[0].snapshotNote ?? '',
        })
      }
    } catch (e) {
      message.error('加载快照数据失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [form])

  useEffect(() => {
    if (Number.isFinite(reportId) && reportId > 0) {
      void fetchData(reportId)
    }
  }, [reportId, fetchData])

  const handleSelectSnapshot = (snap: ReportSnapshot): void => {
    setActive(snap)
    form.setFieldsValue({
      description: snap.description,
      snapshotNote: snap.snapshotNote ?? '',
    })
  }

  const handleSave = async (): Promise<void> => {
    if (!active) return
    const values = await form.validateFields()
    setSaveLoading(true)
    try {
      const updated = await reportApi.editSnapshot(reportId, active.id, {
        description: values.description.trim() || undefined,
        snapshotNote: values.snapshotNote.trim() || undefined,
      })
      message.success('快照已保存')
      setActive(updated)
      setSnapshots((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s)),
      )
    } catch (e) {
      message.error('保存失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setSaveLoading(false)
    }
  }

  const handleRemove = async (snap: ReportSnapshot): Promise<void> => {
    try {
      await reportApi.removeSnapshot(reportId, snap.id)
      message.success('快照已删除')
      const next = snapshots.filter((s) => s.id !== snap.id)
      setSnapshots(next)
      if (active?.id === snap.id) {
        setActive(next[0] ?? null)
        if (next[0]) {
          form.setFieldsValue({
            description: next[0].description,
            snapshotNote: next[0].snapshotNote ?? '',
          })
        }
      }
    } catch (e) {
      message.error('删除失败')
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }

  const handleAdd = async (): Promise<void> => {
    if (addIssueId == null) return
    setAddLoading(true)
    try {
      const created = await reportApi.addSnapshot(reportId, addIssueId)
      message.success('问题快照已添加')
      setSnapshots((prev) => [...prev, created])
      setActive(created)
      form.setFieldsValue({
        description: created.description,
        snapshotNote: created.snapshotNote ?? '',
      })
      setAddIssueId(null)
    } catch (e) {
      message.error('添加快照失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setAddLoading(false)
    }
  }

  return (
    <Card
      title={
        <Space>
          <span>快照编辑</span>
          {report ? (
            <Typography.Text type="secondary">
              {report.reportNo} · {report.title}
            </Typography.Text>
          ) : null}
        </Space>
      }
    >
      <Spin spinning={loading}>
        <Row gutter={16}>
          <Col span={8}>
            <Card title="快照列表" size="small">
              <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
                <Input
                  placeholder="问题 ID"
                  type="number"
                  value={addIssueId ?? ''}
                  onChange={(e) =>
                    setAddIssueId(e.target.value ? Number(e.target.value) : null)
                  }
                />
                <Button type="primary" loading={addLoading} onClick={handleAdd}>
                  添加
                </Button>
              </Space.Compact>
              <List<ReportSnapshot>
                size="small"
                dataSource={snapshots}
                locale={{ emptyText: '暂无快照' }}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Popconfirm
                        key="del"
                        title="确认删除该快照？"
                        onConfirm={() => handleRemove(item)}
                      >
                        <Button type="link" size="small" danger>
                          删除
                        </Button>
                      </Popconfirm>,
                    ]}
                    onClick={() => handleSelectSnapshot(item)}
                    style={{
                      cursor: 'pointer',
                      background:
                        active?.id === item.id ? 'rgba(24,144,255,0.08)' : undefined,
                    }}
                  >
                    <Space direction="vertical" size={0}>
                      <Space>
                        <span>{item.issueNo}</span>
                        <Tag color={SEVERITY_COLORS[item.severity]}>
                          {SEVERITY_LABELS[item.severity]}
                        </Tag>
                      </Space>
                      <Typography.Text type="secondary" ellipsis style={{ maxWidth: 200 }}>
                        {item.description}
                      </Typography.Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col span={16}>
            {active ? (
              <Card title={`编辑快照：${active.issueNo}`} size="small">
                <Form<SnapshotEditForm>
                  form={form}
                  layout="vertical"
                >
                  <Form.Item
                    name="description"
                    label="问题描述（可固化改写）"
                    rules={[{ required: true, message: '请输入问题描述' }]}
                  >
                    <TextArea rows={3} maxLength={500} showCount />
                  </Form.Item>
                  <Form.Item name="snapshotNote" label="快照备注">
                    <TextArea rows={2} maxLength={200} showCount />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" loading={saveLoading} onClick={handleSave}>
                      保存快照
                    </Button>
                  </Form.Item>
                </Form>

                <Typography.Title level={5}>对照视图</Typography.Title>
                <SnapshotComparisonView snapshot={active} />
              </Card>
            ) : (
              <Typography.Text type="secondary">
                请选择或添加一个快照
              </Typography.Text>
            )}
          </Col>
        </Row>
      </Spin>
    </Card>
  )
}
