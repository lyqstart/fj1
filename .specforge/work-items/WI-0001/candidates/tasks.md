# 飞检现场管理系统 — 候选任务列表 (WI-0001)

> 基于 `design.candidate.md`（DD-1~11）和 `requirements.candidate.md`（REQ-1~21, NFR-1~11, BR-1~10）拆分。
> 共 **44 个 task**，按 MVP 阶段 1-7 组织。每个 task 标注 files_to_modify（Write Guard 白名单）。
> 技术栈：Java17+SpringBoot3.2+Maven / PostgreSQL16 / React18+TS+Vite / ReactNative0.74+WatermelonDB / poi-tl。
> 配置文件 prod-environment.md / project-rules.md 当前为占位符（设计文档 Assumptions 已确认约束以 intake.md 为准）。

---

## 阶段 1 — 基础设施与权限骨架

### TASK-001: PostgreSQL 13→16 升级脚本与配置

- **阶段**: 1 | **依赖**: 无 | **关联**: DD-7, NFR-8
- **What**: 编写 PG13→16 升级脚本 + postgresql-16.conf + pg_hba.conf
- **Why**: 服务器现有 PG13.23，技术栈定稿 PG16（DD-7）。⚠️ 实施前必须确认现有数据是否需保留
- **修改文件**:
  - `scripts/ops/upgrade_pg13_to_16.sh`
  - `deploy/config/postgresql-16.conf`
  - `deploy/config/pg_hba.conf`
- **Done When**: 升级脚本语法正确；postgresql-16.conf 含 DD-7 参数（shared_buffers=512MB, max_connections=50）；pg_hba.conf 使用 scram-sha-256
- **验收命令**:
  - `bash -n scripts/ops/upgrade_pg13_to_16.sh`
  - `grep -c "shared_buffers = 512MB" deploy/config/postgresql-16.conf`
  - `grep -c "scram-sha-256" deploy/config/pg_hba.conf`
- **Out of Scope**: 实际执行升级（需人工确认数据保留策略）

### TASK-002: 后端 Maven 多模块项目骨架

- **阶段**: 1 | **依赖**: TASK-001 | **关联**: 架构§2.2
- **What**: 创建 fj-backend 父 POM + 12 个子模块（fj-common/auth/system/project/inspection/issue/report/approval/export/sync/recommend/api）的 pom.xml 和目录结构
- **Why**: 所有后端 task 的基础骨架。模块划分见设计文档 §2.2
- **修改文件**:
  - `fj-backend/pom.xml`
  - `fj-backend/fj-common/pom.xml`
  - `fj-backend/fj-auth/pom.xml`
  - `fj-backend/fj-system/pom.xml`
  - `fj-backend/fj-project/pom.xml`
  - `fj-backend/fj-inspection/pom.xml`
  - `fj-backend/fj-issue/pom.xml`
  - `fj-backend/fj-report/pom.xml`
  - `fj-backend/fj-approval/pom.xml`
  - `fj-backend/fj-export/pom.xml`
  - `fj-backend/fj-sync/pom.xml`
  - `fj-backend/fj-recommend/pom.xml`
  - `fj-backend/fj-api/pom.xml`
  - `fj-backend/.mvn/wrapper/maven-wrapper.properties`
- **Done When**: `mvn validate` 通过；12 个子模块均可被 Maven 识别
- **验收命令**:
  - `mvn -f fj-backend/pom.xml validate`
  - `mvn -f fj-backend/pom.xml dependency:tree -q | head -5`
- **Out of Scope**: 具体业务代码（仅骨架）

### TASK-003: fj-common 公共基础库

- **阶段**: 1 | **依赖**: TASK-002 | **关联**: DD-5, 架构§2.2
- **What**: 统一响应 ApiResponse/PageResponse、错误码枚举 ErrorCode（§5.3）、全局异常处理 GlobalExceptionHandler、业务异常 BusinessException、通用枚举（状态机枚举）、DTO 基类、分页请求 PageRequest、Caffeine 缓存配置 CacheConfig
- **Why**: 所有模块依赖的公共基础设施。接口契约规范见 §5
- **修改文件**:
  - `fj-backend/fj-common/src/main/java/com/fj/common/response/ApiResponse.java`
  - `fj-backend/fj-common/src/main/java/com/fj/common/response/PageResponse.java`
  - `fj-backend/fj-common/src/main/java/com/fj/common/exception/BusinessException.java`
  - `fj-backend/fj-common/src/main/java/com/fj/common/exception/ErrorCode.java`
  - `fj-backend/fj-common/src/main/java/com/fj/common/exception/GlobalExceptionHandler.java`
  - `fj-backend/fj-common/src/main/java/com/fj/common/enume/BaseEnum.java`
  - `fj-backend/fj-common/src/main/java/com/fj/common/dto/PageRequest.java`
  - `fj-backend/fj-common/src/main/java/com/fj/common/config/CacheConfig.java`
- **Done When**: fj-common 编译通过；ErrorCode 含 §5.3 全部错误码范围（1000-5999）
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-common`
- **Out of Scope**: 具体状态机枚举（在各业务模块定义）

### TASK-004: fj-api 启动模块与基础配置

- **阶段**: 1 | **依赖**: TASK-003 | **关联**: DD-4, DD-5
- **What**: SpringBoot Application 启动类、application.yml（DB/JWT/Caffeine/Flyway 配置）、application-prod.yml（生产配置：JVM 参数、内存调优 DD-7 §4.3）、CORS 配置、WebMvc 配置
- **Why**: 系统启动入口，聚合所有 Controller
- **修改文件**:
  - `fj-backend/fj-api/src/main/java/com/fj/api/FjApplication.java`
  - `fj-backend/fj-api/src/main/java/com/fj/api/config/WebMvcConfig.java`
  - `fj-backend/fj-api/src/main/java/com/fj/api/config/CorsConfig.java`
  - `fj-backend/fj-api/src/main/resources/application.yml`
  - `fj-backend/fj-api/src/main/resources/application-prod.yml`
  - `fj-backend/fj-api/src/main/resources/db/migration/.gitkeep`
- **Done When**: fj-api 可编译；application.yml 含 datasource/flyway/jwt/caffeine 配置段
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-api -am`
  - `grep -c "flyway" fj-backend/fj-api/src/main/resources/application.yml`
- **Out of Scope**: Controller 实现（后续 task）

### TASK-005: Flyway V1 基础表迁移（用户/组织/角色/权限/字典）

- **阶段**: 1 | **依赖**: TASK-004 | **关联**: DB§4.1, 安全§7.2
- **What**: 创建 V1 迁移脚本，含 users、roles、permissions、user_project_roles、organizations、project_organizations、data_dictionaries、operation_logs 表（对应 §101.1-101.5, 101.24）。所有表含 BIGINT 自增主键、server_seq 字段、审计字段
- **Why**: 权限骨架和基础数据的物理表结构
- **修改文件**:
  - `fj-backend/fj-api/src/main/resources/db/migration/V1__base_tables.sql`
