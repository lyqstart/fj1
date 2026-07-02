# 飞检现场管理系统产品化 — 候选任务列表 (WI-0002)

> 基于 design.candidate.md（19 DD）+ requirements.candidate.md（30 REQ）拆分。共 **34 task**，7 阶段。
> Maven 前缀：`JAVA_HOME=/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64 /opt/module/apache-maven-3.9.6/bin/mvn`
> 标准 forbidden_files：requirements.md, design.md, tasks.md, .specforge/work-items/**
> 11/11 Gap 覆盖 ✅ | 所有 task 有 context_block ✅ | 所有 task 有 verification_commands ✅

---

## 阶段 1 — 基础设施与运维脚本 (PHASE-INFRA)

### TASK-W02-001: 创建 PG13→16 全新安装脚本

**context_block**（executor 必读）：
- **What**: 创建 scripts/ops/install_pg16.sh，幂等脚本：卸载 PG13→装 PG16-server→initdb→pg_hba.conf(scram-sha-256+peer)→postgresql.conf(shared_buffers=512MB,effective_cache_size=1GB,max_connections=50,work_mem=4MB,timezone=Asia/Shanghai)→enable+start→CREATE USER fj_app+CREATE DATABASE fj_inspect（密码从 FJ_DB_PASSWORD 环境变量读，不硬编码）。执行前 echo 摘要+read -p 确认。PG 仅监听 127.0.0.1。
- **Why**: PG13.23→PG16 全新安装（DD-7），用户确认数据可丢弃。sudo 受限，用户手动执行（D4）。
- **Refs**: DD-DEPLOY-005, DD-7, REQ-DEPLOY-001 | **read_files**: design.candidate.md | **complexity**: M
- **allowed_write_files**: [scripts/ops/install_pg16.sh]
- **Constraints**: 幂等；密码从 FJ_DB_PASSWORD 读不硬编码；scram-sha-256；set -euo pipefail
- **Done When**: bash -n 通过；含 postgresql16-server；含 scram-sha-256；含 FJ_DB_PASSWORD
- **depends_on**: 无
- **verification_commands**:
  - `bash -n scripts/ops/install_pg16.sh`
  - `grep -c "postgresql16-server" scripts/ops/install_pg16.sh`
  - `grep -c "scram-sha-256" scripts/ops/install_pg16.sh`
  - `grep -c "FJ_DB_PASSWORD" scripts/ops/install_pg16.sh`
- **out_of_scope**: 实际执行（需用户 sudo）

### TASK-W02-002: 创建 JRE17 安装脚本

**context_block**（executor 必读）：
- **What**: 创建 scripts/ops/install_jre17.sh，幂等：检查现有 java→装 java-17-openjdk-headless→配 JAVA_HOME 到 /etc/profile.d/→验证 java -version 输出 17.x。仅 headless JRE，不装 JDK/Maven。
- **Why**: 服务器无 Java（实测 command not found）。服务器只运行 jar 不构建（D5-A）。
- **Refs**: DD-DEPLOY-005, D5-A, REQ-DEPLOY-002 | **complexity**: S
- **allowed_write_files**: [scripts/ops/install_jre17.sh]
- **Done When**: bash -n 通过；含 java-17-openjdk-headless；含 JAVA_HOME profile.d
- **depends_on**: 无
- **verification_commands**:
  - `bash -n scripts/ops/install_jre17.sh`
  - `grep -c "java-17-openjdk-headless" scripts/ops/install_jre17.sh`
  - `grep -c "JAVA_HOME" scripts/ops/install_jre17.sh`
- **out_of_scope**: 实际执行（需用户 sudo）

### TASK-W02-003: 创建 application-prod.yml 生产配置

**context_block**（executor 必读）：
- **What**: 创建 deploy/config/application-prod.yml，密钥全用 ${ENV_VAR} 占位无默认值。配置：datasource(PG16 JDBC,HikariCP max-pool=10 min-idle=2)、jwt(secret=${JWT_SECRET})、caffeine(max-size=10000)、fj.export.template-fallback=false。同步更新 fj-api resources 中的 application-prod.yml。.gitignore 添加 deploy/config/application-prod.yml。
- **Why**: 生产密钥零硬编码（NFR-FIX-002）。template-fallback=false 配合 G11 模板缺失 fail-fast。
- **Refs**: DD-DEPLOY-004, DD-4, REQ-DEPLOY-005 | **complexity**: M
- **read_files**: fj-backend/fj-api/src/main/resources/application.yml
- **allowed_write_files**: [deploy/config/application-prod.yml, fj-backend/fj-api/src/main/resources/application-prod.yml, .gitignore]
- **Constraints**: JWT_SECRET 无默认值；template-fallback=false；HikariCP pool=10
- **Done When**: 含 JWT_SECRET 占位；含 template-fallback false；无硬编码默认值
- **depends_on**: 无
- **verification_commands**:
  - `grep -c 'JWT_SECRET' deploy/config/application-prod.yml`
  - `grep -c 'template-fallback.*false' deploy/config/application-prod.yml`
  - `! grep 'JWT_SECRET:change' deploy/config/application-prod.yml`
- **out_of_scope**: SecurityConfigValidator（可选）

### TASK-W02-004: 创建 systemd service 文件

**context_block**（executor 必读）：
- **What**: 创建 deploy/systemd/fj-api.service：User=fj,WorkingDirectory=/opt/fj/api,ExecStart=java -jar fj-api.jar,SPRING_PROFILES_ACTIVE=prod,EnvironmentFile=/opt/fj/api/.env(600),JVM="-Xms512m -Xmx768m -XX:MetaspaceSize=128m -XX:MaxMetaspaceSize=192m -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/data/logs/jvm",Restart=on-failure,RestartSec=10,StartLimitBurst=3,TimeoutStartSec=90。创建 deploy/config/.env.template。
- **Why**: 3.6GB RAM 需精确 JVM 调优（NFR-FIX-001）。非 root+自动重启（REQ-DEPLOY-003）。
- **Refs**: DD-DEPLOY-002, NFR-FIX-001, REQ-DEPLOY-003 | **complexity**: S
- **allowed_write_files**: [deploy/systemd/fj-api.service, deploy/config/.env.template]
- **Done When**: 含 Xmx768m；含 Restart=on-failure；含 User=fj；.env.template 含 JWT_SECRET
- **depends_on**: 无
- **verification_commands**:
  - `grep -c 'Xmx768m' deploy/systemd/fj-api.service`
  - `grep -c 'Restart=on-failure' deploy/systemd/fj-api.service`
  - `grep -c 'User=fj' deploy/systemd/fj-api.service`
  - `grep -c 'JWT_SECRET' deploy/config/.env.template`
- **out_of_scope**: 安装到 /etc/systemd/system/（需用户 sudo）

### TASK-W02-005: 创建 Nginx 配置

**context_block**（executor 必读）：
- **What**: 创建 deploy/nginx/fj.conf：Web root=/opt/fj/web(SPA try_files 回退 index.html)，/api/ proxy_pass 127.0.0.1:8080(proxy_read_timeout=120s)，/internal/photos/ internal，worker_processes=4,worker_connections=512,client_max_body_size=15m,gzip on。
- **Why**: 4vCPU Nginx 调优。照片分片上传 15m（DD-2）。/internal/photos/ X-Accel-Redirect 防 Java 读大文件到内存。
- **Refs**: DD-DEPLOY-003, DD-2, REQ-DEPLOY-004 | **complexity**: S
- **allowed_write_files**: [deploy/nginx/fj.conf]
- **Done When**: 含 proxy_pass 127.0.0.1:8080；含 client_max_body_size 15m；含 try_files index.html；含 internal
- **depends_on**: 无
- **verification_commands**:
  - `grep -c 'proxy_pass.*127.0.0.1:8080' deploy/nginx/fj.conf`
  - `grep -c 'client_max_body_size.*15m' deploy/nginx/fj.conf`
  - `grep -c 'try_files.*index.html' deploy/nginx/fj.conf`
  - `grep -c 'internal' deploy/nginx/fj.conf`
- **out_of_scope**: 安装到 /etc/nginx/（需用户 sudo）

### TASK-W02-006: 创建后端部署脚本

**context_block**（executor 必读）：
- **What**: 创建 scripts/ops/deploy_backend.sh：本地 JAVA_HOME=JDK17 mvn package -DskipTests→ssh 备份旧 jar 到 /opt/fj/api/backup/→scp jar+application-prod.yml→提示用户手动 systemctl restart（sudo 受限）→验证 is-active。创建 scripts/ops/rollback_backend.sh：列 backup/→选择→cp 覆盖→restart。
- **Why**: 服务器无 Maven/JDK（D5-A），本地构建+scp。每次备份支持回滚（NFR-FIX-004）。
- **Refs**: DD-DEPLOY-001, D5-A, REQ-DEPLOY-006 | **complexity**: M
- **read_files**: impact_analysis.md, deploy/systemd/fj-api.service
- **allowed_write_files**: [scripts/ops/deploy_backend.sh, scripts/ops/rollback_backend.sh]
- **Constraints**: Maven 前置 JAVA_HOME=JDK17；scp 前备份；systemctl restart 检测 sudo
- **Done When**: 含 mvn package；含 scp；含 backup；rollback 含 cp 覆盖
- **depends_on**: [TASK-W02-003, TASK-W02-004]
- **verification_commands**:
  - `bash -n scripts/ops/deploy_backend.sh`
  - `bash -n scripts/ops/rollback_backend.sh`
  - `grep -c 'mvn.*package' scripts/ops/deploy_backend.sh`
  - `grep -c 'scp' scripts/ops/deploy_backend.sh`
- **out_of_scope**: 实际执行部署

### TASK-W02-007: 创建数据库初始化脚本

**context_block**（executor 必读）：
- **What**: 创建 scripts/ops/init_database.sh：创建 fj_app 用户（如不存在）、创建 fj_inspect 库（如不存在）、GRANT ALL PRIVILEGES。密码从 FJ_DB_PASSWORD 读。幂等。使用 sudo -u postgres 执行 psql。
- **Why**: PG16 安装后需建库建用户，Flyway 依赖 fj_app 可连接 fj_inspect。
- **Refs**: DD-DEPLOY-005, REQ-DEPLOY-001, REQ-RUNTIME-003 | **complexity**: S
- **read_files**: scripts/ops/install_pg16.sh
- **allowed_write_files**: [scripts/ops/init_database.sh]
- **Done When**: 含 fj_app/fj_inspect；含 GRANT；密码来自环境变量
- **depends_on**: [TASK-W02-001]
- **verification_commands**:
  - `bash -n scripts/ops/init_database.sh`
  - `grep -ci 'fj_app' scripts/ops/init_database.sh`
  - `grep -ci 'fj_inspect' scripts/ops/init_database.sh`
  - `grep -c 'GRANT' scripts/ops/init_database.sh`
- **out_of_scope**: 实际执行（需 PG16 已装+sudo）

---

## 阶段 2 — 后端运行时修复 (PHASE-BACKEND-FIX)

### TASK-W02-010: G6 修复 — 添加 @EnableJpaRepositories + @EntityScan

**context_block**（executor 必读）：
- **What**: FjApplication.java 添加 @EnableJpaRepositories(basePackages={"com.fj.common.repository","com.fj.auth.repository","com.fj.system.repository","com.fj.project.repository","com.fj.inspection.repository","com.fj.issue.repository","com.fj.report.repository","com.fj.approval.repository","com.fj.export.repository","com.fj.sync.repository","com.fj.recommend.repository"}) + @EntityScan(basePackages="com.fj")。
- **Why**: 跨模块 Repository 扫描可能遗漏，运行时 NoSuchBeanDefinitionException。
- **Refs**: DD-FIX-006, DD-5, REQ-FIX-006 | **complexity**: S
- **read_files**: fj-backend/fj-api/src/main/java/com/fj/api/FjApplication.java
- **allowed_write_files**: [fj-backend/fj-api/src/main/java/com/fj/api/FjApplication.java]
- **Done When**: 含 @EnableJpaRepositories；含 @EntityScan；编译通过
- **depends_on**: 无
- **verification_commands**:
  - `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64 /opt/module/apache-maven-3.9.6/bin/mvn -f fj-backend/pom.xml compile -pl fj-api -am -q`
  - `grep -c 'EnableJpaRepositories' fj-backend/fj-api/src/main/java/com/fj/api/FjApplication.java`
  - `grep -c 'EntityScan' fj-backend/fj-api/src/main/java/com/fj/api/FjApplication.java`
- **out_of_scope**: 实际启动验证（PHASE-RUN）

### TASK-W02-011: G7 修复 — 删除 fj-system BaseEntity，统一到 fj-common

**context_block**（executor 必读）：
- **What**: 删除 fj-system/entity/BaseEntity.java，全局替换 import com.fj.system.entity.BaseEntity→import com.fj.common.jpa.BaseEntity。预估影响 15-20 实体类（仅改 import，字段不变）。
- **Why**: 两份 BaseEntity 导致 JPA 映射冲突。fj-common 是最底层模块，应为唯一基类。
- **Refs**: DD-FIX-007, DD-5, REQ-FIX-007 | **complexity**: L
- **read_files**: fj-backend/fj-common/src/main/java/com/fj/common/jpa/BaseEntity.java
- **allowed_write_files**: [fj-backend/fj-system/src/main/java/com/fj/system/entity/BaseEntity.java（删除）, fj-backend/fj-system/src/main/java/com/fj/system/entity/*.java, 其他含该 import 的文件]
- **Done When**: grep "class BaseEntity" 仅 fj-common 一次；无残留 import；全模块编译通过
- **depends_on**: 无（但应最先执行）
- **verification_commands**:
  - `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64 /opt/module/apache-maven-3.9.6/bin/mvn -f fj-backend/pom.xml compile -q`
  - `! test -f fj-backend/fj-system/src/main/java/com/fj/system/entity/BaseEntity.java`
  - `! grep -rl "com.fj.system.entity.BaseEntity" fj-backend/`
- **out_of_scope**: 修改 fj-common BaseEntity 本身

### TASK-W02-012: G8 修复 — ProjectAccessFilter 参数名双写兼容

**context_block**（executor 必读）：
- **What**: ProjectAccessFilter.java 保持 getParameter("projectId")(camelCase)，增加 getParameter("project_id")(snake_case) 作 fallback。先读 camelCase，null 时读 snake_case。
- **Why**: 前端发 camelCase，设计文档写 snake_case。双写兼容避免字段解析失败导致权限失效或 500。
- **Refs**: DD-FIX-008, DD-5 §5.1, REQ-FIX-008 | **complexity**: S
- **read_files**: fj-backend/fj-auth/src/main/java/com/fj/auth/rbac/ProjectAccessFilter.java
- **allowed_write_files**: [fj-backend/fj-auth/src/main/java/com/fj/auth/rbac/ProjectAccessFilter.java]
- **Done When**: 含 projectId 和 project_id 双参数；编译通过
- **depends_on**: [TASK-W02-011]
- **verification_commands**:
  - `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64 /opt/module/apache-maven-3.9.6/bin/mvn -f fj-backend/pom.xml compile -pl fj-auth -am -q`
  - `grep -c 'projectId' fj-backend/fj-auth/src/main/java/com/fj/auth/rbac/ProjectAccessFilter.java`
  - `grep -c 'project_id' fj-backend/fj-auth/src/main/java/com/fj/auth/rbac/ProjectAccessFilter.java`

### TASK-W02-013: G1 修复 — UserResponseDTO + Controller 脱敏

**context_block**（executor 必读）：
- **What**: 新增 UserResponseDTO（id/username/realName/email/phone/status/roles/createdAt/updatedAt，无 passwordHash）+ UserResponseConverter（Entity→DTO）。UserController list/detail/create/update 返回 ApiResponse<UserResponseDTO>。User.java passwordHash 加 @JsonProperty(access=WRITE_ONLY)。
- **Why**: UserController 返回 User 实体含 passwordHash（BCrypt），泄露可离线爆破。
- **Refs**: DD-FIX-001, DD-4, NFR-10, REQ-FIX-001 | **complexity**: M
- **read_files**: fj-backend/fj-system/src/main/java/com/fj/system/controller/UserController.java
- **allowed_write_files**: [fj-backend/fj-system/src/main/java/com/fj/system/dto/UserResponseDTO.java, fj-backend/fj-system/src/main/java/com/fj/system/dto/UserResponseConverter.java, fj-backend/fj-system/src/main/java/com/fj/system/controller/UserController.java, fj-backend/fj-system/src/main/java/com/fj/system/entity/User.java]
- **Done When**: DTO 无 passwordHash；Controller 返回 DTO；User.java 含 @JsonProperty WRITE_ONLY；编译通过
- **depends_on**: [TASK-W02-011]
- **verification_commands**:
  - `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64 /opt/module/apache-maven-3.9.6/bin/mvn -f fj-backend/pom.xml compile -pl fj-system -am -q`
  - `test -f fj-backend/fj-system/src/main/java/com/fj/system/dto/UserResponseDTO.java`
  - `! grep -i 'passwordHash' fj-backend/fj-system/src/main/java/com/fj/system/dto/UserResponseDTO.java`
  - `grep -c 'UserResponseDTO' fj-backend/fj-system/src/main/java/com/fj/system/controller/UserController.java`

### TASK-W02-014: G2 修复 — OperationLogAspect 对接 @RequirePermission

**context_block**（executor 必读）：
- **What**: OperationLogAspect 增加 @AfterThrowing(pointcut="@annotation(requirePermission)")，捕获权限异常（code=1003/2000-2999），写 action=ACCESS_DENIED 的 OperationLog（userId/路径/被拒权限/时间戳/链式哈希 log_hash）。审计写失败降级 WARN 不阻断。
- **Why**: 越权请求返回 403 但无审计记录。REQ-2.3 要求越权留痕，§7.4 链式哈希不可改删。
- **Refs**: DD-FIX-002, §7.4, REQ-FIX-002 | **complexity**: M
- **read_files**: fj-backend/fj-common/src/main/java/com/fj/common/audit/aspect/OperationLogAspect.java
- **allowed_write_files**: [fj-backend/fj-common/src/main/java/com/fj/common/audit/aspect/OperationLogAspect.java]
- **Done When**: 含 @AfterThrowing；含 ACCESS_DENIED；编译通过
- **depends_on**: [TASK-W02-011]
- **verification_commands**:
  - `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64 /opt/module/apache-maven-3.9.6/bin/mvn -f fj-backend/pom.xml compile -pl fj-common -am -q`
  - `grep -c 'AfterThrowing' fj-backend/fj-common/src/main/java/com/fj/common/audit/aspect/OperationLogAspect.java`
  - `grep -c 'ACCESS_DENIED' fj-backend/fj-common/src/main/java/com/fj/common/audit/aspect/OperationLogAspect.java`

### TASK-W02-015: G3 修复 — DD-9 联动检查实现

**context_block**（executor 必读）：
- **What**: ReportIssueSnapshotRepository 新增 countByIssueIdInPublishedReport（JOIN Report WHERE status=PUBLISHED）。新增端口接口 IssueReferenceChecker（fj-common）。新增实现 ReportIssueReferenceChecker（fj-report）。IssueReviewService.isReferencedByPublishedReport 替换 return false→调用端口（构造器注入）。
- **Why**: 硬编码 return false 导致被已发布报告引用的作废问题全进 VOIDED 而非 CORRECTED（DD-9）。
- **Refs**: DD-FIX-003, DD-9, §102.4, REQ-FIX-003 | **complexity**: L
- **read_files**: fj-backend/fj-issue/src/main/java/com/fj/issue/service/IssueReviewService.java
- **allowed_write_files**: [fj-backend/fj-common/src/main/java/com/fj/common/port/IssueReferenceChecker.java, fj-backend/fj-report/src/main/java/com/fj/report/service/ReportIssueReferenceChecker.java, fj-backend/fj-report/src/main/java/com/fj/report/repository/ReportIssueSnapshotRepository.java, fj-backend/fj-issue/src/main/java/com/fj/issue/service/IssueReviewService.java]
- **Done When**: 端口接口存在；实现类存在；IssueReviewService 调用端口非硬编码 false；Repository 含查询方法；编译通过
- **depends_on**: [TASK-W02-011]
- **verification_commands**:
  - `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64 /opt/module/apache-maven-3.9.6/bin/mvn -f fj-backend/pom.xml compile -pl fj-issue,fj-report -am -q`
  - `test -f fj-backend/fj-common/src/main/java/com/fj/common/port/IssueReferenceChecker.java`
  - `grep -c 'IssueReferenceChecker' fj-backend/fj-issue/src/main/java/com/fj/issue/service/IssueReviewService.java`
  - `grep -c 'countByIssueIdInPublishedReport' fj-backend/fj-report/src/main/java/com/fj/report/repository/ReportIssueSnapshotRepository.java`

### TASK-W02-016: G4 修复 — photo_reference_snapshot 填充逻辑

**context_block**（executor 必读）：
- **What**: ReportSnapshotService.createSnapshot() 从源问题 Photo 提取压缩路径，序列化 JSON 填入 photoReferenceSnapshot。格式：{"photos":[{"photoId","filePath","fileHash","capturedAt","gpsStatus"}],"photoCount":N}。无照片存空数组 {"photos":[],"photoCount":0} 非 null。快照创建后不可修改（PUBLISHED 冻结）。
- **Why**: photo_reference_snapshot 永远 null，导致 DD-3 导出渲染占位提示而非真实照片。违反 REQ-16。
- **Refs**: DD-FIX-004, DD-3, §101.14, REQ-FIX-004 | **complexity**: M
- **read_files**: fj-backend/fj-report/src/main/java/com/fj/report/service/ReportSnapshotService.java
- **allowed_write_files**: [fj-backend/fj-report/src/main/java/com/fj/report/service/ReportSnapshotService.java]
- **Done When**: 含 photoReferenceSnapshot 填充；无照片存空数组；编译通过
- **depends_on**: [TASK-W02-011, TASK-W02-015]
- **verification_commands**:
  - `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64 /opt/module/apache-maven-3.9.6/bin/mvn -f fj-backend/pom.xml compile -pl fj-report -am -q`
  - `grep -c 'photoReferenceSnapshot' fj-backend/fj-report/src/main/java/com/fj/report/service/ReportSnapshotService.java`
  - `grep -c 'photoCount' fj-backend/fj-report/src/main/java/com/fj/report/service/ReportSnapshotService.java`

### TASK-W02-017: G5 确认 — RectificationDeadlineCalculator hours=confirmedAt 起算

**context_block**（executor 必读）：
- **What**: 代码逻辑已正确（confirmedAt.plusHours(hours)）。本次：添加 Javadoc 标注决策 D1-A（从 confirmedAt 精确到秒起算，跨日自动处理，已确认问题 deadline 不回溯重算）。确认 hours=0/未配置走 BR-1 默认（当日 23:59:59）。
- **Why**: hours 起算点语义此前未确认。D1-A 确认从 confirmedAt 精确起算。代码已对，需文档化+补测试。
- **Refs**: DD-FIX-005, D1-A, DD-8, BR-1, REQ-FIX-005 | **complexity**: S
- **read_files**: fj-backend/fj-issue/src/main/java/com/fj/issue/service/RectificationDeadlineCalculator.java
- **allowed_write_files**: [fj-backend/fj-issue/src/main/java/com/fj/issue/service/RectificationDeadlineCalculator.java]
- **Done When**: Javadoc 含 D1-A 说明；编译通过
- **depends_on**: [TASK-W02-011]
- **verification_commands**:
  - `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64 /opt/module/apache-maven-3.9.6/bin/mvn -f fj-backend/pom.xml compile -pl fj-issue -am -q`
  - `grep -ci 'confirmedAt' fj-backend/fj-issue/src/main/java/com/fj/issue/service/RectificationDeadlineCalculator.java`

---

## 阶段 3 — 报告导出修复 (PHASE-REPORT)

### TASK-W02-020: G11 修复 — 创建 poi-tl Word 模板

**context_block**（executor 必读）：
- **What**: 创建 fj-export/src/main/resources/templates/report_default_v1.docx。含 poi-tl 占位符：{{reportNo}}/{{title}}/{{projectName}} 文本、{{#issues}}...{{/issues}} 问题清单表格循环、{{@photo_N}} 图片占位。
- **Why**: PoiTlExportEngine 引用该模板但文件不存在，走 fallback 降级格式。
- **Refs**: DD-FIX-011, DD-3, REQ-17/19, REQ-FIX-011 | **complexity**: M
- **read_files**: fj-backend/fj-export/src/main/java/com/fj/export/service/PoiTlExportEngine.java
- **allowed_write_files**: [fj-backend/fj-export/src/main/resources/templates/report_default_v1.docx]
- **Done When**: 文件存在且非空
- **depends_on**: [TASK-W02-016]
- **verification_commands**:
  - `test -f fj-backend/fj-export/src/main/resources/templates/report_default_v1.docx`
  - `test -s fj-backend/fj-export/src/main/resources/templates/report_default_v1.docx`

### TASK-W02-021: G11 修复 — PoiTlExportEngine 使用真实模板，关闭 fallback

**context_block**（executor 必读）：
- **What**: PoiTlExportEngine 确保使用真实模板渲染。模板缺失返回 TemplateNotFoundError(5001) 而非静默 fallback。application-prod.yml template-fallback=false。渲染数据含 photo_reference_snapshot。
- **Why**: 当前模板缺失走 fallback 降级。生产应 fail-fast（5001）。
- **Refs**: DD-FIX-011, DD-3, REQ-FIX-011 | **complexity**: M
- **read_files**: fj-backend/fj-export/src/main/java/com/fj/export/service/PoiTlExportEngine.java
- **allowed_write_files**: [fj-backend/fj-export/src/main/java/com/fj/export/service/PoiTlExportEngine.java]
- **Done When**: 含 5001 逻辑；编译通过
- **depends_on**: [TASK-W02-020, TASK-W02-003]
- **verification_commands**:
  - `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64 /opt/module/apache-maven-3.9.6/bin/mvn -f fj-backend/pom.xml compile -pl fj-export -am -q`
  - `grep -ci 'TemplateNotFoundError\|5001' fj-backend/fj-export/src/main/java/com/fj/export/service/PoiTlExportEngine.java`

---

## 阶段 4 — Android 修复 (PHASE-ANDROID)

### TASK-W02-030: G9 确认 — SQLCipher 降级文档化

**context_block**（executor 必读）：
- **What**: fj-android/src/store/schema.ts 添加技术债注释：当前未加密（普通 SQLite）/决策 D2-B MVP 降级/风险（Root 可读）/缓解（受控配发设备）/升级路径（react-native-sqlcipher-storage+Keystore）/TD-ANDROID-001。代码不变。
- **Why**: §7.5 要求 SQLCipher，D2-B 确认 MVP 降级。需文档化技术债确保后续可追溯。
- **Refs**: DD-FIX-009, DD-ANDROID-002, D2-B, §7.5, REQ-FIX-009 | **complexity**: S
- **read_files**: fj-android/src/store/schema.ts
- **allowed_write_files**: [fj-android/src/store/schema.ts]
- **Done When**: 含 SQLCipher/TD-ANDROID 降级注释
- **depends_on**: 无
- **verification_commands**:
  - `grep -ci 'SQLCipher\|sqlcipher\|TD-ANDROID' fj-android/src/store/schema.ts`
  - `grep -ci '不加密\|降级\|未加密\|downgrade\|D2-B' fj-android/src/store/schema.ts`

### TASK-W02-031: G10 修复 — 集成 react-native-vision-camera + image-resizer

**context_block**（executor 必读）：
- **What**: package.json 添加 react-native-vision-camera v4+ 和 react-native-image-resizer，npm install。AndroidManifest.xml 添加 CAMERA+ACCESS_FINE_LOCATION 权限。build.gradle debug buildConfigField API_BASE_URL=http://10.0.2.2:8080/api。
- **Why**: 相机模块只有接口无实现。D3-A 选定 vision-camera。
- **Refs**: DD-FIX-010, DD-ANDROID-001, D3-A, DD-2, REQ-FIX-010 | **complexity**: M
- **read_files**: fj-android/package.json
- **allowed_write_files**: [fj-android/package.json, fj-android/android/app/src/main/AndroidManifest.xml, fj-android/android/app/build.gradle]
- **Done When**: package.json 含两个依赖；node_modules 含对应包
- **depends_on**: 无
- **verification_commands**:
  - `grep -c 'react-native-vision-camera' fj-android/package.json`
  - `grep -c 'react-native-image-resizer' fj-android/package.json`
  - `test -d fj-android/node_modules/react-native-vision-camera`

### TASK-W02-032: G10 修复 — 实现拍照→压缩→SHA-256→上传流程

**context_block**（executor 必读）：
- **What**: 新增 VisionCameraPhotoService.ts 实现 captureAndCompress()：权限检查→vision-camera 拍照→GPS（失败标记 NOT_OBTAINED）→image-resizer 压缩（1920px/Q80/≤1MB）→SHA-256→写入本地 photo_upload_queue。修改 PhotoCapture.tsx 和 IssueEvidenceScreen.tsx。
- **Why**: 相机/压缩原生模块只有接口无实现，无法实际拍照。
- **Refs**: DD-FIX-010, DD-2, REQ-FIX-010 | **complexity**: L
- **read_files**: fj-android/src/components/photo/PhotoCapture.tsx
- **allowed_write_files**: [fj-android/src/services/VisionCameraPhotoService.ts, fj-android/src/components/photo/PhotoCapture.tsx, fj-android/src/screens/inspection/IssueEvidenceScreen.tsx]
- **Done When**: Service 含 captureAndCompress；含 1920/Q80；含 SHA-256
- **depends_on**: [TASK-W02-031]
- **verification_commands**:
  - `test -f fj-android/src/services/VisionCameraPhotoService.ts`
  - `grep -c 'captureAndCompress' fj-android/src/services/VisionCameraPhotoService.ts`
  - `grep -ci '1920' fj-android/src/services/VisionCameraPhotoService.ts`
  - `grep -ci 'sha-256\|sha256' fj-android/src/services/VisionCameraPhotoService.ts`

### TASK-W02-033: Android Debug Build 配置与验证

**context_block**（executor 必读）：
- **What**: 确认 build.gradle minSdkVersion=28,targetSdkVersion=34。执行 npm run android 生成 Debug APK。验证原生模块链接正常。
- **Why**: Android 从未在设备运行过。需验证 Debug Build 可生成 APK。
- **Refs**: DD-ANDROID-003, RN0.74, REQ-ANDROID-001 | **complexity**: M
- **read_files**: fj-android/android/app/build.gradle
- **allowed_write_files**: [fj-android/android/app/build.gradle]
- **Done When**: build.gradle 含 minSdkVersion 28/targetSdkVersion 34
- **depends_on**: [TASK-W02-031, TASK-W02-032]
- **verification_commands**:
  - `grep -c 'minSdkVersion.*28' fj-android/android/app/build.gradle`
  - `grep -c 'targetSdkVersion.*34' fj-android/android/app/build.gradle`
- **out_of_scope**: 真机安装（需设备）

---

## 阶段 5 — 核心单元测试 (PHASE-TEST)

### TASK-W02-040: RectificationDeadlineCalculator 单元测试

**context_block**（executor 必读）：
- **What**: 创建 RectificationDeadlineCalculatorTest.java，3 场景：(1)14:30+24h→次日14:30 (2)14:30+0→当日23:59:59 (3)22:00+8h→次日06:00。JUnit5+Mockito。
- **Why**: G5 hours 起算点需单元测试固化 D1-A。
- **Refs**: DD-FIX-005, D1-A, REQ-TEST-001, REQ-FIX-005 | **complexity**: M
- **read_files**: fj-backend/fj-issue/src/main/java/com/fj/issue/service/RectificationDeadlineCalculator.java
- **allowed_write_files**: [fj-backend/fj-issue/src/test/java/com/fj/issue/service/RectificationDeadlineCalculatorTest.java]
- **Done When**: 含 3 个 @Test；mvn test PASS
- **depends_on**: [TASK-W02-017]
- **verification_commands**:
  - `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64 /opt/module/apache-maven-3.9.6/bin/mvn -f fj-backend/pom.xml test -pl fj-issue -am -Dtest=RectificationDeadlineCalculatorTest -q`
  - `grep -c '@Test' fj-backend/fj-issue/src/test/java/com/fj/issue/service/RectificationDeadlineCalculatorTest.java`

### TASK-W02-041: IssueReviewService 单元测试（DD-9 联动）

**context_block**（executor 必读）：
- **What**: 创建 IssueReviewServiceTest.java，2 场景：(1)被引用(mock=true)→CORRECTED (2)未引用(mock=false)→VOIDED。
- **Why**: G3 DD-9 联动需验证两种分支。
- **Refs**: DD-FIX-003, DD-9, REQ-TEST-001, REQ-FIX-003 | **complexity**: M
- **read_files**: fj-backend/fj-issue/src/main/java/com/fj/issue/service/IssueReviewService.java
- **allowed_write_files**: [fj-backend/fj-issue/src/test/java/com/fj/issue/service/IssueReviewServiceTest.java]
- **Done When**: 含 2 个 @Test；mvn test PASS
- **depends_on**: [TASK-W02-015]
- **verification_commands**:
  - `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64 /opt/module/apache-maven-3.9.6/bin/mvn -f fj-backend/pom.xml test -pl fj-issue -am -Dtest=IssueReviewServiceTest -q`
  - `grep -c '@Test' fj-backend/fj-issue/src/test/java/com/fj/issue/service/IssueReviewServiceTest.java`

### TASK-W02-042: OperationLogService 单元测试（审计记录验证）

**context_block**（executor 必读）：
- **What**: 创建 OperationLogAspectTest.java，3 场景：(1)越权→ACCESS_DENIED (2)log_hash 链式哈希 (3)审计失败→降级 WARN。
- **Why**: G2 审计留痕需验证。
- **Refs**: DD-FIX-002, §7.4, REQ-TEST-001, REQ-FIX-002 | **complexity**: M
- **read_files**: fj-backend/fj-common/src/main/java/com/fj/common/audit/aspect/OperationLogAspect.java
- **allowed_write_files**: [fj-backend/fj-common/src/test/java/com/fj/common/audit/OperationLogAspectTest.java]
- **Done When**: 含至少 2 个 @Test；mvn test PASS
- **depends_on**: [TASK-W02-014]
- **verification_commands**:
  - `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64 /opt/module/apache-maven-3.9.6/bin/mvn -f fj-backend/pom.xml test -pl fj-common -am -Dtest=OperationLogAspectTest -q`
  - `grep -c '@Test' fj-backend/fj-common/src/test/java/com/fj/common/audit/OperationLogAspectTest.java`

### TASK-W02-043: ReportSnapshotService 单元测试（photo_reference_snapshot）

**context_block**（executor 必读）：
- **What**: 创建 ReportSnapshotServiceTest.java，3 场景：(1)有照片→JSON (2)无照片→空数组 (3)快照后修改→被拒。
- **Why**: G4 报告快照填充需验证。
- **Refs**: DD-FIX-004, DD-3, REQ-TEST-001, REQ-FIX-004 | **complexity**: M
- **read_files**: fj-backend/fj-report/src/main/java/com/fj/report/service/ReportSnapshotService.java
- **allowed_write_files**: [fj-backend/fj-report/src/test/java/com/fj/report/service/ReportSnapshotServiceTest.java]
- **Done When**: 含至少 2 个 @Test；mvn test PASS
- **depends_on**: [TASK-W02-016]
- **verification_commands**:
  - `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64 /opt/module/apache-maven-3.9.6/bin/mvn -f fj-backend/pom.xml test -pl fj-report -am -Dtest=ReportSnapshotServiceTest -q`
  - `grep -c '@Test' fj-backend/fj-report/src/test/java/com/fj/report/service/ReportSnapshotServiceTest.java`

---

## 阶段 6 — 后端首次启动与联调 (PHASE-RUN)

### TASK-W02-050: 首次 mvn package 生成 fat jar

**context_block**（executor 必读）：
- **What**: 执行 JAVA_HOME=JDK17 mvn -f fj-backend/pom.xml package -DskipTests 构建 fat jar。验证 fj-api/target/fj-api-*.jar（<100MB）。修复编译/打包问题。
- **Why**: WI-0001 从未执行完整 package。首次验证打包正确性。
- **Refs**: DD-DEPLOY-001, REQ-DEPLOY-006, REQ-RUNTIME-001 | **complexity**: M
- **read_files**: fj-backend/pom.xml
- **allowed_write_files**: [fj-backend/fj-api/target/**, 可能的 pom.xml 修复]
- **Done When**: mvn package exit=0；jar 存在且非空
- **depends_on**: [TASK-W02-010, TASK-W02-011, TASK-W02-012, TASK-W02-013, TASK-W02-014, TASK-W02-015, TASK-W02-016, TASK-W02-017, TASK-W02-021]
- **verification_commands**:
  - `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64 /opt/module/apache-maven-3.9.6/bin/mvn -f fj-backend/pom.xml package -DskipTests -q`
  - `test -f fj-backend/fj-api/target/fj-api-1.0.0.jar`

### TASK-W02-051: Flyway 迁移在 PG16 上首次执行验证

**context_block**（executor 必读）：
- **What**: 本地启动后端（连 PG16），触发 Flyway V1~V7 首次迁移。验证全 success、28 核心表、PG13→16 兼容性。修复迁移脚本兼容问题。
- **Why**: Flyway 从未执行。首次在 PG16 可能暴露 SQL 兼容性。
- **Refs**: DD-7, §4.1, REQ-RUNTIME-002 | **complexity**: L
- **read_files**: fj-backend/fj-api/src/main/resources/db/migration/V1__base_tables.sql
- **allowed_write_files**: [fj-backend/fj-api/src/main/resources/db/migration/*.sql]
- **Done When**: V1~V7 全 success；含全部核心表
- **depends_on**: [TASK-W02-050, TASK-W02-001, TASK-W02-007]
- **verification_commands**:
  - `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64 /opt/module/apache-maven-3.9.6/bin/mvn -f fj-backend/pom.xml spring-boot:run -pl fj-api -q &; sleep 30; curl -sf http://localhost:8080/actuator/health; kill %1`

### TASK-W02-052: 种子数据导入验证

**context_block**（executor 必读）：
- **What**: 验证 V2 种子数据：role=4,permission=20,admin BCrypt。admin 登录返回 JWT。
- **Why**: 种子数据是初始化基础。
- **Refs**: REQ-RUNTIME-003, REQ-1, REQ-2 | **complexity**: S
- **read_files**: fj-backend/fj-api/src/main/resources/db/migration/V2__seed_data.sql
- **allowed_write_files**: [fj-backend/fj-api/src/main/resources/db/migration/V2__seed_data.sql]
- **Done When**: role=4,permission=20,admin 登录返回 JWT
- **depends_on**: [TASK-W02-051]
- **verification_commands**:
  - `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64 /opt/module/apache-maven-3.9.6/bin/mvn -f fj-backend/pom.xml spring-boot:run -pl fj-api -q &; sleep 30; curl -sf -X POST http://localhost:8080/api/v1/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"changeme"}'; kill %1`

### TASK-W02-053: 关键 API 端点可访问性验证（curl 冒烟测试）

**context_block**（executor 必读）：
- **What**: 遍历核心 API（users/projects/tasks/daily-reports/project-issues/reports/auth/login），验证非 404。未认证→401。鉴权后→ApiResponse。验证无 passwordHash（G1）。
- **Why**: 任一 API 从未被调用。需验证全部端点可访问。
- **Refs**: DD-5 §5, REQ-RUNTIME-004, REQ-1 | **complexity**: M
- **allowed_write_files**: [scripts/smoke_test_api.sh]
- **Done When**: 核心 API 非 404；未认证 401；无 passwordHash
- **depends_on**: [TASK-W02-052]
- **verification_commands**:
  - `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64 /opt/module/apache-maven-3.9.6/bin/mvn -f fj-backend/pom.xml spring-boot:run -pl fj-api -q &; sleep 30; curl -sf http://localhost:8080/api/v1/users | grep -v passwordHash; kill %1`

### TASK-W02-054: Web 前端连接真实后端联调

**context_block**（executor 必读）：
- **What**: Web 连本地后端联调。配 API base URL，npm run build，验证登录→首页→核心页面数据加载。验证 projectId/project_id 兼容（G8）。
- **Why**: 前端从未用真实后端联调。
- **Refs**: DD-5 §5.1, REQ-RUNTIME-004 | **complexity**: M
- **read_files**: fj-web/src/api/*.ts, fj-web/vite.config.ts
- **allowed_write_files**: [fj-web/.env.local, fj-web/vite.config.ts]
- **Done When**: Web 构建通过；登录→核心页面数据正常
- **depends_on**: [TASK-W02-053]
- **verification_commands**:
  - `npm --prefix fj-web run build`
  - `curl -sf http://localhost:8080/api/v1/auth/login -X POST -H 'Content-Type: application/json' -d '{"username":"admin","password":"changeme"}'`

---

## 阶段 7 — 端到端验证与部署 (PHASE-E2E)

### TASK-W02-060: 端到端流程验证

**context_block**（executor 必读）：
- **What**: 手动/脚本辅助执行完整 E2E：(1)Web 登录→创建项目→配置检查表→派发任务 (2)Android 登录→接收任务→拍照(G10)→创建问题→提交日报 (3)Web 日报确认→问题入池→复核 (4)报告生成→快照(G4)→审批→发布→导出 Word(G11)。
- **Why**: 全流程 E2E 是产品化最终验收。
- **Refs**: DD-9, §9.1, REQ-E2E-001 | **complexity**: L
- **allowed_write_files**: [scripts/e2e_checklist.md]
- **Done When**: E2E 清单全通过；Word 报告含问题清单+真实照片
- **depends_on**: [TASK-W02-053, TASK-W02-054, TASK-W02-033]
- **verification_commands**:
  - `test -f scripts/e2e_checklist.md`
  - `grep -c '登录\|项目\|任务\|检查\|日报\|确认\|报告\|审批\|导出' scripts/e2e_checklist.md`

### TASK-W02-061: 服务器部署执行

**context_block**（executor 必读）：
- **What**: 用户手动+Agent 辅助部署：(1)用户执行 install_pg16+init_database+install_jre17 (2)Agent 执行 deploy_backend.sh(scp jar) (3)用户 systemctl 启动 (4)用户配 Nginx (5)验证 active。提供部署指引文档。
- **Why**: 服务器首次部署，协调 sudo（用户）+ scp（Agent）。
- **Refs**: DD-DEPLOY-001, D5-A, REQ-DEPLOY-006 | **complexity**: M
- **allowed_write_files**: [docs/deployment_guide.md]
- **Done When**: 部署指引完整；systemctl active
- **depends_on**: [TASK-W02-050, TASK-W02-001, TASK-W02-002, TASK-W02-003, TASK-W02-004, TASK-W02-005]
- **verification_commands**:
  - `test -f docs/deployment_guide.md`
  - `grep -c 'install_pg16\|install_jre17\|deploy_backend\|systemctl' docs/deployment_guide.md`

### TASK-W02-062: 服务器冒烟测试

**context_block**（executor 必读）：
- **What**: 部署后远程冒烟：curl 服务器 API 验证可访问、Web 首页加载、admin 登录返回 JWT、free -m available≥500MB。
- **Why**: 需验证服务在服务器实际可用。
- **Refs**: REQ-RUNTIME-001, REQ-RUNTIME-004, §4.3 | **complexity**: S
- **allowed_write_files**: [scripts/smoke_test_remote.sh]
- **Done When**: 远程 API 200；Web 首页加载；内存≥500MB
- **depends_on**: [TASK-W02-061]
- **verification_commands**:
  - `test -f scripts/smoke_test_remote.sh`
  - `bash -n scripts/smoke_test_remote.sh`

### TASK-W02-063: 部署回滚方案验证

**context_block**（executor 必读）：
- **What**: 验证 rollback_backend.sh 可列 backup→选择→cp 覆盖→restart，耗时≤5min。文档记录四种回滚场景。
- **Why**: NFR-FIX-004 要求可回滚≤5min。
- **Refs**: REQ-DEPLOY-006, NFR-FIX-004, §8 | **complexity**: S
- **allowed_write_files**: [docs/rollback_procedure.md]
- **Done When**: 回滚文档含四种场景；rollback 脚本语法正确
- **depends_on**: [TASK-W02-061]
- **verification_commands**:
  - `test -f docs/rollback_procedure.md`
  - `bash -n scripts/ops/rollback_backend.sh`
  - `grep -c 'jar.*失败\|Flyway\|配置错误\|PG.*损坏' docs/rollback_procedure.md`

---

## 统计

| 指标 | 数值 |
|------|------|
| 总 task 数 | 34 |
| 阶段数 | 7 |
| Gap 覆盖 | G1(T013) G2(T014) G3(T015) G4(T016) G5(T017) G6(T010) G7(T011) G8(T012) G9(T030) G10(T031,T032) G11(T020,T021) = 11/11 ✅ |
| 所有 task 有 context_block | ✅ |
| 所有 task 有 verification_commands | ✅ |
| 最大并行批次 | 5（PHASE-INFRA 001~005 独立） |