import { request } from '@/api/client'
import type {
  DictionaryItem,
  IssuePage,
  Notification,
  Organization,
  Role,
  User,
  UserStatus,
} from '@/api/types'

/** 用户分页查询参数（GET /users） */
export interface UserQuery {
  username?: string
  status?: UserStatus
  organizationId?: number
  page?: number
  pageSize?: number
}

/** 用户新增/更新体 */
export interface UserWriteBody {
  username: string
  password?: string
  realName?: string
  phone?: string
  email?: string
  organizationId?: number
}

/** 组织新增/更新体 */
export interface OrganizationWriteBody {
  parentId: number | null
  name: string
  code: string
  sortOrder?: number
}

/** 角色更新体 */
export interface RoleWriteBody {
  name?: string
  description?: string
  permissions?: string[]
}

/** 字典项新增/更新体 */
export interface DictionaryItemWriteBody {
  categoryCode: string
  code: string
  name: string
  sortOrder?: number
  enabled?: boolean
}

/**
 * 系统管理 API 封装（TASK-044）。
 *
 * 全部走 client.ts 的 request() —— 校验 code===0 后返回 data，否则抛 ApiError。
 */
export const systemApi = {
  // ---------- 用户管理 ----------
  /** 分页查询用户列表 */
  getUsers: (params?: UserQuery) =>
    request<IssuePage<User>>({ url: '/users', method: 'get', params }),

  /** 新增用户 */
  createUser: (data: UserWriteBody) =>
    request<User>({ url: '/users', method: 'post', data }),

  /** 更新用户 */
  updateUser: (id: number, data: UserWriteBody) =>
    request<User>({ url: `/users/${id}`, method: 'put', data }),

  /** 启用/禁用用户 */
  updateUserStatus: (id: number, status: UserStatus) =>
    request<User>({ url: `/users/${id}/status`, method: 'patch', data: { status } }),

  // ---------- 组织管理 ----------
  /** 查询组织树列表 */
  getOrganizations: () =>
    request<Organization[]>({ url: '/organizations', method: 'get' }),

  /** 新增组织 */
  createOrganization: (data: OrganizationWriteBody) =>
    request<Organization>({ url: '/organizations', method: 'post', data }),

  /** 更新组织 */
  updateOrganization: (id: number, data: OrganizationWriteBody) =>
    request<Organization>({ url: `/organizations/${id}`, method: 'put', data }),

  /** 删除组织 */
  deleteOrganization: (id: number) =>
    request<void>({ url: `/organizations/${id}`, method: 'delete' }),

  // ---------- 角色权限 ----------
  /** 查询角色列表 */
  getRoles: () =>
    request<Role[]>({ url: '/roles', method: 'get' }),

  /** 新增角色 */
  createRole: (data: RoleWriteBody) =>
    request<Role>({ url: '/roles', method: 'post', data }),

  /** 更新角色（含权限分配） */
  updateRole: (id: number, data: RoleWriteBody) =>
    request<Role>({ url: `/roles/${id}`, method: 'put', data }),

  /** 删除角色 */
  deleteRole: (id: number) =>
    request<void>({ url: `/roles/${id}`, method: 'delete' }),

  // ---------- 数据字典 ----------
  /** 查询字典项列表 */
  getDictionaryItems: (categoryCode?: string) =>
    request<DictionaryItem[]>({
      url: '/dictionaries',
      method: 'get',
      params: { categoryCode },
    }),

  /** 新增字典项 */
  createDictionaryItem: (data: DictionaryItemWriteBody) =>
    request<DictionaryItem>({ url: '/dictionaries', method: 'post', data }),

  /** 更新字典项 */
  updateDictionaryItem: (id: number, data: DictionaryItemWriteBody) =>
    request<DictionaryItem>({ url: `/dictionaries/${id}`, method: 'put', data }),

  /** 删除字典项 */
  deleteDictionaryItem: (id: number) =>
    request<void>({ url: `/dictionaries/${id}`, method: 'delete' }),

  // ---------- 通知 ----------
  /** 查询当前用户通知列表 */
  getNotifications: () =>
    request<Notification[]>({ url: '/notifications', method: 'get' }),

  /** 未读通知数 */
  getUnreadCount: () =>
    request<{ count: number }>({ url: '/notifications/unread-count', method: 'get' }),

  /** 标记通知已读 */
  markRead: (id: number) =>
    request<Notification>({ url: `/notifications/${id}/read`, method: 'post' }),
}
