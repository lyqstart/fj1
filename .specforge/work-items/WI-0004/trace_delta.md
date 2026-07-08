# Trace Delta — WI-0004

> Work Item: WI-0004 (fj1 源码 bug 修复)
> Workflow Type: bugfix_spec
> 生成者: sf-task-planner
> 标准: V7 Candidate Completeness Governance（REQ → AC → DD → TASK → FILE → TEST/VERIFICATION）

---

## 一、需求 → 验收标准

| REQ ID | 描述 | AC ID |
|--------|------|-------|
| REQ-Bug1 | application-prod.yml 不应包含 spring.profiles.active（Spring Boot 2.4+ 违规） | AC-1 |
| REQ-Bug2 | V2 种子数据在 V3 FK 建立前引用 project_id=0，导致 ADD CONSTRAINT FK 违规 | AC-2, AC-7 |
| REQ-Bug3 | V7 export_files 表缺 error_message/export_status 列 + file_hash 长度不匹配 | AC-3, AC-6 |
| REQ-Bug4 | users.status 列类型 smallint 与 UserStatusConverter Integer 泛型不匹配 | AC-4, AC-6 |
| REQ-Bug5 | install_pg16.sh PG13 包名错误 + initdb 参数错误 | AC-5 |
| 发现-3 | UserStatusConverter / UserStatus 注释与实现矛盾（SMALLINT vs Integer） | （REQ-Bug4 附加，无独立 AC） |

---

## 二、验收标准 → 设计决策

| AC ID | AC 描述（精简） | DD ID | DD 描述 |
|-------|-----------------|-------|---------|
| AC-1 | application-prod.yml SHALL NOT 包含 spring.profiles.active 键 | DD-1 | 删除 yml 中 spring.profiles.active，profile 由 systemd 环境变量控制 |
| AC-2 | Flyway 在全新空库执行 V1-V8 全链迁移 SHALL 一次性成功无 FK 违规 | DD-2 | V3 ADD CONSTRAINT 前插入系统占位项目 projects(id=0)（方案 B） |
| AC-3 | export_files SHALL 含 error_message VARCHAR(1024) + export_status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS' | DD-3 | 新增 V8 迁移 ADD COLUMN IF NOT EXISTS 补列 |
| AC-4 | users.status SHALL 为 INTEGER（int4），与 UserStatusConverter Integer 泛型一致 | DD-3 + DD-4 | V8 条件 ALTER COLUMN TYPE INTEGER（DD-3）+ 注释同步 SMALLINT→INTEGER（DD-4） |
| AC-5 | install_pg16.sh 在干净 CentOS/RHEL+PGDG 上 SHALL 正确初始化 PG16 并检测/卸载 PG13 | DD-5 | 修正 PG13_PACKAGES=postgresql13-server + initdb 位置参数 |
| AC-6 | ddl-auto=validate 时应用 SHALL 正常启动无 Schema-validation 错误 | DD-3 | V8 修复 export_files 缺列/file_hash 长度 + users.status 类型后 schema 与实体一致 |
| AC-7 | 修复 SHALL NOT 破坏 svr-lg（V1-V7 记录不删；V8 为附加；Bug-2 需 flyway repair） | DD-2 + DD-3 | V8 幂等（IF NOT EXISTS + DO 条件块）；V3 checksum 变化属已知 trade-off |

---

## 三、设计决策 → 任务

| DD ID | DD 描述 | TASK ID | TASK 描述 |
|-------|---------|---------|-----------|
| DD-1 | application-prod.yml 移除 spring.profiles.active | TASK-1 | 删除 yml 第 7-8 行 profiles 键 |
| DD-2 | V3 插入系统占位项目 projects(id=0)（方案 B） | TASK-4 | V3 ADD CONSTRAINT 前插入 INSERT ... OVERRIDING SYSTEM VALUE |
| DD-3 | 新增 V8 迁移修复 export_files + users.status schema | TASK-5 | 新建 V8__fix_schema_mismatches.sql（4 条幂等 SQL） |
| DD-4 | UserStatusConverter / UserStatus 注释 SMALLINT→INTEGER | TASK-3 | 更新 2 处注释（零运行时风险） |
| DD-5 | install_pg16.sh PG13 包名 + initdb 参数修正 | TASK-2 | 修正第 25 行 + 第 143 行 |

---

## 四、任务 → 文件

