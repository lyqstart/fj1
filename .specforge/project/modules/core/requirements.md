---
requirements_format: ears
work_item: WI-0002
base_spec: WI-0001
change_type: enhancement_hardening
workflow_path: requirement_change_path
---

# WI-0002 差量需求 — 飞检现场管理系统产品化

> 本文档仅包含相对 WI-0001 baseline 的**差量需求**。WI-0001 已定义的 REQ-1~REQ-21、NFR-1~NFR-11、BR-1~BR-10、DD-1~DD-11 不在此重复，仅通过追溯引用。

## 1. 概述

### 1.1 变更背景

WI-0001 按 feature_spec 工作流交付了飞检现场管理系统的 286 个文件（后端 188 Java / Web 36 TS / Android 25 TS），通过了编译级验证（L4/L5）和 Close Gate。但验证仅停留在编译层面：

- Spring Boot 从未启动过（0 次运行）
- 数据库迁移从未执行过（0 次 Flyway）
- 任一 API 端点从未被调用过（0 次请求）
- 前端从未用真实后端联调过
- Android 端从未在设备上运行过
- 单元测试 0 个，集成测试 0 个
- 11 个已知功能 Gap（executor 自报 TODO）

### 1.2 本次 CR 目标

将"能编译的骨架"变成"能在服务器上实际运行、全流程端到端可用"的产品。具体：

1. 修复全部 11 个已知 Gap
2. 完成服务器环境首次部署（PG16 + JRE17 + systemd + Nginx）
3. 后端首次启动、Flyway 迁移、种子数据导入、API 可访问
4. Android 端 Debug Build 可运行（相机可用、本地存储可用）
5. 引入首个单元测试与集成测试
6. 全流程端到端验证通过

### 1.3 工作范围与边界

| 维度 | 本次范围 | 不在本次范围 |
|------|---------|-------------|
| 功能边界 | 不新增用户可见功能，不改变业务规则 | 新功能、V1.1 阶段 8-9（报告变更/统计看板） |
| 代码改动 | ~30-50 文件，集中在修复与配置 | 架构重构、技术栈变更 |
| 数据库 | PG13→16 全新安装（数据可丢弃，已确认） | 数据迁移、保留历史数据 |
| 基础设施 | 首次部署 systemd+Nginx+JRE17 | 多机、Docker、K8s |
| 测试 | 从 0 引入核心 Service 测试 | 高覆盖率、全量回归 |

### 1.4 已确认的关键约束（实测事实）

1. **sudo 受限**：sf_safe_bash 拒绝所有 sudo 调用，运维操作必须由用户手动执行幂等脚本
2. **服务器无 Java/Maven**：部署策略为本地构建 fat jar + scp（决策 D5-A）
3. **内存 3.6GB 紧张**：JVM 堆 ≤768m、PG shared_buffers ≤512MB
4. **Maven 默认 JDK8**：每次 Maven 命令必须前置 `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64`
5. **PostgreSQL 13.23 数据可丢弃**：用户已确认全新安装 PG16

### 1.5 已确认的用户决策

| 决策 | 选择 | 影响需求 |
|------|------|---------|
| D1 hours 起算点 | **从 confirmedAt 精确时刻起算** | REQ-FIX-005 |
| D2 SQLCipher | **MVP 降级为不加密** | REQ-FIX-009 / REQ-ANDROID-002 |
| D3 相机实现 | **react-native-vision-camera** | REQ-FIX-010 |
| D4 postgres 密码 | **用户手动执行 PG 升级脚本** | REQ-DEPLOY-001 |
| D5 部署模式 | **本地构建 jar + scp** | REQ-DEPLOY-006 |

---

## 2. 修复需求（11 个 Gap）

> 每个 REQ-FIX 对应一个已知 Gap，追溯至 WI-0001 的原始 REQ/AC/DD。

### REQ-FIX-001: UserController 密码哈希脱敏（G1）

- **Gap**: G1 — UserController 直接返回 User 实体，响应 JSON 含 `password_hash` 字段
- **背景**: `UserController.list/detail/create/update` 返回 `ApiResponse<User>`，User 实体包含 `passwordHash` 字段（BCrypt 哈希）。虽然非明文，但泄露哈希可被离线爆破，违反 REQ-1.3（禁止明文）和 NFR-10（安全基线）精神。
- **需求**:
  1. [Ubiquitous] THE 系统 SHALL 在所有用户相关 API 响应中排除 `passwordHash`、`password_hash` 字段，无论列表、详情、创建还是更新接口。
  2. [Event-driven] WHEN 用户列表或详情接口被调用, THE 系统 SHALL 返回不含密码相关字段的 UserResponse DTO（或通过 `@JsonIgnore` / `@JsonProperty(access = WRITE_ONLY)` 实现）。
- **验收标准**:
  1. 执行 `curl GET /api/v1/users`，响应 JSON body 中任意用户对象均不含 `passwordHash` / `password_hash` 键。
  2. 执行 `curl GET /api/v1/users/{id}`，响应不含密码字段。
  3. 执行 `curl POST /api/v1/users`（创建用户），响应 body 不回显密码字段。
- **关联**: 模块 `fj-system`（UserController）；文件 `UserController.java`、新增 `UserResponse` DTO 或注解。追溯 REQ-1（用户登录认证）、NFR-10（安全基线）。

### REQ-FIX-002: OperationLogAspect 对接 @RequirePermission（G2）

