---
requirements_format: ears
work_item_id: WI-0001
title: 基础数据与权限骨架 需求规格
source_doc: 飞检现场管理系统_业务逻辑定稿_v1.14_最终干净版_开发输入.md
base_spec_version: PSV-0001
---

# WI-0001 需求规格：基础数据与权限骨架

## 1. 简介

本规格描述飞检现场管理系统 MVP 阶段1「基础数据与权限骨架」的业务需求。

本 Work Item 是整个系统的基础，建立 7 个核心业务对象（User、Role、Permission、Organization、Project、ProjectOrganization、UserProjectRole）的创建、维护、关联与权限控制能力，并为后续 WI-0002 ~ WI-0007 的业务（检查表、检查任务、日报、问题池、报告等）提供统一的人员、组织、项目和权限基础。

**范围边界**：本规格只覆盖基础数据的"建立与维护"和"权限骨架的建立"。任何检查、日报、问题、报告的业务逻辑、状态机、审批流均不在本规格范围内。

**用户规模基线**：20–50 名用户，10–20 人同时在线。

**认证方式**：V1 仅支持账号密码登录，不接入 SSO、不接入手机验证码。

## 2. 术语表

| 术语 | 定义 |
|------|------|
| 飞检 | 第三方检查公司对甲方设施进行的现场检查业务 |
| 检查执行单位 | 在项目中承担检查实施业务的第三方检查机构，是 ProjectOrganization 中 project_role=检查执行单位 的组织 |
| 检查员 | 承担现场检查业务的用户角色，是 User 在项目中分配的 role_code=检查员 的角色 |
| 机构类别（organization_type） | 组织节点"本身是什么"的固有属性，如甲方公司、站场、阀室、施工单位等，共 10 类 |
| 项目角色（project_role） | 组织节点在某个项目中"承担什么业务身份"，如甲方单位、受检分公司、检查地点、责任单位、检查执行单位等，共 10 类 |
| 项目级 RBAC | 以项目为隔离边界的基于角色的访问控制，所有项目数据查询必须校验当前用户在该项目的角色与权限 |
| 一人多角色 | 同一用户可在同一项目中同时拥有多个项目角色，权限按角色叠加计算 |
| 名称快照 | 引用组织机构时同时保存 organization_id 与 organization_name_snapshot，使历史记录不因主数据改名而变化 |
| 主数据 | 在全系统范围内唯一、权威、可被多业务重复引用的基础数据（如站场/阀室维护在 Organization） |
| 种子数据 | 系统初始化时预置的默认角色、权限点、数据字典、配置模板等数据集 |
| OperationLog | 关键操作留痕记录，含 log_hash 防篡改字段，普通用户不可修改或删除 |
| 跨组织借调 | 检查员 User.organization_id 不属于本项目检查执行单位，但仍被分配到本项目检查员角色的情况 |
| 停用（软停用） | 将对象 status 置为停用，使其不可登录/不可选用，但不物理删除历史数据 |
| 只读状态 | 项目结束后默认进入的状态，只允许查看和导出，默认不允许新增业务数据 |

## 3. 需求

### 3.1 认证与会话管理（功能需求）

#### REQ-WI0001-001 账号密码登录

**用户故事**：作为系统用户，我希望通过登录名和密码登录系统，以便访问我有权限的功能。

**验收标准**：

1. [Event-driven] WHEN 用户提交合法的 login_name 与密码，THE 系统 SHALL 校验账号存在性、账号状态为启用、密码与存储的哈希值匹配，校验通过后颁发会话凭证并记录登录时间。
2. [Unwanted-behavior] IF login_name 不存在或账号状态为停用，THEN THE 系统 SHALL 拒绝登录且不透露具体是"账号不存在"还是"密码错误"。
3. [Unwanted-behavior] IF 连续登录失败次数达到 `<login_lockout_threshold: 5>` 次（可配置），THEN THE 系统 SHALL 锁定该账号 `<login_lockout_minutes: 15>` 分钟（可配置）并在锁定期间拒绝登录。
4. [Ubiquitous] THE 系统 SHALL 不以明文形式存储或传输密码。
5. [State-driven] WHILE V1 版本运行，THE 系统 SHALL 仅支持账号密码登录，不提供 SSO 入口和手机验证码入口。

#### REQ-WI0001-002 密码修改

**用户故事**：作为已登录用户，我希望通过提交旧密码和新密码修改自己的密码，以便定期更新凭证。

**验收标准**：

1. [Event-driven] WHEN 已登录用户提交旧密码与新密码，THE 系统 SHALL 校验旧密码正确、新密码满足强度要求，校验通过后以安全哈希存储新密码。
2. [Unwanted-behavior] IF 旧密码校验失败，THEN THE 系统 SHALL 拒绝修改并记录一次密码修改失败。
3. [Ubiquitous] THE 系统 SHALL 对新密码执行强度校验：长度 `<min_password_length: 8>` 位（可配置）。

#### REQ-WI0001-003 密码重置

**用户故事**：作为系统管理员，我希望为忘记密码的用户重置密码，以便用户能重新登录。

**验收标准**：

1. [Event-driven] WHEN 系统管理员为目标用户触发密码重置并设置临时密码，THE 系统 SHALL 以安全哈希存储临时密码、记录重置操作人和操作时间、生成 OperationLog。
2. [Ubiquitous] THE 系统 SHALL 在密码重置 OperationLog 中记录被重置用户、操作人、操作时间，但不记录明文密码。
3. [State-driven] WHILE 用户使用临时密码首次登录后，THE 系统 SHALL 强制要求用户修改密码（V1 可配置是否强制）。

#### REQ-WI0001-004 会话与凭证失效

**用户故事**：作为系统管理员，我希望能够使指定用户的会话失效，以便在用户离职或账号被停用后立即收回访问权。

**验收标准**：

