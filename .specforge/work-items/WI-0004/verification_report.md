# Verification Report — WI-0004 (fj1 源码 bug 修复)

**Verifier:** sf-verifier  
**Verified at:** 2026-07-03T16:58Z  
**Workflow:** bugfix_spec / requirement_change_path  
**Conclusion:** ✅ **PASS** (7/7 AC + 5 extra checks passed)

---

## Summary

| Metric | Value |
|--------|-------|
| Acceptance Criteria | 7 |
| AC Passed | 7 |
| AC Failed | 0 |
| Extra checks | 5 |
| Extra passed | 5 |
| Test layers | L6 (regression, static) |
| L4 E2E | skipped (read-only env, no PG16 instance; defer to deployment) |

---

## Acceptance Criteria Results

| AC ID | Description | Status | Evidence |
|-------|-------------|--------|----------|
| AC-1 | application-prod.yml 不再含 spring.profiles.active | ✅ pass | grep 无匹配 (exit 1); YAML_VALID; line 6 spring: 保留, line 7 直接接 datasource:; systemd line 26 SPRING_PROFILES_ACTIVE=prod 保障激活 |
| AC-2 | V3 在 ADD CONSTRAINT 前插入系统占位项目 | ✅ pass | V3 line 225 INSERT INTO projects; line 227 OVERRIDING SYSTEM VALUE; line 230 ADD CONSTRAINT fk_upr_project. 顺序 225<230 正确 |
| AC-3 | V8 export_files 补列 + file_hash 扩展 | ✅ pass | V8 line 7 error_message VARCHAR(1024); line 8 export_status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS'; line 11 file_hash TYPE VARCHAR(128). 3 处齐全 |
| AC-4 | V8 users.status 类型修正 + 幂等设计 | ✅ pass | V8 line 23 data_type='smallint' 条件; line 25 ALTER COLUMN status TYPE INTEGER USING status::INTEGER (DO 块内). 幂等正确 |
| AC-5 | install_pg16.sh 修正 | ✅ pass | bash -n SYNTAX_OK; line 25 postgresql13-server; line 143 postgresql-16-setup initdb; 旧 postgresql-server/--initdb 均无匹配 |
| AC-6 | ddl-auto 源码层面是 validate | ✅ pass | application-prod.yml line 26 ddl-auto: validate (源码正确; svr-lg 运行时曾被临时改为 none, 源码保持 validate) |
| AC-7 | 注释修正 + 编译代码未变 | ✅ pass | UserStatusConverter.java/UserStatus.java 无 SMALLINT 残留; git diff 仅 2 行注释变更 (均以 * 开头); 零运行时代码变更 |

---

## Extra Checks

| Check | Result |
|-------|--------|
| Flyway 迁移链连续性 | ✅ V1-V8 连续无缺口 |
| systemd profile 激活保障 | ✅ fj-api.service line 26 Environment="SPRING_PROFILES_ACTIVE=prod" |
| V8 export_status 非 INTEGER 确认 | ✅ VARCHAR(32) String (修正 intake.md 错误描述) |
| application-prod.yml 结构完整性 | ✅ spring: + datasource:/flyway:/jpa: 配置完整保留 |
| git diff 编译代码未变 (TASK-3) | ✅ 仅 2 行注释变更 |

---

## Detailed Verification Commands

### AC-1: application-prod.yml
- `grep -n 'spring.profiles.active|profiles:|active:' application-prod.yml` → exit 1 (无匹配)
- `python3 -c "import yaml; yaml.safe_load(...)"` → YAML_VALID
- `grep 'SPRING_PROFILES_ACTIVE' deploy/systemd/fj-api.service` → line 26 存在

### AC-2: V3 系统占位项目
- `grep -n 'INSERT INTO projects|ADD CONSTRAINT fk_upr_project' V3.sql` → INSERT@225 < ADD_CONSTRAINT@230
- `grep -c 'OVERRIDING SYSTEM VALUE' V3.sql` → 1

### AC-3: V8 export_files 补列
- `grep -c 'ADD COLUMN IF NOT EXISTS error_message|...export_status|...file_hash TYPE VARCHAR(128)' V8.sql` → 3

### AC-4: V8 users.status
- `grep -c 'ALTER COLUMN status TYPE INTEGER|data_type = smallint' V8.sql` → 2

### AC-5: install_pg16.sh
- `bash -n install_pg16.sh` → SYNTAX_OK
- `grep 'postgresql-server'` → exit 1
- `grep 'postgresql13-server'` → line 25
- `grep 'postgresql-16-setup initdb'` → line 143
- `grep '\-\-initdb'` → exit 1

### AC-6: ddl-auto
- `grep 'ddl-auto' application-prod.yml` → line 26 validate

### AC-7: 注释修正
- `grep -in 'smallint' UserStatusConverter.java` → exit 1
- `grep -in 'smallint' UserStatus.java` → exit 1
- `git diff --unified=0 UserStatus*.java` → 仅 2 行注释变更

---

## L4 E2E Limitation

本次验证为只读静态检查，未在干净 PG16 实例上实际执行 V1-V8 全链迁移。原因：
1. 只读验证 Agent 无权启动数据库服务
2. 当前验证环境无可用 PG16 实例
3. tasks.md 的 verification_commands 全部为静态检查命令

**建议：** 部署前在干净 PG16 + CentOS/RHEL + PGDG 环境上执行端到端迁移测试 + ddl-auto=validate 启动测试，最终确认 AC-2/AC-6 运行时正确性。

---

## Bug-2 Forward-Compatible Trade-off

修改 V3 改变文件 checksum，svr-lg 升级需执行一次性 `flyway repair` 同步 checksum。这是 Bug-2 技术本质决定的（V8 无法修复迁移链断裂），属已接受 trade-off，非验证失败。详见 requirements.md/design.md。

---

## Side Effects

无副作用。验证过程仅执行只读操作（grep/read/git diff/python yaml 解析/bash -n 语法检查）。未修改任何文件，未启动服务，未执行数据库操作。