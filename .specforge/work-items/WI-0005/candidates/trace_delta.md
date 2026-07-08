# Trace Delta — WI-0005

> Work Item: WI-0005 (svr-lg 同步 WI-0004 修复)
> Workflow Type: ops_task
> 来源: WI-0005 design.md (ops_plan) + intake.md
> 生成者: sf-task-planner

---

## 一、需求（操作目标）→ 验收标准

> ops_task 无传统 REQ 编号，操作目标（OBJ）从 intake.md/design.md「操作目标」段提取。

| OBJ ID | 操作目标描述 | 对应 AC |
|--------|-------------|---------|
| OBJ-1 | jar 内 V3 更新为修复版（含 `INSERT INTO projects (0)` 种子数据） | AC-1 |
| OBJ-2 | jar 内新增 V8 迁移文件（`V8__fix_schema_mismatches.sql`） | AC-1 |
| OBJ-3 | 外部 `application-prod.yml` 的 `ddl-auto` 恢复为 `validate` | AC-2 |
| OBJ-4 | `flyway_schema_history` V3 checksum 同步（via Flyway repair） | AC-1 |
| OBJ-5 | V8 迁移已应用（幂等：补列/扩展类型，大部分跳过） | AC-1 |
| OBJ-6 | fj1-api health=UP，ddl-auto=validate 启动成功 | AC-2, AC-3 |
| OBJ-7 | export_files schema 完整（export_status NOT NULL + file_hash varchar(128)） | AC-2 |
| OBJ-8 | 服务器数据完整（四重复份可回滚，无数据丢失） | AC-7 |

---

## 二、验收标准 → 操作阶段 → TASK

| AC ID | 验收标准 | 操作阶段 | TASK | 验证步骤 |
|-------|---------|----------|------|----------|
| AC-1 | flyway_schema_history V1-V8 全部 success=t，V3 checksum 已同步 | A (备份) + D (repair) + F (migrate) | TASK-1, TASK-4, TASK-6 | A4 导出 + D2 验证 + F3 count=8 |
| AC-2 | ddl-auto=validate 下 fj1-api 正常启动（无 Schema-validation 错误） | D (PreCheck) + E (yml) + F (启动) + G (验证) | TASK-4, TASK-5, TASK-6, TASK-7 | D-PreCheck + E3 + F1 + G1 |
| AC-3 | health=UP（经 Nginx 全链路） | F (启动) + G (验证) | TASK-6, TASK-7 | F2 + G2 |
| AC-4 | 前端页面 HTTP 200 | G (验证) | TASK-7 | G2 |
| AC-5 | 内存 ≥ 500MB，无 OOM | G (验证) | TASK-7 | G4 |
| AC-6 | 日志无 error/exception | G (验证) | TASK-7 | G4 |
| AC-7 | 服务器数据完整（无数据丢失） | A (备份) + 全程 | TASK-1（备份）+ 所有 task 的备份保留 | A1-A4 + H1 备份保留 |

---

## 三、操作阶段（设计决策 DD）→ TASK 覆盖

| 阶段 (DD) | 描述 | 步骤 | TASK | requires_user_confirmation |
|-----------|------|------|------|---------------------------|
| 阶段 A | 四重复份（DB/jar/yml/Flyway元数据） | A1-A4 | TASK-1 | false |
| 阶段 B | 准备迁移文件目录 V1-V8 | B1-B3 | TASK-2 | false |
| 阶段 C | 安装 Flyway CLI 9.22.3 | C1-C2 | TASK-3 | false |
| 阶段 D | D-PreCheck + Flyway repair（破坏性） | D-PreCheck, D1-D2 | TASK-4 | **true** |
| 阶段 E | 停机 + 修补 jar + 更新 yml | E1-E4 | TASK-5 | **true** |
| 阶段 F | 启动服务 + Flyway migrate V8 | F1-F3 | TASK-6 | false |
| 阶段 G | 最终全链路验证 | G1-G4 | TASK-7 | false |
| 阶段 H | 清理临时文件（可选） | H1 | TASK-8 | false |

**覆盖完整性**: 8 阶段 → 8 TASK，100% 覆盖，无悬空阶段。

---

## 四、TASK → 远程文件 → 验证方式

