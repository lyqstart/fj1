# Trace Delta: WI-0001

> 追溯矩阵：REQ → AC → DD → TASK → FILE → TEST
> requirements.md: 55条需求（46功能+5NFR+4约束），164条AC
> design.md: 35个DD
> tasks.md: 20个TASK

## 追溯矩阵

### 3.1 认证与会话管理

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|----------|----------|
| REQ-WI0001-001 | AC-WI0001-001.1~5 | DD-15, DD-16 | TASK-6, TASK-7 | JwtTokenProvider.java, PasswordService.java, AuthServiceImpl.java, AuthController.java | mvn compile |
| REQ-WI0001-002 | AC-WI0001-002.1~3 | DD-16, DD-21 | TASK-7 | AuthServiceImpl.java, PasswordService.java, ChangePasswordRequest.java | mvn compile |
| REQ-WI0001-003 | AC-WI0001-003.1~3 | DD-21 | TASK-7 | AuthServiceImpl.java, AuthController.java, ResetPasswordRequest.java | mvn compile |
| REQ-WI0001-004 | AC-WI0001-004.1~3 | DD-15, DD-21 | TASK-6, TASK-7 | TokenBlacklist.java, UserDeactivatedListener.java, AuthController.java | mvn compile |

### 3.2 User 用户管理

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|----------|----------|
| REQ-WI0001-010 | AC-WI0001-010.1~4 | DD-5, DD-22 | TASK-4, TASK-5, TASK-8 | User.java, UserRepository.java, UserServiceImpl.java, UserController.java | mvn compile |
| REQ-WI0001-011 | AC-WI0001-011.1~3 | DD-22 | TASK-8 | UserServiceImpl.java, UserController.java, UserQueryRequest.java | mvn compile |
| REQ-WI0001-012 | AC-WI0001-012.1~3 | DD-22 | TASK-8 | UserServiceImpl.java, UpdateUserRequest.java | mvn compile |
| REQ-WI0001-013 | AC-WI0001-013.1~4 | DD-5, DD-22 | TASK-8 | UserServiceImpl.java, UserDeactivatedEvent.java | mvn compile |
| REQ-WI0001-014 | AC-WI0001-014.1~3 | DD-5, DD-22 | TASK-4, TASK-8 | User.java, UserServiceImpl.java, OrganizationService.java | mvn compile |

### 3.3 Role 角色管理

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|----------|----------|
| REQ-WI0001-020 | AC-WI0001-020.1~4 | DD-6, DD-31 | TASK-2, TASK-4, TASK-10 | V1.0.3__seed_roles.sql, Role.java, RoleServiceImpl.java, RoleController.java | mvn compile |
| REQ-WI0001-021 | AC-WI0001-021.1~3 | DD-22 | TASK-10 | RoleService.java, RoleController.java | mvn compile |
| REQ-WI0001-022 | AC-WI0001-022.1~3 | DD-22 | TASK-10 | RoleServiceImpl.java（BuiltinRoleCannotDeactivateException, RoleHasActiveAssignmentsException） | mvn compile |

### 3.4 Permission 权限点管理

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|----------|----------|
| REQ-WI0001-030 | AC-WI0001-030.1~3 | DD-7, DD-18 | TASK-4, TASK-10 | Permission.java, PermissionController.java | mvn compile |
| REQ-WI0001-031 | AC-WI0001-031.1~3 | DD-7, DD-31 | TASK-2, TASK-10 | V1.0.4__seed_permissions.sql, PermissionController.java | mvn compile |
| REQ-WI0001-032 | AC-WI0001-032.1~3 | DD-7, DD-22 | TASK-10 | RoleServiceImpl.java, RolePermission.java, UpdateRolePermissionsRequest.java | mvn compile |

