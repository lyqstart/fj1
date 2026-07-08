# Trace Delta — WI-0008 (构建并部署 fj1 完整 jar + V9 迁移)

> Work Item: WI-0008
> Workflow Type: ops_task
> 产物类型: trace_delta.md (追溯矩阵)
> 关联: intake.md (AC), design.md (ops_plan, DD), tasks.md (TASK)
> 生成 Agent: sf-task-planner

## 1. 追溯矩阵（REQ → AC → DD → TASK → 文件 → 验证方式）

> 本 WI 为 ops_task，无业务 REQ（运维操作类）。追溯链起点为 intake.md 的验收标准 (AC)。

| AC ID | AC 描述 | 关联 DD | 关联 TASK | 目标文件/对象 | 验证方式 |
|-------|---------|---------|-----------|---------------|----------|
| AC-1 | 本地成功执行 mvn clean package，生成 fj-api-1.0.0.jar | DD-3 (JAVA_HOME 覆盖) | TASK-1, TASK-2 | fj-api/target/fj-api-1.0.0.jar | `test -f fj-api/target/fj-api-1.0.0.jar` + `test $(stat -c%s) -gt 70000000` + `mvn -version` exit 0 |
| AC-2 | jar 内含 V1-V9 全部 9 个 SQL 文件 | DD-1 (Fail-Stop) | TASK-3 | fj-api/target/fj-api-1.0.0.jar (BOOT-INF/classes/db/migration/) | `test "$(unzip -l ... \| grep -c 'V[0-9]__')" -eq 9` + `unzip -l ... \| grep -q V9` |
| AC-3 | SyncBatchStatus.class strings 含 RECEIVED 无 PROCESSING | DD-1 (Fail-Stop) | TASK-3 | fj-api/target/fj-api-1.0.0.jar (BOOT-INF/lib/fj-sync-*.jar → SyncBatchStatus.class) | `... \| strings \| grep -q RECEIVED` + `! ... \| grep -q PROCESSING` |
| AC-4 | svr-lg 新 jar 替换旧 jar，旧 jar 备份为 .bak.WI0008 | DD-2 (备份先于变更) | TASK-4, TASK-5 | svr-lg:/opt/fj1/api/fj-api-1.0.0.jar + .bak.WI0008 | `ssh lg "test -f .../fj-api-1.0.0.jar.bak.WI0008"` + owner=fj1:fj1 + 权限=644 |
| AC-5 | fj1-api 服务重启后 active running，health=UP | DD-1 (Fail-Stop) | TASK-6, TASK-7 | svr-lg:fj1-api.service | `systemctl is-active fj1-api \| grep -q active` |
| AC-6 | Flyway 自动执行 V9，success=t | DD-1 (Fail-Stop) | TASK-6 (触发), TASK-7 (验证) | DB:fj1_inspect.flyway_schema_history (version=9) | `psql ... "SELECT success FROM flyway_schema_history WHERE version='9'" \| grep -q t` |
| AC-7 | project_issues.status CHECK 扩展为 8 值 | DD-1 (Fail-Stop) | TASK-7 | DB:fj1_inspect.pg_constraint (chk_pi_status) | `psql ... "SELECT pg_get_constraintdef(oid) ... chk_pi_status" \| grep -q RECTIFIED` |
| AC-8 | standard_library_version 类型变为 VARCHAR(64) | DD-1 (Fail-Stop) | TASK-7 | DB:fj1_inspect.information_schema.columns (standard_recommendation_results.standard_library_version) | `test "$(psql ... character_maximum_length ...)" = "64"` |
| AC-9 | 启动日志无 ERROR/FATAL，ddl-auto=validate 通过 | DD-1 (Fail-Stop) | TASK-7 | svr-lg:journalctl (fj1-api 近 2 分钟) | `! journalctl ... \| grep -qiE 'FATAL\|FlywayException'` |

## 2. 设计决策覆盖（DD → TASK）