- **Gap**: G2 — 审计日志切面未对接 `@RequirePermission`，越权访问留痕实际未记录
- **背景**: `OperationLogAspect`（切面）与 `@RequirePermission`（权限注解）各自存在，但未联动。REQ-2.3 要求"越权访问记录留痕"，当前越权请求被权限过滤器拒绝，但未生成 OperationLog 审计记录，违反审计合规要求（§7.4）。
- **需求**:
  1. [Event-driven] WHEN 权限校验失败（抛出 `PermissionDeniedException` 或 `NoProjectAccessException`）, THE 系统 SHALL 在同一请求链路中生成一条 OperationLog 记录，包含用户 ID、请求路径、被拒权限标识、时间戳。
  2. [Ubiquitous] THE 系统 SHALL 确保越权留痕的 OperationLog 不可被修改或删除（写入后 `log_hash` 链式哈希，符合 §7.4 审计不可改删）。
  3. [Unwanted-behavior] IF 审计日志写入失败, THEN THE 系统 SHALL 记录错误日志（应用日志）且不阻断主业务流程（审计失败不应导致正常请求失败，但越权拒绝仍生效）。
- **验收标准**:
  1. 构造一个无权限用户调用带 `@RequirePermission` 的接口，返回 403/1003，且 `operation_log` 表新增一条 `action=ACCESS_DENIED` 记录。
  2. 越权留痕记录的 `log_hash` 字段非空且符合链式哈希规则（前一条 hash + 当前内容）。
  3. 审计记录无法通过任何 API 被 UPDATE 或 DELETE。
- **关联**: 模块 `fj-common`（OperationLogAspect）、`fj-auth`（权限过滤）；追溯 REQ-2（项目级角色权限控制）、§7.4（审计不可改删）。

### REQ-FIX-003: DD-9 联动检查实现（G3）

- **Gap**: G3 — `IssueReviewService.isReferencedByPublishedReport(Long issueId)` 直接 `return false`
- **背景**: DD-9 裁决"后续更正是终态"，守卫条件为"问题是否被已发布报告引用"（§102.4）。当前实现（`IssueReviewService.java:152-155`）直接返回 false，导致"作废日报时，被已发布报告引用的问题"不会进入"后续更正"分支，而是进入"作废"分支，违反 DD-9。
- **需求**:
  1. [Event-driven] WHEN 日报被作废且其关联问题已被某已发布报告（report.status=PUBLISHED）快照引用, THE 系统 SHALL 将该问题状态变更为"后续更正"（CORRECTED 路径的 VOIDED 前驱），而非直接"作废"。
  2. [Event-driven] WHEN 日报被作废且其关联问题未被任何已发布报告引用, THE 系统 SHALL 将该问题状态变更为"作废"（VOIDED）。
  3. [Ubiquitous] THE 系统 SHALL 通过查询 `report_issue_snapshots` 表（JOIN 已发布 report）判断引用关系，不得返回硬编码 false。
- **验收标准**:
  1. 单元测试：构造一个已发布报告快照引用的 issue，调用作废逻辑，断言 issue.status 进入"后续更正"分支（非 VOIDED）。
  2. 单元测试：构造一个未被引用的 issue，调用作废逻辑，断言 issue.status = VOIDED。
  3. 代码审查：`isReferencedByPublishedReport` 方法内无 `return false` 硬编码，包含对 `ReportIssueSnapshotRepository` 的真实查询。
- **关联**: 模块 `fj-issue`（IssueReviewService）、`fj-report`（ReportIssueSnapshot）；追溯 DD-9（后续更正终态）、REQ-11（项目问题池生成）、REQ-14（问题状态流转）、BR-3（确认即锁定）。

### REQ-FIX-004: 报告快照 photo_reference_snapshot 填充（G4）

- **Gap**: G4 — `photo_reference_snapshot` 字段永远是 null
- **背景**: `ReportIssueSnapshot` 实体含 `photo_reference_snapshot` 字段（§101.14），用于报告发布时固化照片引用路径。当前发布快照逻辑未填充该字段，导致 DD-3 报告导出引擎渲染图片占位符时拿不到照片路径，只能渲染占位提示文字，违反 REQ-16（问题快照完整性）。
- **需求**:
  1. [Event-driven] WHEN 报告发布创建问题快照, THE 系统 SHALL 将每个关联问题的有效照片路径（compressed 路径）序列化后填入 `ReportIssueSnapshot.photo_reference_snapshot`。
  2. [Ubiquitous] THE 系统 SHALL 确保 `photo_reference_snapshot` 快照数据在报告发布后不可被修改（与 `locked_at` 一致）。
  3. [Unwanted-behavior] IF 某问题无关联照片, THEN THE 系统 SHALL 在快照中将 `photo_reference_snapshot` 设为空数组（而非 null），并标记该问题导出时渲染"无照片"提示。
- **验收标准**:
  1. 发布一份报告后，查询 `report_issue_snapshots` 表，所有含照片的 issue 行 `photo_reference_snapshot` 非 null 且为合法 JSON。
  2. 报告 Word 导出（REQ-FIX-011 模板）中，含照片的 issue 渲染出真实图片，无照片的 issue 显示"无照片"占位。
  3. 单元测试：发布快照后尝试修改 `photo_reference_snapshot`，应被拒绝（状态机守卫）。
- **关联**: 模块 `fj-report`（ReportIssueSnapshot、发布快照逻辑）、`fj-export`（图片渲染）；追溯 REQ-16（问题快照）、DD-3（报告导出引擎）。

### REQ-FIX-005: RectificationDeadlineCalculator hours 起算点确认（G5）

- **Gap**: G5 — CRITICAL 的 `major_issue_deadline_hours` 覆盖时，hours 从 confirmedAt 起算还是当日 00:00 起算未定义
- **背景**: `RectificationDeadlineCalculator.calculateCriticalDeadline`（`RectificationDeadlineCalculator.java:55-64`）当 `major_issue_deadline_hours > 0` 时用 `confirmed_at + hours` 覆盖。代码注释写的是"confirmed_at 基准"，但语义未与用户确认。决策 D1-A 确认：**从 confirmedAt 精确时刻起算**。
- **需求**:
  1. [Ubiquitous] THE 系统 SHALL 在 `major_issue_deadline_hours` 配置存在且 > 0 时，将 CRITICAL 问题的整改期限计算为 `confirmed_at（精确到秒）+ hours 小时`。
  2. [Event-driven] WHEN `major_issue_deadline_hours` 未配置或 ≤ 0, THE 系统 SHALL 将 CRITICAL 整改期限设为 `confirmed_at` 当日 23:59:59（BR-1 默认规则）。
  3. [Optional-feature] WHERE `major_issue_deadline_hours` 可在项目配置中调整, THE 系统 SHALL 支持运行时修改该值且仅对新确认的问题生效（已确认问题的 deadline 不回溯重算）。
