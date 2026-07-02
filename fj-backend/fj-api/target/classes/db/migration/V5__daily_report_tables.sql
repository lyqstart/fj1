-- =====================================================================
-- V5__daily_report_tables.sql
-- 飞检现场管理系统 — 日报/问题/照片/受检单位/问题关联/标准推荐结果 表迁移
-- 目标数据库：PostgreSQL 16
-- 依赖：
--   - V1__base_tables.sql  → users（外键 inspector_id / responsible_party_id）
--   - V3__project_tables.sql → projects（外键 project_id）
--   - V4__task_tables.sql  → inspection_tasks（外键 task_id）
-- 约定（与 V1~V4 一致）：
--   - 主键：id BIGINT GENERATED ALWAYS AS IDENTITY
--   - 同步序列号：server_seq BIGINT NOT NULL DEFAULT 0（离线同步冲突检测，§6.2）
--   - 审计字段：created_at / updated_at / created_by / updated_by
--   - updated_at 自动更新触发器由 V1 的 fn_set_updated_at() + DO 块自动为本迁移新增表创建
-- 业务文档：
--   §101.9  DailyReport          §101.10 DailyReportIssue
--   §101.11 ProjectIssue         §101.12 IssueRelation
--   §101.13 Photo                §101.14 ReportIssueSnapshot（V6 报告快照）
--   §101.15 DailyReportTask      §101.22 多任务日报整体操作
--   §101.26 StandardRecommendationResult
-- 关键裁决：
--   - DD-8：confirmed_at（业务语义，审批通过时刻，整改期限计算起点）与 locked_at（持久化锁定）
--           分开存储，但同一事务写入（§102.2 确认即锁定）
--   - BR-1：rectification_deadline NOT NULL（P0 共识），三级期限：一般 +7 / 较大 +3 / 重大当日 23:59:59
-- =====================================================================

-- ===== 1. daily_reports — 日报（§101.9，BR-5 状态机）=====
-- 状态机（BR-5）：DRAFT 草稿 → SUBMITTED 已提交 → RETURNED 已退回 → LOCKED 已锁定（确认即锁定）
--                 → VOIDED 已作废
CREATE TABLE daily_reports (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id      BIGINT       NOT NULL,
    task_id         BIGINT,                        -- 关联检查任务（§101.7），自由日报可空
    report_date     DATE          NOT NULL,        -- 日报日期（业务日期，非提交时刻）
    inspector_id    BIGINT       NOT NULL,         -- 检查人员（§101.9）
    -- 日报状态机（BR-5）：DRAFT/SUBMITTED/RETURNED/LOCKED/VOIDED
    status          VARCHAR(32)  NOT NULL DEFAULT 'DRAFT',
    submitted_at    TIMESTAMPTZ,                   -- 提交时刻（DRAFT → SUBMITTED 写入）
    -- DD-8：confirmed_at 与 locked_at 分开存储；确认即锁定时同事务写入
    confirmed_at    TIMESTAMPTZ,                   -- 业务语义：审批通过时刻（整改期限计算起点 BR-1）
    locked_at       TIMESTAMPTZ,                   -- 持久化锁定时刻（§102.2 确认即锁定）
    server_seq      BIGINT       NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by      BIGINT,
    updated_by      BIGINT,
    CONSTRAINT chk_daily_reports_status CHECK (
        status IN ('DRAFT', 'SUBMITTED', 'RETURNED', 'LOCKED', 'VOIDED')
    ),
    CONSTRAINT fk_daily_reports_project   FOREIGN KEY (project_id)   REFERENCES projects (id)         ON DELETE RESTRICT,
    CONSTRAINT fk_daily_reports_task      FOREIGN KEY (task_id)      REFERENCES inspection_tasks (id) ON DELETE SET NULL,
    CONSTRAINT fk_daily_reports_inspector FOREIGN KEY (inspector_id) REFERENCES users (id)            ON DELETE RESTRICT
);
COMMENT ON TABLE  daily_reports IS '日报表（§101.9，BR-5 状态机：DRAFT/SUBMITTED/RETURNED/LOCKED/VOIDED）';
COMMENT ON COLUMN daily_reports.status       IS '日报状态机（BR-5）：DRAFT 草稿 / SUBMITTED 已提交 / RETURNED 已退回 / LOCKED 已锁定 / VOIDED 已作废';
COMMENT ON COLUMN daily_reports.submitted_at IS '提交时刻（DRAFT → SUBMITTED 时写入）';
COMMENT ON COLUMN daily_reports.confirmed_at IS '业务语义：审批通过时刻（DD-8，整改期限计算起点 BR-1）';
COMMENT ON COLUMN daily_reports.locked_at    IS '持久化锁定时刻（§102.2 确认即锁定，DD-8 与 confirmed_at 同事务写入）';
COMMENT ON COLUMN daily_reports.server_seq   IS '同步序列号，离线同步冲突检测（§6.2）';