| TASK | 远程文件/目标 | 操作类型 | 涉及 OBJ | 涉及 AC | 验证方式 |
|------|--------------|----------|---------|---------|----------|
| TASK-1 | `svr-lg:/opt/fj1/api/backups/fj_inspect_WI0005_*.sql` | 创建（pg_dump） | OBJ-8 | AC-7 | `ls + wc -l` 文件存在+行数 |
| TASK-1 | `svr-lg:/opt/fj1/api/fj-api-1.0.0.jar.bak.WI0005` | 创建（cp） | OBJ-8 | AC-7 | `md5sum` 一致性校验 |
| TASK-1 | `svr-lg:/opt/fj1/api/application-prod.yml.bak.WI0005` | 创建（cp） | OBJ-8 | AC-7 | `test -f + grep ddl-auto` |
| TASK-1 | `svr-lg:/opt/fj1/api/backups/flyway_history_WI0005_*.csv` | 创建（COPY） | OBJ-4, OBJ-8 | AC-1, AC-7 | `head + wc -l` CSV 表头+行数 |
| TASK-2 | `svr-lg:/tmp/flyway-migrations/V1-V8__*.sql` | 创建（unzip+cp） | OBJ-1, OBJ-2 | AC-1 | `ls wc -l=8 + grep INSERT V3=1 + grep V8=1` |
| TASK-3 | `svr-lg:/opt/flyway-9.22.3/flyway` | 创建（下载+解压） | OBJ-4 | AC-1 | `flyway -v` 含 9.22.3 |
| TASK-3 | `svr-lg:/opt/flyway-9.22.3/conf/flyway.conf` | 创建（配置） | OBJ-4 | AC-1 | `grep url + locations` |
| TASK-4 | `svr-lg:flyway_schema_history (V3 checksum)` | 修改（UPDATE） | OBJ-4 | AC-1 | `count success=true=7 + V3 新旧 checksum 不同` |
| TASK-4 | `svr-lg:export_files (条件性 ALTER export_status)` | 条件修改 | OBJ-7 | AC-2 | `is_nullable=NO` |
| TASK-5 | `svr-lg:/opt/fj1/api/fj-api-1.0.0.jar` | 修改（zip 修补 V3+V8） | OBJ-1, OBJ-2 | AC-1 | `jar V3 INSERT=1 + jar V8 存在 + unzip -t OK` |
| TASK-5 | `svr-lg:/opt/fj1/api/application-prod.yml` | 修改（sed ddl-auto） | OBJ-3 | AC-2 | `grep ddl-auto: validate` |
| TASK-5 | `svr-lg:systemd fj-api` | 控制（stop） | — | — | `systemctl is-active=inactive` |
| TASK-6 | `svr-lg:flyway_schema_history (V8 记录)` | 新增（migrate） | OBJ-5 | AC-1 | `count success=true=8` |
| TASK-6 | `svr-lg:systemd fj-api` | 控制（start） | OBJ-6 | AC-2, AC-3 | `health=UP + systemctl active` |
| TASK-7 | （纯只读验证，无文件修改） | 只读 | OBJ-6, OBJ-7 | AC-2~AC-6 | `curl health + HTTP 200 + 内存 + 日志` |
| TASK-8 | `svr-lg:/tmp/flyway-migrations` 等 | 删除（清理） | — | — | `test ! -d + 备份保留 ≥4` |

---

## 五、本地源文件（只读，scp 源）

| 本地文件 | 用途 | 引用 TASK | 操作 |
|---------|------|-----------|------|
| `fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql` | WI-0004 修复版 V3（含 INSERT projects） | TASK-2 (B1 scp) | 只读 scp 源 |
| `fj-backend/fj-api/src/main/resources/db/migration/V8__fix_schema_mismatches.sql` | WI-0004 新建 V8（幂等迁移） | TASK-2 (B1 scp) | 只读 scp 源 |
| `deploy/config/application-prod.yml` | 修复版 yml 模板（参考） | — | 只读参考（本 WI 用 sed 修改服务器 yml，不直接 scp） |

---

## 六、文件覆盖统计

### 远程文件变更统计

