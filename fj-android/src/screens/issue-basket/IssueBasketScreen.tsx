/**
 * IssueBasketScreen — 问题篮子页（今日草稿问题汇总）
 *
 * 设计依据：WI-0001 §2.4 / REQ-9 / §101.22 多任务日报 / TASK-028
 *
 * 职责：
 *  - 列出今日创建的待推送问题（sync_status='pending_push' 且 created_at 在今日）
 *  - 响应式订阅（query.observe()，本地变更自动刷新）
 *  - 每条问题卡片：描述摘要、严重等级标签、照片缩略图数量（取自 issue.photoCount 缓存）
 *  - 删除草稿问题（destroyPermanently，级联删除其照片——仅对从未同步的草稿安全）
 *  - 编辑草稿问题（导航到 IssueEvidence，骨架阶段复用今日任务作为上下文，见下方约束）
 *  - 底部"提交今日检查成果"按钮 → 导航到 SubmitReportScreen
 *
 * 数据约束（重要）：
 *  本地 WatermelonDB 不维护 daily_report↔inspection_task 关联表（见
 *  InspectionTaskModel 注释"骨架阶段不在本地维护该关联表"）。DailyReportIssue 仅持有
 *  taskItemId（检查表条目 ID，非任务 ID），无法本地反查所属 InspectionTask。
 *  因此骨架阶段"编辑"与"提交"按钮所需 taskId 采用以下解析策略（已标注为骨架行为）：
 *   - 查询今日检查任务，取第一条作为上下文 taskId
 *   - 若今日无任务，按钮降级为提示 Alert
 *  真正按任务精确回溯编辑上下文，待本地关联表或服务端查询接入后实现。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  type ListRenderItem,
} from 'react-native';
import { useDatabase } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';
import type { StackNavigationProp } from '@react-navigation/stack';

import DailyReportIssueModel, {
  DAILY_REPORT_ISSUE_TABLE,
  ISSUE_SEVERITY,
  type IssueSeverity,
} from '../../store/models/DailyReportIssueModel';
import PhotoModel, { PHOTO_TABLE } from '../../store/models/PhotoModel';
import InspectionTaskModel, {
  INSPECTION_TASK_TABLE,
  TASK_STATUS,
} from '../../store/models/InspectionTaskModel';
import { SYNC_STATUS } from '../../store/models/DailyReportModel';
import type { InspectionStackParamList } from '../today/TodayInspectionScreen';

type Navigation = StackNavigationProp<InspectionStackParamList>;

// ============== 工具函数 ==============
/** 计算今日 [start, end) 时间戳范围（本地时区当日 0 点） */
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

/** 截断描述为摘要（最多 maxLen 字符） */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) {
    return text;
  }
  return text.slice(0, maxLen) + '…';
}

/**
 * 严重等级对应的标签颜色（独立函数，避免 StyleSheet.create 不接受函数的限制）。
 * 与 IssueEvidenceScreen.getSeverityActiveStyle 配色一致。
 */
function getSeverityColor(sev: IssueSeverity): string {
  if (sev === ISSUE_SEVERITY.MAJOR) {
    return '#fa8c16';
  }
  if (sev === ISSUE_SEVERITY.CRITICAL) {
    return '#ff4d4f';
  }
  return '#1677ff';
}

