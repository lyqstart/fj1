---
requirements_format: ears
---

# 飞检现场管理系统 — 需求规格（候选）

## 简介

本系统为第三方飞检公司提供现场检查管理平台，覆盖项目建立、检查表编制、任务派发、现场检查、日报形成、问题池沉淀、报告生成、审核发布全流程。系统支持 Web（PC）端和 Android（现场）端双端，Android 端必须支持完整离线作业。

- 唯一业务输入：`doc/飞检现场管理系统_业务逻辑定稿_v1.14_最终干净版_开发输入.md`（9192 行）
- MVP 范围：文档 §105.1 阶段 1-7，不收敛
- 用户规模：20-50 用户，10-20 并发
- 数据量基线（§103.2）：单项目 500 任务 / 3000 问题 / 10000 照片 / 200 报告

## 术语表

| 术语 | 定义 |
|------|------|
| 飞检 | 第三方受委托对工程项目进行的现场检查 |
| 检查任务 | 派发给检查人员的具体检查工作单元 |
| 日报 | 检查人员每日提交的现场检查报告 |
| 问题/发现 | 检查中发现的不符合项或缺陷记录 |
| 项目问题池 | 项目级问题汇总库，由日报问题确认后沉淀生成 |
| 重大问题 | 等级为"重大"的问题，需当日内整改 |
| 整改期限 | 问题确认后要求完成整改的截止时间（DateTime，精确到秒） |
| 快照 | 报告发布时对问题状态的固化记录，不可修改 |
| 确认 | 将日报问题写入项目问题池的动作，记录 confirmed_at |
| confirmed_at | 问题被确认写入项目问题池的时间戳 |
| locked_at | 问题被锁定（随报告发布快照）的时间戳 |
| 固化 | 报告发布后内容不可再修改的状态 |
| 标准/规范 | 检查依据的国家/行业/地方标准条文 |

## 需求

### FR-1 基础数据与权限骨架（阶段 1）

#### REQ-1 用户登录认证

作为系统用户，我希望通过账号密码登录系统，以便安全访问系统功能。

1. [Event-driven] WHEN 用户提交账号和密码, THE 系统 SHALL 校验凭据并返回认证令牌。
2. [Unwanted-behavior] IF 凭据错误, THEN THE 系统 SHALL 返回错误提示且不泄露具体失败原因（用户名错误 vs 密码错误不可区分）。
3. [Ubiquitous] THE 系统 SHALL 对所有密码进行哈希存储，禁止明文存储。

#### REQ-2 项目级角色权限控制

作为系统管理员，我希望按项目分配角色权限，以便不同人员只能访问授权范围内的功能和数据。

1. [Ubiquitous] THE 系统 SHALL 实施项目级 RBAC，角色包括系统管理员、项目负责人、检查人员、审批人等。
2. [State-driven] WHILE 用户未拥有某项目的访问权限, THE 系统 SHALL 拒绝该用户访问该项目的任何数据。
3. [Unwanted-behavior] IF 用户尝试越权访问, THEN THE 系统 SHALL 拒绝并记录越权留痕。

#### REQ-3 组织与人员管理

作为系统管理员，我希望管理受检单位和检查团队信息，以便在任务派发和问题归属时引用。

1. [Event-driven] WHEN 管理员创建受检单位, THE 系统 SHALL 保存单位信息并分配唯一标识。
2. [Event-driven] WHEN 管理员创建检查人员账号, THE 系统 SHALL 保存人员信息并关联所属角色与项目。
3. [Ubiquitous] THE 系统 SHALL 支持受检单位的启用/停用状态管理。

#### REQ-4 检查标准库管理

作为项目负责人，我希望维护检查标准条文库，以便在编制检查表时引用。

1. [Event-driven] WHEN 用户录入标准条文, THE 系统 SHALL 保存并按分类存储（国家/行业/地方标准）。
2. [Event-driven] WHEN 用户查询标准库, THE 系统 SHALL 支持按分类、关键词检索。
3. [State-driven] WHILE 设备离线, THE 系统 SHALL 使用本地缓存的标准库支持轻量标准推荐。

### FR-2 项目配置与检查表编制（阶段 2）

#### REQ-5 项目创建与配置

作为项目负责人，我希望创建检查项目并配置参数，以便启动检查流程。

1. [Event-driven] WHEN 用户创建项目, THE 系统 SHALL 生成项目记录并分配唯一项目编号。
2. [Event-driven] WHEN 用户配置项目参数, THE 系统 SHALL 保存配置（含整改期限规则、关联单位、检查团队等）。
3. [Optional-feature] WHERE 项目配置了 `major_issue_deadline_hours`, THE 系统 SHALL 按该值计算重大问题整改期限。

