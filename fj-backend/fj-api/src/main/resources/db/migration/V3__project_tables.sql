-- =====================================================================
-- V3__project_tables.sql
-- 飞检现场管理系统 — 项目配置与检查表迁移
-- 目标数据库：PostgreSQL 16
-- 依赖：V1__base_tables.sql（users / organizations / user_project_roles /
--       project_organizations 等基础表）、fn_set_updated_at() 触发器函数
-- 约定：
--   - 主键：id BIGINT GENERATED ALWAYS AS IDENTITY
--   - 同步序列号：server_seq BIGINT DEFAULT 0（离线同步冲突检测）
--   - 审计字段：created_at / updated_at / created_by / updated_by
--   - 状态枚举统一用 VARCHAR(32) + CHECK 约束（可读、抗重构）
-- =====================================================================

-- ===== 1. 项目表 =====
CREATE TABLE projects (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            VARCHAR(128) NOT NULL,
    code            VARCHAR(64),
    description     VARCHAR(512),
    status          VARCHAR(32)  NOT NULL DEFAULT 'PREPARING',
    config_json     JSONB,
    start_date      DATE,
    end_date        DATE,
    server_seq      BIGINT       NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by      BIGINT,
    updated_by      BIGINT,
    CONSTRAINT uk_projects_code UNIQUE (code),
    CONSTRAINT ck_projects_status CHECK (status IN ('PREPARING', 'ACTIVE', 'COMPLETED', 'ARCHIVED'))
);
COMMENT ON TABLE  projects IS '项目表';
COMMENT ON COLUMN projects.code   IS '项目编号，可手填或系统生成';
COMMENT ON COLUMN projects.status IS '状态：PREPARING 筹备 / ACTIVE 进行中 / COMPLETED 已结束 / ARCHIVED 已归档';
COMMENT ON COLUMN projects.config_json IS '项目扩展配置（JSON），结构化配置项优先存 project_configs 表';

CREATE INDEX idx_projects_status ON projects (status);

-- ===== 2. 项目配置表（结构化配置项，含 BR-1 整改期限配置点） =====
CREATE TABLE project_configs (
    id                                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id                         BIGINT  NOT NULL,
    enforce_required_items             BOOLEAN NOT NULL DEFAULT TRUE,
    min_description_length             INT     NOT NULL DEFAULT 100,
    major_issue_deadline_hours         INT     NOT NULL DEFAULT 24,
    rectification_deadline_default_days INT    NOT NULL DEFAULT 7,
    photo_min_count                    INT     NOT NULL DEFAULT 1,
    photo_quality_level                VARCHAR(32) NOT NULL DEFAULT 'STANDARD',
    server_seq                         BIGINT       NOT NULL DEFAULT 0,
    created_at                         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at                         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by                         BIGINT,
    updated_by                         BIGINT,
    CONSTRAINT uk_project_configs_project UNIQUE (project_id),
    CONSTRAINT fk_pc_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);
COMMENT ON TABLE  project_configs IS '项目配置表（结构化配置项）';
COMMENT ON COLUMN project_configs.enforce_required_items             IS '是否强制必查项';
COMMENT ON COLUMN project_configs.min_description_length             IS '问题描述最少字数（默认 100）';
COMMENT ON COLUMN project_configs.major_issue_deadline_hours         IS '重大问题整改期限（小时），BR-1 配置点，默认 24';
COMMENT ON COLUMN project_configs.rectification_deadline_default_days IS '一般问题整改默认天数，默认 7';
COMMENT ON COLUMN project_configs.photo_min_count                    IS '照片最少张数';
COMMENT ON COLUMN project_configs.photo_quality_level                IS '照片质量等级：STANDARD / HIGH';