1. [State-driven] WHILE 用户 status 被置为停用，THE 系统 SHALL 使该用户已颁发的会话凭证失效，使其后续请求被拒绝。
2. [Event-driven] WHEN 管理员主动触发用户会话注销，THE 系统 SHALL 立即失效该用户的当前会话凭证并生成 OperationLog。
3. [Ubiquitous] THE 系统 SHALL 校验每个请求携带的会话凭证有效性与账号启用状态，失效或停用账号的请求被拒绝。

---

### 3.2 User 用户管理（功能需求）

#### REQ-WI0001-010 用户创建

**用户故事**：作为系统管理员，我希望创建用户账号，以便为飞检业务相关人员建立系统身份。

**验收标准**：

1. [Event-driven] WHEN 管理员提交用户创建表单，THE 系统 SHALL 校验 login_name 唯一性、display_name 非空，校验通过后创建用户记录并默认 status=启用。
2. [Unwanted-behavior] IF login_name 已存在，THEN THE 系统 SHALL 拒绝创建并返回明确的重复错误。
3. [Optional-feature] WHERE 管理员填写了 organization_id，THE 系统 SHALL 校验该组织机构存在且状态为启用。
4. [Ubiquitous] THE 系统 SHALL 为每个用户记录 created_at、updated_at，并在创建时生成 OperationLog。

#### REQ-WI0001-011 用户查询

**用户故事**：作为系统管理员，我希望按条件查询用户列表和用户详情，以便管理用户。

**验收标准**：

1. [Event-driven] WHEN 管理员请求用户列表并附带筛选条件（姓名、登录名、组织、状态），THE 系统 SHALL 返回匹配用户并在 `<list_query_p95: 800ms>`（可配置）内响应（P95）。
2. [Event-driven] WHEN 管理员请求单个用户详情，THE 系统 SHALL 返回该用户基本信息、所属组织，并在 `<detail_query_p95: 600ms>`（可配置）内响应（P95）。
3. [Ubiquitous] THE 系统 SHALL 对用户列表查询进行分页，默认每页 `<default_page_size: 20>` 条（可配置）。

#### REQ-WI0001-012 用户编辑

**用户故事**：作为系统管理员，我希望编辑用户的基本信息，以便保持用户资料准确。

**验收标准**：

1. [Event-driven] WHEN 管理员修改用户的 display_name、phone、email、organization_id 等非安全字段，THE 系统 SHALL 更新记录、刷新 updated_at 并生成 OperationLog。
2. [Ubiquitous] THE 系统 SHALL 不允许通过编辑接口修改 login_name（登录名一经创建不可变更，V1 可配置是否允许）。
3. [Unwanted-behavior] IF 被编辑用户 status 为停用，THEN THE 系统 SHALL 允许编辑资料但不恢复其登录能力（恢复登录须显式启用操作）。

#### REQ-WI0001-013 用户停用与启用

**用户故事**：作为系统管理员，我希望停用或启用用户账号，以便控制人员离职/复岗后的系统访问权。

**验收标准**：

1. [Event-driven] WHEN 管理员将用户停用，THE 系统 SHALL 将 status 置为停用、使该用户会话立即失效、保留所有历史数据不删除、生成 OperationLog。
2. [Ubiquitous] THE 系统 SHALL 对停用用户采用软停用，不物理删除用户记录及关联的历史业务数据。
3. [Event-driven] WHEN 管理员将停用用户重新启用，THE 系统 SHALL 将 status 置为启用并允许该用户重新登录。
4. [Unwanted-behavior] IF 停用操作针对的是当前操作人自身账号，THEN THE 系统 SHALL 拒绝该操作以防止管理员锁定自己。

#### REQ-WI0001-014 用户与组织机构关联

**用户故事**：作为系统管理员，我希望为用户指定所属组织机构，以便系统据此判断检查员归属与借调关系。

**验收标准**：

1. [Event-driven] WHEN 管理员为用户设置或修改 organization_id，THE 系统 SHALL 校验该组织存在且启用，校验通过后保存关联。
2. [Optional-feature] WHERE 用户未关联任何组织，THE 系统 SHALL 允许该用户存在但标记为"未归属组织"，此类用户分配检查员角色时按跨组织借调处理。
3. [Ubiquitous] THE 系统 SHALL 将 User.organization_id 作为用户归属组织的唯一来源，用于检查员与检查执行单位绑定校验（见 REQ-WI0001-072）。

---

### 3.3 Role 角色管理（功能需求）

#### REQ-WI0001-020 角色定义与种子角色

**用户故事**：作为系统，我需要预置标准角色集，以便项目成员能被分配到明确的业务身份。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 在初始化时预置 7 个标准角色：系统管理员、项目负责人、组长、检查员、报告编制人、报告审核人、查看者，每个角色具有唯一 role_code。
2. [Ubiquitous] THE 系统 SHALL 为每个角色标注 role_scope（system 或 project），其中系统管理员 role_scope=system，其余 6 个 role_scope=project。
3. [Ubiquitous] THE 系统 SHALL 保证组长和项目负责人是两个独立的 role_code，可由同一用户兼任（裁决C13），不合并为单一角色。
4. [Event-driven] WHEN 管理员创建自定义角色，THE 系统 SHALL 要求 role_code 唯一、role_name 非空、role_scope 为 system 或 project，校验通过后创建。

#### REQ-WI0001-021 角色查询

**用户故事**：作为系统管理员，我希望查询角色列表，以便在分配权限时选用角色。

**验收标准**：

1. [Event-driven] WHEN 管理员请求角色列表，THE 系统 SHALL 返回所有角色及其 role_code、role_name、role_scope、status。
2. [Optional-feature] WHERE 管理员按 role_scope 筛选，THE 系统 SHALL 仅返回 system 角色或 project 角色。
3. [Ubiquitous] THE 系统 SHALL 在角色列表中标注每个角色是"系统预置"还是"自定义"。

