# Change Classification — WI-0008

## 基本信息

- **Work Item:** WI-0008
- **变更类型:** ops_task（运维操作）
- **风险等级:** 中（涉及生产服务停机 + jar 替换）
- **workflow_type:** ops_task
- **workflow_path:** task_change_path

## 变更分类

### 类型：ops_task（构建+部署运维操作）

本次操作包含两个阶段：
1. **本地构建**：搭建 JDK17+maven 环境，编译完整 fj1 jar
2. **生产部署**：替换 svr-lg jar，重启服务，Flyway 自动执行 V9

### 性质

| 阶段 | 操作 | 破坏性 | 影响范围 |
|------|------|--------|---------|
| 安装 maven | `dnf install maven` | 低（系统包） | 本地构建机 |
| 设置 JAVA_HOME | 环境变量 | 无 | 本地 shell 会话 |
| mvn clean package | 编译+打包 | 无（target/ 是构建产物） | 本地 |
| scp jar 到 svr-lg | 文件传输 | 无（传输） | 网络 |
| 备份旧 jar | cp | 无 | svr-lg 磁盘 |
| 替换 jar | mv | 中（覆盖生产文件） | svr-lg |
| 重启 fj1-api | systemctl restart | **高（服务停机 1-2 分钟）** | 生产 API |
| Flyway V9 自动执行 | DDL 变更 | 低（宽松化） | fj1_inspect DB |

## 风险评估

### 中风险

- **服务停机**：systemctl restart 导致 API 不可用约 1-2 分钟（JVM 启动 + Spring Boot 初始化 + Flyway 执行）
- **jar 替换**：覆盖生产 jar，但有 .bak.WI0008 备份可回滚

### 低风险

- **构建失败**：本地首次完整构建，可能遇到依赖下载失败/编译错误。失败则不部署，无生产影响
- **V9 迁移**：宽松化变更（CHECK 扩展 + VARCHAR 扩展），表为空，PG12+ ALTER TYPE 不锁表

## 回滚方案

### 构建阶段回滚
- 构建失败 → 不部署，保留 svr-lg 现状不变

### 部署阶段回滚
- 服务启动失败 → 恢复 .bak.WI0008 jar → restart
- V9 迁移失败 → 需手动清理（flyway repair + 恢复 jar）

### 回滚触发条件
- systemctl restart 后 90 秒内服务未 active（TimeoutStartSec=90）
- health 检查返回非 UP
- 启动日志含 ERROR/Flyway 迁移失败

## 范围边界

### 包含
- 本地 maven 安装
- 完整 jar 构建（fj-api/target/fj-api-1.0.0.jar）
- svr-lg jar 替换 + 备份
- fj1-api 服务重启
- V9 迁移自动执行（由 Flyway 在启动时执行）
- 部署后验证

### 不包含
- 代码修改（源码已在 WI-0004/0007 完成）
- 数据迁移（V9 是 DDL 变更，无数据迁移）
- nginx 配置变更
- 数据库备份（业务表为空，且 V9 是宽松化变更）