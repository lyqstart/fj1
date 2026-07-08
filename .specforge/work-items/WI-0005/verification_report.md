# Verification Report — WI-0005 (svr-lg 同步 WI-0004 修复)

**Verifier:** sf-verifier + sf-executor (supplementary fix)
**Verified at:** 2026-07-04T02:05Z
**Workflow:** ops_task / task_change_path
**Conclusion:** ✅ **PASS** (7/7 AC passed)

---

## Summary

| Metric | Value |
|--------|-------|
| Acceptance Criteria | 7 |
| AC Passed | 7 |
| AC Failed | 0 |
| Downtime | ~2.5 minutes (01:55:56 → 01:58:30) |
| Data loss | None |

---

## Acceptance Criteria Results

| AC ID | Description | Status | Evidence |
|-------|-------------|--------|----------|
| AC-1 | Flyway V1-V8 success=t + validate 通过 | ✅ pass | 8 行 success=t; flyway validate "Successfully validated 8 migrations" |
| AC-2 | ddl-auto=validate 启动成功 | ✅ pass | fj1-api active; yml ddl-auto: validate; NO_SCHEMA_ERROR |
| AC-3 | health=UP (经 Nginx) | ✅ pass | curl 10.0.12.12/api/actuator/health = {"status":"UP"} |
| AC-4 | 前端 HTTP 200 | ✅ pass | HTTP/1.1 200 OK; SPA_OK (id=root) |
| AC-5 | 内存 ≥500MB, 无 OOM | ✅ pass | available=1856MB; NO_OOM |
| AC-6 | 日志无 error/exception | ✅ pass | 0 真实 ERROR (仅 Flyway 幂等 WARN 42701) |
| AC-7 | 数据完整 + schema 修复 | ✅ pass | projects=1, users=1, upr=1; export_status length=32 NOT NULL; file_hash=128; 占位项目 name=系统占位项目 |

---

## Operations Performed

| Phase | Description | Result |
|-------|-------------|--------|
| A | 四重备份 (pg_dump + jar + yml + flyway_history) | ✅ |
| B | V1-V8 迁移目录组装 | ✅ |
| C | Flyway CLI 9.22.3 安装 (Maven Central) | ✅ |
| D | flyway repair (V3 checksum 同步) + export_status NOT NULL | ✅ |
| E | 停机 + zip 修补 jar (V3+V8) + yml (ddl-auto→validate) | ✅ |
| F | 启动 + Flyway 自动 migrate V8 (file_hash 64→128) | ✅ |
| Supp | export_status length 1024→32 + 占位项目 name 修正 | ✅ |

---

## Side Effects

- export_files.export_status: VARCHAR(1024) → VARCHAR(32), NOT NULL DEFAULT 'SUCCESS'
- export_files.file_hash: VARCHAR(64) → VARCHAR(128)
- flyway_schema_history: V3 checksum 更新 (-746969479), V8 记录新增
- projects.id=0: name='SYSTEM' → '系统占位项目'
- application-prod.yml: ddl-auto none → validate
- jar: V3 更新 + V8 添加 (via zip)
- 服务停机 ~2.5 分钟, 无数据丢失