#### REQ-WI0001-022 角色启用与停用

**用户故事**：作为系统管理员，我希望停用不再使用的角色，以便防止误分配。

**验收标准**：

1. [Event-driven] WHEN 管理员停用一个角色，THE 系统 SHALL 将该角色 status 置为停用，使其不再出现在可分配角色清单中。
2. [Unwanted-behavior] IF 被停用角色仍存在启用的 UserProjectRole 关联，THEN THE 系统 SHALL 拒绝停用或要求管理员先处理这些关联（V1 可配置策略）。
3. [Ubiquitous] THE 系统 SHALL 不允许停用系统预置的 7 个标准角色，以保证核心权限模型完整。

---

### 3.4 Permission 权限点管理（功能需求）

#### REQ-WI0001-030 权限点定义与三分类

**用户故事**：作为系统，我需要建立权限点三分类（基础权限、业务权限、流程权限），以便权限可被角色组合使用。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 将每个权限点归属到三类之一：基础权限（创建/编辑草稿/提交审批/审批/发布/作废/变更报告/查看）、业务权限（项目管理/组织机构维护/检查任务派发等）、流程权限（由流程节点配置决定）。
2. [Ubiquitous] THE 系统 SHALL 为每个权限点记录 permission_code（唯一）、permission_name、resource_type、action、description。
3. [Event-driven] WHEN 管理员创建权限点，THE 系统 SHALL 校验 permission_code 唯一性、resource_type 与 action 非空，校验通过后创建。

#### REQ-WI0001-031 权限点种子数据

**用户故事**：作为系统，我需要在初始化时预置标准权限点清单，以便角色能引用完整的权限。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 在初始化时预置至少 8 项基础通用权限（创建、编辑草稿、提交审批、审批、发布、作废、变更报告、查看）。
2. [Ubiquitous] THE 系统 SHALL 在初始化时预置业务权限，包括但不限于：项目管理、组织机构维护、检查任务派发、现场检查执行、日报确认、报告生成、报告导出、管理员越权。
3. [Ubiquitous] THE 系统 SHALL 在初始化时为"管理员越权"权限标注特殊标记，使其使用时必须填写原因并留痕。

#### REQ-WI0001-032 角色与权限点关联

**用户故事**：作为系统管理员，我希望为角色分配权限点集合，以便角色持有确定的权限。

**验收标准**：

1. [Event-driven] WHEN 管理员为一个角色配置权限点集合，THE 系统 SHALL 校验权限点存在且启用，校验通过后保存角色—权限点关联。
2. [Ubiquitous] THE 系统 SHALL 在初始化时为 7 个标准角色预置默认权限点集合。
3. [Event-driven] WHEN 管理员修改角色权限点集合，THE 系统 SHALL 生成 OperationLog 记录变更前后差异。

---

### 3.5 Organization 组织机构管理（功能需求）

#### REQ-WI0001-040 组织机构创建

**用户故事**：作为系统管理员，我希望创建组织机构主数据，以便在项目、日报、问题、报告中统一引用。

**验收标准**：

1. [Event-driven] WHEN 管理员提交组织机构创建表单，THE 系统 SHALL 校验 organization_name 非空、organization_type 为合法枚举值，校验通过后创建记录并默认 status=启用。
2. [Optional-feature] WHERE 管理员填写了 parent_id，THE 系统 SHALL 校验上级组织存在且启用，并建立父子关系。
3. [Unwanted-behavior] IF 创建的组织形成循环引用（如 A 的上级是 B，B 的上级是 A），THEN THE 系统 SHALL 拒绝创建并返回循环引用错误。
4. [Ubiquitous] THE 系统 SHALL 为每个组织记录 created_at、updated_at、created_by，并在创建时生成 OperationLog。

#### REQ-WI0001-041 组织机构树形结构

**用户故事**：作为系统管理员，我希望以树形结构维护组织机构的上下级关系，以便表达公司→分公司→站场的层级。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 通过 parent_id 字段表达组织机构的上下级树形结构，支持任意层级嵌套。
2. [Event-driven] WHEN 管理员请求组织机构树，THE 系统 SHALL 返回以根节点为起点的完整树结构（或按权限范围裁剪）。
3. [Unwanted-behavior] IF 管理员请求删除一个仍拥有子节点的组织，THEN THE 系统 SHALL 拒绝删除并提示存在下级组织。
4. [Ubiquitous] THE 系统 SHALL 保证每个组织节点最多有一个 parent_id（单父树形结构）。

#### REQ-WI0001-042 机构类别（organization_type）枚举

**用户故事**：作为系统，我需要为组织机构提供固定的机构类别枚举，以便区分组织节点本身的性质。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 将 organization_type 限定为 10 类枚举：甲方公司、甲方分公司、作业区、站场、阀室、施工单位、监理单位、检测单位、第三方检查机构、其他。
2. [Unwanted-behavior] IF 创建/修改组织时 organization_type 不在枚举范围内，THEN THE 系统 SHALL 拒绝操作。
3. [Ubiquitous] THE 系统 SHALL 将"机构类别"与"项目角色"严格分开：organization_type 描述组织本身性质，project_role 描述组织在某项目中的业务身份（裁决C18.3）。

#### REQ-WI0001-043 站场与阀室主数据裁决

**用户故事**：作为系统架构，我需要确保站场、阀室的主数据唯一维护在 Organization，以便全系统引用一致的主数据。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 将 organization_type=站场 或 organization_type=阀室 的 Organization 作为站场、阀室的唯一主数据来源（裁决C14）。
2. [Ubiquitous] THE 系统 SHALL 不允许通过非 Organization 渠道维护独立的站场/阀室主数据副本。
3. [Unwanted-behavior] IF 现场发现疑似新增站场/阀室且尚无对应 Organization，THEN THE 系统 SHALL 将其纳入"基础数据待补录"清单，由 Web 管理员确认后才新增或匹配正式 Organization，不直接创建主数据。
4. [Ubiquitous] THE 系统 SHALL 保证安卓端 V1 不直接创建正式站场/阀室 Organization 主数据，安卓端只能创建临时位置记录或待补录请求（裁决C14）。