- **验收标准**:
  1. 单元测试：`confirmed_at=2026-07-01T14:30:00`，`major_issue_deadline_hours=24`，断言 `rectification_deadline=2026-07-02T14:30:00`（精确时刻 +24h）。
  2. 单元测试：`confirmed_at=2026-07-01T14:30:00`，`major_issue_deadline_hours=0/未配置`，断言 `rectification_deadline=2026-07-01T23:59:59`。
  3. 单元测试：`confirmed_at=2026-07-01T22:00:00`，`hours=8`，断言跨日 `deadline=2026-07-02T06:00:00`。
- **关联**: 模块 `fj-issue`（RectificationDeadlineCalculator）、`fj-project`（ProjectConfig）；追溯 REQ-13（问题等级与整改期限计算）、BR-1（整改期限规则）、DD-8（confirmed_at 语义）。

### REQ-FIX-006: 补充 @EnableJpaRepositories（G6）

- **Gap**: G6 — 缺少 `@EnableJpaRepositories`，fj-common 下的 Repository bean 运行时可能不激活
- **背景**: Spring Data JPA 默认从 `@SpringBootApplication` 所在包及其子包扫描 Repository。由于 `fj-api` 的 Application 类包名与 `fj-common` 等模块的 Repository 包名结构可能不在同一扫描树，存在 Repository bean 未注册的运行时风险（编译期无法发现）。
- **需求**:
  1. [Ubiquitous] THE 系统 SHALL 在启动模块（`fj-api` 的 Application 类）显式声明 `@EnableJpaRepositories(basePackages = {...})` 覆盖全部含 Repository 的包。
  2. [Unwanted-behavior] IF 启动时存在未被扫描的 Repository, THEN THE 系统 SHALL 在启动日志中输出 Repository 注册统计（或通过 `spring.data.jpa.repositories.bootstrap-mode` 验证），便于快速定位缺失。
- **验收标准**:
  1. 后端启动成功后，执行任一依赖 fj-common Repository 的 API（如用户列表），返回非 500 错误。
  2. 启动日志中无 `NoSuchBeanDefinitionException` 或 `Repository not found`。
  3. 代码审查：Application 类含 `@EnableJpaRepositories` 注解且 basePackages 覆盖 `com.fj.common`、`com.fj.system` 等全部模块。
- **关联**: 模块 `fj-api`（Application）、`fj-common`；追溯 DD-5（接口契约/启动配置）。

### REQ-FIX-007: 统一 BaseEntity 到 fj-common（G7）

- **Gap**: G7 — `fj-common` 和 `fj-system` 各有一份 BaseEntity，JPA 映射冲突风险
- **背景**: 两份 BaseEntity（id、createdAt、updatedAt 等审计字段）导致实体继承歧义，Hibernate 可能报 "mapped by two entities" 或主键生成策略不一致。编译能过但运行期风险高。
- **需求**:
  1. [Ubiquitous] THE 系统 SHALL 只保留 `fj-common` 中的 BaseEntity 作为唯一基类，删除 `fj-system` 中的重复定义。
  2. [Ubiquitous] THE 系统 SHALL 确保所有 JPA 实体统一继承 `fj-common` 的 BaseEntity，审计字段（createdAt/updatedAt）由 `@PrePersist` / `@PreUpdate` 自动填充。
- **验收标准**:
  1. `grep -r "class BaseEntity" fj-backend/` 仅在 `fj-common` 出现一次。
  2. 后端启动成功，无 Hibernate "duplicate mapping" 或 "entity inheritance conflict" 异常。
  3. 数据库迁移后，所有含审计字段的表 `created_at`、`updated_at` 在 INSERT 时自动填充。
- **关联**: 模块 `fj-common`、`fj-system`；追溯 DD-5（实体基类规范）。

### REQ-FIX-008: ProjectAccessFilter 字段名对齐（G8）

- **Gap**: G8 — `ProjectAccessFilter` 参数名 camelCase vs snake_case 未对齐，前后端字段名不匹配
- **背景**: 前端发送 `projectId`（camelCase），后端 `ProjectAccessFilter` 期望 `project_id`（snake_case），或反之。导致项目级数据隔离失效或 400 错误。WI-0001 的接口契约（DD-5 §5.1）规定 URL query 参数用 snake_case，JSON body 字段需统一约定。
- **需求**:
  1. [Ubiquitous] THE 系统 SHALL 统一 API 字段命名约定：URL query 参数用 snake_case（如 `project_id`），JSON request/response body 字段用 camelCase（Jackson 默认），并在 `application.yml` 配置 `spring.jackson.property-naming-strategy` 或 DTO 显式映射。
  2. [Event-driven] WHEN 前端以约定命名发送请求, THE 系统 SHALL 正确解析 `project_id` / `projectId` 并执行项目级权限校验。
- **验收标准**:
  1. Web 前端调用任一带项目参数的接口（如 `GET /api/v1/projects/{id}/tasks`），后端正确解析项目 ID 且权限校验生效。
  2. 构造无项目权限的用户访问该项目数据，返回 403/1003（权限校验生效，而非字段解析失败导致 500）。
  3. 集成测试覆盖 ProjectAccessFilter 的请求解析路径。
- **关联**: 模块 `fj-project`（ProjectAccessFilter）、`fj-web`（请求封装）；追溯 REQ-2（项目级权限控制）、DD-5（接口契约规范 §5.1）。

