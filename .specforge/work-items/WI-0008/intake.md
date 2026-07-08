# Intake — WI-0008 (构建并部署 fj1 完整 jar + V9 迁移)

## 操作目标

在本地搭建完整 JDK17+maven 构建环境，使用 `mvn clean package -DskipTests` 构建包含 WI-0004（V3/V8 修复）+ WI-0007（W1 Java 修改 + V9 迁移）全部变更的新 jar，部署到 svr-lg 并重启服务，使 V9 迁移自动执行，彻底消除本地源码与 svr-lg 部署之间的所有差异。

## 背景

WI-0003 首次部署 svr-lg 时因本地无构建环境，通过 zip 修补 jar 内的 SQL 文件完成 V3/V8 修复。WI-0007 修复了 5 个 schema 不匹配（3 个 Java 源码修改 + 1 个新建 V9 迁移），其中 Java 修改无法通过 zip 源码文件方式部署，必须编译 .class。

完整排查（2026-07-04）确认 svr-lg 现状：
- Flyway 已执行 V1-V8，V9 未执行
- jar 内 class 仍是 07-02 原始版本（SyncBatchStatus=PROCESSING/COMPLETED，ProjectIssue 默认 VALID）
- DB 约束：sync_batches CHECK 5 值、project_issues CHECK 5 值、standard_library_version VARCHAR(32)
- 数据：0 sync_batches, 0 project_issues, 0 daily_reports（全空，风险未触发但潜伏）

## 目标环境

- **构建环境**：本地 `/mnt/1t_back/project/fj1`（当前 JDK8 运行时 + javac 17，缺 maven）
- **部署目标**：svr-lg（10.0.12.12，通过 `ssh lg`，root 权限）
- **生产服务**：fj1-api（systemd unit `fj1-api.service`，端口 8080）
- **数据库**：fj1_inspect @ 127.0.0.1:5432，用户 fj1_app

## 操作时间窗口和约束

- **停机时间**：预计 1-2 分钟（仅服务重启阶段）
- **流量影响**：API 短暂不可用（nginx 502）
- **数据库**：V9 是宽松化变更（CHECK 扩展 + VARCHAR 扩展），不锁表（PG12+ ALTER TYPE VARCHAR 仅改元数据）
- **数据安全**：所有业务表当前为空，迁移风险极低

## 已知风险和注意事项

### 风险

1. **构建失败风险**：本地首次完整构建，可能存在依赖下载、编译错误等未知问题
2. **配置覆盖风险**：新 jar 内嵌的 application.yml 可能与 svr-lg 的 application-prod.yml 冲突（已确认 svr-lg 用 SPRING_CONFIG_ADDITIONAL_LOCATION 加载外部 yml，应无冲突）
3. **V9 执行失败风险**：低（宽松化变更 + 表为空）

### 注意事项

- svr-lg 现有备份：`fj-api-1.0.0.jar.bak.G6`（07-03）、`fj-api-1.0.0.jar.bak.WI0005`（07-04）、`application-prod.yml.bak.WI0005`、`backups/fj1_inspect_WI0005_*.sql`
- systemd service 名是 `fj1-api.service`（不是 fj-api.service）
- ddl-auto 已是 validate（WI-0005 确认）
- Flyway 配置由 Spring Boot 自动管理（jar 内 flyway.conf 不被外部 CLI 使用）

## 验收标准

- AC-1: 本地成功执行 `mvn clean package -DskipTests`，生成 `fj-api/target/fj-api-1.0.0.jar`
- AC-2: 新 jar 内 BOOT-INF/classes/db/migration/ 包含 V1-V9 全部 9 个 SQL 文件
- AC-3: 新 jar 内 fj-sync 模块的 SyncBatchStatus.class 反编译 strings 显示 RECEIVED/SUCCESS（无 PROCESSING/COMPLETED）
- AC-4: svr-lg 上的新 jar 替换旧 jar，旧 jar 备份为 .bak.WI0008
- AC-5: fj1-api 服务重启后 active running，health=UP
- AC-6: Flyway 自动执行 V9，flyway_schema_history 新增 V9 记录，success=t
- AC-7: project_issues.status CHECK 扩展为 8 值
- AC-8: standard_library_version 类型变为 VARCHAR(64)
- AC-9: 启动日志无 ERROR，ddl-auto=validate 通过

## 不变行为

- 现有 application-prod.yml 不变（ddl-auto=validate）
- 现有 .env 不变（DB_PASSWORD/JWT_SECRET）
- 现有 nginx 配置不变
- 现有数据库数据不丢失（虽然当前为空）
- API 端口不变（8080）