- **Done When**: SQL 语法正确；含 8 张基础表 DDL；每张表有 server_seq 列
- **验收命令**:
  - `mvn -f fj-backend/pom.xml flyway:validate -pl fj-api -q || true`
  - `grep -c "CREATE TABLE" fj-backend/fj-api/src/main/resources/db/migration/V1__base_tables.sql`
- **Out of Scope**: 业务表（项目/检查表/日报等）

### TASK-006: fj-system 实体与 Repository（用户/组织/角色/权限）

- **阶段**: 1 | **依赖**: TASK-003, TASK-005 | **关联**: 安全§7.2, DD-5
- **What**: JPA Entity（User, Role, Permission, UserProjectRole, Organization, ProjectOrganization, DataDictionary）+ Spring Data JPA Repository + 基础 CRUD Service + Controller
- **Why**: 权限模型基础数据层（User→UserProjectRole→Role→Permission，§7.2）
- **修改文件**:
  - `fj-backend/fj-system/src/main/java/com/fj/system/entity/User.java`
  - `fj-backend/fj-system/src/main/java/com/fj/system/entity/Role.java`
  - `fj-backend/fj-system/src/main/java/com/fj/system/entity/Permission.java`
  - `fj-backend/fj-system/src/main/java/com/fj/system/entity/UserProjectRole.java`
  - `fj-backend/fj-system/src/main/java/com/fj/system/entity/Organization.java`
  - `fj-backend/fj-system/src/main/java/com/fj/system/entity/ProjectOrganization.java`
  - `fj-backend/fj-system/src/main/java/com/fj/system/entity/DataDictionary.java`
  - `fj-backend/fj-system/src/main/java/com/fj/system/repository/UserRepository.java`
  - `fj-backend/fj-system/src/main/java/com/fj/system/repository/RoleRepository.java`
  - `fj-backend/fj-system/src/main/java/com/fj/system/repository/OrganizationRepository.java`
  - `fj-backend/fj-system/src/main/java/com/fj/system/service/UserService.java`
  - `fj-backend/fj-system/src/main/java/com/fj/system/controller/UserController.java`
- **Done When**: fj-system 编译通过；User 实体含 BCrypt 密码字段、status 字段
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-system -am`
- **Out of Scope**: JWT 认证逻辑（TASK-007）、RBAC 拦截器（TASK-008）

### TASK-007: fj-auth JWT 认证模块

- **阶段**: 1 | **依赖**: TASK-006 | **关联**: DD-4, REQ-1, NFR-10
- **What**: AuthController（POST /api/v1/auth/login, /refresh）、JwtTokenProvider（HS256, access=30min, refresh=7d）、JwtAuthFilter（Bearer 解析 + 黑名单校验）、BCrypt 密码编码（cost=12）、登录限流（Caffeine, IP 5 次锁定 5 分钟）、SecurityContext 工具类
- **Why**: DD-4 决策 JWT 无状态令牌；内存优先（不引 Redis）；安卓离线友好
- **修改文件**:
  - `fj-backend/fj-auth/src/main/java/com/fj/auth/controller/AuthController.java`
  - `fj-backend/fj-auth/src/main/java/com/fj/auth/jwt/JwtTokenProvider.java`
  - `fj-backend/fj-auth/src/main/java/com/fj/auth/jwt/JwtAuthFilter.java`
  - `fj-backend/fj-auth/src/main/java/com/fj/auth/jwt/TokenBlacklistService.java`
  - `fj-backend/fj-auth/src/main/java/com/fj/auth/service/AuthService.java`
  - `fj-backend/fj-auth/src/main/java/com/fj/auth/security/SecurityContextHolder.java`
  - `fj-backend/fj-auth/src/main/java/com/fj/auth/security/RateLimiter.java`
- **Done When**: fj-auth 编译通过；登录失败不区分用户名/密码错误（REQ-1.2）；BCrypt cost=12
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-auth -am`
  - `grep -c "BCrypt" fj-backend/fj-auth/src/main/java/com/fj/auth/service/AuthService.java`
- **Out of Scope**: RBAC 权限拦截（TASK-008）

### TASK-008: fj-auth RBAC 权限拦截器

- **阶段**: 1 | **依赖**: TASK-007 | **关联**: 安全§7.2, REQ-2, NFR-10
- **What**: @RequirePermission AOP 注解（project=true, resource, action）、PermissionChecker（项目级权限校验：查 UserProjectRole）、ProjectAccessFilter（所有请求校验 project_id 访问权限）、越权访问留痕（写 OperationLog）
- **Why**: REQ-2 项目级 RBAC；§7.2 权限粒度 resource_type+action；越权留痕（NFR-10）
- **修改文件**:
  - `fj-backend/fj-auth/src/main/java/com/fj/auth/rbac/RequirePermission.java`
  - `fj-backend/fj-auth/src/main/java/com/fj/auth/rbac/PermissionAspect.java`
  - `fj-backend/fj-auth/src/main/java/com/fj/auth/rbac/PermissionChecker.java`
  - `fj-backend/fj-auth/src/main/java/com/fj/auth/rbac/ProjectAccessFilter.java`
- **Done When**: fj-auth 编译通过；@RequirePermission 注解可被 Controller 使用
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-auth -am`
  - `grep -c "RequirePermission" fj-backend/fj-auth/src/main/java/com/fj/auth/rbac/RequirePermission.java`
- **Out of Scope**: 具体业务 Controller 权限标注（各业务 task）

### TASK-009: Flyway V2 种子数据（默认角色/权限/字典）

- **阶段**: 1 | **依赖**: TASK-005, TASK-006 | **关联**: 安全§7.2, REQ-2
- **What**: V2 迁移脚本：默认角色（系统管理员/项目负责人/检查人员/审批人）、默认权限（resource_type+action 组合）、默认字典数据（问题等级/任务状态/日报状态等枚举值）、初始管理员账号（BCrypt 哈希密码）
- **Why**: 系统初始化必须有可用角色和权限数据
- **修改文件**:
  - `fj-backend/fj-api/src/main/resources/db/migration/V2__seed_data.sql`
- **Done When**: SQL 语法正确；含至少 4 个默认角色；初始管理员密码为 BCrypt 哈希
- **验收命令**:
  - `grep -c "INSERT INTO roles" fj-backend/fj-api/src/main/resources/db/migration/V2__seed_data.sql`
- **Out of Scope**: 业务配置数据（项目级配置在后续阶段）

---

## 阶段 2 — 项目配置与检查表编制

### TASK-010: Flyway V3 项目配置表迁移

- **阶段**: 2 | **依赖**: TASK-005 | **关联**: DB§4.1, REQ-5, REQ-6
- **What**: V3 迁移：projects、project_configs（含 major_issue_deadline_hours 配置点）、project_inspection_forms、inspection_form_items、approval_flow_configs、standard_documents、standard_clauses、standard_issue_templates、check_item_standard_bindings 表
- **Why**: 项目配置和检查表的物理表结构（§101.6-101.8, 101.21, 101.25）
- **修改文件**:
  - `fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql`
- **Done When**: SQL 语法正确；project_configs 含 major_issue_deadline_hours 列；含至少 9 张表
- **验收命令**:
  - `grep -c "CREATE TABLE" fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql`
  - `grep -c "major_issue_deadline_hours" fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql`

### TASK-011: fj-project Project 实体 + CRUD

- **阶段**: 2 | **依赖**: TASK-006, TASK-008, TASK-010 | **关联**: REQ-5, BR-1
- **What**: Project Entity（项目编号、名称、状态、配置项）、ProjectConfig Entity（major_issue_deadline_hours 等）、ProjectService（创建项目生成唯一编号、配置参数保存）、ProjectController（REST CRUD）、ProjectOrganization 关联管理
- **Why**: REQ-5 项目创建与配置；BR-1 整改期限配置点
- **修改文件**:
  - `fj-backend/fj-project/src/main/java/com/fj/project/entity/Project.java`
  - `fj-backend/fj-project/src/main/java/com/fj/project/entity/ProjectConfig.java`
  - `fj-backend/fj-project/src/main/java/com/fj/project/repository/ProjectRepository.java`
  - `fj-backend/fj-project/src/main/java/com/fj/project/service/ProjectService.java`
  - `fj-backend/fj-project/src/main/java/com/fj/project/controller/ProjectController.java`
- **Done When**: fj-project 编译通过；ProjectController 含 POST/GET/PUT 端点
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-project -am`

