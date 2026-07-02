-- =====================================================================
-- V7__report_tables.sql
-- 飞检现场管理系统 — 报告 / 问题快照 / 导出文件表迁移
-- 目标数据库：PostgreSQL 16
-- 依赖：
--   - V1__base_tables.sql  → users（外键 generated_by / created_by / updated_by）
--   - V3__project_tables.sql → projects（外键 project_id）
--   - V5__daily_report_tables.sql → project_issues（外键 source_issue_id）
-- 约定（与 V1~V6 一致）：
--   - 主键：id BIGINT GENERATED ALWAYS AS IDENTITY
--   - 同步序列号：server_seq BIGINT NOT NULL DEFAULT 0（离线同步冲突检测，§6.2）
--   - 审计字段：created_at / updated_at / created_by / updated_by
--   - updated_at 自动更新触发器由 V1 的 fn_set_updated_at() + 下方 DO 块为本迁移新增表创建
-- 业务文档：
--   §101.14 reports（报告，含版本树字段）
--   §101.15 report_issue_snapshots（问题快照，§103 快照独立性，不依赖外键 JOIN）
--   §101.16 export_files（导出文件，DRAFT_PREVIEW / OFFICIAL_PUBLISH）
-- 关键裁决：
--   - reports 版本树预留（§9.2）：root_report_id / previous_report_id / report_version / is_current_effective
--   - report_issue_snapshots 含 *_snapshot 快照字段（§103 快照独立性，原文改名不影响已发布报告）
-- =====================================================================

-- ===== 1. reports — 报告（§101.14）=====
-- 报告生产层核心实体：按时间范围汇总项目问题生成的正式报告
-- status: DRAFT 草稿 / IN_REVIEW 审批中 / PENDING_PUBLISH 待发布 / PUBLISHED 已发布 / RETURNED 已退回
-- 版本树（§9.2 预留）：root_report_id 指向版本树根、previous_report_id 指向上一版本
CREATE TABLE reports (
    id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id               BIGINT       NOT NULL,
    -- 报告编号（业务可读，如 RPT-{projectId}-{seq}）
    report_no                VARCHAR(64)  NOT NULL,
    title                    VARCHAR(256) NOT NULL,
    -- 报告状态机（BR-8）：DRAFT/IN_REVIEW/PENDING_PUBLISH/PUBLISHED/RETURNED
    status                   VARCHAR(32)  NOT NULL DEFAULT 'DRAFT',
    -- 报告周期（时间范围汇总依据）
    report_period_start      TIMESTAMPTZ,
    report_period_end        TIMESTAMPTZ,
    -- ===== 版本树字段（§9.2 预留）=====
    -- 版本树根 ID（首版报告 = 自身 id；新版本时仍指向原始首版）
    root_report_id           BIGINT,
    -- 上一版本 ID（首版为 NULL；新版本指向被修订的上一版）
    previous_report_id       BIGINT,
    -- 版本号（首版 = 1，每次修订递增）
    report_version           INT          NOT NULL DEFAULT 1,
    -- 是否当前生效版本（同一版本树内仅一版为 true）
    is_current_effective     BOOLEAN      NOT NULL DEFAULT TRUE,
    -- 发布时刻（PUBLISHED 时写入；BR-4 发布即固化）
    published_at             TIMESTAMPTZ,
    -- 锁定时刻（已发布报告锁定，禁止再编辑）
    locked_at                TIMESTAMPTZ,
    server_seq               BIGINT       NOT NULL DEFAULT 0,
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by               BIGINT,
    updated_by               BIGINT,
    CONSTRAINT chk_rpt_status CHECK (
        status IN ('DRAFT', 'IN_REVIEW', 'PENDING_PUBLISH', 'PUBLISHED', 'RETURNED')
    ),
    CONSTRAINT uk_reports_report_no UNIQUE (report_no),
    CONSTRAINT fk_rpt_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT,
    -- 版本树自引用（允许 NULL：首版报告 root_report_id 由应用层在 id 分配后回填）
    CONSTRAINT fk_rpt_root     FOREIGN KEY (root_report_id)     REFERENCES reports (id) ON DELETE RESTRICT,
    CONSTRAINT fk_rpt_previous FOREIGN KEY (previous_report_id) REFERENCES reports (id) ON DELETE RESTRICT
);
COMMENT ON TABLE  reports IS '报告表（§101.14，报告生产层核心实体，含版本树字段 §9.2）';
COMMENT ON COLUMN reports.report_no           IS '报告编号（业务可读，如 RPT-{projectId}-{seq}）';
COMMENT ON COLUMN reports.status              IS '报告状态机（BR-8）：DRAFT 草稿 / IN_REVIEW 审批中 / PENDING_PUBLISH 待发布 / PUBLISHED 已发布 / RETURNED 已退回';
COMMENT ON COLUMN reports.report_period_start IS '报告周期起始时刻（时间范围汇总依据）';
COMMENT ON COLUMN reports.report_period_end   IS '报告周期结束时刻（时间范围汇总依据）';
COMMENT ON COLUMN reports.root_report_id      IS '版本树根 ID（§9.2：首版=自身 id，新版本仍指向原始首版）';
COMMENT ON COLUMN reports.previous_report_id  IS '上一版本 ID（§9.2：首版为 NULL，新版本指向被修订的上一版）';
COMMENT ON COLUMN reports.report_version      IS '版本号（§9.2：首版=1，每次修订递增）';
COMMENT ON COLUMN reports.is_current_effective IS '是否当前生效版本（§9.2：同一版本树内仅一版为 true）';
COMMENT ON COLUMN reports.published_at        IS '发布时刻（PUBLISHED 时写入；BR-4 发布即固化）';
COMMENT ON COLUMN reports.locked_at           IS '锁定时刻（已发布报告锁定，禁止再编辑）';

