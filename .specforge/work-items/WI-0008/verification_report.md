{
  "work_item_id": "WI-0008",
  "schema_version": "1.1",
  "verification_timestamp": "2026-07-04T12:35:00.000Z",
  "verifier_agent": "sf-executor (ops verification)",
  "conclusion": "pass",
  "summary": "WI-0008 构建并部署 fj1 完整 jar + V9 迁移全部成功。7 个 TASK 全部通过。服务 active 运行新 jar，Flyway V9 迁移成功执行，schema 扩展完成。第一次部署因 application-prod.yml 配置缺陷失败，经 WI-0009 修复后第二次部署成功。",
  "acceptance_criteria": [
    {"ac_id": "AC-1", "name": "mvn clean package 生成 fj-api-1.0.0.jar", "status": "pass", "evidence": "BUILD SUCCESS, jar 81,736,099 bytes"},
    {"ac_id": "AC-2", "name": "jar 内含 V1-V9 全部 9 个 SQL 文件", "status": "pass", "evidence": "unzip count=9, V9__fix_enum_check_constraints.sql 存在"},
    {"ac_id": "AC-3", "name": "SyncBatchStatus.class 含 RECEIVED 无 PROCESSING", "status": "pass", "evidence": "strings 含 RECEIVED, 不含 PROCESSING"},
    {"ac_id": "AC-4", "name": "svr-lg jar 替换+备份 .bak.WI0008", "status": "pass", "evidence": "新 jar owner=fj1:fj1 权限=644; .bak.WI0008 存在"},
    {"ac_id": "AC-5", "name": "fj1-api 服务重启后 active running", "status": "pass", "evidence": "systemctl is-active = active, Started FjApplication in 10.663s"},
    {"ac_id": "AC-6", "name": "Flyway 自动执行 V9 success=t", "status": "pass", "evidence": "flyway_schema_history: 9 | fix enum check constraints | t"},
    {"ac_id": "AC-7", "name": "project_issues.status CHECK 扩展为 8 值", "status": "pass", "evidence": "CHECK 含 VALID,PENDING_CONFIRM,RECTIFIED,CLOSED,OVERDUE,SUSPENDED,VOIDED,CORRECTED"},
    {"ac_id": "AC-8", "name": "standard_library_version VARCHAR(64)", "status": "pass", "evidence": "character_maximum_length = 64"},
    {"ac_id": "AC-9", "name": "启动日志无 ERROR，ddl-auto=validate 通过", "status": "pass", "evidence": "journalctl 无 FATAL/FlywayException/InvalidConfigDataPropertyException; profile prod 正常激活"}
  ],
  "deployment_comparison": {
    "first_attempt": "FAILED at TASK-6: InvalidConfigDataPropertyException (application-prod.yml 非法 spring.profiles.active)",
    "second_attempt": "SUCCESS: WI-0009 修复后 profile prod 正常激活，V9 迁移成功"
  },
  "files_changed": [
    "svr-lg:/opt/fj1/api/fj-api-1.0.0.jar (替换为新版本)",
    "svr-lg:/opt/fj1/api/fj-api-1.0.0.jar.bak.WI0008 (新建备份)",
    "DB fj1_inspect.flyway_schema_history (新增 version=9 记录)"
  ],
  "changed_files_audit": "passed, blocked_write_attempts=4 all resolved (false_positive/repaired), unresolved=0"
}