---
doc_type: bugfix
schema_version: "1.0"
work_item_id: WI-0009
workflow_type: bugfix_spec
---

# Bugfix — WI-0009

**缺陷标题**：`application-prod.yml` 在 profile-specific 资源中非法声明 `spring.profiles.active`，导致 fj-api jar 启动失败

**受影响组件**：`fj-backend/fj-api`（飞检现场管理系统后端 API）

**缺陷来源**：WI-0008 部署阶段暴露（首次以 prod profile 构建部署）

---

## 简介

本文档为 WI-0009 的缺陷分析报告，采用系统化调试方法论（复现 → 收集证据 → 形成假设 → 验证假设 → 确认根因）记录从症状到根因的完整推理链。

缺陷表现：WI-0008 构建出的新 fj-api jar 在 svr-lg 上启动失败，Spring Boot 在环境准备阶段（`ConfigDataEnvironmentPostProcessor`）抛出 `InvalidConfigDataPropertyException`，应用进程在远早于 Flyway 初始化的位置崩溃。

---

## 术语表

| 术语 | 定义 |
|------|------|
| profile | Spring Boot 配置 profile，通过文件名后缀 `-<profile>` 或 `spring.profiles.active` 属性激活的一组配置 |
| profile-specific resource | 文件名含 `-<profile>` 后缀的配置文件（如 `application-prod.yml`），由 Spring Boot 在对应 profile 激活时自动加载 |
| `spring.profiles.active` | 用于声明当前激活 profile 的 Spring 属性 |
| `InvalidConfigDataPropertyException` | Spring Boot 在加载配置数据时发现非法属性抛出的异常 |
| `ConfigDataEnvironmentPostProcessor` | Spring Boot 在启动早期处理配置数据的环境后处理器 |
| Flyway | 本项目使用的数据库迁移工具 |
| svr-lg | 生产服务器主机名 |

---

## 当前行为（缺陷）

新构建的 fj-api jar（`fj-api-1.0.0-SNAPSHOT.jar`，WI-0008 TASK-2 产物）启动即失败，错误日志：

```
ERROR org.springframework.boot.SpringApplication -- Application run failed
org.springframework.boot.context.config.InvalidConfigDataPropertyException:
  Property 'spring.profiles.active' imported from location
  'class path resource [application-prod.yml]' is invalid in a profile specific resource
  [origin: class path resource [application-prod.yml] from fj-api-1.0.0.jar - 8:13]
```

**错误定位**：
- 错误位置：jar 内 `BOOT-INF/classes/application-prod.yml` 第 8 行第 13 列
- 对应源码：`fj-backend/fj-api/src/main/resources/application-prod.yml:7-8`
- 实际内容（`application-prod.yml` 第 6-9 行）：
  ```yaml
  spring:
    profiles:
      active: prod    # ← 非法：profile-specific 资源内禁止再次声明
    datasource:
  ```

**影响**：
- 应用无法启动，进程崩溃在环境准备阶段，远早于 Flyway 初始化（V9 迁移未执行）
- 阻塞 WI-0008 的 TASK-6（服务重启）及整个部署流程
- 生产环境无法提供服务

---

## 预期行为（修复后）

- jar 正常启动，无 `InvalidConfigDataPropertyException`
- Spring Boot 正确加载 `application-prod.yml` 作为 prod profile 配置（通过外部 `SPRING_PROFILES_ACTIVE=prod` 或主配置 `application.yml:13` 的 `${SPRING_PROFILES_ACTIVE:dev}` 激活）
- Flyway 正常初始化并执行 V9 迁移
- 应用监听 `server.port: 8080`，`context-path: /api`

---

## 不变行为

本次修复**不得影响**以下现有行为，修复方案必须保持其语义不变：

1. **`application-prod.yml` 其余全部配置不变**：`server.port`、`server.servlet.context-path`、`spring.datasource.*`（含 HikariCP 池参数）、`spring.flyway.*`、`spring.jpa.*`、`spring.jackson.*`、`spring.servlet.multipart.*`、`fj.security.*`、`fj.cache.*`、`fj.export.*`、`logging.*`、`management.*`
2. **`application.yml`（主配置）不变**：第 12-13 行的 `spring.profiles.active: ${SPRING_PROFILES_ACTIVE:dev}` 保留——这是合法且必要的 profile 激活入口
3. **YAML 缩进结构不变**：移除第 7-8 行后，`spring:` 键下直接接 `datasource:`（当前第 9 行），缩进层级（2 空格）保持正确
4. **环境变量注入机制不变**：`${DB_USER}`、`${DB_PASSWORD}`、`${JWT_SECRET}`、`${CORS_ALLOWED_ORIGINS}` 等占位符语义不变
5. **生产环境外部配置不变**：svr-lg 上的 `.env`、外部 `application-prod.yml`（如存在）、nginx 配置不变
6. **数据库不变**：本次仅修复源码配置，不涉及数据迁移或 schema 变更
7. **部署流程不变**：重新构建 jar + 部署回到 WI-0008 执行，不在 WI-0009 范围内

