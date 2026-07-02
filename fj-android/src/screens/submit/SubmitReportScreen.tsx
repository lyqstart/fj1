/**
 * SubmitReportScreen — 提交今日检查成果页
 *
 * 设计依据：WI-0001 §2.4 / §6 离线同步协议 / §101.22 多任务日报 / TASK-028
 *
 * 职责：
 *  - 今日检查总结：检查任务数、发现问题数
 *  - 照片同步状态：已上传 / 待上传 / 上传中（基于 PhotoModel.file_upload_status）
 *  - 文本同步状态：已推送 / 待推送 / 冲突（基于 DailyReportIssue.sync_status）
 *  - "提交"按钮触发 SyncEngine.fullSync()（先 push 本地变更，再 pull 服务端增量）
 *  - 提交进度显示（idle → submitting → success / failed）
 *  - 成功 / 失败反馈（Alert + 状态文案）
 *  - 离线模式提示（SyncEngine 未注入时降级提示，不可提交）
 *
 * 数据来源：
 *  - route.params.taskId 提供项目上下文（取其 projectId 作为今日数据筛选范围）
 *  - 今日检查任务：planned_date 在今日且非取消
 *  - 今日问题 / 照片：按 projectId + created_at 今日范围筛选
 *
 * 同步依赖：
 *  - 通过 useSyncEngine() 注入端口获取 SyncEngine（见 di/SyncEnginePort.tsx）
 *  - 未挂载 Provider 时返回 null → 离线模式，提交按钮禁用并提示
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useDatabase } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';
import type { StackScreenProps } from '@react-navigation/stack';

import InspectionTaskModel, {
  INSPECTION_TASK_TABLE,
  TASK_STATUS,
} from '../../store/models/InspectionTaskModel';
import DailyReportIssueModel, {
  DAILY_REPORT_ISSUE_TABLE,
} from '../../store/models/DailyReportIssueModel';
import PhotoModel, {
  PHOTO_TABLE,
  FILE_UPLOAD_STATUS,
} from '../../store/models/PhotoModel';
import { SYNC_STATUS } from '../../store/models/DailyReportModel';
import { useSyncEngine } from '../../di/SyncEnginePort';
import type { InspectionStackParamList } from '../today/TodayInspectionScreen';

type SubmitReportScreenProps = StackScreenProps<
  InspectionStackParamList,
  'SubmitReport'
>;

// ============== 类型 ==============
type SubmitPhase = 'idle' | 'submitting' | 'success' | 'failed';

interface Summary {
  /** 今日检查任务数 */
  taskCount: number;
  /** 今日发现问题数 */
  issueCount: number;
  /** 照片：已上传 */
  photoUploaded: number;
  /** 照片：待上传（pending + failed） */
  photoPending: number;
  /** 照片：上传中 */
  photoUploading: number;
  /** 文本：已推送 */
  textSynced: number;
  /** 文本：待推送 */
  textPending: number;
  /** 文本：冲突 */
  textConflict: number;
}

const EMPTY_SUMMARY: Summary = {
  taskCount: 0,
  issueCount: 0,
  photoUploaded: 0,
  photoPending: 0,
  photoUploading: 0,
  textSynced: 0,
  textPending: 0,
  textConflict: 0,
};

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

