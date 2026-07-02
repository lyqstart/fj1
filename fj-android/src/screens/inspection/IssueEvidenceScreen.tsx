/**
 * IssueEvidenceScreen — 问题取证页
 *
 * 设计依据：WI-0001 §2.4 / REQ-9 现场问题取证 / DD-2 照片压缩 / DD-10 照片质量规则 / TASK-028
 *
 * 职责：
 *  - 拍照入口（PhotoCapture → CameraProvider 注入端口，不直接依赖原生相机包）
 *  - 照片压缩（PhotoCompressor → ImageResizerProvider 注入端口，DD-2：长边1920/质量80）
 *  - 水印叠加预览（WatermarkOverlay：时间 + GPS + 检查员姓名）
 *  - 问题描述输入（必填）
 *  - 严重等级选择（一般 / 较大 / 重大）
 *  - 责任单位展示（来自检查任务 assignedOrgId 快照）
 *  - 位置展示（来自检查任务 locationNameSnapshot）
 *  - 关联标准条款（手动输入条款号；DD-11 推荐列表接入后可扩展为选择器）
 *  - 照片质量规则提示（DD-10）：
 *      · 至少 1 张全景 + 1 张细节
 *      · GPS 缺失提醒
 *  - 保存到本地 WatermelonDB（sync_status='pending_push'）
 *
 * 数据约束：
 *  - 关联标准条款：standard_clauses 表未注册 Model（见 database.ts MODEL_CLASSES），
 *    DD-11 离线推荐引擎尚未实现；骨架阶段用手动文本输入（逗号分隔条款号）。
 *  - 责任单位 / 位置：从当前检查任务快照读取（InspectionTaskModel.assignedOrgId /
 *    locationNameSnapshot），骨架阶段仅展示，不可编辑（真实基础数据选择器待后续 task）。
 *  - 检查员姓名：使用 task.assignedTo 作为显示名占位（真实姓名待 Auth/UserContext 注入）。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import { useDatabase } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';
import type { StackScreenProps } from '@react-navigation/stack';

import InspectionTaskModel, {
  INSPECTION_TASK_TABLE,
} from '../../store/models/InspectionTaskModel';
import DailyReportModel, {
  DAILY_REPORT_TABLE,
  DAILY_REPORT_STATUS,
  SYNC_STATUS,
} from '../../store/models/DailyReportModel';
import DailyReportIssueModel, {
  DAILY_REPORT_ISSUE_TABLE,
  ISSUE_SEVERITY,
  ISSUE_STATUS,
  ISSUE_QUALITY_STATUS,
  type IssueSeverity,
} from '../../store/models/DailyReportIssueModel';
import PhotoModel, {
  PHOTO_TABLE,
  PHOTO_TYPE,
  FILE_UPLOAD_STATUS,
  GPS_STATUS,
  type PhotoType,
} from '../../store/models/PhotoModel';
import type { InspectionStackParamList } from '../today/TodayInspectionScreen';
import type {
  CameraCaptureResult,
  GpsReading,
} from '../../components/photo/PhotoCapture';
import type { CompressResult } from '../../components/photo/PhotoCompressor';
import PhotoCapture from '../../components/photo/PhotoCapture';
import { PhotoCompressor } from '../../components/photo/PhotoCompressor';
import WatermarkOverlay from '../../components/photo/WatermarkOverlay';

type IssueEvidenceScreenProps = StackScreenProps<
  InspectionStackParamList,
  'IssueEvidence'
>;

// ============== 本地状态类型 ==============
/** 已拍摄（压缩完成）的待保存照片 */
interface DraftPhoto {
  /** 本地临时 id（React key 用） */
  tempId: string;
  /** 压缩后文件路径（写入 PhotoModel.local_file-path） */
  compressedUri: string;
  /** 压缩后文件大小（字节） */
  compressedSize: number;
  /** 拍摄时刻 */
  capturedAt: Date;
  /** 照片类型：全景 / 细节 / 补充（用户选择，默认补充） */
  photoType: PhotoType;
  /** 拍照瞬间的 GPS 读数 */
  gps: GpsReading;
}

