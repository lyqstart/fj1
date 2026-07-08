# Impact Analysis — WI-0004

**Work Item:** WI-0004 (fj1 源码 bug 修复)

---

## 1. 各 Bug 涉及文件清单

### Bug-1: application-prod.yml
| 文件 | 角色 | 变更类型 |
|------|------|----------|
| `deploy/config/application-prod.yml` | 生产配置 | 删除第 7-8 行 `spring.profiles.active` |

### Bug-2: V2/V3 迁移链
| 文件 | 角色 | 变更类型 |
|------|------|----------|
| `fj-backend/fj-api/src/main/resources/db/migration/V2__seed_data.sql` | 种子数据 | 修改第 104-107 行（移除/改写 project_id=0 的全局角色关联） |
| `fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql` | 项目表 | 可能修改第 222-223 行（ADD CONSTRAINT 逻辑或新增 projects(0) INSERT） |

### Bug-3: export_files schema
| 文件 | 角色 | 变更类型 |
|------|------|----------|
| `fj-backend/fj-api/src/main/resources/db/migration/V8__*.sql`（新增） | 修补迁移 | ADD COLUMN error_message/export_status + ALTER file_hash |
| `fj-backend/fj-export/src/main/java/com/fj/export/entity/ExportFile.java` | JPA 实体 | 仅读分析（不修改；已正确声明字段） |

### Bug-4: users.status 类型
| 文件 | 角色 | 变更类型 |
|------|------|----------|
| `fj-backend/fj-api/src/main/resources/db/migration/V8__*.sql`（新增，与 Bug-3 合并） | 修补迁移 | ALTER COLUMN status TYPE integer |
| `fj-backend/fj-system/src/main/java/com/fj/system/entity/UserStatusConverter.java` | JPA Converter | 仅读分析（可选更新注释 SMALLINT→INTEGER） |
| `fj-backend/fj-system/src/main/java/com/fj/system/entity/UserStatus.java` | 枚举 | 仅读分析（可选更新注释 SMALLINT→INTEGER） |

### Bug-5: install_pg16.sh
| 文件 | 角色 | 变更类型 |
|------|------|----------|
| `scripts/ops/install_pg16.sh` | 运维脚本 | 修改第 25 行 PG13_PACKAGES + 第 143 行 initdb 参数 |

---

## 2. Bug 间依赖关系与耦合

```
Bug-1 (yml)     ─── 独立，无耦合
Bug-5 (script)  ─── 独立，无耦合

Bug-2 (V2/V3)   ─── 独立于 Bug-3/4 的 V8，但影响"全新部署能否到达 V8"
Bug-3 (V7+V8)   ─── 与 Bug-4 可共用同一 V8 迁移文件（均为 ALTER/ADD 操作）
Bug-4 (V1+V8)   ─── 与 Bug-3 可共用同一 V8 迁移文件
```

### 关键耦合分析

**Bug-2 与 Bug-3/4 的执行顺序耦合（关键）：**

- 在**全新部署**场景下，Flyway 执行顺序为 V1→V2→V3→V4→V5→V6→V7→V8
- 如果 Bug-2 未修复（V3 的 ADD CONSTRAINT 失败），迁移在 V3 中断，**V8 永远不会执行**
- 因此 Bug-2 的修复是 Bug-3/4 的 V8 能生效的**前置条件**
- 这也再次证明 Bug-2 无法通过 V8 解决：V8 自身的存在依赖于 V3 成功

**Bug-3 与 Bug-4 的 V8 合并建议：**
- 两者均为"数据库 schema 补丁"性质，建议合并到单一 V8 迁移文件（如 `V8__fix_schema_mismatches.sql`），减少迁移文件碎片化

---

## 3. 对已部署 svr-lg 环境的影响

### 3.1 svr-lg 当前状态

svr-lg (10.0.12.12) 的 fj_inspect 数据库：
- Flyway V1-V7 全部 success=t（通过临时修补执行）
- export_files 表已手动 ADD COLUMN error_message + export_status
- users.status 已手动 ALTER TYPE integer
- jar 内嵌 application-prod.yml 已删除 spring.profiles.active（备份在 fj-api-1.0.0.jar.bak.G6）
- ddl-auto 当前为 none（临时修补）

### 3.2 修复后 svr-lg 重新部署的影响

| Bug | 修复方式 | svr-lg 重新部署影响 | 是否需要特殊操作 |
|-----|----------|---------------------|------------------|
| Bug-1 | 删除 yml 中 spring.profiles.active | 无影响（svr-lg jar 内已修补；重新打包会用修复后的源码，一致） | 无 |
| Bug-2 | 修改 V2/V3 源文件 | **checksum 变化**：validate-on-migrate=true 会发现 V2/V3 checksum 与 flyway_schema_history 不匹配 → **启动失败** | **需 flyway repair** |
| Bug-3 | 新增 V8 迁移 | V8 执行 ADD COLUMN IF NOT EXISTS（幂等，svr-lg 已有列则跳过）+ ALTER file_hash TYPE | 无（幂等） |
| Bug-4 | 新增 V8 迁移（与 Bug-3 合并） | V8 执行 ALTER COLUMN TYPE（DO 块条件判断，已是 integer 则跳过） | 无（条件判断） |
| Bug-5 | 改脚本 | 无影响（svr-lg PG16 已装，脚本不再执行） | 无 |