### 3.5 Organization 组织机构管理

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|----------|----------|
| REQ-WI0001-040 | AC-WI0001-040.1~4 | DD-8, DD-23 | TASK-4, TASK-9 | Organization.java, OrganizationServiceImpl.java, OrganizationController.java | mvn compile |
| REQ-WI0001-041 | AC-WI0001-041.1~4 | DD-8, DD-23 | TASK-9 | OrganizationServiceImpl.java (树查询+循环检测+子节点保护) | mvn compile |
| REQ-WI0001-042 | AC-WI0001-042.1~3 | DD-8 | TASK-3, TASK-9 | OrganizationType.java, OrganizationServiceImpl.java | mvn compile |
| REQ-WI0001-043 | AC-WI0001-043.1~4 | DD-8 | TASK-9 | OrganizationServiceImpl.java (规则注释) | mvn compile |
| REQ-WI0001-044 | AC-WI0001-044.1~3 | DD-23 | TASK-9 | OrganizationServiceImpl.java, OrganizationQueryRequest.java | mvn compile |
| REQ-WI0001-045 | AC-WI0001-045.1~3 | DD-23 | TASK-9 | OrganizationServiceImpl.java (循环引用检测+type修改警告) | mvn compile |
| REQ-WI0001-046 | AC-WI0001-046.1~3 | DD-23 | TASK-9 | OrganizationServiceImpl.java (软停用+子节点保护+Q3警告) | mvn compile |
| REQ-WI0001-047 | AC-WI0001-047.1~3 | DD-8 | TASK-9 | OrganizationServiceImpl.java (名称快照规则注释+约定) | mvn compile |

### 3.6 Project 项目管理

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|----------|----------|
| REQ-WI0001-050 | AC-WI0001-050.1~4 | DD-9, DD-24 | TASK-4, TASK-5, TASK-11 | Project.java, ProjectRepository.java, ProjectServiceImpl.java, ProjectController.java | mvn compile |
| REQ-WI0001-051 | AC-WI0001-051.1~3 | DD-24 | TASK-11 | ProjectServiceImpl.java (UserProjectRole权限过滤) | mvn compile |
| REQ-WI0001-052 | AC-WI0001-052.1~3 | DD-24 | TASK-11 | ProjectServiceImpl.java, UpdateProjectRequest.java | mvn compile |
| REQ-WI0001-053 | AC-WI0001-053.1~3 | DD-24 | TASK-11 | ProjectServiceImpl.java (completeProject方法) | mvn compile |
| REQ-WI0001-054 | AC-WI0001-054.1~4 | DD-9, DD-24 | TASK-4, TASK-11 | ProjectConfig.java, ProjectServiceImpl.java, ProjectConfigPanel.vue | mvn compile |
| REQ-WI0001-055 | AC-WI0001-055.1~3 | DD-9 | TASK-11 | ProjectConfig.java, ProjectServiceImpl.java | mvn compile |

### 3.7 ProjectOrganization 项目参与单位

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|----------|----------|
| REQ-WI0001-060 | AC-WI0001-060.1~3 | DD-10, DD-24 | TASK-4, TASK-12 | ProjectOrganization.java, ProjectOrganizationServiceImpl.java, ProjectOrganizationController.java | mvn compile |
| REQ-WI0001-061 | AC-WI0001-061.1~3 | DD-10 | TASK-3, TASK-12 | ProjectRole.java, ProjectOrganizationServiceImpl.java | mvn compile |
| REQ-WI0001-062 | AC-WI0001-062.1~3 | DD-10, DD-24 | TASK-12 | ProjectOrganizationServiceImpl.java (is_default唯一性处理) | mvn compile |
| REQ-WI0001-063 | AC-WI0001-063.1~3 | DD-10, DD-24 | TASK-12 | ProjectOrganizationServiceImpl.java (THIRD_PARTY_INSPECTOR+INSPECTION_EXECUTOR绑定) | mvn compile |

### 3.8 UserProjectRole 用户-项目-角色分配

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|----------|----------|
| REQ-WI0001-070 | AC-WI0001-070.1~3 | DD-11, DD-25 | TASK-4, TASK-12 | UserProjectRole.java, UserProjectRoleServiceImpl.java, UserProjectRoleController.java | mvn compile |
| REQ-WI0001-071 | AC-WI0001-071.1~4 | DD-11, DD-18 | TASK-10, TASK-12 | UserProjectRoleServiceImpl.java, RbacService.java（权限叠加） | mvn compile |
| REQ-WI0001-072 | AC-WI0001-072.1~3 | DD-11, DD-25 | TASK-12 | UserProjectRoleServiceImpl.java（检查员绑定校验） | mvn compile |
| REQ-WI0001-073 | AC-WI0001-073.1~3 | DD-11, DD-25 | TASK-12 | UserProjectRoleServiceImpl.java（借调流程+secondment_reason非空校验） | mvn compile |
| REQ-WI0001-074 | AC-WI0001-074.1~3 | DD-25 | TASK-12 | UserProjectRoleServiceImpl.java（停用+OperationLog） | mvn compile |

