import type { Role } from '@/api/types'

export type { Role }

/** 权限树节点（前端维度，对应 resource:action 权限码） */
export interface PermissionNode {
  key: string
  title: string
  children?: PermissionNode[]
}
