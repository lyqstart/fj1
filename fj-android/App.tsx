/**
 * App — 飞检安卓端应用入口（WI-0015 四层架构）
 *
 * L1 ErrorBoundary → L2 AuthProvider → L3 AppRoot（数据库 + 同步初始化） → L4 业务导航
 *
 * AppRoot 内部管理数据库异步加载、DatabaseProvider/SyncEngineInitializer 包裹。
 */
import React from 'react';
import ErrorBoundary from './src/components/ErrorBoundary';
import { AuthProvider } from './src/store/auth/AuthContext';
import AppRoot from './src/AppRoot';
import { logger } from './src/utils/Logger';

export default function App(): React.ReactElement {
  React.useEffect(() => {
    logger.info('APP', 'App component mounted');
  }, []);
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRoot />
      </AuthProvider>
    </ErrorBoundary>
  );
}