### REQ-FIX-009: SQLCipher 降级确认与文档化（G9）

- **Gap**: G9 — Android 本地数据未加密（SQLCipher native 模块未实现）
- **背景**: DD-1 选 WatermelonDB（底层 SQLite），§7.5 要求用 SQLCipher 加密。但 native 集成复杂度高，且 MVP 阶段设备为受控配发设备。决策 D2-B 确认 MVP 降级为不加密，后续迭代再加。
- **需求**:
  1. [Optional-feature] WHERE 本次为 MVP 阶段（决策 D2-B）, THE 系统 SHALL 允许 Android 本地数据库暂不加密（使用普通 SQLite）。
  2. [Ubiquitous] THE 系统 SHALL 在代码与文档中明确标注"本地数据未加密"的降级状态，并记录"后续迭代需集成 react-native-sqlcipher-storage"的技术债。
  3. [Ubiquitous] THE 系统 SHALL 确保降级后离线同步功能（REQ-8）仍完整可用（加密与否不影响同步协议）。
- **验收标准**:
  1. Android 代码中无 SQLCipher 编译错误或 native 模块缺失导致的崩溃。
  2. 技术债登记：在 design.md 或 ADR 中记录"本地加密降级"决策及升级路径。
  3. 离线作业（拍照→保存问题→提交日报）在未加密本地库下端到端可用。
- **关联**: 模块 `fj-android`（store/schema）；追溯 §7.5（安卓本地加密）、REQ-8（安卓离线作业）、DD-1（WatermelonDB）。

### REQ-FIX-010: 相机/图片压缩原生模块实现（G10）

- **Gap**: G10 — 相机/图片压缩原生模块只有接口定义无实现，无法实际拍照
- **背景**: `fj-android/src/components/photo` 定义了拍照、压缩、水印、GPS 接口，但无原生实现。决策 D3-A 选定 `react-native-vision-camera`（社区成熟，支持照片捕获、权限管理）。
- **需求**:
  1. [Event-driven] WHEN 检查人员在现场点击"拍照"按钮, THE 系统（Android 端）SHALL 调用 react-native-vision-camera 捕获照片，自动应用压缩（长边 ≤1920px，质量 80，≤1MB，符合 DD-2）。
  2. [Event-driven] WHEN 照片捕获完成, THE 系统 SHALL 为照片附加水印（时间 + GPS 坐标，符合 §证据要求）和 GPS 元数据。
  3. [Unwanted-behavior] IF 用户未授予相机权限, THEN THE 系统 SHALL 提示授权引导且不崩溃；IF GPS 不可用, THEN THE 系统 SHALL 标记 `gps_status=未获取` 但允许继续拍照。
  4. [State-driven] WHILE 设备离线, THE 系统 SHALL 将压缩后照片保存到本地 photo_upload_queue，联网后异步上传（符合 DD-2/§6.4）。
- **验收标准**:
  1. Android Debug Build 在真机/模拟器上点击拍照，成功捕获并显示压缩后预览图（文件 ≤1MB）。
  2. 照片元数据含 `captured_at`、`gps_status`、`compressed_file_hash`。
  3. 无相机权限时显示引导提示而非 crash。
  4. 离线拍照后照片进入本地队列，联网后成功上传至服务器 `/data/photos/`。
- **关联**: 模块 `fj-android`（components/photo、api/照片上传）；追溯 REQ-9（现场问题取证与记录）、REQ-8（安卓离线作业）、DD-2（照片压缩存储）。

### REQ-FIX-011: poi-tl Word 报告模板创建（G11）

- **Gap**: G11 — poi-tl Word 模板未创建，报告导出用 fallback 降级格式
- **背景**: DD-3 规定模板存放 `/data/templates/report_{report_type}_v{tpl_version}.docx`，但 WI-0001 未创建实际 .docx 模板，导出引擎走 fallback（非最终格式），违反 REQ-17（报告导出 Word）。
- **需求**:
  1. [Event-driven] WHEN 用户导出报告草稿或发布固化导出, THE 系统 SHALL 使用真实 poi-tl .docx 模板渲染，生成符合飞检报告规范的 Word 文件。
  2. [Ubiquitous] THE 系统 SHALL 在模板中使用 `{{field}}` 文本占位、`{{@image_ref}}` 图片占位、`{{#list}}...{{/list}}` 问题清单循环，与 DD-3 占位符语法一致。
  3. [Unwanted-behavior] IF 模板文件缺失, THEN THE 系统 SHALL 返回 `TemplateNotFoundError`（错误码 5001）而非静默 fallback，确保导出格式可预测。
- **验收标准**:
  1. `/data/templates/` 下存在至少一种 report_type 的 .docx 模板文件。
  2. 导出报告草稿，生成 .docx 文件，打开后含项目信息、问题清单（循环渲染）、照片（含照片的 issue 渲染真实图片）。
  3. 100 问题/300 照片的报告导出 ≤60s（草稿）/ ≤120s（固化），符合 NFR-5。
  4. 删除模板文件后导出，返回明确错误而非 fallback。
- **关联**: 模块 `fj-export`（PoiTlExportEngine）、模板资源；追溯 REQ-17（报告草稿预览与导出）、REQ-19（报告发布与固化导出）、DD-3（报告导出引擎）。

---

## 3. 部署需求

> 服务器 svr-lg（ssh lg, CentOS Stream 9, 4 vCPU, 3.6GB RAM, 23GB 可用磁盘）。所有 sudo 级运维操作必须由用户手动执行幂等脚本（D4）。

### REQ-DEPLOY-001: PostgreSQL 13→16 全新安装