CREATE INDEX idx_daily_reports_project   ON daily_reports (project_id);
CREATE INDEX idx_daily_reports_task      ON daily_reports (task_id);
CREATE INDEX idx_daily_reports_inspector ON daily_reports (inspector_id);
CREATE INDEX idx_daily_reports_status    ON daily_reports (status);
CREATE INDEX idx_daily_reports_date      ON daily_reports (report_date);
CREATE INDEX idx_daily_reports_proj_date ON daily_reports (project_id, report_date);

-- ===== 2. daily_report_issues — 日报问题（§101.10）=====
-- 日报下的检查发现项，确认后映射到项目问题池（project_issues）
CREATE TABLE daily_report_issues (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    daily_report_id      BIGINT       NOT NULL,
    seq_no               INT          NOT NULL,        -- 日报内序号（同一日报内递增）
    description          TEXT         NOT NULL,         -- 问题描述（受 ProjectConfig.min_description_length 约束）
    -- 问题严重程度（REQ-13）：GENERAL 一般 / MAJOR 较大 / CRITICAL 重大
    severity             VARCHAR(32) NOT NULL DEFAULT 'GENERAL',
    category             VARCHAR(64),                   -- 问题分类 / 专业
    responsible_party_id BIGINT,                        -- 责任单位/责任人 ID（V1 organizations 或 users）
    location             VARCHAR(255),                  -- 问题位置描述
    standard_clause_id   BIGINT,                        -- 关联标准条款（check_item_standard_bindings）
    -- 整改状态：PENDING 待整改 / IN_PROGRESS 整改中 / CORRECTED 已整改 / VERIFIED 已验证
    correction_status    VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    server_seq           BIGINT       NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by           BIGINT,
    updated_by           BIGINT,
    CONSTRAINT chk_dri_severity CHECK (
        severity IN ('GENERAL', 'MAJOR', 'CRITICAL')
    ),
    CONSTRAINT chk_dri_correction_status CHECK (
        correction_status IN ('PENDING', 'IN_PROGRESS', 'CORRECTED', 'VERIFIED')
    ),
    CONSTRAINT fk_dri_daily_report FOREIGN KEY (daily_report_id) REFERENCES daily_reports (id) ON DELETE CASCADE
);
COMMENT ON TABLE  daily_report_issues IS '日报问题表（§101.10，日报下的检查发现项）';
COMMENT ON COLUMN daily_report_issues.severity          IS '问题严重程度（REQ-13）：GENERAL 一般 / MAJOR 较大 / CRITICAL 重大';
COMMENT ON COLUMN daily_report_issues.correction_status IS '整改状态：PENDING 待整改 / IN_PROGRESS 整改中 / CORRECTED 已整改 / VERIFIED 已验证';
COMMENT ON COLUMN daily_report_issues.standard_clause_id IS '关联标准条款 ID（check_item_standard_bindings）';

CREATE INDEX idx_dri_daily_report ON daily_report_issues (daily_report_id);
CREATE INDEX idx_dri_severity     ON daily_report_issues (severity);

