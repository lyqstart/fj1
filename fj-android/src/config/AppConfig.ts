/**
 * AppConfig — 应用全局配置（WI-0012 DD-3）
 *
 * 集中管理可配置项，后续 WI 可修改此文件调整配置。
 * 用户决策：API 地址使用公网 IP 硬编码（修改配置文件即可更改）。
 */

/**
 * 后端 API 基地址。
 *
 * 生产环境：公网 IP（用户决策）
 * 后续如需切换为域名或内网地址，修改此常量即可。
 *
 * 注意：不以 / 结尾，路径拼接由 ApiClient 处理。
 */
export const API_BASE_URL = 'http://129.211.5.240';

/**
 * API 版本前缀。
 */
export const API_VERSION_PREFIX = '/api/v1';

/**
 * 完整的 API 根路径（baseURL + version）。
 * ApiClient 构造时使用此值。
 */
export const API_ROOT = `${API_BASE_URL}${API_VERSION_PREFIX}`;

/**
 * 应用配置常量集合。
 * 后续 WI 可在此扩展（同步间隔、超时、重试策略等）。
 */
export const AppConfig = {
  API_BASE_URL,
  API_VERSION_PREFIX,
  API_ROOT,
} as const;
