# WI-0001 任务列表：基础数据与权限骨架

> 基于 requirements.md（55条需求/164条AC）和 design.md（35个DD/14张表/52个API端点）生成。
> 技术栈：Java 17 + Spring Boot 3.x + PostgreSQL 15 + Flyway + Vue 3 + TS + Element Plus

## 任务依赖图
```
TASK-1 → TASK-2 → TASK-4 → TASK-5
TASK-1 → TASK-3 → TASK-6 → TASK-7（认证）
TASK-6 + TASK-5 → TASK-8/9/10/11/12（业务模块，并行Batch2）
TASK-6 + TASK-3 → TASK-13/14
TASK-7 → TASK-15 → TASK-16/17/18/19/20（前端，并行Batch3）
```

## 并行批次
| 批次 | 任务 | 原因 |
|------|------|------|
| Batch1 | TASK-3, TASK-4, TASK-6 | 不同包（common vs entity vs auth） |
| Batch2 | TASK-8, TASK-9, TASK-10, TASK-11, TASK-12 | 独立模块无文件重叠 |
| Batch3 | TASK-17, TASK-18, TASK-19, TASK-20 | 不同页面组件 |

---

### TASK-1 项目初始化与 Spring Boot 骨架

- **task_id**: TASK-1
- **refs**: [REQ-WI0001-C01, DD-1, DD-2]
- **depends_on**: []

**context_block**:
- **What**: 创建 Maven Spring Boot 3.x 项目骨架：pom.xml、主类、application.yml 基础配置
- **Why**: 建立项目工程基础（技术栈已冻结 C106.2）
- **Where**:
  - read_files: 无（全新创建）
  - allowed_write_files: `pom.xml`, `src/main/java/com/fj1/inspection/Fj1Application.java`, `src/main/resources/application.yml`, `src/main/resources/application-dev.yml`, `src/main/resources/application-prod.yml`
  - forbidden_files: `.specforge/**`
- **Constraints**: Java 17 + Spring Boot 3.x；依赖 spring-boot-starter-web/jpa/security/validation, postgresql, flyway-core+postgresql, jjwt 0.12.x, caffeine, lombok, spring-boot-starter-test；application.yml 配置 Flyway enabled + JPA validate + UTC 时区
- **Done When**: pom.xml 含所有必需依赖；Fj1Application.java 含 @SpringBootApplication；application.yml 含 PG+Flyway+JPA 配置；`mvn compile` 成功

- **expected_file_changes**: `pom.xml`(新), `src/main/java/com/fj1/inspection/Fj1Application.java`(新), `src/main/resources/application.yml`(新), `src/main/resources/application-dev.yml`(新), `src/main/resources/application-prod.yml`(新)

- **verification_commands**:
  - `test -f pom.xml && test -f src/main/java/com/fj1/inspection/Fj1Application.java && test -f src/main/resources/application.yml`
  - `mvn compile -q`

- **verification_evidence_expected**: pom.xml 含 spring-boot-starter-web/jpa/security/validation, postgresql, flyway, jjwt, caffeine, lombok 依赖；mvn compile 退出码 0

- **out_of_scope**: Flyway脚本(TASK-2)、实体类(TASK-4)、Security配置(TASK-6)、前端(TASK-15)

---

### TASK-2 Flyway 数据库迁移脚本（建表+索引+种子数据）

- **task_id**: TASK-2
- **refs**: [REQ-WI0001-110, REQ-WI0001-111, REQ-WI0001-C01, REQ-WI0001-N01, DD-4~14, DD-30, DD-31]
- **depends_on**: [TASK-1]

**context_block**:
- **What**: 在 `src/main/resources/db/migration/` 下创建 11 个 Flyway 脚本：V1.0.0 建表 → V1.0.1 索引 → V1.0.2~V1.1.0 种子数据
- **Why**: 数据库结构由 Flyway 管理（C106.2），种子数据保证开箱即用（REQ-110）
- **Where**:
  - read_files: design.md §2（DD-4~14 各表DDL）
  - allowed_write_files: `src/main/resources/db/migration/V1.0.0__create_tables.sql`, `src/main/resources/db/migration/V1.0.1__create_indexes.sql`, V1.0.2~V1.0.9（种子脚本）, `src/main/resources/db/migration/V1.1.0__seed_default_admin.sql`
  - forbidden_files: `.specforge/**`, 任何 .java 文件
- **Constraints**: 表名小写下划线复数；UUID varchar(36) PK；所有业务表含审计字段(created_at/created_by/updated_at/updated_by/version)；TIMESTAMPTZ；种子 INSERT ... ON CONFLICT DO NOTHING（幂等）；14张表（users/roles/permissions/role_permissions/organizations/projects/project_configs/project_organizations/user_project_roles/operation_logs/data_dictionaries/approval_templates/project_config_template/system_configs）
- **Done When**: 11个脚本存在；V1.0.0 含 ≥14 张表 CREATE TABLE；V1.0.1 含 DD-14 的全部索引；V1.1.0 含默认管理员(PLACEHOLDER密码)；所有种子含 ON CONFLICT DO NOTHING

- **expected_file_changes**: 11 个 `src/main/resources/db/migration/V*__*.sql`（新建）

- **verification_commands**:
  - `ls src/main/resources/db/migration/V*.sql | wc -l`（预期≥11）
  - `grep -c "CREATE TABLE" src/main/resources/db/migration/V1.0.0__create_tables.sql`（预期≥14）
  - `grep -l "ON CONFLICT DO NOTHING" src/main/resources/db/migration/V1.0.[2-9]*.sql src/main/resources/db/migration/V1.1.0*.sql | wc -l`（预期≥8）

- **verification_evidence_expected**: 11脚本存在；≥14 CREATE TABLE；≥8 种子脚本含 ON CONFLICT DO NOTHING

- **out_of_scope**: JPA实体(TASK-4)、Repository(TASK-5)、执行迁移（需PG数据库）

---

### TASK-3 通用基础设施（统一响应/错误码/分页/BaseEntity/全局异常/枚举）

- **task_id**: TASK-3
- **refs**: [REQ-WI0001-N03, DD-4, DD-20]
- **depends_on**: [TASK-1]

