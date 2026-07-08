/**
 * ApiClient — 飞检安卓端统一 HTTP 客户端
 *
 * 设计依据：WI-0001 / DD-6 安卓同步协议 / §107 统一响应结构
 *
 * 职责：
 *  - 基于全局 fetch 封装（不引入 axios，减少原生依赖体积）
 *  - 自动附加 Authorization: Bearer {token}（令牌由注入的 AuthTokensProvider 提供，
 *    避免硬依赖 react-native-keychain，便于单测）
 *  - 401 时自动尝试刷新令牌并重试一次（refresh token 流程）
 *  - 超时控制：默认 30s，基于 AbortController 真正中断底层请求
 *  - 统一响应解析：服务端所有接口返回 { code, message, data, trace_id }
 *  - 错误分类：network（网络不可达）/ timeout（超时）/ server（业务码非 0 或 HTTP 5xx）
 *    / auth（认证失败且无法刷新）/ parse（响应体无法解析）
 *
 * 错误处理策略（供上层 SyncEngine / PhotoUploadQueue 分别处理）：
 *  - 网络错误 / 超时 → 可重试（指数退避）
 *  - 服务端错误（code != 0）→ 不重试，按业务码处理（如 4002 冲突）
 *  - 认证错误 → 触发登出流程（onAuthFailed）
 */
// 全局 fetch / Headers / FormData / AbortController / setTimeout 由 react-native 运行时提供，
// 类型声明见 react-native/types/modules/globals.d.ts，无需 import。

import { logger } from '../utils/Logger';

/**
 * 统一响应结构（§107.x）。
 * 所有后端接口返回此结构；data 的具体形状由调用方用泛型 T 约束。
 */
export interface ApiResponse<T> {
  /** 业务码：0 表示成功，非 0 表示业务错误（1000+ 通用错误，4000+ 同步错误） */
  code: number;
  /** 人类可读消息 */
  message: string;
  /** 业务数据 */
  data: T;
  /** 链路追踪 ID（用于服务端日志关联） */
  trace_id: string;
}

/** 业务成功码 */
export const API_SUCCESS_CODE = 0;

/**
 * ApiError 类型分类。上层据类型决定重试 / 登出 / 提示策略。
 */
export type ApiErrorKind = 'network' | 'timeout' | 'server' | 'auth' | 'parse';

/**
 * 统一 API 异常。携带分类、业务码、HTTP 状态、trace_id，便于上层精准处理。
 */
export class ApiError extends Error {
  /** 错误分类 */
  public readonly kind: ApiErrorKind;
  /** 服务端业务码（若响应可解析），无则为 null */
  public readonly code: number | null;
  /** 链路追踪 ID（若响应携带），无则为 null */
  public readonly traceId: string | null;
  /** HTTP 状态码（网络错误 / 超时时为 null） */
  public readonly httpStatus: number | null;

  constructor(
    kind: ApiErrorKind,
    message: string,
    options?: {
      code?: number | null;
      traceId?: string | null;
      httpStatus?: number | null;
    },
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.code = options?.code ?? null;
    this.traceId = options?.traceId ?? null;
    this.httpStatus = options?.httpStatus ?? null;
  }

  /** 是否可重试（网络错误 / 超时）；服务端业务错误与认证错误不可重试 */
  isRetryable(): boolean {
    return this.kind === 'network' || this.kind === 'timeout';
  }
}

/**
 * 认证令牌提供者接口（注入端口）。
 *
 * 生产实现基于 react-native-keychain；测试实现可返回固定令牌。
 * 通过依赖注入避免 ApiClient 硬编码密钥存储，且便于在 Jest 中替换。
 */
export interface AuthTokensProvider {
  /** 获取当前 access token（可能为 null：未登录） */
  getAccessToken(): Promise<string | null>;
  /** 获取 refresh token（可能为 null：未登录或无刷新能力） */
  getRefreshToken(): Promise<string | null>;
  /**
   * 使用 refresh token 刷新令牌对。
   * @returns 新的令牌对；若刷新失败（refresh token 过期）返回 null。
   */
  refreshTokens(): Promise<{ accessToken: string; refreshToken: string } | null>;
  /** 认证彻底失败（刷新也失败）时的回调，通常触发登出 / 跳转登录页 */
  onAuthFailed?(): Promise<void> | void;
}

