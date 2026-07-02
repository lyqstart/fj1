# Impact Analysis — WI-0002

基于 2026-07-01 实际环境探测的事实，非理论推断。

---

## 1. 环境事实清单（实测）

### 1.1 本地开发机（/mnt/1t_back/project/fj1）

| 工具 | 状态 | 路径 | 备注 |
|------|------|------|------|
| JDK 17 | ✅ 可用 | `/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64` | 实测 `java -version` OK |
| Maven 3.9.6 | ⚠️ 需配 JAVA_HOME | `/opt/module/apache-maven-3.9.6/bin/mvn` | **默认绑定 JDK8**，每次必须显式 `JAVA_HOME=...JDK17...` |
| Node v22.22.3 | ✅ 可用 | `/usr/local/node`（符号链接） + nvm | WI-0001 进度记录中的 v22.12.0 路径已失效，实际可用的是 v22.22.3 |
| bun 1.3.14 | ✅ 可用 | `/root/.bun/bin/bun` | 可作为 node 备选 |
| Maven Wrapper | ❌ 不完整 | `fj-backend/.mvn/wrapper` 存在但无 `mvnw` 脚本 | 不能用 `./mvnw` |
| 后端编译 | ✅ 通过 | 实测 `mvn -pl fj-api -am compile` 2.3s SUCCESS | 配置正确 JAVA_HOME 后 |
| Web dist | ✅ 存在 | `fj-web/dist/{assets,index.html}` | vite 之前构建过 |
| Android deps | ✅ 已装 | `fj-android/node_modules/` 有内容 | 依赖已安装 |

### 1.2 远程服务器 svr-lg（ssh lg）

| 项目 | 状态 | 备注 |
|------|------|------|
| OS | CentOS Stream 9 | kernel 4.18 |
| CPU/RAM/Disk | 4 vCPU / 3.6GB RAM / 23GB 可用 | RAM 紧张 |
| Java | ❌ **未安装** | `java: command not found` |
| Maven | ❌ **未安装** | `/opt/module/apache-maven-3.9.6` 不存在 |
| PostgreSQL | 13.23 运行中 | systemd 管理，postgres 用户密码认证 |
| PostgreSQL 数据 | 存在但用户确认可丢弃 | 全新安装 PG16 无保留问题 |
| sudo 权限 | ❌ **被编排工具阻断** | sf_safe_bash 拒绝 sudo；ops 必须由用户手动执行脚本 |
| ssh 访问 | ✅ root 直连 | `ssh lg` |

---

## 2. 关键约束与阻塞点

### 2.1 【高】sudo 受限 — 运维操作必须手动
sf_safe_bash 的 bash-guard 拒绝所有 `sudo` 调用。这意味着以下操作 **不能由 Agent 自动执行**：

- 停止/卸载 PostgreSQL 13
- `dnf install postgresql16-server java-17-openjdk`
- 初始化 PG16 数据目录
- 安装 systemd service 文件
- 配置 Nginx（如需 root）

**缓解策略**：所有 sudo 级操作打包为幂等脚本（`scripts/ops/*.sh`），由用户在服务器上手动执行。Agent 负责：编写脚本、本地构建产物（jar）、scp 到服务器、提供执行指令。

### 2.2 【高】服务器无 Java — 部署策略调整
原 WI-0001 假设可在服务器构建。实际服务器无 Maven 也无 JDK。

**部署策略**：
1. 本地 `mvn package -DskipTests` 生成 fat jar
2. 服务器只安装 JRE17（`java-17-openjdk-headless`，体积小）
3. scp jar + application-prod.yml + systemd unit 到服务器
4. systemd 启动

### 2.3 【中】Maven 默认 JDK8
每次 Maven 命令必须前置 `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-17.0.19.0.10-1.el8.x86_64`。

**缓解**：所有自动化脚本统一设置；为开发便利可在 shell rc 中 export，但不依赖此。

### 2.4 【中】PostgreSQL postgres 用户有密码
探测时 `psql -U postgres` 要求密码，且 `postgres`/`postgres` 失败。