### 3.3 svr-lg 的 ddl-auto 恢复

当前 svr-lg ddl-auto=none（临时修补）。修复后应恢复为 validate（AC-6）。
- 恢复后 Hibernate 会校验所有实体与 DB schema 的一致性
- Bug-3/4 的 V8 修补完成后，export_files 和 users 表 schema 与实体一致
- **前提：** 所有其他实体的 schema 也需一致（建议 design 阶段做全量 validate 审查）

### 3.4 svr-lg 数据安全

| 修补操作 | 是否丢失数据 | 说明 |
|----------|-------------|------|
| Bug-2 修改 V2/V3 | 否 | svr-lg 的 V2/V3 已执行（修补版），修改源码不影响已执行的数据 |
| Bug-3 V8 ADD COLUMN | 否 | 新增 nullable 列，已有数据不受影响 |
| Bug-3 V8 ALTER file_hash TYPE | 否 | VARCHAR(64)→VARCHAR(128) 是扩展，不截断 |
| Bug-4 V8 ALTER status TYPE | 否 | smallint→integer 是扩展，0/1/2 值不变 |

**结论：** 修复不丢失 svr-lg 任何已有数据。

---

## 4. 对未来部署（svr-sh 等）的影响

修复后，全新部署到新环境的预期行为：

| 步骤 | 修复前 | 修复后 |
|------|--------|--------|
| install_pg16.sh | ❌ initdb 参数错误 / PG13 包名错误 | ✅ 正确初始化 PG16 |
| Flyway V1-V7 | ❌ V3 ADD CONSTRAINT 失败 | ✅ V1-V8 全部成功（V2 已修正，V8 补 schema） |
| 应用启动 (ddl-auto=validate) | ❌ Schema-validation 多处失败 | ✅ 通过 |
| application-prod.yml | ❌ Profiles 违规 | ✅ 无违规 |

**全新部署无需任何手动修补。**

---

## 5. 回归风险分析

### 5.1 Bug-1 回归风险
- **风险：** 删除 spring.profiles.active 后，若 SPRING_PROFILES_ACTIVE 环境变量未设置，应用以默认 profile 启动
- **概率：** 低（部署流程应设置该变量）
- **检测：** 应用启动日志会显示 "No active profile set" 警告

### 5.2 Bug-2 回归风险
- **风险：** 修改 V2/V3 种子数据逻辑后，admin 全局角色关联可能丢失或指向错误 project_id
- **概率：** 中（需确保 admin 的 ROLE_SYS_ADMIN 关联仍正确建立）
- **检测：** 全新部署后验证 admin 能登录并拥有系统管理员权限
- **svr-lg 特有风险：** flyway repair 操作若执行不当可能导致迁移历史损坏（需在隔离环境验证）

### 5.3 Bug-3 回归风险
- **风险：** file_hash VARCHAR(64)→VARCHAR(128) 扩展后，已有的 64 字符哈希值不受影响，但需确认无 CHECK 约束限制长度
- **概率：** 低（扩展 varchar 长度是安全操作）
- **检测：** export 导出后验证 file_hash 字段读写正常

### 5.4 Bug-4 回归风险
- **风险：** smallint→integer 后，UserStatusConverter 的 Integer 泛型与 DB 列类型一致，但需确认无其他代码依赖 status 为 smallint（如 JDBC ResultSet.getShort()）
- **概率：** 低（Converter 已使用 Integer）
- **检测：** 用户登录/状态变更功能正常

### 5.5 Bug-5 回归风险
- **风险：** PG13 包名改为 postgresql13-server 后，若目标系统的 PG13 是 RHEL 官方仓库安装（包名 postgresql-server），则检测失败
- **概率：** 低（脚本整体使用 PGDG 仓库，PG13 应同为 PGDG 安装）
- **检测：** 在含 PG13 的测试环境验证卸载逻辑

### 5.6 跨 Bug 回归风险
- **全量 validate 风险：** Bug-3/4 修复后恢复 ddl-auto=validate，可能暴露**其他未发现的实体-schema 不匹配**（本 WI 仅分析了 intake.md 列出的 5 个 bug 涉及的实体）。建议 design 阶段对全项目所有 @Entity 做一次 schema-validate 审查。

---

## 6. 测试策略建议（供 design/task 阶段参考）

1. **全新空数据库验证：** 在干净 PG16 实例上执行 V1-V8 全链迁移，验证无 FK 违规、无 Schema-validation 错误
2. **svr-lg 升级验证：** 在 svr-lg 克隆环境上执行 flyway repair + 重新部署，验证数据完整
3. **install_pg16.sh 验证：** 在干净 CentOS/RHEL VM 上执行脚本，验证 PG16 初始化成功
4. **回归测试：** admin 登录 + 导出报告 + 用户状态变更（覆盖 Bug-2/3/4 修复路径）
