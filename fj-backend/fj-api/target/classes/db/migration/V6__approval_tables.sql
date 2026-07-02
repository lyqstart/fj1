-- =====================================================================
-- V6__approval_tables.sql
-- 飞检现场管理系统 — 审批运行实例表迁移
-- 目标数据库：PostgreSQL 16
-- 依赖：
--   - V1__base_tables.sql  → users（外键 initiator_id / assignee_id / approver_id）
--   - V3__project_tables.sql → projects（外键 project_id）、approval_flow_configs（业务关联）
-- 约定（与 V1~V5 一致）：
--   - 主键：id BIGINT GENERATED ALWAYS AS IDENTITY
--   - 同步序列号：server_seq BIGINT NOT NULL DEFAULT 0（离线同步冲突检测，§6.2）
--   - 审计字段：created_at / updated_at / created_by / updated_by
--   - updated_at 自动更新触发器由 V1 的 fn_set_updated_at() + DO 块自动为本迁移新增表创建
-- 业务文档：
--   §101.21 ApprovalInstance（审批实例） / ApprovalTask（审批任务） / ApprovalRecord（审批记录）
--   §7.4   审批记录链式哈希留痕（只写不可 UPDATE/DELETE）
-- 关键裁决：
--   - approval_records 链式防篡改：record_hash = SHA-256(prev_hash + content)
--   - approval_records 只写不可 UPDATE/DELETE（§7.4 留痕）— 通过 PG 权限 + 触发器阻断 + CHECK 注释约束
-- =====================================================================

-- ===== 1. approval_instances — 审批实例（§101.21）=====
-- 一次审批流程的运行实例：日报确认 / 报告审批均复用本表
-- status: PENDING 待审 / APPROVED 已通过 / REJECTED 已退回 / CANCELLED 已撤销
CREATE TABLE approval_instances (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id      BIGINT       NOT NULL,
    -- flow_type: DAILY_REPORT 日报确认 / REPORT 报告审批
    flow_type       VARCHAR(32)  NOT NULL,
    -- business_id: 关联业务实体 ID（日报 id 或报告 id，按 flow_type 解释）
    business_id     BIGINT       NOT NULL,
    -- 实例状态：PENDING/APPROVED/REJECTED/CANCELLED
    status          VARCHAR(32)  NOT NULL DEFAULT 'PENDING',
    -- 当前节点名称（多节点审批流中的当前节点，对应 approval_flow_configs.config_json 的节点 name）
    current_node    VARCHAR(128),
    initiator_id    BIGINT,                        -- 发起人 ID（通常为日报提交人）
    initiated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),  -- 发起时刻
    completed_at    TIMESTAMPTZ,                   -- 完成时刻（APPROVED/REJECTED/CANCELLED 时写入）
    server_seq      BIGINT       NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by      BIGINT,
    updated_by      BIGINT,
    CONSTRAINT chk_ai_status CHECK (
        status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')
    ),
    CONSTRAINT chk_ai_flow_type CHECK (
        flow_type IN ('DAILY_REPORT', 'REPORT')
    ),
    CONSTRAINT fk_ai_project   FOREIGN KEY (project_id)   REFERENCES projects (id) ON DELETE RESTRICT,
    CONSTRAINT fk_ai_initiator FOREIGN KEY (initiator_id) REFERENCES users (id)    ON DELETE SET NULL
);
COMMENT ON TABLE  approval_instances IS '审批实例表（§101.21，日报确认 / 报告审批共用）';
COMMENT ON COLUMN approval_instances.flow_type    IS '审批类型：DAILY_REPORT 日报确认 / REPORT 报告审批';
COMMENT ON COLUMN approval_instances.business_id  IS '关联业务实体 ID（日报 id 或报告 id，按 flow_type 解释）';
COMMENT ON COLUMN approval_instances.status       IS '实例状态：PENDING 待审 / APPROVED 已通过 / REJECTED 已退回 / CANCELLED 已撤销';
COMMENT ON COLUMN approval_instances.current_node IS '当前节点名称（多节点审批流中的当前节点）';
COMMENT ON COLUMN approval_instances.initiator_id IS '发起人 ID（通常为日报提交人）';
COMMENT ON COLUMN approval_instances.initiated_at IS '发起时刻';
COMMENT ON COLUMN approval_instances.completed_at IS '完成时刻（APPROVED/REJECTED/CANCELLED 时写入）';
COMMENT ON COLUMN approval_instances.server_seq   IS '同步序列号，离线同步冲突检测（§6.2）';

CREATE INDEX idx_ai_project       ON approval_instances (project_id);
CREATE INDEX idx_ai_business      ON approval_instances (business_id);
CREATE INDEX idx_ai_status        ON approval_instances (status);
CREATE INDEX idx_ai_initiator     ON approval_instances (initiator_id);

