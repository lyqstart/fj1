/**
 * KeychainStorage — 安全令牌持久化（AuthTokensProvider 实现）
 *
 * 设计依据：WI-0013 / DD-4 KeychainStorage 设计 / DD-5 双 ApiClient 防 refresh 递归
 *            / DD-14 Token 刷新时序
 *
 * 职责：
 *  - 使用 react-native-keychain 的 InternetCredentials API 加密存储登录态
 *    （Android v8+ 底层走 EncryptedSharedPreferences / Android Keystore AES-256）
 *  - 实现 ApiClient.AuthTokensProvider 接口，供带鉴权的 ApiClient 自动注入
 *    access token、401 时回调刷新、刷新失败时回调登出
 *  - 提供 saveTokens / clearTokens / getKeychainData 给 AuthProvider 在
 *    登录 / 登出 / 启动恢复阶段使用
 *
 * 设计要点：
 *  - **双 ApiClient（DD-5）**：内部持有一个 **BareAuthClient**（无 authProvider），
 *    refreshTokens() 用它发 /auth/refresh，避免带 authProvider 的主 ApiClient
 *    在 refresh 请求 401 时再次触发 refreshTokens → 无限递归。
 *  - **Setter 模式（DD-4）**：onAuthFailed 回调由 AuthProvider 通过
 *    setAuthFailedHandler 注入，避免 KeychainStorage ↔ AuthContext 循环依赖。
 *
 * 失败处理（DD-4 表格）：
 *  | 操作 | 失败处理 |
 *  |------|---------|
 *  | get*Token() 读取异常 | catch → 返回 null（REQ-006 AC-7） |
 *  | refreshTokens() 失败 | catch → 返回 null（REQ-007 AC-3），clearTokens 由 onAuthFailed 负责 |
 *  | saveTokens() 写入失败 | 异常向上传播 → AuthStore error 状态 |
 *  | clearTokens() 清除失败 | catch → warn 日志，不阻塞登出 |
 */
import * as Keychain from 'react-native-keychain';

import { ApiClient, AuthTokensProvider } from './ApiClient';
import { AppConfig } from '../config/AppConfig';
import { User } from '../store/auth/types';

/** Keychain server 标识（DD-4：固定 'fj1-auth'） */
const KEYCHAIN_SERVER = 'fj1-auth';
/**
 * Keychain username 字段占位值。
 * InternetCredentials API 要求 username/password 三元组，本实现将完整
 * KeychainData 序列化为 JSON 放入 password 字段，username 仅占位。
 */
const KEYCHAIN_USERNAME = 'fj1-user';

/**
 * Keychain 中持久化的数据结构（REQ-009 AC-5：用户信息与令牌一起持久化）。
 * 一次登录态对应一份 KeychainData，整体作为 JSON 字符串加密落盘。
 */
export interface KeychainData {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/**
 * /auth/refresh 响应体（ApiClient 解包 ApiResponse.data 之后的形状）。
 * 仅刷新令牌，不重新下发 user（user 由 KeychainData 保留）。
 */
interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * KeychainStorage — AuthTokensProvider 的生产实现。
 *
 * 使用示例（DD-12）：
 * ```ts
 * const ks = new KeychainStorage();           // 默认 baseURL=AppConfig.API_ROOT
 * ks.setAuthFailedHandler(() => dispatch({type:'AUTH_EXPIRED'}));
 * const apiClient = new ApiClient({ baseURL: AppConfig.API_ROOT, authProvider: ks });
 * ```
 */
export class KeychainStorage implements AuthTokensProvider {
  /**
   * BareAuthClient：无 authProvider 的 ApiClient，专用于 refreshTokens()
   * 发起 /auth/refresh 请求（DD-5）。无 authProvider → 401 时 ApiClient
   * 不会触发刷新逻辑，直接抛 ApiError → 本类 catch 后返回 null，无递归。
   */
  private readonly bareAuthClient: ApiClient;

  /**
   * 认证失败回调（由 AuthProvider 注入，DD-4 Setter 模式）。
   * ApiClient 在 401 且刷新失败时通过 onAuthFailed() 触发，通常引发
   * AuthStore AUTH_EXPIRED → 跳转登录页。
   */
  private authFailedHandler?: () => Promise<void> | void;

  /**
   * @param baseURL - 后端 API 根路径，默认取 AppConfig.API_ROOT
   */
  constructor(baseURL: string = AppConfig.API_ROOT) {
    this.bareAuthClient = new ApiClient({ baseURL });
  }

  /**
   * 注入认证失败回调（DD-4 Setter 模式，打破与 AuthContext 的循环依赖）。
   * AuthProvider 在初始化时调用一次。
   */
  setAuthFailedHandler(handler: () => Promise<void> | void): void {
    this.authFailedHandler = handler;
  }

  /**
   * 持久化令牌 + 用户信息（登录成功 / 刷新成功后调用）。
   * @throws Keychain 写入失败时向上抛出，由 AuthStore 进入 error 状态（DD-4 表格）
   */
  async saveTokens(data: KeychainData): Promise<void> {
    const json = JSON.stringify(data);
    const result = await Keychain.setInternetCredentials(
      KEYCHAIN_SERVER,
      KEYCHAIN_USERNAME,
      json,
    );
    if (!result) {
      // setInternetCredentials 在底层失败时返回 false，统一转为异常向上传播
      throw new Error('[KeychainStorage] saveTokens: setInternetCredentials 返回 false');
    }
  }