| TASK ID | FILE（相对项目根） | 操作 | 涉及 REQ | 涉及 DD |
|---------|-------------------|------|----------|---------|
| TASK-1 | deploy/config/application-prod.yml | modify（删除第 7-8 行） | REQ-Bug1 | DD-1 |
| TASK-2 | scripts/ops/install_pg16.sh | modify（第 25 行 + 第 143 行） | REQ-Bug5 | DD-5 |
| TASK-3 | fj-backend/fj-system/src/main/java/com/fj/system/entity/UserStatusConverter.java | modify（第 8 行注释） | REQ-Bug4 / 发现-3 | DD-4 |
| TASK-3 | fj-backend/fj-system/src/main/java/com/fj/system/entity/UserStatus.java | modify（第 7 行注释） | REQ-Bug4 / 发现-3 | DD-4 |
| TASK-4 | fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql | modify（第 221 行后新增 INSERT 段） | REQ-Bug2 | DD-2 |
| TASK-5 | fj-backend/fj-api/src/main/resources/db/migration/V8__fix_schema_mismatches.sql | **create**（新建迁移文件） | REQ-Bug3, REQ-Bug4 | DD-3 |

### 文件覆盖完整性

| 文件 | 角色 | 修改类型 | 验证只读目标（不改） |
|------|------|----------|---------------------|
| deploy/config/application-prod.yml | 生产配置 | modify | — |
| scripts/ops/install_pg16.sh | 运维脚本 | modify | — |
| UserStatusConverter.java | JPA Converter 注释 | modify | — |
| UserStatus.java | 枚举注释 | modify | — |
| V3__project_tables.sql | Flyway 迁移 | modify | — |
| V8__fix_schema_mismatches.sql | Flyway 迁移 | create | — |
| deploy/systemd/fj-api.service | systemd unit | **不修改**（已正确，TASK-1 只读验证） | ✅ 第 26 行已有 SPRING_PROFILES_ACTIVE=prod |
| ExportFile.java | JPA 实体 | **不修改**（实体声明已正确，DB 落后） | ✅ |
| V1/V2/V4/V5/V6/V7 迁移 | Flyway 迁移 | **不修改**（forward-compatible 原则） | ✅ |

---

## 五、任务 → 测试 / 验证命令

| TASK ID | 验证方式（verification_command） | 期望结果 | 对应 AC |
|---------|----------------------------------|----------|---------|
| TASK-1 | `! grep -q 'spring.profiles.active' deploy/config/application-prod.yml` | exit_code=0（键已删除） | AC-1 |
| TASK-1 | `! grep -qE '^[[:space:]]*profiles:' deploy/config/application-prod.yml` | exit_code=0（profiles 键已删除） | AC-1 |
| TASK-1 | `grep -q 'datasource:' deploy/config/application-prod.yml` | exit_code=0（其余配置完好） | AC-1 |
| TASK-1 | `grep -q 'SPRING_PROFILES_ACTIVE=prod' deploy/systemd/fj-api.service` | exit_code=0（profile 激活有保障） | AC-1 |
| TASK-2 | `bash -n scripts/ops/install_pg16.sh` | exit_code=0（语法正确） | AC-5 |
| TASK-2 | `grep -q 'PG13_PACKAGES="postgresql13-server"' scripts/ops/install_pg16.sh` | exit_code=0（PG13 包名修正） | AC-5 |
| TASK-2 | `grep -q 'postgresql-16-setup initdb' scripts/ops/install_pg16.sh` | exit_code=0（initdb 参数修正） | AC-5 |
| TASK-2 | `! grep -q 'postgresql-16-setup --initdb' scripts/ops/install_pg16.sh` | exit_code=0（旧错误消除） | AC-5 |
| TASK-3 | `grep -q 'UserStatus <-> INTEGER' .../UserStatusConverter.java` | exit_code=0（注释已改） | AC-4 |
| TASK-3 | `! grep -q 'SMALLINT' .../UserStatusConverter.java` | exit_code=0（无残留 SMALLINT） | AC-4 |
| TASK-3 | `grep -q 'users.status INTEGER' .../UserStatus.java` | exit_code=0（注释已改） | AC-4 |
| TASK-3 | `! grep -q 'SMALLINT' .../UserStatus.java` | exit_code=0（无残留） | AC-4 |
| TASK-3 | `grep -q 'AttributeConverter<UserStatus, Integer>' .../UserStatusConverter.java` | exit_code=0（泛型未被破坏） | AC-4 |
| TASK-4 | `grep -q 'OVERRIDING SYSTEM VALUE' .../V3__project_tables.sql` | exit_code=0（OVERRIDING 子句存在） | AC-2 |
| TASK-4 | `grep -q "VALUES (0, '系统占位项目', 'SYSTEM', 'ARCHIVED'" .../V3__project_tables.sql` | exit_code=0（INSERT 值正确） | AC-2 |
| TASK-4 | `awk '/INSERT INTO projects.*OVERRIDING/{a=NR} /ADD CONSTRAINT fk_upr_project/{b=NR} END{exit !(a<b)}' .../V3.sql` | exit_code=0（INSERT 在 ADD CONSTRAINT 前） | AC-2 |
| TASK-4 | `grep -q 'ADD CONSTRAINT fk_upr_project FOREIGN KEY (project_id) REFERENCES projects (id)' .../V3.sql` | exit_code=0（原 FK 约束保留） | AC-2 |
| TASK-5 | `test -f .../V8__fix_schema_mismatches.sql` | exit_code=0（文件已创建） | AC-3, AC-4 |
| TASK-5 | `grep -q 'ADD COLUMN IF NOT EXISTS error_message VARCHAR(1024)' V8.sql` | exit_code=0（error_message 补列） | AC-3 |
| TASK-5 | `grep -q 'ADD COLUMN IF NOT EXISTS export_status VARCHAR(32) NOT NULL DEFAULT' V8.sql` | exit_code=0（export_status 补列） | AC-3 |
| TASK-5 | `grep -q 'ALTER COLUMN file_hash TYPE VARCHAR(128)' V8.sql` | exit_code=0（file_hash 扩展） | AC-3 |
| TASK-5 | `grep -q 'ALTER TABLE users ALTER COLUMN status TYPE INTEGER USING status::INTEGER' V8.sql` | exit_code=0（status 改 INTEGER） | AC-4 |
| TASK-5 | `grep -q "data_type = 'smallint'" V8.sql` | exit_code=0（DO 块幂等条件） | AC-4, AC-7 |