| 操作类型 | 文件数 | 说明 |
|---------|--------|------|
| 创建（备份） | 4 | DB dump + jar bak + yml bak + flyway csv |
| 创建（临时） | ~12 | /tmp/flyway-migrations/V*.sql(8) + /tmp/V3/V8 + /tmp/jar-patch/* |
| 创建（安装） | ~50 | /opt/flyway-9.22.3/** (CLI) |
| 修改（数据库元数据） | 1 | flyway_schema_history V3 checksum (UPDATE) |
| 条件修改（schema） | 0-1 | export_files export_status (条件性 ALTER) |
| 修改（jar） | 1 | fj-api-1.0.0.jar (zip 修补 V3+V8) |
| 修改（配置） | 1 | application-prod.yml (sed ddl-auto) |
| 新增（migrate） | 1 | flyway_schema_history V8 记录 (INSERT) |
| 删除（清理） | ~12 | /tmp/* 临时文件 |
| **保留（备份）** | 4+ | .bak.WI0005 + backups/*WI0005*（7 天） |

### AC 覆盖统计

- 总 AC 数：**7**（AC-1 ~ AC-7）
- 已覆盖 AC：**7**（100%）
- 未覆盖 AC：**0**
- 每个 AC 至少有 1 个 TASK 验证 ✅

### OBJ 覆盖统计

- 总 OBJ 数：**8**（OBJ-1 ~ OBJ-8）
- 已覆盖 OBJ：**8**（100%）
- 未覆盖 OBJ：**0**

### 阶段覆盖统计

- 总阶段数：**8**（A ~ H）
- 已覆盖阶段：**8**（100%，TASK-1 ~ TASK-8）
- 无悬空阶段 ✅

---

## 七、追溯完整性自检

| # | 自检问题 | 答案 | 通过 |
|---|---------|------|------|
| 1 | 每个 OBJ 是否至少关联一个 AC？ | OBJ-1~8 全部映射到 AC | ✅ |
| 2 | 每个 AC 是否至少关联一个 TASK？ | AC-1~7 全部映射到 TASK | ✅ |
| 3 | 每个阶段（DD）是否至少关联一个 TASK？ | 阶段 A-H → TASK-1~8，100% | ✅ |
| 4 | 每个 TASK 是否有明确目标文件（远程）？ | 全部声明 remote_targets | ✅ |
| 5 | 每个目标文件是否有验证方式？ | 全部有 verification_commands | ✅ |
| 6 | trace_delta.md 是否真实写入？ | 本文件即为 trace_delta | ✅ |
| 7 | 有无悬空 OBJ（无 AC 映射）？ | 无 | ✅ |
| 8 | 有无悬空 AC（无 TASK 验证）？ | 无 | ✅ |
| 9 | 有无悬空阶段（无 TASK 覆盖）？ | 无 | ✅ |
| 10 | 有无悬空 TASK（无文件操作）？ | TASK-7 为纯只读验证（合理），其余全有文件操作 | ✅ |

---

## 八、TASK 依赖链

```
TASK-1 (A 备份) ─────────────────────────────────────────┐
  │                                                      │
  ▼                                                      │
TASK-2 (B 准备迁移文件) ──────────────────────┐          │
  │                                           │          │
  ▼                                           │          │
TASK-3 (C 安装 Flyway CLI) ──────┐            │          │
  │                              │            │          │
  ▼                              ▼            ▼          │
TASK-4 (D repair,破坏性) ◄── 需要 CLI + 迁移目录 + A4 CSV │
  │                                                      │
  ▼                                                      │
TASK-5 (E 停机+修补,停机窗口) ◄── 需要 repair 完成        │
  │                                                      │
  ▼                                                      │
TASK-6 (F 启动+migrate) ◄── 需要 jar 修补 + yml 更新     │
  │                                                      │
  ▼                                                      │
TASK-7 (G 最终验证) ◄── 需要 health=UP + V8 migrated     │
  │                                                      │
  ▼                                                      │
TASK-8 (H 清理,可选) ◄── 需要验证全通过                  │
```

**依赖链**: TASK-1 → TASK-2 → TASK-3 → TASK-4 → TASK-5 → TASK-6 → TASK-7 → TASK-8
**无循环依赖** ✅
**严格串行**（ops_task 特性）✅

---

## 九、回滚覆盖

| 回滚 ID | 对应 TASK 失败 | 恢复来源 | 覆盖的 OBJ |
|---------|---------------|---------|-----------|
| R-D1 | TASK-4 D1 repair 失败 | TASK-1 A4 的 flyway CSV | OBJ-4 |
| R-E2 | TASK-5 E2/E4 jar 损坏 | TASK-1 A2 的 jar bak | OBJ-1, OBJ-2 |
| R-E3 | TASK-5 E3 yml 错误 | TASK-1 A3 的 yml bak | OBJ-3 |
| R-F1 | TASK-6 F1 启动失败 | A2 jar + A3 yml + A4 csv | OBJ-1~6 |
| R-F1-DB | TASK-6 F1 migrate 失败 | TASK-1 A1 的 pg_dump | OBJ-5, OBJ-8 |

**回滚完整性**: 每个破坏性 TASK 都有对应回滚方案 ✅

---

## 十、Out of Scope 追溯

| Out of Scope 项 | 原因 | 不涉及 TASK |
|----------------|------|------------|
| 全项目 @Entity schema 全量审查 | ddl-auto=validate 可能暴露其他不匹配，另立 WI | 无（本 WI 仅修复已知 5 bug 的 schema） |
| 修改源码仓库 | WI-0004 已修复，本 WI 仅同步 | 无（本地文件全部只读） |
| 标准 mvn 构建 | 本地无 maven/JDK17 | TASK-5 用 zip 修补替代 |
| 修改 systemd unit/.env/nginx | 已正确配置 | 无 |
| 安装 JDK/maven | jar 修补方案已足够 | 无 |
| Bug-5 (install_pg16.sh) | svr-lg PG16 已安装 | 无 |
| Bug-1 (spring.profiles.active) | systemd 已设置 profile | 无 |