---

## 根因分析（系统化调试）

### 1. 复现问题

**复现路径**：WI-0008 TASK-2 在 fj-backend 根目录执行 `mvn package -DskipTests` 产出 jar，传输到 svr-lg 后以 `SPRING_PROFILES_ACTIVE=prod java -jar fj-api-1.0.0-SNAPSHOT.jar` 启动，进程立即崩溃并打印上述堆栈。

**复现确定性**：100% 可复现（配置加载是启动早期确定性流程，非偶发竞态）。

### 2. 收集证据

| 证据 | 来源 | 内容 |
|------|------|------|
| E1 异常类型 | WI-0008 启动日志 | `InvalidConfigDataPropertyException`，明确指向 `spring.profiles.active` 属性 |
| E2 错误位置 | 异常 origin | `application-prod.yml - 8:13`（第 8 行第 13 列，即 `active: prod` 的值位置） |
| E3 错误描述 | 异常消息 | "is invalid in a profile specific resource"——直接定性为 profile-specific 资源内的非法属性 |
| E4 源码内容 | `application-prod.yml:6-9` | `spring:` → `profiles:` → `active: prod` → `datasource:` |
| E5 主配置 | `application.yml:9-13` | 已含 `spring.profiles.active: ${SPRING_PROFILES_ACTIVE:dev}`（合法的 profile 激活入口） |
| E6 Spring Boot 版本 | `fj-backend/pom.xml:40` | `<spring-boot.version>3.2.5</spring-boot.version>` |
| E7 git blame | `b8bebaa5` | 第 6-9 行全部在 commit `b8bebaa`（WI-0002 脚手架，2026-07-02 14:56:15，作者 lyqstart）一次性引入，文件此后**零修改** |
| E8 文件提交史 | `git log application-prod.yml` | 仅一次提交 `b8bebaa`（"feat: complete WI-0002 implementation"） |
| E9 项目 profile 文件清单 | glob 扫描 | `fj-api/src/main/resources/` 下仅 `application.yml` 与 `application-prod.yml`，无其他 profile 文件 |

### 3. 形成假设

**假设 H1（主假设）**：`application-prod.yml` 作为 profile-specific 资源（文件名含 `-prod`），其内部第 7-8 行的 `spring.profiles.active: prod` 违反 Spring Boot 规则，导致 `ConfigDataEnvironmentPostProcessor` 在解析阶段拒绝加载并抛 `InvalidConfigDataPropertyException`。
- 支持证据：E1、E2、E3、E4

**假设 H2（次假设，待排除）**：YAML 缩进/格式错误导致解析失败。
- 排除理由：异常类型为 `InvalidConfigDataPropertyException`（属性非法），而非 `YAMLException`/`MarkedYAMLException`（格式错误）；异常消息明确点名具体属性名 `spring.profiles.active`，说明 YAML 已成功解析到属性级别，问题在属性语义而非语法。**排除 H2**。

**假设 H3（次假设，待排除）**：Spring Boot 版本过旧不支持该写法。
- 排除理由：E6 显示版本为 3.2.5，恰是**严格执行** profile-specific 规则的版本（规则自 Spring Boot 2.4 引入 ConfigData 机制后生效）。该写法在任何 2.4+ 版本都非法。**排除 H3**。

### 4. 验证假设

**验证 H1 的 Spring Boot 规则依据**：
- Spring Boot ConfigData 机制（2.4+）规定：profile-specific 资源（文件名匹配 `application-<profile>.yml` 模式）**只能由 profile 激活机制加载**，其内部再次声明 `spring.profiles.active` 会构成循环引用/歧义，因此被判定为非法属性。
- 该文件通过 `application.yml:13` 的 `${SPRING_PROFILES_ACTIVE:dev}`（设为 `prod` 时）或启动参数 `-Dspring.profiles.active=prod` 被加载——文件名中的 `-prod` 已经声明了它的 profile 归属，第 7-8 行的 `active: prod` 是**语义上多余且语法上非法**的声明。

**验证修复后结构有效性**：
- 移除第 7-8 行（`profiles:` 与 `active: prod`）后，第 6 行 `spring:` 键下直接接原第 9 行 `datasource:`（缩进 2 空格，仍为 `spring` 的子键），YAML 结构完整有效，其余所有键的归属不变。

### 5. 确认根因

**根因（Confirmed Root Cause）**：
`fj-backend/fj-api/src/main/resources/application-prod.yml` 第 7-8 行在 profile-specific 资源内声明了 `spring.profiles.active: prod`，违反 Spring Boot 3.2.5 的 ConfigData 规则（profile-specific 资源禁止声明 `spring.profiles.active`），导致应用在启动早期配置加载阶段崩溃。

