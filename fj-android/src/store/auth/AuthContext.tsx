/**
 * AuthContext — 认证状态 Provider + useAuth Hook
 *
 * 设计依据：WI-0013 / DD-12 启动初始化与 login/logout 逻辑 / DD-7 错误映射
 *            / DD-13 登录时序图 / DD-14 Token 刷新时序
 *
 * 职责：
 *  - AuthProvider：useReducer 管理 AuthState；useMemo 创建 KeychainStorage + 带
 *    authProvider 的 ApiClient（DD-5 主客户端），对外暴露 AuthContextValue
 *  - useAuth：消费 Context，在 Provider 外使用抛错
 *  - login/logout/clearError：业务方法，驱动 authReducer 状态转换（DD-8）
 *  - 启动恢复（useEffect）：从 KeychainStorage 读 KeychainData →
 *    RESTORE_SESSION(user) / NO_TOKEN
 *  - 错误映射（DD-7）：mapApiErrorToAuthError 把 ApiError 转为用户可读中文文案
 *
 * 依赖注入（DD-4 Setter 模式 / DD-5 双客户端）：
 *  - KeychainStorage.setAuthFailedHandler 由本 Provider 注入 → dispatch AUTH_EXPIRED
 *  - ApiClient 的 authProvider = keychainStorage，401 刷新失败回调 onAuthFailed
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import { ApiClient, ApiError } from '../../api/ApiClient';
import { KeychainStorage } from '../../api/KeychainStorage';
import { AppConfig } from '../../config/AppConfig';
import { logger } from '../../utils/Logger';
import { authReducer } from './authReducer';
import {
  clearBiometricCredentials,
  getBiometricCredentials,
  hasBiometricCredentials,
  setBiometricCredentials,
} from './BiometricAuth';
import type {
  AuthContextValue,
  AuthError,
  User,
} from './types';
import { initialAuthState } from './types';

/**
 * /auth/login 响应体（ApiClient 解包 ApiResponse.data 之后的形状）。
 * 与 DD-13 时序图、KeychainData 字段对齐。
 */
interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/**
 * DD-7 错误分类映射表：ApiErrorKind → 用户可读中文文案。
 * 不向 UI 暴露原始 error.message（可能含英文堆栈或敏感路径）。
 */
const ERROR_MESSAGE_MAP: Record<AuthError['kind'], string> = {
  auth: '用户名或密码错误',
  network: '网络连接失败，请检查网络',
  timeout: '请求超时，请重试',
  server: '服务暂时不可用，请稍后重试',
  parse: '服务返回异常，请稍后重试',
};

/**
 * DD-7 错误映射纯函数：把 ApiClient 抛出的 ApiError（或其他异常）转为 AuthError。
 * console.warn 中截断 ≤100 字符用于排查，不打印完整 error.message 到 UI。
 *
 * 非 ApiError（如 Keychain 写入异常）→ 归类 server，UI 显示通用文案。
 */
function mapApiErrorToAuthError(error: unknown): AuthError {
  if (error instanceof ApiError) {
    console.warn(
      `[AuthContext] ApiError kind=${error.kind} code=${error.code ?? '-'} msg=${error.message}`.slice(0, 100),
    );
    return { kind: error.kind, message: ERROR_MESSAGE_MAP[error.kind], code: error.code };
  }
  const raw = error instanceof Error ? error.message : String(error);
  console.warn(`[AuthContext] 非 ApiError 异常: ${raw}`.slice(0, 100));
  return { kind: 'server', message: ERROR_MESSAGE_MAP.server, code: null };
}

/**
 * Auth React Context。
 * 默认 undefined，useAuth 据此检测是否在 Provider 内使用。
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * AuthProvider — 认证状态容器（DD-12）。
 *
 * @example
 * <AuthProvider>
 *   <RootNavigator />
 * </AuthProvider>
 */