**需用户提供**：当前 postgres 用户的密码（用于 PG13→16 迁移脚本），或确认直接用 root+systemd 流程绕过。

---

## 3. 影响的组件清单

### 3.1 后端代码影响（~25-35 文件）

| 模块 | 影响 | Gap 关联 |
|------|------|----------|
| fj-common | 统一 BaseEntity，补 @EnableJpaRepositories 注解 | G6, G7 |
| fj-system | 删除重复 BaseEntity；UserController DTO 脱敏；OperationLogAspect 对接权限注解 | G1, G2, G7 |
| fj-project | ProjectAccessFilter 参数名对齐 | G8 |
| fj-issue | RectificationDeadlineCalculator 语义确认；IssueStatusService DD-9 实现 | G3, G5 |
| fj-report | ReportIssueSnapshot 填充 photo_reference_snapshot；poi-tl 模板创建 | G4, G11 |
| fj-export | PoiTlExportEngine 使用真实模板 | G11 |
| fj-android 相关 native | SQLCipher、相机模块决策与实现 | G9, G10 |

### 3.2 数据库影响
- PG13 → PG16 全新安装
- Flyway V1~V7 在 PG16 上首次执行
- 种子数据（V2）首次导入
- 风险：PG13→16 可能有 SQL 兼容性差异（多数向后兼容，需关注 `gen_random_uuid()` 等）

### 3.3 基础设施影响（新增）
- `deploy/systemd/fj-api.service` — systemd 单元
- `deploy/nginx/fj.conf` — Nginx 反向代理
- `deploy/config/application-prod.yml` — 生产配置（真实密钥占位）
- `scripts/ops/install_pg16.sh` — PG13→16 升级脚本（用户手动执行）
- `scripts/ops/install_jre17.sh` — JRE17 安装脚本
- `scripts/ops/deploy_backend.sh` — 后端部署脚本

### 3.4 测试影响（从 0 引入）
- 核心业务 Service 单元测试（RectificationDeadlineCalculator, IssueStatusService, OperationLogService）
- 关键 API 集成测试（@SpringBootTest）
- 不追求高覆盖率，优先覆盖 11 个 Gap 涉及的逻辑

### 3.5 Android 影响
- SQLCipher 集成或确认降级（需用户决策）
- 相机/图片压缩原生模块实现
- Debug Build 验证
- 真机/模拟器运行验证

---

## 4. 需用户决策的事项

| # | 决策点 | 选项 | 默认建议 |
|---|--------|------|----------|
| D1 | RectificationDeadlineCalculator 的 hours 起算点（G5） | A. 从 confirmedAt 精确时刻起算 B. 当日 00:00 起算 | A（更符合 SLA 语义） |
| D2 | SQLCipher 是否必须（G9） | A. 必须加密（增加 native 复杂度） B. 降级为不加密（MVP 接受） | B（MVP 范围） |
| D3 | 相机原生模块实现方式（G10） | A. react-native-vision-camera B. 自写原生模块 C. 用 expo-camera | A（社区成熟） |
| D4 | 服务器 postgres 密码 | 提供密码 或 确认用 root+systemd 流程 | 由用户提供 |
| D5 | 部署模式 | A. 本地构建 jar + scp B. 服务器装 Maven 自建 | A（服务器 RAM 紧张） |

---

## 5. 影响评估总结

| 维度 | 评估 |
|------|------|
| 规格变更 | 小（仅 G3/G4/G5/G9 涉及规格微调，其余为实现修复） |
| 代码变更 | 中（~30-50 文件，集中在修复而非新写） |
| 数据库变更 | 大（PG13→16 重建，但无数据保留问题） |
| 基础设施变更 | 大（首次部署，systemd+Nginx+JRE17 全新） |
| 测试变更 | 中（从 0 起步，覆盖核心逻辑） |
| 风险 | Medium-High（首次运行暴露面大，但可控） |
| 工作量估算 | 7 阶段，约 35-45 个 task |

**建议工作流路径**：`requirement_change_path`（已选定，符合治理）