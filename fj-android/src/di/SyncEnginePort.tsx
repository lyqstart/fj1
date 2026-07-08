/**
 * SyncEnginePort — SyncEngine 的 React 注入端口
 *
 * 设计依据：WI-0001 §2.4 / WI-0015 DD-5（5.2 + 5.3）/ DD-6 / REQ-5 / REQ-6
 *
 * 职责：
 *  - SyncEngineProvider / useSyncEngine：React Context 注入点（既有，保留）
 *  - createSyncEngine 工厂：纯函数，便于测试；构造 ApiClient + ClientSyncStateManager
 *    + SyncDatabaseAdapter → SyncEngine 实例
 *  - SyncEngineInitializer 组件：从 useAuth() 取 apiClient，从 useDatabase() 取 database，
 *    构造 SyncEngine 注入 SyncEngineProvider，并在 state.status==='authenticated' 时
 *    fire-and-forget 触发 fullSync（不阻塞 UI；REQ-6.AC3）
 *
 * 与 useDatabase 的关系：
 *  - database 通过 @nozbe/watermelondb/react 的 useDatabase() 注入（官方端口）
 *  - SyncEngine 因为依赖 ApiClient / ClientSyncStateManager / SyncDatabasePort（运行时配置），
 *    单独通过本端口注入
 *
 * 嵌套要求（REQ-3.AC2 / REQ-5.AC7）：
 *   <DatabaseProvider>            ← 提供 useDatabase()
 *     <SyncEngineInitializer>     ← 消费 useDatabase + useAuth
 *       <RootNavigator />
 *     </SyncEngineInitializer>
 *   </DatabaseProvider>
 */
import React, { createContext, useContext, useEffect, useMemo } from 'react';

import { Database } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';

import { SyncEngine } from '../api/SyncEngine';
import { ClientSyncStateManager } from '../api/ClientSyncStateManager';
import type { KeyValueStorage } from '../api/ClientSyncStateManager';
import { SyncDatabaseAdapter } from '../store/SyncDatabaseAdapter';
import type { ApiClient } from '../api/ApiClient';
import { useAuth } from '../store/auth/AuthContext';

// ============== 既有 Provider / hook（追加，不重写）==============
/**
 * SyncEngine 注入端口接口。
 * 仅暴露屏幕层需要的同步能力（最小接口原则，便于测试 mock）。
 */
export type SyncEnginePort = Pick<SyncEngine, 'fullSync' | 'push' | 'pull'>;

/**
 * SyncEngine React Context。
 * 默认值 null：未挂载 Provider 时屏幕层降级处理。
 */
export const SyncEngineContext = createContext<SyncEnginePort | null>(null);

export interface SyncEngineProviderProps {
  engine: SyncEnginePort | null;
  children: React.ReactNode;
}

/**
 * SyncEngine Provider 组件。
 * 在 App 根组件包裹一次，所有子屏幕通过 useSyncEngine() 获取实例。
 */
export function SyncEngineProvider({
  engine,
  children,
}: SyncEngineProviderProps): React.ReactElement {
  return (
    <SyncEngineContext.Provider value={engine}>
      {children}
    </SyncEngineContext.Provider>
  );
}

/**
 * 获取已注入的 SyncEngine 端口。
 * @returns SyncEngine 端口实例；未挂载 Provider 时返回 null（屏幕层应降级）
 */
export function useSyncEngine(): SyncEnginePort | null {
  return useContext(SyncEngineContext);
}

// ============== createSyncEngine 工厂（DD-5 5.2）==============
/**
 * 内置的内存 KeyValueStorage 实现（非持久化）。
 *
 * 用途：当调用方未显式注入 `storage` 时作为默认值，保证 createSyncEngine 始终可用。
 * **非持久化**：进程重启后 last_server_seq / last_synced_at 丢失，仅适用于 dev/测试。
 * 生产环境应通过 `createSyncEngine({ storage: AsyncStorage })` 注入持久化实现
 * （需先安装 `@react-native-async-storage/async-storage`）。
 */
class InMemoryKeyValueStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>();
  getItem(key: string): Promise<string | null> {
    return Promise.resolve(this.map.has(key) ? this.map.get(key) ?? null : null);
  }
  setItem(key: string, value: string): Promise<void> {
    this.map.set(key, value);
    return Promise.resolve();
  }
  removeItem(key: string): Promise<void> {
    this.map.delete(key);
    return Promise.resolve();
  }
}

/**
 * createSyncEngine 工厂参数。
 */
export interface CreateSyncEngineParams {
  apiClient: ApiClient;
  database: Database;
  projectId?: string;
  /** 可选注入 KeyValueStorage。未提供时降级为 InMemoryKeyValueStorage（非持久化）。 */
  storage?: KeyValueStorage;
}

/**
 * 构造 SyncEngine 实例的纯工厂函数。
 *
 * 职责（DD-5 5.2）：
 *  - 实例化 ClientSyncStateManager（用注入或默认 AsyncStorage）
 *  - 实例化 SyncDatabaseAdapter（包装 WatermelonDB database）
 *  - 实例化 SyncEngine，传入三个依赖 + projectId 选项
 *
 * @example
 * const engine = createSyncEngine({ apiClient, database, projectId: 'P001' });
 * await engine.fullSync();
 */
export function createSyncEngine(params: CreateSyncEngineParams): SyncEngine {
  const storage: KeyValueStorage = params.storage ?? new InMemoryKeyValueStorage();
  const syncStateMgr = new ClientSyncStateManager(storage, params.projectId);
  const dbAdapter = new SyncDatabaseAdapter(params.database);
  return new SyncEngine(params.apiClient, syncStateMgr, dbAdapter, {
    projectId: params.projectId,
  });
}

// ============== SyncEngineInitializer 组件（DD-5 5.3 + DD-6）==============
/**
 * SyncEngineInitializer — 消费 useAuth + useDatabase 构造 SyncEngine 并注入 Provider。
 *
 * 行为（REQ-5 / REQ-6）：
 *  - useMemo 稳定 engine 引用，依赖 [database, apiClient, projectId]。
 *  - database 或 apiClient 为 null 时返回 null（降级；REQ-5.AC6）。
 *  - useEffect 监听 auth.state.status === 'authenticated'：fire-and-forget
 *    触发 engine.fullSync()，失败仅 console.warn（截断 ≤100 字符），不 await（REQ-6）。
 *  - 必须嵌套在 DatabaseProvider + AuthProvider 之内（由 AppRoot 保证嵌套顺序）。
 *
 * @example
 * <DatabaseProvider database={db}>
 *   <SyncEngineInitializer>
 *     <RootNavigator />
 *   </SyncEngineInitializer>
 * </DatabaseProvider>
 */
export function SyncEngineInitializer({
  children,
  projectId,
}: {
  children: React.ReactNode;
  projectId?: string;
}): React.ReactElement | null {
  const database = useDatabase();
  const { state, apiClient } = useAuth();

  // useMemo 稳定 engine 引用（REQ-5.AC3），database/apiClient/projectId 任一变化时重建
  const engine = useMemo<SyncEnginePort | null>(() => {
    if (!database || !apiClient) {
      // database 或 apiClient 缺失时降级（REQ-5.AC6）
      return null;
    }
    return createSyncEngine({ apiClient, database, projectId });
  }, [database, apiClient, projectId]);

  // DD-6 / REQ-6：登录成功后 fire-and-forget 触发 fullSync，不阻塞 UI
  useEffect(() => {
    if (!engine) {
      return;
    }
    if (state.status !== 'authenticated') {
      return;
    }
    // fire-and-forget；fullSync 内部 withSyncLock 保证幂等，React 18 StrictMode 双触发安全
    engine
      .fullSync()
      .then(() => {
        console.log('[SyncEngine] fullSync 触发成功（登录后自动同步）');
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[SyncEngine] fullSync 失败（不阻塞 UI）: ${msg}`.slice(0, 100),
        );
      });
  }, [engine, state.status]);

  if (!engine) {
    // engine 未就绪：直接渲染 children（useSyncEngine 返回 null，屏幕层降级）
    return <>{children}</>;
  }

  return <SyncEngineProvider engine={engine}>{children}</SyncEngineProvider>;
}