-- ===== 3. daily_report_tasks — 日报关联任务（§101.15，多任务日报整体操作 §101.22）=====
-- 一份日报可关联多个检查任务；§101.22 约束日报整体操作，不支持局部确认
CREATE TABLE daily_report_tasks (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    daily_report_id BIGINT       NOT NULL,
    task_id         BIGINT       NOT NULL,
    -- 任务快照（§101.7 InspectionTask 在日报时刻的冗余副本，避免任务后续变更影响历史日报）
    task_snapshot   JSONB,
    server_seq      BIGINT       NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by      BIGINT,
    updated_by      BIGINT,
    -- 同一日报下同一任务不可重复关联
    CONSTRAINT uk_drt_report_task UNIQUE (daily_report_id, task_id),
    CONSTRAINT fk_drt_daily_report FOREIGN KEY (daily_report_id) REFERENCES daily_reports (id)    ON DELETE CASCADE,
    CONSTRAINT fk_drt_task         FOREIGN KEY (task_id)         REFERENCES inspection_tasks (id) ON DELETE RESTRICT
);
COMMENT ON TABLE  daily_report_tasks IS '日报关联任务表（§101.15，多任务日报整体操作 §101.22）';
COMMENT ON COLUMN daily_report_tasks.task_snapshot IS '任务快照（JSONB，日报时刻的 InspectionTask 冗余副本）';

CREATE INDEX idx_drt_daily_report ON daily_report_tasks (daily_report_id);
CREATE INDEX idx_drt_task         ON daily_report_tasks (task_id);

-- ===== 4. daily_report_inspected_parties — 日报受检单位（§101.9）=====
-- 日报涉及的受检方信息（施工/监理/分包等单位）
CREATE TABLE daily_report_inspected_parties (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    daily_report_id BIGINT       NOT NULL,
    party_name      VARCHAR(255) NOT NULL,           -- 受检方名称
    party_type      VARCHAR(64),                     -- 受检方类型（施工/监理/分包/供应商...）
    server_seq      BIGINT       NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by      BIGINT,
    updated_by      BIGINT,
    CONSTRAINT fk_drip_daily_report FOREIGN KEY (daily_report_id) REFERENCES daily_reports (id) ON DELETE CASCADE
);
COMMENT ON TABLE daily_report_inspected_parties IS '日报受检单位表（§101.9，日报涉及的受检方）';
COMMENT ON COLUMN daily_report_inspected_parties.party_type IS '受检方类型（施工/监理/分包/供应商...）';

CREATE INDEX idx_drip_daily_report ON daily_report_inspected_parties (daily_report_id);

