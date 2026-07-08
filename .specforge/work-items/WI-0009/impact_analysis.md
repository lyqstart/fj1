# Impact Analysis — WI-0009

## 影响摘要

修复 `application-prod.yml` 的非法 `spring.profiles.active` 声明，解除 WI-0008 部署阻塞。

## 受影响文件

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `fj-backend/fj-api/src/main/resources/application-prod.yml` | 修改（删除 2 行） | 移除第 7-8 行 profiles/active 声明 |

## 受影响模块

| 模块 | 影响 | 说明 |
|------|------|------|
| fj-api | 配置修复 | application-prod.yml 是 fj-api 的生产配置 |

## 不受影响

- fj-sync, fj-common, fj-recommend 等其他模块：无变更
- application.yml（主配置）：不变
- 数据库：本次不涉及
- svr-lg 生产环境：本次不部署（部署由 WI-0008 继续）

## 关联 Work Item

| WI | 关系 | 说明 |
|----|------|------|
| WI-0008 | 阻塞解除 | 本修复完成后，WI-0008 可重新构建 jar 并部署 |
| WI-0002 | 缺陷溯源 | 非法声明自 WI-0002 脚手架（commit b8bebaa）即存在 |

## 部署影响

本次修复**不直接部署到生产**。修复源码后，回到 WI-0008 重新执行：
1. TASK-2 重新构建 jar（含修复后的 application-prod.yml）
2. TASK-3 验证 jar 内容
3. TASK-4~7 传输、替换、重启、验证

## profile 激活路径（删除后的正确机制）

`application-prod.yml` 不需要声明 `spring.profiles.active`，因为：
1. 启动时通过 `SPRING_PROFILES_ACTIVE=prod` 环境变量激活 prod profile
2. Spring Boot 自动加载 `application-prod.yml` 作为 prod profile 的配置
3. `application.yml` 第 12-13 行有 `spring.profiles.active: ${SPRING_PROFILES_ACTIVE:dev}` 作为默认 fallback
