/**
 * 领域类型定义（对齐后端实体 + Jackson 默认 camelCase 序列化）
 *
 * 字段命名与后端实体（DailyReport / ProjectIssue / Photo / IssueRelation）一致，
 * 枚举值与后端 @Enumerated(EnumType.STRING) 的 name() 一致。
 */

// ==================== 枚举 ====================

/** 问题严重程度（REQ-13 / BR-1） */
export enum IssueSeverity {
  GENERAL = 'GENERAL',
  MAJOR = 'MAJOR',
  CRITICAL = 'CRITICAL',
}

/** 整改跟踪状态（§101.10） */
export enum CorrectionStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  CORRECTED = 'CORRECTED',
  VERIFIED = 'VERIFIED',
}

/** 日报状态机（BR-5）：DRAFT → SUBMITTED → RETURNED/LOCKED → VOIDED */
export enum DailyReportStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  RETURNED = 'RETURNED',
  LOCKED = 'LOCKED',
  VOIDED = 'VOIDED',
}

/** 项目问题池状态机（TASK-026/027） */
export enum IssueStatus {
  VALID = 'VALID',
  PENDING_CONFIRM = 'PENDING_CONFIRM',
  RECTIFIED = 'RECTIFIED',
  CLOSED = 'CLOSED',
  OVERDUE = 'OVERDUE',
  SUSPENDED = 'SUSPENDED',
  VOIDED = 'VOIDED',
  CORRECTED = 'CORRECTED',
}

/** 组长复核动作（TASK-032） */
export enum ReviewAction {
  PASS = 'PASS',
  RETURN = 'RETURN',
  ADJUST = 'ADJUST',
  VOID = 'VOID',
  CORRECT = 'CORRECT',
}

/** 问题关联类型 */
export enum RelationType {
  DUPLICATE = 'DUPLICATE',
  SIMILAR = 'SIMILAR',
}

// ==================== 实体 ====================

/** 审计字段（BaseEntity 公共列） */
export interface BaseEntityFields {
  id: number
  serverSeq?: number
  createdAt?: string
  updatedAt?: string
  createdBy?: number
  updatedBy?: number
}

/** 日报实体（对应 daily_reports） */
export interface DailyReport extends BaseEntityFields {
  projectId: number
  taskId?: number | null
  reportDate: string
  inspectorId: number
  status: DailyReportStatus
  submittedAt?: string | null
  confirmedAt?: string | null
  lockedAt?: string | null
}

/**
 * 日报详情（含关联问题与照片，前向兼容）。
 * 后端 GET /daily-reports/{id} 当前仅返回 DailyReport 字段，
 * 待后端补充嵌入 issues / photos 后本类型自动生效。
 */
export interface DailyReportDetail extends DailyReport {
  issues?: DailyReportIssue[]
  photos?: Photo[]
}

/** 日报问题实体（对应 daily_report_issues） */
export interface DailyReportIssue extends BaseEntityFields {
  dailyReportId: number
  seqNo: number
  description: string
  severity: IssueSeverity
  category?: string | null
  responsiblePartyId?: number | null
  location?: string | null
  standardClauseId?: number | null
  correctionStatus: CorrectionStatus
}

/** 项目问题实体（对应 project_issues） */
export interface ProjectIssue extends BaseEntityFields {
  projectId: number
  sourceReportId?: number | null
  sourceIssueId?: number | null
  issueNo: string
  description: string
  severity: IssueSeverity
  category?: string | null
  responsiblePartyId?: number | null
  status: IssueStatus
  correctionStatus: CorrectionStatus
  rectificationDeadline: string
  confirmedAt?: string | null
  lockedAt?: string | null
  createdFromReportId?: number | null
}

/** 照片实体（对应 photos，仅前端展示字段） */
export interface Photo extends BaseEntityFields {
  dailyReportId: number
  dailyReportIssueId?: number | null
  clientPhotoUuid: string
  photoType?: string | null
  compressedFilePath?: string | null
  fileSize?: number | null
  width?: number | null
  height?: number | null
  takenAt?: string | null
  fileUploadStatus?: string | null
}