-- ===== 5. photos — 照片（§101.13，离线取证 + 后补传）=====
-- 日报问题取证照片，支持离线拍照后补传；client_photo_uuid 全局唯一（去重/续传）
CREATE TABLE photos (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    daily_report_id        BIGINT       NOT NULL,
    daily_report_issue_id  BIGINT,                       -- 关联日报问题（可为空：日报级全景照片）
    client_photo_uuid      VARCHAR(64)  NOT NULL,        -- 客户端生成 UUID（幂等键，全局唯一）
    -- 照片类型（§101.13）：PANORAMA 全景 / DETAIL 细节 / OVERVIEW 概览 / AFTER_RECTIFICATION 整改后
    photo_type             VARCHAR(32)  NOT NULL DEFAULT 'DETAIL',
    compressed_file_path   VARCHAR(512),                 -- 压缩后存储路径（对象存储 / 本地）
    compressed_file_hash   VARCHAR(128),                 -- 压缩文件哈希（去重校验）
    original_file_hash     VARCHAR(128),                 -- 原始文件哈希（完整性校验）
    file_size              BIGINT,                       -- 文件大小（字节）
    width                  INT,                          -- 图片宽度（px）
    height                 INT,                          -- 图片高度（px）
    gps_longitude          DOUBLE PRECISION,             -- 经度（WGS84）
    gps_latitude           DOUBLE PRECISION,             -- 纬度（WGS84）；gps_status 标记采集质量
    gps_status             VARCHAR(32)  NOT NULL DEFAULT 'UNKNOWN', -- GPS 状态：VALID/UNKNOWN/MISSING/SPOOFED
    taken_at               TIMESTAMPTZ,                  -- 拍摄时刻（EXIF，可早于上传时刻）
    is_late_uploaded       BOOLEAN      NOT NULL DEFAULT FALSE,    -- 是否后补传（taken_at 早于上传时刻超过阈值）
    -- 文件上传状态：PENDING 待传 / UPLOADING 上传中 / UPLOADED 已上传 / FAILED 失败
    file_upload_status     VARCHAR(32)  NOT NULL DEFAULT 'PENDING',
    server_seq             BIGINT       NOT NULL DEFAULT 0,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by             BIGINT,
    updated_by             BIGINT,
    -- client_photo_uuid 全局唯一：同一照片重复上传直接命中已有记录（幂等）
    CONSTRAINT uk_photos_client_uuid UNIQUE (client_photo_uuid),
    CONSTRAINT chk_photos_type CHECK (
        photo_type IN ('PANORAMA', 'DETAIL', 'OVERVIEW', 'AFTER_RECTIFICATION')
    ),
    CONSTRAINT chk_photos_gps_status CHECK (
        gps_status IN ('VALID', 'UNKNOWN', 'MISSING', 'SPOOFED')
    ),
    CONSTRAINT chk_photos_upload_status CHECK (
        file_upload_status IN ('PENDING', 'UPLOADING', 'UPLOADED', 'FAILED')
    ),
    CONSTRAINT fk_photos_daily_report FOREIGN KEY (daily_report_id)       REFERENCES daily_reports (id)      ON DELETE CASCADE,
    CONSTRAINT fk_photos_issue        FOREIGN KEY (daily_report_issue_id) REFERENCES daily_report_issues (id) ON DELETE SET NULL
);
COMMENT ON TABLE  photos IS '照片表（§101.13，离线取证 + 后补传）';
COMMENT ON COLUMN photos.client_photo_uuid     IS '客户端生成 UUID（幂等键，全局唯一）';
COMMENT ON COLUMN photos.photo_type            IS '照片类型（§101.13）：PANORAMA/DETAIL/OVERVIEW/AFTER_RECTIFICATION';
COMMENT ON COLUMN photos.compressed_file_hash  IS '压缩文件哈希（去重校验）';
COMMENT ON COLUMN photos.original_file_hash    IS '原始文件哈希（完整性校验）';
COMMENT ON COLUMN photos.gps_status            IS 'GPS 状态：VALID/UNKNOWN/MISSING/SPOOFED';
COMMENT ON COLUMN photos.is_late_uploaded      IS '是否后补传（taken_at 早于上传时刻超过阈值）';
COMMENT ON COLUMN photos.file_upload_status    IS '文件上传状态：PENDING/UPLOADING/UPLOADED/FAILED';

CREATE INDEX idx_photos_daily_report ON photos (daily_report_id);
CREATE INDEX idx_photos_issue        ON photos (daily_report_issue_id);
CREATE INDEX idx_photos_taken_at     ON photos (taken_at);