-- ===== 2. approval_tasks — 审批任务（§101.21）=====
-- 审批实例下分派给具体审批人的任务（一个实例 → 多个任务，按节点串联）
-- status: PENDING 待处理 / APPROVED 已通过 / REJECTED 已退回
CREATE TABLE approval_tasks (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    instance_id     BIGINT       NOT NULL,
    assignee_id     BIGINT       NOT NULL,        -- 审批人 ID（users.id）
    -- 节点名称（对应 approval_flow_configs.config_json 的节点 name）
    node_name       VARCHAR(128) NOT NULL,
    -- 任务状态：PENDING/APPROVED/REJECTED
    status          VARCHAR(32)  NOT NULL DEFAULT 'PENDING',
    comment         TEXT,                          -- 审批意见（审批通过/退回时填入）
    assigned_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),  -- 分派时刻
    completed_at    TIMESTAMPTZ,                   -- 完成时刻（APPROVED/REJECTED 时写入）
    server_seq      BIGINT       NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by      BIGINT,
    updated_by      BIGINT,
    CONSTRAINT chk_at_status CHECK (
        status IN ('PENDING', 'APPROVED', 'REJECTED')
    ),
    CONSTRAINT fk_at_instance  FOREIGN KEY (instance_id) REFERENCES approval_instances (id) ON DELETE CASCADE,
    CONSTRAINT fk_at_assignee  FOREIGN KEY (assignee_id)  REFERENCES users (id)            ON DELETE RESTRICT
);
COMMENT ON TABLE  approval_tasks IS '审批任务表（§101.21，审批实例下分派给具体审批人的任务）';
COMMENT ON COLUMN approval_tasks.node_name   IS '节点名称（对应 approval_flow_configs.config_json 的节点 name）';
COMMENT ON COLUMN approval_tasks.status      IS '任务状态：PENDING 待处理 / APPROVED 已通过 / REJECTED 已退回';
COMMENT ON COLUMN approval_tasks.comment     IS '审批意见（审批通过/退回时填入）';
COMMENT ON COLUMN approval_tasks.assigned_at IS '分派时刻';
COMMENT ON COLUMN approval_tasks.completed_at IS '完成时刻（APPROVED/REJECTED 时写入）';

CREATE INDEX idx_at_instance  ON approval_tasks (instance_id);
CREATE INDEX idx_at_assignee  ON approval_tasks (assignee_id);
CREATE INDEX idx_at_status    ON approval_tasks (status);

-- ===== 3. approval_records — 审批记录（§7.4 链式哈希留痕，只写不可 UPDATE/DELETE）=====
-- 审批操作的不可篡改留痕：每次 approve/reject 写入一条记录
-- 链式哈希：record_hash = SHA-256(prev_hash + content)，prev_hash 指向上一条记录的 record_hash
-- 不可变约束（§7.4）：本表只 INSERT，禁止 UPDATE/DELETE（见下方触发器 + 权限注释）
CREATE TABLE approval_records (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    instance_id     BIGINT       NOT NULL,
    task_id         BIGINT,                        -- 关联审批任务（可空：实例级操作如 CANCEL 不关联任务）
    approver_id     BIGINT       NOT NULL,         -- 操作人 ID
    -- action: APPROVE 通过 / REJECT 退回
    action          VARCHAR(32)  NOT NULL,
    comment         TEXT,                          -- 审批意见快照
    -- 链式哈希（§7.4，与 operation_logs 同模式）
    record_hash     VARCHAR(64)  NOT NULL,         -- 当前记录哈希（SHA-256，64 位十六进制）
    prev_hash       VARCHAR(64),                   -- 上一条记录哈希，形成防篡改链（首条为 NULL）
    -- 注意：本表只有 created_at，无 updated_at —— 不可更新
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ar_action CHECK (
        action IN ('APPROVE', 'REJECT')
    ),
    CONSTRAINT fk_ar_instance FOREIGN KEY (instance_id) REFERENCES approval_instances (id) ON DELETE RESTRICT,
    CONSTRAINT fk_ar_task     FOREIGN KEY (task_id)     REFERENCES approval_tasks (id)     ON DELETE RESTRICT
    -- §7.4 不可变约束：不创建 updated_at 触发器；下方触发器阻断 UPDATE/DELETE
);
COMMENT ON TABLE  approval_records IS '审批记录表（§7.4 链式哈希留痕，只写不可 UPDATE/DELETE）';
COMMENT ON COLUMN approval_records.task_id      IS '关联审批任务（可空：实例级操作如 CANCEL 不关联任务）';
COMMENT ON COLUMN approval_records.action       IS '审批动作：APPROVE 通过 / REJECT 退回';
COMMENT ON COLUMN approval_records.record_hash  IS '当前记录哈希（SHA-256，64 位十六进制），防篡改';
COMMENT ON COLUMN approval_records.prev_hash    IS '上一条记录哈希，形成防篡改链（首条为 NULL）';
COMMENT ON COLUMN approval_records.created_at   IS '记录创建时刻（§7.4 不可变：无 updated_at，禁止 UPDATE/DELETE）';

CREATE INDEX idx_ar_instance ON approval_records (instance_id);
CREATE INDEX idx_ar_task     ON approval_records (task_id);
CREATE INDEX idx_ar_approver ON approval_records (approver_id);

-- ===== §7.4 不可变保护：approval_records 只写不可 UPDATE/DELETE =====
-- 通过 BEFORE UPDATE / BEFORE DELETE 触发器阻断所有写操作（除 INSERT）。
-- 触发器函数抛异常使事务回滚，确保审批记录一旦写入即不可篡改。
CREATE OR REPLACE FUNCTION fn_block_approval_records_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'approval_records 是只写表（§7.4 链式哈希留痕），禁止 UPDATE/DELETE';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_ar_update ON approval_records;
CREATE TRIGGER trg_block_ar_update
    BEFORE UPDATE ON approval_records
    FOR EACH ROW EXECUTE FUNCTION fn_block_approval_records_mutation();

DROP TRIGGER IF EXISTS trg_block_ar_delete ON approval_records;
CREATE TRIGGER trg_block_ar_delete
    BEFORE DELETE ON approval_records
    FOR EACH ROW EXECUTE FUNCTION fn_block_approval_records_mutation();

-- ===== 为 V6 可变表创建 updated_at 触发器（approval_instances / approval_tasks） =====
-- 注意：approval_records 不创建触发器（只写表，无 updated_at）
DO $$
DECLARE
    t TEXT;
    new_tables TEXT[] := ARRAY['approval_instances', 'approval_tasks'];
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