// ============== 主组件 ==============
export default function SubmitReportScreen({
  route,
}: SubmitReportScreenProps): React.ReactElement {
  const database = useDatabase();
  const syncEngine = useSyncEngine();
  const { taskId } = route.params;

  const [loading, setLoading] = useState<boolean>(true);
  const [taskNotFound, setTaskNotFound] = useState<boolean>(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [phase, setPhase] = useState<SubmitPhase>('idle');
  const [submitMessage, setSubmitMessage] = useState<string>('');

  // ---- 读取当前任务以获取 projectId（项目上下文）----
  useEffect(() => {
    const collection =
      database.get<InspectionTaskModel>(INSPECTION_TASK_TABLE);
    const subscription = collection.findAndObserve(taskId).subscribe({
      next: (row) => {
        setProjectId(row.projectId);
        setTaskNotFound(false);
        setLoading(false);
      },
      error: () => {
        setTaskNotFound(true);
        setLoading(false);
      },
    });
    return () => subscription.unsubscribe();
  }, [database, taskId]);

  // ---- 聚合今日总结（任务数、问题数、照片 / 文本同步状态）----
  useEffect(() => {
    if (!projectId) {
      setSummary(EMPTY_SUMMARY);
      return;
    }
    const { start, end } = getTodayRange();

    const taskCol =
      database.get<InspectionTaskModel>(INSPECTION_TASK_TABLE);

    // 今日问题（按 projectId + created_at 今日范围）
    const issueCol =
      database.get<DailyReportIssueModel>(DAILY_REPORT_ISSUE_TABLE);
    const issueSub = issueCol
      .query(
        Q.where('project_id', projectId),
        Q.where('created_at', Q.gte(start)),
        Q.where('created_at', Q.lt(end)),
      )
      .observe()
      .subscribe({
        next: (rows) => {
          // 文本同步状态聚合
          let textSynced = 0;
          let textPending = 0;
          let textConflict = 0;
          for (const r of rows) {
            if (r.syncState === SYNC_STATUS.SYNCED) {
              textSynced += 1;
            } else if (r.syncState === SYNC_STATUS.PENDING_PUSH) {
              textPending += 1;
            } else if (r.syncState === SYNC_STATUS.CONFLICT) {
              textConflict += 1;
            }
          }
          setSummary((prev) => ({
            ...prev,
            issueCount: rows.length,
            textSynced,
            textPending,
            textConflict,
          }));
        },
      });

    // 今日照片（按 projectId + created_at 今日范围）
    const photoCol = database.get<PhotoModel>(PHOTO_TABLE);
    const photoSub = photoCol
      .query(
        Q.where('project_id', projectId),
        Q.where('created_at', Q.gte(start)),
        Q.where('created_at', Q.lt(end)),
      )
      .observe()
      .subscribe({
        next: (rows) => {
          let uploaded = 0;
          let pending = 0;
          let uploading = 0;
          for (const p of rows) {
            const s = p.fileUploadStatus;
            if (s === FILE_UPLOAD_STATUS.UPLOADED) {
              uploaded += 1;
            } else if (
              s === FILE_UPLOAD_STATUS.PENDING ||
              s === FILE_UPLOAD_STATUS.FAILED
            ) {
              pending += 1;
            } else if (s === FILE_UPLOAD_STATUS.UPLOADING) {
              uploading += 1;
            }
          }
          setSummary((prev) => ({
            ...prev,
            photoUploaded: uploaded,
            photoPending: pending,
            photoUploading: uploading,
          }));
        },
      });

    // 今日检查任务数（按 planned_date 今日范围 + 非取消）
    const taskCountSub = taskCol
      .query(
        Q.where('planned_date', Q.gte(start)),
        Q.where('planned_date', Q.lt(end)),
        Q.where('status', Q.notIn([TASK_STATUS.CANCELLED])),
      )
      .observe()
      .subscribe({
        next: (rows) => {
          setSummary((prev) => ({ ...prev, taskCount: rows.length }));
        },
      });

    return () => {
      issueSub.unsubscribe();
      photoSub.unsubscribe();
      taskCountSub.unsubscribe();
    };
  }, [database, projectId]);

  // ---- 提交：触发 fullSync ----
  const handleSubmit = useCallback(async () => {
    if (!syncEngine) {
      Alert.alert(
        '离线模式',
        '同步服务尚未配置，无法提交。请检查网络与服务配置后重试。',
      );
      return;
    }
    setPhase('submitting');
    setSubmitMessage('正在提交今日检查成果…');
    try {
      const result = await syncEngine.fullSync();
      const pushed = result.push.pushed_count;
      const hasConflicts = result.push.has_conflicts;
      if (hasConflicts) {
        setPhase('failed');
        setSubmitMessage(
          `提交完成但存在 ${result.push.conflicts ? Object.values(result.push.conflicts).reduce((n, arr) => n + (arr?.length ?? 0), 0) : 0} 条冲突，请到问题篮子核对后重试。`,
        );
      } else {
        setPhase('success');
        setSubmitMessage(
          pushed > 0
            ? `提交成功，已推送 ${pushed} 条本地变更。`
            : '提交成功，无新的本地变更。',
        );
      }
    } catch (error) {
      setPhase('failed');
      setSubmitMessage(
        `提交失败：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, [syncEngine]);

  const isOffline = syncEngine == null;
  const submitting = phase === 'submitting';

  // ============== 渲染 ==============
  if (loading) {
    return (
      <View style={styles.centering}>
        <ActivityIndicator testID="submit-report-loading" />
      </View>
    );
  }

  if (taskNotFound) {
    return (
      <View style={styles.centering}>
        <Text style={styles.emptyTitle}>任务不存在</Text>
        <Text style={styles.emptyHint}>无法获取项目上下文，请返回重试</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* 离线模式提示 */}
      {isOffline ? (
        <View style={styles.offlineBox}>
          <Text style={styles.offlineTitle}>离线模式</Text>
          <Text style={styles.offlineHint}>
            同步服务尚未配置。你可以查看今日总结，但提交按钮已禁用。
            请检查服务配置或网络后重试。
          </Text>
        </View>
      ) : null}

      {/* 今日检查总结 */}
      <Section title="今日检查总结">
        <SummaryRow label="检查任务数" value={`${summary.taskCount}`} />
        <SummaryRow label="发现问题数" value={`${summary.issueCount}`} />
      </Section>

      {/* 照片同步状态 */}
      <Section title="照片同步状态">
        <StatusRow
          label="已上传"
          count={summary.photoUploaded}
          color="#52c41a"
        />
        <StatusRow
          label="待上传"
          count={summary.photoPending}
          color="#fa8c16"
        />
        <StatusRow
          label="上传中"
          count={summary.photoUploading}
          color="#1677ff"
        />
      </Section>

      {/* 文本同步状态 */}
      <Section title="文本同步状态">
        <StatusRow
          label="已推送"
          count={summary.textSynced}
          color="#52c41a"
        />
        <StatusRow
          label="待推送"
          count={summary.textPending}
          color="#fa8c16"
        />
        <StatusRow
          label="冲突"
          count={summary.textConflict}
          color="#ff4d4f"
        />
      </Section>

      {/* 提交进度反馈 */}
      {phase !== 'idle' ? (
        <View
          style={[
            styles.feedbackBox,
            phase === 'success' && styles.feedbackSuccess,
            phase === 'failed' && styles.feedbackFailed,
          ]}
        >
          <View style={styles.feedbackHeader}>
            {submitting ? (
              <ActivityIndicator size="small" color="#1677ff" />
            ) : null}
            <Text
              style={[
                styles.feedbackTitle,
                phase === 'success' && styles.feedbackSuccessText,
                phase === 'failed' && styles.feedbackFailedText,
              ]}
            >
              {phase === 'submitting'
                ? '提交中…'
                : phase === 'success'
                  ? '提交成功'
                  : '提交异常'}
            </Text>
          </View>
          <Text style={styles.feedbackMessage}>{submitMessage}</Text>
        </View>
      ) : null}

      {/* 提交按钮 */}
      <TouchableOpacity
        testID="submit-report-btn"
        onPress={handleSubmit}
        disabled={isOffline || submitting}
        activeOpacity={0.7}
        style={[
          styles.submitBtn,
          (isOffline || submitting) && styles.submitBtnDisabled,
        ]}
      >
        {submitting ? (
          <Text style={styles.submitBtnText}>提交中…</Text>
        ) : (
          <Text style={styles.submitBtnText}>
            {isOffline ? '离线模式（不可提交）' : '提交今日检查成果'}
          </Text>
        )}
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

interface SummaryRowProps {
  label: string;
  value: string;
}

function SummaryRow({ label, value }: SummaryRowProps): React.ReactElement {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

interface StatusRowProps {
  label: string;
  count: number;
  color: string;
}

function StatusRow({ label, count, color }: StatusRowProps): React.ReactElement {
  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusCount}>{count}</Text>
    </View>
  );
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
  emptyTitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 13,
    color: '#999999',
  },
  offlineBox: {
    backgroundColor: '#fff7e6',
    borderWidth: 1,
    borderColor: '#ffd591',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  offlineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d46b08',
    marginBottom: 4,
  },
  offlineHint: {
    fontSize: 12,
    color: '#ad6800',
    lineHeight: 18,
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666666',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222222',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusLabel: {
    flex: 1,
    fontSize: 14,
    color: '#666666',
  },
  statusCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222222',
  },
  feedbackBox: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#e6f4ff',
    borderWidth: 1,
    borderColor: '#91caff',
  },
  feedbackSuccess: {
    backgroundColor: '#f6ffed',
    borderColor: '#b7eb8f',
  },
  feedbackFailed: {
    backgroundColor: '#fff2f0',
    borderColor: '#ffccc7',
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1677ff',
    marginLeft: 6,
  },
  feedbackSuccessText: {
    color: '#389e0d',
  },
  feedbackFailedText: {
    color: '#cf1322',
  },
  feedbackMessage: {
    fontSize: 12,
    color: '#555555',
    lineHeight: 18,
  },
  submitBtn: {
    height: 46,
    borderRadius: 8,
    backgroundColor: '#1677ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: {
    backgroundColor: '#b0cfff',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