#### REQ-6 检查表编制

作为项目负责人，我希望为项目编制检查表，以便定义检查项和关联检查标准。

1. [Event-driven] WHEN 用户添加检查项, THE 系统 SHALL 保存检查项并关联检查标准条文。
2. [Event-driven] WHEN 用户编排检查表结构, THE 系统 SHALL 按专业/部位组织检查项。
3. [Ubiquitous] THE 系统 SHALL 支持检查表在项目内复制和调整。

### FR-3 检查任务与安卓离线（阶段 3）

#### REQ-7 检查任务派发

作为项目负责人，我希望将检查任务派发给检查人员，以便明确检查范围和责任人。

1. [Event-driven] WHEN 项目负责人派发任务, THE 系统 SHALL 生成任务记录并发送 App 内通知给被派发人员。
2. [State-driven] WHILE 任务状态为"待接收", THE 系统 SHALL 在被派发人员待办列表中显示该任务。
3. [Event-driven] WHEN 检查人员接收任务, THE 系统 SHALL 将任务状态变更为"进行中"。

#### REQ-8 安卓端离线作业

作为检查人员，我希望在没有网络的情况下完成全部现场检查作业，以便在网络差的现场正常工作。

1. [Ubiquitous] THE 系统 SHALL 在 Android 端支持离线拍照、写描述、选责任单位、选位置、保存问题、提交日报。
2. [State-driven] WHILE 设备离线, THE 系统 SHALL 将所有操作数据先保存到本地存储。
3. [Event-driven] WHEN 网络恢复, THE 系统 SHALL 将本地数据异步同步到服务器，文本和照片分开同步。
4. [Unwanted-behavior] IF 同步失败, THEN THE 系统 SHALL 支持自动重试并保留本地数据不丢失。

#### REQ-9 现场问题取证与记录

作为检查人员，我希望在现场拍照取证并记录问题描述，以便形成完整的检查发现。

1. [Event-driven] WHEN 检查人员保存问题, THE 系统 SHALL 记录问题描述、照片、位置、责任单位、关联标准等信息。
2. [Ubiquitous] THE 系统 SHALL 支持安卓单设备 2-3 张照片并发上传，失败自动重试。
3. [Event-driven] WHEN 检查人员选择责任单位, THE 系统 SHALL 从项目关联的受检单位列表中选择。

### FR-4 日报提交与项目问题池（阶段 4）

#### REQ-10 日报提交

作为检查人员，我希望提交每日检查日报，以便汇总当日检查发现。

1. [Event-driven] WHEN 检查人员提交日报, THE 系统 SHALL 汇总当日问题并生成日报记录。
2. [State-driven] WHILE 日报处于"草稿"状态, THE 系统 SHALL 允许检查人员继续编辑修改。
3. [Event-driven] WHEN 检查人员提交日报, THE 系统 SHALL 将日报状态变更为"待确认"。
4. [Optional-feature] WHERE 设备离线, THE 系统 SHALL 先保存日报到本地，联网后自动同步提交。

#### REQ-11 项目问题池生成

作为项目负责人，我希望日报问题确认后沉淀到项目问题池，以便统一管理所有检查发现。

1. [Event-driven] WHEN 项目负责人确认日报问题, THE 系统 SHALL 将该问题写入项目问题池并记录 `confirmed_at`。
2. [State-driven] WHILE 问题在项目问题池中, THE 系统 SHALL 维护问题状态、等级、整改期限、责任单位等字段。
3. [Ubiquitous] THE 系统 SHALL 确保 `confirmed_at` 作为整改期限计算的起点时间戳。

### FR-5 日报确认与问题复核（阶段 5）

#### REQ-12 日报确认与退回

作为项目负责人，我希望确认或退回日报，以便控制问题进入项目问题池的质量。

1. [Event-driven] WHEN 项目负责人确认日报, THE 系统 SHALL 将日报状态变更为"已确认"并将问题写入问题池。
2. [Event-driven] WHEN 项目负责人退回日报, THE 系统 SHALL 将日报退回给检查人员并附带退回意见。
3. [Unwanted-behavior] IF 日报被退回, THEN THE 系统 SHALL 允许检查人员修改后重新提交。
4. [Ubiquitous] THE 系统 SHALL 确保日报问题确认后原日报记录被锁定，后续更正只能在项目问题池中操作。

