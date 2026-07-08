# Candidate Requirements — WI-0005 (svr-lg 同步 WI-0004 源码修复)

**来源 Work Items:** WI-0003（部署）、WI-0004（源码修复）
**任务类型:** 运维操作（生产环境同步）

---

## 操作目标

将 WI-0004 修复后的源码（5 个 bug 修复）同步到已运行的 svr-lg (10.0.12.12)，使服务器运行干净的修复版本而非临时修补版本。

**最终状态：**
- svr-lg 运行用修复后源码修补的 jar（含正确 yml + V3 修复 + V8 迁移）
- flyway_schema_history 的 V3 checksum 已同步（via flyway repair）
- V8 迁移已应用（幂等，大部分跳过因已手动 ALTER）
- ddl-auto 恢复为 validate（源码正确值，消除 none 的隐患）
- fj1 系统功能正常，数据完整

## 验收标准

- AC-1: flyway_schema_history V1-V8 全部 success=t，V3 checksum 已同步
- AC-2: ddl-auto=validate 下 fj1-api 正常启动
- AC-3: health=UP（经 Nginx 全链路）
- AC-4: 前端页面 HTTP 200
- AC-5: 内存 ≥ 500MB，无 OOM
- AC-6: 日志无 error/exception
- AC-7: 服务器数据完整（无数据丢失）

## 当前服务器状态（来自 WI-0003）

| 组件 | 状态 |
|------|------|
| fj1-api | active, PID 3210935, 8080, health=UP |
| nginx | active, 80, 前端+API 代理正常 |
| PostgreSQL-16 | active, 5432, fj1_inspect DB |
| Flyway | V1-V7 success=t |
| ddl-auto | none（需改 validate） |
| jar | 临时修补版 |
| 外部 yml | /opt/fj1/api/application-prod.yml（覆盖 jar 内部） |

## 关键约束

- 两边都无 JDK17+maven，无法标准构建 jar
- 使用 zip 修补 jar 内部 SQL 文件
- 外部 yml 覆盖机制（SPRING_CONFIG_ADDITIONAL_LOCATION）
- flyway.validate-on-migrate=true（必须先 repair）
- 所有命令通过 ssh lg (root) 执行

## 回滚触发条件

- flyway repair 失败 → 恢复 flyway_schema_history 导出
- V8 迁移失败 → pg_dump 恢复
- ddl-auto=validate 启动失败 → 回滚到旧 jar + ddl-auto=none
- health 检查失败 → 回滚到旧 jar