-- ===== 6. project_issues — 项目问题池（§101.11，BR-6 状态机，DD-8/DD-9）=====
-- 日报确认后从 DailyReportIssue 映射生成；确认即锁定（BR-3）后进入项目级问题池
CREATE TABLE project_issues (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id              BIGINT       NOT NULL,
    source_report_id        BIGINT,                      -- 来源日报 ID（生成该问题的日报）
    source_issue_id         BIGINT,                      -- 来源日报问题 ID（daily_report_issues.id）
    issue_no                VARCHAR(64)  NOT NULL,       -- 问题编号（业务可读，如 ISS-{projectId}-{seq}）
    description             TEXT         NOT NULL,
    -- 问题严重程度（REQ-13）：GENERAL/MAJOR/CRITICAL
    severity                VARCHAR(32)  NOT NULL DEFAULT 'GENERAL',
    category                VARCHAR(64),
    responsible_party_id    BIGINT,
    -- 问题状态机（BR-6，§102.4）：VALID 有效 / PENDING_CONFIRM 待确认 / SUSPENDED 暂停使用 /
    --                              VOIDED 作废 / CORRECTED 后续更正（DD-9 终态）
    status                  VARCHAR(32)  NOT NULL DEFAULT 'PENDING_CONFIRM',
    -- 整改状态：PENDING 待整改 / IN_PROGRESS 整改中 / CORRECTED 已整改 / VERIFIED 已验证
    correction_status       VARCHAR(32)  NOT NULL DEFAULT 'PENDING',
    -- BR-1：整改期限 NOT NULL（P0 共识），由 RectificationDeadlineCalculator 按等级计算写入
    rectification_deadline  TIMESTAMPTZ  NOT NULL,
    -- DD-8：confirmed_at / locked_at 分开（与 daily_reports 语义一致）
    confirmed_at            TIMESTAMPTZ,                 -- 确认时刻（进入问题池的业务时刻，整改期限计算起点）
    locked_at               TIMESTAMPTZ,                 -- 锁定时刻（§102.2 确认即锁定持久化）
    -- 来源报告 ID（DD-9：原始事实被已发布报告引用时保留更正追溯）
    created_from_report_id  BIGINT,
    server_seq              BIGINT       NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by              BIGINT,
    updated_by              BIGINT,
    CONSTRAINT uk_project_issues_issue_no UNIQUE (issue_no),
    CONSTRAINT chk_pi_severity CHECK (
        severity IN ('GENERAL', 'MAJOR', 'CRITICAL')
    ),
    CONSTRAINT chk_pi_status CHECK (
        status IN ('VALID', 'PENDING_CONFIRM', 'SUSPENDED', 'VOIDED', 'CORRECTED')
    ),
    CONSTRAINT chk_pi_correction_status CHECK (
        correction_status IN ('PENDING', 'IN_PROGRESS', 'CORRECTED', 'VERIFIED')
    ),
    CONSTRAINT fk_pi_project       FOREIGN KEY (project_id)       REFERENCES projects (id)    ON DELETE RESTRICT,
    CONSTRAINT fk_pi_source_report FOREIGN KEY (source_report_id) REFERENCES daily_reports (id) ON DELETE SET NULL,
    CONSTRAINT fk_pi_source_issue  FOREIGN KEY (source_issue_id)  REFERENCES daily_report_issues (id) ON DELETE SET NULL
);
COMMENT ON TABLE  project_issues IS '项目问题池表（§101.11，BR-6 状态机，DD-8/DD-9）';
COMMENT ON COLUMN project_issues.issue_no               IS '问题编号（业务可读，ISS-{projectId}-{seq}）';
COMMENT ON COLUMN project_issues.severity               IS '问题严重程度（REQ-13）：GENERAL/MAJOR/CRITICAL';
COMMENT ON COLUMN project_issues.status                 IS '问题状态机（BR-6 §102.4）：VALID/PENDING_CONFIRM/SUSPENDED/VOIDED/CORRECTED';
COMMENT ON COLUMN project_issues.correction_status      IS '整改状态：PENDING/IN_PROGRESS/CORRECTED/VERIFIED';
COMMENT ON COLUMN project_issues.rectification_deadline IS '整改期限（BR-1 NOT NULL，P0 共识）：一般+7/较大+3/重大当日 23:59:59';
COMMENT ON COLUMN project_issues.confirmed_at           IS '确认时刻（DD-8，进入问题池业务时刻，整改期限计算起点）';
COMMENT ON COLUMN project_issues.locked_at              IS '锁定时刻（§102.2 确认即锁定持久化，DD-8 与 confirmed_at 同事务写入）';
COMMENT ON COLUMN project_issues.created_from_report_id IS '来源报告 ID（DD-9 后续更正追溯，原始事实被已发布报告引用时保留）';