- **需求**:
  1. [Event-driven] WHEN 用户在服务器手动执行 `scripts/ops/install_pg16.sh`, THE 部署流程 SHALL 完成卸载 PG13、安装 PG16、initdb、创建业务库 `fj_inspection` 与用户 `fj_app`（密码从环境变量读取，不硬编码）。
  2. [Ubiquitous] THE 部署流程 SHALL 配置 `pg_hba.conf` 为 scram-sha-256（本机 TCP）+ peer（local），不配置外部 host（PG 仅监听 127.0.0.1）。
  3. [Ubiquitous] THE 安装脚本 SHALL 幂等（重复执行不报错），且执行前打印将要执行的操作摘要供用户确认。
- **验收标准**:
  1. 脚本执行后 `psql -c "SELECT version();"` 返回 PostgreSQL 16.x。
  2. `\l` 列出 `fj_inspection` 数据库，`fj_app` 用户可连接。
  3. `pg_hba.conf` 中认证方法为 scram-sha-256（非 md5）。
- **关联**: 追溯 DD-7（PostgreSQL 升级方案）。

### REQ-DEPLOY-002: JRE17 安装（服务器）

- **需求**:
  1. [Event-driven] WHEN 用户执行 `scripts/ops/install_jre17.sh`, THE 部署流程 SHALL 安装 `java-17-openjdk-headless` 并配置 `JAVA_HOME`。
  2. [Ubiquitous] THE 部署流程 SHALL 仅安装 JRE（headless，体积小），不安装完整 JDK/Maven（服务器不构建）。
- **验收标准**:
  1. 脚本执行后 `java -version` 输出 17.x。
  2. `JAVA_HOME` 在 systemd 环境中可解析。
- **关联**: 追溯 D5-A（本地构建 + scp 部署）。

### REQ-DEPLOY-003: systemd 服务配置

- **需求**:
  1. [Ubiquitous] THE 系统 SHALL 提供 `/etc/systemd/system/fj-api.service`，配置 JVM 参数（`-Xms512m -Xmx768m -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:+HeapDumpOnOutOfMemoryError`，符合 §4.3 内存调优）。
  2. [Event-driven] WHEN systemd 启动 fj-api.service, THE 系统 SHALL 以非 root 用户运行（如 `fj` 用户），工作目录 `/opt/fj/api`。
  3. [Event-driven] WHEN 服务异常退出, THEN systemd SHALL 自动重启（Restart=on-failure，RestartSec=10）。
- **验收标准**:
  1. `systemctl status fj-api` 显示 active(running)。
  2. 服务进程的 RSS 内存 ≤1GB（`ps -o rss`）。
  3. `systemctl restart fj-api` 后服务在 30s 内恢复 8080 监听。
  4. kill -9 主进程后 systemd 自动拉起。
- **关联**: 追溯 §4.3（内存调优）、DD-5（部署）。

### REQ-DEPLOY-004: Nginx 反向代理配置

- **需求**:
  1. [Ubiquitous] THE 系统 SHALL 配置 Nginx 反向代理：Web 静态资源直出 `/opt/fj/web`，`/api/` 转发至 `127.0.0.1:8080`。
  2. [Ubiquitous] THE Nginx 配置 SHALL 包含 `worker_processes 4`、`client_max_body_size 15m`（照片分片上传）、gzip 压缩（符合 §4.3）。
  3. [Optional-feature] WHERE HTTPS 证书已配置, THE 系统 SHALL 终结 HTTPS；MVP 阶段如无证书可先用 HTTP，但需记录为技术债。
- **验收标准**:
  1. 浏览器访问服务器 IP，Web 前端首页正常加载。
  2. `curl https://<server>/api/v1/...`（或 http）正确转发到后端。
  3. 上传 15MB 文件不被 Nginx 拒绝（413）。
- **关联**: 追溯 §4.3（Nginx 参数）、DD-2（照片分片上传）。

### REQ-DEPLOY-005: 生产环境密钥配置（零硬编码）

- **需求**:
  1. [Ubiquitous] THE 系统 SHALL 确保生产环境密钥（JWT secret、DB 密码、加密盐）不硬编码在源码或提交到 Git 的配置文件中。
  2. [Event-driven] WHEN 部署时, THE 系统 SHALL 从环境变量、systemd EnvironmentFile 或 `/opt/fj/api/application-prod.yml`（权限 600，不提交 Git）读取密钥。
  3. [Unwanted-behavior] IF 密钥缺失或为占位符（如 `change-me`）, THEN THE 系统 SHALL 启动失败并明确报错（fail-fast）。
- **验收标准**:
  1. `grep -ri "secret\|password" fj-backend/fj-api/src/main/resources/application*.yml` 中无明文密钥（仅 `${ENV_VAR}` 占位）。
  2. 启动时 JWT secret 为占位符则启动报错。
  3. 生产配置文件权限为 600 且不在 Git 跟踪中。
- **关联**: 追溯 DD-4（JWT 密钥从配置读取）、§7.1（安全基线）、NFR-10。

### REQ-DEPLOY-006: 本地构建 fat jar + scp 部署

- **需求**:
  1. [Event-driven] WHEN 在本地执行 `mvn package -DskipTests`（配 JAVA_HOME=JDK17）, THE 构建流程 SHALL 生成 `fj-api/target/fj-api-*.jar`（fat jar，含全部依赖）。
  2. [Event-driven] WHEN 执行 `scripts/ops/deploy_backend.sh`, THE 部署流程 SHALL scp jar + application-prod.yml + systemd unit 到服务器 `/opt/fj/api/`，并触发 systemd 重启。
  3. [Ubiquitous] THE 部署脚本 SHALL 在 scp 前备份旧 jar（`/opt/fj/api/backup/`），支持回滚。
- **验收标准**:
  1. 本地 `mvn package` 生成 fat jar 成功，体积合理（<100MB）。
  2. deploy_backend.sh 执行后服务器 jar 更新，服务重启。
  3. 回滚：执行回滚命令后服务恢复到上一版本。
- **关联**: 追溯 D5-A（本地构建部署）。