**context_block**:
- **What**: 创建 common 包：ApiResponse<T>、ErrorCode（36+错误码）、PageResult<T>、BaseEntity（@MappedSuperclass + @Version）、GlobalExceptionHandler（@RestControllerAdvice）、6个枚举（StatusEnum/OrganizationType/ProjectRole/RoleScope/PermissionCategory/ProjectStatus/OperationType）
- **Why**: 统一前后端交互格式（DD-20），乐观锁基础（DD-4 @Version），全局异常处理
- **Where**:
  - read_files: design.md 附录A（错误码清单）、DD-4/8/10/6/7/9/12 各枚举定义
  - allowed_write_files: `src/main/java/com/fj1/inspection/common/ApiResponse.java`, `ErrorCode.java`, `PageResult.java`, `BaseEntity.java`, `GlobalExceptionHandler.java`, `src/main/java/com/fj1/inspection/common/enums/StatusEnum.java`, `OrganizationType.java`, `ProjectRole.java`, `RoleScope.java`, `PermissionCategory.java`, `ProjectStatus.java`, `OperationType.java`
  - forbidden_files: `.specforge/**`, 其他模块文件
- **Constraints**: BaseEntity 含 @MappedSuperclass + id(UUID) + 审计字段 + @Version Long version；ErrorCode 每个枚举常量含 HTTP状态码+消息；GlobalExceptionHandler 处理 MethodArgumentNotValidException(400)/AccessDeniedException(403)/EntityNotFound(404)/DataIntegrityViolation(409)/Exception(500)；枚举与 design.md 定义一致
- **Done When**: 12文件存在；BaseEntity 含 @Version；ErrorCode 含 ≥36 错误码；GlobalExceptionHandler 含 @RestControllerAdvice；`mvn compile` 成功

- **expected_file_changes**: 12 个 common 包 Java 文件（新建）

- **verification_commands**:
  - `test -f src/main/java/com/fj1/inspection/common/ApiResponse.java && test -f src/main/java/com/fj1/inspection/common/BaseEntity.java && test -f src/main/java/com/fj1/inspection/common/GlobalExceptionHandler.java`
  - `grep "@Version" src/main/java/com/fj1/inspection/common/BaseEntity.java`
  - `grep "@RestControllerAdvice" src/main/java/com/fj1/inspection/common/GlobalExceptionHandler.java`
  - `find src/main/java/com/fj1/inspection/common/enums -name "*.java" | wc -l`（预期≥7）
  - `mvn compile -q`

- **verification_evidence_expected**: mvn compile 退出码0；BaseEntity含@Version；ErrorCode含≥36错误码

- **out_of_scope**: Service/Controller逻辑(TASK-7~14)、JWT/Security(TASK-6)、AOP(TASK-13)

---

### TASK-4 JPA 实体类（全部 14 张表）

- **task_id**: TASK-4
- **refs**: [REQ-WI0001-010,020,030,040,050,060,070,090, REQ-WI0001-C04, DD-5~13]
- **depends_on**: [TASK-2, TASK-3]

**context_block**:
- **What**: 创建 14 个 JPA @Entity 类：User/Role/Permission/RolePermission/Organization/Project/ProjectConfig/ProjectOrganization/UserProjectRole/OperationLog/DataDictionary/ApprovalTemplate/ProjectConfigTemplate/SystemConfig
- **Why**: JPA 实体是数据访问层基础（DD-5~13）
- **Where**:
  - read_files: V1.0.0 DDL、各实体对应设计文档 DD 段
  - allowed_write_files: `src/main/java/com/fj1/inspection/user/entity/User.java`, `src/main/java/com/fj1/inspection/role/entity/Role.java`, `Permission.java`, `RolePermission.java`, `src/main/java/com/fj1/inspection/organization/entity/Organization.java`, `src/main/java/com/fj1/inspection/project/entity/Project.java`, `ProjectConfig.java`, `ProjectOrganization.java`, `UserProjectRole.java`, `src/main/java/com/fj1/inspection/audit/entity/OperationLog.java`, `src/main/java/com/fj1/inspection/seed/entity/DataDictionary.java`, `ApprovalTemplate.java`, `ProjectConfigTemplate.java`, `SystemConfig.java`
  - forbidden_files: `.specforge/**`, Repository/Service/Controller
- **Constraints**: 所有实体继承 BaseEntity（除 OperationLog）；Lombok @Data/@NoArgsConstructor；@Table 名与 DDL 一致；FK @ManyToOne LAZY；枚举 @Enumerated(STRING)；时间用 Instant；Organization 含 @ManyToOne parent + @OneToMany children 自引用；RolePermission 含 @UniqueConstraint(role_id,permission_id)；UserProjectRole 含 is_secondment/secondment_reason 字段；OperationLog 独立结构含 log_hash/prev_log_hash/sequence_number
- **Done When**: 14实体文件存在；字段与DDL一致；Organization自引用正确；mvn compile成功

- **expected_file_changes**: 14 个 Entity Java 文件（新建）

- **verification_commands**:
  - `find src/main/java -path "*/entity/*.java" | wc -l`（预期≥14）
  - `grep "extends BaseEntity" src/main/java/com/fj1/inspection/user/entity/User.java`
  - `grep "@ManyToOne" src/main/java/com/fj1/inspection/organization/entity/Organization.java`
  - `grep "secondment" src/main/java/com/fj1/inspection/project/entity/UserProjectRole.java`
  - `mvn compile -q`

- **verification_evidence_expected**: 14+ @Entity 文件；extends BaseEntity 正确；Organization 自引用正确；mvn compile

- **out_of_scope**: Repository(TASK-5)、DTO（各业务task）、级联配置

---

### TASK-5 Spring Data JPA Repository 接口

- **task_id**: TASK-5
- **refs**: [REQ-WI0001-N01, REQ-WI0001-080, REQ-WI0001-C03, DD-2, DD-14, DD-19]
- **depends_on**: [TASK-4]

**context_block**:
- **What**: 为14个实体创建 JpaRepository 接口
- **Why**: 数据访问层（DD-2/14/19），项目级RBAC的核心索引在此层
- **Where**:
  - read_files: 各 Entity 类、DD-14/19
  - allowed_write_files: `src/main/java/com/fj1/inspection/user/repository/UserRepository.java`, `src/main/java/com/fj1/inspection/role/repository/RoleRepository.java`, `PermissionRepository.java`, `RolePermissionRepository.java`, `src/main/java/com/fj1/inspection/organization/repository/OrganizationRepository.java`, `src/main/java/com/fj1/inspection/project/repository/ProjectRepository.java`, `ProjectConfigRepository.java`, `ProjectOrganizationRepository.java`, `UserProjectRoleRepository.java`, `src/main/java/com/fj1/inspection/audit/repository/OperationLogRepository.java`, `src/main/java/com/fj1/inspection/seed/repository/DataDictionaryRepository.java`, `ApprovalTemplateRepository.java`, `ProjectConfigTemplateRepository.java`, `SystemConfigRepository.java`
  - forbidden_files: `.specforge/**`, Entity/Service/Controller
