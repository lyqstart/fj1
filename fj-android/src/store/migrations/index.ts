/**
 * WatermelonDB Schema Migrations — 飞检安卓端本地数据库版本演进
 *
 * 设计依据：WI-0001 DD-1 / §6.1
 *
 * 原则：
 *  - 每个 toVersion 描述"从上一版本升级到本版本需要的步骤"
 *  - 首次安装时 WatermelonDB 会从 v0 逐步执行所有 migration 到达 schema.version
 *  - 已发布的 migration steps 永不修改（只追加新版本），保证已装机用户升级路径稳定
 *  - columns 定义必须与 schema.ts 中对应表的 columns 完全一致（否则线上数据库会损坏）
 */
import { schemaMigrations, createTable } from '@nozbe/watermelondb/Schema/migrations';

import { SCHEMA_VERSION } from '../schema';

/**
 * v1：首次安装基线 — 创建全部 7 张本地表。
 *
 * 注：WatermelonDB 会自动为每张表追加 id / created_at / updated_at / _status / _changed
 *     这 5 个内置列，无需在 migration steps 中声明。
 *
 * 同步字段（server_id / sync_status / server_seq / client_uuid）必须在每张表中显式创建，
 * 详见 schema.ts 顶部说明。
 */
export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 1,
      steps: [
        // 1. daily_reports — 日报
        createTable({
          name: 'daily_reports',
          columns: [
            { name: 'server_id', type: 'string', isIndexed: true },
            { name: 'sync_status', type: 'string', isIndexed: true },
            { name: 'server_seq', type: 'number' },
            { name: 'client_uuid', type: 'string', isIndexed: true },
            { name: 'project_id', type: 'string', isIndexed: true },
            { name: 'report_date', type: 'number' },
            { name: 'inspector_id', type: 'string', isIndexed: true },
            { name: 'status', type: 'string', isIndexed: true },
            { name: 'summary', type: 'string', isOptional: true },
            { name: 'submitted_at', type: 'number', isOptional: true },
            { name: 'confirmed_at', type: 'number', isOptional: true },
            { name: 'locked_at', type: 'number', isOptional: true },
            { name: 'weather', type: 'string', isOptional: true },
          ],
        }),
        // 2. daily_report_issues — 日报问题
        createTable({
          name: 'daily_report_issues',
          columns: [
            { name: 'server_id', type: 'string', isIndexed: true },
            { name: 'sync_status', type: 'string', isIndexed: true },
            { name: 'server_seq', type: 'number' },
            { name: 'client_uuid', type: 'string', isIndexed: true },
            { name: 'daily_report_id', type: 'string', isIndexed: true },
            { name: 'project_id', type: 'string', isIndexed: true },
            { name: 'task_item_id', type: 'string', isOptional: true },
            { name: 'issue_description', type: 'string' },
            { name: 'severity', type: 'string' },
            { name: 'status', type: 'string', isIndexed: true },
            { name: 'issue_quality_status', type: 'string', isOptional: true },
            { name: 'photo_count', type: 'number' },
            { name: 'professional', type: 'string', isOptional: true },
            { name: 'category_l1', type: 'string', isOptional: true },
            { name: 'category_l2', type: 'string', isOptional: true },
            { name: 'device_type', type: 'string', isOptional: true },
            { name: 'recommended_clause_ids', type: 'string', isOptional: true },
            { name: 'recommended_reason', type: 'string', isOptional: true },
          ],
        }),
        // 3. photos — 照片证据
        createTable({
          name: 'photos',
          columns: [
            { name: 'server_id', type: 'string', isIndexed: true },
            { name: 'sync_status', type: 'string', isIndexed: true },
            { name: 'server_seq', type: 'number' },
            { name: 'client_uuid', type: 'string', isIndexed: true },
            { name: 'daily_report_issue_id', type: 'string', isIndexed: true },
            { name: 'project_id', type: 'string', isIndexed: true },
            { name: 'local_file_path', type: 'string' },
            { name: 'remote_file_path', type: 'string', isOptional: true },
            { name: 'photo_type', type: 'string' },
            { name: 'captured_at', type: 'number' },
            { name: 'compressed_file_hash', type: 'string', isOptional: true },
            { name: 'original_file_hash', type: 'string', isOptional: true },
            { name: 'original_local_path', type: 'string', isOptional: true },
            { name: 'longitude', type: 'number', isOptional: true },
            { name: 'latitude', type: 'number', isOptional: true },
            { name: 'gps_status', type: 'string', isOptional: true },
            { name: 'file_upload_status', type: 'string', isIndexed: true },
            { name: 'upload_retries', type: 'number' },
            { name: 'is_late_uploaded', type: 'boolean' },
            { name: 'uploaded_at', type: 'number', isOptional: true },
          ],
        }),
        // 4. inspection_tasks — 检查任务
        createTable({
          name: 'inspection_tasks',
          columns: [
            { name: 'server_id', type: 'string', isIndexed: true },
            { name: 'sync_status', type: 'string', isIndexed: true },
            { name: 'server_seq', type: 'number' },
            { name: 'client_uuid', type: 'string', isIndexed: true },
            { name: 'project_id', type: 'string', isIndexed: true },
            { name: 'task_no', type: 'string', isIndexed: true },
            { name: 'task_name', type: 'string' },
            { name: 'form_id', type: 'string', isOptional: true },
            { name: 'assigned_to', type: 'string', isIndexed: true },
            { name: 'status', type: 'string', isIndexed: true },
            { name: 'planned_date', type: 'number', isOptional: true },
            { name: 'completed_at', type: 'number', isOptional: true },
            { name: 'location_id', type: 'string', isOptional: true },
            { name: 'location_name_snapshot', type: 'string', isOptional: true },
            { name: 'assigned_org_id', type: 'string', isOptional: true },
          ],
        }),
        // 5. project_issues — 项目问题池
        createTable({
          name: 'project_issues',
          columns: [
            { name: 'server_id', type: 'string', isIndexed: true },
            { name: 'sync_status', type: 'string', isIndexed: true },
            { name: 'server_seq', type: 'number' },
            { name: 'client_uuid', type: 'string', isIndexed: true },
            { name: 'project_id', type: 'string', isIndexed: true },
            { name: 'issue_no', type: 'string', isIndexed: true },
            { name: 'issue_description', type: 'string' },
            { name: 'severity', type: 'string', isIndexed: true },
            { name: 'status', type: 'string', isIndexed: true },
            { name: 'correction_status', type: 'string', isOptional: true },
            { name: 'source_daily_report_issue_id', type: 'string', isOptional: true },
            { name: 'professional', type: 'string', isOptional: true },
            { name: 'category_l1', type: 'string', isOptional: true },
            { name: 'category_l2', type: 'string', isOptional: true },
            { name: 'recommended_rectify_deadline', type: 'number', isOptional: true },
            { name: 'related_report_id', type: 'string', isOptional: true },
          ],
        }),
        // 6. notifications — 应用内通知
        createTable({
          name: 'notifications',
          columns: [
            { name: 'server_id', type: 'string', isIndexed: true },
            { name: 'sync_status', type: 'string', isIndexed: true },
            { name: 'server_seq', type: 'number' },
            { name: 'client_uuid', type: 'string', isIndexed: true },
            { name: 'title', type: 'string' },
            { name: 'content', type: 'string', isOptional: true },
            { name: 'notification_type', type: 'string', isIndexed: true },
            { name: 'is_read', type: 'boolean' },
            { name: 'received_at', type: 'number' },
            { name: 'read_at', type: 'number', isOptional: true },
            { name: 'related_entity_type', type: 'string', isOptional: true },
            { name: 'related_entity_id', type: 'string', isOptional: true },
            { name: 'project_id', type: 'string', isOptional: true, isIndexed: true },
          ],
        }),
        // 7. standard_clauses — 离线标准条款库
        createTable({
          name: 'standard_clauses',
          columns: [
            { name: 'server_id', type: 'string', isIndexed: true },
            { name: 'sync_status', type: 'string', isIndexed: true },
            { name: 'server_seq', type: 'number' },
            { name: 'client_uuid', type: 'string', isIndexed: true },
            { name: 'clause_no', type: 'string', isIndexed: true },
            { name: 'content', type: 'string' },
            { name: 'professional', type: 'string', isIndexed: true },
            { name: 'category_l1', type: 'string', isIndexed: true },
            { name: 'category_l2', type: 'string', isOptional: true },
            { name: 'device_type', type: 'string', isOptional: true },
            { name: 'keyword_tags', type: 'string', isOptional: true },
            { name: 'library_version', type: 'string', isIndexed: true },
            { name: 'document_no', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
});

/**
 * 当前 schema 版本常量（与 schema.ts 保持一致，供启动时校验）。
 */
export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSION;
