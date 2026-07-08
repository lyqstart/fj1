# Intake — WI-0005 (svr-lg 同步 WI-0004 源码修复)

**来源 Work Items:** WI-0003（部署）、WI-0004（源码修复）
**任务类型:** 运维操作（生产环境同步）

---

## 操作目标

将 WI-0004 修复后的源码（5 个 bug 修复）同步到已运行的 svr-lg (10.0.12.12)，使服务器运行干净的修复版本而非临时修补版本。

**最终状态：**
- svr-lg 运行用修复后源码重新打包的 jar（含正确 yml + V3 修复 + V8 迁移）
- flyway_schema_history 的 V3 checksum 已同步（via flyway repair）
- V8 迁移已应用（幂等，大部分跳过因已手动 ALTER）
- ddl-auto 恢复为 validate（源码正确值，消除 none 的隐患）
- fj1 系统功能正常，数据完整

---

## 当前服务器状态（来自 WI-0003）

| 组件 | 状态 |
|------|------|
| fj1-api | active, PID 3210935, 8080, health=UP |
| nginx | active, 80, 前端+API 代理正常 |
| PostgreSQL-16 | active, 5432, fj1_inspect DB |
| Flyway | V1-V7 success=t（含临时修补后的 V3 OVERRIDING） |
| ddl-auto | **none**（服务器端临时改的，源码是 validate） |
| jar | 临时修补版（已删 spring.profiles.active，手动 ALTER 了 export_files/users） |
| jar 备份 | /opt/fj1/api/fj-api-1.0.0.jar.bak.G6（修补前，81732875 字节） |
| 服务器端 schema 状态 | export_files 已有 error_message/export_status 列；users.status 已是 integer；file_hash 仍是 VARCHAR(64)（未修补） |

---

## 操作步骤概览（详细 ops_plan 由 sf-design 生成）

### 阶段 A：备份
- A1: 备份 fj1_inspect 数据库（pg_dump）
- A2: 备份当前运行 jar
- A3: 导出 flyway_schema_history

### 阶段 B：本地构建
- B1: mvn clean package -Pprod（构建修复后的 jar）
- B2: 验证新 jar 存在且大小合理（~78MB）

### 阶段 C：部署 jar
- C1: scp 新 jar 到 svr-lg
- C2: 停止 fj1-api 服务
- C3: 替换 jar
- C4: 启动 fj1-api 服务（此时 ddl-auto 仍是 none，先确认服务能启动）

### 阶段 D：Flyway 同步
- D1: flyway repair（同步 V3 checksum）
- D2: flyway migrate（应用 V8 迁移，幂等）

### 阶段 E：恢复 ddl-auto=validate
- E1: 确认 V8 已应用
- E2: 恢复 ddl-auto=validate（源码 jar 已是 validate，如果服务器用源码 yml 则自动恢复；如果服务器有独立 yml 需手动改）
- E3: 重启 fj1-api，确认 validate 模式启动成功

### 阶段 F：验证
- F1: health UP
- F2: flyway_schema_history V1-V8 全部 success=t
- F3: 内存 + 日志正常

---

## 风险

1. **flyway repair 是破坏性操作**（修改 flyway_schema_history checksum），但有 pg_dump 备份可回滚
2. **停机时间**：阶段 C-E 期间服务不可用，预计 5-10 分钟
3. **V8 迁移幂等性**：svr-lg 上 export_files 列已存在（IF NOT EXISTS 跳过），users.status 已是 integer（DO 块跳过），仅 file_hash 扩展会实际执行
4. **ddl-auto 恢复 validate 的风险**：如果还有未发现的 schema 不匹配，validate 模式会启动失败。这是验证修复是否彻底的关键测试

---

## 回滚触发条件

- flyway repair 失败 → 回滚（恢复 flyway_schema_history 导出）
- V8 迁移失败 → 回滚（pg_dump 恢复）
- ddl-auto=validate 启动失败 → 回滚到旧 jar + ddl-auto=none
- health 检查失败 → 回滚到旧 jar

## 回滚方案

- jar 回滚：恢复 /opt/fj1/api/fj-api-1.0.0.jar.bak.G6（或当前运行版本的备份）
- DB 回滚：pg_restore 或 psql < pg_dump.sql
- flyway_schema_history 回滚：psql < flyway_history_export.sql

## 约束

- 所有命令通过 ssh lg (root) 执行
- 机密 (DB_PASSWORD, JWT_SECRET) 不泄露
- 本地 mvn package 在 /mnt/1t_back/project/fj1 执行
- 禁止写入 .specforge/ 或修改源码仓库