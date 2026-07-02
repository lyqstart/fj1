import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Tag,
  Modal,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DataTable } from '@/shared/DataTable'
import { systemApi, type UserWriteBody } from '@/api/systemApi'
import {
  USER_STATUS_COLORS,
  USER_STATUS_LABELS,
  USER_STATUS_OPTIONS,
  type IssuePage,
  type User,
  UserStatus,
} from '@/api/types'
import { formatDateTime } from '@/shared/dateUtils'

interface FilterValues {
  username?: string
  status?: UserStatus
  organizationId?: number
}

interface UserForm extends UserWriteBody {}

const PAGE_SIZE = 10

/**
 * 用户管理（TASK-044）。
 *
 * - DataTable 用户列表（用户名 / 状态筛选）
 * - 新增用户 Modal（用户名、密码、姓名、手机、邮箱）
 * - 启用/禁用用户
 */
export function UserManagementPage() {
  const [form] = Form.useForm<FilterValues>()
  const [data, setData] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(false)
  const [committed, setCommitted] = useState<FilterValues>({})

  const [createOpen, setCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createForm] = Form.useForm<UserForm>()

  const fetchData = useCallback(
    async (filter: FilterValues, p: number, ps: number) => {
      setLoading(true)
      try {
        const res: IssuePage<User> = await systemApi.getUsers({
          username: filter.username,
          status: filter.status,
          organizationId: filter.organizationId,
          page: p,
          pageSize: ps,
        })
        setData(res.items)
        setTotal(res.total)
      } catch (e) {
        message.error('加载用户列表失败')
        // eslint-disable-next-line no-console
        console.error(e)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void fetchData(committed, page, pageSize)
  }, [committed, page, pageSize, fetchData])

  const handleSearch = async (): Promise<void> => {
    const values = await form.validateFields()
    setCommitted(values)
    setPage(1)
  }

  const handleCreate = async (): Promise<void> => {
    const values = await createForm.validateFields()
    setCreateLoading(true)
    try {
      await systemApi.createUser(values)
      message.success('用户已创建')
      setCreateOpen(false)
      createForm.resetFields()
      await fetchData(committed, page, pageSize)
    } catch (e) {
      message.error('创建失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleToggleStatus = async (user: User): Promise<void> => {
    const next = user.status === UserStatus.ACTIVE ? UserStatus.DISABLED : UserStatus.ACTIVE
    try {
      await systemApi.updateUserStatus(user.id, next)
      message.success(next === UserStatus.ACTIVE ? '已启用' : '已禁用')
      setData((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: next } : u)))
    } catch (e) {
      message.error('操作失败')
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }

  const columns: ColumnsType<User> = [
    { title: '用户名', dataIndex: 'username', width: 140 },
    { title: '姓名', dataIndex: 'realName', width: 120 },
    { title: '手机', dataIndex: 'phone', width: 140 },
    { title: '邮箱', dataIndex: 'email', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: UserStatus) => (
        <Tag color={USER_STATUS_COLORS[v]}>{USER_STATUS_LABELS[v]}</Tag>
      ),
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 160, render: formatDateTime },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => handleToggleStatus(record)}>
          {record.status === UserStatus.ACTIVE ? '禁用' : '启用'}
        </Button>
      ),
    },
  ]

  return (
    <Card
      title="用户管理"
      extra={
        <Button type="primary" onClick={() => setCreateOpen(true)}>
          新增用户
        </Button>
      }
    >
      <Form<FilterValues>
        form={form}
        layout="inline"
        style={{ marginBottom: 16 }}
      >
        <Form.Item name="username" label="用户名">
          <Input placeholder="用户名" allowClear style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="status" label="状态">
          <Select
            allowClear
            placeholder="全部"
            style={{ width: 120 }}
            options={USER_STATUS_OPTIONS}
          />
        </Form.Item>
        <Form.Item name="organizationId" label="组织">
          <InputNumber placeholder="组织 ID" style={{ width: 140 }} min={1} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" onClick={handleSearch}>
            查询
          </Button>
        </Form.Item>
      </Form>

      <DataTable<User>
        columns={columns}
        dataSource={data}
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
        title="新增用户"
        open={createOpen}
        confirmLoading={createLoading}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        destroyOnClose
      >
        <Form<UserForm> form={createForm} layout="vertical">
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password maxLength={64} />
          </Form.Item>
          <Form.Item name="realName" label="姓名">
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item name="phone" label="手机">
            <Input maxLength={20} />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input maxLength={100} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