CREATE INDEX idx_pi_project       ON project_issues (project_id);
CREATE INDEX idx_pi_status        ON project_issues (status);
CREATE INDEX idx_pi_severity      ON project_issues (severity);
CREATE INDEX idx_pi_responsible   ON project_issues (responsible_party_id);
CREATE INDEX idx_pi_source_report ON project_issues (source_report_id);
CREATE INDEX idx_pi_source_issue  ON project_issues (source_issue_id);
CREATE INDEX idx_pi_deadline      ON project_issues (rectification_deadline);

-- ===== 7. issue_relations — 问题关联（§101.12，重复/相似关联）=====
-- 用于问题去重与关联分析：DUPLICATE 重复 / SIMILAR 相似
CREATE TABLE issue_relations (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_issue_id   BIGINT       NOT NULL,           -- 源问题
    target_issue_id   BIGINT       NOT NULL,           -- 目标问题
    -- 关联类型：DUPLICATE 重复（合并）/ SIMILAR 相似（关联参考）
    relation_type     VARCHAR(32)  NOT NULL,
    server_seq        BIGINT       NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        BIGINT,
    updated_by        BIGINT,
    -- 同一对问题同一类型关联唯一（避免重复建立）
    CONSTRAINT uk_issue_relations UNIQUE (source_issue_id, target_issue_id, relation_type),
    CONSTRAINT chk_ir_relation_type CHECK (
        relation_type IN ('DUPLICATE', 'SIMILAR')
    ),
    CONSTRAINT fk_ir_source FOREIGN KEY (source_issue_id) REFERENCES project_issues (id) ON DELETE CASCADE,
    CONSTRAINT fk_ir_target FOREIGN KEY (target_issue_id) REFERENCES project_issues (id) ON DELETE CASCADE,
    -- 不允许自关联
    CONSTRAINT chk_ir_no_self CHECK (source_issue_id <> target_issue_id)
);
COMMENT ON TABLE  issue_relations IS '问题关联表（§101.12，重复/相似关联）';
COMMENT ON COLUMN issue_relations.relation_type IS '关联类型：DUPLICATE 重复 / SIMILAR 相似';

CREATE INDEX idx_ir_source ON issue_relations (source_issue_id);
CREATE INDEX idx_ir_target ON issue_relations (target_issue_id);

-- ===== 8. standard_recommendation_results — 标准推荐结果（§101.26）=====
-- 问题→标准条款的推荐匹配结果快照，含评分、理由、标准库版本（用于推荐追溯）
CREATE TABLE standard_recommendation_results (
    id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id               BIGINT       NOT NULL,
    issue_id                 BIGINT       NOT NULL,    -- 关联日报问题（daily_report_issues.id）
    clause_id                BIGINT       NOT NULL,    -- 推荐命中的标准条款 ID
    score                    INT          NOT NULL,    -- 推荐评分（0-100，越高越匹配）
    reason_snapshot          VARCHAR(512),             -- 推荐理由快照（为何命中该条款）
    standard_library_version VARCHAR(32),              -- 标准库版本（推荐时的标准库快照版本）
    server_seq               BIGINT       NOT NULL DEFAULT 0,
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by               BIGINT,
    updated_by               BIGINT,
    CONSTRAINT fk_srr_project FOREIGN KEY (project_id) REFERENCES projects (id)            ON DELETE CASCADE,
    CONSTRAINT fk_srr_issue   FOREIGN KEY (issue_id)   REFERENCES daily_report_issues (id) ON DELETE CASCADE
);
COMMENT ON TABLE  standard_recommendation_results IS '标准推荐结果表（§101.26，问题→标准条款推荐匹配快照）';
COMMENT ON COLUMN standard_recommendation_results.score                    IS '推荐评分（0-100，越高越匹配）';
COMMENT ON COLUMN standard_recommendation_results.reason_snapshot          IS '推荐理由快照（为何命中该条款）';
COMMENT ON COLUMN standard_recommendation_results.standard_library_version IS '标准库版本（推荐时的标准库快照版本）';

CREATE INDEX idx_srr_project ON standard_recommendation_results (project_id);
CREATE INDEX idx_srr_issue   ON standard_recommendation_results (issue_id);
CREATE INDEX idx_srr_clause  ON standard_recommendation_results (clause_id);