| DD ID | DD 描述 | 覆盖 TASK | 覆盖说明 |
|-------|---------|-----------|----------|
| DD-1 | Fail-Stop 执行原则（破坏性步骤前设 Fail-Stop 判断点） | TASK-3, TASK-7 | TASK-3 是构建后 Fail-Stop 门禁（失败→不部署）；TASK-7 是部署后 Fail-Stop 门禁（失败→回滚） |
| DD-2 | 备份先于变更原则（cp .bak.WI0008 先于 mv 覆盖） | TASK-5 | TASK-5 命令序列严格 ①cp 备份→②mv 替换，保证备份完成前不覆盖 |
| DD-3 | 环境隔离原则（JAVA_HOME=/usr/lib/jvm/java-17-openjdk 覆盖默认 JDK8） | TASK-2 | TASK-2 构建命令显式设置 JAVA_HOME，不修改全局 java 版本 |

## 3. ops_plan 步骤覆盖（步骤 → TASK）

| ops_plan 步骤 | 步骤描述 | 覆盖 TASK | 备注 |
|---------------|----------|-----------|------|
| 步骤 0 | 执行前人工预检（git status） | （人工预检，非 TASK） | executor 执行 TASK-1 前确认 |
| 步骤 1 | 安装 maven | TASK-1 | dnf install -y maven |
| 步骤 2 | 构建 jar | TASK-2 | JAVA_HOME 覆盖 + mvn clean package -DskipTests |
| 步骤 3 | 验证 jar 内容（Fail-Stop） | TASK-3 | 3 项验证：SQL 计数 + V9 存在 + class strings |
| 步骤 4 | 传输 jar 到 svr-lg | TASK-4 | scp 到 /tmp/.WI0008 |
| 步骤 5 | 备份 + 替换 jar | TASK-5 | cp .bak.WI0008 → mv → chown → chmod（requires_user_confirmation） |
| 步骤 6 | 重启服务（停机点） | TASK-6 | systemctl restart fj1-api（requires_user_confirmation） |
| 步骤 7 | 验证部署（Fail-Stop） | TASK-7 | 5 项验证：active + 无 ERROR + Flyway V9 + CHECK 8 值 + VARCHAR 64 |

## 4. 文件覆盖（文件 → 创建/修改/删除 → 涉及 AC → 涉及 TASK）

