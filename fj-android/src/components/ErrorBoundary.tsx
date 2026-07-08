/**
 * ErrorBoundary — 应用级错误边界
 *
 * 设计依据：WI-0013 / DD-9 ErrorBoundary 设计 / DD-1 三层包裹架构（L1 最外层）
 *
 * 职责：
 *  - 捕获整个应用渲染期未捕获异常（REQ-011 AC-1）
 *  - getDerivedStateFromError：捕获异常 → state.hasError=true
 *  - componentDidCatch：console.error 记录（不向用户显示堆栈，REQ-011 AC-4）
 *  - 降级 UI：「应用遇到错误」+ error.message +「重新加载」按钮
 *  - 重新加载：setState({hasError:false})，重渲染子组件树
 *  - 降级 UI 自身崩溃 → RN 默认红屏兜底（REQ-011 AC-5）
 *
 * 约束：React 错误边界必须 Class Component；不引入第三方库（DD-9）。
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * 应用错误边界组件。
 *
 * 在 App.tsx 中作为最外层包裹：
 *   <ErrorBoundary>
 *     <AuthProvider>
 *       <RootNavigator />
 *     </AuthProvider>
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: undefined });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>应用遇到错误</Text>
          <Text style={styles.message}>{this.state.error?.message || '未知错误'}</Text>
          <TouchableOpacity style={styles.button} onPress={this.handleReload}>
            <Text style={styles.buttonText}>重新加载</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// ============== 样式 ==============
// 配色与 AppNavigator / LoginScreen 一致：主色 #1677ff（DD-6）
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#1677ff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
