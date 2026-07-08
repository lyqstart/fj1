/**
 * BootErrorScreen — 启动失败兜底屏
 *
 * 设计依据：WI-0028
 *
 * 职责：
 *  - 当 App 模块 import 失败时显示的「最后一道防线」UI，即使整个应用崩溃也必须能渲染。
 *  - 展示错误名称、错误信息、可滚动的堆栈跟踪。
 *  - 「复制错误信息」按钮：优先使用 @react-native-clipboard/clipboard 复制到剪贴板，
 *    剪贴板模块不可用时回退到 Alert.alert 展示错误（保障最后一道防线可用）。
 *
 * 约束：仅使用 react / react-native 原生组件，不引入第三方 UI 库；
 *      剪贴板通过运行时 require 动态获取（可选依赖，缺失时降级）。
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';

interface Props {
  error: Error;
}

/**
 * 启动失败兜底屏组件。
 *
 * 用法（在 bootstrap catch 中）：
 *   try {
 *     const App = require('./App').default;
 *     AppRegistry.registerComponent('fj', () => App);
 *   } catch (e) {
 *     const error = e instanceof Error ? e : new Error(String(e));
 *     AppRegistry.registerComponent('fj', () => () => <BootErrorScreen error={error} />);
 *   }
 */
export default function BootErrorScreen({ error }: Props): React.ReactElement {
  const handleCopy = (): void => {
    const errorText = `${error.name}: ${error.message}\n\n${error.stack || 'No stack trace available'}`;
    try {
      // 动态 require：剪贴板是可选依赖，缺失或运行时不可用时降级到 Alert
      const Clipboard = require('@react-native-clipboard/clipboard');
      if (Clipboard && typeof Clipboard.setString === 'function') {
        Clipboard.setString(errorText);
      } else if (Clipboard?.default && typeof Clipboard.default.setString === 'function') {
        Clipboard.default.setString(errorText);
      } else {
        throw new Error('Clipboard module has no setString');
      }
    } catch {
      // 最后一道防线：剪贴板不可用，用 Alert 展示错误信息供用户手动复制
      Alert.alert('无法复制到剪贴板', errorText, [{ text: '好的' }]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚠ 启动失败</Text>
      <Text style={styles.subtitle}>应用程序遇到了一个错误，无法正常启动</Text>
      <Text style={styles.errorName}>{error.name}</Text>
      <Text style={styles.errorMessage}>{error.message}</Text>
      <ScrollView style={styles.stackScroll}>
        <Text style={styles.stackText}>{error.stack || 'No stack trace available'}</Text>
      </ScrollView>
      <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
        <Text style={styles.copyButtonText}>复制错误信息</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============== 样式 ==============
// 配色：标题红色 #d32f2f（错误）；按钮主色 #1677ff（与 ErrorBoundary 一致，DD-6）
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d32f2f',
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
  },
  errorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 16,
  },
  errorMessage: {
    fontSize: 14,
    color: '#d32f2f',
    marginTop: 8,
  },
  stackScroll: {
    flex: 1,
    marginTop: 16,
  },
  stackText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#999999',
  },
  copyButton: {
    backgroundColor: '#1677ff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  copyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