### 集成验证（verification 阶段执行，非单个 task 内）

| 验证项 | 方式 | 对应 AC |
|--------|------|---------|
| 全新空库 V1-V8 全链迁移成功 | Docker PG16 + Flyway 全链执行，查询 flyway_schema_history 全 success=t | AC-2, AC-6 |
| projects(id=0) 存在 | `SELECT COUNT(*) FROM projects WHERE id=0` = 1 | AC-2 |
| admin 全局角色关联 | JOIN user_project_roles，project_id=0 + ROLE_SYS_ADMIN | AC-2 |
| export_files schema 完整 | information_schema.columns 查询含 error_message/export_status/file_hash(128) | AC-3 |
| users.status 类型 | information_schema.columns data_type='integer' | AC-4 |
| ddl-auto=validate 启动成功 | Spring Boot 启动无 Schema-validation 错误，health=UP | AC-6 |
| svr-lg 升级幂等 | flyway repair + V8 幂等执行，原有数据完整 | AC-7 |

---

## 六、覆盖统计

| 维度 | 统计 |
|------|------|
| 总 REQ 数 | 5（REQ-Bug1 ~ REQ-Bug5）+ 1 发现（发现-3） |
| 总 AC 数 | 7（AC-1 ~ AC-7） |
| 已覆盖 AC | **7/7（100%）** |
| 未覆盖 AC | **0** |
| 总 DD 数 | 5（DD-1 ~ DD-5） |
| DD 已关联 TASK | **5/5（100%）** |
| 无悬空 DD | ✅（每个 DD 至少关联一个 TASK） |
| 无悬空 TASK | ✅（每个 TASK 至少关联一个 REQ/DD） |
| 无悬空 REQ | ✅（每个 REQ 至少关联一个 AC + TASK） |
| 修改文件总数 | 6（5 modify + 1 create） |
| 新建文件 | 1（V8__fix_schema_mismatches.sql） |
| 不修改的只读验证目标 | 3（systemd unit / ExportFile.java / V1-V7 除 V3） |

### AC → TASK 覆盖交叉验证

| AC | TASK-1 | TASK-2 | TASK-3 | TASK-4 | TASK-5 |
|----|--------|--------|--------|--------|--------|
| AC-1 | ✅ | | | | |
| AC-2 | | | | ✅ | ✅ |
| AC-3 | | | | | ✅ |
| AC-4 | | | ✅(注释) | | ✅ |
| AC-5 | | ✅ | | | |
| AC-6 | | | | | ✅ |
| AC-7 | | | | ✅ | ✅ |

**结论：所有 AC 均被至少一个 TASK 覆盖，无遗漏。**

---

## 七、依赖与执行顺序

```
批次1（并行）：
  TASK-1 (Bug-1 yml)     ── 独立
  TASK-2 (Bug-5 shell)   ── 独立
  TASK-3 (注释修正)       ── 独立

批次2（串行）：
  TASK-4 (Bug-2 V3)      ── 独立，但逻辑上先于 TASK-5
    └── TASK-5 (Bug-3/4 V8) ── depends_on: TASK-4
```

**串行依赖理由：** TASK-5 的 V8 迁移依赖迁移链完整性。若 TASK-4 未修复 V3 的 ADD CONSTRAINT 失败，迁移在 V3 中断，V8 永远不会被执行。文件层面两者无重叠（V3 vs V8 新文件），但 Flyway 执行语义上有强依赖。

**并行独立性验证（T4）：**
- TASK-1 改 deploy/config/application-prod.yml
- TASK-2 改 scripts/ops/install_pg16.sh
- TASK-3 改 fj-system/.../*.java
- 三者文件完全不重叠，无依赖关系 ✅