  /**
   * 清除 Keychain 中的登录态（登出 / 认证过期时调用）。
   * 失败仅 warn，不阻塞登出流程（DD-4 表格 / DD-12 logout）。
   */
  async clearTokens(): Promise<void> {
    try {
      await Keychain.resetInternetCredentials(KEYCHAIN_SERVER);
    } catch (error) {
      console.warn(
        '[KeychainStorage] clearTokens 失败：',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * 读取完整的 KeychainData（启动恢复阶段调用，DD-12）。
   * @returns 数据完整时返回 KeychainData；不存在 / 解析失败 / 结构非法时返回 null
   */
  async getKeychainData(): Promise<KeychainData | null> {
    try {
      const creds = await Keychain.getInternetCredentials(KEYCHAIN_SERVER);
      // Assumption 6：无数据时 getInternetCredentials 返回 false
      if (!creds) {
        return null;
      }
      const data = JSON.parse(creds.password) as Partial<KeychainData>;
      if (!this.isValidKeychainData(data)) {
        console.warn('[KeychainStorage] getKeychainData: 数据结构不完整，已忽略');
        return null;
      }
      return data;
    } catch (error) {
      console.warn(
        '[KeychainStorage] getKeychainData 失败：',
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  // -------- AuthTokensProvider 实现 --------

  /** @inheritdoc AuthTokensProvider.getAccessToken */
  async getAccessToken(): Promise<string | null> {
    try {
      const data = await this.getKeychainData();
      return data?.accessToken ?? null;
    } catch (error) {
      // getKeychainData 内部已 catch，此处双保险满足 REQ-006 AC-7
      console.warn(
        '[KeychainStorage] getAccessToken 异常：',
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  /** @inheritdoc AuthTokensProvider.getRefreshToken */
  async getRefreshToken(): Promise<string | null> {
    try {
      const data = await this.getKeychainData();
      return data?.refreshToken ?? null;
    } catch (error) {
      console.warn(
        '[KeychainStorage] getRefreshToken 异常：',
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  /**
   * @inheritdoc AuthTokensProvider.refreshTokens
   *
   * 流程（DD-14 刷新时序）：
   *  1. 从 Keychain 读取 refreshToken；无 → 返回 null
   *  2. 用 bareAuthClient.post('/auth/refresh', { refreshToken })
   *     - bareAuthClient 无 authProvider，401 不会触发递归（DD-5）
   *  3. 成功：写回 Keychain（保留原 user），返回新令牌对
   *  4. 失败：返回 null（clearTokens 由后续 onAuthFailed 负责）
   *
   * @returns 新令牌对；刷新失败返回 null
   */
  async refreshTokens(): Promise<{ accessToken: string; refreshToken: string } | null> {
    try {
      const existing = await this.getKeychainData();
      if (!existing || !existing.refreshToken) {
        return null;
      }
      const refreshed = await this.bareAuthClient.post<RefreshResponse>('/auth/refresh', {
        refreshToken: existing.refreshToken,
      });
      if (
        !refreshed ||
        typeof refreshed.accessToken !== 'string' ||
        typeof refreshed.refreshToken !== 'string'
      ) {
        console.warn('[KeychainStorage] refreshTokens: 响应缺少 accessToken/refreshToken');
        return null;
      }
      // 写回 Keychain（保留原 user，refresh 接口不下发 user）
      await this.saveTokens({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        user: existing.user,
      });
      return { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken };
    } catch (error) {
      // 401 / 网络异常 / 写回失败均归为此路径；返回 null，clearTokens 留给 onAuthFailed
      console.warn(
        '[KeychainStorage] refreshTokens 失败：',
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  /**
   * @inheritdoc AuthTokensProvider.onAuthFailed
   *
   * 流程（DD-14 刷新失败分支 / DD-4 onAuthFailed 流程）：
   *  1. clearTokens() 清除本地登录态
   *  2. 调用 authFailedHandler（如有），通常触发 AuthStore AUTH_EXPIRED
   */
  async onAuthFailed(): Promise<void> {
    await this.clearTokens();
    if (this.authFailedHandler) {
      await this.authFailedHandler();
    }
  }

  // -------- 内部工具 --------

  /**
   * 校验从 Keychain 反序列化得到的对象是否满足 KeychainData 形状。
   * 防止历史脏数据 / 手动篡改 / 不同版本写入的结构不匹配导致后续流程崩溃。
   */
  private isValidKeychainData(data: Partial<KeychainData> | null | undefined): data is KeychainData {
    if (!data) {
      return false;
    }
    if (
      typeof data.accessToken !== 'string' ||
      typeof data.refreshToken !== 'string'
    ) {
      return false;
    }
    const user = data.user;
    if (
      !user ||
      typeof user.id !== 'number' ||
      typeof user.username !== 'string' ||
      typeof user.realName !== 'string'
    ) {
      return false;
    }
    return true;
  }
}