#### REQ-WI0001-044 组织机构查询

**用户故事**：作为系统用户，我希望按条件查询组织机构，以便在业务中选择正确的组织。

**验收标准**：

1. [Event-driven] WHEN 用户请求组织机构列表并附带筛选条件（名称、类别、状态），THE 系统 SHALL 返回匹配组织并在 `<list_query_p95: 800ms>`（可配置）内响应（P95）。
2. [Optional-feature] WHERE 用户按 organization_type=站场 筛选，THE 系统 SHALL 仅返回站场类组织，用于业务场景的位置选择。
3. [Event-driven] WHEN 用户请求单个组织详情，THE 系统 SHALL 返回该组织信息及其直接上下级，并在 `<detail_query_p95: 600ms>`（可配置）内响应（P95）。

#### REQ-WI0001-045 组织机构编辑

**用户故事**：作为系统管理员，我希望编辑组织机构信息，以便保持主数据准确。

**验收标准**：

1. [Event-driven] WHEN 管理员修改组织的名称、简称、编码、联系人、区域等字段，THE 系统 SHALL 更新记录、刷新 updated_at 并生成 OperationLog。
2. [Optional-feature] WHERE 管理员修改 parent_id，THE 系统 SHALL 校验不产生循环引用后再更新。
3. [Unwanted-behavior] IF 修改 organization_type 会影响站场/阀室主数据性质（如站场改为其他），THEN THE 系统 SHALL 警告该操作可能影响历史引用，并要求管理员确认。

#### REQ-WI0001-046 组织机构停用与启用

**用户故事**：作为系统管理员，我希望停用不再使用的组织机构，以便防止误引用。

**验收标准**：

1. [Event-driven] WHEN 管理员停用组织机构，THE 系统 SHALL 将 status 置为停用、使其不再出现在新业务的可选清单中、保留历史引用数据不变。
2. [Ubiquitous] THE 系统 SHALL 对停用组织采用软停用，不物理删除组织记录及关联历史数据。
3. [Unwanted-behavior] IF 被停用组织仍作为某些启用项目的默认参建单位，THEN THE 系统 SHALL 警告并要求管理员确认（V1 可配置是否阻断）。

#### REQ-WI0001-047 名称快照规则

**用户故事**：作为系统架构，我需要确保引用组织机构的历史记录保存名称快照，以便主数据改名不影响历史。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 在日报、项目问题池、报告等业务对象引用组织机构时，同时保存 organization_id 与 organization_name_snapshot。
2. [Unwanted-behavior] IF 主数据的组织名称被修改，THEN THE 系统 SHALL 不追溯更新已生成历史记录中的 organization_name_snapshot。
3. [Ubiquitous] THE 系统 SHALL 在生成新的历史记录时，从当前 Organization 读取名称写入快照（裁决C18.7）。

> 说明：名称快照的"消费方"（日报/问题池/报告）属后续 WI 范围；本需求确立快照规则作为基础约定，确保后续 WI 遵循。

---

### 3.6 Project 项目管理（功能需求）

#### REQ-WI0001-050 项目创建

**用户故事**：作为系统管理员或项目负责人，我希望创建飞检项目，以便承接合同中的检查业务基本信息。

**验收标准**：

1. [Event-driven] WHEN 用户提交项目创建表单，THE 系统 SHALL 校验 project_name 非空、client_organization_id（甲方单位）非空且组织存在启用，校验通过后创建项目并默认 status=进行中。
2. [Optional-feature] WHERE 用户未填写 project_code，THE 系统 SHALL 允许项目编号为空或按规则生成（V1 可配置生成策略）。
3. [Ubiquitous] THE 系统 SHALL 为每个项目记录 created_by、created_at、updated_at，并在创建时生成 OperationLog。
4. [Optional-feature] WHERE 用户填写了 specialties（检查专业），THE 系统 SHALL 支持多选存储。

#### REQ-WI0001-051 项目查询

**用户故事**：作为系统用户，我希望查询我有权限的项目，以便进入项目开展工作。

**验收标准**：

1. [Event-driven] WHEN 用户请求项目列表，THE 系统 SHALL 仅返回该用户通过 UserProjectRole 拥有角色的项目（项目级 RBAC 隔离）。
2. [Event-driven] WHEN 用户请求单个项目详情，THE 系统 SHALL 校验该用户在该项目拥有角色后才返回详情。
3. [Unwanted-behavior] IF 用户请求未授权的项目详情，THEN THE 系统 SHALL 返回权限不足错误（裁决C103.3 项目级 RBAC）。

#### REQ-WI0001-052 项目编辑

**用户故事**：作为项目负责人，我希望编辑项目基本信息，以便保持项目资料准确。

**验收标准**：

1. [Event-driven] WHEN 拥有项目管理权限的用户修改项目信息，THE 系统 SHALL 更新记录、刷新 updated_at 并生成 OperationLog。
2. [State-driven] WHILE 项目 status=已结束（只读），THE 系统 SHALL 默认禁止编辑项目业务字段，仅允许管理员在开启变更权限后编辑（见 REQ-WI0001-101）。
3. [Ubiquitous] THE 系统 SHALL 不允许通过编辑接口修改 created_by、created_at。

#### REQ-WI0001-053 项目结束

**用户故事**：作为项目负责人，我希望结束项目，以便项目进入只读归档状态。

**验收标准**：

