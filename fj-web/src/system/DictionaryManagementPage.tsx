import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card,
  Tabs,
  Input,
  Button,
  Modal,
  Form,
  InputNumber,
  Switch,
  Space,
  Popconfirm,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DataTable } from '@/shared/DataTable'
import { systemApi, type DictionaryItemWriteBody } from '@/api/systemApi'
import type { DictionaryCategory, DictionaryItem } from '@/api/types'
import { formatDateTime } from '@/shared/dateUtils'

interface DictForm extends DictionaryItemWriteBody {}

/**
 * 数据字典管理（TASK-044）。
 *
 * - 分类 Tab 切换
 * - 字典项 DataTable（新增/编辑/删除）
 * - 启用/禁用、排序
 */
export function DictionaryManagementPage() {
  const [items, setItems] = useState<DictionaryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState(
    DICTIONARY_CATEGORIES[0]?.code ?? '',
  )

  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<DictionaryItem | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [form] = Form.useForm<DictForm>()

  const fetchData = useCallback(async (categoryCode: string) => {
    if (!categoryCode) {
      setItems([])
      return
    }
    setLoading(true)
    try {
      const list = await systemApi.getDictionaryItems(categoryCode)
      setItems(list)
    } catch (e) {
      message.error('加载字典项失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData(activeCategory)
  }, [activeCategory, fetchData])

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder),
    [items],
  )

  const openCreate = (): void => {
    setEditTarget(null)
    form.resetFields()
    form.setFieldsValue({
      categoryCode: activeCategory,
      code: '',
      name: '',
      sortOrder: 0,
      enabled: true,
    })
    setEditOpen(true)
  }

  const openEdit = (item: DictionaryItem): void => {
    setEditTarget(item)
    form.setFieldsValue({
      categoryCode: item.categoryCode,
      code: item.code,
      name: item.name,
      sortOrder: item.sortOrder,
      enabled: item.enabled,
    })
    setEditOpen(true)
  }

  const handleSave = async (): Promise<void> => {
    const values = await form.validateFields()
    setSaveLoading(true)
    try {
      if (editTarget) {
        await systemApi.updateDictionaryItem(editTarget.id, values)
        message.success('字典项已更新')
      } else {
        await systemApi.createDictionaryItem(values)
        message.success('字典项已创建')
      }
      setEditOpen(false)
      await fetchData(activeCategory)
    } catch (e) {
      message.error('保存失败')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setSaveLoading(false)
    }
  }

  const handleDelete = async (item: DictionaryItem): Promise<void> => {
    try {
      await systemApi.deleteDictionaryItem(item.id)
      message.success('字典项已删除')
      await fetchData(activeCategory)
    } catch (e) {
      message.error('删除失败')
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }

  const columns: ColumnsType<DictionaryItem> = [
    { title: '编码', dataIndex: 'code', width: 160 },
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '排序', dataIndex: 'sortOrder', width: 80 },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (v: boolean) => (v ? '是' : '否'),
    },
    { title: '更新时间', dataIndex: 'updatedAt', width: 160, render: formatDateTime },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除？"
            onConfirm={() => handleDelete(record)}
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card title="数据字典管理">
      <Tabs
        activeKey={activeCategory}
        onChange={setActiveCategory}
        items={DICTIONARY_CATEGORIES.map((cat) => ({
          key: cat.code,
          label: cat.name,
        }))}
      />
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={openCreate}>
          新增字典项
        </Button>
      </Space>
      <DataTable<DictionaryItem>
        columns={columns}
        dataSource={sortedItems}
        loading={loading}
        rowKeyField="id"
      />

      <Modal
        title={editTarget ? '编辑字典项' : '新增字典项'}
        open={editOpen}
        confirmLoading={saveLoading}
        onCancel={() => setEditOpen(false)}
        onOk={handleSave}
        destroyOnClose
      >
        <Form<DictForm> form={form} layout="vertical">
          <Form.Item name="categoryCode" label="分类编码">
            <Input disabled />
          </Form.Item>
          <Form.Item
            name="code"
            label="编码"
            rules={[{ required: true, message: '请输入编码' }]}
          >
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

/** 字典分类（前端定义；后续可由后端 /dictionaries/categories 动态提供） */
const DICTIONARY_CATEGORIES: DictionaryCategory[] = [
  { code: 'issue_severity', name: '问题等级' },
  { code: 'issue_category', name: '问题分类' },
  { code: 'correction_status', name: '整改状态' },
  { code: 'report_status', name: '报告状态' },
]
