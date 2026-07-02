-- =====================================================================
-- V4__task_tables.sql
-- 飞检现场管理系统 — 任务/位置/设备/通知/编辑锁/同步元数据 表迁移
-- 目标数据库：PostgreSQL 16
-- 依赖：
--   - V1__base_tables.sql  → users（外键 inspector_id / recipient_id / locked_by_user_id）
--   - V3__project_tables.sql → projects（外键 project_id）、project_inspection_forms（外键 form_id）
-- 约定（与 V1 一致）：
--   - 主键：id BIGINT GENERATED ALWAYS AS IDENTITY
--   - 同步序列号：server_seq BIGINT NOT NULL DEFAULT 0（离线同步冲突检测，§6.2）
--   - 审计字段：created_at / updated_at / created_by / updated_by
--   - updated_at 自动更新触发器由 V1 的 fn_set_updated_at() + DO 块自动为本迁移新增表创建
-- 业务文档：§101.6 Equipment / §101.7 InspectionTask / §101.8 LocationDetail /
--           §101.17 / §101.18 / §101.20 EditLock / §101.23 MajorIssueNotification /
--           §101.27 Notification / §101.28 SyncBatch / ClientSyncState
-- =====================================================================

-- ===== 1. inspection_tasks — 检查任务（服务端下派，离线可编辑）=====
-- 业务文档 §101.7 / BR-7 任务状态机：ASSIGNED → ACCEPTED → IN_PROGRESS → SUBMITTED
CREATE TABLE inspection_tasks (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id      BIGINT       NOT NULL,
    form_id         BIGINT,                       -- 引用的已发布检查表（§101.7），可为空（自由任务）
    task_no         VARCHAR(64)  NOT NULL,        -- 任务编号（业务可读，如 IT-2026-0001）
    task_name       VARCHAR(255) NOT NULL,        -- 任务名称（对应安卓本地 schema.task_name / prompt 的 title）
    task_date       DATE,                         -- 计划检查日期
    inspector_id    BIGINT       NOT NULL,        -- 被指派的检查人员（§101.7）
    assigned_org_id BIGINT,                       -- 指派的组织（V1 organizations）
    -- 任务状态机（BR-7）：ASSIGNED 待接收 → ACCEPTED 已接收 → IN_PROGRESS 进行中 → SUBMITTED 已提交 → CANCELLED 已取消
    task_status     VARCHAR(32)  NOT NULL DEFAULT 'ASSIGNED',
    description     TEXT,
    planned_date    TIMESTAMPTZ,                  -- 计划开始时间（可空）
    completed_at    TIMESTAMPTZ,                  -- 任务完成时间（SUBMITTED 时写入）
    cancelled_at    TIMESTAMPTZ,                  -- 任务取消时间
    -- 位置快照（任务派发时的位置信息冗余，避免位置明细变更影响历史任务）
    location_id         BIGINT,
    location_name_snapshot VARCHAR(255),
    server_seq      BIGINT       NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by      BIGINT,
    updated_by      BIGINT,
    CONSTRAINT uk_inspection_tasks_task_no UNIQUE (task_no),
    CONSTRAINT chk_inspection_tasks_task_status CHECK (
        task_status IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'SUBMITTED', 'CANCELLED')
    ),
    CONSTRAINT fk_inspection_tasks_project   FOREIGN KEY (project_id)   REFERENCES projects (id)                  ON DELETE RESTRICT,
    CONSTRAINT fk_inspection_tasks_form      FOREIGN KEY (form_id)      REFERENCES project_inspection_forms (id)  ON DELETE SET NULL,
    CONSTRAINT fk_inspection_tasks_inspector FOREIGN KEY (inspector_id) REFERENCES users (id)                    ON DELETE RESTRICT
);
COMMENT ON TABLE  inspection_tasks IS '检查任务表（§101.7，BR-7 状态机）';
COMMENT ON COLUMN inspection_tasks.task_no    IS '任务编号（业务可读）';
COMMENT ON COLUMN inspection_tasks.task_name  IS '任务名称';
COMMENT ON COLUMN inspection_tasks.task_status IS '任务状态机（BR-7）：ASSIGNED/ACCEPTED/IN_PROGRESS/SUBMITTED/CANCELLED';
COMMENT ON COLUMN inspection_tasks.form_id    IS '关联的已发布检查表（§101.7），NULL 表示自由任务';
COMMENT ON COLUMN inspection_tasks.inspector_id IS '被指派的检查人员 ID';
COMMENT ON COLUMN inspection_tasks.location_name_snapshot IS '派发时位置名称冗余快照，位置明细变更不影响历史任务';
COMMENT ON COLUMN inspection_tasks.server_seq IS '同步序列号，用于离线同步冲突检测（§6.2）';