### TASK-012: fj-project 检查表 CRUD

- **阶段**: 2 | **依赖**: TASK-011 | **关联**: REQ-6
- **What**: ProjectInspectionForm Entity（检查表，按专业/部位组织）、InspectionFormItem Entity（检查项，关联标准条文）、CheckItemStandardBinding Entity、InspectionFormService（编制/复制/调整检查表）、InspectionFormController
- **Why**: REQ-6 检查表编制；支持项目内复制（REQ-6.3）
- **修改文件**:
  - `fj-backend/fj-project/src/main/java/com/fj/project/entity/ProjectInspectionForm.java`
  - `fj-backend/fj-project/src/main/java/com/fj/project/entity/InspectionFormItem.java`
  - `fj-backend/fj-project/src/main/java/com/fj/project/entity/CheckItemStandardBinding.java`
  - `fj-backend/fj-project/src/main/java/com/fj/project/repository/InspectionFormRepository.java`
  - `fj-backend/fj-project/src/main/java/com/fj/project/service/InspectionFormService.java`
  - `fj-backend/fj-project/src/main/java/com/fj/project/controller/InspectionFormController.java`
- **Done When**: fj-project 编译通过；InspectionFormItem 关联 standard_clause_id
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-project -am`

### TASK-013: fj-approval 审批流配置

- **阶段**: 2 | **依赖**: TASK-006, TASK-010 | **关联**: REQ-5
- **What**: ApprovalFlowConfig Entity（审批流配置：节点定义、审批人规则）、ApprovalFlowConfigService（CRUD）、ApprovalFlowConfigController。V1 仅配置，审批运行引擎在 TASK-030
- **Why**: 日报确认和报告审批都需要审批流配置
- **修改文件**:
  - `fj-backend/fj-approval/src/main/java/com/fj/approval/entity/ApprovalFlowConfig.java`
  - `fj-backend/fj-approval/src/main/java/com/fj/approval/repository/ApprovalFlowConfigRepository.java`
  - `fj-backend/fj-approval/src/main/java/com/fj/approval/service/ApprovalFlowConfigService.java`
  - `fj-backend/fj-approval/src/main/java/com/fj/approval/controller/ApprovalFlowConfigController.java`
- **Done When**: fj-approval 编译通过；ApprovalFlowConfig 含节点 JSON 配置字段
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-approval -am`

### TASK-014: fj-recommend 标准库管理 CRUD

- **阶段**: 2 | **依赖**: TASK-006, TASK-010 | **关联**: REQ-4, DD-11
- **What**: StandardDocument Entity（标准文档：国标/行标/地标）、StandardClause Entity（标准条款：分类、keyword_tags）、StandardIssueTemplate Entity、StandardLibraryService（CRUD + 按分类/关键词检索）、StandardLibraryController
- **Why**: REQ-4 检查标准库管理；DD-11 标准推荐依赖此库
- **修改文件**:
  - `fj-backend/fj-recommend/src/main/java/com/fj/recommend/entity/StandardDocument.java`
  - `fj-backend/fj-recommend/src/main/java/com/fj/recommend/entity/StandardClause.java`
  - `fj-backend/fj-recommend/src/main/java/com/fj/recommend/entity/StandardIssueTemplate.java`
  - `fj-backend/fj-recommend/src/main/java/com/fj/recommend/repository/StandardClauseRepository.java`
  - `fj-backend/fj-recommend/src/main/java/com/fj/recommend/service/StandardLibraryService.java`
  - `fj-backend/fj-recommend/src/main/java/com/fj/recommend/controller/StandardLibraryController.java`
- **Done When**: fj-recommend 编译通过；StandardClause 含 keyword_tags 字段
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-recommend -am`

---

## 阶段 3 — 检查任务与安卓离线骨架

### TASK-015: Flyway V4 任务/位置/设备/通知/EditLock 表迁移

- **阶段**: 3 | **依赖**: TASK-010 | **关联**: DB§4.1, REQ-7, REQ-20
- **What**: V4 迁移：inspection_tasks、location_details、equipment、notifications、edit_locks、major_issue_notification_records、sync_batches、client_sync_states 表
- **Why**: 任务派发、位置管理、通知、同步元数据、编辑锁的物理表（§101.7, 101.17, 101.18, 101.20, 101.23, 101.27, 101.28）
- **修改文件**:
  - `fj-backend/fj-api/src/main/resources/db/migration/V4__task_tables.sql`
- **Done When**: SQL 语法正确；含至少 8 张表；inspection_tasks 含 task_status 列
- **验收命令**:
  - `grep -c "CREATE TABLE" fj-backend/fj-api/src/main/resources/db/migration/V4__task_tables.sql`

### TASK-016: fj-project 检查任务 + 位置 + 设备 CRUD

- **阶段**: 3 | **依赖**: TASK-011, TASK-015 | **关联**: REQ-7, BR-7
- **What**: InspectionTask Entity（任务状态机：待派发→待接收→进行中→已完成, BR-7）、LocationDetail Entity、Equipment Entity、InspectionTaskService（派发+接收+状态流转）、InspectionTaskController。派发时调用通知服务（后续 TASK-044 对接）
- **Why**: REQ-7 检查任务派发；BR-7 任务状态机
- **修改文件**:
  - `fj-backend/fj-project/src/main/java/com/fj/project/entity/InspectionTask.java`
  - `fj-backend/fj-project/src/main/java/com/fj/project/entity/LocationDetail.java`
  - `fj-backend/fj-project/src/main/java/com/fj/project/entity/Equipment.java`
  - `fj-backend/fj-project/src/main/java/com/fj/project/repository/InspectionTaskRepository.java`
  - `fj-backend/fj-project/src/main/java/com/fj/project/service/InspectionTaskService.java`
  - `fj-backend/fj-project/src/main/java/com/fj/project/controller/InspectionTaskController.java`
- **Done When**: fj-project 编译通过；InspectionTask 含 task_status 枚举字段
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-project -am`

### TASK-017: fj-sync 同步协议后端

