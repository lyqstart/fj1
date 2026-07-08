/**
 * RootNavigator — 导航守卫（L3 条件渲染层）
 *
 * 设计依据：WI-0013 / DD-1 三层架构 L3 / REQ-010 AC-1/2/3
 *
 * 职责：
 *  - 根据 authState.status 条件渲染（5 态状态机 DD-8 全覆盖）：
 *    1. idle 或 isRestoring（启动恢复）→ ActivityIndicator 启动屏
 *    2. unauthenticated / error → LoginScreen
 *    3. loading（如 logout 中）→ ActivityIndicator 启动屏
 *    4. authenticated → AppNavigator（主应用）
 *  - 不持有业务状态，仅做渲染决策（DD-1 YAGNI）
 *
 * 使用方式：被 AuthProvider 包裹（DD-1 三层架构 L2→L3）：
 *   <AuthProvider><RootNavigator /></AuthProvider>
 */
import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import { useAuth } from '../store/auth/AuthContext';
import LoginScreen from '../screens/auth/LoginScreen';
import AppNavigator from './AppNavigator';

/**
 * 根导航组件。根据认证状态决定渲染登录界面或主应用。
 */
export default function RootNavigator(): React.ReactElement {
  const { state } = useAuth();

  // 启动恢复阶段：显示 Loading
  if (state.status === 'idle' || state.isRestoring) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1677ff" />
      </View>
    );
  }

  // 未登录或错误状态：显示登录界面
  if (state.status === 'unauthenticated' || state.status === 'error') {
    return <LoginScreen />;
  }

  // loading 但非 restoring（如 logout 中）：显示 Loading
  if (state.status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1677ff" />
      </View>
    );
  }

  // authenticated：显示主应用
  return <AppNavigator />;
}

// ============== 样式 ==============
const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
