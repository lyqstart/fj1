# Change Request: 飞检现场管理系统产品化

**Work Item**: WI-0002
**基于**: WI-0001（已 closed，交付了 286 文件的编译通过骨架）
**创建时间**: 2026-07-01
**目标**: 将 WI-0001 产出的"能编译的骨架"变成"能在服务器上实际运行、全流程端到端可用"的产品

---

## 1. 变更背景

WI-0001 按 feature_spec 工作流完成了飞检现场管理系统的规格设计和代码实现，交付了 286 个文件（后端 188 Java / 前端 36 TS / 安卓 25 TS），通过了编译级验证（L4/L5）和 Close Gate（30 项检查全部 PASS）。

但 WI-0001 的验证仅停留在编译层面，代码从未真正运行过。存在以下问题：
- Spring Boot 从未启动过
- 数据库迁移从未执行过
- 任何一个 API 端点从未被调用过
- 前端从未用真实后端跑过
- 安卓端从未在设备上运行过
- 0 个单元测试，0 个集成测试
- 11 个已知功能 gap（executor 自报 TODO）

## 2. 用户确认的约束

1. **PostgreSQL 13 没有需要保留的数据**，可以直接全新安装 PG16
2. **目标是全流程端到端可用**（从派任务到出报告）
3. **一次性做到位**（不分阶段交付）
4. **走正式 Change Request 流程**

## 3. 已知 Gap 清单（11 项）

### 安全问题
| # | Gap | 来源 TASK | 影响 |
|---|-----|-----------|------|
| G1 | UserController 返回含 password_hash 字段 | TASK-006 | 安全漏洞，密码哈希泄露 |
| G2 | OperationLogAspect 未对接 @RequirePermission，越权留痕实际未记录 | TASK-044 | 审计合规缺失 |

### 核心业务逻辑空实现
| # | Gap | 来源 TASK | 影响 |
|---|-----|-----------|------|
| G3 | DD-9 联动检查 isReferencedByPublishedReport() 直接返回 false | TASK-032 | "被已发布报告引用的作废问题→后续更正"这条核心规则实际没生效 |
| G4 | photo_reference_snapshot 永远是 null | TASK-037 | 报告快照中照片引用缺失 |
| G5 | RectificationDeadlineCalculator 的 CRITICAL hours 覆盖语义未确认 | TASK-027 | hours 从 confirmedAt 起算还是当日 00:00 起算？ |

### 运行时配置缺失
| # | Gap | 来源 TASK | 影响 |
|---|-----|-----------|------|
| G6 | 无 @EnableJpaRepositories | TASK-044 | fj-common 下 Repository bean 运行时可能不激活 |
| G7 | BaseEntity 有两份（fj-common + fj-system） | TASK-044 | JPA 映射冲突风险 |
| G8 | ProjectAccessFilter 参数名 camelCase vs snake_case 未对齐 | TASK-008 | 前后端字段名不匹配 |

### 安卓端原生模块缺失
| # | Gap | 来源 TASK | 影响 |
|---|-----|-----------|------|
| G9 | SQLCipher 安卓加密未集成（native 模块未实现） | TASK-019 | 本地数据未加密 |
| G10 | 相机/图片压缩原生模块未实现（只有注入端口接口） | TASK-028 | 无法实际拍照 |
| G11 | poi-tl Word 模板未创建（用 fallback 降级） | TASK-041 | 报告导出格式非最终版 |

## 4. 产品化工作范围

### 工作流 A：服务器环境准备与部署
- 执行 PG13→16 升级（全新安装，无数据保留）
- Java JDK 配置为系统默认
- Maven 部署确认
- Nginx 反向代理配置
- systemd service 文件创建
- 生产环境密钥配置（JWT secret、DB 密码替换占位符）

### 工作流 B：后端运行时修复与启动
- 修复 G6：补充 @EnableJpaRepositories
- 修复 G7：统一 BaseEntity 到 fj-common
- 修复 G8：前后端字段名对齐
- 第一次 `mvn spring-boot:run` 启动，逐一修复运行时错误
- 执行 Flyway 迁移（V1~V7）
- 验证种子数据导入
- 逐一验证 API 端点可访问

### 工作流 C：已知 Gap 修复
- 修复 G1：UserController 增加 DTO 脱敏
- 修复 G2：OperationLogAspect 对接 @RequirePermission
- 修复 G3：DD-9 联动检查实现（ReportIssueSnapshotRepository 查询）
- 修复 G4：photo_reference_snapshot 填充逻辑
- 裁决 G5：与用户确认 hours 语义并实现
- 修复 G11：创建真实 poi-tl Word 模板

### 工作流 D：安卓端可运行化
- 修复 G9：SQLCipher native 集成或确认降级可接受
- 修复 G10：相机/图片压缩原生模块实现
- Android Debug Build 成功
- 真机/模拟器安装运行

### 工作流 E：端到端联调与测试
- 端到端流程验证：
  1. Web 登录 → 建项目 → 建检查表 → 派检查任务
  2. 安卓端登录 → 接收任务 → 现场检查 → 拍照取证 → 创建问题 → 提交日报
  3. Web 日报确认 → 问题入池 → 组长复核
  4. 报告生成 → 快照编辑 → 审批 → 发布固化 → 导出 Word
- 核心 Service 单元测试（RectificationDeadlineCalculator、IssueStatusService、OperationLogService）
- 关键 API 集成测试

## 5. 验收标准

- 后端 `mvn spring-boot:run` 成功启动，监听 8080 端口
- 所有 Flyway 迁移成功执行，数据库表结构完整
- 种子数据正确导入（4 角色、20 权限、admin 账号）
- Web 前端 `npm run dev` 可访问，登录功能正常
- 安卓端 Debug Build 可安装运行
- 全流程端到端演示通过
- 11 个已知 Gap 全部修复
- 核心业务 Service 有单元测试覆盖

## 6. 技术栈（不变）

沿用 WI-0001 确定的技术栈：
- Java 17 + Spring Boot 3.2 + Maven
- PostgreSQL 16（全新安装）
- React 18 + TypeScript + Vite
- React Native 0.74 + TypeScript + WatermelonDB
- Nginx + systemd
- 服务器: svr-lg (ssh lg, CentOS Stream 9, 4 vCPU, 3.6GB RAM)