#### REQ-13 问题等级与整改期限计算

作为项目负责人，我希望为确认的问题设定等级和整改期限，以便跟踪问题整改进度。

1. [Event-driven] WHEN 问题确认时, THE 系统 SHALL 根据等级自动计算整改期限：一般 → confirmed_at + 7 天；较大 → confirmed_at + 3 天；重大 → confirmed_at 当日 23:59:59。
2. [Ubiquitous] THE 系统 SHALL 确保 `rectification_deadline` 字段始终非空，类型 DateTime（精确到秒）。
3. [Optional-feature] WHERE 项目配置了 `major_issue_deadline_hours`, THE 系统 SHALL 按该值覆盖重大问题默认期限。

#### REQ-14 问题状态流转

作为项目负责人，我希望管理问题的整改状态流转，以便跟踪问题从发现到关闭的全生命周期。

1. [State-driven] WHILE 问题处于"待整改"状态, THE 系统 SHALL 显示整改期限倒计时。
2. [Event-driven] WHEN 问题完成整改, THE 系统 SHALL 将状态变更为"已整改"。
3. [Event-driven] WHEN 问题通过复核, THE 系统 SHALL 将状态变更为"已关闭"。
4. [Unwanted-behavior] IF 问题超期未整改, THEN THE 系统 SHALL 标记为"超期"。

### FR-6 报告生产与问题快照（阶段 6）

#### REQ-15 报告生成

作为项目负责人，我希望按时间范围生成检查报告，以便形成阶段性检查成果。

1. [Event-driven] WHEN 用户选择时间范围并生成报告, THE 系统 SHALL 汇总该范围内的问题并生成报告草稿。
2. [State-driven] WHILE 报告处于"草稿"状态, THE 系统 SHALL 允许编辑报告内容和选择纳入的问题清单。
3. [Event-driven] WHEN 报告生成完成, THE 系统 SHALL 记录报告基本信息和关联问题清单。

#### REQ-16 问题快照

作为系统，我希望在报告发布时对问题状态进行快照，以便固化报告时点的数据。

1. [Event-driven] WHEN 报告发布时, THE 系统 SHALL 对所有纳入报告的问题创建状态快照。
2. [Ubiquitous] THE 系统 SHALL 确保快照数据不可被后续修改。
3. [State-driven] WHILE 问题已被快照锁定, THE 系统 SHALL 禁止修改该问题在快照中的状态。

#### REQ-17 报告草稿预览与导出

作为项目负责人，我希望预览报告草稿并导出 Word 文件，以便审核报告内容。

1. [Event-driven] WHEN 用户预览报告, THE 系统 SHALL 渲染报告内容供在线查看。
2. [Event-driven] WHEN 用户导出报告草稿, THE 系统 SHALL 生成 Word 文件（100 问题/300 照片 ≤ 60s）。
3. [Unwanted-behavior] IF 导出失败, THEN THE 系统 SHALL 返回错误且不改变报告状态。

### FR-7 审批、发布、导出固化（阶段 7）

#### REQ-18 报告审批

作为审批人，我希望审批报告草稿，以便控制报告发布质量。

1. [Event-driven] WHEN 审批人通过报告, THE 系统 SHALL 将报告状态变更为"待发布"（P95 ≤ 1s）。
2. [Event-driven] WHEN 审批人退回报告, THE 系统 SHALL 将报告退回给编制人并附带审批意见。
3. [State-driven] WHILE 报告处于"审批中"状态, THE 系统 SHALL 不允许修改报告内容。

#### REQ-19 报告发布与固化导出

作为项目负责人，我希望发布报告使其内容固化不可修改，以便形成正式检查成果。

1. [Event-driven] WHEN 用户发布报告, THE 系统 SHALL 创建问题快照、锁定相关数据、变更报告状态为"已发布"。
2. [Ubiquitous] THE 系统 SHALL 确保已发布报告的内容不可再修改。
3. [Event-driven] WHEN 用户导出已发布报告, THE 系统 SHALL 生成固化 Word 文件（100 问题/300 照片 ≤ 120s）。
4. [Unwanted-behavior] IF 固化导出失败, THEN THE 系统 SHALL 返回错误且不改变报告状态。

#### REQ-20 通知机制

作为系统用户，我希望收到任务、日报、问题、报告相关的通知，以便及时处理待办事项。