- **Constraints**: 均继承 JpaRepository<Entity, String>；**DD-19核心**：所有项目范围 Repository 方法必须显式接受 projectId 参数；UserRepository 含 findByLoginName/existsByLoginName/findByStatus；OrganizationRepository 含 findByParentId/findByPathStartingWith/findByOrganizationType；UserProjectRoleRepository 含 findByUserIdAndProjectId/findByProjectIdAndUserId/existsByUserIdAndProjectIdAndRoleId（核心RBAC查询）；OperationLogRepository 含 findByProjectIdOrderByOperationTimeDesc/findBySequenceNumberGreaterThanOrderBySequenceNumberAsc（hash链验证）
- **Done When**: 14 个 Repository 存在；所有项目范围Repository含显式projectId方法；mvn compile成功

- **expected_file_changes**: 14 个 Repository Java 文件（新建）

- **verification_commands**:
  - `find src/main/java -name "*Repository.java" | wc -l`（预期≥14）
  - `grep "findByProjectId" src/main/java/com/fj1/inspection/project/repository/UserProjectRoleRepository.java`
  - `grep "findByPathStartingWith" src/main/java/com/fj1/inspection/organization/repository/OrganizationRepository.java`
  - `grep "findBySequenceNumberGreaterThan" src/main/java/com/fj1/inspection/audit/repository/OperationLogRepository.java`
  - `mvn compile -q`

- **verification_evidence_expected**: 14+ Repository；项目范围Repository含projectId方法；mvn compile

- **out_of_scope**: Service业务逻辑(TASK-7~14)

---

### TASK-6 Spring Security 配置 + JWT + BCrypt + ProjectAccessChecker

- **task_id**: TASK-6
- **refs**: [REQ-WI0001-001,004,080, REQ-WI0001-N02,C02,C03, DD-15,16,17,19]
- **depends_on**: [TASK-3, TASK-4, TASK-2]

**context_block**:
- **What**: SecurityConfig、JwtTokenProvider、JwtAuthFilter、PasswordService(BCrypt strength=12)、TokenBlacklist(Caffeine)、UserDeactivatedEvent/Listener、ProjectAccessChecker、CorsConfig
- **Why**: 安全认证体系核心（DD-15~17/19）
- **Where**:
  - read_files: design.md DD-15~19、User/Role/UserProjectRole Entity、UserProjectRoleRepository
  - allowed_write_files: `src/main/java/com/fj1/inspection/config/SecurityConfig.java`, `JwtConfig.java`, `CorsConfig.java`, `src/main/java/com/fj1/inspection/auth/JwtTokenProvider.java`, `JwtAuthFilter.java`, `PasswordService.java`, `TokenBlacklist.java`, `UserDeactivatedEvent.java`, `UserDeactivatedListener.java`, `src/main/java/com/fj1/inspection/project/security/ProjectAccessChecker.java`
  - forbidden_files: `.specforge/**`, Service/Controller 实现
- **Constraints**: SecurityConfig @EnableMethodSecurity+无状态+禁用CSRF；JWT payload {sub,login_name,status,jti,iat,exp,type}；access_token 2h TTL/refresh_token 7d TTL；jjwt 0.12.x API (verifyWith)；Caffeine Cache<String,Boolean> token黑名单；JwtAuthFilter 继承 OncePerRequestFilter；ProjectAccessChecker.checkProjectAccess(projectId)→查UserProjectRole→checkPermission→isSystemAdmin()；secretKey从application.yml读取
- **Done When**: 10文件存在；SecurityConfig含SecurityFilterChain Bean；PasswordService含BCrypt encode/matches；TokenBlacklist用Caffeine；ProjectAccessChecker含三个方法；mvn compile成功

- **expected_file_changes**: 10 个安全相关 Java 文件（新建）

- **verification_commands**:
  - `test -f src/main/java/com/fj1/inspection/config/SecurityConfig.java && test -f src/main/java/com/fj1/inspection/auth/JwtTokenProvider.java && test -f src/main/java/com/fj1/inspection/auth/PasswordService.java && test -f src/main/java/com/fj1/inspection/project/security/ProjectAccessChecker.java`
  - `grep "BCrypt" src/main/java/com/fj1/inspection/auth/PasswordService.java`
  - `grep "verifyWith" src/main/java/com/fj1/inspection/auth/JwtTokenProvider.java`
  - `grep "Caffeine" src/main/java/com/fj1/inspection/auth/TokenBlacklist.java`
  - `mvn compile -q`

- **verification_evidence_expected**: SecurityConfig/JWT/BCrypt/Caffeine/ProjectAccessChecker 全部实现；mvn compile

- **out_of_scope**: AuthController/AuthService(TASK-7)、@PreAuthorize的应用（各Controller task）、OperationLog AOP(TASK-13)

---

### TASK-7 认证 Controller + Service（登录/登出/刷新/改密/重置/首次设密）

- **task_id**: TASK-7
- **refs**: [REQ-WI0001-001,002,003,004,111, DD-21]
- **depends_on**: [TASK-6, TASK-5]

**context_block**:
- **What**: AuthService接口+AuthServiceImpl+AuthController（7端点：login/logout/refresh/me/change-password/reset-password/initial-setup）
- **Why**: 系统安全入口（DD-21 6端点+首次设密）
- **Where**:
  - read_files: DD-21、DD-15/16、User/UserRepository
  - allowed_write_files: `src/main/java/com/fj1/inspection/auth/AuthService.java`, `AuthServiceImpl.java`, `AuthController.java`, `src/main/java/com/fj1/inspection/auth/dto/LoginRequest.java`, `LoginResponse.java`, `ChangePasswordRequest.java`, `RefreshTokenRequest.java`, `ResetPasswordRequest.java`, `InitialSetupRequest.java`, `AuthUserResponse.java`
  - forbidden_files: `.specforge/**`, 其他Controller/Service