/** 问题关联实体（对应 issue_relations） */
export interface IssueRelation extends BaseEntityFields {
  sourceIssueId: number
  targetIssueId: number
  relationType: RelationType
}

/**
 * 分页响应（对齐后端 PageResponse，camelCase 字段名）。
 * 与 client.ts 的 PageData 保持一致，统一使用 pageSize。
 */
export interface IssuePage<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// ==================== 展示标签与颜色映射 ====================

export const DAILY_REPORT_STATUS_LABELS: Record<DailyReportStatus, string> = {
  [DailyReportStatus.DRAFT]: '草稿',
  [DailyReportStatus.SUBMITTED]: '已提交',
  [DailyReportStatus.RETURNED]: '已退回',
  [DailyReportStatus.LOCKED]: '已确认(锁定)',
  [DailyReportStatus.VOIDED]: '已作废',
}

export const DAILY_REPORT_STATUS_COLORS: Record<DailyReportStatus, string> = {
  [DailyReportStatus.DRAFT]: 'default',
  [DailyReportStatus.SUBMITTED]: 'processing',
  [DailyReportStatus.RETURNED]: 'warning',
  [DailyReportStatus.LOCKED]: 'success',
  [DailyReportStatus.VOIDED]: 'default',
}

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  [IssueStatus.VALID]: '有效',
  [IssueStatus.PENDING_CONFIRM]: '待确认',
  [IssueStatus.RECTIFIED]: '已整改',
  [IssueStatus.CLOSED]: '已关闭',
  [IssueStatus.OVERDUE]: '超期',
  [IssueStatus.SUSPENDED]: '暂停',
  [IssueStatus.VOIDED]: '作废',
  [IssueStatus.CORRECTED]: '已纠正',
}

export const ISSUE_STATUS_COLORS: Record<IssueStatus, string> = {
  [IssueStatus.VALID]: 'blue',
  [IssueStatus.PENDING_CONFIRM]: 'gold',
  [IssueStatus.RECTIFIED]: 'cyan',
  [IssueStatus.CLOSED]: 'green',
  [IssueStatus.OVERDUE]: 'red',
  [IssueStatus.SUSPENDED]: 'orange',
  [IssueStatus.VOIDED]: 'default',
  [IssueStatus.CORRECTED]: 'purple',
}

export const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  [IssueSeverity.GENERAL]: '一般',
  [IssueSeverity.MAJOR]: '较大',
  [IssueSeverity.CRITICAL]: '重大',
}

export const SEVERITY_COLORS: Record<IssueSeverity, string> = {
  [IssueSeverity.GENERAL]: 'blue',
  [IssueSeverity.MAJOR]: 'orange',
  [IssueSeverity.CRITICAL]: 'red',
}

export const CORRECTION_STATUS_LABELS: Record<CorrectionStatus, string> = {
  [CorrectionStatus.PENDING]: '待整改',
  [CorrectionStatus.IN_PROGRESS]: '整改中',
  [CorrectionStatus.CORRECTED]: '已整改',
  [CorrectionStatus.VERIFIED]: '已验证',
}

export const CORRECTION_STATUS_COLORS: Record<CorrectionStatus, string> = {
  [CorrectionStatus.PENDING]: 'default',
  [CorrectionStatus.IN_PROGRESS]: 'processing',
  [CorrectionStatus.CORRECTED]: 'success',
  [CorrectionStatus.VERIFIED]: 'green',
}

// ==================== Select 选项数组 ====================

export const DAILY_REPORT_STATUS_OPTIONS = Object.values(DailyReportStatus).map(
  (v) => ({ label: DAILY_REPORT_STATUS_LABELS[v], value: v }),
)
export const ISSUE_STATUS_OPTIONS = Object.values(IssueStatus).map((v) => ({
  label: ISSUE_STATUS_LABELS[v],
  value: v,
}))
export const SEVERITY_OPTIONS = Object.values(IssueSeverity).map((v) => ({
  label: SEVERITY_LABELS[v],
  value: v,
}))
export const RELATION_TYPE_OPTIONS = [
  { label: '重复问题', value: RelationType.DUPLICATE },
  { label: '相似问题', value: RelationType.SIMILAR },
]

