import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  Button,
  Tag,
  Space,
  Modal,
  List,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DataTable } from '@/shared/DataTable'
import { reportApi } from '@/api/reportApi'
import {
  REPORT_STATUS_COLORS,
  REPORT_STATUS_LABELS,
  type ExportFile,
  type IssuePage,
  type Report,
  ReportStatus,
} from '@/api/types'
import { useAuthStore } from '@/store/authStore'
import { formatDateTime } from '@/shared/dateUtils'

/**
 * 已发布报告管理（TASK-043）。
 *
 * - 已发布报告列表（PUBLISHED）
 * - 导出固化 Word（草稿预览 / 正式发布）
 * - 导出文件记录查看
 * - 版本信息展示
 */
export function PublishedReportPage() {
  const userId = useAuthStore((s) => s.user?.id)
  const [list, setList] = useState<Report[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)

  const [exportFilesOpen, setExportFilesOpen] = useState(false)
  const [exportFiles, setExportFiles] = useState<ExportFile[]>([])
  const [filesLoading, setFilesLoading] = useState(false)

  const [exportLoadingId, setExportLoadingId] = useState<number | null>(null)

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
        message.error('加载已发布报告失败')
        // eslint-disable-next-line no-console
        console.error(e)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void fetchList(ReportStatus.PUBLISHED, page, pageSize)
  }, [page, pageSize, fetchList])

  const handleExportOfficial = async (report: Report): Promise<void> => {
    if (userId == null) return
    setExportLoadingId(report.id)
    try {
      await reportApi.exportOfficial(report.id)
      message.success('正式 Word 已生成')
    } catch (e) {
      message.error('导出失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setExportLoadingId(null)
    }
  }

  const openExportFiles = async (report: Report): Promise<void> => {
    setExportFilesOpen(true)
    setFilesLoading(true)
    try {
      const files = await reportApi.getExportFiles(report.id)
      setExportFiles(files)
    } catch (e) {
      message.error('加载导出文件失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setFilesLoading(false)
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
    { title: '发布时间', dataIndex: 'publishedAt', width: 160, render: formatDateTime },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            loading={exportLoadingId === record.id}
            onClick={() => handleExportOfficial(record)}
          >
            下载固化 Word
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => openExportFiles(record)}
          >
            导出记录
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <Card title="已发布报告">
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

      <Modal
        title="导出文件记录"
        open={exportFilesOpen}
        onCancel={() => setExportFilesOpen(false)}
        footer={null}
        width={600}
      >
        <List<ExportFile>
          loading={filesLoading}
          size="small"
          dataSource={exportFiles}
          locale={{ emptyText: '暂无导出文件' }}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space>
                    <span>{item.fileName}</span>
                    <Tag color={item.fileType === 'OFFICIAL' ? 'gold' : 'default'}>
                      {item.fileType === 'OFFICIAL' ? '正式' : '草稿'}
                    </Tag>
                  </Space>
                }
                description={
                  <Typography.Text type="secondary">
                    {formatDateTime(item.createdAt)}
                    {item.fileSize ? ` · ${Math.round(item.fileSize / 1024)} KB` : ''}
                  </Typography.Text>
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </Card>
  )
}