-- ===== 3. 项目检查表 =====
CREATE TABLE project_inspection_forms (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id   BIGINT      NOT NULL,
    name         VARCHAR(128) NOT NULL,
    version      INT         NOT NULL DEFAULT 1,
    status       VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    server_seq   BIGINT      NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   BIGINT,
    updated_by   BIGINT,
    CONSTRAINT fk_pif_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT ck_pif_status CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED'))
);
COMMENT ON TABLE  project_inspection_forms IS '项目检查表';
COMMENT ON COLUMN project_inspection_forms.version IS '版本号，发布后不可修改条目';
COMMENT ON COLUMN project_inspection_forms.status  IS '状态：DRAFT 草稿 / ACTIVE 已发布 / ARCHIVED 已归档';

CREATE INDEX idx_pif_project ON project_inspection_forms (project_id);

-- ===== 4. 检查表条目 =====
CREATE TABLE inspection_form_items (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    form_id               BIGINT      NOT NULL,
    category              VARCHAR(64),
    check_content         VARCHAR(512) NOT NULL,
    is_required           BOOLEAN     NOT NULL DEFAULT FALSE,
    sort_order            INT         NOT NULL DEFAULT 0,
    standard_binding_id   BIGINT,
    server_seq            BIGINT      NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by            BIGINT,
    updated_by            BIGINT,
    CONSTRAINT fk_ifi_form FOREIGN KEY (form_id) REFERENCES project_inspection_forms (id) ON DELETE CASCADE
);
COMMENT ON TABLE  inspection_form_items IS '检查表条目';
COMMENT ON COLUMN inspection_form_items.category            IS '检查分类 / 专业';
COMMENT ON COLUMN inspection_form_items.is_required         IS '是否必查项';
COMMENT ON COLUMN inspection_form_items.standard_binding_id IS '默认绑定标准条款 ID（关联 check_item_standard_bindings）';

CREATE INDEX idx_ifi_form ON inspection_form_items (form_id);

-- ===== 5. 审批流配置表 =====
CREATE TABLE approval_flow_configs (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id   BIGINT      NOT NULL,
    flow_type    VARCHAR(32) NOT NULL,
    config_json  JSONB       NOT NULL,
    status       VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    version      INT         NOT NULL DEFAULT 1,
    server_seq   BIGINT      NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   BIGINT,
    updated_by   BIGINT,
    CONSTRAINT fk_afc_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT ck_afc_flow_type CHECK (flow_type IN ('DAILY_REPORT', 'REPORT')),
    CONSTRAINT ck_afc_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);
COMMENT ON TABLE  approval_flow_configs IS '审批流配置表（日报确认 / 报告审批）';
COMMENT ON COLUMN approval_flow_configs.flow_type   IS '流程类型：DAILY_REPORT 日报确认 / REPORT 报告审批';
COMMENT ON COLUMN approval_flow_configs.config_json IS '审批节点列表 JSON：[{node, approverRoleId, ...}]';
COMMENT ON COLUMN approval_flow_configs.status      IS '状态：ACTIVE 生效 / INACTIVE 停用';

CREATE INDEX idx_afc_project_type ON approval_flow_configs (project_id, flow_type);

-- ===== 6. 标准文档表 =====
CREATE TABLE standard_documents (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title         VARCHAR(255) NOT NULL,
    doc_number    VARCHAR(128),
    publish_date  DATE,
    status        VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED',
    version       VARCHAR(32),
    server_seq    BIGINT      NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    BIGINT,
    updated_by    BIGINT,
    CONSTRAINT ck_sd_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'SUPERSEDED'))
);
COMMENT ON TABLE  standard_documents IS '标准文档表（国标 / 行标 / 地标）';
COMMENT ON COLUMN standard_documents.doc_number IS '标准编号';
COMMENT ON COLUMN standard_documents.status     IS '状态：DRAFT 草稿 / PUBLISHED 启用 / SUPERSEDED 已废止';

CREATE INDEX idx_sd_doc_number ON standard_documents (doc_number);