- **阶段**: 3 | **依赖**: TASK-004, TASK-015 | **关联**: DD-6, REQ-8, NFR-11
- **What**: SyncController（GET /sync/pull, POST /sync/push）、ServerSeqAllocator（全局递增序列分配）、SyncPushService（client_uuid 幂等去重 + client_batch_uuid 幂等）、SyncPullService（since=last_seq 增量拉取）、冲突检测（§6.5 三类冲突：4002/4003/4004）、SyncBatch/ClientSyncState Entity + Repository
- **Why**: DD-6 安卓同步协议；NFR-11 同步可靠性
- **修改文件**:
  - `fj-backend/fj-sync/src/main/java/com/fj/sync/controller/SyncController.java`
  - `fj-backend/fj-sync/src/main/java/com/fj/sync/service/SyncPushService.java`
  - `fj-backend/fj-sync/src/main/java/com/fj/sync/service/SyncPullService.java`
  - `fj-backend/fj-sync/src/main/java/com/fj/sync/seq/ServerSeqAllocator.java`
  - `fj-backend/fj-sync/src/main/java/com/fj/sync/entity/SyncBatch.java`
  - `fj-backend/fj-sync/src/main/java/com/fj/sync/entity/ClientSyncState.java`
  - `fj-backend/fj-sync/src/main/java/com/fj/sync/repository/SyncBatchRepository.java`
- **Done When**: fj-sync 编译通过；SyncPushService 含 client_uuid 幂等检查逻辑
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-sync -am`

### TASK-018: 照片上传 API（分片 + 哈希校验 + 文件鉴权）

- **阶段**: 3 | **依赖**: TASK-017 | **关联**: DD-2, REQ-9, NFR-9
- **What**: PhotoUploadController（POST /photos/upload/init, /chunk, /complete）、PhotoStorageService（磁盘存储 /data/photos/{project_id}/{yyyy-mm}/{daily_report_id}/，SHA-256 校验，压缩图+原图+水印图路径管理）、文件鉴权访问（GET /photos/{id}/file，HMAC 签名 URL + StreamingResponseBody + Nginx X-Accel-Redirect）、断点续传支持
- **Why**: DD-2 照片存储方案；§7.3 文件鉴权访问；NFR-9 安卓 2-3 张并发上传
- **修改文件**:
  - `fj-backend/fj-sync/src/main/java/com/fj/sync/photo/PhotoUploadController.java`
  - `fj-backend/fj-sync/src/main/java/com/fj/sync/photo/PhotoStorageService.java`
  - `fj-backend/fj-sync/src/main/java/com/fj/sync/photo/FileAccessException.java`
  - `fj-backend/fj-sync/src/main/java/com/fj/sync/photo/HmacUrlSigner.java`
- **Done When**: fj-sync 编译通过；PhotoStorageService 含 SHA-256 校验方法
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-sync -am`
- **Out of Scope**: Photo 实体（在 TASK-024 fj-inspection 中创建）

### TASK-019: 安卓 RN 项目骨架 + WatermelonDB Schema

- **阶段**: 3 | **依赖**: 无（可与后端并行） | **关联**: DD-1, REQ-8
- **What**: RN 0.74 项目初始化（package.json, app.json, tsconfig.json, babel.config.js）、WatermelonDB schema（daily_reports/daily_report_issues/photos/inspection_tasks/project_issues/notifications/standard_clauses 本地表，含 server_id/sync_status/server_seq 字段）、Model 类、migration、SQLCipher 加密配置（react-native-keychain + Android Keystore）、导航骨架
- **Why**: DD-1 WatermelonDB 选型；REQ-8 完整离线作业
- **修改文件**:
  - `fj-android/package.json`
  - `fj-android/app.json`
  - `fj-android/tsconfig.json`
  - `fj-android/babel.config.js`
  - `fj-android/src/store/schema.ts`
  - `fj-android/src/store/models/DailyReportModel.ts`
  - `fj-android/src/store/models/DailyReportIssueModel.ts`
  - `fj-android/src/store/models/PhotoModel.ts`
  - `fj-android/src/store/models/InspectionTaskModel.ts`
  - `fj-android/src/store/migrations/index.ts`
  - `fj-android/src/store/database.ts`
  - `fj-android/src/navigation/AppNavigator.tsx`
- **Done When**: TypeScript 编译通过；schema 含至少 7 张本地表 + 同步字段
- **验收命令**:
  - `npx --prefix fj-android tsc --noEmit`
  - `grep -c "server_seq" fj-android/src/store/schema.ts`

### TASK-020: 安卓同步引擎

- **阶段**: 3 | **依赖**: TASK-019 | **关联**: DD-6, REQ-8, NFR-11
- **What**: SyncEngine（push/pull 增量同步，对接后端 /api/v1/sync/pull + /push）、PhotoUploadQueue（照片独立队列，分片上传，断点续传，指数退避重试 1s→8s 最多 5 次）、ClientSyncState 管理（last_server_seq 更新）、网络状态检测（在线/离线切换）、冲突处理 UI 钩子
- **Why**: DD-6 同步协议客户端实现；NFR-11 失败重试不丢数据
- **修改文件**:
  - `fj-android/src/api/SyncEngine.ts`
  - `fj-android/src/api/PhotoUploadQueue.ts`
  - `fj-android/src/api/ApiClient.ts`
  - `fj-android/src/api/ClientSyncStateManager.ts`
  - `fj-android/src/api/NetworkMonitor.ts`
- **Done When**: TypeScript 编译通过；SyncEngine 含 pull/push 方法 + 幂等 client_uuid
- **验收命令**:
  - `npx --prefix fj-android tsc --noEmit`
- **Out of Scope**: 具体业务页面（TASK-022, TASK-028）

### TASK-021: fj-recommend 标准推荐服务（三层规则 DD-11）

- **阶段**: 3 | **依赖**: TASK-014 | **关联**: DD-11, REQ-4, REQ-9
- **What**: StandardRecommendationService（三层规则匹配：检查项绑定 +50 分 / 分类匹配 +15/+10 / 关键词 +5 最多 +20）、StandardRecommendationResult Entity（score, reason_snapshot, standard_library_version）、推荐时机触发（创建问题/字段变更/手动触发）、离线推荐缓存接口
- **Why**: DD-11 V1 仅做三层规则不做 AI/RAG；§69 规则权重；§107.4 推荐时机
- **修改文件**:
  - `fj-backend/fj-recommend/src/main/java/com/fj/recommend/entity/StandardRecommendationResult.java`
  - `fj-backend/fj-recommend/src/main/java/com/fj/recommend/service/StandardRecommendationService.java`
  - `fj-backend/fj-recommend/src/main/java/com/fj/recommend/controller/RecommendationController.java`