1. [Event-driven] WHEN 拥有权限的用户结束项目，THE 系统 SHALL 将 status 置为已结束、使项目进入只读状态、生成 OperationLog。
2. [Ubiquitous] THE 系统 SHALL 在项目已结束状态下默认禁止新增日报、检查任务、问题和报告（裁决C103.8）。
3. [Optional-feature] WHERE 项目已结束，THE 系统 SHALL 允许查看和导出已发布报告（只读访问保留）。

#### REQ-WI0001-054 项目配置项

**用户故事**：作为项目负责人，我希望配置项目的校验规则，以便按项目管理要求调整业务约束。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 为每个项目提供配置项集合，至少包含：是否强制照片、是否强制标准依据、是否强制严重等级、问题描述最少字数、照片未同步是否允许提交、照片未同步是否允许确认、待完善问题是否允许随日报提交、确认入池前是否要求整改期限（裁决C93.7）。
2. [Optional-feature] WHERE 项目未自定义配置，THE 系统 SHALL 应用默认项目配置模板（见 REQ-WI0001-111）的值。
3. [Event-driven] WHEN 拥有权限的用户修改项目配置项，THE 系统 SHALL 校验配置项取值合法性后保存，并生成 OperationLog。
4. [Ubiquitous] THE 系统 SHALL 为配置项设置默认值（见"配置点清单"章节）。

#### REQ-WI0001-055 项目时区配置

**用户故事**：作为系统，我需要为每个项目配置时区，以便日报日期统计口径正确。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 为每个项目提供 project_timezone 配置项，默认采用服务器所在地或部署所在地时区（裁决C103.9）。
2. [Optional-feature] WHERE 项目未自定义时区，THE 系统 SHALL 使用默认时区。
3. [Ubiquitous] THE 系统 SHALL 在项目范围内统一使用 project_timezone 解释业务时间（具体消费由后续 WI 实现）。

---

### 3.7 ProjectOrganization 项目参与单位（功能需求）

#### REQ-WI0001-060 项目参建单位关联

**用户故事**：作为项目负责人，我希望将组织机构关联到项目并指定其项目角色，以便表达参建单位的业务身份。

**验收标准**：

1. [Event-driven] WHEN 用户为项目添加参建单位关联，THE 系统 SHALL 校验 project_id 存在、organization_id 存在且启用、project_role 为合法枚举，校验通过后创建 ProjectOrganization 记录。
2. [Unwanted-behavior] IF 同一项目内同一组织已存在相同 project_role 的启用关联，THEN THE 系统 SHALL 拒绝重复创建（V1 可配置是否允许同组织多角色）。
3. [Ubiquitous] THE 系统 SHALL 在创建参建单位关联时生成 OperationLog。

#### REQ-WI0001-061 项目角色（project_role）分类

**用户故事**：作为系统，我需要为项目参与单位提供固定的项目角色枚举，以便区分组织在项目中的业务身份。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 将 project_role 限定为 10 类枚举：甲方单位、受检分公司、检查地点、施工单位、监理单位、检测单位、作业区、责任单位、检查执行单位、其他（裁决C18.5）。
2. [Unwanted-behavior] IF 创建/修改参建单位关联时 project_role 不在枚举范围内，THEN THE 系统 SHALL 拒绝操作。
3. [Ubiquitous] THE 系统 SHALL 严格区分 organization_type（机构类别）与 project_role（项目角色），同一组织在不同项目可有不同 project_role（裁决C18.3）。

#### REQ-WI0001-062 默认参建单位

**用户故事**：作为项目负责人，我希望标记项目的默认参建单位，以便业务场景快速选用。

**验收标准**：

1. [Optional-feature] WHERE 用户将参建单位标记为 is_default=是，THE 系统 SHALL 在该项目的对应角色类别中将其作为默认候选。
2. [Ubiquitous] THE 系统 SHALL 保证每个项目的每个 project_role 类别至多有一个 is_default=是的参建单位（V1 可配置是否允许多默认）。
3. [Event-driven] WHEN 用户将一个参建单位设为默认且该角色已有其他默认，THE 系统 SHALL 按策略转移默认标记或拒绝（V1 可配置策略）。

#### REQ-WI0001-063 第三方检查机构与检查执行单位绑定

**用户故事**：作为项目负责人，我希望将第三方检查机构绑定到项目作为检查执行单位，以便检查员归属正确。

**验收标准**：

1. [Event-driven] WHEN 用户将 organization_type=第三方检查机构 的组织关联到项目并指定 project_role=检查执行单位，THE 系统 SHALL 允许并记录该绑定（裁决C101.4）。
2. [Ubiquitous] THE 系统 SHALL 保证检查执行单位是 ProjectOrganization 中 project_role=检查执行单位 的 Organization（裁决C101.4）。
3. [Optional-feature] WHERE 项目尚未绑定检查执行单位，THE 系统 SHALL 允许创建项目但提示尚未配置检查执行单位。

---

### 3.8 UserProjectRole 用户-项目-角色分配（功能需求）

#### REQ-WI0001-070 项目成员角色分配

**用户故事**：作为项目负责人，我希望为用户在项目中分配角色，以便用户能在该项目中承担相应业务职责。

**验收标准**：

1. [Event-driven] WHEN 拥有权限的用户为某用户在某项目分配角色，THE 系统 SHALL 校验用户存在且启用、项目存在、角色存在且启用，校验通过后创建 UserProjectRole 记录，记录 assigned_by、assigned_at。
2. [Ubiquitous] THE 系统 SHALL 默认将新分配的 UserProjectRole status 置为启用。
3. [Event-driven] WHEN 用户被分配角色，THE 系统 SHALL 生成 OperationLog 记录分配人、被分配用户、项目、角色。

#### REQ-WI0001-071 一人多角色