// ============== 主组件 ==============
export default function IssueBasketScreen({
  navigation,
}: {
  navigation: Navigation;
}): React.ReactElement {
  const database = useDatabase();

  const [issues, setIssues] = useState<DailyReportIssueModel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [todayTaskId, setTodayTaskId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // 响应式订阅今日待推送问题
  useEffect(() => {
    const { start, end } = getTodayRange();
    const collection =
      database.get<DailyReportIssueModel>(DAILY_REPORT_ISSUE_TABLE);
    const query = collection.query(
      Q.where('sync_status', Q.eq(SYNC_STATUS.PENDING_PUSH)),
      Q.where('created_at', Q.gte(start)),
      Q.where('created_at', Q.lt(end)),
    );
    const subscription = query.observe().subscribe({
      next: (rows) => {
        setIssues(rows);
        setLoading(false);
      },
      error: () => {
        setLoading(false);
      },
    });
    return () => subscription.unsubscribe();
  }, [database]);

  // 解析今日任务上下文 taskId（骨架策略：取今日第一条非取消任务）
  useEffect(() => {
    const { start, end } = getTodayRange();
    const collection =
      database.get<InspectionTaskModel>(INSPECTION_TASK_TABLE);
    const subscription = collection
      .query(
        Q.where('planned_date', Q.gte(start)),
        Q.where('planned_date', Q.lt(end)),
        Q.where('status', Q.notIn([TASK_STATUS.CANCELLED])),
      )
      .observe()
      .subscribe({
        next: (rows) => {
          setTodayTaskId(rows.length > 0 ? rows[0].id : null);
        },
        error: () => {
          setTodayTaskId(null);
        },
      });
    return () => subscription.unsubscribe();
  }, [database]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // 触发响应式重新查询（observe 会自动刷新）；短暂展示刷新态
    setRefreshing(false);
  }, []);

  // ---- 删除草稿问题（级联删除其照片）----
  const handleDelete = useCallback(
    (issue: DailyReportIssueModel) => {
      Alert.alert(
        '删除草稿问题',
        '该问题及其照片将从本地草稿中删除（尚未同步至服务端，可安全删除）。',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '删除',
            style: 'destructive',
            onPress: async () => {
              setBusyId(issue.id);
              try {
                await database.write(async () => {
                  // 级联删除该问题下的照片（均为未同步草稿）
                  const photoCollection =
                    database.get<PhotoModel>(PHOTO_TABLE);
                  const photos = await photoCollection
                    .query(
                      Q.where('daily_report_issue_id', issue.id),
                    )
                    .fetch();
                  const destroyPhotos = photos.map((p) =>
                    p.prepareDestroyPermanently(),
                  );
                  await database.batch(destroyPhotos);
                  await issue.destroyPermanently();
                });
              } catch (error) {
                Alert.alert(
                  '删除失败',
                  error instanceof Error ? error.message : String(error),
                );
              } finally {
                setBusyId(null);
              }
            },
          },
        ],
      );
    },
    [database],
  );

  // ---- 编辑草稿问题（导航到 IssueEvidence，骨架阶段复用今日任务上下文）----
  const handleEdit = useCallback(
    (issue: DailyReportIssueModel) => {
      if (!todayTaskId) {
        Alert.alert(
          '无法编辑',
          '今日无可用的检查任务上下文。请先从今日检查列表进入任务后再编辑问题。',
        );
        return;
      }
      navigation.navigate('IssueEvidence', {
        taskId: todayTaskId,
        taskItemId: issue.taskItemId ?? undefined,
      });
    },
    [navigation, todayTaskId],
  );

  // ---- 提交今日检查成果 ----
  const handleSubmit = useCallback(() => {
    if (!todayTaskId) {
      Alert.alert(
        '无法提交',
        '今日无可用的检查任务上下文。请先从今日检查列表进入任务后再提交日报。',
      );
      return;
    }
    navigation.navigate('SubmitReport', { taskId: todayTaskId });
  }, [navigation, todayTaskId]);

  const renderItem: ListRenderItem<DailyReportIssueModel> = useCallback(
    ({ item }) => (
      <IssueBasketCard
        issue={item}
        busy={busyId === item.id}
        onEdit={() => handleEdit(item)}
        onDelete={() => handleDelete(item)}
      />
    ),
    [busyId, handleEdit, handleDelete],
  );

  const keyExtractor = useCallback(
    (item: DailyReportIssueModel) => item.id,
    [],
  );

  const emptyComponent = useMemo(
    () => (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>今日暂无草稿问题</Text>
        <Text style={styles.emptyHint}>
          在检查中页面点击"创建问题"录入现场发现
        </Text>
      </View>
    ),
    [],
  );

  if (loading) {
    return (
      <View style={styles.centering}>
        <ActivityIndicator testID="issue-basket-loading" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        testID="issue-basket-list"
        data={issues}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={
          issues.length === 0 ? styles.emptyList : styles.list
        }
        ListEmptyComponent={emptyComponent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      {/* 底部提交栏 */}
      <View style={styles.footer}>
        <TouchableOpacity
          testID="issue-basket-submit-btn"
          onPress={handleSubmit}
          activeOpacity={0.7}
          style={styles.submitBtn}
        >
          <Text style={styles.submitBtnText}>提交今日检查成果</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============== 子组件：问题卡片 ==============
interface IssueBasketCardProps {
  issue: DailyReportIssueModel;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function IssueBasketCard({
  issue,
  busy,
  onEdit,
  onDelete,
}: IssueBasketCardProps): React.ReactElement {
  const sevColor = getSeverityColor(issue.severity as IssueSeverity);
  const photoCount = issue.photoCount ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View
          testID={`issue-basket-severity-${issue.id}`}
          style={[styles.severityBadge, { backgroundColor: sevColor }]}
        >
          <Text style={styles.severityBadgeText}>
            {issue.severity}
          </Text>
        </View>
        <Text style={styles.photoCount}>
          📷 {photoCount} 张照片
        </Text>
      </View>

      <Text style={styles.issueDesc} numberOfLines={3}>
        {truncate(issue.issueDescription || '（无描述）', 80)}
      </Text>

      <View style={styles.cardActions}>
        <TouchableOpacity
          testID={`issue-basket-edit-${issue.id}`}
          onPress={onEdit}
          disabled={busy}
          style={styles.actionBtn}
        >
          <Text style={styles.editText}>编辑</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`issue-basket-delete-${issue.id}`}
          onPress={onDelete}
          disabled={busy}
          style={styles.actionBtn}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#ff4d4f" />
          ) : (
            <Text style={styles.deleteText}>删除</Text>
          )}
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
  list: {
    padding: 12,
    paddingBottom: 80,
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  severityBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  photoCount: {
    fontSize: 12,
    color: '#999999',
  },
  issueDesc: {
    fontSize: 14,
    color: '#222222',
    lineHeight: 20,
    marginBottom: 8,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  editText: {
    fontSize: 14,
    color: '#1677ff',
  },
  deleteText: {
    fontSize: 14,
    color: '#ff4d4f',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e8e8e8',
  },
  submitBtn: {
    height: 46,
    borderRadius: 8,
    backgroundColor: '#1677ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