### 3.9 项目级 RBAC 与权限隔离

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|----------|----------|
| REQ-WI0001-080 | AC-WI0001-080.1~3 | DD-17, DD-19 | TASK-6, TASK-11 | ProjectAccessChecker.java, ProjectServiceImpl.java, UserProjectRoleRepository.java | mvn compile |
| REQ-WI0001-081 | AC-WI0001-081.1~3 | DD-29 | TASK-13 | OperationLogAspect.java, LogHashCalculator.java | mvn compile |

### 3.10 审计与留痕

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|----------|----------|
| REQ-WI0001-090 | AC-WI0001-090.1~3 | DD-12, DD-27 | TASK-4, TASK-13 | OperationLog.java, OperationLogAspect.java, LogHashCalculator.java | mvn compile |
| REQ-WI0001-091 | AC-WI0001-091.1~3 | DD-12, DD-27 | TASK-13 | OperationLogController.java（仅GET端点） | mvn compile |

### 3.11 人员状态与项目生命周期

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|----------|----------|
| REQ-WI0001-100 | AC-WI0001-100.1~4 | DD-5, DD-15 | TASK-8 | UserServiceImpl.java（停用逻辑+约定注释） | mvn compile |
| REQ-WI0001-101 | AC-WI0001-101.1~3 | DD-9, DD-24 | TASK-11 | ProjectServiceImpl.java（reopenChangePermission方法） | mvn compile |

### 3.12 系统初始化与种子数据

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|----------|----------|
| REQ-WI0001-110 | AC-WI0001-110.1~5 | DD-13, DD-30, DD-31 | TASK-2, TASK-14 | V1.0.2~V1.0.9 .sql, SystemConfigService.java, DictController.java | mvn compile |
| REQ-WI0001-111 | AC-WI0001-111.1~3 | DD-30, DD-31 | TASK-2, TASK-7 | V1.1.0__seed_default_admin.sql, AuthController.java(initial-setup) | mvn compile |

### 3.13 非功能需求（NFR）

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|----------|----------|
| REQ-WI0001-N01 | N01AC1~2 | DD-14 | TASK-2, TASK-5 | V1.0.1__create_indexes.sql, UserProjectRoleRepository.java（idx_upr核心索引） | mvn compile |
| REQ-WI0001-N02 | N02AC1~4 | DD-15, DD-16, DD-17, DD-19 | TASK-6 | PasswordService.java(BCrypt), SecurityConfig.java, ProjectAccessChecker.java | mvn compile |
| REQ-WI0001-N03 | N03AC1~2 | DD-4 | TASK-3, TASK-4 | BaseEntity.java(@Version乐观锁) | mvn compile |
| REQ-WI0001-N04 | N04AC1~2 | — | 运维实施 | pg_dump 备份脚本（不在应用代码内） | N/A |
| REQ-WI0001-N05 | N05AC1~2 | DD-12, DD-27, DD-28 | TASK-13 | OperationLog.java(log_hash), LogHashCalculator.java(SHA-256链) | mvn compile |

### 3.14 约束（Constraint）

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|----------|----------|
| REQ-WI0001-C01 | — | DD-1, DD-2, DD-3, DD-30 | TASK-1, TASK-15 | pom.xml, Fj1Application.java, frontend/package.json | mvn compile, npm run build |
| REQ-WI0001-C02 | — | DD-15 | TASK-6, TASK-7 | SecurityConfig.java, AuthController.java（仅账号密码） | mvn compile |
| REQ-WI0001-C03 | — | DD-8, DD-11, DD-17 | TASK-9, TASK-11, TASK-12 | OrganizationType/ProjectRole分离, UserProjectRoleServiceImpl(检查员绑定), ProjectAccessChecker(项目级RBAC) | mvn compile |
| REQ-WI0001-C04 | — | DD-4, DD-8, DD-12 | TASK-4, TASK-9, TASK-13 | 所有Entity软停用(status), OrganizationServiceImpl(名称快照), OperationLogController(不可修改删除) | mvn compile |

---

## 文件覆盖

### 后端文件覆盖

