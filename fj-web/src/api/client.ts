import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios'
import { setupInterceptors } from './interceptors'

/**
 * 统一响应结构（DD-5 §5.2）
 * code: 0=成功，非 0=错误码
 */
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T | null
  traceId?: string
  timestamp?: string
}

/**
 * 分页响应 data（DD-5 §5.2 PageResponse）
 */
export interface PageData<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/** API 基础路径，开发态由 vite proxy 转发到 http://localhost:8080 */
export const API_BASE_URL = '/api/v1'

/**
 * 业务错误（响应 HTTP 200 但 code !== 0）
 * 错误码区间（DD-5 §5.3）：
 *   1000-1999 认证/权限类
 *   2000-2999 业务校验类
 *   3000-3999 状态机类
 *   4000-4999 数据/同步类
 *   5000-5999 系统类
 */
export class ApiError extends Error {
  readonly code: number
  readonly traceId?: string
  constructor(code: number, message: string, traceId?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.traceId = traceId
  }
}

/** 全局 axios 实例 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 安装请求/响应拦截器（token 注入 + 401 自动刷新 + 统一错误处理）
setupInterceptors(apiClient)

/**
 * 业务请求封装：校验 code===0 后返回 data，否则抛出 ApiError
 * 适用于遵循统一响应结构的接口
 */
export async function request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.request<ApiResponse<T>>(config)
  const body = res.data
  if (body.code !== 0) {
    throw new ApiError(body.code, body.message, body.traceId)
  }
  return body.data as T
}

/**
 * 原始请求：返回完整 ApiResponse，用于需要自行处理 code 的场景
 * （如登录、token 刷新等已在拦截器内消费）
 */
export async function rawRequest<T = unknown>(
  config: AxiosRequestConfig,
): Promise<AxiosResponse<ApiResponse<T>>> {
  return apiClient.request<ApiResponse<T>>(config)
}
