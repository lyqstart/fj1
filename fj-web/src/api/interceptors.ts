import type {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { useAuthStore } from '@/store/authStore'
import type { ApiResponse } from './client'

/**
 * 自定义重试标记，挂在 config 上避免 401 死循环
 */
type RetryableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
}

/** 是否正在刷新 token，避免并发刷新 */
let isRefreshing = false
/** 刷新期间被挂起的请求队列，刷新完成后重放 */
let pendingQueue: Array<(token: string | null) => void> = []

function flushPending(token: string | null): void {
  pendingQueue.forEach((cb) => cb(token))
  pendingQueue = []
}

function forceLogout(): void {
  useAuthStore.getState().clear()
  // 用 window.location 跳转，避免在拦截器内 import router 造成循环依赖
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

/**
 * 安装请求/响应拦截器
 *
 * 请求拦截：从 authStore 读取 access_token，注入 Authorization: Bearer
 * 响应拦截：
 *   - 401 且未重试 → 用 refresh_token 调 /auth/refresh，成功后重放原请求；
 *                   失败 → 强制登出并跳转登录页
 *   - 其他错误 → 原样 reject，交由调用方处理
 */
export function setupInterceptors(instance: AxiosInstance): void {
  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`)
    }
    return config
  })

  instance.interceptors.response.use(
    (response: AxiosResponse<ApiResponse>) => response,
    async (error) => {
      const originalRequest = (error.config ?? {}) as RetryableConfig
      const status: number | undefined = error.response?.status

      if (status === 401 && !originalRequest._retry) {
        const refreshToken = useAuthStore.getState().refreshToken

        // 无 refresh_token，直接登出
        if (!refreshToken) {
          forceLogout()
          return Promise.reject(error)
        }

        // 已有刷新在进行中，挂起当前请求等待新 token
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            pendingQueue.push((token) => {
              if (!token) {
                reject(error)
                return
              }
              originalRequest.headers.set('Authorization', `Bearer ${token}`)
              resolve(instance(originalRequest))
            })
          })
        }

        originalRequest._retry = true
        isRefreshing = true
        try {
          const res = await instance.post<
            ApiResponse<{ accessToken: string; refreshToken: string }>
          >('/auth/refresh', { refreshToken })
          const body = res.data
          if (body.code !== 0 || !body.data) {
            flushPending(null)
            forceLogout()
            return Promise.reject(error)
          }
          const { accessToken, refreshToken: freshRefreshToken } = body.data
          useAuthStore.getState().setTokens({ accessToken, refreshToken: freshRefreshToken })
          flushPending(accessToken)
          originalRequest.headers.set('Authorization', `Bearer ${accessToken}`)
          return instance(originalRequest)
        } catch (e) {
          flushPending(null)
          forceLogout()
          return Promise.reject(e)
        } finally {
          isRefreshing = false
        }
      }

      return Promise.reject(error)
    },
  )
}
