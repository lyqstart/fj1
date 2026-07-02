import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card,
  Tree,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Space,
  Spin,
  Typography,
  message,
} from 'antd'
import type { DataNode } from 'antd/es/tree'
import { systemApi, type OrganizationWriteBody } from '@/api/systemApi'
import type { Organization } from '@/api/types'

interface OrgForm extends OrganizationWriteBody {}

/**
 * 组织管理（TASK-044）。
 *
 * - 从扁平组织列表构建树（parentId 自引用）
 * - 新增/编辑组织（Modal）
 */
export function OrganizationManagementPage() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedKey, setSelectedKey] = useState<number | null>(null)
  const [editTarget, setEditTarget] = useState<Organization | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [form] = Form.useForm<OrgForm>()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const list = await systemApi.getOrganizations()
      setOrgs(list)
    } catch (e) {
      message.error('加载组织列表失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  /** 构建树节点 */
  const treeData = useMemo<DataNode[]>(() => {
    const build = (parentId: number | null): DataNode[] =>
      orgs
        .filter((o) => o.parentId === parentId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((o) => ({
          key: o.id,
          title: (
            <Space>
              <span>{o.name}</span>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {o.code}
              </Typography.Text>
            </Space>
          ),
          children: build(o.id),
        }))
    return build(null)
  }, [orgs])

  const selectedOrg = useMemo(
    () => orgs.find((o) => o.id === selectedKey) ?? null,
    [orgs, selectedKey],
  )

  const openCreate = (): void => {
    setEditTarget(null)
    form.resetFields()
    form.setFieldsValue({
      parentId: selectedKey ?? null,
      name: '',
      code: '',
      sortOrder: 0,
    })
    setModalOpen(true)
  }

  const openEdit = (org: Organization): void => {
    setEditTarget(org)
    form.setFieldsValue({
      parentId: org.parentId,
      name: org.name,
      code: org.code,
      sortOrder: org.sortOrder ?? 0,
    })
    setModalOpen(true)
  }

  const handleSave = async (): Promise<void> => {
    const values = await form.validateFields()
    setSaveLoading(true)
    try {
      if (editTarget) {
        await systemApi.updateOrganization(editTarget.id, values)
        message.success('组织已更新')
      } else {
        await systemApi.createOrganization(values)
        message.success('组织已创建')
      }
      setModalOpen(false)
      await fetchData()
    } catch (e) {
      message.error('保存失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setSaveLoading(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!selectedOrg) return
    try {
      await systemApi.deleteOrganization(selectedOrg.id)
      message.success('组织已删除')
      setSelectedKey(null)
      await fetchData()
    } catch (e) {
      message.error('删除失败（可能存在下级组织）')
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }

  return (
    <Card
      title="组织管理"
      extra={
        <Space>
          <Button type="primary" onClick={openCreate}>
            新增组织
          </Button>
          <Button
            disabled={!selectedOrg}
            onClick={() => selectedOrg && openEdit(selectedOrg)}
          >
            编辑
          </Button>
          <Button danger disabled={!selectedOrg} onClick={handleDelete}>
            删除
          </Button>
        </Space>
      }
    >
      {orgs.length === 0 ? (
        loading ? (
          <Spin />
        ) : (
          <Typography.Text type="secondary">暂无组织数据</Typography.Text>
        )
      ) : (
        <Spin spinning={loading}>
          <Tree
            treeData={treeData}
            defaultExpandAll
            selectedKeys={selectedKey != null ? [selectedKey] : []}
            onSelect={(keys) =>
              setSelectedKey(keys[0] != null ? Number(keys[0]) : null)
            }
          />
        </Spin>
      )}

      <Modal
        title={editTarget ? '编辑组织' : '新增组织'}
        open={modalOpen}
        confirmLoading={saveLoading}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        destroyOnClose
      >
        <Form<OrgForm> form={form} layout="vertical">
          <Form.Item name="parentId" label="上级组织 ID">
            <InputNumber
              placeholder="留空表示顶级"
              style={{ width: '100%' }}
              min={1}
            />
          </Form.Item>
          <Form.Item
            name="name"
            label="组织名称"
            rules={[{ required: true, message: '请输入组织名称' }]}
          >
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item
            name="code"
            label="组织编码"
            rules={[{ required: true, message: '请输入组织编码' }]}
          >
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