export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);

  // WI-0024：是否已启用生物识别（指纹）快速登录
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  // DD-12.1：useMemo 创建 KeychainStorage + ApiClient（带 authProvider），引用稳定
  const { apiClient, keychainStorage } = useMemo(() => {
    const ks = new KeychainStorage();
    const client = new ApiClient({
      baseURL: AppConfig.API_ROOT,
      authProvider: ks,
    });
    return { apiClient: client, keychainStorage: ks };
  }, []);

  // DD-12.2：注入 authFailedHandler → dispatch AUTH_EXPIRED（Setter 模式打破循环依赖）
  useEffect(() => {
    keychainStorage.setAuthFailedHandler(() => {
      dispatch({ type: 'AUTH_EXPIRED' });
    });
  }, [keychainStorage]);

  // DD-12.3：App 启动恢复。isRestoring 期间 RootNavigator 显示启动屏。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      dispatch({ type: 'STARTUP_CHECK' });
      try {
        const data = await keychainStorage.getKeychainData();
        if (cancelled) {
          return;
        }
        if (data) {
          dispatch({ type: 'RESTORE_SESSION', user: data.user });
        } else {
          dispatch({ type: 'NO_TOKEN' });
        }
      } catch (error) {
        // getKeychainData 内部已 catch 并返回 null，此处双保险 → 视为无 token
        if (cancelled) {
          return;
        }
        console.warn(
          '[AuthContext] 启动恢复异常：',
          error instanceof Error ? error.message : String(error),
        );
        dispatch({ type: 'NO_TOKEN' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [keychainStorage]);

  // DD-12 login：LOGIN_START → POST /auth/login → saveTokens + LOGIN_SUCCESS | LOGIN_FAILURE
  const login = useMemo(
    () => async (username: string, password: string): Promise<void> => {
      dispatch({ type: 'LOGIN_START' });
      logger.info('AUTH', 'Login attempt', { username });
      try {
        const resp = await apiClient.post<LoginResponse>('/auth/login', {
          username,
          password,
        });
        await keychainStorage.saveTokens({
          accessToken: resp.accessToken,
          refreshToken: resp.refreshToken,
          user: resp.user,
        });
        dispatch({ type: 'LOGIN_SUCCESS', user: resp.user });
        logger.info('AUTH', 'Login success');
      } catch (error) {
        logger.error('AUTH', 'Login failed', {
          message: error instanceof Error ? error.message : String(error),
        });
        dispatch({ type: 'LOGIN_FAILURE', error: mapApiErrorToAuthError(error) });
      }
    },
    [apiClient, keychainStorage],
  );

  // DD-12 logout：LOGOUT_START → POST /auth/logout（失败不阻塞）→ clearTokens → LOGOUT_COMPLETE
  const logout = useMemo(
    () => async (): Promise<void> => {
      dispatch({ type: 'LOGOUT_START' });
      try {
        await apiClient.post('/auth/logout');
      } catch (error) {
        // REQ-008 AC-4：后端 logout 失败不阻塞本地清除
        console.warn(
          '[AuthContext] /auth/logout 失败（不阻塞本地登出）：',
          error instanceof Error ? error.message : String(error),
        );
      }
      await keychainStorage.clearTokens();
      dispatch({ type: 'LOGOUT_COMPLETE' });
      logger.info('AUTH', 'User logged out');
    },
    [apiClient, keychainStorage],
  );

  // clearError：重置 error 状态。LOGIN_START 是 DD-8 中唯一能从 error 状态清除
  // error 字段的合法转换（error→loading, error:null）。
  const clearError = useMemo(
    () => (): void => {
      dispatch({ type: 'LOGIN_START' });
    },
    [],
  );

  // WI-0021 TASK-2：主动刷新 access token。
  // 复用 KeychainStorage.refreshTokens（内部用 bareAuthClient POST /auth/refresh 并写回 Keychain）。
  // 刷新失败 → 调用 onAuthFailed 清除登录态并触发 AUTH_EXPIRED，返回 false 供调用方判断。
  const refreshAccessToken = useMemo(
    () => async (): Promise<boolean> => {
      try {
        const refreshed = await keychainStorage.refreshTokens();
        if (!refreshed) {
          // 刷新失败：走 onAuthFailed 统一登出（clearTokens + AUTH_EXPIRED）
          await keychainStorage.onAuthFailed();
          return false;
        }
        logger.debug('AUTH', 'Access token refreshed');
        return true;
      } catch (error) {
        console.warn(
          '[AuthContext] refreshAccessToken 异常：',
          error instanceof Error ? error.message : String(error),
        );
        await keychainStorage.onAuthFailed();
        return false;
      }
    },
    [keychainStorage],
  );

  // WI-0021 TASK-2：登录态下的定时刷新（每 10 分钟检查并刷新一次）。
  // 仅在 status === 'authenticated' 时启动；状态变化（登出 → unauthenticated）时自动清除。
  // refreshAccessToken 自身有失败兜底（onAuthFailed 触发登出），定时器内再 catch 防止 unhandled rejection。
  useEffect(() => {
    if (state.status !== 'authenticated') {
      return;
    }
    const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 分钟
    const timer = setInterval(() => {
      refreshAccessToken().catch((error) => {
        console.warn(
          '[AuthContext] 定时刷新 token 未捕获异常：',
          error instanceof Error ? error.message : String(error),
        );
      });
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [state.status, refreshAccessToken]);

  // WI-0024：启用生物识别（指纹）快速登录。
  // 将用户名/密码存入受 BIOMETRY_CURRENT_SET 保护的 keychain。
  const enableBiometric = useMemo(
    () => async (username: string, password: string): Promise<boolean> => {
      if (!username) {
        return false;
      }
      const ok = await setBiometricCredentials(username, password);
      setBiometricEnabled(ok);
      return ok;
    },
    [],
  );

  // WI-0024：禁用生物识别快速登录，清除已存储凭证。
  const disableBiometric = useMemo(
    () => async (): Promise<boolean> => {
      const ok = await clearBiometricCredentials();
      setBiometricEnabled(false);
      return ok;
    },
    [],
  );

  // WI-0024：启动生物识别自动登录。
  // 仅在启动恢复完成后且无有效会话（status === 'unauthenticated'）时触发一次，
  // 避免与 DD-12.3 的 token 恢复冲突，也避免每次登出都弹指纹框。
  // getBiometricCredentials 会触发系统生物识别对话框；用户取消或失败则静默返回。
  const biometricCheckDone = useRef(false);
  useEffect(() => {
    if (biometricCheckDone.current) {
      return;
    }
    // 启动恢复阶段尚未结束 → 等待
    if (state.isRestoring) {
      return;
    }
    // 启动恢复成功（已有会话）→ 不需要生物识别
    if (state.status !== 'unauthenticated') {
      return;
    }
    biometricCheckDone.current = true;
    let cancelled = false;
    (async () => {
      try {
        const hasBio = await hasBiometricCredentials();
        // 同步初始开关状态
        setBiometricEnabled(hasBio);
        if (cancelled || !hasBio) {
          return;
        }
        const creds = await getBiometricCredentials();
        if (cancelled || !creds) {
          return;
        }
        await login(creds.username, creds.password);
      } catch (error) {
        console.warn(
          '[AuthContext] 生物识别自动登录异常：',
          error instanceof Error ? error.message : String(error),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status, state.isRestoring, login]);

  // Context value 引用稳定：仅 state 变化时生成新对象（login/logout/clearError/refreshAccessToken 已 memo）
  // WI-0015 DD-5：apiClient（外层 useMemo 稳定引用）随 value 暴露给 SyncEngineInitializer
  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      login,
      logout,
      clearError,
      refreshAccessToken,
      apiClient,
      enableBiometric,
      disableBiometric,
      biometricEnabled,
    }),
    [
      state,
      login,
      logout,
      clearError,
      refreshAccessToken,
      apiClient,
      enableBiometric,
      disableBiometric,
      biometricEnabled,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth — 消费 AuthContext 的 Hook。
 *
 * @returns AuthContextValue（state + login + logout + clearError）
 * @throws Error 如果在 AuthProvider 外使用
 *
 * @example
 * const { state, login, logout } = useAuth();
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth 必须在 <AuthProvider> 内使用');
  }
  return ctx;
}