| 文件/对象 | 操作类型 | 涉及 AC | 涉及 TASK |
|-----------|----------|---------|-----------|
| 系统：maven 包（/usr/share/maven, /usr/bin/mvn） | 创建（安装） | AC-1 | TASK-1 |
| fj-api/target/fj-api-1.0.0.jar | 创建（构建产物） | AC-1, AC-2, AC-3 | TASK-2 |
| fj-api/target/**（其他构建产物） | 创建（构建产物） | AC-1 | TASK-2 |
| ~/.m2/repository/**（maven 依赖缓存） | 创建（下载） | AC-1 | TASK-2 |
| /tmp/fj-sync-new.jar（本地临时文件） | 创建（验证用，临时） | AC-3 | TASK-3 |
| svr-lg:/tmp/fj-api-1.0.0.jar.WI0008 | 创建（中转，传输后由 TASK-5 mv 删除） | AC-4 | TASK-4 |
| svr-lg:/opt/fj1/api/fj-api-1.0.0.jar.bak.WI0008 | 创建（备份） | AC-4 | TASK-5 |
| svr-lg:/opt/fj1/api/fj-api-1.0.0.jar | 修改（覆盖为新 jar） | AC-4 | TASK-5 |
| 系统：fj1-api.service 状态 | 修改（restart） | AC-5, AC-6 | TASK-6 |
| DB:fj1_inspect.flyway_schema_history | 修改（Flyway 新增 V9 记录） | AC-6 | TASK-6 (执行), TASK-7 (验证) |
| DB:fj1_inspect.pg_constraint (chk_pi_status) | 修改（V9 ALTER CHECK 为 8 值） | AC-7 | TASK-7 (验证，V9 由 Flyway 执行) |
| DB:fj1_inspect.standard_recommendation_results.standard_library_version | 修改（V9 ALTER VARCHAR(64)） | AC-8 | TASK-7 (验证，V9 由 Flyway 执行) |

> 注：TASK-7 为纯只读验证，不直接修改任何文件。DB schema 变更（chk_pi_status、VARCHAR）由 TASK-6 触发的 Flyway V9 自动执行。

## 5. 覆盖统计

| 指标 | 值 | 状态 |
|------|-----|------|
| 总 AC 数 | 9 | — |
| 已覆盖 AC 数 | 9 | ✅ 全覆盖 |
| 未覆盖 AC 数 | 0 | ✅ 无遗漏 |
| 总 DD 数 | 3 | — |
| 已覆盖 DD 数 | 3 | ✅ 全覆盖 |
| 无悬空 DD | 是 | ✅ |
| 总 TASK 数 | 7 | — |
| 已关联 AC 的 TASK 数 | 7 | ✅ 全关联 |
| 无悬空 TASK | 是 | ✅ |
| ops_plan 步骤覆盖 | 7/7（步骤 1-7） | ✅ 全覆盖 |
| 每个 AC 至少 1 个 TASK | 是 | ✅ |
| 每个 TASK 至少 1 个 AC | 是 | ✅ |
| 每个目标文件有验证方式 | 是 | ✅ |
| Fail-Stop 门禁 TASK | 2（TASK-3, TASK-7） | ✅ |
| requires_user_confirmation TASK | 2（TASK-5, TASK-6） | ✅ |
| destructive TASK | 2（TASK-5, TASK-6） | ✅ |
| 串行依赖链完整性 | TASK-1→2→3→4→5→6→7 | ✅ 无循环，无断链 |

## 6. 自检（追溯完整性）

| # | 自检项 | 结果 |
|---|--------|------|
| 1 | 每个 AC 是否至少关联一个 TASK？ | ✅ AC-1~AC-9 全部关联 |
| 2 | 每个 DD 是否至少关联一个 TASK？ | ✅ DD-1~DD-3 全部关联 |
| 3 | 每个 ops_plan 步骤是否对应一个 TASK？ | ✅ 步骤 1-7 全部对应 |
| 4 | 每个 TASK 是否有明确目标文件/对象？ | ✅ 见文件覆盖表 |
| 5 | 每个目标文件/对象是否有验证方式？ | ✅ 见追溯矩阵 |
| 6 | 是否存在悬空 AC（无 TASK）？ | ❌ 否，无悬空 |
| 7 | 是否存在悬空 TASK（无 AC）？ | ❌ 否，无悬空 |
| 8 | 是否存在悬空 DD（无 TASK）？ | ❌ 否，无悬空 |
| 9 | Fail-Stop 判断点是否覆盖破坏性步骤前？ | ✅ TASK-3（部署前）、TASK-7（部署后） |
| 10 | 破坏性步骤是否标注 requires_user_confirmation？ | ✅ TASK-5、TASK-6 |
| 11 | trace_delta.md 是否真实写入？ | ✅ 本文件 |
| 12 | 回滚路径是否可追溯到 DD-1/DD-2？ | ✅ TASK-5/TASK-7 on_failure 引用 design.md §4 |

## 7. 风险与回滚追溯

| 风险场景 | 触发位置 | 回滚方案引用 | 涉及 TASK |
|----------|----------|--------------|-----------|
| 构建失败 | TASK-2 后 | 不部署，保留 svr-lg 现状 | TASK-2 on_failure |
| jar 验证失败（无 V9 / class 无 RECEIVED） | TASK-3（Fail-Stop） | 停止，检查构建问题 | TASK-3 on_failure_action: STOP |
| jar 替换后异常（重启前） | TASK-5 后 | design.md §4.1（恢复 .bak.WI0008） | TASK-5 rollback_on_failure |
| 服务启动失败（90 秒未 active） | TASK-6 后 | design.md §4.2（恢复 .bak.WI0008 + restart） | TASK-6 rollback_on_failure |
| V9 迁移失败（success=f） | TASK-7（Fail-Stop） | design.md §4.3（清理 flyway_schema_history + 恢复 jar） | TASK-7 on_failure_action: ROLLBACK |
| 部署后任何验证项失败 | TASK-7（Fail-Stop） | design.md §4.2（恢复 .bak.WI0008 + restart） | TASK-7 on_failure_action: ROLLBACK |

*Generated by sf-task-planner for WI-0008 (ops_task workflow)*