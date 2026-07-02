import type { ReactNode } from 'react'
import { useAuthStore } from '@/store/authStore'

interface PermissionDirectiveProps {
  /** 需要的权限码，支持单个或数组（任一满足即放行） */
  required: string | string[]
  /** 无权限时展示的内容，默认隐藏（null） */
  fallback?: ReactNode
  children: ReactNode
}

/**
 * 权限指令组件
 *
 * 用法：<PermissionDirective required="user:create"><Button /></PermissionDirective>
 *
 * 行为：从 authStore 读取当前用户权限码列表，命中任一 required 即渲染子元素，
 *      否则渲染 fallback（默认隐藏）。
 *
 * 注：权限码格式为 resource:action（如 daily_report:confirm）。
 * 超级管理员可在后端下发 '*' 通配权限码，本组件对其同样放行。
 */
export function PermissionDirective({
  required,
  fallback = null,
  children,
}: PermissionDirectiveProps) {
  const permissions = useAuthStore((s) => s.user?.permissions ?? [])
  const requiredList = Array.isArray(required) ? required : [required]

  const hasPermission =
    permissions.includes('*') ||
    requiredList.some((code) => permissions.includes(code))

  return <>{hasPermission ? children : fallback}</>
}
