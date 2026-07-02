/**
 * InspectionInProgressScreen — 检查中页面
 *
 * 设计依据：WI-0001 §2.4 / REQ-8 离线作业 / TASK-022
 *
 * 职责：
 *  - 逐项检查界面（检查表条目逐条显示 + 标记合格/不合格）
 *  - 检查进度条
 *  - 创建问题入口（IssueCreateButton）
 *  - "提交日报"占位按钮（SubmitReportScreen 由 TASK-028 实现，此处仅占位跳转）
 *
 * 数据约束（重要）：
 *  本地 schema 未包含 inspection_form_items 表（见 TaskDetailScreen 注释与
 *  InspectionTaskModel.formId 说明）。因此本页"检查表条目"在骨架阶段为空列表，
 *  进度条显示 0%，逐项检查 UI 待后续 task 通过在线接口获取条目后启用。
 *  当前页面提供完整的检查交互骨架（合格/不合格切换、问题入口、进度条、提交入口），
 *  条目数据接入后即可工作。
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
} from '../../store/models/InspectionTaskModel';
import type { InspectionStackParamList } from '../today/TodayInspectionScreen';
import IssueCreateButton from './IssueCreateButton';

type InspectionInProgressScreenProps = StackScreenProps<
  InspectionStackParamList,
  'InspectionInProgress'
>;

/**
 * 单个检查条目的交互状态（骨架阶段本地无条目数据，类型预留）。
 * 后续 task 接入检查表条目后填充 items 状态。
 */
export interface InspectionItemState {
  id: string;
  category: string;
  checkContent: string;
  isRequired: boolean;
  /** 该项检查结果：未检 / 合格 / 不合格 */
  result: 'unchecked' | 'pass' | 'fail';
}

export default function InspectionInProgressScreen({
  route,
  navigation,
}: InspectionInProgressScreenProps): React.ReactElement {
  const database = useDatabase();
  const { taskId } = route.params;

  const [task, setTask] = useState<InspectionTaskModel | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // 条目列表骨架阶段为空（本地 schema 未含 inspection_form_items 表）。
  // 使用 state 便于条目接入后直接填充；当前 read 访问用于进度计算与渲染。
  const [items, setItems] = useState<InspectionItemState[]>([]);

  useEffect(() => {
    const collection = database.get<InspectionTaskModel>(INSPECTION_TASK_TABLE);
    const subscription = collection.findAndObserve(taskId).subscribe({
      next: (row) => {
        setTask(row);
        setLoading(false);
      },
      error: () => {
        setLoading(false);
      },
    });
    return () => subscription.unsubscribe();
  }, [database, taskId]);

  const completedCount = items.filter(
    (i) => i.result !== 'unchecked',
  ).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  const setItemResult = (
    itemId: string,
    result: InspectionItemState['result'],
  ) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, result } : it)),
    );
  };

  const handleSubmitReport = () => {
    // SubmitReportScreen 由 TASK-028 实现，此处仅占位跳转（路由未注册时会被忽略）
    navigation.navigate('SubmitReport', { taskId });
  };

  if (loading) {
    return (
      <View style={styles.centering}>
        <ActivityIndicator testID="inspection-in-progress-loading" />
      </View>
    );
  }

  // task 仅用于头部标题展示（task 变更不影响条目交互）
  const headerTitle = task?.taskName ?? '检查任务';

  return (
    <View style={styles.container}>
      {/* 进度条 */}
      <View style={styles.progressWrap}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {headerTitle}
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${progress * 100}%` }]}
          />
        </View>
        <Text style={styles.progressText}>
          已检 {completedCount} / 共 {totalCount} 项
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {totalCount === 0 ? (
          <View style={styles.emptyItems}>
            <Text style={styles.emptyTitle}>暂无检查表条目</Text>
            <Text style={styles.emptyHint}>
              本地未缓存检查表条目（见 schema 注释）。条目列表将在后续 task 通过
              在线接口接入后启用逐项检查。
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onSetResult={(r) => setItemResult(item.id, r)}
            />
          ))
        )}
      </ScrollView>

      {/* 底部操作栏 */}
      <View style={styles.footer}>
        <IssueCreateButton taskId={taskId} />
        <TouchableOpacity
          testID="submit-report-btn"
          style={styles.submitBtn}
          onPress={handleSubmitReport}
        >
          <Text style={styles.submitBtnText}>提交日报（TASK-028）</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============== 单项行组件 ==============
interface ItemRowProps {
  item: InspectionItemState;
  onSetResult: (result: InspectionItemState['result']) => void;
}

function ItemRow({ item, onSetResult }: ItemRowProps): React.ReactElement {
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemCategory}>{item.category}</Text>
        {item.isRequired ? (
          <View style={styles.requiredBadge}>
            <Text style={styles.requiredText}>必检</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.itemContent}>{item.checkContent}</Text>
      <View style={styles.itemActions}>
        <TouchableOpacity
          testID={`item-pass-${item.id}`}
          onPress={() => onSetResult('pass')}
          style={[
            styles.actionBtn,
            item.result === 'pass' && styles.actionBtnPassActive,
          ]}
        >
          <Text
            style={[
              styles.actionBtnText,
              item.result === 'pass' && styles.actionBtnTextActive,
            ]}
          >
            合格
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`item-fail-${item.id}`}
          onPress={() => onSetResult('fail')}
          style={[
            styles.actionBtn,
            item.result === 'fail' && styles.actionBtnFailActive,
          ]}
        >
          <Text
            style={[
              styles.actionBtnText,
              item.result === 'fail' && styles.actionBtnTextActive,
            ]}
          >
            不合格
          </Text>
        </TouchableOpacity>
      </View>
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
  progressWrap: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8e8e8',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: '#1677ff',
  },
  progressText: {
    fontSize: 12,
    color: '#999999',
    marginTop: 6,
  },
  content: {
    padding: 12,
    paddingBottom: 80,
  },
  emptyItems: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemCategory: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1677ff',
  },
  requiredBadge: {
    backgroundColor: '#fff1f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  requiredText: {
    fontSize: 11,
    color: '#ff4d4f',
  },
  itemContent: {
    fontSize: 14,
    color: '#222222',
    marginBottom: 10,
  },
  itemActions: {
    flexDirection: 'row',
  },
  actionBtn: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  actionBtnPassActive: {
    backgroundColor: '#52c41a',
    borderColor: '#52c41a',
  },
  actionBtnFailActive: {
    backgroundColor: '#ff4d4f',
    borderColor: '#ff4d4f',
  },
  actionBtnText: {
    fontSize: 14,
    color: '#666666',
  },
  actionBtnTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e8e8e8',
  },
  submitBtn: {
    flex: 1,
    height: 44,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: '#1677ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
