/**
 * ProfileScreen — "我的"页面（WI-0020）
 *
 * 职责：
 *  - 用户信息展示（username / realName）
 *  - 同步状态展示（last_server_seq + 手动同步按钮）
 *  - 登出按钮
 *  - 关于信息（App 版本号）
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import { useAuth } from '../../store/auth/AuthContext';
import { useSyncEngine } from '../../di/SyncEnginePort';

export default function ProfileScreen(): React.ReactElement {
  const { state, logout, enableBiometric, disableBiometric, biometricEnabled } = useAuth();
  const syncEngine = useSyncEngine();
  const [syncing, setSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    if (!syncEngine) {
      Alert.alert('提示', '同步服务尚未配置');
      return;
    }
    setSyncing(true);
    try {
      await syncEngine.fullSync();
      Alert.alert('同步完成', '数据已与服务端同步');
    } catch (error) {
      Alert.alert(
        '同步失败',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setSyncing(false);
    }
  }, [syncEngine]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      '确认登出',
      '登出后本地数据将保留，但需要重新登录才能同步。',
      [
        { text: '取消', style: 'cancel' },
        { text: '确认登出', style: 'destructive', onPress: () => logout() },
      ],
    );
  }, [logout]);

  const user = state.user;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>用户信息</Text>
        <View style={styles.row}>
          <Text style={styles.label}>用户名</Text>
          <Text style={styles.value}>{user?.username ?? '-'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>姓名</Text>
          <Text style={styles.value}>{user?.realName ?? '-'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>数据同步</Text>
        <TouchableOpacity
          testID="manual-sync-btn"
          style={[styles.button, styles.syncButton]}
          onPress={handleSync}
          disabled={syncing}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>
            {syncing ? '同步中...' : '立即同步'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>安全</Text>
        <View style={styles.row}>
          <Text style={styles.label}>指纹快速登录</Text>
          <Switch
            testID="biometric-switch"
            value={biometricEnabled}
            onValueChange={async (val) => {
              if (val) {
                const ok = await enableBiometric(state.user?.username ?? '', '');
                if (!ok) {
                  Alert.alert('提示', '无法启用指纹登录');
                }
              } else {
                await disableBiometric();
              }
            }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>关于</Text>
        <View style={styles.row}>
          <Text style={styles.label}>版本</Text>
          <Text style={styles.value}>1.0.0</Text>
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          testID="logout-btn"
          style={[styles.button, styles.logoutButton]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  section: {
    backgroundColor: '#ffffff',
    marginTop: 12,
    marginHorizontal: 12,
    borderRadius: 8,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: { fontSize: 15, color: '#333' },
  value: { fontSize: 15, color: '#666' },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  syncButton: { backgroundColor: '#1677ff' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  logoutButton: { backgroundColor: '#fff0f0' },
  logoutText: { color: '#d32f2f', fontSize: 16, fontWeight: '600' },
});
