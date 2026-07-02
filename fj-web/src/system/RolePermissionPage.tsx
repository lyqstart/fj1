import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card,
  List,
  Button,
  Tree,
  Modal,
  Form,
  Input,
  Space,
  Typography,
  Popconfirm,
  message,
} from 'antd'
import type { DataNode } from 'antd/es/tree'
import { systemApi, type RoleWriteBody } from '@/api/systemApi'
import type { PermissionNode, Role } from './rolePermissions'

interface RoleForm extends RoleWriteBody {}

/**
 * 角色权限管理（TASK-044）。
 *
 * - 左侧：角色列表，选中后展示权限分配
 * - 权限分配使用 Tree Checkable（穿梭框在无明确权限树数据源时退化为可勾选树）
 */
export function RolePermissionPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
  const [checkedKeys, setCheckedKeys] = useState<string[]>([])

  const [createOpen, setCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createForm] = Form.useForm<RoleForm>()
  const [saveLoading, setSaveLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const list = await systemApi.getRoles()
      setRoles(list)
    } catch (e) {
      message.error('加载角色列表失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  )

  useEffect(() => {
    setCheckedKeys(selectedRole?.permissions ?? [])
  }, [selectedRole])

  /** 权限树数据（以 permission code 构建；后端未提供分组时退化为扁平列表） */
  const permissionTree = useMemo<DataNode[]>(() => {
    return RolePermissionPage_PERMISSION_TREE.map((node) => ({
      key: node.key,
      title: node.title,
      children: node.children?.map((c) => ({ key: c.key, title: c.title })),
    }))
  }, [])

  const handleCreate = async (): Promise<void> => {
    const values = await createForm.validateFields()
    setCreateLoading(true)
    try {
      await systemApi.createRole(values)
      message.success('角色已创建')
      setCreateOpen(false)
      createForm.resetFields()
      await fetchData()
    } catch (e) {
      message.error('创建失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleSavePermissions = async (): Promise<void> => {
    if (!selectedRole) return
    setSaveLoading(true)
    try {
      const updated = await systemApi.updateRole(selectedRole.id, {
        permissions: checkedKeys,
      })
      message.success('权限已保存')
      setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    } catch (e) {
      message.error('保存权限失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setSaveLoading(false)
    }
  }

  const handleDelete = async (role: Role): Promise<void> => {
    try {
      await systemApi.deleteRole(role.id)
      message.success('角色已删除')
      if (selectedRoleId === role.id) setSelectedRoleId(null)
      await fetchData()
    } catch (e) {
      message.error('删除失败')
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }

  return (
    <Card
      title="角色权限管理"
      extra={
        <Button type="primary" onClick={() => setCreateOpen(true)}>
          新增角色
        </Button>
      }
    >
      <div style={{ display: 'flex', gap: 16 }}>
        <Card title="角色列表" size="small" style={{ width: 280 }}>
          <List<Role>
            loading={loading}
            size="small"
            dataSource={roles}
            locale={{ emptyText: '暂无角色' }}
            renderItem={(item) => (
              <List.Item
                style={{
                  cursor: 'pointer',
                  background:
                    selectedRoleId === item.id ? 'rgba(24,144,255,0.08)' : undefined,
                }}
                actions={[
                  <Popconfirm
                    key="del"
                    title="确认删除该角色？"
                    onConfirm={() => handleDelete(item)}
                  >
                    <Button type="link" size="small" danger>
                      删除
                    </Button>
                  </Popconfirm>,
                ]}
                onClick={() => setSelectedRoleId(item.id)}
              >
                <Space direction="vertical" size={0}>
                  <Typography.Text strong>{item.name}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {item.code}
                  </Typography.Text>
                </Space>
              </List.Item>
            )}
          />
        </Card>

        <Card
          title="权限分配"
          size="small"
          style={{ flex: 1 }}
          extra={
            <Button
              type="primary"
              disabled={!selectedRole}
              loading={saveLoading}
              onClick={handleSavePermissions}
            >
              保存权限
            </Button>
          }
        >
          {selectedRole ? (
            <>
              <Typography.Paragraph>
                当前角色：
                <Typography.Text strong>{selectedRole.name}</Typography.Text>
              </Typography.Paragraph>
              <Tree
                checkable
                checkStrictly
                defaultExpandAll
                treeData={permissionTree}
                checkedKeys={{ checked: checkedKeys, halfChecked: [] }}
                onCheck={(checked) => {
                  if (Array.isArray(checked)) {
                    setCheckedKeys(checked as string[])
                  } else {
                    setCheckedKeys((checked as { checked: string[] }).checked)
                  }
                }}
              />
            </>
          ) : (
            <Typography.Text type="secondary">请选择左侧角色</Typography.Text>
          )}
        </Card>
      </div>

      <Modal
        title="新增角色"
        open={createOpen}
        confirmLoading={createLoading}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        destroyOnClose
      >
        <Form<RoleForm> form={createForm} layout="vertical">
          <Form.Item
            name="code"
            label="角色编码"
            rules={[{ required: true, message: '请输入角色编码' }]}
          >
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} maxLength={200} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

/**
 * 权限树静态定义（前端维度，对应 resource:action 权限码）。
 * 后续可由后端 /permissions 接口动态提供。
 */
const RolePermissionPage_PERMISSION_TREE: PermissionNode[] = [
  {
    key: 'report',
    title: '报告管理',
    children: [
      { key: 'report:generate', title: '生成报告' },
      { key: 'report:approve', title: '审批报告' },
      { key: 'report:publish', title: '发布报告' },
    ],
  },
  {
    key: 'issue',
    title: '问题管理',
    children: [
      { key: 'issue:view', title: '查看问题' },
      { key: 'issue:edit', title: '编辑问题' },
      { key: 'issue:review', title: '复核问题' },
    ],
  },
  {
    key: 'system',
    title: '系统管理',
    children: [
      { key: 'system:user', title: '用户管理' },
      { key: 'system:role', title: '角色管理' },
      { key: 'system:dict', title: '字典管理' },
    ],
  },
]
