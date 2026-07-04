-- =============================================================================
-- V9: 修复枚举值与 CHECK 约束/字段长度的不匹配（WI-0007）
-- 来源: WI-0006 全项目 @Entity schema-validate 审查
-- =============================================================================
-- 此迁移解决两类问题：
--   W2: project_issues.status CHECK 约束缺少 RECTIFIED/CLOSED/OVERDUE
--   W3: standard_recommendation_results.standard_library_version 长度不足（32→64）
--
-- 兼容性：forward-compatible
--   - CHECK 宽松化（5 值 → 8 值超集），不拒绝任何现有数据
--   - VARCHAR 扩展（32 → 64），不截断任何现有值
-- =============================================================================

-- W2: 扩展 project_issues.status CHECK 约束（5→8 值）
-- IssueStatus 枚举（IssueStatus.java）有 8 个值，IssueStatusService.TRANSITIONS 使用全部 8 值
-- V5 chk_pi_status 仅允许 5 个值，缺少 RECTIFIED/CLOSED/OVERDUE
-- 约束名确认: V5 L234 CONSTRAINT chk_pi_status
ALTER TABLE project_issues DROP CONSTRAINT IF EXISTS chk_pi_status;
ALTER TABLE project_issues ADD CONSTRAINT chk_pi_status CHECK (
    status IN ('VALID', 'PENDING_CONFIRM', 'RECTIFIED', 'CLOSED', 'OVERDUE',
               'SUSPENDED', 'VOIDED', 'CORRECTED')
);

-- W3: 扩展 standard_library_version 长度（32→64）
-- StandardRecommendationResult.java @Column(length=64)，V5 DDL 为 VARCHAR(32)
-- PG 12+ ALTER TYPE VARCHAR 是非锁表操作（仅更新元数据）
ALTER TABLE standard_recommendation_results
    ALTER COLUMN standard_library_version TYPE VARCHAR(64);
