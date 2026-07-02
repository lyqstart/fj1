import { Table, type TableProps, type PaginationProps } from 'antd'

export interface DataTableProps<T extends Record<string, any>>
  extends Omit<TableProps<T>, 'rowKey' | 'pagination'> {
  /** 当前页码（1-based） */
  page?: number
  /** 每页条数 */
  pageSize?: number
  /** 总记录数 */
  total?: number
  /** 加载态 */
  loading?: boolean
  /** 行主键字段名，默认 'id' */
  rowKeyField?: keyof T | ((record: T) => string | number)
  /** 分页变化回调，传入即启用受控分页 */
  onPageChange?: (page: number, pageSize: number) => void
}

/**
 * 通用数据表格
 *
 * 封装要点：
 * - 统一 rowKey（默认取 record.id）
 * - 受控分页，配合后端 PageResponse（DD-5）
 * - 透传 antd Table 其余 props（columns 等）
 */
export function DataTable<T extends Record<string, any>>(
  props: DataTableProps<T>,
) {
  const {
    page,
    pageSize,
    total,
    loading,
    rowKeyField = 'id' as keyof T,
    onPageChange,
    ...rest
  } = props

  const pagination: PaginationProps | false = onPageChange
    ? {
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        showTotal: (t) => `共 ${t} 条`,
        onChange: onPageChange,
      }
    : false

  const rowKey: TableProps<T>['rowKey'] =
    typeof rowKeyField === 'function'
      ? (record) => rowKeyField(record)
      : (rowKeyField as string)

  return (
    <Table<T>
      {...rest}
      loading={loading}
      pagination={pagination}
      rowKey={rowKey}
    />
  )
}
