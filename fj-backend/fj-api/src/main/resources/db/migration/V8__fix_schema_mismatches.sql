-- WI-0004 V8: 修复 schema 与 JPA 实体不匹配问题
-- 覆盖 Bug-3 (export_files 缺列 + file_hash 长度), Bug-4 (users.status 类型)
-- 幂等设计：ADD COLUMN IF NOT EXISTS + DO 块条件判断，兼容 svr-lg 已手动修补的状态

-- ===== Bug-3: export_files 表补缺列 + file_hash 长度扩展 =====
-- ExportFile.java 实体声明: error_message (length=1024), export_status (String, 默认 "SUCCESS"), file_hash (length=128)
ALTER TABLE export_files ADD COLUMN IF NOT EXISTS error_message VARCHAR(1024);
ALTER TABLE export_files ADD COLUMN IF NOT EXISTS export_status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS';
-- 注意: 如果 svr-lg 上 export_status 列已存在且允许 NULL，ADD COLUMN IF NOT EXISTS 会跳过；
-- 对于全新库，NOT NULL DEFAULT 'SUCCESS' 确保非空。
ALTER TABLE export_files ALTER COLUMN file_hash TYPE VARCHAR(128);

-- ===== Bug-4: users.status 列类型 SMALLINT → INTEGER =====
-- UserStatusConverter 泛型为 AttributeConverter<UserStatus, Integer>，期望 int4
-- svr-lg 已手动 ALTER 为 integer，DO 块条件判断跳过；全新库上 smallint → integer
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'status'
          AND data_type = 'smallint'
    ) THEN
        ALTER TABLE users ALTER COLUMN status TYPE INTEGER USING status::INTEGER;
    END IF;
END $$;
