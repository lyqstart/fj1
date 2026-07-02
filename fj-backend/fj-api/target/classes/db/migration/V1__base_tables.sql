-- =====================================================================
-- V1__base_tables.sql
-- 飞检现场管理系统 — 基础表迁移（用户/角色/权限/组织/字典/操作日志）
-- 目标数据库：PostgreSQL 16
-- 约定：
--   - 主键：id BIGINT GENERATED ALWAYS AS IDENTITY
--   - 同步序列号：server_seq BIGINT DEFAULT 0（用于离线同步冲突检测）
--   - 审计字段：created_at / updated_at / created_by / updated_by
-- =====================================================================

-- ===== 1. 用户表 =====
CREATE TABLE users (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username        VARCHAR(64)  NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    real_name       VARCHAR(64),
    phone           VARCHAR(20),
    email           VARCHAR(128),
    status          SMALLINT     NOT NULL DEFAULT 1,
    last_login_at   TIMESTAMPTZ,
    server_seq      BIGINT       NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by      BIGINT,
    updated_by      BIGINT,
    CONSTRAINT uk_users_username UNIQUE (username)
);
COMMENT ON TABLE  users IS '用户表';
COMMENT ON COLUMN users.status     IS '状态：1启用 0禁用';
COMMENT ON COLUMN users.server_seq IS '同步序列号，用于离线同步冲突检测';
COMMENT ON COLUMN users.password_hash IS 'BCrypt 加密的密码哈希';

CREATE INDEX idx_users_phone  ON users (phone);
CREATE INDEX idx_users_status ON users (status);

-- ===== 2. 角色表 =====
CREATE TABLE roles (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code         VARCHAR(64) NOT NULL,
    name         VARCHAR(64) NOT NULL,
    description  VARCHAR(255),
    server_seq   BIGINT      NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   BIGINT,
    updated_by   BIGINT,
    CONSTRAINT uk_roles_code UNIQUE (code)
);
COMMENT ON TABLE  roles IS '角色表';
COMMENT ON COLUMN roles.code IS '角色编码（如 ROLE_ADMIN / ROLE_INSPECTOR）';

-- ===== 3. 权限表 =====
CREATE TABLE permissions (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code         VARCHAR(128) NOT NULL,
    name         VARCHAR(64)  NOT NULL,
    resource     VARCHAR(128) NOT NULL,
    action       VARCHAR(32)  NOT NULL,
    description  VARCHAR(255),
    server_seq   BIGINT       NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by   BIGINT,
    updated_by   BIGINT,
    CONSTRAINT uk_permissions_code UNIQUE (code)
);
COMMENT ON TABLE  permissions IS '权限表';
COMMENT ON COLUMN permissions.resource IS '受保护资源标识';
COMMENT ON COLUMN permissions.action   IS '操作类型：view/create/update/delete/approve';

CREATE INDEX idx_permissions_resource ON permissions (resource);

-- ===== 4. 角色-权限关联表 =====
CREATE TABLE role_permissions (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_id        BIGINT NOT NULL,
    permission_id  BIGINT NOT NULL,
    server_seq     BIGINT       NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by     BIGINT,
    updated_by     BIGINT,
    CONSTRAINT uk_role_permissions UNIQUE (role_id, permission_id),
    CONSTRAINT fk_role_permissions_role       FOREIGN KEY (role_id)       REFERENCES roles (id)       ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
);
COMMENT ON TABLE role_permissions IS '角色-权限关联表';

