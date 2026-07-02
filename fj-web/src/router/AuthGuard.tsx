import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface AuthGuardProps {
  children: ReactNode
}

/**
 * 路由权限守卫
 * - 未登录（无 accessToken）→ 重定向到 /login，并记录来源路径
 * - 已登录 → 渲染受保护内容
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const accessToken = useAuthStore((s) => s.accessToken)
  const location = useLocation()

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
