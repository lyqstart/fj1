/**
 * TaskCard — 检查任务卡片组件
 *
 * 设计依据：WI-0001 §2.4 / TASK-022
 *
 * 职责：
 *  - 渲染单个检查任务（标题、地点、状态标签、检查员）
 *  - 点击跳转 TaskDetailScreen
 *
 * 状态标签颜色：
 *  - 待开始：浅蓝底蓝字
 *  - 进行中：蓝底白字（高亮）
 *  - 已完成：绿底白字
 *  - 其他（含已取消）：中性灰
 */
import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';

import type InspectionTaskModel from '../../store/models/InspectionTaskModel';
import {
  TASK_STATUS,
  type TaskStatus,
} from '../../store/models/InspectionTaskModel';
import type { InspectionStackParamList } from './TodayInspectionScreen';

type Navigation = StackNavigationProp<InspectionStackParamList, 'TaskDetail'>;

export interface TaskCardProps {
  /** 待渲染的检查任务记录 */
  inspectionTask: InspectionTaskModel;
}

export default function TaskCard({
  inspectionTask: task,
}: TaskCardProps): React.ReactElement {
  const navigation = useNavigation<Navigation>();

  const handlePress = () => {
    navigation.navigate('TaskDetail', { taskId: task.id });
  };

  return (
    <TouchableOpacity
      testID={`task-card-${task.id}`}
      onPress={handlePress}
      activeOpacity={0.7}
      style={styles.card}
    >
      <Text style={styles.title} numberOfLines={2}>
        {task.taskName || task.taskNo || '未命名任务'}
      </Text>
      <Text style={styles.location} numberOfLines={1}>
        {task.locationNameSnapshot ?? '地点未指定'}
      </Text>
      <View style={styles.metaRow}>
        <StatusBadge status={task.status} />
        <Text style={styles.inspector} numberOfLines={1}>
          检查员：{task.assignedTo || '未指派'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ============== 状态标签子组件 ==============
interface StatusBadgeProps {
  status: TaskStatus | string;
}

function StatusBadge({ status }: StatusBadgeProps): React.ReactElement {
  const palette = getStatusPalette(status);
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{status}</Text>
    </View>
  );
}

interface Palette {
  bg: string;
  fg: string;
}

function getStatusPalette(status: TaskStatus | string): Palette {
  switch (status) {
    case TASK_STATUS.PENDING:
      return { bg: '#e6f4ff', fg: '#1677ff' };
    case TASK_STATUS.IN_PROGRESS:
      return { bg: '#1677ff', fg: '#ffffff' };
    case TASK_STATUS.COMPLETED:
      return { bg: '#52c41a', fg: '#ffffff' };
    default:
      return { bg: '#f0f0f0', fg: '#666666' };
  }
}

// ============== 样式 ==============
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 14,
    borderRadius: 8,
    elevation: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 6,
  },
  location: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inspector: {
    flex: 1,
    fontSize: 12,
    color: '#999999',
    marginLeft: 8,
    textAlign: 'right',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
