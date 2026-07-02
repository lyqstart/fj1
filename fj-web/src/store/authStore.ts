import { create } from 'zustand'

/**
 * 当前登录用户信息（对应后端 User 简要视图）
 */
export interface AuthUser {
  id: number
  username: string
  realName?: string
  roles?: string[]
  /** 权限码列表，格式 resource:action，如 user:create */
  permissions?: string[]
}

interface AuthState {
  /** accessToken（有效期 30 分钟），持久化到 localStorage */
  accessToken: string | null
  /** refreshToken（有效期 7 天），持久化到 localStorage */
  refreshToken: string | null
  /** 当前用户信息（内存态，刷新页面后会丢失，可后续拉取 /me 补全） */
  user: AuthUser | null
  /** 登录成功后写入 token + 用户信息 */
  setAuth: (data: {
    accessToken: string
    refreshToken: string
    user: AuthUser
  }) => void
  /** token 刷新后更新令牌（不触碰 user） */
  setTokens: (data: { accessToken: string; refreshToken: string }) => void
  /** 登出 / 强制下线，清空令牌与用户信息 */
  clear: () => void
}

const ACCESS_TOKEN_KEY = 'fj_access_token'
const REFRESH_TOKEN_KEY = 'fj_refresh_token'

function readToken(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeToken(key: string, value: string | null): void {
  try {
    if (value) {
      localStorage.setItem(key, value)
    } else {
      localStorage.removeItem(key)
    }
  } catch {
    // localStorage 不可用（隐私模式等）时静默忽略，令牌仅存内存
  }
}

/**
 * 认证状态 Store
 *
 * 设计要点：
 * - token 同步写入 localStorage，保证刷新页面后仍可恢复登录态（DD-4）
 * - getState() 暴露给非组件（如 axios 拦截器）使用
 */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: readToken(ACCESS_TOKEN_KEY),
  refreshToken: readToken(REFRESH_TOKEN_KEY),
  user: null,
  setAuth: (data) => {
    writeToken(ACCESS_TOKEN_KEY, data.accessToken)
    writeToken(REFRESH_TOKEN_KEY, data.refreshToken)
    set({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    })
  },
  setTokens: (data) => {
    writeToken(ACCESS_TOKEN_KEY, data.accessToken)
    writeToken(REFRESH_TOKEN_KEY, data.refreshToken)
    set({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    })
  },
  clear: () => {
    writeToken(ACCESS_TOKEN_KEY, null)
    writeToken(REFRESH_TOKEN_KEY, null)
    set({ accessToken: null, refreshToken: null, user: null })
  },
}))