1. [Ubiquitous] THE 系统 SHALL 仅通过 App 内通知（站内消息 + 待办列表红点）通知用户。
2. [Event-driven] WHEN 发生任务派发/日报退回/问题确认/报告审批等事件, THE 系统 SHALL 生成 App 内通知。
3. [State-driven] WHILE 用户离线, THE 系统 SHALL 在用户联网后批量推送未读通知。
4. [Ubiquitous] THE 系统 SHALL 不做外部推送、短信、邮件、企业微信/钉钉通知。

#### REQ-21 重大问题电话通知留痕

作为项目负责人，我希望对重大问题进行电话通知并留痕，以便记录通知行为。

1. [Event-driven] WHEN 重大问题确认时, THE 系统 SHALL 提醒项目负责人电话通知相关方。
2. [Event-driven] WHEN 项目负责人记录电话通知, THE 系统 SHALL 保存通知记录到 `MajorIssueNotificationRecord`。
3. [Ubiquitous] THE 系统 SHALL 仅在系统内留痕，不自动拨打或发送外部通知。

## 非功能性需求

### NFR-1 性能 — 列表查询
THE 系统 SHALL 保证普通列表查询 P95 ≤ 800ms。

### NFR-2 性能 — 详情页查询
THE 系统 SHALL 保证详情页查询 P95 ≤ 600ms。

### NFR-3 性能 — 日报提交
THE 系统 SHALL 保证日报文本提交 P95 ≤ 2s（照片异步上传）。

### NFR-4 性能 — 审批操作
THE 系统 SHALL 保证审批通过/退回操作 P95 ≤ 1s。

### NFR-5 性能 — 报告导出
THE 系统 SHALL 保证报告草稿导出（100 问题/300 照片）≤ 60s，发布固化导出 ≤ 120s。

### NFR-6 并发能力
THE 系统 SHALL 支持 10-20 用户同时在线操作，安卓单设备支持 2-3 张照片并发上传。

### NFR-7 可用性
THE 系统 SHALL 达到 99.9%+ 可用性（商业服务标准），运行期间不频繁故障。

### NFR-8 数据容量
THE 系统 SHALL 支持单项目 500 任务 / 3000 问题 / 10000 照片 / 200 报告的数据量基线。

### NFR-9 离线能力
THE 系统 SHALL 在 Android 端支持完整离线作业（拍照、描述、选单位、保存问题、提交日报），文本和照片分开同步，失败可重试。

### NFR-10 安全基线
THE 系统 SHALL 实现 HTTPS 传输加密、密码哈希存储、项目级 RBAC、文件鉴权访问、越权访问留痕。

### NFR-11 同步可靠性
THE 系统 SHALL 在同步失败时支持自动重试并保留本地数据，确保用户操作不丢失。

## 业务规则

### BR-1 整改期限规则（P0 共识，覆盖文档 §17.2 / §101.10）
整改期限按问题等级计算，以 `confirmed_at` 为起点：一般 +7 天，较大 +3 天，重大当日 23:59:59。重大问题可通过项目配置 `major_issue_deadline_hours` 覆盖为 N 小时。`rectification_deadline` 始终非空。

### BR-2 通知机制（P0 共识，覆盖文档通知章节缺失）
仅 App 内通知（站内消息 + 待办红点）。不做外部推送/短信/邮件/企业微信/钉钉。离线时通知随同步批量拉取。重大问题电话通知仅系统内留痕。

### BR-3 确认即锁定
日报问题确认写入项目问题池后，原日报问题记录即被锁定不可修改。后续更正只能在项目问题池中操作。

### BR-4 报告发布即固化
报告发布时创建问题快照，快照后问题和报告内容均不可修改。固化导出失败不改变报告状态。

### BR-5 日报状态机
草稿 → 待确认 → 已确认 / 已退回 →（退回后可修改重新提交）→ 待确认

### BR-6 问题状态机
待整改 → 已整改 → 已关闭 / 超期

### BR-7 任务状态机
待派发 → 待接收 → 进行中 → 已完成

### BR-8 报告状态机
草稿 → 审批中 → 待发布 → 已发布 / 已退回 →（退回后可修改重新提交）→ 审批中

### BR-9 MVP 范围（P0 共识）
维持文档 §105.1 阶段 1-7，不收敛。报告变更、统计看板、标准推荐优化进入 V1.1（阶段 8-9）。

### BR-10 双端职责划分
Web 端：任务派发、日报确认、问题池、报告生产、审批发布、配置管理、管理统计。Android 端：现场检查、问题取证、问题保存、提交日报、退回修改。

## 配置点清单

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `major_issue_deadline_hours` | 当日 23:59:59 | 重大问题整改期限，可覆盖为 N 小时 |