**用户故事**：作为项目负责人，我希望同一用户在同一项目能拥有多个角色，以便兼任多职责（如既担任组长又担任检查员）。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 允许同一用户在同一项目同时拥有多个 project role（裁决C13）。
2. [Ubiquitous] THE 系统 SHALL 保证组长与项目负责人为独立 role_code，可由同一用户兼任（裁决C13）。
3. [Unwanted-behavior] IF 同一用户在同一项目被分配完全相同的角色（重复），THEN THE 系统 SHALL 拒绝重复创建。
4. [Ubiquitous] THE 系统 SHALL 按用户在某项目拥有的所有角色叠加计算权限（裁决C25.11.3）。

#### REQ-WI0001-072 检查员与检查执行单位绑定校验

**用户故事**：作为系统，我需要校验被分配检查员角色的用户是否属于本项目的检查执行单位，以便保证检查员归属正确。

**验收标准**：

1. [Event-driven] WHEN 用户被分配 role_code=检查员 的项目角色，THE 系统 SHALL 校验该用户 User.organization_id 是否属于本项目的检查执行单位（project_role=检查执行单位 的 Organization）（裁决C101.4）。
2. [Unwanted-behavior] IF 用户 organization_id 不属于本项目检查执行单位，THEN THE 系统 SHALL 触发跨组织借调流程（见 REQ-WI0001-073），不允许直接完成分配。
3. [Ubiquitous] THE 系统 SHALL 在 UserProjectRole 中保留检查员归属检查执行单位的判定依据，以便后续业务追溯。

#### REQ-WI0001-073 跨组织借调留痕

**用户故事**：作为系统管理员，我希望在检查员跨组织借调时记录原因，以便留痕并明确责任。

**验收标准**：

1. [Complex] WHERE 用户 organization_id 不属于本项目检查执行单位，AND 管理员确认借调并填写借调原因，WHEN 提交分配，THE 系统 SHALL 允许完成检查员角色分配并强制记录借调原因（裁决C101.4）。
2. [Ubiquitous] THE 系统 SHALL 为每次跨组织借调生成 OperationLog，记录被借调用户、目标项目、原因、操作人、操作时间。
3. [Unwanted-behavior] IF 跨组织借调未填写原因，THEN THE 系统 SHALL 拒绝完成分配。

#### REQ-WI0001-074 项目成员角色停用与移除

**用户故事**：作为项目负责人，我希望停用或移除项目成员的角色，以便处理人员调整。

**验收标准**：

1. [Event-driven] WHEN 拥有权限的用户停用某 UserProjectRole，THE 系统 SHALL 将 status 置为停用、使用户失去该项目该角色的权限、保留历史数据不删除。
2. [Ubiquitous] THE 系统 SHALL 在角色关联停用时生成 OperationLog。
3. [State-driven] WHILE 某用户的全部 UserProjectRole 被停用，THE 系统 SHALL 使该用户失去该项目的全部访问权限。

---

### 3.9 项目级 RBAC 与权限隔离（功能需求）

#### REQ-WI0001-080 项目数据查询权限校验

**用户故事**：作为系统架构，我需要确保所有项目数据查询校验 project_id 权限范围，以便实现项目间数据隔离。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 对所有项目范围的数据查询校验当前用户在该项目拥有至少一个启用的 UserProjectRole（裁决C103.3 项目级 RBAC）。
2. [Unwanted-behavior] IF 用户请求非授权项目的数据，THEN THE 系统 SHALL 返回权限不足错误，不返回任何项目数据。
3. [Ubiquitous] THE 系统 SHALL 将系统管理员（role_scope=system）视为可跨项目访问的特权角色，其访问也需留痕。

#### REQ-WI0001-081 越权操作留痕

**用户故事**：作为系统，我需要确保管理员越权操作必须填写原因并留痕，以便审计异常流程。

**验收标准**：

1. [Complex] WHERE 用户持"管理员越权"权限，AND 越权操作发生，WHEN 提交越权动作，THE 系统 SHALL 强制要求填写越权原因并生成 OperationLog（裁决C25.11.2）。
2. [Unwanted-behavior] IF 越权操作未填写原因，THEN THE 系统 SHALL 拒绝执行该操作。
3. [Ubiquitous] THE 系统 SHALL 在 OperationLog 中标注该操作为"越权"，并记录原因、操作人、操作时间、受影响对象。

---

### 3.10 审计与留痕（功能需求）

#### REQ-WI0001-090 关键操作留痕

**用户故事**：作为系统，我需要为关键操作生成 OperationLog，以便审计追溯。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 为以下关键操作生成 OperationLog：用户创建/停用/启用、密码重置、组织机构增删改、项目创建/结束、参建单位关联变更、项目成员角色分配/停用、越权操作、角色权限变更、项目配置变更。
2. [Ubiquitous] THE 系统 SHALL 在每条 OperationLog 中记录操作类型、操作人、操作时间、受影响对象、变更摘要。
3. [Ubiquitous] THE 系统 SHALL 为每条 OperationLog 计算 log_hash 防篡改字段（裁决C103.3）。

#### REQ-WI0001-091 审计日志不可修改删除

**用户故事**：作为系统，我需要确保审计日志不可被普通用户修改或删除，以便保证审计完整性。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 不允许普通用户修改或删除 OperationLog 记录（裁决C103.3）。
2. [Ubiquitous] THE 系统 SHALL 保证 OperationLog 在项目生命周期内可在线查询（裁决C103.5）。
3. [Optional-feature] WHERE 项目结束转入冷归档，THE 系统 SHALL 保留 OperationLog 可按项目恢复查询（裁决C103.5）。

---

### 3.11 人员状态与项目生命周期（功能需求）

#### REQ-WI0001-100 检查员离职处理

**用户故事**：作为项目负责人，我希望在检查员离职后妥善处理其待办事项，以便业务不中断。

**验收标准**：