- **Constraints**: AuthService定义为interface（A3）；登录逻辑：校验login_name存在→status=ACTIVE→BCrypt匹配→失败计数+锁定（≥5次锁15min）；锁定期间直接拒绝；成功重置计数+记录last_login_at；安全错误消息统一"登录名或密码错误"（REQ-001AC2）；密码修改：旧密码验证+新密码强度(≥8位)+BCrypt存储；密码重置：管理员操作→临时密码→password_must_change=true→OperationLog；首次设密：检测PLACEHOLDER→允许无认证→设密后must_change=false；登出：token jti加入黑名单；所有方法含@OperationLog注解
- **Done When**: 10文件存在；7端点全部实现；登录含锁定逻辑；密码修改/重置完整；首次设密逻辑正确；mvn compile成功

- **expected_file_changes**: 10 个 auth 包 Java 文件（新建）

- **verification_commands**:
  - `test -f src/main/java/com/fj1/inspection/auth/AuthService.java && test -f src/main/java/com/fj1/inspection/auth/AuthController.java`
  - `grep "login" src/main/java/com/fj1/inspection/auth/AuthController.java`
  - `grep "initial-setup" src/main/java/com/fj1/inspection/auth/AuthController.java`
  - `grep "refresh" src/main/java/com/fj1/inspection/auth/AuthController.java`
  - `mvn compile -q`

- **verification_evidence_expected**: 7端点实现（login/logout/refresh/me/change-password/reset-password/initial-setup）；AuthService是interface；mvn compile

- **out_of_scope**: 用户CRUD(TASK-8)、前端登录页(TASK-16)

---

### TASK-8 User 管理 Service + Controller