---

## 4. 运行时需求

### REQ-RUNTIME-001: 后端首次启动成功

- **需求**:
  1. [Event-driven] WHEN 执行 `mvn spring-boot:run`（本地）或 systemd 启动（服务器）, THE 系统 SHALL 在 60s 内成功启动并监听 8080 端口。
  2. [Unwanted-behavior] IF 启动失败, THEN THE 系统 SHALL 输出明确错误日志（Bean 创建失败、端口占用、DB 连接失败等分类），不静默退出。
  3. [Ubiquitous] THE 系统 SHALL 在启动日志中输出关键组件就绪状态（DB 连接、Flyway、JPA Repository 数量、Caffeine 缓存）。
- **验收标准**:
  1. `curl http://localhost:8080/actuator/health`（或等价端点）返回 200/UP。
  2. 启动日志含 "Started Application" 且无 ERROR。
  3. 启动耗时 ≤60s。
- **关联**: 追溯 DD-5、§4.3。

### REQ-RUNTIME-002: Flyway 迁移首次执行

- **需求**:
  1. [Event-driven] WHEN 后端首次连接 PG16 启动, THE 系统 SHALL 按顺序执行 Flyway V1~V7 全部迁移脚本，创建完整表结构。
  2. [Unwanted-behavior] IF 任一迁移脚本失败, THEN THE 系统 SHALL 中止启动并保留错误迁移记录（Flyway schema_history），不污染已成功的迁移。
  3. [Ubiquitous] THE 系统 SHALL 确保迁移脚本与 PG16 兼容（关注 `gen_random_uuid()` 等 PG13→16 差异）。
- **验收标准**:
  1. 启动后查询 `flyway_schema_history`，V1~V7 全部 success。
  2. 数据库含全部 28 个核心表（§4.1）。
  3. 重复启动（第二次）不重复执行迁移。
- **关联**: 追溯 DD-7、§4.1（Schema）。

### REQ-RUNTIME-003: 种子数据导入与验证

- **需求**:
  1. [Event-driven] WHEN V2__seed_data.sql 执行, THE 系统 SHALL 导入 4 个角色、20 个权限、admin 默认账号（密码 BCrypt 哈希）。
  2. [Ubiquitous] THE 系统 SHALL 确保 admin 账号密码非明文存储（BCrypt cost=12）。
  3. [Event-driven] WHEN 启动完成, THEN admin 账号 SHALL 可立即用于登录验证（username=admin，密码在部署文档中提供，首次登录强制改密为可选）。
- **验收标准**:
  1. `SELECT count(*) FROM role` = 4；`SELECT count(*) FROM permission` = 20。
  2. `SELECT password_hash FROM users WHERE username='admin'` 以 `$2a$12$` 开头（BCrypt）。
  3. 用 admin 账号登录 API 返回有效 JWT。
- **关联**: 追溯 REQ-1（用户登录）、REQ-2（角色权限）。

### REQ-RUNTIME-004: 核心 API 端点可访问性验证

- **需求**:
  1. [Ubiquitous] THE 系统 SHALL 确保全部 Controller 暴露的 API 端点在启动后可被调用（非 404）。
  2. [Event-driven] WHEN 携带有效 JWT 调用核心资源接口（users/projects/tasks/daily-reports/project-issues/reports）, THE 系统 SHALL 返回符合 §5.2 统一响应结构。
  3. [Unwanted-behavior] IF 未携带 JWT 或 JWT 无效, THEN THE 系统 SHALL 返回 401/1002（未认证），而非 500。
- **验收标准**:
  1. 遍历核心 API（至少 users、projects、tasks、daily-reports、project-issues、reports、auth/login），均返回非 404。
  2. 未认证请求返回 401。
  3. 鉴权后请求返回标准 ApiResponse 结构（code/message/data/timestamp/trace_id）。
- **关联**: 追溯 DD-5（接口契约 §5）、REQ-1（认证）。

---

## 5. Android 需求

> 在 11 个 Gap 中，G9（降级）和 G10（相机）已归入 REQ-FIX-009/010。本章补充 Android 整体可运行需求。

### REQ-ANDROID-001: Android Debug Build 可运行

- **需求**:
  1. [Event-driven] WHEN 执行 `cd fj-android && npm run android`（或 gradle assembleDebug）, THE 构建流程 SHALL 生成可安装的 Debug APK。
  2. [Event-driven] WHEN APK 安装到真机或模拟器（API 28+）, THE 应用 SHALL 正常启动，显示登录页。
  3. [Unwanted-behavior] IF 原生模块（vision-camera 等）链接失败, THEN THE 构建流程 SHALL 输出明确错误（不静默生成残缺 APK）。
- **验收标准**:
  1. `npm run android` 构建成功，生成 `android/app/build/outputs/apk/debug/app-debug.apk`。
  2. APK 安装后启动无 crash，登录页渲染正常。
  3. Metro bundler 连接正常（Debug 模式）。
- **关联**: 追溯 REQ-8（安卓离线作业）。

### REQ-ANDROID-002: Android 端到端离线作业可用

- **需求**:
  1. [State-driven] WHILE 设备离线, THE Android 端 SHALL 支持完整作业链路：登录态保持→接收任务→现场检查→拍照取证→保存问题→提交日报到本地队列。
  2. [Event-driven] WHEN 网络恢复, THE Android 端 SHALL 将本地数据异步同步到服务器（文本先于照片，符合 DD-6 §6.4）。
  3. [Unwanted-behavior] IF 同步失败, THEN THE Android 端 SHALL 保留本地数据并自动重试（指数退避，最多 5 次）。
- **验收标准**:
  1. 离线状态下完成拍照+保存问题+提交日报，数据写入本地 WatermelonDB。
  2. 联网后本地数据成功同步到服务器，服务器端可查询到该日报。
  3. 断网期间操作不丢失。