CREATE INDEX idx_rpt_project        ON reports (project_id);
CREATE INDEX idx_rpt_status         ON reports (status);
CREATE INDEX idx_rpt_root           ON reports (root_report_id);
CREATE INDEX idx_rpt_previous       ON reports (previous_report_id);
CREATE INDEX idx_rpt_current_eff    ON reports (is_current_effective);
CREATE INDEX idx_rpt_period         ON reports (report_period_start, report_period_end);

-- ===== 2. report_issue_snapshots — 问题快照（§101.15，§103 快照独立性）=====
-- 报告纳入的问题清单快照：每条记录在报告生成时刻从 project_issues 复制一份冗余副本
-- §103 快照独立性原则：所有 *_snapshot 字段独立存储，不依赖 JOIN project_issues，
--                      原文改名/整改状态变化不影响已发布报告内容
CREATE TABLE report_issue_snapshots (
    id                              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id                       BIGINT       NOT NULL,
    -- 源问题 ID（保留外键便于追溯，但展示/打印只读 *_snapshot 字段，§103）
    source_issue_id                 BIGINT       NOT NULL,
    -- ===== §103 快照字段（冗余副本，不依赖 JOIN）=====
    description_snapshot            VARCHAR(2000) NOT NULL,
    severity_snapshot               VARCHAR(32)  NOT NULL,
    category_snapshot               VARCHAR(64),
    responsible_party_snapshot      VARCHAR(128),
    -- 照片引用快照（JSONB，照片清单的冗余副本；JSON 结构由应用层定义）
    photo_reference_snapshot        JSONB,
    -- 问题编号快照（业务可读，便于报告脱网展示）
    issue_no_snapshot               VARCHAR(64)  NOT NULL,
    -- 报告内排序（手工调整顺序，默认按创建顺序）
    sort_order                      INT          NOT NULL DEFAULT 0,
    server_seq                      BIGINT       NOT NULL DEFAULT 0,
    created_at                      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by                      BIGINT,
    updated_by                      BIGINT,
    -- 同一报告下同一源问题不可重复纳入
    CONSTRAINT uk_ris_report_issue UNIQUE (report_id, source_issue_id),
    CONSTRAINT fk_ris_report FOREIGN KEY (report_id)      REFERENCES reports (id)        ON DELETE CASCADE,
    CONSTRAINT fk_ris_source FOREIGN KEY (source_issue_id) REFERENCES project_issues (id) ON DELETE RESTRICT
);
COMMENT ON TABLE  report_issue_snapshots IS '问题快照表（§101.15，§103 快照独立性：*_snapshot 字段不依赖 JOIN）';
COMMENT ON COLUMN report_issue_snapshots.source_issue_id            IS '源问题 ID（保留追溯，展示只读 *_snapshot 字段）';
COMMENT ON COLUMN report_issue_snapshots.description_snapshot       IS '问题描述快照（§103 冗余副本，原文改名不影响已发布报告）';
COMMENT ON COLUMN report_issue_snapshots.severity_snapshot          IS '问题严重程度快照（GENERAL/MAJOR/CRITICAL）';
COMMENT ON COLUMN report_issue_snapshots.category_snapshot          IS '问题分类/专业快照';
COMMENT ON COLUMN report_issue_snapshots.responsible_party_snapshot IS '责任单位/责任人名称快照（已解析为展示名，避免依赖 organizations/users JOIN）';
COMMENT ON COLUMN report_issue_snapshots.photo_reference_snapshot   IS '照片引用快照（JSONB，照片清单冗余副本）';
COMMENT ON COLUMN report_issue_snapshots.issue_no_snapshot          IS '问题编号快照（业务可读，便于脱网展示）';
COMMENT ON COLUMN report_issue_snapshots.sort_order                 IS '报告内排序（手工调整顺序）';