CREATE INDEX idx_inspection_tasks_project   ON inspection_tasks (project_id);
CREATE INDEX idx_inspection_tasks_inspector ON inspection_tasks (inspector_id);
CREATE INDEX idx_inspection_tasks_status    ON inspection_tasks (task_status);
CREATE INDEX idx_inspection_tasks_task_date ON inspection_tasks (task_date);
CREATE INDEX idx_inspection_tasks_org       ON inspection_tasks (assigned_org_id);

-- ===== 2. location_details — 位置明细（任务关联的检查位置）=====
-- 业务文档 §101.8 LocationDetail
CREATE TABLE location_details (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id     BIGINT       NOT NULL,
    project_id  BIGINT       NOT NULL,           -- 冗余项目 ID，便于按项目筛选位置
    name        VARCHAR(255) NOT NULL,           -- 位置名称（如"主厂房 1F 配电室"）
    address     VARCHAR(512),                    -- 详细地址
    longitude   DOUBLE PRECISION,                -- 经度（WGS84）
    latitude    DOUBLE PRECISION,                -- 纬度（WGS84）
    sort_order  INT          NOT NULL DEFAULT 0, -- 同一任务下多个位置的排序
    server_seq  BIGINT       NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by  BIGINT,
    updated_by  BIGINT,
    CONSTRAINT fk_location_details_task FOREIGN KEY (task_id)    REFERENCES inspection_tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_location_details_proj FOREIGN KEY (project_id) REFERENCES projects (id)         ON DELETE RESTRICT
);
COMMENT ON TABLE  location_details IS '位置明细表（§101.8，任务关联的检查位置）';
COMMENT ON COLUMN location_details.longitude IS '经度（WGS84）';
COMMENT ON COLUMN location_details.latitude  IS '纬度（WGS84）';

CREATE INDEX idx_location_details_task    ON location_details (task_id);
CREATE INDEX idx_location_details_project ON location_details (project_id);

-- ===== 3. equipments — 设备（任务关联的被检设备）=====
-- 业务文档 §101.6 Equipment
CREATE TABLE equipments (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id       BIGINT       NOT NULL,
    project_id    BIGINT       NOT NULL,
    name          VARCHAR(255) NOT NULL,         -- 设备名称
    model         VARCHAR(128),                  -- 设备型号
    specification VARCHAR(512),                  -- 规格参数
    -- 设备状态：NORMAL 正常 / ABNORMAL 异常 / OUT_OF_SERVICE 停用 / UNKNOWN 未知
    status        VARCHAR(32)  NOT NULL DEFAULT 'NORMAL',
    location_id   BIGINT,                        -- 关联位置明细（§101.8），可为空
    server_seq    BIGINT       NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by    BIGINT,
    updated_by    BIGINT,
    CONSTRAINT chk_equipments_status CHECK (
        status IN ('NORMAL', 'ABNORMAL', 'OUT_OF_SERVICE', 'UNKNOWN')
    ),
    CONSTRAINT fk_equipments_task FOREIGN KEY (task_id)     REFERENCES inspection_tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_equipments_proj FOREIGN KEY (project_id)  REFERENCES projects (id)         ON DELETE RESTRICT,
    CONSTRAINT fk_equipments_loc  FOREIGN KEY (location_id) REFERENCES location_details (id) ON DELETE SET NULL
);
COMMENT ON TABLE  equipments IS '设备表（§101.6，任务关联的被检设备）';
COMMENT ON COLUMN equipments.status IS '设备状态：NORMAL/ABNORMAL/OUT_OF_SERVICE/UNKNOWN';