**根因解释全部症状**：✅
- 解释了为何是 `InvalidConfigDataPropertyException`（属性非法）
- 解释了为何 origin 指向 `application-prod.yml:8:13`（正是非法属性的值位置）
- 解释了为何崩溃在 Flyway 之前（配置加载远早于数据库初始化）

### 6. 关于"为什么旧 jar 能运行而新 jar 不行"（修正 intake.md 假设）

> ⚠️ intake.md 第 39 行假设："旧 jar（07-02 版本）能正常运行，说明此缺陷是在某次源码修改中引入的"。
> 经 git 证据核实，**此假设不成立**，需修正如下：

**git 证据（E7、E8）表明**：
- `application-prod.yml` 在仓库中**仅有一次提交**（`b8bebaa`，WI-0002 脚手架阶段，2026-07-02 14:56:15），非法声明从该文件被创建时起就存在，此后从未被任何后续 Work Item 修改。
- 因此"缺陷在某次后续修改中引入"的前提不成立——**该缺陷是 WI-0002 脚手架初始缺陷**（很可能是从某个模板/示例配置直接复制过来时夹带的常见错误）。

**对"旧 jar 能运行"最合理的解释**：
- 该非法声明对任何以 **dev profile** 运行的进程无害（`application-prod.yml` 仅在 prod profile 激活时才被加载，dev 运行不会触碰它）。
- 此前所有本地开发与测试均以 `dev` profile 运行（`application.yml:13` 默认值），从未触发 `application-prod.yml` 的加载，故缺陷长期潜伏。
- **WI-0008 是项目首个真正以 prod profile 构建并部署的 Work Item**，首次激活 `application-prod.yml`，故首次暴露该潜伏缺陷。
- 结论：所谓"旧 jar 能运行"实为"旧 jar 从未以 prod profile 运行过"，而非"缺陷是新引入的"。

**此修正对修复方案无影响**：无论缺陷何时引入，移除非法声明都是正确修复。

---

## 修复方案

**最小变更**：删除 `fj-backend/fj-api/src/main/resources/application-prod.yml` 的第 7-8 行（`profiles:` 与 `active: prod` 两行），保留第 6 行 `spring:` 键，使其下直接接 `datasource:`。

**修复前（第 6-9 行）**：
```yaml
spring:
  profiles:
    active: prod
  datasource:
```

**修复后（第 6-8 行）**：
```yaml
spring:
  datasource:
```

**技术依据**：
1. profile 激活入口已由 `application.yml:13` 的 `${SPRING_PROFILES_ACTIVE:dev}` 提供，外部设为 `prod` 时即激活 `application-prod.yml`，无需文件内自声明。
2. profile-specific 资源内禁止声明 `spring.profiles.active`（Spring Boot 2.4+ ConfigData 规则）。
3. 移除后 YAML 结构有效，其余配置语义完全不变（见"不变行为"章节）。

**变更范围**：单文件、2 行删除，零新增依赖、零配置项新增、零环境变量变化。

---

## 验收标准

| AC | 描述 | 验证方式 |
|----|------|----------|
| AC-1 | `application-prod.yml` 不再含 `spring.profiles.active` 及 `profiles:` 声明 | grep 静态检查源文件 |
| AC-2 | `application-prod.yml` 的 YAML 结构有效：`spring:` 键下直接为 `datasource:`，缩进正确 | 重新读取文件确认结构 |
| AC-3 | 重新构建的 jar 内 `BOOT-INF/classes/application-prod.yml` 不含 `spring.profiles.active` | 解包 jar 或 `mvn package` 后检查 target/classes 副本 |
| AC-4 | 用修复后的配置 + `SPRING_PROFILES_ACTIVE=prod` 可正常初始化 Spring Boot 上下文（无 `InvalidConfigDataPropertyException`） | 本地启动验证（由 WI-0008 部署阶段最终确认） |

---

## 影响范围与关联 Work Item

- **WI-0008**（ops_task）：本缺陷阻塞其 TASK-6（服务重启）。WI-0009 修复源码后，WI-0008 用修复后的源码重新执行 TASK-2（构建）→ TASK-3（验证）→ 部署。
- **WI-0002**（feature_spec，脚手架）：缺陷引入源头，仅作根因溯源参考，不在 WI-0009 范围内追溯处理。
- **修复范围边界**：WI-0009 **仅修复源码**（`application-prod.yml`）并在本地验证配置正确性；**重新构建 jar + 部署** 回到 WI-0008 执行，不在 WI-0009 范围内。

---

## 配置点清单

本缺陷修复**无新增可配置项**。修复为纯删除操作，不引入任何 `<configurable>` 标记。
