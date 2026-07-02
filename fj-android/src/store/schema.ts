/**
 * WatermelonDB Schema — 飞检安卓端本地数据库
 *
 * 设计依据：WI-0001 / DD-1 / §6.1（安卓离线同步协议）/ §7.5（本地数据加密）
 *
 * 同步契约（每张需要与服务端同步的本地表都强制携带以下 4 个字段）：
 *  - server_id     string   服务端正式记录 ID（首次 pull/push 成功后回填，
 *                           客户端在 push 响应里把 server_id 写回本地）
 *  - sync_status   string   本地变更同步状态，枚举值：
 *                             - 'synced'         已与服务器一致
 *                             - 'pending_push'   本地有未推送变更
 *                             - 'conflict'       与服务器版本冲突，待人工裁决
 *  - server_seq    number   该记录最后一次从服务器拉取到的 server_seq 值，
 *                           用于 push 时做 base_server_seq 冲突检测（§6.5）
 *  - client_uuid   string   客户端生成的稳定 UUID，用于幂等推送去重（§6.3）
 *
 * WatermelonDB 隐式字段（无需在此声明，框架自动维护）：
 *  - id           主键（客户端生成的随机 ID，作为 client_uuid 等价物）
 *  - created_at   创建时间戳
 *  - updated_at   最后修改时间戳（等价于业务文档中的 last_modified）
 *  - _status      本地记录状态（created/updated/deleted/synced）
 *  - _changed     本地变更字段位图，供 sync engine 推送时使用
 */
import { appSchema, tableSchema } from '@nozbe/watermelondb';

/**
 * ⚠️ 技术债 TD-ANDROID-001：本地数据库未加密（MVP 降级）
 * ---------------------------------------------------------------
 * 决策：D2-B — MVP 阶段降级为不加密（普通 SQLite），后续迭代再加 SQLCipher
 * 日期：2026-07-01
 * 风险等级：中
 *   - Root 设备后本地数据可被直接读取
 *   - 包含检查数据、问题记录、照片路径等
 * 缓解措施：
 *   - MVP 阶段设备为受控配发设备（非个人设备）
 *   - 敏感数据不持久化到本地（密码/JWT 仅内存）
 *   - 同步完成后本地数据可定期清理
 * 升级路径：
 *   1. 集成 react-native-sqlcipher-storage（或 @op-engineering/op-sqlite with SQLCipher）
 *   2. 使用 Android Keystore 管理加密密钥
 *   3. Schema 不变，仅替换底层 SQLite → SQLCipher
 *   4. 需要数据迁移策略（已有数据的设备升级时加密）
 * 关联需求：REQ-FIX-009, §7.5（安卓本地加密）
 * ---------------------------------------------------------------
 */

export const SCHEMA_VERSION = 1;

export const SYNC_FIELD_DEFS = [
  // 服务端对应记录 ID；同步成功后回填，用于本地反查
  { name: 'server_id', type: 'string', isIndexed: true },
  // 本地变更同步状态：synced | pending_push | conflict
  { name: 'sync_status', type: 'string', isIndexed: true },
  // 该记录最后一次拉取到的服务端版本号，用于 push 时冲突检测
  { name: 'server_seq', type: 'number' },
  // 客户端生成的稳定 UUID，用于幂等推送去重（§6.3）
  { name: 'client_uuid', type: 'string', isIndexed: true },
] as const;