CREATE INDEX idx_equipments_task    ON equipments (task_id);
CREATE INDEX idx_equipments_project ON equipments (project_id);
CREATE INDEX idx_equipments_status  ON equipments (status);

-- ===== 4. notifications — 应用内通知（P0：仅 App 内通知，无外部推送）=====
-- 业务文档 §101.27 Notification / 安卓本地 schema.notifications
CREATE TABLE notifications (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id          BIGINT,                    -- 可空：系统级通知无项目
    recipient_id        BIGINT       NOT NULL,     -- 接收用户 ID
    title               VARCHAR(255) NOT NULL,
    content             TEXT,
    -- 通知类型：日报退回 / 审批结果 / 任务派发 / 重大问题 / 系统公告 ...
    notification_type   VARCHAR(64)  NOT NULL,
    is_read             BOOLEAN      NOT NULL DEFAULT FALSE,
    received_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    read_at             TIMESTAMPTZ,
    -- 关联业务实体（用于点击跳转）
    related_entity_type VARCHAR(64),               -- daily_report | project_issue | inspection_task ...
    related_entity_id   BIGINT,
    server_seq          BIGINT       NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by          BIGINT,
    updated_by          BIGINT,
    CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_project   FOREIGN KEY (project_id)   REFERENCES projects (id) ON DELETE CASCADE
);
COMMENT ON TABLE  notifications IS '应用内通知表（§101.27，P0 仅 App 内通知）';
COMMENT ON COLUMN notifications.notification_type IS '通知类型：日报退回/审批结果/任务派发/重大问题/系统公告';
COMMENT ON COLUMN notifications.is_read IS '是否已读';
COMMENT ON COLUMN notifications.related_entity_type IS '关联业务实体类型，用于点击跳转';

CREATE INDEX idx_notifications_recipient   ON notifications (recipient_id);
CREATE INDEX idx_notifications_project     ON notifications (project_id);
CREATE INDEX idx_notifications_type        ON notifications (notification_type);
CREATE INDEX idx_notifications_is_read     ON notifications (recipient_id, is_read);
CREATE INDEX idx_notifications_received_at ON notifications (received_at);