// ============== UUID 生成（与 SyncEngine/database.ts 同款降级实现）==============
/**
 * 生成 RFC 4122 v4 风格 UUID。
 * 注意：基于 Math.random 的降级实现；生产应替换为 crypto.randomUUID
 * 或 react-native-get-random-values。骨架阶段保留以避免引入新依赖。
 */
function generateUuid(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += '-';
      continue;
    }
    if (i === 14) {
      out += '4';
      continue;
    }
    let r = Math.floor(Math.random() * 16);
    if (i === 19) {
      r = (r & 0x3) | 0x8;
    }
    out += hex[r];
  }
  return out;
}

/** 计算"今日"本地时区 [start, end) 时间戳范围 */
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

/**
 * 解析用户输入的关联标准条款文本为条款号数组。
 * 支持逗号 / 分号 / 换行分隔，去空白、去空串。
 */
function parseClauseInput(raw: string): string[] {
  return raw
    .split(/[,，;；\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * DD-10 照片质量规则校验。
 * 返回警告字符串数组（空数组表示全部通过）。
 */
function computePhotoQualityWarnings(photos: DraftPhoto[]): string[] {
  const warnings: string[] = [];
  if (photos.length === 0) {
    return warnings;
  }
  const hasPanorama = photos.some((p) => p.photoType === PHOTO_TYPE.PANORAMA);
  const hasDetail = photos.some((p) => p.photoType === PHOTO_TYPE.DETAIL);
  if (!hasPanorama) {
    warnings.push('缺少全景照片（DD-10：至少 1 张全景）');
  }
  if (!hasDetail) {
    warnings.push('缺少细节照片（DD-10：至少 1 张细节）');
  }
  const gpsMissing = photos.some(
    (p) => p.gps.status !== GPS_STATUS.SUCCESS || p.gps.coords == null,
  );
  if (gpsMissing) {
    warnings.push('部分照片 GPS 缺失，将影响问题精准定位（DD-10）');
  }
  return warnings;
}

/**
 * 严重等级激活态样式（按等级着色，作为独立函数避免 StyleSheet.create 类型限制）。
 */
function getSeverityActiveStyle(sev: IssueSeverity): ViewStyle {
  let bg = '#1677ff';
  if (sev === ISSUE_SEVERITY.MAJOR) {
    bg = '#fa8c16';
  } else if (sev === ISSUE_SEVERITY.CRITICAL) {
    bg = '#ff4d4f';
  }
  return { backgroundColor: bg, borderColor: bg };
}

// ============== 主组件 ==============
export default function IssueEvidenceScreen({
  route,
  navigation,
}: IssueEvidenceScreenProps): React.ReactElement {
  const database = useDatabase();
  const { taskId, taskItemId } = route.params;

  const [task, setTask] = useState<InspectionTaskModel | null>(null);
  const [loadingTask, setLoadingTask] = useState<boolean>(true);
  const [taskNotFound, setTaskNotFound] = useState<boolean>(false);

  // 拍照流程中间态
  const [rawCaptureUri, setRawCaptureUri] = useState<string | null>(null);

  // 表单字段
  const [draftPhotos, setDraftPhotos] = useState<DraftPhoto[]>([]);
  const [description, setDescription] = useState<string>('');
  const [severity, setSeverity] = useState<IssueSeverity>(ISSUE_SEVERITY.NORMAL);
  const [clauseInput, setClauseInput] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // ---- 订阅当前任务（用于展示责任单位 / 位置 / 检查员）----
  useEffect(() => {
    const collection = database.get<InspectionTaskModel>(INSPECTION_TASK_TABLE);
    const subscription = collection.findAndObserve(taskId).subscribe({
      next: (row) => {
        setTask(row);
        setLoadingTask(false);
        setTaskNotFound(false);
      },
      error: () => {
        setTaskNotFound(true);
        setLoadingTask(false);
      },
    });
    return () => subscription.unsubscribe();
  }, [database, taskId]);

  // ---- 拍照回调：设置 rawCaptureUri，触发 PhotoCompressor 自动压缩 ----
  const handleCaptured = useCallback((result: CameraCaptureResult) => {
    setRawCaptureUri(result.uri);
    // 缓存拍照元数据，等压缩完成后一起组装 DraftPhoto
    pendingCaptureRef.current = result;
  }, []);

  // 使用 ref 暂存拍照元数据（避免压缩完成前被重渲染清空）
  const pendingCaptureRef = React.useRef<CameraCaptureResult | null>(null);

  // ---- 压缩完成回调：组装 DraftPhoto 加入列表 ----
  const handleCompressed = useCallback((result: CompressResult) => {
    const capture = pendingCaptureRef.current;
    pendingCaptureRef.current = null;
    setRawCaptureUri(null);

    if (!capture) {
      // 理论上不会发生（压缩由 sourceUri 触发，capture 必已暂存）
      return;
    }

    const draft: DraftPhoto = {
      tempId: generateUuid(),
      compressedUri: result.uri,
      compressedSize: result.size,
      capturedAt: capture.capturedAt,
      photoType: PHOTO_TYPE.SUPPLEMENT,
      gps: capture.gps,
    };
    setDraftPhotos((prev) => [...prev, draft]);
  }, []);

  const handleCompressError = useCallback((error: Error) => {
    setRawCaptureUri(null);
    pendingCaptureRef.current = null;
    Alert.alert('照片压缩失败', error.message);
  }, []);

  // ---- 照片类型切换 / 删除 ----
  const setPhotoType = useCallback((tempId: string, photoType: PhotoType) => {
    setDraftPhotos((prev) =>
      prev.map((p) => (p.tempId === tempId ? { ...p, photoType } : p)),
    );
  }, []);

  const removePhoto = useCallback((tempId: string) => {
    setDraftPhotos((prev) => prev.filter((p) => p.tempId !== tempId));
  }, []);

  // ---- DD-10 质量警告 ----
  const qualityWarnings = useMemo(
    () => computePhotoQualityWarnings(draftPhotos),
    [draftPhotos],
  );

  // ---- 获取或创建今日草稿日报（在 write 块内调用，确保同事务）----
  const getOrCreateTodayDraftReport = useCallback(
    async (
      projectId: string,
      inspectorId: string,
    ): Promise<DailyReportModel> => {
      const collection =
        database.get<DailyReportModel>(DAILY_REPORT_TABLE);
      const { start, end } = getTodayRange();
      const existing = await collection
        .query(
          Q.where('project_id', projectId),
          Q.where('report_date', Q.gte(start)),
          Q.where('report_date', Q.lt(end)),
          Q.where('status', Q.eq(DAILY_REPORT_STATUS.DRAFT)),
        )
        .fetch();
      if (existing.length > 0) {
        return existing[0];
      }
      // 创建今日草稿日报
      return collection.create((record) => {
        record.serverId = '';
        record.syncState = SYNC_STATUS.PENDING_PUSH;
        record.serverSeq = 0;
        record.clientUuid = generateUuid();
        record.projectId = projectId;
        record.reportDate = new Date(start);
        record.inspectorId = inspectorId;
        record.status = DAILY_REPORT_STATUS.DRAFT;
        record.summary = null;
        record.submittedAt = null;
        record.confirmedAt = null;
        record.lockedAt = null;
        record.weather = null;
      });
    },
    [database],
  );

  // ---- 保存到本地 WatermelonDB ----
  const handleSave = useCallback(async () => {
    if (!task) {
      Alert.alert('任务未加载', '请稍候再试');
      return;
    }
    const desc = description.trim();
    if (desc.length === 0) {
      Alert.alert('请填写问题描述', '问题描述为必填项');
      return;
    }
    if (draftPhotos.length === 0) {
      Alert.alert('请至少拍摄 1 张照片', '照片是问题取证的核心证据');
      return;
    }

    setSaving(true);
    try {
      const projectId = task.projectId;
      const inspectorId = task.assignedTo || 'unknown';
      const clauseIds = parseClauseInput(clauseInput);

      await database.write(async () => {
        // 1. 获取/创建今日草稿日报
        const report = await getOrCreateTodayDraftReport(
          projectId,
          inspectorId,
        );

        // 2. 创建问题记录（sync_status='pending_push'）
        const issueCollection =
          database.get<DailyReportIssueModel>(DAILY_REPORT_ISSUE_TABLE);
        const issue = await issueCollection.create((record) => {
          record.serverId = '';
          record.syncState = SYNC_STATUS.PENDING_PUSH;
          record.serverSeq = 0;
          record.clientUuid = generateUuid();
          record.dailyReportId = report.id;
          record.projectId = projectId;
          record.taskItemId = taskItemId ?? null;
          record.issueDescription = desc;
          record.severity = severity;
          record.status = ISSUE_STATUS.DRAFT;
          record.issueQualityStatus = ISSUE_QUALITY_STATUS.PENDING_CONFIRM;
          record.photoCount = draftPhotos.length;
          record.professional = null;
          record.categoryL1 = null;
          record.categoryL2 = null;
          record.deviceType = null;
          record.recommendedClauseIds = clauseIds;
          record.recommendedReason = clauseIds.length > 0
            ? '检查员手动关联'
            : null;
        });

        // 3. 批量创建照片记录（关联 issue.id）
        const photoCollection =
          database.get<PhotoModel>(PHOTO_TABLE);
        const preparedPhotos = draftPhotos.map((p) =>
          photoCollection.prepareCreate((record) => {
            record.serverId = '';
            record.syncState = SYNC_STATUS.PENDING_PUSH;
            record.serverSeq = 0;
            record.clientUuid = generateUuid();
            record.dailyReportIssueId = issue.id;
            record.projectId = projectId;
            record.localFilePath = p.compressedUri;
            record.remoteFilePath = null;
            record.originalLocalPath = null;
            record.photoType = p.photoType;
            record.capturedAt = p.capturedAt;
            record.compressedFileHash = null; // 由 PhotoUploadQueue 在上传时计算
            record.originalFileHash = null;
            const coords = p.gps.coords;
            record.longitude = coords ? coords.longitude : null;
            record.latitude = coords ? coords.latitude : null;
            record.gpsStatus = p.gps.status;
            record.fileUploadStatus = FILE_UPLOAD_STATUS.PENDING;
            record.uploadRetries = 0;
            record.isLateUploaded = false;
            record.uploadedAt = null;
          }),
        );
        await database.batch(preparedPhotos);
      });

      Alert.alert('已保存', '问题已保存到本地草稿，可在问题篮子查看', [
        { text: '继续取证', onPress: () => {
          // 重置表单，继续录入下一个问题
          setDescription('');
          setClauseInput('');
          setDraftPhotos([]);
        } },
        { text: '完成', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert(
        '保存失败',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setSaving(false);
    }
  }, [
    task,
    description,
    draftPhotos,
    database,
    getOrCreateTodayDraftReport,
    clauseInput,
    taskItemId,
    severity,
    navigation,
  ]);

  // ============== 渲染 ==============
  if (loadingTask) {
    return (
      <View style={styles.centering}>
        <ActivityIndicator testID="issue-evidence-loading" />
      </View>
    );
  }

  if (taskNotFound || !task) {
    return (
      <View style={styles.centering}>
        <Text style={styles.emptyTitle}>任务不存在</Text>
        <Text style={styles.emptyHint}>该任务可能已被删除或取消</Text>
      </View>
    );
  }

  const inspectorName = task.assignedTo || '（检查员未配置）';
  const responsibleOrg = task.assignedOrgId || '（未指定责任单位）';
  const locationName = task.locationNameSnapshot ?? '（位置未指定）';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* 任务上下文摘要 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>任务上下文</Text>
          <View style={styles.sectionBody}>
            <ContextRow label="检查任务" value={task.taskName || task.taskNo} />
            <ContextRow label="责任单位" value={responsibleOrg} />
            <ContextRow label="位置" value={locationName} />
            <ContextRow label="检查员" value={inspectorName} />
          </View>
        </View>

        {/* 拍照入口 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>问题照片（DD-2 压缩 / DD-10 质量规则）</Text>
          <View style={styles.sectionBody}>
            <PhotoCapture onCaptured={handleCaptured} />
            <Text style={styles.hint}>
              压缩参数：长边 ≤1920px、JPEG 质量 80、目标 ≤1MB。
              每张照片拍摄后可选择类型（全景 / 细节 / 补充）。
            </Text>

            {/* 已拍摄照片预览列表 */}
            {draftPhotos.length > 0 ? (
              <View style={styles.photoListWrap}>
                {draftPhotos.map((p) => (
                  <PhotoPreviewCard
                    key={p.tempId}
                    photo={p}
                    inspectorName={inspectorName}
                    onSetType={(t) => setPhotoType(p.tempId, t)}
                    onRemove={() => removePhoto(p.tempId)}
                  />
                ))}
              </View>
            ) : null}

            {/* DD-10 质量警告 */}
            {qualityWarnings.length > 0 ? (
              <View style={styles.warningBox}>
                {qualityWarnings.map((w, i) => (
                  <Text key={i} style={styles.warningText}>
                    · {w}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={styles.okText}>
                照片组合满足 DD-10 最低要求（全景 + 细节）
              </Text>
            )}
          </View>
        </View>

        {/* 问题描述 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>问题描述（必填）</Text>
          <View style={styles.sectionBody}>
            <TextInput
              testID="issue-description-input"
              style={styles.textArea}
              value={description}
              onChangeText={setDescription}
              placeholder="请描述发现的问题（位置、现象、违规点…）"
              placeholderTextColor="#bfbfbf"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={1000}
            />
            <Text style={styles.counter}>{description.length}/1000</Text>
          </View>
        </View>

        {/* 严重等级 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>严重等级</Text>
          <View style={styles.sectionBody}>
            <View style={styles.severityRow}>
              {(
                [ISSUE_SEVERITY.NORMAL, ISSUE_SEVERITY.MAJOR, ISSUE_SEVERITY.CRITICAL] as IssueSeverity[]
              ).map((sev) => (
                <TouchableOpacity
                  key={sev}
                  testID={`severity-${sev}`}
                  onPress={() => setSeverity(sev)}
                  style={[
                    styles.severityBtn,
                    severity === sev && getSeverityActiveStyle(sev),
                  ]}
                >
                  <Text
                    style={[
                      styles.severityBtnText,
                      severity === sev && styles.severityBtnTextActive,
                    ]}
                  >
                    {sev}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* 关联标准条款 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>关联标准条款</Text>
          <View style={styles.sectionBody}>
            <TextInput
              testID="issue-clause-input"
              style={styles.textInput}
              value={clauseInput}
              onChangeText={setClauseInput}
              placeholder="手动输入条款号，逗号分隔（如 GB 50242-2016 3.2.1）"
              placeholderTextColor="#bfbfbf"
              multiline
            />
            <Text style={styles.hint}>
              骨架阶段支持手动输入。DD-11 离线推荐引擎接入后，将提供从
              standard_clauses 推荐列表选择的能力。
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* 底部保存栏 */}
      <View style={styles.footer}>
        <TouchableOpacity
          testID="issue-save-btn"
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.7}
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveBtnText}>保存到草稿</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 声明式压缩组件（headless，sourceUri 驱动） */}
      <PhotoCompressor
        sourceUri={rawCaptureUri}
        onCompressed={handleCompressed}
        onError={handleCompressError}
      />
    </View>
  );
}

// ============== 子组件：上下文行 ==============
interface ContextRowProps {
  label: string;
  value: string;
}

function ContextRow({ label, value }: ContextRowProps): React.ReactElement {
  return (
    <View style={styles.contextRow}>
      <Text style={styles.contextLabel}>{label}</Text>
      <Text style={styles.contextValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

// ============== 子组件：照片预览卡片 ==============
interface PhotoPreviewCardProps {
  photo: DraftPhoto;
  inspectorName: string;
  onSetType: (t: PhotoType) => void;
  onRemove: () => void;
}

function PhotoPreviewCard({
  photo,
  inspectorName,
  onSetType,
  onRemove,
}: PhotoPreviewCardProps): React.ReactElement {
  const types: PhotoType[] = [
    PHOTO_TYPE.PANORAMA,
    PHOTO_TYPE.DETAIL,
    PHOTO_TYPE.SUPPLEMENT,
  ];
  const gpsMissing = photo.gps.status !== GPS_STATUS.SUCCESS || !photo.gps.coords;

  return (
    <View style={styles.photoCard}>
      <WatermarkOverlay
        source={{ uri: photo.compressedUri }}
        data={{
          capturedAt: photo.capturedAt,
          longitude: photo.gps.coords ? photo.gps.coords.longitude : null,
          latitude: photo.gps.coords ? photo.gps.coords.latitude : null,
          inspectorName,
        }}
        style={{ height: 200 }}
      />
      <View style={styles.photoMeta}>
        <Text style={styles.photoSize}>
          {(photo.compressedSize / 1024).toFixed(0)} KB
          {photo.compressedSize > 1024 * 1024 ? '（超 1MB）' : ''}
        </Text>
        {gpsMissing ? (
          <Text style={styles.photoGpsMissing}>GPS 缺失</Text>
        ) : null}
      </View>
      <View style={styles.photoTypeRow}>
        {types.map((t) => (
          <TouchableOpacity
            key={t}
            testID={`photo-type-${photo.tempId}-${t}`}
            onPress={() => onSetType(t)}
            style={[
              styles.photoTypeBtn,
              photo.photoType === t && styles.photoTypeBtnActive,
            ]}
          >
            <Text
              style={[
                styles.photoTypeBtnText,
                photo.photoType === t && styles.photoTypeBtnTextActive,
              ]}
            >
              {t}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          testID={`photo-remove-${photo.tempId}`}
          onPress={onRemove}
          style={styles.photoRemoveBtn}
        >
          <Text style={styles.photoRemoveText}>删除</Text>
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
    padding: 24,
  },
  content: {
    padding: 12,
    paddingBottom: 80,
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
  contextRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  contextLabel: {
    width: 80,
    fontSize: 14,
    color: '#999999',
  },
  contextValue: {
    flex: 1,
    fontSize: 14,
    color: '#222222',
  },
  hint: {
    fontSize: 12,
    color: '#999999',
    lineHeight: 18,
    marginTop: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    color: '#222222',
    minHeight: 100,
    backgroundColor: '#fafafa',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    color: '#222222',
    backgroundColor: '#fafafa',
  },
  counter: {
    fontSize: 11,
    color: '#bfbfbf',
    textAlign: 'right',
    marginTop: 4,
  },
  severityRow: {
    flexDirection: 'row',
  },
  severityBtn: {
    flex: 1,
    height: 38,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  severityBtnText: {
    fontSize: 14,
    color: '#666666',
  },
  severityBtnTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  photoListWrap: {
    marginTop: 10,
  },
  photoCard: {
    backgroundColor: '#fafafa',
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  photoMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  photoSize: {
    fontSize: 12,
    color: '#666666',
  },
  photoGpsMissing: {
    fontSize: 12,
    color: '#ff4d4f',
  },
  photoTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  photoTypeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    marginRight: 6,
    backgroundColor: '#ffffff',
  },
  photoTypeBtnActive: {
    backgroundColor: '#1677ff',
    borderColor: '#1677ff',
  },
  photoTypeBtnText: {
    fontSize: 12,
    color: '#666666',
  },
  photoTypeBtnTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  photoRemoveBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  photoRemoveText: {
    fontSize: 12,
    color: '#ff4d4f',
  },
  warningBox: {
    backgroundColor: '#fffbe6',
    borderWidth: 1,
    borderColor: '#ffe58f',
    borderRadius: 6,
    padding: 10,
    marginTop: 10,
  },
  warningText: {
    fontSize: 12,
    color: '#d48806',
    lineHeight: 18,
  },
  okText: {
    fontSize: 12,
    color: '#52c41a',
    marginTop: 10,
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
  saveBtn: {
    height: 46,
    borderRadius: 8,
    backgroundColor: '#1677ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#b0cfff',
  },
  saveBtnText: {
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
