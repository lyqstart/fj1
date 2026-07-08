/**
 * AuthStore Reducer — 认证状态机纯函数
 *
 * 设计依据：WI-0013 / DD-8 状态转换矩阵
 *
 * 职责：
 *  - 纯函数 reducer：接收 AuthState + AuthAction，返回新 AuthState
 *  - 内置合法状态转换矩阵（DD-8），非法转换 console.warn + 返回原 state（引用不变）
 *  - exhaustive check：编译期保证所有 AuthAction 类型已处理
 *
 * 正确性属性（design PBT）：
 *  - P1: 返回 status 始终 ∈ 5 个合法值
 *  - P2: 非法转换返回 state 引用不变（===）
 */
import { AuthState, AuthAction, AuthStatus } from './types';

/**
 * DD-8 合法状态转换矩阵。
 * key = action.type，value = 允许的 from status 列表。
 * 不在列表内的 from status 视为非法转换（REQ-005 AC-7）。
 */
const VALID_TRANSITIONS: Record<AuthAction['type'], readonly AuthStatus[]> = {
  STARTUP_CHECK: ['idle'],
  RESTORE_SESSION: ['loading'],
  NO_TOKEN: ['loading'],
  LOGIN_START: ['unauthenticated', 'error'],
  LOGIN_SUCCESS: ['loading'],
  LOGIN_FAILURE: ['loading'],
  LOGOUT_START: ['authenticated'],
  LOGOUT_COMPLETE: ['loading'],
  AUTH_EXPIRED: ['authenticated', 'loading'],
};

/**
 * 认证状态机 reducer（纯函数）。
 *
 * 非法转换处理（DD-8 / REQ-005 AC-7）：
 *  - console.warn 记录非法转换（action + from status），便于排查
 *  - 返回原 state 引用（===），不产生新对象，避免无谓重渲染
 */
export function authReducer(state: AuthState, action: AuthAction): AuthState {
  // DD-8: 校验 from status 是否在合法转换矩阵内
  const allowedFrom = VALID_TRANSITIONS[action.type];
  if (!allowedFrom.includes(state.status)) {
    console.warn(
      `[AuthStore] 非法状态转换拒绝：action="${action.type}" from status="${state.status}"`,
    );
    return state; // 引用不变（P2）
  }

  switch (action.type) {
    case 'STARTUP_CHECK':
      return { ...state, status: 'loading', isRestoring: true, error: null };

    case 'RESTORE_SESSION':
      return {
        status: 'authenticated',
        user: action.user,
        error: null,
        isRestoring: false,
      };

    case 'NO_TOKEN':
      return {
        status: 'unauthenticated',
        user: null,
        error: null,
        isRestoring: false,
      };

    case 'LOGIN_START':
      return { ...state, status: 'loading', error: null };

    case 'LOGIN_SUCCESS':
      return {
        status: 'authenticated',
        user: action.user,
        error: null,
        isRestoring: false,
      };

    case 'LOGIN_FAILURE':
      return { ...state, status: 'error', error: action.error, isRestoring: false };

    case 'LOGOUT_START':
      return { ...state, status: 'loading' };

    case 'LOGOUT_COMPLETE':
      return {
        status: 'unauthenticated',
        user: null,
        error: null,
        isRestoring: false,
      };

    case 'AUTH_EXPIRED':
      return {
        status: 'unauthenticated',
        user: null,
        error: { kind: 'auth', message: '会话已过期，请重新登录' },
        isRestoring: false,
      };

    default: {
      // exhaustive check：编译期保证所有 AuthAction.type 已处理
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}