- **Done When**: fj-recommend 编译通过；StandardRecommendationService 含三层评分方法
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-recommend -am`

### TASK-022: 安卓端检查页面（今日检查/任务详情/检查中）

- **阶段**: 3 | **依赖**: TASK-020 | **关联**: REQ-7, REQ-8
- **What**: 今日检查列表页（按日期过滤待办任务）、检查任务详情页（显示检查表项 + 关联标准）、检查中页面（逐项检查、创建问题入口）、WatermelonDB withObservables 响应式数据绑定
- **Why**: REQ-7 任务接收；REQ-8 离线作业页面基础
- **修改文件**:
  - `fj-android/src/screens/today/TodayInspectionScreen.tsx`
  - `fj-android/src/screens/today/TaskCard.tsx`
  - `fj-android/src/screens/inspection/TaskDetailScreen.tsx`
  - `fj-android/src/screens/inspection/InspectionInProgressScreen.tsx`
  - `fj-android/src/screens/inspection/IssueCreateButton.tsx`
- **Done When**: TypeScript 编译通过；TodayInspectionScreen 含任务列表渲染
- **验收命令**:
  - `npx --prefix fj-android tsc --noEmit`

---

## 阶段 4 — 日报提交与项目问题池

### TASK-023: Flyway V5 日报/问题/照片/推荐结果表迁移

- **阶段**: 4 | **依赖**: TASK-015 | **关联**: DB§4.1, REQ-10, REQ-11
- **What**: V5 迁移：daily_reports、daily_report_issues、daily_report_tasks、daily_report_inspected_parties、photos、project_issues、issue_relations、standard_recommendation_results 表
- **Why**: 日报和问题池的物理表（§101.9-101.15, 101.26）
- **修改文件**:
  - `fj-backend/fj-api/src/main/resources/db/migration/V5__daily_report_tables.sql`
- **Done When**: SQL 语法正确；daily_reports 含 confirmed_at/locked_at 列；project_issues 含 rectification_deadline 列
- **验收命令**:
  - `grep -c "confirmed_at" fj-backend/fj-api/src/main/resources/db/migration/V5__daily_report_tables.sql`
  - `grep -c "rectification_deadline" fj-backend/fj-api/src/main/resources/db/migration/V5__daily_report_tables.sql`

### TASK-024: fj-inspection 日报与照片实体 + Repository

- **阶段**: 4 | **依赖**: TASK-006, TASK-023 | **关联**: REQ-9, REQ-10
- **What**: DailyReport Entity（status: 草稿/已提交/已退回/已锁定/已作废）、DailyReportIssue Entity、DailyReportTask Entity、DailyReportInspectedParty Entity、Photo Entity（compressed_file_hash, original_file_hash, gps_status, photo_type, client_photo_uuid, is_late_uploaded）、Repository + 基础查询
- **Why**: 日报业务核心实体（§101.9-101.13, 101.22）
- **修改文件**:
  - `fj-backend/fj-inspection/src/main/java/com/fj/inspection/entity/DailyReport.java`
  - `fj-backend/fj-inspection/src/main/java/com/fj/inspection/entity/DailyReportIssue.java`
  - `fj-backend/fj-inspection/src/main/java/com/fj/inspection/entity/DailyReportTask.java`
  - `fj-backend/fj-inspection/src/main/java/com/fj/inspection/entity/DailyReportInspectedParty.java`
  - `fj-backend/fj-inspection/src/main/java/com/fj/inspection/entity/Photo.java`
  - `fj-backend/fj-inspection/src/main/java/com/fj/inspection/repository/DailyReportRepository.java`
  - `fj-backend/fj-inspection/src/main/java/com/fj/inspection/repository/DailyReportIssueRepository.java`
  - `fj-backend/fj-inspection/src/main/java/com/fj/inspection/repository/PhotoRepository.java`
- **Done When**: fj-inspection 编译通过；DailyReport 含 status 枚举 + confirmed_at/locked_at
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-inspection -am`

### TASK-025: fj-inspection 日报提交 Service（三层校验 + 状态联动）

- **阶段**: 4 | **依赖**: TASK-024, TASK-016 | **关联**: REQ-10, BR-5, 状态机§9.1
- **What**: DailyReportSubmitService：三层校验（硬阻断：必填字段/至少一条问题；配置阻断：项目配置要求；强提醒：照片不足/GPS缺失）、提交逻辑（草稿→已提交状态联动，§9.1 单事务更新 DailyReport.status + 所有 DailyReportIssue.status）、多任务日报整体操作、DailyReportController（提交端点）
- **Why**: REQ-10 日报提交；BR-5 日报状态机；§9.1 三层状态联动单事务保证
- **修改文件**:
  - `fj-backend/fj-inspection/src/main/java/com/fj/inspection/service/DailyReportSubmitService.java`
  - `fj-backend/fj-inspection/src/main/java/com/fj/inspection/service/DailyReportValidator.java`
  - `fj-backend/fj-inspection/src/main/java/com/fj/inspection/controller/DailyReportController.java`
- **Done When**: fj-inspection 编译通过；DailyReportSubmitService 含 @Transactional + 三层校验方法
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-inspection -am`
  - `grep -c "@Transactional" fj-backend/fj-inspection/src/main/java/com/fj/inspection/service/DailyReportSubmitService.java`

### TASK-026: fj-issue ProjectIssue 实体 + 问题池生成

- **阶段**: 4 | **依赖**: TASK-024, TASK-023 | **关联**: REQ-11, DD-8, DD-9, BR-3
- **What**: ProjectIssue Entity（status: 有效/待确认/暂停使用/作废/后续更正；correction_status；severity；rectification_deadline）、IssueRelation Entity（重复/相似关联）、IssuePoolService（日报确认时生成/更新 ProjectIssue，设置 confirmed_at/locked_at 同事务写入 DD-8）、IssueController
- **Why**: REQ-11 项目问题池生成；DD-8 confirmed_at/locked_at 语义；DD-9 后续更正终态；BR-3 确认即锁定
- **修改文件**:
  - `fj-backend/fj-issue/src/main/java/com/fj/issue/entity/ProjectIssue.java`
  - `fj-backend/fj-issue/src/main/java/com/fj/issue/entity/IssueRelation.java`
  - `fj-backend/fj-issue/src/main/java/com/fj/issue/repository/ProjectIssueRepository.java`
  - `fj-backend/fj-issue/src/main/java/com/fj/issue/service/IssuePoolService.java`
  - `fj-backend/fj-issue/src/main/java/com/fj/issue/controller/IssueController.java`
- **Done When**: fj-issue 编译通过；ProjectIssue 含 confirmed_at/locked_at/correction_status 字段
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-issue -am`

### TASK-027: fj-issue 问题状态流转 + 整改期限计算

- **阶段**: 4 | **依赖**: TASK-026 | **关联**: REQ-13, REQ-14, BR-1, BR-6
- **What**: IssueStatusService（问题状态机：待整改→已整改→已关闭/超期, BR-6）、RectificationDeadlineCalculator（BR-1：一般+7天/较大+3天/重大当日23:59:59，major_issue_deadline_hours 覆盖）、超期检测定时任务（@Scheduled）、整改期限倒计时查询
- **Why**: BR-1 整改期限规则（P0 共识覆盖文档）；REQ-13/14 问题等级与状态流转
- **修改文件**:
  - `fj-backend/fj-issue/src/main/java/com/fj/issue/service/IssueStatusService.java`
  - `fj-backend/fj-issue/src/main/java/com/fj/issue/service/RectificationDeadlineCalculator.java`
  - `fj-backend/fj-issue/src/main/java/com/fj/issue/job/OverdueDetectionJob.java`