// ==================== 报告（TASK-043）====================

/** 报告状态机：DRAFT → IN_APPROVAL → APPROVED/REJECTED → PUBLISHED */
export enum ReportStatus {
  DRAFT = 'DRAFT',
  IN_APPROVAL = 'IN_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PUBLISHED = 'PUBLISHED',
}

/** 报告实体（对应 reports，对齐后端 camelCase） */
export interface Report extends BaseEntityFields {
  projectId: number
  reportNo: string
  reportVersion: number
  title: string
  status: ReportStatus
  periodStart: string
  periodEnd: string
  submitterId?: number | null
  submittedAt?: string | null
  approverId?: number | null
  approvedAt?: string | null
  publisherId?: number | null
  publishedAt?: string | null
}

/** 报告快照（对应 report_snapshots，固化问题信息） */
export interface ReportSnapshot extends BaseEntityFields {
  reportId: number
  issueId: number
  issueNo: string
  description: string
  severity: IssueSeverity
  category?: string | null
  location?: string | null
  responsiblePartyId?: number | null
  snapshotNote?: string | null
}

/** 审批记录（对应 approval_records） */
export interface ApprovalRecord extends BaseEntityFields {
  reportId: number
  approverId: number
  /** APPROVE / REJECT */
  action: string
  comment?: string | null
}

/** 导出文件（对应 report_export_files） */
export interface ExportFile extends BaseEntityFields {
  reportId: number
  fileName: string
  /** DRAFT / OFFICIAL */
  fileType: string
  filePath?: string | null
  fileSize?: number | null
}

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  [ReportStatus.DRAFT]: '草稿',
  [ReportStatus.IN_APPROVAL]: '审批中',
  [ReportStatus.APPROVED]: '已通过',
  [ReportStatus.REJECTED]: '已退回',
  [ReportStatus.PUBLISHED]: '已发布',
}

export const REPORT_STATUS_COLORS: Record<ReportStatus, string> = {
  [ReportStatus.DRAFT]: 'default',
  [ReportStatus.IN_APPROVAL]: 'processing',
  [ReportStatus.APPROVED]: 'success',
  [ReportStatus.REJECTED]: 'error',
  [ReportStatus.PUBLISHED]: 'gold',
}

export const REPORT_STATUS_OPTIONS = Object.values(ReportStatus).map((v) => ({
  label: REPORT_STATUS_LABELS[v],
  value: v,
}))

// ==================== 系统管理（TASK-044）====================

/** 用户启用状态 */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

/** 用户实体（对应 users） */
export interface User extends BaseEntityFields {
  username: string
  realName?: string | null
  phone?: string | null
  email?: string | null
  status: UserStatus
  organizationId?: number | null
}

/** 组织实体（对应 organizations，树形 parentId 自引用） */
export interface Organization extends BaseEntityFields {
  parentId: number | null
  name: string
  code: string
  sortOrder?: number
}

/** 角色实体（对应 roles） */
export interface Role extends BaseEntityFields {
  code: string
  name: string
  description?: string | null
  /** 权限码列表 resource:action */
  permissions?: string[]
}

/** 字典分类 */
export interface DictionaryCategory {
  code: string
  name: string
}

/** 字典项（对应 dictionary_items） */
export interface DictionaryItem extends BaseEntityFields {
  categoryCode: string
  code: string
  name: string
  sortOrder: number
  enabled: boolean
}

/** 站内通知（对应 notifications） */
export interface Notification extends BaseEntityFields {
  userId: number
  title: string
  content: string
  read: boolean
  readAt?: string | null
}

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  [UserStatus.ACTIVE]: '启用',
  [UserStatus.DISABLED]: '禁用',
}

export const USER_STATUS_COLORS: Record<UserStatus, string> = {
  [UserStatus.ACTIVE]: 'success',
  [UserStatus.DISABLED]: 'default',
}

export const USER_STATUS_OPTIONS = Object.values(UserStatus).map((v) => ({
  label: USER_STATUS_LABELS[v],
  value: v,
}))
