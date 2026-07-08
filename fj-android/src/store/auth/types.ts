/**
 * AuthStore 类型定义 — 登录认证状态机
 *
 * 设计依据：WI-0013 / DD-3 数据模型 / DD-8 状态转换矩阵
 *
 * 职责：
 *  - 定义 5 态认证状态机（AuthStatus）
 *  - 定义用户信息（User，与后端 LoginResponse.user 对齐）
 *  - 定义错误分类（AuthErrorKind，与 ApiClient.ApiErrorKind 对齐）
 *  - 定义 9 种 AuthAction（对应 DD-8 合法状态转换）
 *  - 定义 AuthContextValue（供 TASK-4 AuthContext.tsx 使用）
 *
 * 对齐约束：
 *  - AuthErrorKind 与 ApiClient.ts L45 ApiErrorKind 完全一致（5 种）
 *  - User.id 类型为 number（后端 LoginResponse.user.id）
 */

import type { ApiClient } from '../../api/ApiClient';

// 认证状态（5 态状态机，DD-8）
export type AuthStatus =
  | 'idle'
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'error';

// 用户信息（与后端 LoginResponse.user 对齐，REQ-017 AC-1）
export interface User {
  id: number;
  username: string;
  realName: string;
}

// 错误分类（与 ApiClient.ApiErrorKind 对齐，ApiClient.ts L45）
export type AuthErrorKind = 'network' | 'timeout' | 'server' | 'auth' | 'parse';

// 认证错误（REQ-004 错误分类）
export interface AuthError {
  kind: AuthErrorKind;
  message: string; // 用户可读中文文案
  code?: number | null;
}

// 认证状态
export interface AuthState {
  status: AuthStatus;
  user: User | null; // 仅 authenticated 时非 null
  error: AuthError | null; // 仅 error 时非 null（AUTH_EXPIRED 携带提示文案为例外）
  /** 启动恢复阶段标记（STARTUP_CHECK 至 RESTORE_SESSION/NO_TOKEN 期间为 true） */
  isRestoring: boolean;
}

// Auth Actions（9 种 union type，对应 DD-8 合法状态转换）
export type AuthAction =
  | { type: 'STARTUP_CHECK' }
  | { type: 'RESTORE_SESSION'; user: User }
  | { type: 'NO_TOKEN' }
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; user: User }
  | { type: 'LOGIN_FAILURE'; error: AuthError }
  | { type: 'LOGOUT_START' }
  | { type: 'LOGOUT_COMPLETE' }
  | { type: 'AUTH_EXPIRED' };

// 初始状态
export const initialAuthState: AuthState = {
  status: 'idle',
  user: null,
  error: null,
  isRestoring: false,
};

// AuthContext 的 value 类型（供 TASK-4 AuthContext.tsx 使用）
export interface AuthContextValue {
  state: AuthState;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  /**
   * 主动刷新 access token（WI-0021 TASK-2）。
   * 调用 KeychainStorage.refreshTokens（内部 POST /auth/refresh）。
   * 刷新失败时触发登出流程；返回是否刷新成功，供定时器与 UI 判断。
   */
  refreshAccessToken: () => Promise<boolean>;
  /** 主 ApiClient 实例（WI-0015 DD-5：供 SyncEngineInitializer 构造 SyncEngine） */
  apiClient: ApiClient;
  /**
   * 启用生物识别（指纹）快速登录（WI-0024）。
   * 将用户名/密码存储到受生物识别保护的 keychain。
   * @returns 存储成功返回 true
   */
  enableBiometric: (username: string, password: string) => Promise<boolean>;
  /**
   * 禁用生物识别快速登录（WI-0024）。
   * 清除已存储的生物识别凭证。
   * @returns 清除成功返回 true
   */
  disableBiometric: () => Promise<boolean>;
  /** 是否已启用生物识别快速登录（WI-0024） */
  biometricEnabled: boolean;
}
