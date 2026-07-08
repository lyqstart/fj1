# Intake — WI-0009 (修复 application-prod.yml 非法 spring.profiles.active 声明)

## 缺陷描述

新构建的 fj-api jar（WI-0008 TASK-2 产物）在 svr-lg 上启动失败，Spring Boot 抛出 `InvalidConfigDataPropertyException`，应用在环境准备阶段（`ConfigDataEnvironmentPostProcessor`）即崩溃，远早于 Flyway 初始化。

## 当前行为（Bug）

新 jar 启动失败，错误日志：
```
ERROR org.springframework.boot.SpringApplication -- Application run failed
org.springframework.boot.context.config.InvalidConfigDataPropertyException:
  Property 'spring.profiles.active' imported from location
  'class path resource [application-prod.yml]' is invalid in a profile specific resource
  [origin: class path resource [application-prod.yml] from fj-api-1.0.0.jar - 8:13]
```

- 错误位置：jar 内 `BOOT-INF/classes/application-prod.yml` 第 8 行第 13 列
- 对应源码：`fj-backend/fj-api/src/main/resources/application-prod.yml:7-8`
- 实际内容：
  ```yaml
  spring:
    profiles:
      active: prod    # ← 非法声明
  ```

## 预期行为（修复后）

- jar 正常启动，无 `InvalidConfigDataPropertyException`
- Spring Boot 正确加载 `application-prod.yml` 作为 prod profile 配置
- Flyway 正常初始化并执行 V9 迁移

## 根因分析

Spring Boot 规定：**profile-specific 资源**（文件名含 `-<profile>` 后缀，如 `application-prod.yml`）**不能再次声明 `spring.profiles.active`**，因为该文件本身就是通过 profile 激活机制被加载的，再次声明会造成循环引用/歧义。

`application-prod.yml` 文件名中的 `-prod` 已经声明了它属于 prod profile，第 7-8 行的 `spring.profiles.active: prod` 是多余的非法声明。

旧 jar（07-02 版本）能正常运行，说明此缺陷是在某次源码修改中引入的（可能误将 `application.yml` 的 profile 声明复制进 `application-prod.yml`）。

## 修复方案

移除 `fj-backend/fj-api/src/main/resources/application-prod.yml` 第 7-8 行的 `spring.profiles.active` 声明（保留第 6 行 `spring:` 键，其下的 `datasource` 等配置不变）。

修复后第 6-9 行应为：
```yaml
spring:
  datasource:
    url: jdbc:postgresql://127.0.0.1:5432/fj_inspect
```

## 环境信息

- 源码路径：`/mnt/1t_back/project/fj1/fj-backend/fj-api/src/main/resources/application-prod.yml`
- 构建根目录：`/mnt/1t_back/project/fj1/fj-backend`（Maven 多模块）
- JAVA_HOME：`/usr/lib/jvm/java-17-openjdk`
- Maven：3.5.4（已安装，WI-0008 TASK-1）
- Spring Boot 版本：见 fj-api/pom.xml

## 不变行为

- `application-prod.yml` 中的其他所有配置不变（server.port、datasource、flyway、hikari 等）
- `application.yml`（主配置）不变
- 生产环境 `.env`、外部 `application-prod.yml`（svr-lg 上的）不变
- nginx 配置不变
- 数据库不变（本次只修源码，不部署；部署由 WI-0008 继续）

## 验收标准

- AC-1: `application-prod.yml` 不再含 `spring.profiles.active` 声明
- AC-2: `application-prod.yml` 的 YAML 结构有效（`spring:` 下直接是 `datasource` 等键，缩进正确）
- AC-3: 重新构建的 jar 内 `application-prod.yml` 不含 `spring.profiles.active`
- AC-4: 本地用修复后的配置可正常初始化 Spring Boot 上下文（无 InvalidConfigDataPropertyException）

## 关联 Work Item

- WI-0008（ops_task）：本缺陷阻塞了 WI-0008 的 TASK-6（服务重启）。WI-0009 修复源码后，WI-0008 可用修复后的源码重新执行 TASK-2 构建 → TASK-3 验证 → 部署。
- WI-0007：application-prod.yml 的非法声明可能在 WI-0007 的某次修改中引入（需确认）。

## 修复范围边界

- WI-0009 **只修复源码**（application-prod.yml），并在本地验证修复正确
- **重新构建 jar + 部署**回到 WI-0008 继续执行（不在 WI-0009 范围内）