- **task_id**: TASK-8
- **refs**: [REQ-WI0001-010~014,100, DD-22(#7~12)]
- **depends_on**: [TASK-5, TASK-6]

**context_block**:
- **What**: UserService接口+UserServiceImpl+UserController（6端点）+ DTOs
- **Why**: 用户生命周期管理（REQ-010~014+100，DD-22 #7~12）
- **Where**:
  - allowed_write_files: `src/main/java/com/fj1/inspection/user/UserService.java`, `UserServiceImpl.java`, `UserController.java`, `src/main/java/com/fj1/inspection/user/dto/CreateUserRequest.java`, `UpdateUserRequest.java`, `UserQueryRequest.java`, `UserResponse.java`, `ChangeUserStatusRequest.java`
  - forbidden_files: 其他模块
- **Constraints**: 6端点（DD-22 #7~12）；创建：login_name唯一性+display_name非空+org_id可选（校验启用）+默认ACTIVE；查询：筛选（姓名/登录名/组织/状态）+分页（默认20）；编辑：可改display_name/phone/email/org_id，不可改login_name（Q1）；停用：发布UserDeactivatedEvent，不可停用自己（REQ-013AC4），保留历史数据；会话注销：管理员触发→TokenBlacklist；所有写操作@OperationLog
- **Done When**: 8文件存在；6端点完整；自我停用保护；login_name不可修改；mvn compile

- **expected_file_changes**: 8 个 user 包 Java 文件（新建）

- **verification_commands**:
  - `test -f src/main/java/com/fj1/inspection/user/UserService.java && test -f src/main/java/com/fj1/inspection/user/UserController.java`
  - `grep "login_name" src/main/java/com/fj1/inspection/user/dto/CreateUserRequest.java`
  - `grep "deactivate\|revoke-session" src/main/java/com/fj1/inspection/user/UserController.java`
  - `mvn compile -q`

- **verification_evidence_expected**: 6端点完整；login_name不可编辑；自我停用保护；mvn compile

- **out_of_scope**: 用户角色分配(TASK-12)、前端页面(TASK-17)

---

### TASK-9 Organization 管理 Service + Controller

- **task_id**: TASK-9
- **refs**: [REQ-WI0001-040~047, REQ-WI0001-C03, DD-23]
- **depends_on**: [TASK-5, TASK-6]

**context_block**:
- **What**: OrganizationService接口+ServiceImpl+Controller（7端点）+ DTOs，含树形查询+循环引用检测+物化路径
- **Why**: 组织主数据中心（REQ-040~047，DD-23）
- **Where**:
  - allowed_write_files: `src/main/java/com/fj1/inspection/organization/OrganizationService.java`, `OrganizationServiceImpl.java`, `OrganizationController.java`, `src/main/java/com/fj1/inspection/organization/dto/CreateOrganizationRequest.java`, `UpdateOrganizationRequest.java`, `OrganizationQueryRequest.java`, `OrganizationResponse.java`, `OrganizationTreeResponse.java`, `ChangeOrganizationStatusRequest.java`
  - forbidden_files: 其他模块
- **Constraints**: 7端点（DD-23 #21~27）；创建：name非空+type合法10类+parent_id可选（循环引用检测）；树查询：/tree返回完整嵌套树（children字段）；/by-type按类型筛选；编辑：parent_id修改需循环检测，type修改警告确认；停用：有子节点拒绝（REQ-041AC3），默认参建单位警告（Q3）；物化路径path字段自动更新；所有写操作@OperationLog
- **Done When**: 9文件存在；7端点完整；树形含children嵌套；循环引用检测；mvn compile

- **expected_file_changes**: 9 个 organization 包 Java 文件（新建）

- **verification_commands**:
  - `test -f src/main/java/com/fj1/inspection/organization/OrganizationService.java && test -f src/main/java/com/fj1/inspection/organization/OrganizationController.java`
  - `grep "tree" src/main/java/com/fj1/inspection/organization/OrganizationController.java`
  - `grep "circular\|CIRCULAR" src/main/java/com/fj1/inspection/organization/OrganizationServiceImpl.java`
  - `grep "children" src/main/java/com/fj1/inspection/organization/dto/OrganizationTreeResponse.java`
  - `mvn compile -q`

- **verification_evidence_expected**: 7端点含/tree和/by-type；循环引用检测；树形含children；mvn compile

- **out_of_scope**: 前端树页面(TASK-18)、名称快照业务消费（后续WI）

---

### TASK-10 Role + Permission 管理 Service + Controller + RbacService

- **task_id**: TASK-10
- **refs**: [REQ-WI0001-020~032,071, DD-18, DD-22(#13~20)]
- **depends_on**: [TASK-5, TASK-6]

**context_block**:
- **What**: RoleService+RoleController（5端点）+ PermissionController（3端点）+ RbacService（权限叠加计算+Caffeine缓存）+ DTOs
- **Why**: RBAC权限引擎核心（DD-18，REQ-020~032）
- **Where**:
  - allowed_write_files: `src/main/java/com/fj1/inspection/role/RoleService.java`, `RoleServiceImpl.java`, `RoleController.java`, `PermissionController.java`, `RbacService.java`, `src/main/java/com/fj1/inspection/role/dto/CreateRoleRequest.java`, `RoleResponse.java`, `UpdateRolePermissionsRequest.java`, `CreatePermissionRequest.java`, `PermissionResponse.java`
  - forbidden_files: 其他模块
- **Constraints**: 8端点（DD-22 #13~20）；角色停用：预置不可停用（BuiltinRoleCannotDeactivateException），有启用关联拒绝（Q2）；权限分配：PUT /roles/{id}/permissions设置权限集合+变更差异日志；RbacService.getUserProjectPermissions：查UserProjectRole→role_permissions→收集permission_code→SYSTEM_ADMIN全集→Caffeine缓存5min；权限叠加：多角色取并集；所有写操作@OperationLog
- **Done When**: 10文件存在；8端点完整；预置角色保护；权限分配含差异日志；RbacService含缓存；mvn compile

- **expected_file_changes**: 10 个 role 包 Java 文件（新建）

- **verification_commands**:
  - `test -f src/main/java/com/fj1/inspection/role/RoleService.java && test -f src/main/java/com/fj1/inspection/role/RbacService.java`
  - `grep "Caffeine" src/main/java/com/fj1/inspection/role/RbacService.java`
  - `grep "is_builtin" src/main/java/com/fj1/inspection/role/RoleServiceImpl.java`
  - `grep "categories" src/main/java/com/fj1/inspection/role/PermissionController.java`
  - `mvn compile -q`

- **verification_evidence_expected**: RbacService含Caffeine缓存；预置角色保护；权限三分类查询；mvn compile

- **out_of_scope**: 用户角色分配(TASK-12)、前端(TASK-20)

---

### TASK-11 Project 管理 Service + Controller

- **task_id**: TASK-11
- **refs**: [REQ-WI0001-050~055,080,101, REQ-WI0001-C03, DD-24(#28~35)]
- **depends_on**: [TASK-5, TASK-6]

**context_block**:
- **What**: ProjectService+ProjectServiceImpl+ProjectController（8端点：CRUD+配置+结束/重开）+ DTOs
- **Why**: 项目业务容器（REQ-050~055/080/101，DD-24 #28~35）
- **Where**:
  - allowed_write_files: `src/main/java/com/fj1/inspection/project/ProjectService.java`, `ProjectServiceImpl.java`, `ProjectController.java`, `src/main/java/com/fj1/inspection/project/dto/CreateProjectRequest.java`, `UpdateProjectRequest.java`, `ProjectResponse.java`, `ProjectQueryRequest.java`, `ProjectConfigResponse.java`, `UpdateProjectConfigRequest.java`, `ReopenChangeRequest.java`, `CompleteProjectRequest.java`
  - forbidden_files: 其他模块
- **Constraints**: 8端点（DD-24 #28~35）；创建：project_name非空+client_org_id非空启用+默认IN_PROGRESS+可选specialties多选；列表查询：按UserProjectRole过滤用户有角色的项目；详情须ProjectAccessChecker校验project_id权限；项目结束：status=COMPLETED；变更重开：已结束时填写原因开启（change_permission_open=true）；项目配置：创建时自动关联默认模板；时区默认Asia/Shanghai；@PreAuthorize：列表已认证/详情项目级RBAC/写操作project:manage；所有写操作@OperationLog
- **Done When**: 11文件存在；8端点完整；项目列表按权限过滤；详情含project_id校验；结束/重开含原因留痕；mvn compile

- **expected_file_changes**: 11 个 project 包 Java 文件（新建）

- **verification_commands**:
  - `test -f src/main/java/com/fj1/inspection/project/ProjectService.java && test -f src/main/java/com/fj1/inspection/project/ProjectController.java`
  - `grep "config" src/main/java/com/fj1/inspection/project/ProjectController.java`
  - `grep "reopen" src/main/java/com/fj1/inspection/project/ProjectController.java`
  - `grep "ProjectAccessChecker" src/main/java/com/fj1/inspection/project/ProjectServiceImpl.java`
  - `mvn compile -q`

- **verification_evidence_expected**: 8端点含/config和/reopen-change；ProjectAccessChecker集成；项目权限过滤；mvn compile

- **out_of_scope**: 参建单位(TASK-12)、成员管理(TASK-12)、前端(TASK-19)

---

### TASK-12 ProjectOrganization + UserProjectRole 管理 Service + Controller

- **task_id**: TASK-12
- **refs**: [REQ-WI0001-060~074, REQ-WI0001-C03, DD-24(#36~40), DD-25(#41~45)]
- **depends_on**: [TASK-5, TASK-6, TASK-9]

**context_block**:
- **What**: ProjectOrganizationService+Controller（5端点）+ UserProjectRoleService+Controller（4端点）+ DTOs；含参建单位关联+检查员绑定校验+跨组织借调
- **Why**: 项目参建单位和成员角色关联（REQ-060~074）
- **Where**:
  - allowed_write_files: `src/main/java/com/fj1/inspection/project/ProjectOrganizationService.java`, `ProjectOrganizationServiceImpl.java`, `ProjectOrganizationController.java`, `src/main/java/com/fj1/inspection/project/UserProjectRoleService.java`, `UserProjectRoleServiceImpl.java`, `UserProjectRoleController.java`, `src/main/java/com/fj1/inspection/project/dto/CreateProjectOrganizationRequest.java`, `ProjectOrganizationResponse.java`, `AssignMemberRequest.java`, `MemberResponse.java`, `SecondmentConfirmRequest.java`
  - forbidden_files: ProjectService/ProjectController(TASK-11)
- **Constraints**: PO端点5个（DD-24 #36~40）；UPR端点4个+1个用户项目列表（DD-25 #41~45）；参建单位：project_role合法10类+防重复(Q4唯一索引)+is_default唯一(Q5)；检查执行单位绑定：org_type=THIRD_PARTY_INSPECTOR+project_role=INSPECTION_EXECUTOR；成员分配：用户启用+项目存在+角色启用+防重复；检查员绑定校验（REQ-072）：检查user.org_id是否∈项目INSPECTION_EXECUTOR组织→不属于则is_secondment=true+必须填写secondment_reason（REQ-073）；一人多角色支持（REQ-071）；停用软停用+生成OperationLog
- **Done When**: 11文件存在；9端点完整；参建单位防重复+默认唯一；检查员绑定+借调流程；一人多角色；mvn compile

- **expected_file_changes**: 11 个 project 包 Java 文件（新建）

- **verification_commands**:
  - `test -f src/main/java/com/fj1/inspection/project/ProjectOrganizationService.java && test -f src/main/java/com/fj1/inspection/project/UserProjectRoleService.java`
  - `grep "secondment\|is_secondment" src/main/java/com/fj1/inspection/project/UserProjectRoleServiceImpl.java`
  - `grep "INSPECTION_EXECUTOR" src/main/java/com/fj1/inspection/project/UserProjectRoleServiceImpl.java`
  - `grep "is_default" src/main/java/com/fj1/inspection/project/ProjectOrganizationServiceImpl.java`
  - `mvn compile -q`

- **verification_evidence_expected**: 9端点完整；检查员绑定校验+借调逻辑；is_default唯一；mvn compile

- **out_of_scope**: 前端(TASK-20)

---

### TASK-13 OperationLog AOP 切面 + log_hash + 审计日志 API

- **task_id**: TASK-13
- **refs**: [REQ-WI0001-081,090,091, REQ-WI0001-N05, DD-26(#46~49), DD-27,28,29]
- **depends_on**: [TASK-3, TASK-6]

**context_block**:
- **What**: @OperationLog自定义注解+OperationLogAspect(AOP切面)+LogHashCalculator(SHA-256链式)+OperationLogController(4只读端点+hash链验证)+AuditConfig+DTOs
- **Why**: 审计留痕+防篡改（REQ-090/091/N05，DD-27/28/29）
- **Where**:
  - allowed_write_files: `src/main/java/com/fj1/inspection/audit/annotation/OperationLog.java`, `src/main/java/com/fj1/inspection/audit/aspect/OperationLogAspect.java`, `src/main/java/com/fj1/inspection/audit/LogHashCalculator.java`, `src/main/java/com/fj1/inspection/audit/OperationLogController.java`, `src/main/java/com/fj1/inspection/config/AuditConfig.java`, `src/main/java/com/fj1/inspection/audit/dto/OperationLogResponse.java`, `HashVerifyResponse.java`
  - forbidden_files: 业务Controller/Service
- **Constraints**: @OperationLog注解：@Target(METHOD)+@Retention(RUNTIME)；OperationLogAspect @Aspect @Component @AfterReturning+@Async(线程池auditTaskExecutor)；LogHashCalculator：content串拼接→GENESIS 64个0→SHA-256(content|prev_log_hash)；OperationLogController：GET /api/operation-logs(分页)、/api/operation-logs/{id}、/api/projects/{projectId}/operation-logs(项目级RBAC)、/api/operation-logs/hash-chain/verify（逐条重算比对）；**无POST/PUT/DELETE**(REQ-091)；越权留痕(REQ-081)：isOverride=true+operation_reason非空；AuditConfig：@EnableAsync+线程池auditTaskExecutor
- **Done When**: 7文件存在；@OperationLog注解完整；AOP切面@AfterReturning+@Async；SHA-256链式哈希；4只读端点+哈希验证；mvn compile

- **expected_file_changes**: 7 个 audit/config Java 文件（新建）

- **verification_commands**:
  - `test -f src/main/java/com/fj1/inspection/audit/annotation/OperationLog.java && test -f src/main/java/com/fj1/inspection/audit/LogHashCalculator.java && test -f src/main/java/com/fj1/inspection/audit/OperationLogController.java`
  - `grep "SHA-256" src/main/java/com/fj1/inspection/audit/LogHashCalculator.java`
  - `grep "@AfterReturning" src/main/java/com/fj1/inspection/audit/aspect/OperationLogAspect.java`
  - `grep "hash-chain/verify" src/main/java/com/fj1/inspection/audit/OperationLogController.java`
  - `mvn compile -q`

- **verification_evidence_expected**: AOP切面+@Async；SHA-256链式哈希；hash-chain/verify端点；无POST/PUT/DELETE；mvn compile

- **out_of_scope**: 业务方法上的@OperationLog标注（各task自行标注）

---

### TASK-14 数据字典与系统 API

- **task_id**: TASK-14
- **refs**: [REQ-WI0001-110, DD-26(#50~52)]
- **depends_on**: [TASK-5, TASK-6]

**context_block**:
- **What**: DictController(字典查询)、SystemController(系统信息+健康检查)、SystemConfigService(系统配置读取)
- **Why**: 前端字典数据和系统运维接口（DD-26 #50~52）
- **Where**:
  - allowed_write_files: `src/main/java/com/fj1/inspection/seed/SystemConfigService.java`, `DictController.java`, `src/main/java/com/fj1/inspection/system/SystemController.java`, `src/main/java/com/fj1/inspection/seed/dto/DictResponse.java`, `src/main/java/com/fj1/inspection/system/dto/SystemInfoResponse.java`
  - forbidden_files: 业务Controller/Service
- **Constraints**: GET /api/dict/{category}（返回字典项，支持organization_type/project_role/specialty/issue_category/severity/photo_type/report_type）；GET /api/system/info（版本+运行时间+DB状态）；GET /api/system/health（公开）；SystemConfigService.getIntValue/getBoolValue(getValue)；所有配置从system_configs表读取
- **Done When**: 5文件存在；3端点完整；SystemConfigService可读取15项系统配置；mvn compile

- **expected_file_changes**: 5 个 seed/system Java 文件（新建）

- **verification_commands**:
  - `test -f src/main/java/com/fj1/inspection/seed/SystemConfigService.java && test -f src/main/java/com/fj1/inspection/seed/DictController.java && test -f src/main/java/com/fj1/inspection/system/SystemController.java`
  - `grep "dict" src/main/java/com/fj1/inspection/seed/DictController.java`
  - `grep "health" src/main/java/com/fj1/inspection/system/SystemController.java`
  - `mvn compile -q`

- **verification_evidence_expected**: 3端点完整；health公开；mvn compile

- **out_of_scope**: 字典增删改（Flyway种子数据管理）、系统配置管理界面

---

### TASK-15 前端项目初始化（路由 + Pinia + axios + JWT 拦截器 + 权限指令）

- **task_id**: TASK-15
- **refs**: [REQ-WI0001-C01, DD-3, DD-32, DD-33, DD-34, DD-35]
- **depends_on**: [TASK-7]

**context_block**:
- **What**: 初始化 Vue3+TS+Vite+ElementPlus 前端项目，含 router(守卫)、Pinia stores(auth/permission/app)、axios封装(JWT拦截器)、v-permission/v-project-permission指令、usePermission composable、7个API模块用户、types
- **Why**: 前端骨架（DD-3/32~35），所有前端页面基础
- **Where**:
  - allowed_write_files: `frontend/package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `env.d.ts`, `frontend/src/main.ts`, `App.vue`, `router/index.ts`, `stores/auth.ts`, `stores/permission.ts`, `stores/app.ts`, `api/request.ts`, `api/auth.ts`, `api/user.ts`, `api/organization.ts`, `api/project.ts`, `api/role.ts`, `api/audit.ts`, `api/dict.ts`, `directives/v-permission.ts`, `composables/usePermission.ts`, `types/auth.ts`, `types/common.ts`, `types/user.ts`, `types/organization.ts`, `types/project.ts`, `types/role.ts`, `utils/storage.ts`
  - forbidden_files: `.specforge/**`, 后端文件, views/页面
- **Constraints**: Vue3 Composition API；路由守卫：公开路由放行→检查JWT→获取用户信息→无token跳/login；authStore: accessToken/refreshToken/currentUser/mustChangePassword+login/logout/refreshToken/fetchCurrentUser；permissionStore: systemPermissions(Set)+isSystemAdmin+projectPermissions(Map)+loadProjectPermissions/checkProjectAccess；axios拦截器：请求加Bearer头，响应401→refresh→失败跳/login，403→权限不足提示；v-permission指令：检查系统级权限；v-project-permission：检查项目级权限；usePermission: can/canProject/isSystemAdmin；依赖：vue3/vue-router/pinia/axios/element-plus/@element-plus/icons-vue；所有API方法返回类型安全Promise<ApiResponse<T>>
- **Done When**: ~29文件存在；`npm install`成功；`npm run build`成功

- **expected_file_changes**: 29 个 frontend 文件（新建）

- **verification_commands**:
  - `test -f frontend/package.json && test -f frontend/src/main.ts && test -f frontend/src/router/index.ts && test -f frontend/src/stores/auth.ts && test -f frontend/src/api/request.ts && test -f frontend/src/directives/v-permission.ts`
  - `cd frontend && npm install 2>&1 | tail -3`
  - `cd frontend && npm run build 2>&1 | tail -3`

- **verification_evidence_expected**: npm install 退出码0；npm run build 退出码0

- **out_of_scope**: 页面组件(TASK-16~20)、国际化、主题定制

---

### TASK-16 登录页

- **task_id**: TASK-16
- **refs**: [REQ-WI0001-001,111, DD-32]
- **depends_on**: [TASK-15]

**context_block**:
- **What**: /login页面：登录表单+锁定提示+首次登录强制改密弹窗+默认管理员初始设密引导
- **Why**: 用户系统入口
- **Where**:
  - allowed_write_files: `frontend/src/views/login/index.vue`, `frontend/src/views/login/components/LoginForm.vue`, `InitialSetupDialog.vue`, `ForcePasswordChangeDialog.vue`
  - forbidden_files: 后端文件、其他页面
- **Constraints**: 路由meta:{public:true}；登录表单login_name+password(show-password)+必填校验；登录失败统一"登录名或密码错误"（REQ-001AC2）；锁定423提示"15分钟后重试"；首次登录mustChangePassword→弹出强制改密弹窗；默认管理员needInitialSetup→弹出初始设密弹窗；居中卡片布局；Element Plus组件；Vue3 Composition API
- **Done When**: 4文件存在；`npm run build`成功

- **expected_file_changes**: 4 个 login Vue 文件（新建）

- **verification_commands**:
  - `test -f frontend/src/views/login/index.vue && test -f frontend/src/views/login/components/LoginForm.vue`
  - `grep "登录名或密码错误" frontend/src/views/login/components/LoginForm.vue`
  - `grep "initial-setup\|InitialSetup" frontend/src/views/login/index.vue`
  - `cd frontend && npm run build 2>&1 | tail -3`

- **verification_evidence_expected**: npm run build 退出码0

- **out_of_scope**: SSO/手机验证码（C02排除）

---

### TASK-17 用户管理页

- **task_id**: TASK-17
- **refs**: [REQ-WI0001-010~014, DD-32]
- **depends_on**: [TASK-15, TASK-8]

**context_block**:
- **What**: /system/users 页面：用户列表(分页+筛选)+新建/编辑对话框+停用/启用+会话注销+详情抽屉+dashboard页
- **Why**: 管理员用户管理界面
- **Where**:
  - allowed_write_files: `frontend/src/views/system/users/index.vue`, `components/UserTable.vue`, `components/UserFormDialog.vue`, `components/UserDetailDrawer.vue`, `composables/useUsers.ts`, `frontend/src/views/dashboard/index.vue`
  - forbidden_files: 后端文件、其他页面
- **Constraints**: 路由meta:{permission:'system:admin'}；el-table分页(默认20)+筛选(姓名/登录名/组织/状态)；新建/编辑el-dialog含login_name(编辑时disabled)/display_name/phone/email/org_id；停用/启用el-popconfirm；会话注销el-popconfirm；详情el-drawer；v-permission控制操作按钮
- **Done When**: 6文件存在；`npm run build`成功

- **expected_file_changes**: 6 个 Vue/TS 文件（新建）

- **verification_commands**:
  - `test -f frontend/src/views/system/users/index.vue && test -f frontend/src/views/dashboard/index.vue`
  - `grep "login_name" frontend/src/views/system/users/components/UserFormDialog.vue`
  - `grep "revoke-session\|注销会话" frontend/src/views/system/users/index.vue`
  - `cd frontend && npm run build 2>&1 | tail -3`

- **verification_evidence_expected**: npm run build 退出码0

- **out_of_scope**: 用户角色项目分配(TASK-20)

---

### TASK-18 组织机构管理页（树形组件）

- **task_id**: TASK-18
- **refs**: [REQ-WI0001-040~046, DD-32]
- **depends_on**: [TASK-15, TASK-9]

**context_block**:
- **What**: /system/organizations 页面：el-tree树形展示+新建/编辑/停用节点+按类型筛选+详情抽屉
- **Why**: 管理员组织主数据管理界面
- **Where**:
  - allowed_write_files: `frontend/src/views/system/organizations/index.vue`, `components/OrgTree.vue`, `components/OrgFormDialog.vue`, `components/OrgDetailDrawer.vue`, `composables/useOrganizations.ts`
  - forbidden_files: 后端文件、其他页面
- **Constraints**: 路由meta:{permission:'system:admin'}；el-tree从/api/organizations/tree加载；节点展示name+type label+status标签；按type枚举筛选；新建/编辑el-dialog含name/type/short_name/contact_name/contact_phone/region；停用有子节点警告；详情el-drawer；v-permission='organization:maintain'
- **Done When**: 5文件存在；`npm run build`成功

- **expected_file_changes**: 5 个 Vue/TS 文件（新建）

- **verification_commands**:
  - `test -f frontend/src/views/system/organizations/index.vue && test -f frontend/src/views/system/organizations/components/OrgTree.vue`
  - `grep "el-tree" frontend/src/views/system/organizations/components/OrgTree.vue`
  - `grep "tree" frontend/src/views/system/organizations/composables/useOrganizations.ts`
  - `cd frontend && npm run build 2>&1 | tail -3`

- **verification_evidence_expected**: npm run build 退出码0

- **out_of_scope**: 拖拽排序(V1可选)

---

### TASK-19 项目管理页 + 项目配置页

- **task_id**: TASK-19
- **refs**: [REQ-WI0001-050~055,101, DD-32]
- **depends_on**: [TASK-15, TASK-11]

**context_block**:
- **What**: /projects列表页+/projects/:projectId详情页(Tabs:基本信息/配置/参建单位占位/成员占位)
- **Why**: 项目管理主界面
- **Where**:
  - allowed_write_files: `frontend/src/views/projects/index.vue`, `detail.vue`, `components/ProjectTable.vue`, `components/ProjectFormDialog.vue`, `components/ProjectDetail.vue`, `components/ProjectConfigPanel.vue`, `composables/useProjects.ts`
  - forbidden_files: 后端文件、其他页面
- **Constraints**: 路由/projects(已认证)+/projects/:id(项目级RBAC)；列表el-table+分页含权限过滤(后端)；筛选名称/状态；新建el-dialog含project_name/code/client_org_id(组织选择器)/specialties多选/inspection_scope；详情Tabs布局：基本信息(已结束禁用编辑)+配置面板(全部配置项含时区)+参建单位(占位)+成员(占位)；项目结束确认弹窗；变更重开弹窗填原因；v-permission='project:manage'
- **Done When**: 7文件存在；`npm run build`成功

- **expected_file_changes**: 7 个 Vue/TS 文件（新建）

- **verification_commands**:
  - `test -f frontend/src/views/projects/index.vue && test -f frontend/src/views/projects/detail.vue`
  - `grep "reopen\|重开" frontend/src/views/projects/detail.vue`
  - `grep "timezone\|时区" frontend/src/views/projects/components/ProjectConfigPanel.vue`
  - `grep "tab\|Tabs" frontend/src/views/projects/detail.vue`
  - `cd frontend && npm run build 2>&1 | tail -3`

- **verification_evidence_expected**: npm run build 退出码0

- **out_of_scope**: 参建单位/成员管理(TASK-20)

---

### TASK-20 角色权限管理页 + 用户角色分配页

- **task_id**: TASK-20
- **refs**: [REQ-WI0001-020~032,060~074, DD-32]
- **depends_on**: [TASK-15, TASK-10, TASK-12]

**context_block**:
- **What**: /system/roles(角色列表+权限分配树)+/system/permissions(权限点列表)+项目参建单位Tab(ProjectOrganizationsPanel)+项目成员Tab(ProjectMembersPanel+AssignMemberDialog+SecondmentConfirmDialog)
- **Why**: RBAC配置界面+项目参与单位/成员管理
- **Where**:
  - allowed_write_files: `frontend/src/views/system/roles/index.vue`, `components/RoleTable.vue`, `components/RoleFormDialog.vue`, `components/PermissionTree.vue`, `frontend/src/views/system/permissions/index.vue`, `frontend/src/views/projects/components/ProjectOrganizationsPanel.vue`, `ProjectMembersPanel.vue`, `AssignMemberDialog.vue`, `SecondmentConfirmDialog.vue`, `composables/useProjectOrganizations.ts`, `useProjectMembers.ts`, `frontend/src/views/system/roles/composables/useRoles.ts`
  - forbidden_files: 后端文件、其他页面
- **Constraints**: 角色管理：列表含is_builtin标记，预置角色禁用停用按钮+提示；权限分配el-tree(check-strictly)三分类(BASIC/BUSINESS/FLOW)勾选PUT权限；角色停用检查启用关联；权限点列表按category分组+筛选；参建单位Tab：展示关联组织列表+添加(选择组织+role)+设置/取消默认+停用；成员Tab：展示成员及其角色+分配角色(选择用户+角色)+停用移除；检查员分配触发借调：后端409→SecondmentConfirmDialog弹窗填原因→重新提交；v-permission控制操作按钮
- **Done When**: 12文件存在；`npm run build`成功

- **expected_file_changes**: 12 个 Vue/TS 文件（新建）

- **verification_commands**:
  - `test -f frontend/src/views/system/roles/index.vue && test -f frontend/src/views/system/permissions/index.vue && test -f frontend/src/views/projects/components/ProjectOrganizationsPanel.vue && test -f frontend/src/views/projects/components/ProjectMembersPanel.vue`
  - `grep "PermissionTree" frontend/src/views/system/roles/index.vue`
  - `grep "is_builtin\|预置" frontend/src/views/system/roles/components/RoleTable.vue`
  - `grep "secondment\|借调" frontend/src/views/projects/components/AssignMemberDialog.vue`
  - `cd frontend && npm run build 2>&1 | tail -3`

- **verification_evidence_expected**: npm run build 退出码0；借调弹窗+预置角色保护+权限树+参建单位/成员管理全部到位

- **out_of_scope**: 操作日志查看页、权限矩阵可视化

---

## 附录：任务统计

| 指标 | 值 |
|------|-----|
| 总任务数 | 20 |
| 后端任务 | 14（TASK-1~14） |
| 前端任务 | 6（TASK-15~20） |
| 预期总文件数 | ~190（后端~115+前端~75） |
| 并行批次 | 3 批 |
| 最大并行度 | Batch2（5个后端业务模块） |
| 所有任务含 context_block | ✅ |
| 所有任务含 verification_commands | ✅ |