- **Done When**: fj-issue 编译通过；RectificationDeadlineCalculator 含三级期限计算逻辑
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-issue -am`
  - `grep -c "confirmed_at" fj-backend/fj-issue/src/main/java/com/fj/issue/service/RectificationDeadlineCalculator.java`

### TASK-028: 安卓端问题取证 + 问题篮子 + 日报提交

- **阶段**: 4 | **依赖**: TASK-022, TASK-020 | **关联**: REQ-9, REQ-10, NFR-9
- **What**: 问题取证页（拍照+压缩 react-native-image-resizer 长边1920/质量80 + 水印 + GPS + 写描述 + 选责任单位 + 选位置 + 关联标准）、问题篮子自查页（今日问题列表 withObservables 自动刷新）、提交今日检查成果页（离线保存→联网同步提交，文本/照片分离）、照片质量规则提示（DD-10：数量检查/类型检查/GPS缺失提醒）
- **Why**: REQ-9 现场问题取证；REQ-10 离线提交日报；NFR-9 完整离线作业
- **修改文件**:
  - `fj-android/src/screens/inspection/IssueEvidenceScreen.tsx`
  - `fj-android/src/screens/issue-basket/IssueBasketScreen.tsx`
  - `fj-android/src/screens/submit/SubmitReportScreen.tsx`
  - `fj-android/src/components/photo/PhotoCapture.tsx`
  - `fj-android/src/components/photo/PhotoCompressor.tsx`
  - `fj-android/src/components/photo/WatermarkOverlay.tsx`
- **Done When**: TypeScript 编译通过；PhotoCapture 含拍照+压缩+水印逻辑
- **验收命令**:
  - `npx --prefix fj-android tsc --noEmit`

---

## 阶段 5 — 日报确认与问题复核

### TASK-029: Flyway V6 审批实例表迁移

- **阶段**: 5 | **依赖**: TASK-023 | **关联**: DB§4.1, REQ-12, REQ-18
- **What**: V6 迁移：approval_instances、approval_tasks、approval_records 表（§101.21 审批相关）。审批配置表已在 V3 创建
- **Why**: 审批运行实例的物理表
- **修改文件**:
  - `fj-backend/fj-api/src/main/resources/db/migration/V6__approval_tables.sql`
- **Done When**: SQL 语法正确；含 3 张审批表；approval_records 不可 UPDATE/DELETE（只写）
- **验收命令**:
  - `grep -c "CREATE TABLE" fj-backend/fj-api/src/main/resources/db/migration/V6__approval_tables.sql`

### TASK-030: fj-approval 审批引擎（实例/任务/记录）

- **阶段**: 5 | **依赖**: TASK-013, TASK-029 | **关联**: REQ-12, REQ-18
- **What**: ApprovalInstance Entity、ApprovalTask Entity、ApprovalRecord Entity（只写不可改删, §7.4）、ApprovalEngineService（创建审批实例 + 按配置流转节点 + 通过/退回）、审批记录链式留痕。通用引擎，日报确认和报告审批复用
- **Why**: REQ-12 日报确认需审批；REQ-18 报告审批需审批；§7.4 审计不可改删
- **修改文件**:
  - `fj-backend/fj-approval/src/main/java/com/fj/approval/entity/ApprovalInstance.java`
  - `fj-backend/fj-approval/src/main/java/com/fj/approval/entity/ApprovalTask.java`
  - `fj-backend/fj-approval/src/main/java/com/fj/approval/entity/ApprovalRecord.java`
  - `fj-backend/fj-approval/src/main/java/com/fj/approval/repository/ApprovalInstanceRepository.java`
  - `fj-backend/fj-approval/src/main/java/com/fj/approval/service/ApprovalEngineService.java`
  - `fj-backend/fj-approval/src/main/java/com/fj/approval/controller/ApprovalController.java`
- **Done When**: fj-approval 编译通过；ApprovalEngineService 含 createInstance + approve + reject 方法
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-approval -am`

### TASK-031: fj-inspection 日报确认与锁定

- **阶段**: 5 | **依赖**: TASK-026, TASK-030 | **关联**: REQ-12, DD-8, BR-3, BR-5
- **What**: DailyReportConfirmService（确认日报→调用审批引擎→审批通过后写 confirmed_at+locked_at 同事务, DD-8→问题写入 ProjectIssue, BR-3 确认即锁定原日报不可修改→退回日报附带退回意见→作废日报联动 ProjectIssue 处理）、DailyReportConfirmController。严格遵循 §9.1 联动规则表
- **Why**: DD-8 confirmed_at/locked_at 语义实现；BR-3 确认即锁定；§9.1 三层状态联动
- **修改文件**:
  - `fj-backend/fj-inspection/src/main/java/com/fj/inspection/service/DailyReportConfirmService.java`
  - `fj-backend/fj-inspection/src/main/java/com/fj/inspection/controller/DailyReportConfirmController.java`
- **Done When**: fj-inspection 编译通过；DailyReportConfirmService 含 @Transactional + confirmed_at/locked_at 写入
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-inspection -am`
  - `grep -c "locked_at" fj-backend/fj-inspection/src/main/java/com/fj/inspection/service/DailyReportConfirmService.java`

### TASK-032: fj-issue 问题复核（通过/退回/调整/作废/关联重复）

- **阶段**: 5 | **依赖**: TASK-027, TASK-030 | **关联**: REQ-12, REQ-14, DD-9
- **What**: IssueReviewService（组长复核操作：通过/退回/调整等级/作废/关联重复问题）、复核时状态联动（已发布报告引用的作废问题→后续更正 DD-9）、IssueRelationService（重复/相似关联管理）、IssueReviewController
- **Why**: REQ-12 日报退回；REQ-14 问题状态流转；DD-9 后续更正终态
- **修改文件**:
  - `fj-backend/fj-issue/src/main/java/com/fj/issue/service/IssueReviewService.java`
  - `fj-backend/fj-issue/src/main/java/com/fj/issue/service/IssueRelationService.java`
  - `fj-backend/fj-issue/src/main/java/com/fj/issue/controller/IssueReviewController.java`
- **Done When**: fj-issue 编译通过；IssueReviewService 含复核操作方法
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-issue -am`

### TASK-033: Web 前端骨架 + 登录页

- **阶段**: 5 | **依赖**: TASK-008 | **关联**: REQ-1, DD-4, DD-5
- **What**: Vite + React18 + TS 项目初始化、路由配置（react-router + 权限守卫）、API 请求封装（axios + 拦截器 + token 刷新 + 统一错误处理）、Zustand 状态管理（auth store）、公共组件（DataTable/Form/Upload/权限指令 v-permission）、登录页（账号密码登录）、布局框架
- **Why**: 所有 Web 页面的基础骨架；REQ-1 登录；DD-5 接口契约对接
- **修改文件**:
  - `fj-web/package.json`
  - `fj-web/vite.config.ts`
  - `fj-web/tsconfig.json`
  - `fj-web/src/main.tsx`
  - `fj-web/src/App.tsx`
  - `fj-web/src/router/index.tsx`
  - `fj-web/src/router/AuthGuard.tsx`
  - `fj-web/src/api/client.ts`
  - `fj-web/src/api/interceptors.ts`
  - `fj-web/src/store/authStore.ts`
  - `fj-web/src/shared/DataTable.tsx`
  - `fj-web/src/shared/PermissionDirective.tsx`
  - `fj-web/src/auth/LoginPage.tsx`
  - `fj-web/src/shared/Layout.tsx`
