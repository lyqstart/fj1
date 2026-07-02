/**
 * SyncEnginePort — SyncEngine 的 React 注入端口
 *
 * 设计依据：WI-0001 §2.4 / TASK-022 安卓端检查页面
 *
 * 职责：
 *  - 提供 SyncEngine 的 React Context 注入点，避免屏幕组件直接 import 单例
 *    （database.ts 的 getDatabase() 是模块级单例，直接 import 不便测试与替换）
 *  - 屏幕组件通过 useSyncEngine() hook 获取 SyncEngine 端口实例（可能为 null）
 *  - null 表示同步服务尚未配置（ApiClient 未注入 / baseURL 未配置等），UI 应降级处理
 *
 * 集成方式：
 *  - 后续 task 在 App.tsx 用 <SyncEngineProvider engine={engine}> 包裹根组件
 *  - 当前骨架阶段未挂载 Provider，useSyncEngine() 返回 null，下拉刷新降级为 no-op
 *
 * 与 useDatabase 的关系：
 *  - database 通过 @nozbe/watermelondb/react 的 useDatabase() 注入（官方端口）
 *  - SyncEngine 因为依赖 ApiClient / ClientSyncStateManager / SyncDatabasePort（运行时配置），
 *    单独通过本端口注入
 */
import React, { createContext, useContext } from 'react';
import type { SyncEngine } from '../api/SyncEngine';

/**
 * SyncEngine 注入端口接口。
 * 仅暴露屏幕层需要的同步能力（最小接口原则，便于测试 mock）。
 */
export type SyncEnginePort = Pick<SyncEngine, 'fullSync'>;

/**
 * SyncEngine React Context。
 * 默认值 null：未挂载 Provider 时屏幕层降级处理。
 */
export const SyncEngineContext = createContext<SyncEnginePort | null>(null);

/**
 * SyncEngineProvider 的 props。
 */
export interface SyncEngineProviderProps {
  engine: SyncEnginePort | null;
  children: React.ReactNode;
}

/**
 * SyncEngine Provider 组件。
 * 在 App 根组件包裹一次，所有子屏幕通过 useSyncEngine() 获取实例。
 *
 * @example
 * <SyncEngineProvider engine={syncEngine}>
 *   <AppNavigator />
 * </SyncEngineProvider>
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