- **关联**: 追溯 REQ-8（离线作业）、REQ-9（取证）、REQ-10（日报提交）、DD-6（同步协议）、NFR-9（离线能力）、NFR-11（同步可靠性）。

---

## 6. 测试需求

> 从 0 引入测试，优先覆盖 11 个 Gap 涉及逻辑，不追求高覆盖率。

### REQ-TEST-001: 核心 Service 单元测试

- **需求**:
  1. [Ubiquitous] THE 系统 SHALL 为以下核心 Service 提供单元测试（覆盖率以行为分支为准）：
     - `RectificationDeadlineCalculator`（G5 hours 语义，REQ-FIX-005）
     - `IssueReviewService.isReferencedByPublishedReport`（G3 DD-9 联动，REQ-FIX-003）
     - `OperationLogService`（G2 审计留痕，REQ-FIX-002）
     - 报告快照 `photo_reference_snapshot` 填充逻辑（G4，REQ-FIX-004）
  2. [Ubiquitous] THE 单元测试 SHALL 使用 JUnit5 + Mockito，不依赖真实数据库（mock Repository）。
- **验收标准**:
  1. `mvn test` 执行上述 Service 测试全部 PASS。
  2. 每个 Gap 修复逻辑至少有 1 个正向 + 1 个边界用例。
- **关联**: 追溯 REQ-FIX-002/003/004/005。

### REQ-TEST-002: 关键 API 集成测试

- **需求**:
  1. [Ubiquitous] THE 系统 SHALL 提供关键 API 的集成测试（`@SpringBootTest` + 真实 PG 或 Testcontainers）：
     - 登录认证（admin 账号）
     - 项目级权限校验（越权 403 + 留痕）
     - 日报提交→确认→问题入池
     - 报告生成→发布→快照→导出
  2. [Ubiquitous] THE 集成测试 SHALL 在 CI 或本地可重复执行（`mvn verify`）。
- **验收标准**:
  1. `mvn verify` 集成测试全部 PASS。
  2. 越权场景测试验证 operation_log 表有留痕。
- **关联**: 追溯 REQ-FIX-002/008。

---

## 7. 端到端验收需求

### REQ-E2E-001: 全流程端到端演示通过

- **需求**:
  1. [Event-driven] WHEN 执行完整业务流程时, THE 系统 SHALL 支持以下端到端链路全部成功：
     1. Web 登录（admin）→ 创建项目 → 配置检查表 → 派发检查任务
     2. Android 登录 → 接收任务 → 现场检查 → 拍照取证（G10）→ 创建问题 → 提交日报
     3. Web 日报确认 → 问题入池（记录 confirmed_at）→ 组长复核
     4. 报告生成 → 快照编辑（含 photo_reference_snapshot，G4）→ 审批 → 发布固化 → 导出 Word（G11 模板）
  2. [State-driven] WHILE 全流程执行, THE 系统 SHALL 确保状态机三层联动（日报/日报问题/问题质量状态）一致（§9.1）。
  3. [Ubiquitous] THE 系统 SHALL 在全流程中不出现因 11 个 Gap 导致的功能中断。
- **验收标准**:
  1. 按上述 4 步链路操作，每步均成功，无 500 错误。
  2. 最终导出的 Word 报告含完整问题清单 + 真实照片。
  3. 全流程产生的数据在数据库中可追溯（confirmed_at、locked_at、快照记录）。
- **关联**: 追溯 REQ-5/7/9/10/11/12/15/16/17/18/19 全链路。

---

## 8. 非功能需求补充

> 相对 WI-0001 NFR-1~NFR-11 的补充，聚焦本次 CR 的运行环境约束。

### NFR-FIX-001: 资源约束 — 3.6GB RAM 环境

- **需求**: THE 系统 SHALL 在服务器 3.6GB RAM 环境下稳定运行，内存分配：OS+服务 ~0.5GB、PG16 ~0.8GB、JVM ~1.0GB（堆 768m）、Nginx ~0.1GB、预留缓冲 ~1.2GB。
- **验收标准**:
  1. 服务运行稳定 1 小时，`free -m` 显示 available ≥500MB。
  2. JVM 堆使用峰值 ≤768MB（不触发频繁 Full GC）。
  3. 无 OOM Kill 记录。
- **追溯**: §4.3（内存调优）、NFR-6（并发）。

### NFR-FIX-002: 安全基线补强 — 密钥零硬编码

- **需求**: THE 系统 SHALL 确保生产环境无任何硬编码密钥（JWT secret、DB 密码、加密盐），全部从外部配置注入。
- **验收标准**: 见 REQ-DEPLOY-005。
- **追溯**: NFR-10（安全基线）、DD-4。

### NFR-FIX-003: 可观测性 — 启动与运行日志

- **需求**: THE 系统 SHALL 输出结构化应用日志（含 trace_id），关键事件（启动、迁移、鉴权、导出、OOM）可被检索。
- **验收标准**:
  1. 日志文件位于 `/opt/fj/logs/`，按日滚动。
  2. 日志含 trace_id 可串联请求链路。
- **追溯**: §5.2（trace_id）、NFR-7（可用性）。

### NFR-FIX-004: 可回滚性 — 部署回滚

- **需求**: THE 系统 SHALL 支持部署回滚（jar 备份 + systemd 切换），回滚操作 ≤5 分钟。
- **验收标准**: 见 REQ-DEPLOY-006 验收标准 3。
- **追溯**: 变更分类（Medium-High 风险）。

---

## 9. 需求追溯

### 9.1 修复需求 → WI-0001 原始规格追溯