export const schema = appSchema({
  version: SCHEMA_VERSION,
  tables: [
    // ============================================================
    // 1. daily_reports — 日报（核心业务实体）
    // 对应服务端 §101.9 DailyReport
    // ============================================================
    tableSchema({
      name: 'daily_reports',
      columns: [
        ...SYNC_FIELD_DEFS,
        { name: 'project_id', type: 'string', isIndexed: true },
        { name: 'report_date', type: 'number' }, // 日报日期（时间戳，UTC 0:00 那一刻）
        { name: 'inspector_id', type: 'string', isIndexed: true },
        { name: 'status', type: 'string', isIndexed: true }, // 草稿|已提交|已锁定|已退回|已作废
        { name: 'summary', type: 'string', isOptional: true },
        { name: 'submitted_at', type: 'number', isOptional: true },
        { name: 'confirmed_at', type: 'number', isOptional: true },
        { name: 'locked_at', type: 'number', isOptional: true },
        { name: 'weather', type: 'string', isOptional: true },
      ],
    }),

    // ============================================================
    // 2. daily_report_issues — 日报问题（含客户端创建的待推送问题）
    // 对应服务端 §101.10 DailyReportIssue
    // ============================================================
    tableSchema({
      name: 'daily_report_issues',
      columns: [
        ...SYNC_FIELD_DEFS,
        { name: 'daily_report_id', type: 'string', isIndexed: true },
        { name: 'project_id', type: 'string', isIndexed: true },
        { name: 'task_item_id', type: 'string', isOptional: true },
        { name: 'issue_description', type: 'string' },
        { name: 'severity', type: 'string' }, // 一般|较大|重大
        { name: 'status', type: 'string', isIndexed: true }, // 草稿|已提交|已退回|已作废
        { name: 'issue_quality_status', type: 'string', isOptional: true }, // 待确认|有效|无效
        { name: 'photo_count', type: 'number' },
        { name: 'professional', type: 'string', isOptional: true },
        { name: 'category_l1', type: 'string', isOptional: true },
        { name: 'category_l2', type: 'string', isOptional: true },
        { name: 'device_type', type: 'string', isOptional: true },
        { name: 'recommended_clause_ids', type: 'string', isOptional: true }, // JSON 数组
        { name: 'recommended_reason', type: 'string', isOptional: true },
      ],
    }),

    // ============================================================
    // 3. photos — 照片证据（含本地未上传文件路径）
    // 对应服务端 §101.13 Photo，照片文件独立同步（§6.4）
    // ============================================================
    tableSchema({
      name: 'photos',
      columns: [
        ...SYNC_FIELD_DEFS,
        { name: 'daily_report_issue_id', type: 'string', isIndexed: true },
        { name: 'project_id', type: 'string', isIndexed: true },
        // 本地压缩后文件路径（必填，照片迟到同步的关键，§60.1）
        { name: 'local_file_path', type: 'string' },
        // 服务端最终文件路径，元数据同步后回填
        { name: 'remote_file_path', type: 'string', isOptional: true },
        // 照片类型：全景|细节|补充
        { name: 'photo_type', type: 'string' },
        { name: 'captured_at', type: 'number' },
        { name: 'compressed_file_hash', type: 'string', isOptional: true }, // SHA-256
        { name: 'original_file_hash', type: 'string', isOptional: true },
        { name: 'original_local_path', type: 'string', isOptional: true },
        { name: 'longitude', type: 'number', isOptional: true },
        { name: 'latitude', type: 'number', isOptional: true },
        // GPS 获取状态：success|denied|unavailable
        { name: 'gps_status', type: 'string', isOptional: true },
        // 文件上传状态（独立于元数据 sync_status）：pending|uploading|uploaded|failed
        { name: 'file_upload_status', type: 'string', isIndexed: true },
        { name: 'upload_retries', type: 'number' },
        { name: 'is_late_uploaded', type: 'boolean' }, // 照片迟到同步标记
        { name: 'uploaded_at', type: 'number', isOptional: true },
      ],
    }),

    // ============================================================
    // 4. inspection_tasks — 检查任务（服务端下派，离线可编辑）
    // 对应服务端 §101.7 InspectionTask
    // ============================================================
    tableSchema({
      name: 'inspection_tasks',
      columns: [
        ...SYNC_FIELD_DEFS,
        { name: 'project_id', type: 'string', isIndexed: true },
        { name: 'task_no', type: 'string', isIndexed: true },
        { name: 'task_name', type: 'string' },
        { name: 'form_id', type: 'string', isOptional: true }, // 引用的已发布检查表
        { name: 'assigned_to', type: 'string', isIndexed: true },
        { name: 'status', type: 'string', isIndexed: true }, // 待开始|进行中|已完成|已取消
        { name: 'planned_date', type: 'number', isOptional: true },
        { name: 'completed_at', type: 'number', isOptional: true },
        { name: 'location_id', type: 'string', isOptional: true },
        { name: 'location_name_snapshot', type: 'string', isOptional: true },
        { name: 'assigned_org_id', type: 'string', isOptional: true },
      ],
    }),

    // ============================================================
    // 5. project_issues — 项目问题池（主要来自服务器，本地只读+查询）
    // 对应服务端 §101.11 ProjectIssue
    // ============================================================
    tableSchema({
      name: 'project_issues',
      columns: [
        ...SYNC_FIELD_DEFS,
        { name: 'project_id', type: 'string', isIndexed: true },
        { name: 'issue_no', type: 'string', isIndexed: true },
        { name: 'issue_description', type: 'string' },
        { name: 'severity', type: 'string', isIndexed: true },
        // 状态：待确认|有效|无效|后续更正（DD-9：后续更正是终态）
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'correction_status', type: 'string', isOptional: true }, // 未更正|已更正|无需更正
        { name: 'source_daily_report_issue_id', type: 'string', isOptional: true },
        { name: 'professional', type: 'string', isOptional: true },
        { name: 'category_l1', type: 'string', isOptional: true },
        { name: 'category_l2', type: 'string', isOptional: true },
        { name: 'recommended_rectify_deadline', type: 'number', isOptional: true },
        { name: 'related_report_id', type: 'string', isOptional: true },
      ],
    }),

    // ============================================================
    // 6. notifications — 应用内通知（P0：仅 App 内通知，无外部推送）
    // 对应服务端 §101.27 Notification
    // ============================================================
    tableSchema({
      name: 'notifications',
      columns: [
        ...SYNC_FIELD_DEFS,
        { name: 'title', type: 'string' },
        { name: 'content', type: 'string', isOptional: true },
        { name: 'notification_type', type: 'string', isIndexed: true }, // 日报退回|审批结果|任务派发...
        { name: 'is_read', type: 'boolean' },
        { name: 'received_at', type: 'number' },
        { name: 'read_at', type: 'number', isOptional: true },
        { name: 'related_entity_type', type: 'string', isOptional: true }, // daily_report | project_issue | ...
        { name: 'related_entity_id', type: 'string', isOptional: true },
        { name: 'project_id', type: 'string', isOptional: true, isIndexed: true },
      ],
    }),

    // ============================================================
    // 7. standard_clauses — 离线标准条款库（用于离线推荐，DD-11）
    // 对应服务端 §101.25 StandardClause，定期 pull 全量刷新
    // ============================================================
    tableSchema({
      name: 'standard_clauses',
      columns: [
        ...SYNC_FIELD_DEFS,
        { name: 'clause_no', type: 'string', isIndexed: true },
        { name: 'content', type: 'string' },
        { name: 'professional', type: 'string', isIndexed: true }, // 给排水|电气|暖通|...
        { name: 'category_l1', type: 'string', isIndexed: true },
        { name: 'category_l2', type: 'string', isOptional: true },
        { name: 'device_type', type: 'string', isOptional: true },
        // 关键词标签 JSON 数组（用于 §69.3 关键词匹配，每个 +5 分）
        { name: 'keyword_tags', type: 'string', isOptional: true },
        // 该条款所属标准库版本（影响推荐 reason_snapshot）
        { name: 'library_version', type: 'string', isIndexed: true },
        { name: 'document_no', type: 'string', isOptional: true },
      ],
    }),
  ],
});

/**
 * 同步字段白名单 — push 时仅这几个同步字段不进 payload（其余业务字段都推）。
 * 此常量供 src/api/syncEngine 在构造 push payload 时复用。
 */
export const METADATA_SYNC_FIELDS = [
  'server_id',
  'sync_status',
  'server_seq',
  'client_uuid',
  'created_at',
  'updated_at',
] as const;

/**
 * 所有本地表名常量 — 供 sync engine 按表名分发 upsert/delete。
 */
export const TABLE_NAMES = [
  'daily_reports',
  'daily_report_issues',
  'photos',
  'inspection_tasks',
  'project_issues',
  'notifications',
  'standard_clauses',
] as const;

export type LocalTableName = (typeof TABLE_NAMES)[number];
