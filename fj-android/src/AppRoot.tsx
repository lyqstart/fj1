/**
 * AppRoot — 应用根组件（WI-0015 DD-3）
 *
 * 职责：
 *  - 异步初始化数据库（initDatabase）
 *  - 管理 loading/error/ready 三态
 *  - 渲染 DatabaseProvider + SyncEngineInitializer 包裹层
 *  - AppInner 监听 auth state 触发 fire-and-forget fullSync
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';

import { initDatabase, resetDatabaseInstance } from './store/database';
import { SyncEngineInitializer } from './di/SyncEnginePort';
import { PhotoUploadProvider } from './di/PhotoUploadPort';
import { PhotoUploadQueue } from './api/PhotoUploadQueue';
import { useAuth } from './store/auth/AuthContext';
import RootNavigator from './navigation/RootNavigator';
import { logger } from './utils/Logger';
import type { Database } from '@nozbe/watermelondb';

type InitState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; db: Database };

function AppRoot(): React.ReactElement {
  const [state, setState] = useState<InitState>({ status: 'loading' });

  const initialize = async () => {
    setState({ status: 'loading' });
    logger.info('DB', 'initDatabase starting');
    try {
      const db = await initDatabase();
      logger.info('DB', 'Database initialized successfully');
      setState({ status: 'ready', db });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('DB', 'initDatabase failed', { message, stack: error instanceof Error ? error.stack : undefined });
      setState({ status: 'error', message });
    }
  };

  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.text}>初始化数据库...</Text>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>数据库初始化失败</Text>
        <Text style={styles.detailText}>{state.message}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            resetDatabaseInstance();
            initialize();
          }}
        >
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <DatabaseProvider database={state.db}>
      <SyncEngineInitializer>
        <PhotoUploadInitializer>
          <AppInner />
        </PhotoUploadInitializer>
      </SyncEngineInitializer>
    </DatabaseProvider>
  );
}

/**
 * PhotoUploadInitializer — 消费 useAuth().apiClient 构造 PhotoUploadQueue 并注入 Provider（WI-0018 DD-1）。
 *
 * 行为：
 *  - useMemo 稳定 queue 引用，依赖 [apiClient]。
 *  - apiClient 为 null（未登录）时 queue=null，PhotoUploadProvider 注入 null（屏幕层降级）。
 *  - 使用 PhotoUploadQueue 默认 FetchBlobChunkReader（降级模式，WI-0018 骨架激活）；
 *    生产大图场景后续可注入基于原生文件 IO 的 PhotoChunkReader。
 */
function PhotoUploadInitializer({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const { apiClient } = useAuth();
  const queue = useMemo<PhotoUploadQueue | null>(() => {
    if (!apiClient) {
      return null;
    }
    return new PhotoUploadQueue(apiClient);
  }, [apiClient]);

  return <PhotoUploadProvider queue={queue}>{children}</PhotoUploadProvider>;
}

/**
 * AppInner — 认证后触发首次同步
 * 监听 useAuth().state.status === 'authenticated' 时 fire-and-forget 调用 fullSync
 */
function AppInner(): React.ReactElement {
  const { state } = useAuth();
  // 注意：useSyncEngine 必须在 SyncEngineProvider 内使用，AppInner 已在 SyncEngineInitializer 内
  // 但本组件不直接 useSyncEngine（避免 Provider 嵌套顺序问题），fullSync 触发由 SyncEngineInitializer 内部 useEffect 完成
  // AppInner 仅负责渲染 RootNavigator
  return <RootNavigator />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  text: { marginTop: 12, fontSize: 14, color: '#666' },
  errorText: { fontSize: 16, fontWeight: 'bold', color: '#d32f2f', marginBottom: 8 },
  detailText: { fontSize: 12, color: '#888', marginBottom: 16, paddingHorizontal: 32, textAlign: 'center' },
  retryButton: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#1976d2', borderRadius: 8 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

export default AppRoot;