1. [Event-driven] WHEN 检查员离职被停用（User.status=停用），THE 系统 SHALL 不删除其历史数据、使其会话失效、使其失去项目访问权（裁决C103.8）。
2. [Ubiquitous] THE 系统 SHALL 在检查员离职后，将其待执行任务由组长重新分配（任务重分配业务由后续 WI 实现，本需求确立约定）（裁决C103.8）。
3. [Ubiquitous] THE 系统 SHALL 将离职检查员的待完善问题由组长转交其他检查员补充，并生成 OperationLog（问题转交业务由后续 WI 实现，本需求确立约定）（裁决C103.8）。
4. [Ubiquitous] THE 系统 SHALL 对离职检查员已提交未确认的日报继续走正常审批或由管理员越权处理（裁决C103.8）。

#### REQ-WI0001-101 项目结束与变更权限重开

**用户故事**：作为系统管理员或项目负责人，我希望在项目结束后按需重新开启变更权限，以便进行报告变更。

**验收标准**：

1. [State-driven] WHILE 项目 status=已结束，THE 系统 SHALL 默认不允许新增日报、任务、问题和报告（裁决C103.8）。
2. [Complex] WHERE 项目已结束，AND 管理员或项目负责人重新开启变更权限并填写原因，WHEN 开启操作完成，THE 系统 SHALL 允许报告变更类操作并留痕（裁决C103.8）。
3. [Ubiquitous] THE 系统 SHALL 在项目结束状态下保留已发布报告的查看和导出能力（裁决C103.8）。

---

### 3.12 系统初始化与种子数据（功能需求）

#### REQ-WI0001-110 系统初始化数据集

**用户故事**：作为系统，我需要在首次初始化时预置完整的种子数据，以便系统开箱即用。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 在初始化时预置 7 个标准角色（系统管理员、项目负责人、组长、检查员、报告编制人、报告审核人、查看者）（裁决C103.7）。
2. [Ubiquitous] THE 系统 SHALL 在初始化时预置默认权限点清单（基础权限 + 业务权限）（裁决C103.7）。
3. [Ubiquitous] THE 系统 SHALL 在初始化时预置默认数据字典，至少包含：机构类别、项目角色（裁决C103.7）；专业、问题分类、严重等级、照片类型、报告类型等业务字典随初始化一并写入，其业务消费在后续 WI。
4. [Ubiquitous] THE 系统 SHALL 在初始化时预置默认审批模板（无审批、一级审批、两级审批）及默认严重等级整改期限（一般 7 天、较大 3 天、重大立即整改），其业务消费在后续 WI（裁决C103.7）。
5. [Ubiquitous] THE 系统 SHALL 保证初始化过程可重复执行且幂等（重复初始化不产生重复种子数据）。

#### REQ-WI0001-111 默认管理员账号与项目配置模板

**用户故事**：作为系统，我需要提供默认管理员账号创建流程和默认项目配置模板，以便首次部署后可立即管理。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 提供默认系统管理员账号创建流程，并在首次启动时引导设置管理员密码（裁决C103.7）。
2. [Ubiquitous] THE 系统 SHALL 在初始化时预置默认项目配置模板，包含第 93.7 节全部配置项的默认值（裁决C103.7）。
3. [Ubiquitous] THE 系统 SHALL 将默认管理员账号与系统管理员角色（role_scope=system）关联，使其具备系统管理权限。

---

### 3.13 非功能需求（NFR）

#### REQ-WI0001-N01 性能基线

1. [Ubiquitous] THE 系统 SHALL 在 20–50 用户、10–20 并发的负载下满足列表查询 P95 ≤ 800ms、详情查询 P95 ≤ 600ms（裁决C103）。
2. [Ubiquitous] THE 系统 SHALL 支持组织机构树查询在单次请求内返回完整树（节点规模在数百级以内时）。

#### REQ-WI0001-N02 安全基线

1. [Ubiquitous] THE 系统 SHALL 使用安全哈希（BCrypt）存储密码，不得明文存储（裁决C103.3）。
2. [Ubiquitous] THE 系统 SHALL 在生产环境强制 HTTPS 传输加密（裁决C103.3）。
3. [Ubiquitous] THE 系统 SHALL 对所有项目数据查询执行 project_id 权限范围校验（裁决C103.3）。
4. [Ubiquitous] THE 系统 SHALL 保证照片和导出文件通过鉴权接口访问，不暴露任意路径下载（裁决C103.3）。

#### REQ-WI0001-N03 可用性与并发

1. [Ubiquitous] THE 系统 SHALL 支持 10–20 用户同时在线操作而不出现功能异常（裁决C103）。
2. [Ubiquitous] THE 系统 SHALL 对并发冲突的用户编辑提供乐观锁或等价机制，防止覆盖丢失。

#### REQ-WI0001-N04 备份与恢复

1. [Ubiquitous] THE 系统 SHALL 至少每日全量备份，RPO ≤ 24 小时，RTO ≤ 24 小时（裁决C103.5）。
2. [Ubiquitous] THE 系统 SHALL 保证已发布报告、审批记录、OperationLog 不被覆盖（裁决C103.5）。

#### REQ-WI0001-N05 可审计性

1. [Ubiquitous] THE 系统 SHALL 保证 OperationLog 含 log_hash 且不可被普通用户篡改（裁决C103.3）。
2. [Ubiquitous] THE 系统 SHALL 保证关键操作的 OperationLog 在项目生命周期内可在线查询（裁决C103.5）。

---

### 3.14 约束（Constraint）

#### REQ-WI0001-C01 技术栈约束

- 后端：Java 17 + Spring Boot 3.x + Spring Security + JWT + BCrypt（技术栈已冻结，裁决C106.2）
- 数据库：PostgreSQL 15 + Flyway 数据库迁移
- 前端：Vue 3 + TypeScript + Element Plus
- 数据库变更必须通过 Flyway 迁移脚本管理，不手动改库