CREATE INDEX idx_role_permissions_role       ON role_permissions (role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions (permission_id);

-- ===== 5. 用户-项目-角色关联表（项目级 RBAC） =====
CREATE TABLE user_project_roles (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL,
    project_id  BIGINT NOT NULL,
    role_id     BIGINT NOT NULL,
    server_seq  BIGINT       NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by  BIGINT,
    updated_by  BIGINT,
    CONSTRAINT uk_user_project_role UNIQUE (user_id, project_id, role_id),
    CONSTRAINT fk_upr_user    FOREIGN KEY (user_id)    REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_upr_role    FOREIGN KEY (role_id)    REFERENCES roles (id) ON DELETE CASCADE
);
COMMENT ON TABLE  user_project_roles IS '用户-项目-角色关联表（项目级 RBAC）';
COMMENT ON COLUMN user_project_roles.project_id IS '项目 ID（业务表建立后补充外键）';

CREATE INDEX idx_upr_user    ON user_project_roles (user_id);
CREATE INDEX idx_upr_project ON user_project_roles (project_id);

-- ===== 6. 组织机构表（树形） =====
CREATE TABLE organizations (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(128) NOT NULL,
    parent_id   BIGINT,
    full_name   VARCHAR(255),
    org_type    SMALLINT     NOT NULL DEFAULT 1,
    server_seq  BIGINT       NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by  BIGINT,
    updated_by  BIGINT,
    CONSTRAINT fk_org_parent FOREIGN KEY (parent_id) REFERENCES organizations (id) ON DELETE SET NULL
);
COMMENT ON TABLE  organizations IS '组织机构表（树形结构）';
COMMENT ON COLUMN organizations.parent_id IS '父组织 ID，顶层为 NULL';
COMMENT ON COLUMN organizations.org_type  IS '组织类型：1公司 2部门 3班组';

CREATE INDEX idx_org_parent ON organizations (parent_id);

-- ===== 7. 项目-组织关联表 =====
CREATE TABLE project_organizations (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id       BIGINT NOT NULL,
    organization_id  BIGINT NOT NULL,
    server_seq       BIGINT       NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by       BIGINT,
    updated_by       BIGINT,
    CONSTRAINT uk_project_org UNIQUE (project_id, organization_id),
    CONSTRAINT fk_po_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
COMMENT ON TABLE  project_organizations IS '项目-组织关联表';
COMMENT ON COLUMN project_organizations.project_id IS '项目 ID（业务表建立后补充外键）';

CREATE INDEX idx_po_project ON project_organizations (project_id);
CREATE INDEX idx_po_org     ON project_organizations (organization_id);

-- ===== 8. 数据字典表 =====
CREATE TABLE data_dictionaries (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category    VARCHAR(64)  NOT NULL,
    code        VARCHAR(64)  NOT NULL,
    value       VARCHAR(255) NOT NULL,
    sort_order  INT          NOT NULL DEFAULT 0,
    server_seq  BIGINT       NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by  BIGINT,
    updated_by  BIGINT,
    CONSTRAINT uk_dict_category_code UNIQUE (category, code)
);
COMMENT ON TABLE  data_dictionaries IS '数据字典表';
COMMENT ON COLUMN data_dictionaries.category   IS '字典分类';
COMMENT ON COLUMN data_dictionaries.sort_order IS '排序序号';

CREATE INDEX idx_dict_category ON data_dictionaries (category);

-- ===== 9. 操作日志表（防篡改链式结构） =====
CREATE TABLE operation_logs (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    operator_id    BIGINT       NOT NULL,
    operation_type VARCHAR(32)  NOT NULL,
    target_type    VARCHAR(64)  NOT NULL,
    target_id      BIGINT,
    content        TEXT,
    log_hash       VARCHAR(64)  NOT NULL,
    prev_hash      VARCHAR(64),
    server_seq     BIGINT       NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by     BIGINT,
    updated_by     BIGINT,
    CONSTRAINT fk_oplog_operator FOREIGN KEY (operator_id) REFERENCES users (id) ON DELETE RESTRICT
);
COMMENT ON TABLE  operation_logs IS '操作日志表（链式哈希防篡改）';
COMMENT ON COLUMN operation_logs.operation_type IS '操作类型：create/update/delete/approve/login';
COMMENT ON COLUMN operation_logs.target_type    IS '目标实体类型';
COMMENT ON COLUMN operation_logs.log_hash       IS '当前记录哈希（SHA-256）';
COMMENT ON COLUMN operation_logs.prev_hash      IS '上一条记录哈希，形成防篡改链';

CREATE INDEX idx_oplog_operator      ON operation_logs (operator_id);
CREATE INDEX idx_oplog_target        ON operation_logs (target_type, target_id);
CREATE INDEX idx_oplog_created_at    ON operation_logs (created_at);

-- ===== 通用 updated_at 自动更新触发器函数 =====
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为所有含 updated_at 的表创建触发器
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT table_name FROM information_schema.columns
        WHERE column_name = 'updated_at'
          AND table_schema = 'public'
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I ' ||
            'FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()', tbl);
    END LOOP;
END;
$$;