- **Done When**: `npm run build` 通过；登录页含表单提交逻辑
- **验收命令**:
  - `npm --prefix fj-web run build`
- **Out of Scope**: 具体业务页面（后续 task）

### TASK-034: Web 日报确认与问题复核页面

- **阶段**: 5 | **依赖**: TASK-033, TASK-031, TASK-032 | **关联**: REQ-12, REQ-14
- **What**: 日报确认工作台（日报列表 + 详情 + 确认/退回操作 + 审批流可视化）、问题复核页面（问题列表筛选 + 通过/退回/调整/作废/关联重复操作 + 整改期限倒计时显示）
- **Why**: REQ-12 日报确认与退回；REQ-14 问题状态管理；Web 端职责（BR-10）
- **修改文件**:
  - `fj-web/src/report-confirm/DailyReportConfirmPage.tsx`
  - `fj-web/src/report-confirm/DailyReportDetailPanel.tsx`
  - `fj-web/src/report-confirm/IssueReviewPanel.tsx`
  - `fj-web/src/report-confirm/IssueActionButtons.tsx`
  - `fj-web/src/api/reportConfirmApi.ts`
- **Done When**: `npm run build` 通过；日报确认页含确认/退回按钮
- **验收命令**:
  - `npm --prefix fj-web run build`

---

## 阶段 6 — 报告生产与问题快照

### TASK-035: Flyway V7 报告/快照/导出文件表迁移