-- ===== 7. 标准条款表 =====
CREATE TABLE standard_clauses (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id        BIGINT      NOT NULL,
    clause_number      VARCHAR(64) NOT NULL,
    content            TEXT        NOT NULL,
    category           VARCHAR(64),
    keyword_tags       VARCHAR(512),
    issue_template_id  BIGINT,
    server_seq         BIGINT      NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by         BIGINT,
    updated_by         BIGINT,
    CONSTRAINT fk_sc_document FOREIGN KEY (document_id) REFERENCES standard_documents (id) ON DELETE CASCADE
);
COMMENT ON TABLE  standard_clauses IS '标准条款表';
COMMENT ON COLUMN standard_clauses.clause_number     IS '条款号';
COMMENT ON COLUMN standard_clauses.category          IS '问题分类 / 专业';
COMMENT ON COLUMN standard_clauses.keyword_tags      IS '关键词标签（逗号分隔，用于推荐检索）';
COMMENT ON COLUMN standard_clauses.issue_template_id IS '关联问题模板 ID';

CREATE INDEX idx_sc_document ON standard_clauses (document_id);
CREATE INDEX idx_sc_category ON standard_clauses (category);

-- ===== 8. 标准问题模板表 =====
CREATE TABLE standard_issue_templates (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title                VARCHAR(255) NOT NULL,
    description_template TEXT,
    severity_level       VARCHAR(32),
    category             VARCHAR(64),
    server_seq           BIGINT      NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by           BIGINT,
    updated_by          BIGINT
);
COMMENT ON TABLE  standard_issue_templates IS '标准问题模板表';
COMMENT ON COLUMN standard_issue_templates.severity_level IS '严重等级：MAJOR 重大 / MINOR 一般 / SUGGESTION 建议';
COMMENT ON COLUMN standard_issue_templates.category      IS '问题分类';

CREATE INDEX idx_sit_category ON standard_issue_templates (category);

-- ===== 9. 检查项-标准条款绑定表 =====
CREATE TABLE check_item_standard_bindings (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    check_item_id       BIGINT      NOT NULL,
    standard_clause_id  BIGINT      NOT NULL,
    binding_type        VARCHAR(32) NOT NULL DEFAULT 'RECOMMENDED',
    score_weight        INT         NOT NULL DEFAULT 50,
    server_seq          BIGINT      NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          BIGINT,
    updated_by          BIGINT,
    CONSTRAINT uk_check_item_clause UNIQUE (check_item_id, standard_clause_id),
    CONSTRAINT ck_cisb_binding_type CHECK (binding_type IN ('FIXED', 'RECOMMENDED'))
);
COMMENT ON TABLE  check_item_standard_bindings IS '检查项-标准条款绑定表';
COMMENT ON COLUMN check_item_standard_bindings.binding_type IS '绑定类型：FIXED 固定 / RECOMMENDED 推荐';
COMMENT ON COLUMN check_item_standard_bindings.score_weight  IS '推荐权重（0-100），默认 50';

CREATE INDEX idx_cisb_check_item ON check_item_standard_bindings (check_item_id);
CREATE INDEX idx_cisb_clause     ON check_item_standard_bindings (standard_clause_id);

-- ===== 10. 补充 V1 占位外键（projects 表建立后） =====
-- user_project_roles.project_id / project_organizations.project_id 在 V1 中未建外键
ALTER TABLE user_project_roles
    ADD CONSTRAINT fk_upr_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;

ALTER TABLE project_organizations
    ADD CONSTRAINT fk_po_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;

-- ===== 为 V3 新表创建 updated_at 触发器（fn_set_updated_at 已在 V1 定义） =====
DO $$
DECLARE
    t TEXT;
    new_tables TEXT[] := ARRAY[
        'projects', 'project_configs', 'project_inspection_forms', 'inspection_form_items',
        'approval_flow_configs', 'standard_documents', 'standard_clauses',
        'standard_issue_templates', 'check_item_standard_bindings'
        ];
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
