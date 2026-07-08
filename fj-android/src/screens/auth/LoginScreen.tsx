/**
 * LoginScreen — 登录界面
 *
 * 设计依据：WI-0013 / DD-6 UI 设计 / DD-7 错误文案 / DD-13 登录时序图
 *
 * 职责：
 *  - 收集用户名/密码（本地 useState，不进入 AuthStore 全局状态，DD-6）
 *  - 调用 useAuth().login(username, password) 触发登录流程（DD-13）
 *  - 加载态：按钮 disabled + ActivityIndicator（REQ-003 AC-2 / AC-4 字段保留）
 *  - 禁用态：用户名或密码为空时按钮 opacity 0.5（REQ-002 AC-3）
 *  - 错误提示：显示 authState.error.message（REQ-004 AC-1~4）
 *  - 错误清除：用户开始输入时调用 clearError()（REQ-004 AC-6）
 *
 * 约束：仅使用 RN 内置组件 + 内联 StyleSheet，不引入任何 UI 库（REQ-018 AC-4）。
 *       配色主色 #1677ff，与 AppNavigator 保持一致。
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../../store/auth/AuthContext';

/**
 * 登录屏幕组件。
 *
 * 由 RootNavigator 在 authState.status === 'unauthenticated' | 'error' 时渲染（DD-1）。
 *
 * @example
 * // RootNavigator.tsx
 * if (state.status === 'unauthenticated' || state.status === 'error') {
 *   return <LoginScreen />;
 * }
 */
export default function LoginScreen(): React.ReactElement {
  const { state, login, clearError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorDismissed, setErrorDismissed] = useState(false);

  const isLoading = state.status === 'loading';
  // REQ-002 AC-3：用户名或密码为空时禁用；REQ-003 AC-2：加载中禁用
  const isButtonDisabled = !username.trim() || !password.trim() || isLoading;
  // REQ-004 AC-6：本地 errorDismissed flag 隐藏已被用户察觉的旧错误
  const showError = state.error !== null && !errorDismissed;

  const handleLogin = useCallback(async () => {
    // 重新提交前重置 dismissed，使新错误可见
    setErrorDismissed(false);
    await login(username.trim(), password);
  }, [username, password, login]);

  // REQ-004 AC-6：编辑任一输入框 → 标记 dismissed 并调用 clearError()
  const handleUsernameChange = useCallback(
    (text: string) => {
      setUsername(text);
      if (!errorDismissed) {
        setErrorDismissed(true);
      }
      if (state.error !== null) {
        clearError();
      }
    },
    [errorDismissed, state.error, clearError],
  );

  const handlePasswordChange = useCallback(
    (text: string) => {
      setPassword(text);
      if (!errorDismissed) {
        setErrorDismissed(true);
      }
      if (state.error !== null) {
        clearError();
      }
    },
    [errorDismissed, state.error, clearError],
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <View style={styles.form}>
        <Text style={styles.title}>登录</Text>

        <Text style={styles.label}>用户名</Text>
        <TextInput
          style={styles.input}
          value={username}
          placeholder="用户名"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={handleUsernameChange}
          editable={!isLoading}
        />

        <Text style={styles.label}>密码</Text>
        <TextInput
          style={styles.input}
          value={password}
          placeholder="密码"
          secureTextEntry={true}
          onChangeText={handlePasswordChange}
          editable={!isLoading}
          onSubmitEditing={handleLogin}
        />

        {showError && state.error ? (
          <Text style={styles.errorText}>{state.error.message}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.button, isButtonDisabled && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isButtonDisabled}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>登录</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ============== 样式 ==============
// 配色与 AppNavigator 一致：主色 #1677ff；错误红 #ff4d4f（DD-6）
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  form: {
    width: '100%',
    maxWidth: 360,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#ffffff',
  },
  errorText: {
    color: '#ff4d4f',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#1677ff',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
