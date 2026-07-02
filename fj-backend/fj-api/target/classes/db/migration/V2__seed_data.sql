-- =====================================================================
-- V2__seed_data.sql
-- 飞检现场管理系统 — 种子数据（默认角色 / 权限 / 字典 / 管理员账号）
-- 目标数据库：PostgreSQL 16
-- 依赖：V1__base_tables.sql 已建表（users / roles / permissions /
--       role_permissions / data_dictionaries）
-- 约定：
--   - 主键为 GENERATED ALWAYS AS IDENTITY，不显式写 id，由数据库分配
--   - 角色 / 权限通过唯一 code 在 role_permissions 子查询中关联
--   - 管理员密码为 BCrypt(cost=12) 哈希，明文为 admin123（仅初始化用，上线后应改密）
-- =====================================================================

-- ===== 1. 默认角色（4 个） =====
INSERT INTO roles (code, name, description) VALUES ('ROLE_SYS_ADMIN', '系统管理员', '拥有系统全部权限，负责用户/角色/权限/字典管理');
INSERT INTO roles (code, name, description) VALUES ('ROLE_PROJECT_LEADER', '项目负责人', '负责项目配置、日报监督、问题复核、报告生产');
INSERT INTO roles (code, name, description) VALUES ('ROLE_INSPECTOR', '检查人员', '现场检查、日报填写与提交');
INSERT INTO roles (code, name, description) VALUES ('ROLE_APPROVER', '审批人', '日报确认、问题复核、报告审批');

-- ===== 2. 默认权限（20 个，覆盖各模块 resource + action） =====
INSERT INTO permissions (code, name, resource, action, description) VALUES
    -- 用户管理
    ('user:create',         '创建用户', 'user',             'create', '新建用户账号'),
    ('user:read',           '查看用户', 'user',             'read',   '查看用户列表与详情'),
    ('user:update',         '编辑用户', 'user',             'update', '修改用户信息与状态'),
    ('user:delete',         '删除用户', 'user',             'delete', '禁用 / 删除用户'),
    -- 项目管理
    ('project:create',      '创建项目', 'project',          'create', '新建检查项目'),
    ('project:read',        '查看项目', 'project',          'read',   '查看项目列表与详情'),
    ('project:update',      '编辑项目', 'project',          'update', '修改项目配置'),
    ('project:delete',      '删除项目', 'project',          'delete', '归档 / 删除项目'),
    -- 检查任务
    ('inspection_task:create', '派发任务', 'inspection_task', 'create', '派发检查任务'),
    ('inspection_task:read',   '查看任务', 'inspection_task', 'read',   '查看任务列表与详情'),
    ('inspection_task:update', '编辑任务', 'inspection_task', 'update', '修改任务状态与指派'),
    -- 日报
    ('daily_report:create', '创建日报', 'daily_report',     'create', '新建 / 保存日报草稿'),
    ('daily_report:read',   '查看日报', 'daily_report',     'read',   '查看日报列表与详情'),
    ('daily_report:submit', '提交日报', 'daily_report',     'submit', '提交日报进入审批'),
    -- 问题池
    ('issue:read',          '查看问题', 'issue',            'read',   '查看项目问题池'),
    ('issue:review',        '复核问题', 'issue',            'review', '问题复核与状态流转'),
    -- 报告
    ('report:create',       '创建报告', 'report',           'create', '新建报告草稿'),
    ('report:read',         '查看报告', 'report',           'read',   '查看报告列表与详情'),
    ('report:approve',      '审批报告', 'report',           'approve', '审批 / 确认报告'),
    ('report:publish',      '发布报告', 'report',           'publish', '发布固化报告');

-- ===== 3. 角色-权限关联 =====
-- 系统管理员：全部权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'ROLE_SYS_ADMIN';

-- 项目负责人：project:* + daily_report:* + issue:* + report:*
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ROLE_PROJECT_LEADER'
  AND p.code IN (
      'project:create', 'project:read', 'project:update', 'project:delete',
      'daily_report:create', 'daily_report:read', 'daily_report:submit',
      'issue:read', 'issue:review',
      'report:create', 'report:read', 'report:approve', 'report:publish'
  );

-- 检查人员：inspection_task:read + daily_report:create/read/submit
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ROLE_INSPECTOR'
  AND p.code IN (
      'inspection_task:read',
      'daily_report:create', 'daily_report:read', 'daily_report:submit'
  );

-- 审批人：daily_report:* + issue:read/review + report:read/approve
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ROLE_APPROVER'
  AND p.code IN (
      'daily_report:create', 'daily_report:read', 'daily_report:submit',
      'issue:read', 'issue:review',
      'report:read', 'report:approve'
  );

-- ===== 4. 数据字典（10 条，覆盖问题等级 / 照片类型 / 同步状态） =====
INSERT INTO data_dictionaries (category, code, value, sort_order) VALUES
    -- 问题严重等级
    ('issue_severity', 'general', '一般', 1),
    ('issue_severity', 'major',   '较大', 2),
    ('issue_severity', 'critical','重大', 3),
    -- 照片类型
    ('photo_type', 'panorama',  '全景',     1),
    ('photo_type', 'detail',    '细节',     2),
    ('photo_type', 'overview',  '概貌',     3),
    ('photo_type', 'rectified', '整改后',   4),
    -- 同步状态
    ('sync_status', 'synced',       '已同步',     1),
    ('sync_status', 'pending_push', '待推送',     2),
    ('sync_status', 'conflict',     '同步冲突',   3);

-- ===== 5. 默认管理员账号 =====
-- 密码明文：admin123（BCrypt cost=12 哈希，上线后务必修改）
INSERT INTO users (username, password_hash, real_name, phone, email, status) VALUES
    ('admin', '$2b$12$jcLWioY/WRH23Pe6KiVvFeh3N5ovrHbFZqZxzCb5nDco.C2I3swZy', '系统管理员', NULL, NULL, 1);

-- ===== 6. 授予管理员系统管理员角色（全局角色，project_id 占位 0 表示非项目级） =====
INSERT INTO user_project_roles (user_id, project_id, role_id)
SELECT u.id, 0, r.id FROM users u, roles r
WHERE u.username = 'admin' AND r.code = 'ROLE_SYS_ADMIN';