CREATE INDEX idx_ris_report      ON report_issue_snapshots (report_id);
CREATE INDEX idx_ris_source      ON report_issue_snapshots (source_issue_id);
CREATE INDEX idx_ris_sort_order  ON report_issue_snapshots (report_id, sort_order);

-- ===== 3. export_files — 导出文件（§101.16）=====
-- 报告导出的物理文件记录：草稿预览 / 正式发布两类型
-- file_type: DRAFT_PREVIEW 草稿预览 / OFFICIAL_PUBLISH 正式发布
CREATE TABLE export_files (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id       BIGINT       NOT NULL,
    -- 文件类型：DRAFT_PREVIEW 草稿预览 / OFFICIAL_PUBLISH 正式发布
    file_type       VARCHAR(32)  NOT NULL,
    file_path       VARCHAR(512) NOT NULL,
    file_name       VARCHAR(256) NOT NULL,
    file_size       BIGINT,                       -- 文件字节数（可空：生成中尚未落地）
    -- 文件哈希（SHA-256，64 位十六进制；用于完整性校验和去重）
    file_hash       VARCHAR(64),
    generated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    generated_by    BIGINT,                        -- 生成人 ID（users.id）
    server_seq      BIGINT       NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by      BIGINT,
    updated_by      BIGINT,
    CONSTRAINT chk_ef_file_type CHECK (
        file_type IN ('DRAFT_PREVIEW', 'OFFICIAL_PUBLISH')
    ),
    CONSTRAINT fk_ef_report FOREIGN KEY (report_id) REFERENCES reports (id) ON DELETE CASCADE,
    CONSTRAINT fk_ef_generator FOREIGN KEY (generated_by) REFERENCES users (id) ON DELETE SET NULL
);
COMMENT ON TABLE  export_files IS '导出文件表（§101.16，报告导出的物理文件记录）';
COMMENT ON COLUMN export_files.file_type   IS '文件类型：DRAFT_PREVIEW 草稿预览 / OFFICIAL_PUBLISH 正式发布';
COMMENT ON COLUMN export_files.file_path   IS '文件存储路径';
COMMENT ON COLUMN export_files.file_name   IS '文件名';
COMMENT ON COLUMN export_files.file_size   IS '文件字节数（可空：生成中尚未落地）';
COMMENT ON COLUMN export_files.file_hash   IS '文件哈希（SHA-256，64 位十六进制，完整性校验）';
COMMENT ON COLUMN export_files.generated_at IS '生成时刻';
COMMENT ON COLUMN export_files.generated_by IS '生成人 ID';

CREATE INDEX idx_ef_report    ON export_files (report_id);
CREATE INDEX idx_ef_file_type ON export_files (file_type);

-- ===== 为 V7 新增表创建 updated_at 触发器（fn_set_updated_at 由 V1 定义） =====
-- reports / report_issue_snapshots / export_files 均为可变表，需维护 updated_at
DO $$
DECLARE
    t TEXT;
    new_tables TEXT[] := ARRAY['reports', 'report_issue_snapshots', 'export_files'];
BEGIN
    FOREACH t IN ARRAY new_tables LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'trg_set_updated_at'
              AND tgrelid = (quote_ident(t))::regclass
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I ' ||
                'FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()', t);
        END IF;
    END LOOP;
END;
$$;