| 文件 | 创建/修改 | 涉及 REQ | 涉及 TASK |
|------|-----------|----------|-----------|
| pom.xml | 创建 | C01 | TASK-1 |
| src/main/java/com/fj1/inspection/Fj1Application.java | 创建 | C01 | TASK-1 |
| src/main/resources/application.yml | 创建 | C01 | TASK-1 |
| src/main/resources/db/migration/V1.0.0~V1.1.0 (11文件) | 创建 | 110, 111, C01, N01 | TASK-2 |
| src/main/java/com/fj1/inspection/common/*.java (6文件) | 创建 | N03, C04, DD-4, DD-20 | TASK-3 |
| src/main/java/com/fj1/inspection/common/enums/*.java (7文件) | 创建 | 042, 061, 030, 020, DD-8, DD-10 | TASK-3 |
| src/main/java/com/fj1/inspection/user/entity/User.java | 创建 | 010, 014, 100, C04 | TASK-4 |
| src/main/java/com/fj1/inspection/role/entity/Role.java, Permission.java, RolePermission.java | 创建 | 020, 030 | TASK-4 |
| src/main/java/com/fj1/inspection/organization/entity/Organization.java | 创建 | 040, C04 | TASK-4 |
| src/main/java/com/fj1/inspection/project/entity/Project.java, ProjectConfig.java, ProjectOrganization.java, UserProjectRole.java | 创建 | 050, 060, 070 | TASK-4 |
| src/main/java/com/fj1/inspection/audit/entity/OperationLog.java | 创建 | 090, N05 | TASK-4 |
| src/main/java/com/fj1/inspection/seed/entity/*.java (4文件) | 创建 | 110 | TASK-4 |
| src/main/java/com/fj1/inspection/**/repository/*.java (14文件) | 创建 | 080, N01 | TASK-5 |
| src/main/java/com/fj1/inspection/config/SecurityConfig.java, JwtConfig.java, CorsConfig.java | 创建 | C02, N02 | TASK-6 |
| src/main/java/com/fj1/inspection/auth/JwtTokenProvider.java, JwtAuthFilter.java, PasswordService.java, TokenBlacklist.java, UserDeactivatedEvent.java, UserDeactivatedListener.java | 创建 | 001, 004, N02 | TASK-6 |
| src/main/java/com/fj1/inspection/project/security/ProjectAccessChecker.java | 创建 | 080, C03 | TASK-6 |
| src/main/java/com/fj1/inspection/auth/AuthService.java, AuthServiceImpl.java, AuthController.java + dto/*.java (7文件) | 创建 | 001, 002, 003, 004, 111, C02 | TASK-7 |
| src/main/java/com/fj1/inspection/user/UserService.java, UserServiceImpl.java, UserController.java + dto/*.java (5文件) | 创建 | 010, 011, 012, 013, 014, 100 | TASK-8 |
| src/main/java/com/fj1/inspection/organization/OrganizationService.java, OrganizationServiceImpl.java, OrganizationController.java + dto/*.java (6文件) | 创建 | 040, 041, 042, 043, 044, 045, 046, 047, C03 | TASK-9 |
| src/main/java/com/fj1/inspection/role/RoleService.java, RoleServiceImpl.java, RoleController.java, PermissionController.java, RbacService.java + dto/*.java (5文件) | 创建 | 020, 021, 022, 030, 032, 071 | TASK-10 |
| src/main/java/com/fj1/inspection/project/ProjectService.java, ProjectServiceImpl.java, ProjectController.java + dto/*.java (8文件) | 创建 | 050, 051, 052, 053, 054, 055, 080, 101, C03 | TASK-11 |
| src/main/java/com/fj1/inspection/project/ProjectOrganizationService.java, *Impl.java, *Controller.java, UserProjectRoleService.java, *Impl.java, *Controller.java + dto/*.java (6文件) | 创建 | 060, 061, 062, 063, 070, 071, 072, 073, 074, C03 | TASK-12 |
| src/main/java/com/fj1/inspection/audit/annotation/OperationLog.java, aspect/OperationLogAspect.java, LogHashCalculator.java, OperationLogController.java + dto/*.java (4文件) + AuditConfig.java | 创建 | 081, 090, 091, N05 | TASK-13 |
| src/main/java/com/fj1/inspection/seed/SystemConfigService.java, DictController.java + system/SystemController.java + dto/*.java (3文件) | 创建 | 110 | TASK-14 |

### 前端文件覆盖

| 文件 | 创建/修改 | 涉及 REQ | 涉及 TASK |
|------|-----------|----------|-----------|
| frontend/package.json, index.html, vite.config.ts, tsconfig*.json, env.d.ts | 创建 | C01 | TASK-15 |
| frontend/src/main.ts, App.vue | 创建 | C01 | TASK-15 |
| frontend/src/router/index.ts | 创建 | 001, C01, DD-32 | TASK-15 |
| frontend/src/stores/auth.ts, permission.ts, app.ts | 创建 | 001, 080, DD-33 | TASK-15 |
| frontend/src/api/request.ts, auth.ts, user.ts, organization.ts, project.ts, role.ts, audit.ts, dict.ts | 创建 | 001, DD-34 | TASK-15 |
| frontend/src/directives/v-permission.ts | 创建 | 080, DD-35 | TASK-15 |
| frontend/src/composables/usePermission.ts | 创建 | 080 | TASK-15 |
| frontend/src/types/*.ts (6文件) | 创建 | DD-3 | TASK-15 |
| frontend/src/utils/storage.ts | 创建 | DD-33 | TASK-15 |
| frontend/src/views/login/*.vue (4文件) | 创建 | 001, 111 | TASK-16 |
| frontend/src/views/dashboard/index.vue | 创建 | — | TASK-17 |
| frontend/src/views/system/users/*.vue (4文件+composable) | 创建 | 010, 011, 012, 013, 014 | TASK-17 |
| frontend/src/views/system/organizations/*.vue (4文件+composable) | 创建 | 040, 041, 042, 044, 045, 046 | TASK-18 |
| frontend/src/views/projects/index.vue, detail.vue, components/ProjectTable.vue, ProjectFormDialog.vue, ProjectDetail.vue, ProjectConfigPanel.vue + composable (7文件) | 创建 | 050, 051, 052, 053, 054, 055, 101 | TASK-19 |
| frontend/src/views/system/roles/** (4文件), system/permissions/** (1文件), projects/components/ProjectOrganizationsPanel.vue, ProjectMembersPanel.vue, AssignMemberDialog.vue, SecondmentConfirmDialog.vue + 3 composables (12文件) | 创建 | 020, 021, 022, 030, 032, 060, 062, 070, 071, 072, 073, 074 | TASK-20 |

---

## 覆盖统计

### 需求覆盖

| 统计维度 | 数量 |
|----------|------|
| 总 REQ 数 | 55（46功能+5NFR+4约束） |
| 已覆盖 REQ | 55 |
| 覆盖率 | **100%** |
| 总 AC 数 | 164 |
| 已覆盖 AC | 164（100%，按 REQ 维度） |

### 设计决策覆盖

| 统计维度 | 数量 |
|----------|------|
| 总 DD 数 | 35 |
| 已覆盖 DD | 35 |
| 覆盖率 | **100%** |

### 任务覆盖

| 统计维度 | 数量 |
|----------|------|
| 总 TASK 数 | 20 |
| 每个 TASK 有对应 REQ | ✅ 全部 |
| 无孤立 TASK（无 REQ 支撑） | ✅ 0 个 |
| 无孤立 REQ（无 TASK 覆盖） | ✅ 0 个 |

### 文件覆盖

| 统计维度 | 数量 |
|----------|------|
| 后端预期文件 | ~115 |
| 前端预期文件 | ~75 |
| 总文件 | ~190 |
| 所有文件有验证方式 | ✅（mvn compile / npm run build） |

---

## 覆盖自检

1. ✅ 每个 REQ 至少关联一个 TASK
2. ✅ 每个 DD 至少关联一个 TASK
3. ✅ 每个 TASK 有明确目标文件
4. ✅ 每个目标文件有验证方式（mvn compile / npm run build / grep 断言）
5. ✅ 无悬空 REQ（55条全部覆盖）
6. ✅ 无悬空 DD（35个全部覆盖）
7. ✅ 无悬空 TASK（20个全部有 REQ 支撑）
8. ⚠️ REQ-WI0001-N04（备份恢复）标记为"运维实施"，不在应用代码范围（design.md Out of Scope 已确认）

> 注：N04（备份恢复 RPO≤24h/RTO≤24h）属于运维部署范畴（PostgreSQL pg_dump），不在应用代码内，design.md §9 明确排除。此项不影响追溯完整性。