#### REQ-WI0001-C02 认证方式约束

- V1 仅支持账号密码登录，不接入 SSO、不接入手机验证码（裁决C103.3）
- SSO / 手机验证码为后续版本可选项，本 WI 不实现

#### REQ-WI0001-C03 业务规则约束

- 项目级 RBAC 是强制权限模型，所有项目数据查询必须校验 project_id（裁决C103.3）
- 机构类别（organization_type）与项目角色（project_role）必须严格分离（裁决C18.3）
- 站场/阀室主数据唯一维护在 Organization（裁决C14）
- 一人多角色为系统支持能力，权限叠加计算（裁决C13）

#### REQ-WI0001-C04 数据完整性约束

- 所有软删除对象采用 status=停用，不物理删除（裁决C103.8）
- 引用组织机构的历史记录必须保存名称快照（裁决C18.7）
- 审计日志不可修改删除（裁决C103.3）

---

## 4. 不在范围内（明确排除）

以下内容属于 WI-0002 ~ WI-0007 或后续迭代，**不在 WI-0001 范围内**：

| 排除项 | 归属 WI / 迭代 |
|--------|----------------|
| 项目检查表（InspectionChecklist）的编制、发布、停用逻辑 | WI-0002 |
| 检查任务（InspectionTask）的派发、执行、取消 | WI-0003 |
| 日报（DailyReport）的生成、提交、确认、退回、作废 | WI-0003 / WI-0004 |
| 项目问题池（ProjectIssue）的入池、作废、追溯 | WI-0004 |
| 周报/月报（Report）的生成、审批、发布、导出、变更 | WI-0005 / WI-0006 |
| 报告问题快照（ReportIssueSnapshot）的编辑 | WI-0006 |
| 标准库（StandardDocument / StandardClause）维护 | WI-0002 |
| 审批流程引擎（ApprovalRecord 的流程驱动） | WI-0005 / WI-0006 |
| LocationDetail / Equipment 对象的维护（站场主数据在 Organization，但位置明细对象本身不在本 WI） | WI-0003 |
| 安卓端离线、照片管理、同步机制 | WI-0003 |
| 统计看板、报告变更增强、标准推荐优化 | 后续迭代 |
| 甲方外部访问门户、外部账号权限模型 | 后续迭代（裁决C103.8） |
| 复杂权限矩阵、动态权限编排 | 后续迭代（V1 不做，裁决C25.11） |
| SSO / 手机验证码登录 | 后续迭代（裁决C103.3） |

> 注：初始化种子数据中的"专业/问题分类/严重等级/照片类型/报告类型"数据字典、"审批模板"、"整改期限"虽在本 WI 一次性初始化写入，但其业务消费逻辑属后续 WI。本 WI 只负责"建立和维护这些种子数据的能力"。

---

## 5. 配置点清单

| 配置项 | 默认值 | 所属需求 | 说明 |
|--------|--------|----------|------|
| login_lockout_threshold | 5 | REQ-WI0001-001 | 连续登录失败锁定阈值 |
| login_lockout_minutes | 15 | REQ-WI0001-001 | 账号锁定时长（分钟） |
| min_password_length | 8 | REQ-WI0001-002 | 新密码最少长度 |
| list_query_p95 | 800 | REQ-WI0001-011/044 | 列表查询 P95 目标（ms） |
| detail_query_p95 | 600 | REQ-WI0001-011/044 | 详情查询 P95 目标（ms） |
| default_page_size | 20 | REQ-WI0001-011 | 列表默认每页条数 |
| project_timezone | 服务器所在地时区 | REQ-WI0001-055 | 项目默认时区 |
| require_photo | 否 | REQ-WI0001-054 | 是否强制照片（裁决C93.7） |
| require_standard_basis | 否 | REQ-WI0001-054 | 是否强制标准依据 |
| require_severity | 否 | REQ-WI0001-054 | 是否强制严重等级 |
| min_description_length | 100 | REQ-WI0001-054 | 问题描述最少字数 |
| allow_submit_with_unsynced_photos | 是 | REQ-WI0001-054 | 照片未同步是否允许提交 |
| allow_confirm_with_unsynced_photos | 否 | REQ-WI0001-054 | 照片未同步是否允许确认 |
| allow_submit_incomplete_issues | 是 | REQ-WI0001-054 | 待完善问题是否允许随日报提交 |
| require_rectification_deadline_before_confirm | 是 | REQ-WI0001-054 | 确认入池前是否要求整改期限 |

> 注：项目配置项（require_photo 等）的业务消费在后续 WI，本 WI 仅负责"配置项的建立与默认模板"。

---

## 6. 开放问题（需用户澄清）

| 编号 | 问题 | 影响 | 建议 |
|------|------|------|------|
| Q1 | login_name 创建后是否允许修改？REQ-WI0001-012 默认设为"V1 可配置是否允许"。 | 用户管理 | 建议默认禁止修改以保持追溯稳定 |
| Q2 | 角色停用但存在启用关联时，是拒绝停用还是级联停用关联？REQ-WI0001-022 默认"V1 可配置策略"。 | 角色管理 | 建议默认拒绝停用，避免误操作 |
| Q3 | 停用组织仍为项目默认参建单位时，是阻断还是警告？REQ-WI0001-046 默认"V1 可配置是否阻断"。 | 组织管理 | 建议默认警告确认 |
| Q4 | 同一项目同一组织是否允许相同 project_role 重复关联？REQ-WI0001-060 默认拒绝。 | 参建单位 | 建议保持拒绝 |
| Q5 | 同一项目同一角色类别是否允许多个默认参建单位？REQ-WI0001-062 默认至多一个。 | 参建单位 | 建议保持至多一个 |
| Q6 | 首次使用临时密码登录后是否强制改密？REQ-WI0001-003 标注"V1 可配置"。 | 安全 | 建议默认强制改密 |