- **阶段**: 6 | **依赖**: TASK-029 | **关联**: DB§4.1, REQ-15, REQ-16
- **What**: V7 迁移：reports（含版本树字段 root_report_id/previous_report_id/report_version/is_current_effective）、report_issue_snapshots（含 *_snapshot/*_name_snapshot 快照字段）、export_files 表
- **Why**: 报告和快照的物理表（§101.14-101.16）
- **修改文件**:
  - `fj-backend/fj-api/src/main/resources/db/migration/V7__report_tables.sql`
- **Done When**: SQL 语法正确；reports 含版本树字段；report_issue_snapshots 含快照字段
- **验收命令**:
  - `grep -c "report_version" fj-backend/fj-api/src/main/resources/db/migration/V7__report_tables.sql`

### TASK-036: fj-report Report 实体 + 报告生成 Service

- **阶段**: 6 | **依赖**: TASK-026, TASK-035 | **关联**: REQ-15, BR-8
- **What**: Report Entity（status: 草稿/审批中/待发布/已发布/已退回, BR-8；版本树字段）、ReportService（按时间范围汇总问题生成报告草稿 + 选择纳入问题清单 + 报告基本信息）、ReportController
- **Why**: REQ-15 报告生成；BR-8 报告状态机；§9.2 版本树预留
- **修改文件**:
  - `fj-backend/fj-report/src/main/java/com/fj/report/entity/Report.java`
  - `fj-backend/fj-report/src/main/java/com/fj/report/repository/ReportRepository.java`
  - `fj-backend/fj-report/src/main/java/com/fj/report/service/ReportService.java`
  - `fj-backend/fj-report/src/main/java/com/fj/report/controller/ReportController.java`
- **Done When**: fj-report 编译通过；Report 含 status 枚举 + 版本树字段
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-report -am`

### TASK-037: fj-report 问题快照 + 快照编辑 Service

- **阶段**: 6 | **依赖**: TASK-036 | **关联**: REQ-16, BR-4
- **What**: ReportIssueSnapshot Entity（快照字段不依赖外键 JOIN，§4.1 设计原则）、ReportSnapshotService（快照编辑：左右对照不覆盖原文 + 人工增减问题 + photo_reference_snapshot 管理）、ReportSnapshotController
- **Why**: REQ-16 问题快照不可修改；BR-4 报告发布即固化；§103 快照不受基础数据改名影响
- **修改文件**:
  - `fj-backend/fj-report/src/main/java/com/fj/report/entity/ReportIssueSnapshot.java`
  - `fj-backend/fj-report/src/main/java/com/fj/report/repository/ReportIssueSnapshotRepository.java`
  - `fj-backend/fj-report/src/main/java/com/fj/report/service/ReportSnapshotService.java`
  - `fj-backend/fj-report/src/main/java/com/fj/report/controller/ReportSnapshotController.java`
- **Done When**: fj-report 编译通过；ReportIssueSnapshot 含 *_snapshot 快照字段
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-report -am`

### TASK-038: Web 报告生产工作台 + 快照编辑页

- **阶段**: 6 | **依赖**: TASK-033, TASK-037 | **关联**: REQ-15, REQ-16
- **What**: 报告生产工作台（时间范围选择 + 问题清单管理 + 报告草稿编辑）、报告问题快照编辑页（左右对照：原问题 vs 快照编辑 + 照片预览 + 人工增减）
- **Why**: REQ-15 报告生成；REQ-16 快照编辑；Web 端职责
- **修改文件**:
  - `fj-web/src/report/ReportWorkspacePage.tsx`
  - `fj-web/src/report/ReportSnapshotEditorPage.tsx`
  - `fj-web/src/report/IssueSelectionPanel.tsx`
  - `fj-web/src/report/SnapshotComparisonView.tsx`
  - `fj-web/src/api/reportApi.ts`
- **Done When**: `npm run build` 通过；报告工作台含时间范围选择
- **验收命令**:
  - `npm --prefix fj-web run build`

### TASK-039: Web 项目问题池 + 我的问题完善工作台

- **阶段**: 6 | **依赖**: TASK-033, TASK-032 | **关联**: REQ-11, REQ-14
- **What**: 项目问题池管理页（多维度筛选：状态/等级/责任单位/期限 + 超期标红 + 整改倒计时）、我的问题完善工作台（分配给我的问题列表 + 后续更正操作）
- **Why**: REQ-11 项目问题池；REQ-14 问题状态跟踪；Web 端职责
- **修改文件**:
  - `fj-web/src/issue-pool/IssuePoolPage.tsx`
  - `fj-web/src/issue-pool/IssueDetailDrawer.tsx`
  - `fj-web/src/issue-pool/MyIssuesPage.tsx`
  - `fj-web/src/api/issueApi.ts`
- **Done When**: `npm run build` 通过；问题池页含多维筛选
- **验收命令**:
  - `npm --prefix fj-web run build`

---

## 阶段 7 — 审批、发布、导出固化

### TASK-040: fj-report 报告审批流

- **阶段**: 7 | **依赖**: TASK-030, TASK-036 | **关联**: REQ-18, BR-8
- **What**: ReportApprovalService（报告提交审批→复用 ApprovalEngineService→通过变更为"待发布"/退回附带意见→审批中不可修改报告内容）、报告版本树管理（首次发布 v1, root_report_id=自身, is_current_effective=true）、ReportApprovalController
- **Why**: REQ-18 报告审批；BR-8 报告状态机
- **修改文件**:
  - `fj-backend/fj-report/src/main/java/com/fj/report/service/ReportApprovalService.java`
  - `fj-backend/fj-report/src/main/java/com/fj/report/controller/ReportApprovalController.java`
- **Done When**: fj-report 编译通过；ReportApprovalService 调用 ApprovalEngineService
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-report -am`

### TASK-041: fj-export poi-tl 导出引擎

- **阶段**: 7 | **依赖**: TASK-036, TASK-037 | **关联**: DD-3, REQ-17, REQ-19, NFR-5
- **What**: ExportService 接口实现（exportDraftPreview 草稿预览≤60s / exportOfficialPublish 发布固化≤120s）、poi-tl 模板渲染（{{field}} 文本 + {{@image}} 图片 + {{#list}} 循环）、图片占位符验证（hash 匹配 + 缺失渲染占位提示）、版本化路径 /data/exports/report/{id}/v{ver}_{timestamp}_official.docx、Word 模板文件、ExportFile Entity + Repository、超时控制（120s）
- **Why**: DD-3 报告导出引擎；REQ-17 草稿预览导出；REQ-19 发布固化导出；NFR-5 性能要求
- **修改文件**:
  - `fj-backend/fj-export/src/main/java/com/fj/export/service/ExportService.java`
  - `fj-backend/fj-export/src/main/java/com/fj/export/service/PoiTlExportEngine.java`
  - `fj-backend/fj-export/src/main/java/com/fj/export/entity/ExportFile.java`
  - `fj-backend/fj-export/src/main/java/com/fj/export/repository/ExportFileRepository.java`
  - `fj-backend/fj-export/src/main/java/com/fj/export/controller/ExportController.java`
  - `fj-backend/fj-export/src/main/resources/templates/report_default_v1.docx`
- **Done When**: fj-export 编译通过；PoiTlExportEngine 含草稿预览和发布固化方法
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-export -am`
  - `test -f fj-backend/fj-export/src/main/resources/templates/report_default_v1.docx`

### TASK-042: fj-report 报告发布固化逻辑

- **阶段**: 7 | **依赖**: TASK-040, TASK-041 | **关联**: REQ-19, BR-4
- **What**: ReportPublishService（发布报告→创建问题快照锁定所有纳入问题→调用 ExportService.exportOfficialPublish 生成固化 Word→失败不改变报告状态 BR-4→成功变更为"已发布"→设置 locked_at）、快照不可修改守卫（已发布报告问题禁止修改）、ReportPublishController
- **Why**: REQ-19 发布固化导出；BR-4 报告发布即固化；DD-3 失败不改变状态
- **修改文件**:
  - `fj-backend/fj-report/src/main/java/com/fj/report/service/ReportPublishService.java`
  - `fj-backend/fj-report/src/main/java/com/fj/report/controller/ReportPublishController.java`
- **Done When**: fj-report 编译通过；ReportPublishService 含 @Transactional + 快照锁定 + 失败回滚逻辑
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-report -am`

### TASK-043: Web 报告审批页 + 已发布报告管理

- **阶段**: 7 | **依赖**: TASK-038, TASK-040 | **关联**: REQ-18, REQ-19
- **What**: 报告审批处理页（待审批列表 + 审批操作 + 审批意见 + 审批记录查看）、已发布报告管理页（已发布报告列表 + 下载固化 Word + 导出文件记录查看）
- **Why**: REQ-18 报告审批；REQ-19 已发布报告导出
- **修改文件**:
  - `fj-web/src/approval/ReportApprovalPage.tsx`
  - `fj-web/src/approval/ApprovalHistoryPanel.tsx`
  - `fj-web/src/approval/PublishedReportPage.tsx`
  - `fj-web/src/api/approvalApi.ts`
- **Done When**: `npm run build` 通过；报告审批页含通过/退回按钮
- **验收命令**:
  - `npm --prefix fj-web run build`

### TASK-044: 横切服务（通知 + OperationLog + EditLock）+ Web 系统管理

- **阶段**: 7（横切关注点） | **依赖**: TASK-003, TASK-015, TASK-033 | **关联**: REQ-20, REQ-21, NFR-6, NFR-10, BR-2
- **What**:
  - **通知服务**: Notification Entity + NotificationService（事件触发通知：任务派发/日报退回/问题确认/报告审批, BR-2 仅 App 内通知）+ 待办红点查询 + NotificationController
  - **OperationLog**: OperationLogService（链式哈希 log_hash = SHA-256(prev_hash + content), §7.4 只写不可改删）+ OperationLog AOP 切面（自动记录越权访问等关键操作）
  - **EditLock**: EditLockService（对象级锁 acquireLock/renewLock/releaseLock/forceRelease, TTL 30min + 5min 心跳续期 + @Scheduled 过期清理, §10.1 权限先于锁）
  - **Web 系统管理**: 用户管理/组织管理/角色权限管理/字典管理页面（fj-web/src/system/**）
- **Why**: REQ-20 通知机制；REQ-21 重大问题留痕；NFR-6 并发编辑锁；NFR-10 越权留痕；BR-2 仅 App 内通知
- **修改文件**:
  - `fj-backend/fj-common/src/main/java/com/fj/common/notification/entity/Notification.java`
  - `fj-backend/fj-common/src/main/java/com/fj/common/notification/service/NotificationService.java`
  - `fj-backend/fj-common/src/main/java/com/fj/common/notification/controller/NotificationController.java`
  - `fj-backend/fj-common/src/main/java/com/fj/common/audit/service/OperationLogService.java`
  - `fj-backend/fj-common/src/main/java/com/fj/common/audit/aspect/OperationLogAspect.java`
  - `fj-backend/fj-common/src/main/java/com/fj/common/audit/entity/OperationLog.java`
  - `fj-backend/fj-common/src/main/java/com/fj/common/concurrent/service/EditLockService.java`
  - `fj-backend/fj-common/src/main/java/com/fj/common/concurrent/entity/EditLock.java`
  - `fj-backend/fj-common/src/main/java/com/fj/common/concurrent/job/EditLockCleanupJob.java`
  - `fj-web/src/system/UserManagementPage.tsx`
  - `fj-web/src/system/OrganizationManagementPage.tsx`
  - `fj-web/src/system/RolePermissionPage.tsx`
  - `fj-web/src/system/DictionaryManagementPage.tsx`
  - `fj-web/src/api/systemApi.ts`
- **Done When**: fj-common 编译通过；fj-web build 通过；NotificationService 含事件触发方法；OperationLogService 含链式哈希；EditLockService 含 TTL 管理
- **验收命令**:
  - `mvn -f fj-backend/pom.xml compile -pl fj-common -am`
  - `npm --prefix fj-web run build`
  - `grep -c "log_hash" fj-backend/fj-common/src/main/java/com/fj/common/audit/service/OperationLogService.java`
- **Out of Scope**: 重大问题电话通知外部拨打（仅系统内留痕 MajorIssueNotificationRecord, BR-2）