| 差量需求 | Gap | 追溯至 WI-0001 | 关联模块 |
|---------|-----|---------------|---------|
| REQ-FIX-001 | G1 | REQ-1（登录认证）、NFR-10（安全基线） | fj-system |
| REQ-FIX-002 | G2 | REQ-2（项目级权限控制）、§7.4（审计不可改删） | fj-common, fj-auth |
| REQ-FIX-003 | G3 | DD-9（后续更正终态）、REQ-11、REQ-14、BR-3 | fj-issue, fj-report |
| REQ-FIX-004 | G4 | REQ-16（问题快照）、DD-3（报告导出引擎） | fj-report, fj-export |
| REQ-FIX-005 | G5 | REQ-13（整改期限计算）、BR-1、DD-8 | fj-issue, fj-project |
| REQ-FIX-006 | G6 | DD-5（启动配置/接口契约） | fj-api, fj-common |
| REQ-FIX-007 | G7 | DD-5（实体基类规范） | fj-common, fj-system |
| REQ-FIX-008 | G8 | REQ-2（项目权限）、DD-5（接口契约 §5.1） | fj-project, fj-web |
| REQ-FIX-009 | G9 | §7.5（安卓本地加密）、REQ-8、DD-1、决策 D2-B | fj-android |
| REQ-FIX-010 | G10 | REQ-9（现场取证）、REQ-8（离线）、DD-2、决策 D3-A | fj-android |
| REQ-FIX-011 | G11 | REQ-17、REQ-19（报告导出）、DD-3 | fj-export |

### 9.2 部署/运行时需求 → WI-0001 设计追溯

| 差量需求 | 追溯至 WI-0001 |
|---------|---------------|
| REQ-DEPLOY-001 | DD-7（PG 升级方案） |
| REQ-DEPLOY-002 | D5-A（本地构建部署） |
| REQ-DEPLOY-003 | §4.3（内存调优）、DD-5 |
| REQ-DEPLOY-004 | §4.3（Nginx 参数）、DD-2 |
| REQ-DEPLOY-005 | DD-4（JWT 密钥）、§7.1、NFR-10 |
| REQ-DEPLOY-006 | D5-A（本地构建部署） |
| REQ-RUNTIME-001 | DD-5、§4.3 |
| REQ-RUNTIME-002 | DD-7、§4.1（Schema） |
| REQ-RUNTIME-003 | REQ-1、REQ-2 |
| REQ-RUNTIME-004 | DD-5（接口契约 §5）、REQ-1 |

### 9.3 Android/测试/端到端需求追溯

| 差量需求 | 追溯至 WI-0001 |
|---------|---------------|
| REQ-ANDROID-001 | REQ-8（离线作业） |
| REQ-ANDROID-002 | REQ-8、REQ-9、REQ-10、DD-6、NFR-9、NFR-11 |
| REQ-TEST-001 | REQ-FIX-002/003/004/005 |
| REQ-TEST-002 | REQ-FIX-002/008 |
| REQ-E2E-001 | REQ-5/7/9/10/11/12/15/16/17/18/19 |
| NFR-FIX-001 | §4.3、NFR-6 |
| NFR-FIX-002 | NFR-10、DD-4 |
| NFR-FIX-003 | §5.2、NFR-7 |
| NFR-FIX-004 | 变更分类（风险） |

### 9.4 Gap 覆盖完整性检查

| Gap | 覆盖需求 | 状态 |
|-----|---------|------|
| G1 | REQ-FIX-001 | ✅ |
| G2 | REQ-FIX-002 | ✅ |
| G3 | REQ-FIX-003 | ✅ |
| G4 | REQ-FIX-004 | ✅ |
| G5 | REQ-FIX-005（决策 D1-A 已确认） | ✅ |
| G6 | REQ-FIX-006 | ✅ |
| G7 | REQ-FIX-007 | ✅ |
| G8 | REQ-FIX-008 | ✅ |
| G9 | REQ-FIX-009（决策 D2-B 降级已确认） | ✅ |
| G10 | REQ-FIX-010（决策 D3-A 已确认） | ✅ |
| G11 | REQ-FIX-011 | ✅ |

**11/11 Gap 全部覆盖，无遗漏。**

---

## 配置点清单

| 配置项 | 默认值 | 来源 | 说明 |
|--------|--------|------|------|
| `major_issue_deadline_hours` | 当日 23:59:59（即 0/未配置） | WI-0001 + 决策 D1-A | 重大问题整改期限，>0 时为 confirmed_at + hours 小时 |
| `retain_original_photos` | true | WI-0001 DD-2 | 是否保留原图（磁盘紧张时可降级） |
| JWT secret | （环境变量注入） | 决策 NFR-FIX-002 | 生产环境必须从外部注入，不硬编码 |
| DB 密码 | （环境变量注入） | 决策 NFR-FIX-002 | `fj_app` 用户密码，部署时配置 |
| JVM `-Xmx` | 768m | §4.3 | 堆上限，适配 3.6GB RAM |
| PG `shared_buffers` | 512MB | §4.3 | PG 共享内存缓冲 |
| Flyway `bootstrap-mode` | default | 运行时 | 迁移启动模式 |

---

## Out of Scope（本次 CR 不做）

- 报告变更与版本追溯（V1.1，§105.2 阶段 8）
- 统计看板与质量优化（V1.1，阶段 9）
- AI/RAG 标准匹配（§107.6）
- Android 本地数据 SQLCipher 加密（决策 D2-B 降级，后续迭代）
- HTTPS 证书自动签发（MVP 可先用 HTTP，记录技术债）
- 高测试覆盖率（本次仅覆盖核心逻辑与 Gap 修复）
- 多机部署、Docker、K8s

---

## 假设

- 假设 WI-0001 交付的 286 个文件业务逻辑正确性在首次运行后暴露的问题可在本次 CR 内修复。
- 假设用户能及时在服务器手动执行 sudo 级运维脚本（PG16/JRE17 安装）。
- 假设服务器 svr-lg 在部署与验证期间可用。
- 假设 Android 测试设备（真机或模拟器 API 28+）可用。
- 假设首次启动暴露的隐性 bug 数量可控（预估 ≤20 个，不含 11 个已知 Gap）。