-- ===== 5. edit_locks — 编辑锁（防止并发编辑，§101.20 / DD-8）=====
-- 用于日报等资源的悲观锁：同一资源同时只能有一个客户端编辑
CREATE TABLE edit_locks (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id        BIGINT       NOT NULL,
    -- 被锁定的资源类型与 ID（如 daily_report + report_id）
    resource_type     VARCHAR(64)  NOT NULL,      -- daily_report | inspection_task ...
    resource_id       BIGINT       NOT NULL,
    locked_by_user_id BIGINT       NOT NULL,      -- 持锁用户
    lock_token        VARCHAR(64)  NOT NULL,      -- 锁令牌（UUID，客户端续锁/释放时携带）
    acquired_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    -- 锁过期时间（§101.20）：超过此时间未续锁，视为自动释放
    expires_at        TIMESTAMPTZ  NOT NULL,
    server_seq        BIGINT       NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by        BIGINT,
    updated_by        BIGINT,
    -- 同一资源同时只能有一把有效锁（数据库层强约束）
    CONSTRAINT uk_edit_locks_resource UNIQUE (resource_type, resource_id),
    CONSTRAINT fk_edit_locks_user FOREIGN KEY (locked_by_user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_edit_locks_proj FOREIGN KEY (project_id)         REFERENCES projects (id) ON DELETE CASCADE
);
COMMENT ON TABLE  edit_locks IS '编辑锁表（§101.20 / DD-8，防止日报等资源并发编辑）';
COMMENT ON COLUMN edit_locks.resource_type   IS '被锁定的资源类型（daily_report 等）';
COMMENT ON COLUMN edit_locks.lock_token      IS '锁令牌 UUID，客户端续锁/释放时携带';
COMMENT ON COLUMN edit_locks.expires_at      IS '锁过期时间，超时未续锁视为自动释放（§101.20）';

CREATE INDEX idx_edit_locks_resource   ON edit_locks (resource_type, resource_id);
CREATE INDEX idx_edit_locks_user       ON edit_locks (locked_by_user_id);
CREATE INDEX idx_edit_locks_expires_at ON edit_locks (expires_at);

-- ===== 6. major_issue_notification_records — 重大问题通知记录（§101.23）=====
-- 记录重大（重大级别）问题触发通知的发送情况，用于审计与重试
CREATE TABLE major_issue_notification_records (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id              BIGINT       NOT NULL,
    daily_report_issue_id   BIGINT,                -- 触发通知的日报问题（V5 daily_report_issues 表建立后补充外键）
    project_issue_id        BIGINT,                -- 关联的项目问题池记录（V5/V6 建立后补充外键）
    recipient_id            BIGINT       NOT NULL, -- 接收人
    -- 通知渠道：IN_APP 应用内 / SMS 短信 / EMAIL 邮件（V1 仅 IN_APP）
    notification_channel    VARCHAR(32)  NOT NULL DEFAULT 'IN_APP',
    severity                VARCHAR(32)  NOT NULL, -- 问题严重程度快照：一般/较大/重大
    -- 发送状态：PENDING 待发 / SENT 已发 / FAILED 失败 / ACKED 已确认
    send_status             VARCHAR(32)  NOT NULL DEFAULT 'PENDING',
    sent_at                 TIMESTAMPTZ,
    acked_at                TIMESTAMPTZ,
    failure_reason          TEXT,
    server_seq              BIGINT       NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by              BIGINT,
    updated_by              BIGINT,
    CONSTRAINT chk_majnoti_channel CHECK (
        notification_channel IN ('IN_APP', 'SMS', 'EMAIL')
    ),
    CONSTRAINT chk_majnoti_status CHECK (
        send_status IN ('PENDING', 'SENT', 'FAILED', 'ACKED')
    ),
    CONSTRAINT fk_majnoti_recipient FOREIGN KEY (recipient_id) REFERENCES users (id)        ON DELETE CASCADE,
    CONSTRAINT fk_majnoti_project   FOREIGN KEY (project_id)   REFERENCES projects (id)    ON DELETE CASCADE
);
COMMENT ON TABLE  major_issue_notification_records IS '重大问题通知记录表（§101.23）';
COMMENT ON COLUMN major_issue_notification_records.notification_channel IS '通知渠道：IN_APP/SMS/EMAIL（V1 仅 IN_APP）';
COMMENT ON COLUMN major_issue_notification_records.send_status IS '发送状态：PENDING/SENT/FAILED/ACKED';

CREATE INDEX idx_majnoti_project  ON major_issue_notification_records (project_id);
CREATE INDEX idx_majnoti_issue    ON major_issue_notification_records (daily_report_issue_id);
CREATE INDEX idx_majnoti_recipient ON major_issue_notification_records (recipient_id);
CREATE INDEX idx_majnoti_status   ON major_issue_notification_records (send_status);

-- ===== 7. sync_batches — 同步批次（推送幂等，§6.3 / §101.28 SyncBatch）=====
-- 每次 push 携带 client_batch_uuid，服务端据此去重：同一 batch_uuid 重复提交直接返回原结果
CREATE TABLE sync_batches (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_batch_uuid  VARCHAR(64)  NOT NULL,     -- 客户端生成的批次 UUID（幂等键）
    user_id            BIGINT       NOT NULL,     -- 推送用户
    device_id          VARCHAR(128),              -- 推送设备标识
    project_id         BIGINT       NOT NULL,
    -- 批次状态：RECEIVED 已接收 / SUCCESS 成功 / PARTIAL 部分成功 / CONFLICT 存在冲突 / FAILED 失败
    status             VARCHAR(32)  NOT NULL DEFAULT 'RECEIVED',
    base_server_seq    BIGINT       NOT NULL DEFAULT 0,  -- push 时客户端携带的基线 seq（冲突检测，§6.5）
    server_seq_after   BIGINT       NOT NULL DEFAULT 0,  -- 本次推送完成后服务端的最新 seq
    record_count       INT          NOT NULL DEFAULT 0,  -- 本批次包含的变更记录总数
    conflict_count     INT          NOT NULL DEFAULT 0,  -- 本批次检测到的冲突数
    error_detail       TEXT,                           -- 失败时的错误明细
    processed_at       TIMESTAMPTZ,                    -- 服务端处理完成时间
    server_seq         BIGINT       NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by         BIGINT,
    updated_by         BIGINT,
    -- client_batch_uuid 全局唯一：同一批次重复提交直接命中已有记录（幂等）
    CONSTRAINT uk_sync_batches_client_uuid UNIQUE (client_batch_uuid),
    CONSTRAINT chk_sync_batches_status CHECK (
        status IN ('RECEIVED', 'SUCCESS', 'PARTIAL', 'CONFLICT', 'FAILED')
    ),
    CONSTRAINT fk_sync_batches_user    FOREIGN KEY (user_id)    REFERENCES users (id)    ON DELETE CASCADE,
    CONSTRAINT fk_sync_batches_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);
COMMENT ON TABLE  sync_batches IS '同步批次表（§6.3 / §101.28，推送幂等去重）';
COMMENT ON COLUMN sync_batches.client_batch_uuid IS '客户端生成的批次 UUID，幂等键（§6.3）';
COMMENT ON COLUMN sync_batches.base_server_seq   IS 'push 时客户端携带的基线 seq，冲突检测用（§6.5）';
COMMENT ON COLUMN sync_batches.server_seq_after   IS '本次推送完成后服务端最新 seq';

CREATE INDEX idx_sync_batches_user    ON sync_batches (user_id);
CREATE INDEX idx_sync_batches_project ON sync_batches (project_id);
CREATE INDEX idx_sync_batches_status  ON sync_batches (status);

-- ===== 8. client_sync_states — 客户端同步状态（§6.1 / §101.28 ClientSyncState）=====
-- 每个用户+设备+项目 维护一份 last_server_seq，作为增量拉取游标
CREATE TABLE client_sync_states (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id            BIGINT       NOT NULL,
    device_id          VARCHAR(128) NOT NULL,
    project_id         BIGINT       NOT NULL,
    last_server_seq    BIGINT       NOT NULL DEFAULT 0,  -- 增量拉取游标（§6.2）
    last_push_batch_id BIGINT,                           -- 最近一次成功推送的 sync_batches.id
    last_synced_at     TIMESTAMPTZ,                      -- 最近一次成功同步（pull+push）时间
    server_seq         BIGINT       NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by         BIGINT,
    updated_by         BIGINT,
    -- 每个用户+设备+项目 仅一份同步状态
    CONSTRAINT uk_client_sync_state UNIQUE (user_id, device_id, project_id),
    CONSTRAINT fk_client_sync_state_user    FOREIGN KEY (user_id)    REFERENCES users (id)    ON DELETE CASCADE,
    CONSTRAINT fk_client_sync_state_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);
COMMENT ON TABLE  client_sync_states IS '客户端同步状态表（§6.1 / §101.28，维护增量拉取游标 last_server_seq）';
COMMENT ON COLUMN client_sync_states.last_server_seq IS '增量拉取游标，pull 时 since=last_server_seq（§6.2）';
COMMENT ON COLUMN client_sync_states.last_push_batch_id IS '最近一次成功推送的 sync_batches.id';

CREATE INDEX idx_client_sync_state_user    ON client_sync_states (user_id);
CREATE INDEX idx_client_sync_state_project ON client_sync_states (project_id);