/** 单次请求配置 */
export interface RequestOptions {
  /** 查询参数（自动拼接到 URL） */
  query?: Record<string, string | number | boolean | undefined>;
  /** 额外请求头 */
  headers?: Record<string, string>;
  /** 超时覆盖（毫秒） */
  timeoutMs?: number;
}

/** ApiClient 构造选项 */
export interface ApiClientOptions {
  /** API 基地址，如 https://api.fj.example.com（不含 /api/v1 前缀也行，path 自带） */
  baseURL: string;
  /** 默认超时（毫秒），默认 30000 */
  timeoutMs?: number;
  /** 认证令牌提供者（可选；公共接口可不传） */
  authProvider?: AuthTokensProvider;
  /** 默认请求头 */
  defaultHeaders?: Record<string, string>;
}

/** 默认请求超时：30s */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Token 主动刷新阈值：access token 剩余有效期低于此值时，请求前先刷新。
 * 5 分钟，避免请求飞行途中过期（WI-0021 TASK-1）。
 */
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * 模块级单飞锁：并发请求同时发现 token 即将过期时，只触发一次 refreshTokens，
 * 其余请求复用同一个 Promise，避免刷新风暴（DD-14 / WI-0021 TASK-1）。
 */
let refreshInFlight: Promise<string | null> | null = null;

/**
 * base64 字符表（自实现解码，避免依赖 RN 全局 atob 类型声明，WI-0021 TASK-1）。
 */
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * base64 解码为二进制字符串（UTF-8 字节序列）。
 * 自实现避免依赖运行时 atob 全局类型声明，保证 tsc 严格模式下无外部类型依赖。
 */
function base64Decode(input: string): string {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
  let output = '';
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64_CHARS.indexOf(clean[i]) << 18) |
      (B64_CHARS.indexOf(clean[i + 1]) << 12) |
      (B64_CHARS.indexOf(clean[i + 2]) << 6) |
      (B64_CHARS.indexOf(clean[i + 3]));
    output += String.fromCharCode((n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff);
  }
  const pad = input.endsWith('==') ? 2 : input.endsWith('=') ? 1 : 0;
  return output.slice(0, output.length - pad);
}

/**
 * 解析 JWT 的 exp 字段（过期时间，毫秒）。
 *
 * React Native 运行时无 Buffer.from，使用自实现 base64 解码 + base64url 规范化。
 * 非 JWT / 缺少 exp / 解析失败 → 返回 null（调用方据此降级为信任 token，交由 401 兜底）。
 */
function decodeJwtExpMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    // base64url → base64 + 补齐 padding
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = base64Decode(padded);
    // 处理 UTF-8 多字节字符
    const decoded = decodeURIComponent(
      json
        .split('')
        .map((c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    const payload = JSON.parse(decoded) as { exp?: unknown };
    if (typeof payload.exp !== 'number') {
      return null;
    }
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

/**
 * 飞检统一 HTTP 客户端。
 *
 * @example
 * const client = new ApiClient({ baseURL: 'https://api.fj.example.com', authProvider });
 * const data = await client.get<{ latest_server_seq: number }>('/api/v1/sync/pull-meta');
 */
export class ApiClient {
  private readonly baseURL: string;
  private readonly timeoutMs: number;
  private readonly authProvider?: AuthTokensProvider;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: ApiClientOptions) {
    if (!options.baseURL) {
      throw new Error('ApiClient: baseURL 不能为空');
    }
    this.baseURL = options.baseURL.replace(/\/+$/, ''); // 去掉尾部斜杠
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.authProvider = options.authProvider;
    this.defaultHeaders = options.defaultHeaders ?? {};
  }

  /**
   * GET 请求。
   * @typeParam T - 期望的 data 类型
   */
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  /** POST 请求（JSON body） */
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  /** PUT 请求（JSON body） */
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  /** DELETE 请求 */
  del<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  /**
   * POST FormData 请求（用于照片分片上传）。
   * 不设置 Content-Type，由 fetch 自动生成 multipart/form-data + boundary。
   *
   * @param fields - FormData 字段（键值对），二进制字段值为 Blob / { uri, name, type }
   */
  postFormData<T>(
    path: string,
    fields: Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<T> {
    const formData = new FormData();
    Object.keys(fields).forEach((key) => {
      formData.append(key, fields[key] as FormDataValue);
    });
    return this.requestRaw<T>('POST', path, { body: formData }, options);
  }

  /**
   * 核心请求方法：处理鉴权、超时、401 刷新重试、统一响应解析。
   *
   * @param method - HTTP 方法
   * @param path - 路径（以 / 开头），或完整 URL
   * @param body - JSON 可序列化请求体（undefined 表示无 body）
   * @param options - 额外配置
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const init: RequestInit = { method };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    return this.requestRaw<T>(method, path, init, options);
  }

  /**
   * 底层 fetch 封装（已附加鉴权 / 超时 / 重试 / 解析）。
   * init.body 可为 JSON 字符串或 FormData。
   */
  private async requestRaw<T>(
    method: string,
    path: string,
    init: RequestInit,
    options?: RequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path, options?.query);
    const timeoutMs = options?.timeoutMs ?? this.timeoutMs;

    logger.debug('API', `${method} ${url}`);
    // 首次尝试；401 时内部会再试一次（retried 标记防止无限刷新）
    try {
      return await this.doFetchWithAuth<T>(url, init, options, timeoutMs, false);
    } catch (error) {
      logger.error('API', 'Request failed', {
        url,
        method,
        status: error instanceof ApiError ? error.httpStatus : null,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 确保返回一个未过期的 access token（WI-0021 TASK-1）。
   *
   * 流程：
   *  1. 读取当前 access token；无 → 返回 null（匿名请求）
   *  2. 解析 JWT exp；解析失败 → 信任原 token（交由 401 兜底）
   *  3. 剩余有效期 > 阈值 → 直接返回
   *  4. 即将过期 → 模块级单飞调用 authProvider.refreshTokens()
   *     - 成功：返回新 access token
   *     - 失败：调用 onAuthFailed（触发登出），返回 null
   *
   * @returns 可用的 access token，或 null（未登录 / 刷新失败）
   */
  private async ensureFreshAccessToken(): Promise<string | null> {
    const authProvider = this.authProvider;
    if (!authProvider) {
      return null;
    }
    const token = await authProvider.getAccessToken();
    if (!token) {
      return null;
    }
    const expMs = decodeJwtExpMs(token);
    if (expMs === null) {
      // 非 JWT 或无法解析 → 信任原 token，交由 401 兜底刷新
      return token;
    }
    const remaining = expMs - Date.now();
    if (remaining > TOKEN_REFRESH_THRESHOLD_MS) {
      return token;
    }
    // 即将过期：单飞刷新（并发请求复用同一 Promise，避免刷新风暴）
    if (refreshInFlight) {
      return refreshInFlight;
    }
    refreshInFlight = (async (): Promise<string | null> => {
      try {
        const refreshed = await authProvider.refreshTokens();
        if (!refreshed) {
          // 刷新失败 → 认证彻底失败，触发登出回调
          if (authProvider.onAuthFailed) {
            await authProvider.onAuthFailed();
          }
          return null;
        }
        return refreshed.accessToken;
      } finally {
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  }

  /** 执行一次 fetch（附加 Authorization），失败按策略抛 ApiError；401 触发刷新重试 */
  private async doFetchWithAuth<T>(
    url: string,
    init: RequestInit,
    options: RequestOptions | undefined,
    timeoutMs: number,
    retried: boolean,
  ): Promise<T> {
    const headers: Record<string, string> = { ...this.defaultHeaders, ...(options?.headers ?? {}) };
    if (init.body !== undefined && typeof init.body === 'string' && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // 附加 Bearer token（WI-0021 TASK-1：请求前确保 token 未过期，必要时单飞刷新）
    if (this.authProvider) {
      const token = await this.ensureFreshAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const requestStartTs = Date.now();
    const response = await this.fetchWithTimeout(url, { ...init, headers }, timeoutMs);
    logger.debug('API', `Response ${response.status} (${Date.now() - requestStartTs}ms)`);

    // 401 → 尝试刷新令牌并重试一次
    if (response.status === 401 && this.authProvider && !retried) {
      const refreshed = await this.authProvider.refreshTokens();
      if (refreshed) {
        return this.doFetchWithAuth<T>(url, init, options, timeoutMs, true);
      }
      // 刷新失败 → 认证彻底失败
      if (this.authProvider.onAuthFailed) {
        await this.authProvider.onAuthFailed();
      }
      throw new ApiError('auth', '认证失败：access token 无效且刷新失败', { httpStatus: 401 });
    }

    return this.parseResponse<T>(response);
  }

  /** 带超时的 fetch（AbortController 真正中断底层请求） */
  private fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...init, signal: controller.signal }).then(
      (response) => {
        clearTimeout(timer);
        return response;
      },
      (error: unknown) => {
        clearTimeout(timer);
        throw this.toApiError(error);
      },
    );
  }

  /** 把 fetch 抛出的原始错误转换为 ApiError（区分超时与网络错误） */
  private toApiError(error: unknown): ApiError {
    // AbortController.abort() 触发 DOMException{name:'Abort'} → 视为超时
    if (error instanceof Error && error.name === 'AbortError') {
      return new ApiError('timeout', `请求超时`);
    }
    const msg = error instanceof Error ? error.message : String(error);
    return new ApiError('network', `网络错误：${msg}`);
  }

  /** 解析统一响应结构 { code, message, data, trace_id }，HTTP 非 2xx 或 code!=0 抛 ApiError */
  private async parseResponse<T>(response: Response): Promise<T> {
    let bodyText: string;
    try {
      bodyText = await response.text();
    } catch (error) {
      throw new ApiError(
        'parse',
        `响应体读取失败：${error instanceof Error ? error.message : String(error)}`,
        { httpStatus: response.status },
      );
    }

    // 空响应体（如 204）
    if (bodyText === '' || bodyText === null) {
      if (!response.ok) {
        throw new ApiError('server', `服务端错误：HTTP ${response.status}`, {
          httpStatus: response.status,
        });
      }
      return undefined as unknown as T;
    }

    let parsed: ApiResponse<T>;
    try {
      parsed = JSON.parse(bodyText) as ApiResponse<T>;
    } catch (error) {
      throw new ApiError(
        'parse',
        `响应体 JSON 解析失败：${error instanceof Error ? error.message : String(error)}`,
        { httpStatus: response.status },
      );
    }

    const traceId = typeof parsed.trace_id === 'string' ? parsed.trace_id : null;

    // HTTP 非 2xx：即使带 body 也视为服务端错误
    if (!response.ok) {
      throw new ApiError(
        'server',
        parsed.message || `服务端错误：HTTP ${response.status}`,
        { code: parsed.code ?? null, traceId, httpStatus: response.status },
      );
    }

    // 业务码非 0
    if (parsed.code !== API_SUCCESS_CODE) {
      throw new ApiError('server', parsed.message || `业务错误：code=${parsed.code}`, {
        code: parsed.code,
        traceId,
        httpStatus: response.status,
      });
    }

    return parsed.data;
  }

  /** 拼接 URL + query string；path 为完整 URL 时直接使用 */
  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): string {
    const full = /^https?:\/\//i.test(path) ? path : `${this.baseURL}${path}`;
    if (!query) {
      return full;
    }
    const params = Object.keys(query)
      .filter((k) => query[k] !== undefined)
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(query[k]))}`)
      .join('&');
    return params ? `${full}${full.includes('?') ? '&' : '?'}${params}` : full;
  }
}
