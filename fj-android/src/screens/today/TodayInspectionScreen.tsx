/**
 * TodayInspectionScreen — 今日检查列表页
 *
 * 设计依据：WI-0001 §2.4 / REQ-7 任务接收 / TASK-022
 *
 * 职责：
 *  - 按 planned_date 过滤今日检查任务（排除已取消）
 *  - 从 WatermelonDB 响应式读取（query.observe() 订阅，数据变化自动刷新）
 *  - FlatList 渲染任务卡片（TaskCard）
 *  - 下拉刷新触发 SyncEngine.fullSync()（通过注入端口获取，未配置则降级）
 *  - 空状态提示
 *
 * 数据绑定：使用 @nozbe/watermelondb/react 的 useDatabase() 注入端口，
 *           不直接 import database.ts 的 getDatabase() 单例。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  type ListRenderItem,
} from 'react-native';
import { useDatabase } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';

import InspectionTaskModel, {
  INSPECTION_TASK_TABLE,
  TASK_STATUS,
} from '../../store/models/InspectionTaskModel';
import { useSyncEngine } from '../../di/SyncEnginePort';
import TaskCard from './TaskCard';

// ============== 路由参数表 ==============
/**
 * 检查流程 Stack 路由参数表。
 *
 * 本 task 仅定义类型；实际 Stack Navigator 集成由后续 task 完成
 * （AppNavigator 当前为 BottomTab 骨架，未挂载这些 screen）。
 *
 * SubmitReport / IssueEvidence 路由的目标 screen 由 TASK-028 实现，
 * 此处提前声明参数表以保持跳转调用类型一致。
 */
export type InspectionStackParamList = {
  TodayInspection: undefined;
  TaskDetail: { taskId: string };
  InspectionInProgress: { taskId: string };
  SubmitReport: { taskId: string };
  IssueEvidence: { taskId: string; taskItemId?: string };
};

// ============== 工具函数 ==============
/**
 * 计算今日 [start, end) 时间戳范围（本地时区当日 0 点）。
 * planned_date 在 schema 中为 number 时间戳。
 */
function getTodayRange(): { start: number; end: number } {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return { start, end };
}

// ============== 组件 ==============
/**
 * 今日检查列表页（默认导出，作为 Tab 屏幕或 Stack screen 挂载）。
 */
export default function TodayInspectionScreen(): React.ReactElement {
  const database = useDatabase();
  const syncEngine = useSyncEngine();

  const [tasks, setTasks] = useState<InspectionTaskModel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // 响应式订阅今日检查任务（数据变化自动刷新列表）
  useEffect(() => {
    const { start, end } = getTodayRange();
    const collection = database.get<InspectionTaskModel>(INSPECTION_TASK_TABLE);
    const query = collection.query(
      Q.where('planned_date', Q.gte(start)),
      Q.where('planned_date', Q.lt(end)),
      Q.where('status', Q.notIn([TASK_STATUS.CANCELLED])),
    );
    const subscription = query.observe().subscribe({
      next: (rows) => {
        setTasks(rows);
        setLoading(false);
      },
      error: (error: unknown) => {
        // 查询失败（如 schema 未迁移）保留空列表，避免崩溃
        setLoading(false);
        setSyncMessage(
          `任务读取失败：${error instanceof Error ? error.message : String(error)}`,
        );
      },
    });
    return () => subscription.unsubscribe();
  }, [database]);

  // 下拉刷新触发 fullSync（注入端口获取 SyncEngine，未配置则降级提示）
  const onRefresh = useCallback(async () => {
    if (!syncEngine) {
      setSyncMessage('同步服务尚未配置，无法拉取新任务');
      return;
    }
    setRefreshing(true);
    setSyncMessage(null);
    try {
      await syncEngine.fullSync();
      setSyncMessage('同步完成');
    } catch (error) {
      setSyncMessage(
        `同步失败：${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setRefreshing(false);
    }
  }, [syncEngine]);

  const renderItem: ListRenderItem<InspectionTaskModel> = useCallback(
    ({ item }) => <TaskCard inspectionTask={item} />,
    [],
  );

  const keyExtractor = useCallback(
    (item: InspectionTaskModel) => item.id,
    [],
  );

  const emptyComponent = useMemo(
    () => (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>今日暂无检查任务</Text>
        <Text style={styles.emptyHint}>下拉刷新以同步最新任务</Text>
      </View>
    ),
    [],
  );

  if (loading) {
    return (
      <View style={styles.centering}>
        <ActivityIndicator testID="today-loading" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {syncMessage ? (
        <Text style={styles.syncMessage} numberOfLines={2}>
          {syncMessage}
        </Text>
      ) : null}
      <FlatList
        testID="today-task-list"
        data={tasks}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={
          tasks.length === 0 ? styles.emptyList : styles.list
        }
        ListEmptyComponent={emptyComponent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}

// ============== 样式 ==============
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centering: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingVertical: 8,
  },
  emptyList: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 13,
    color: '#999999',
  },
  syncMessage: {
    fontSize: 12,
    color: '#999999',
    backgroundColor: '#fafafa',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
