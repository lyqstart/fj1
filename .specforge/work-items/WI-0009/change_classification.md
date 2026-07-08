# Change Classification — WI-0009

## 基本信息

- **Work Item:** WI-0009
- **变更类型:** bugfix_spec（缺陷修复）
- **风险等级:** 极低（单文件删除 2 行配置声明）
- **workflow_type:** bugfix_spec
- **workflow_path:** requirement_change_path

## 变更分类

### 类型：bugfix_spec（配置缺陷修复）

本次变更是修复 Spring Boot 配置缺陷：`application-prod.yml` 第 7-8 行含非法的 `spring.profiles.active: prod` 声明，导致 jar 启动失败。

### 性质

| 阶段 | 操作 | 破坏性 | 影响范围 |
|------|------|--------|---------|
| 修改 application-prod.yml | 删除第 7-8 行 | 无（源码修改） | 本地源码 |
| 重新构建 jar | mvn package | 无（target/ 构建产物） | 本地 |
| 部署 | 回到 WI-0008 | 由 WI-0008 控制 | svr-lg |

## 风险评估

### 极低风险

- **单文件 2 行删除**：仅删除 `profiles: active: prod` 声明，保留 `spring:` 键
- **无功能影响**：profile 激活机制由 `application.yml` 的 `SPRING_PROFILES_ACTIVE` 环境变量承担
- **零数据影响**：不涉及数据库
- **可秒回滚**：git checkout 即可恢复

## 回滚方案

- 修改后发现问题 → `git checkout fj-backend/fj-api/src/main/resources/application-prod.yml`
- 回滚成本：极低（单文件 git 恢复）

## 范围边界

### 包含
- 修改 `fj-backend/fj-api/src/main/resources/application-prod.yml`（删除第 7-8 行）

### 不包含
- 部署操作（由 WI-0008 继续）
- 数据库变更（V9 迁移由 WI-0008 部署时 Flyway 自动执行）
- 其他配置文件修改
- nginx / .env / 外部 application-prod.yml 修改
