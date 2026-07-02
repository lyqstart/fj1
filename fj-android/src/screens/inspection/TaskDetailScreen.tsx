/**
 * TaskDetailScreen — 检查任务详情页
 *
 * 设计依据：WI-0001 §2.4 / REQ-7 / TASK-022
 *
 * 职责：
 *  - 显示任务详情（编号、名称、状态、检查员、计划日期、地点、关联检查表 formId）
 *  - 显示检查表条目区域（占位说明，见下方约束）
 *  - "开始检查"按钮跳转 InspectionInProgressScreen
 *
 * 数据约束（重要）：
 *  本地 WatermelonDB schema（src/store/schema.ts）未包含 inspection_form_items 与
 *  check_item_standard_bindings 两张表。依据 InspectionTaskModel.formId 注释：
 *  "检查表本身不下发到本地，提交时按 form_id 走服务端校验"。
 *  因此本页检查表条目区域在骨架阶段以占位说明呈现，待后续 task 通过在线接口
 *  获取检查表条目或扩展本地 schema 后再填充真实条目列表与关联标准。
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useDatabase } from '@nozbe/watermelondb/react';
import type { StackScreenProps } from '@react-navigation/stack';

import InspectionTaskModel, {
  INSPECTION_TASK_TABLE,
  TASK_STATUS,
} from '../../store/models/InspectionTaskModel';
import type { InspectionStackParamList } from '../today/TodayInspectionScreen';

type TaskDetailScreenProps = StackScreenProps<
  InspectionStackParamList,
  'TaskDetail'
>;

export default function TaskDetailScreen({
  route,
  navigation,
}: TaskDetailScreenProps): React.ReactElement {
  const database = useDatabase();
  const { taskId } = route.params;

  const [task, setTask] = useState<InspectionTaskModel | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);

  // 响应式订阅任务（findAndObserve 支持本地变更自动刷新）
  useEffect(() => {
    const collection = database.get<InspectionTaskModel>(INSPECTION_TASK_TABLE);
    const subscription = collection.findAndObserve(taskId).subscribe({
      next: (row) => {
        setTask(row);
        setLoading(false);
        setNotFound(false);
      },
      error: () => {
        // 找不到记录（已删除或 ID 非法）
        setNotFound(true);
        setLoading(false);
      },
    });
    return () => subscription.unsubscribe();
  }, [database, taskId]);

  const handleStartInspection = () => {
    navigation.navigate('InspectionInProgress', { taskId });
  };

  if (loading) {
    return (
      <View style={styles.centering}>
        <ActivityIndicator testID="task-detail-loading" />
      </View>
    );
  }

  if (notFound || !task) {
    return (
      <View style={styles.centering}>
        <Text style={styles.emptyTitle}>任务不存在</Text>
        <Text style={styles.emptyHint}>该任务可能已被删除或取消</Text>
      </View>
    );
  }

  const editable =
    task.status === TASK_STATUS.PENDING ||
    task.status === TASK_STATUS.IN_PROGRESS;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="基本信息">
        <DetailRow label="任务编号" value={task.taskNo || '—'} />
        <DetailRow label="任务名称" value={task.taskName || '—'} />
        <DetailRow label="状态" value={task.status} />
        <DetailRow label="检查员" value={task.assignedTo || '未指派'} />
        <DetailRow
          label="计划日期"
          value={task.plannedDate ? formatDate(task.plannedDate) : '未排期'}
        />
        <DetailRow
          label="地点"
          value={task.locationNameSnapshot ?? '地点未指定'}
        />
      </Section>

      <Section title="检查表">
        {task.formId ? (
          <Text style={styles.formIdText}>关联检查表 ID：{task.formId}</Text>
        ) : (
          <Text style={styles.formIdText}>未关联检查表</Text>
        )}
        <Text style={styles.noticeText}>
          检查表条目本地不下发（见 InspectionTaskModel.formId 注释）。骨架阶段
          条目列表为空，关联标准展示待条目接入后启用；提交日报时按 form_id 走服务端校验。
        </Text>
      </Section>

      <TouchableOpacity
        testID="start-inspection-btn"
        disabled={!editable}
        onPress={handleStartInspection}
        style={[styles.primaryBtn, !editable && styles.primaryBtnDisabled]}
        activeOpacity={0.7}
      >
        <Text style={styles.primaryBtnText}>
          {editable ? '开始检查' : '当前状态不可开始检查'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ============== 子组件 ==============
interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps): React.ReactElement {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps): React.ReactElement {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} selectable>
        {value}
      </Text>
    </View>
  );
}

/** 格式化日期为 YYYY-MM-DD */
function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============== 样式 ==============
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 12,
    paddingBottom: 32,
  },
  centering: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999999',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  sectionBody: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  detailLabel: {
    width: 80,
    fontSize: 14,
    color: '#999999',
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: '#222222',
  },
  formIdText: {
    fontSize: 14,
    color: '#222222',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 12,
    color: '#999999',
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: '#1677ff',
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnDisabled: {
    backgroundColor: '#b0cfff',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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
});
