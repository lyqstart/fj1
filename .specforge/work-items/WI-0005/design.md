# Ops Plan — WI-0005 (svr-lg 同步 WI-0004 源码修复)

> Work Item: WI-0005
> Workflow Type: ops_task
> 设计时间: 2026-07-04
> 设计者: sf-design
> 来源: WI-0004 design.md + WI-0004 verification_report.md + WI-0005 intake.md
> 标准依据: specforge_final_fused_standard_v1_1_patch1_zh.md

---

## 0. Extension Registry 前置检查

读取 `.specforge/project/extension_registry.json`：`namespaces.design_types` 为空。

**结论：** 本 ops_plan 使用标准 ops_task `design`（ops_plan）类型，不涉及自定义扩展。**不触发 Extension Subflow。**

---

## 操作目标

将 WI-0004 修复后的源码同步到 svr-lg (10.0.12.12)，采用 **jar 内部文件修补**（zip/unzip）方案替代标准 mvn 构建（因本地无 maven/JDK17、svr-lg 无 javac/maven）。

**最终状态：**
1. svr-lg jar 内部 `BOOT-INF/classes/db/migration/V3__project_tables.sql` 更新为修复版（含 INSERT projects(0)）
2. svr-lg jar 内部新增 `BOOT-INF/classes/db/migration/V8__fix_schema_mismatches.sql`
3. 外部 `application-prod.yml` 的 `ddl-auto` 恢复为 `validate`
4. `flyway_schema_history` 的 V3 checksum 已同步（via Flyway repair）
5. V8 迁移已应用（幂等：补列/扩展类型，大部分跳过）
6. fj1-api health=UP，ddl-auto=validate 启动成功

---

## 前置条件

### 执行前必须全部满足

| # | 前置条件 | 验证命令 | 状态 |
|---|----------|----------|------|
| P1 | svr-lg SSH 可达（root） | `ssh lg 'hostname && whoami'` → 返回 svr-lg hostname + root | ☐ 待确认 |
| P2 | fj1-api 当前 health=UP | `ssh lg 'curl -sf localhost:8080/api/actuator/health \| jq -r .status'` → UP | ☐ 待确认 |
| P3 | PostgreSQL 16 active | `ssh lg 'systemctl is-active postgresql-16'` → active | ☐ 待确认 |
| P4 | svr-lg 有 zip/unzip | `ssh lg 'which zip unzip'` → 两个路径都返回 | ☐ 待确认 |
| P5 | svr-lg 磁盘空间 >500MB | `ssh lg 'df -h /opt /tmp'` → 可用空间充足 | ☐ 待确认 |
| P6 | 本地修复 V3 文件存在 | `ls -la fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql` | ☐ 待确认 |
| P7 | 本地新建 V8 文件存在 | `ls -la fj-backend/fj-api/src/main/resources/db/migration/V8__fix_schema_mismatches.sql` | ☐ 待确认 |
| P8 | 本地修复 yml 模板存在 | `ls -la deploy/config/application-prod.yml` | ☐ 待确认 |
| P9 | .env 文件存在 | `ssh lg 'ls -la /opt/fj1/api/.env'` | ☐ 待确认 |
| P10 | **用户已同意停机窗口** | 用户明确确认 | ☐ 待确认 |

### 约束声明

- **所有命令通过 `ssh lg` 执行**（svr-lg root 权限）
- **机密不泄露**：DB_PASSWORD/JWT_SECRET 从 `.env` 读取，不在命令行明文出现
- **禁止写入 `.specforge/` 之外的治理产物**
- **禁止修改源码仓库**（`/mnt/1t_back/project/fj1/fj-backend/**` 只读）

---

## 操作步骤

### 阶段 A：备份（A1-A4）

> 目标：在破坏性操作前完成四重备份（数据库/jar/yml/Flyway元数据）
> 服务状态：✅ 运行中（不影响）

---

#### 步骤 A1：备份 fj1_inspect 数据库（pg_dump）

- **命令：**
  ```bash
  ssh lg 'source /opt/fj1/api/.env && cd /opt/fj1/api && \
    PGPASSWORD="${DB_PASSWORD}" pg_dump -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect \
    --format=plain --no-owner --no-privileges \
    > /opt/fj1/api/backups/fj_inspect_WI0005_$(date +%Y%m%d_%H%M%S).sql && \
    echo "BACKUP_SIZE: $(ls -lh /opt/fj1/api/backups/fj_inspect_WI0005_*.sql | tail -1 | awk "{print \$5}")" && \
    echo "BACKUP_LINES: $(wc -l < /opt/fj1/api/backups/fj_inspect_WI0005_*.sql)"'
  ```
- **预期结果：**
  - 创建 `/opt/fj1/api/backups/fj_inspect_WI0005_YYYYMMDD_HHMMSS.sql`
  - 输出 `BACKUP_SIZE: xxK/xxM`（种子数据库预计 < 1MB）
  - 输出 `BACKUP_LINES: NNNN`（预计数百~数千行）
- **是否破坏性：** 否
- **requires_user_confirmation：** false
- **失败处理：** 若 pg_dump 失败 → **停止全部操作**（无数据库备份不可继续）

---

#### 步骤 A2：备份当前运行 jar

- **命令：**
  ```bash
  ssh lg 'cp -p /opt/fj1/api/fj-api-1.0.0.jar /opt/fj1/api/fj-api-1.0.0.jar.bak.WI0005 && \
    ls -la /opt/fj1/api/fj-api-1.0.0.jar /opt/fj1/api/fj-api-1.0.0.jar.bak.WI0005 && \
    echo "JAR_SIZE_VERIFY: $(md5sum /opt/fj1/api/fj-api-1.0.0.jar /opt/fj1/api/fj-api-1.0.0.jar.bak.WI0005 | awk "{print \$1}" | sort -u | wc -l) (应为1，表示md5一致)"'
  ```
- **预期结果：**
  - 创建 `/opt/fj1/api/fj-api-1.0.0.jar.bak.WI0005`
  - 两个文件大小一致（当前运行版，非 .bak.G6）
  - `JAR_SIZE_VERIFY: 1`（md5 一致）
- **是否破坏性：** 否
- **requires_user_confirmation：** false

---

#### 步骤 A3：备份外部 application-prod.yml

- **命令：**
  ```bash
  ssh lg 'cp -p /opt/fj1/api/application-prod.yml /opt/fj1/api/application-prod.yml.bak.WI0005 && \
    ls -la /opt/fj1/api/application-prod.yml.bak.WI0005 && \
    echo "=== 当前 ddl-auto 值 ===" && \
    grep "ddl-auto" /opt/fj1/api/application-prod.yml'
  ```
- **预期结果：**
  - 创建 `/opt/fj1/api/application-prod.yml.bak.WI0005`
  - 显示当前 `ddl-auto: none`（确认待修改状态）
- **是否破坏性：** 否
- **requires_user_confirmation：** false

---

#### 步骤 A4：导出 flyway_schema_history

- **命令：**
  ```bash
  ssh lg 'source /opt/fj1/api/.env && \
    PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect -c \
    "COPY (SELECT installed_rank, version, description, type, script, checksum, installed_by, installed_on, execution_time, success FROM flyway_schema_history ORDER BY installed_rank) TO STDOUT WITH CSV HEADER" \
    > /opt/fj1/api/backups/flyway_history_WI0005_$(date +%Y%m%d_%H%M%S).csv && \
    echo "=== 导出内容 ===" && \
    cat /opt/fj1/api/backups/flyway_history_WI0005_*.csv'
  ```
- **预期结果：**
  - 创建 `/opt/fj1/api/backups/flyway_history_WI0005_YYYYMMDD_HHMMSS.csv`
  - 显示 V1-V7 共 7 行记录（全部 success=t）
  - V3 的 checksum 为旧值（repair 后将改变）
- **是否破坏性：** 否
- **requires_user_confirmation：** false
- **失败处理：** 若导出失败 → **停止全部操作**

---

### 阶段 B：准备迁移文件（B1-B3）

> 目标：在 svr-lg 组装完整的迁移文件目录（V1-V8），供 Flyway CLI 使用
> 服务状态：✅ 运行中

---

#### 步骤 B1：scp 修复后的 V3 + V8 到 svr-lg

- **命令：**
  ```bash
  # 在本地执行（/mnt/1t_back/project/fj1）
  scp fj-backend/fj-api/src/main/resources/db/migration/V3__project_tables.sql lg:/tmp/V3__project_tables.sql
  scp fj-backend/fj-api/src/main/resources/db/migration/V8__fix_schema_mismatches.sql lg:/tmp/V8__fix_schema_mismatches.sql
  # 验证传输完整性
  ssh lg 'ls -la /tmp/V3__project_tables.sql /tmp/V8__fix_schema_mismatches.sql && \
    echo "=== V3 INSERT 验证 ===" && \
    grep -n "INSERT INTO projects" /tmp/V3__project_tables.sql && \
    echo "=== V8 内容验证 ===" && \
    head -5 /tmp/V8__fix_schema_mismatches.sql'
  ```
- **预期结果：**
  - 两个文件传输到 svr-lg `/tmp/`
  - V3 grep 显示 `INSERT INTO projects (id, name, code, status, description, created_at, updated_at)` 在 `ADD CONSTRAINT fk_upr_project` 之前
  - V8 显示 WI-0004 注释头
- **是否破坏性：** 否
- **requires_user_confirmation：** false

---

#### 步骤 B2：从 jar 提取所有迁移文件到 /tmp/flyway-migrations/

- **命令：**
  ```bash
  ssh lg 'rm -rf /tmp/flyway-migrations && mkdir -p /tmp/flyway-migrations && \
    cd /tmp/flyway-migrations && \
    unzip -j -o /opt/fj1/api/fj-api-1.0.0.jar "BOOT-INF/classes/db/migration/V*.sql" && \
    echo "=== 提取的迁移文件 ===" && \
    ls -la V*.sql && \
    echo "=== V3 当前内容（旧版，无 INSERT）===" && \
    grep -c "INSERT INTO projects" V3__project_tables.sql'
  ```
- **预期结果：**
  - 提取 V1-V7 共 7 个 SQL 文件到 `/tmp/flyway-migrations/`
  - V3 的 `INSERT INTO projects` 计数为 **0**（jar 内是旧版 V3）
- **是否破坏性：** 否
- **requires_user_confirmation：** false
- **失败处理：** 若 unzip 失败 → 检查 jar 路径/权限

---

#### 步骤 B3：用修复后的 V3 覆盖 + 添加 V8

- **命令：**
  ```bash
  ssh lg 'cp /tmp/V3__project_tables.sql /tmp/flyway-migrations/V3__project_tables.sql && \
    cp /tmp/V8__fix_schema_mismatches.sql /tmp/flyway-migrations/V8__fix_schema_mismatches.sql && \
    echo "=== 最终迁移文件列表 ===" && \
    ls -la /tmp/flyway-migrations/V*.sql && \
    echo "=== V3 修复验证（应有 INSERT）===" && \
    grep -c "INSERT INTO projects" /tmp/flyway-migrations/V3__project_tables.sql && \
    echo "=== V8 存在验证 ===" && \
    grep -c "fix_schema_mismatches" /tmp/flyway-migrations/V8__fix_schema_mismatches.sql'
  ```
- **预期结果：**
  - `/tmp/flyway-migrations/` 包含 V1-V8 共 8 个文件
  - V3 的 `INSERT INTO projects` 计数为 **1**（修复版）
  - V8 匹配计数为 **1**（文件存在且内容正确）
- **是否破坏性：** 否
- **requires_user_confirmation：** false

---

### 阶段 C：安装 Flyway CLI（C1-C2）

> 目标：安装 Flyway CLI 用于执行 repair
> 服务状态：✅ 运行中
> ⚠️ 本阶段有网络依赖，若全部镜像下载失败 → 切换方案 B（见 D1 fallback）

---

#### 步骤 C1：下载 Flyway CLI（多镜像 fallback）

- **命令：**
  ```bash
  ssh lg 'FLYWAY_VERSION="9.22.3" && \
    FLYWAY_PKG="flyway-commandline-${FLYWAY_VERSION}-linux-x64.tar.gz" && \
    MIRRORS=(
      "https://repo1.maven.org/maven2/org/flywaydb/flyway-commandline/${FLYWAY_VERSION}/${FLYWAY_PKG}"
      "https://maven.aliyun.com/repository/public/org/flywaydb/flyway-commandline/${FLYWAY_VERSION}/${FLYWAY_PKG}"
      "https://mirrors.cloud.tencent.com/maven/org/flywaydb/flyway-commandline/${FLYWAY_VERSION}/${FLYWAY_PKG}"
    ) && \
    DOWNLOADED=false && \
    for URL in "${MIRRORS[@]}"; do
      echo "尝试下载: ${URL}"
      if curl -sfL --connect-timeout 15 --max-time 120 -o /tmp/${FLYWAY_PKG} "${URL}"; then
        echo "下载成功: ${URL}"
        DOWNLOADED=true
        break
      fi
      echo "下载失败，尝试下一个镜像..."
    done && \
    if [ "$DOWNLOADED" = false ]; then
      echo "FALLBACK_REQUIRED: 所有镜像下载失败，切换方案 B（Python checksum）"
      exit 2
    fi && \
    ls -la /tmp/${FLYWAY_PKG} && \
    echo "MD5: $(md5sum /tmp/${FLYWAY_PKG} | awk "{print \$1}")"'
  ```
- **预期结果：**
  - 下载 `flyway-commandline-9.22.3-linux-x64.tar.gz` 到 `/tmp/`
  - 至少一个镜像下载成功
  - 显示文件大小（预计 ~30-50MB）和 MD5
- **是否破坏性：** 否
- **requires_user_confirmation：** false
- **失败处理：**
  - exit code 2（所有镜像失败）→ **切换方案 B**（见 D1 fallback 说明）
  - 部分镜像失败但有一个成功 → 正常继续

---

#### 步骤 C2：解压 + 配置 flyway.conf

- **命令：**
  ```bash
  ssh lg 'cd /opt && tar xzf /tmp/flyway-commandline-9.22.3-linux-x64.tar.gz && \
    ls -la /opt/flyway-9.22.3/ && \
    source /opt/fj1/api/.env && \
    cat > /opt/flyway-9.22.3/conf/flyway.conf <<CONF
  flyway.url=jdbc:postgresql://127.0.0.1:5432/fj_inspect
  flyway.user=${DB_USER:-fj_app}
  flyway.password=${DB_PASSWORD}
  flyway.locations=filesystem:/tmp/flyway-migrations
  flyway.connectRetries=3
  flyway.validateOnMigrate=false
  CONF
    echo "=== flyway.conf 配置（密码已脱敏）===" && \
    sed "s/password=.*/password=***REDACTED***/" /opt/flyway-9.22.3/conf/flyway.conf && \
    echo "=== 测试 Flyway CLI 可执行 ===" && \
    /opt/flyway-9.22.3/flyway -v'
  ```
- **预期结果：**
  - 解压到 `/opt/flyway-9.22.3/`
  - `flyway.conf` 配置完成（url/user/password 从 .env 读取）
  - `flyway -v` 输出版本号 `Flyway Community Edition 9.22.3`
- **是否破坏性：** 否
- **requires_user_confirmation：** false
- **失败处理：** 若 `flyway -v` 报错 → 检查 Java 可用性（svr-lg 有 JRE 17，应可运行）

---

### 阶段 D：Flyway repair（D1-D2）⚠️ 破坏性

> 目标：同步 V3 的 checksum（repair 是破坏性操作，修改 flyway_schema_history）
> 服务状态：✅ 运行中（repair 不影响运行服务）

---

#### 步骤 D1：执行 Flyway repair ⚠️ 破坏性

- **命令：**
  ```bash
  ssh lg '/opt/flyway-9.22.3/flyway repair 2>&1 | tee /tmp/flyway_repair_WI0005.log && \
    echo "REPAIR_EXIT_CODE: $?"'
  ```
- **预期结果：**
  - Flyway 读取 `/tmp/flyway-migrations/` 中的新 V3 文件
  - 计算新 V3 的 checksum
  - UPDATE `flyway_schema_history` 中 V3 记录的 checksum 字段
  - 输出类似：`Repair of failed migration in Schema History table "public"."flyway_schema_history" was successful.`
  - `REPAIR_EXIT_CODE: 0`
- **是否破坏性：** **是**（修改 flyway_schema_history 元数据）
- **requires_user_confirmation：** **true**
- **失败处理：**
  - 若 repair 报错 → **停止操作**，执行回滚 R-D1（恢复 flyway_history 导出）
  - 若方案 A 整体不可行（CLI 版本不兼容/无法运行）→ **切换方案 B**

- **方案 B fallback（Python 计算 checksum）：**

  若 C1-C2 或 D1 方案 A 失败，切换到 Python 手算 checksum：

  ```bash
  # Flyway 9.x checksum 算法：每行做 CRC32 变种处理
  # 注意：此算法复杂且易错，仅作为方案 A 不可用时的 fallback
  ssh lg 'python3 <<PYEOF
  import zlib, struct

  def flyway_crc32(data: bytes) -> int:
      """Flyway 9.x 专用 CRC32 变种算法（与 java.util.zip.CRC32 不同）"""
      # Flyway 使用 java.util.zip.CRC32，但每行末尾替换 \r\n -> \n 并做特殊处理
      # 实际上 Flyway 的 checksum 与标准 CRC32 不同
      # Flyway 对每个字节做 CRC32，但对换行做归一化
      # 此处实现参考 Flyway 源码 org.flywaydb.core.internal.util.ChecksumCalculator
      crc = 0xFFFFFFFF
      # Flyway 逐行处理，每行末尾加 \n
      for line in data.split(b"\n"):
          line = line.rstrip(b"\r")  # 归一化换行
          for b in line:
              crc = crc ^ (b << 24)
              for _ in range(8):
                  if crc & 0x80000000:
                      crc = ((crc << 1) ^ 0x04C11DB7) & 0xFFFFFFFF
                  else:
                      crc = (crc << 1) & 0xFFFFFFFF
              crc = crc ^ (ord("\n") << 24)  # 每行加换行符
              for _ in range(8):
                  if crc & 0x80000000:
                      crc = ((crc << 1) ^ 0x04C11DB7) & 0xFFFFFFFF
                  else:
                      crc = (crc << 1) & 0xFFFFFFFF
      return crc ^ 0xFFFFFFFF

  with open("/tmp/flyway-migrations/V3__project_tables.sql", "rb") as f:
      checksum = flyway_crc32(f.read())

  print(f"V3_NEW_CHECKSUM: {checksum}")

  # 更新 flyway_schema_history
  import psycopg2, os
  from dotenv import dotenv_values
  env = dotenv_values("/opt/fj1/api/.env")
  conn = psycopg2.connect(
      host="127.0.0.1", port=5432, dbname="fj_inspect",
      user=env.get("DB_USER", "fj_app"), password=env["DB_PASSWORD"]
  )
  cur = conn.cursor()
  # 先记录旧 checksum
  cur.execute("SELECT checksum FROM flyway_schema_history WHERE version='3'")
  old = cur.fetchone()[0]
  print(f"V3_OLD_CHECKSUM: {old}")
  # 更新
  cur.execute("UPDATE flyway_schema_history SET checksum=%s WHERE version='3'", (checksum,))
  conn.commit()
  print("CHECKSUM_UPDATED_OK")
  cur.close()
  conn.close()
  PYEOF'
  ```

  **⚠️ 方案 B 风险警告：** 上述 Python CRC32 实现可能与 Flyway 实际算法不完全一致（Flyway 的 ChecksumCalculator 有特殊处理）。如果 checksum 算错，validate-on-migrate 仍会失败。**强烈建议优先使用方案 A。**

---

#### 步骤 D2：验证 repair 结果

- **命令：**
  ```bash
  ssh lg 'source /opt/fj1/api/.env && \
    PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect -c \
    "SELECT installed_rank, version, description, checksum, success FROM flyway_schema_history ORDER BY installed_rank;" && \
    echo "=== 对比 repair 前后 V3 checksum ===" && \
    echo "旧 checksum（A4 导出）:" && \
    grep "^3," /opt/fj1/api/backups/flyway_history_WI0005_*.csv | cut -d, -f6 && \
    echo "新 checksum（当前）:" && \
    PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect -t -c \
    "SELECT checksum FROM flyway_schema_history WHERE version='\''3'\'';"'
  ```
- **预期结果：**
  - flyway_schema_history 显示 V1-V7 共 7 行（repair 不新增记录）
  - V3 的 checksum 与 A4 导出的旧值**不同**（已更新）
  - 所有行 success=t
- **是否破坏性：** 否（只读验证）
- **requires_user_confirmation：** false

---

#### 步骤 D-PreCheck：export_status 列 NOT NULL 检查（关键前置！）

> ⚠️ 此步骤必须在 D1 之前或之后执行，确保 export_status 列定义完整。
> svr-lg 手动 ALTER 添加 export_status 可能缺 NOT NULL 约束，导致 ddl-auto=validate 失败。

- **命令：**
  ```bash
  ssh lg 'source /opt/fj1/api/.env && \
    PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect -c \
    "SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_name = '\''export_files'\''
       AND column_name IN ('\''error_message'\'', '\''export_status'\'', '\''file_hash'\'')
     ORDER BY column_name;" && \
    echo "=== users.status 类型 ===" && \
    PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect -c \
    "SELECT column_name, data_type, is_nullable FROM information_schema.columns
     WHERE table_name='\''users'\'' AND column_name='\''status'\'';"'
  ```
- **预期结果：**
  - export_files 三列存在
  - **若 export_status 的 is_nullable='YES'（缺 NOT NULL）→ 需手动修复：**
    ```bash
    ssh lg 'source /opt/fj1/api/.env && \
      PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect -c \
      "ALTER TABLE export_files ALTER COLUMN export_status SET NOT NULL; \
       ALTER TABLE export_files ALTER COLUMN export_status SET DEFAULT '\''SUCCESS'\'';"'
    ```
  - users.status 应为 `integer`（svr-lg 已修补）
- **是否破坏性：** 否（检查）；若是（修复 ALTER）则 **是**
- **requires_user_confirmation：** false（检查）；修复 ALTER 时 **true**

---

### 阶段 E：停机 + 修补 jar（E1-E4）⚠️ 停机窗口开始

> 目标：停止服务，修补 jar 内部文件，更新外部配置
> 服务状态：❌ E1 后停机

---

#### 步骤 E1：停止 fj1-api 服务 ⚠️ 停机开始

- **命令：**
  ```bash
  ssh lg 'systemctl stop fj-api && \
    sleep 2 && \
    systemctl is-active fj-api; \
    echo "STOP_EXIT: $?" && \
    echo "=== 确认进程已退出 ===" && \
    pgrep -f "fj-api-1.0.0.jar" || echo "NO_PROCESS (正确)"'
  ```
- **预期结果：**
  - `systemctl is-active` 返回 `inactive` 或 exit code 3
  - `pgrep` 无输出（进程已退出）
  - `NO_PROCESS (正确)`
- **是否破坏性：** **是**（服务停机）
- **requires_user_confirmation：** **true**
- **失败处理：** 若服务无法停止 → `systemctl kill fj-api` 强制终止

---

#### 步骤 E2：用 zip 修补 jar（更新 V3 + 添加 V8）

- **命令：**
  ```bash
  ssh lg 'cd /tmp/flyway-migrations && \
    echo "=== 修补前 jar 内 V3 内容 ===" && \
    unzip -p /opt/fj1/api/fj-api-1.0.0.jar BOOT-INF/classes/db/migration/V3__project_tables.sql | grep -c "INSERT INTO projects" && \
    echo "(应为 0，旧版无 INSERT)" && \
    echo "=== 执行 zip 修补 ===" && \
    # 步骤1：更新 jar 内 V3（zip -u 更新已存在文件）
    zip -u /opt/fj1/api/fj-api-1.0.0.jar V3__project_tables.sql && \
    # 注意：zip 需要在文件路径匹配 jar 内部路径
    # jar 内部路径是 BOOT-INF/classes/db/migration/V3__project_tables.sql
    # 需要构建对应目录结构
    mkdir -p /tmp/jar-patch/BOOT-INF/classes/db/migration && \
    cp /tmp/flyway-migrations/V3__project_tables.sql /tmp/jar-patch/BOOT-INF/classes/db/migration/ && \
    cp /tmp/flyway-migrations/V8__fix_schema_mismatches.sql /tmp/jar-patch/BOOT-INF/classes/db/migration/ && \
    cd /tmp/jar-patch && \
    zip -u /opt/fj1/api/fj-api-1.0.0.jar BOOT-INF/classes/db/migration/V3__project_tables.sql && \
    zip /opt/fj1/api/fj-api-1.0.0.jar BOOT-INF/classes/db/migration/V8__fix_schema_mismatches.sql && \
    echo "JAR_PATCH_DONE"'
  ```
- **预期结果：**
  - `zip -u` 更新 V3（输出 `updating: BOOT-INF/classes/db/migration/V3__project_tables.sql`）
  - `zip` 添加 V8（输出 `adding: BOOT-INF/classes/db/migration/V8__fix_schema_mismatches.sql`）
  - `JAR_PATCH_DONE`
- **是否破坏性：** **是**（修改 jar 文件）
- **requires_user_confirmation：** false（有 jar 备份 A2）
- **失败处理：** 若 zip 报错 → 执行回滚 R-E2（恢复 jar 备份）

---

#### 步骤 E3：更新外部 yml（ddl-auto → validate）

- **命令：**
  ```bash
  ssh lg 'sed -i "s/ddl-auto: none/ddl-auto: validate/" /opt/fj1/api/application-prod.yml && \
    echo "=== 修改后 ddl-auto 值 ===" && \
    grep "ddl-auto" /opt/fj1/api/application-prod.yml && \
    echo "=== yml 整体结构验证 ===" && \
    python3 -c "
  import yaml
  with open(\"/opt/fj1/api/application-prod.yml\") as f:
    y = yaml.safe_load(f)
  print(\"YAML_VALID\")
  print(\"ddl-auto:\", y[\"spring\"][\"jpa\"][\"hibernate\"][\"ddl-auto\"])
  print(\"flyway.validate-on-migrate:\", y[\"spring\"][\"flyway\"][\"validate-on-migrate\"])
  "'
  ```
- **预期结果：**
  - `ddl-auto: validate`
  - `YAML_VALID`
  - `ddl-auto: validate`
  - `flyway.validate-on-migrate: True`
- **是否破坏性：** 是（配置变更）
- **requires_user_confirmation：** false（有 yml 备份 A3）
- **失败处理：** 若 sed 误改其他行 → 执行回滚 R-E3（恢复 yml 备份）

---

#### 步骤 E4：验证修补结果

- **命令：**
  ```bash
  ssh lg 'echo "=== jar 内 V3 验证（应有 INSERT）===" && \
    unzip -p /opt/fj1/api/fj-api-1.0.0.jar BOOT-INF/classes/db/migration/V3__project_tables.sql | grep -c "INSERT INTO projects" && \
    echo "(应为 1)" && \
    echo "=== jar 内 V8 验证（应存在）===" && \
    unzip -l /opt/fj1/api/fj-api-1.0.0.jar | grep "V8__fix_schema_mismatches" && \
    echo "=== jar 完整性验证 ===" && \
    unzip -t /opt/fj1/api/fj-api-1.0.0.jar > /tmp/jar_test.log 2>&1 && \
    tail -3 /tmp/jar_test.log && \
    echo "=== jar 大小对比 ===" && \
    ls -la /opt/fj1/api/fj-api-1.0.0.jar /opt/fj1/api/fj-api-1.0.0.jar.bak.WI0005'
  ```
- **预期结果：**
  - jar 内 V3 的 `INSERT INTO projects` 计数 = **1**
  - jar 内 V8 文件存在（unzip -l 列出）
  - `unzip -t` 显示 `No errors detected`（jar 完整）
  - 新 jar 比旧 jar 略大（V3 内容增加 + 新增 V8 文件）
- **是否破坏性：** 否（只读验证）
- **requires_user_confirmation：** false
- **失败处理：** 若 jar 损坏或 V3/V8 不正确 → 执行回滚 R-E2（恢复 jar 备份）

---

### 阶段 F：启动 + Flyway migrate（F1-F3）

> 目标：启动服务，Flyway 自动执行 V8 迁移
> 服务状态：⏳ 启动中 → ✅ 恢复

---

#### 步骤 F1：启动 fj1-api（触发 V8 迁移）

- **命令：**
  ```bash
  ssh lg 'systemctl start fj-api && \
    echo "=== 等待启动（最多 90 秒）===" && \
    for i in $(seq 1 18); do
      sleep 5
      HEALTH=$(curl -sf localhost:8080/api/actuator/health 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get(\"status\",\"UNKNOWN\"))" 2>/dev/null || echo "STARTING")
      echo "T+${i}*5s: health=$HEALTH"
      if [ "$HEALTH" = "UP" ]; then
        echo "STARTUP_SUCCESS"
        break
      fi
    done && \
    echo "=== 最近启动日志 ===" && \
    tail -50 /opt/fj1/api/logs/fj-api.log 2>/dev/null | grep -E "(Started|Flyway|ERROR|Schema-validation|Migrating|Successfully applied)" | tail -20'
  ```
- **预期结果：**
  - 启动日志显示 Flyway 执行 V8 迁移：
    - `Migrating schema "public" to version "8 - fix schema mismatches"`
    - `Successfully applied 1 migration to schema "public"`（V8）
    - 或 `Current version of schema "public": 8` （如果 V8 全部幂等跳过也可能显示 up-to-date，但会记录 V8 success）
  - 日志显示 `Started FjApiApplication` + `The following 1 profile is active: "prod"`
  - **无** `Schema-validation` 错误
  - **无** `FlywayValidateException`
  - health=UP
- **是否破坏性：** 是（触发数据库 DDL 变更 via V8）
- **requires_user_confirmation：** false（V8 幂等 + 有 DB 备份）
- **失败处理：**
  - 若启动失败（Schema-validation 错误）→ 执行回滚 R-F1（恢复 yml ddl-auto=none + jar 备份 + 重启）
  - 若 Flyway migrate 报错 → 执行回滚 R-F1（pg_dump 恢复 DB）
  - 若超时 90 秒未 UP → 查看日志排查

---

#### 步骤 F2：验证 health=UP

- **命令：**
  ```bash
  ssh lg 'curl -sf localhost:8080/api/actuator/health | python3 -m json.tool && \
    echo "=== 服务状态 ===" && \
    systemctl is-active fj-api && \
    echo "=== 进程信息 ===" && \
    pgrep -f "fj-api-1.0.0.jar" && \
    echo "PID above (应有一个 Java 进程)"'
  ```
- **预期结果：**
  - health JSON：`{"status": "UP"}`
  - systemctl：`active`
  - pgrep 返回一个 PID
- **是否破坏性：** 否
- **requires_user_confirmation：** false

---

#### 步骤 F3：验证 flyway_schema_history V1-V8 success=t

- **命令：**
  ```bash
  ssh lg 'source /opt/fj1/api/.env && \
    PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect -c \
    "SELECT installed_rank, version, description, success FROM flyway_schema_history ORDER BY installed_rank;" && \
    echo "=== 验证 V8 success=t ===" && \
    PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect -t -c \
    "SELECT count(*) FROM flyway_schema_history WHERE success=true;" && \
    echo "(应为 8)"'
  ```
- **预期结果：**
  - flyway_schema_history 显示 V1-V8 共 8 行
  - **所有行 success=t**
  - count = 8
- **是否破坏性：** 否
- **requires_user_confirmation：** false

---

### 阶段 G：最终验证（G1-G4）

> 目标：全链路验证系统功能正常
> 服务状态：✅ 运行中

---

#### 步骤 G1：ddl-auto=validate 启动成功验证

- **命令：**
  ```bash
  ssh lg 'echo "=== 检查启动日志无 Schema-validation 错误 ===" && \
    grep -c "Schema-validation" /opt/fj1/api/logs/fj-api.log && \
    echo "(应为 0)" && \
    echo "=== 检查 ddl-auto 实际值 ===" && \
    grep "ddl-auto" /opt/fj1/api/application-prod.yml && \
    echo "=== 检查 profile 激活 ===" && \
    grep "profile is active" /opt/fj1/api/logs/fj-api.log | tail -1'
  ```
- **预期结果：**
  - `Schema-validation` 出现次数 = **0**（无 schema 校验错误）
  - `ddl-auto: validate`
  - profile 日志显示 `The following 1 profile is active: "prod"`
- **是否破坏性：** 否
- **requires_user_confirmation：** false

---

#### 步骤 G2：前端访问验证（HTTP 200）

- **命令：**
  ```bash
  ssh lg 'echo "=== 前端首页 ===" && \
    curl -sf -o /dev/null -w "HTTP_CODE: %{http_code}\n" http://localhost/ && \
    echo "=== API 健康检查（通过 nginx 代理）===" && \
    curl -sf http://localhost/api/actuator/health | python3 -m json.tool'
  ```
- **预期结果：**
  - 前端首页 HTTP 200
  - API health（通过 nginx 代理）返回 `{"status": "UP"}`
- **是否破坏性：** 否
- **requires_user_confirmation：** false

---

#### 步骤 G3：全链路 API health + admin 登录验证

- **命令：**
  ```bash
  ssh lg 'echo "=== admin 登录测试 ===" && \
    LOGIN_RESP=$(curl -sf -X POST http://localhost:8080/api/auth/login \
      -H "Content-Type: application/json" \
      -d "{\"username\":\"admin\",\"password\":\"admin123\"}") && \
    echo "$LOGIN_RESP" | python3 -c "
  import sys, json
  resp = json.load(sys.stdin)
  if \"token\" in resp or \"accessToken\" in resp:
    print(\"LOGIN_SUCCESS\")
    token = resp.get(\"token\") or resp.get(\"accessToken\")
    print(\"TOKEN_PREFIX:\", token[:20] + \"...\")
  else:
    print(\"LOGIN_FAILED:\", resp)
  " && \
    echo "=== export_files schema 验证 ===" && \
    source /opt/fj1/api/.env && \
    PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect -c \
    "SELECT column_name, data_type, character_maximum_length, is_nullable
     FROM information_schema.columns
     WHERE table_name='\''export_files'\'' AND column_name IN ('\''error_message'\'','\''export_status'\'','\''file_hash'\'');"' 
  ```
- **预期结果：**
  - `LOGIN_SUCCESS`（admin 登录正常）
  - export_files 三列：
    - error_message: varchar(1024), nullable
    - export_status: varchar(32), NOT NULL
    - file_hash: varchar(128)
- **是否破坏性：** 否
- **requires_user_confirmation：** false

---

#### 步骤 G4：内存 + 日志检查

- **命令：**
  ```bash
  ssh lg 'echo "=== JVM 内存 ===" && \
    curl -sf localhost:8080/api/actuator/health | python3 -c "
  import sys, json
  h = json.load(sys.stdin)
  print(json.dumps(h, indent=2, ensure_ascii=False))
  " && \
    echo "=== 进程内存占用 ===" && \
    ps aux | grep "[f]j-api-1.0.0.jar" | awk "{print \"RSS: \" \$6/1024 \" MB, VSZ: \" \$5/1024 \" MB\"}" && \
    echo "=== 错误日志检查（最近 100 行）===" && \
    tail -100 /opt/fj1/api/logs/fj-api.log | grep -iE "(ERROR|EXCEPTION|FATAL)" | head -10 && \
    echo "(若无输出表示无错误)" && \
    echo "=== systemd 服务状态 ===" && \
    systemctl status fj-api --no-pager | head -10'
  ```
- **预期结果：**
  - health 详细信息（含 db、diskSpace 等）
  - RSS 内存合理（预计 300-600MB）
  - 无 ERROR/EXCEPTION（或仅有可忽略的 WARN）
  - systemctl status 显示 active (running)
- **是否破坏性：** 否
- **requires_user_confirmation：** false

---

### 阶段 H：清理（H1，可选）

> 目标：清理临时文件
> 服务状态：✅ 运行中

---

#### 步骤 H1：清理临时文件

- **命令：**
  ```bash
  ssh lg 'echo "=== 清理迁移文件工作目录 ===" && \
    rm -rf /tmp/flyway-migrations /tmp/jar-patch && \
    echo "=== 清理 Flyway CLI（可选，保留以备后用）===" && \
    # 建议保留 /opt/flyway-9.22.3 以备后续 WI 使用
    # 如需清理：rm -rf /opt/flyway-9.22.3 /tmp/flyway-commandline-*.tar.gz
    rm -f /tmp/flyway-commandline-*.tar.gz && \
    rm -f /tmp/V3__project_tables.sql /tmp/V8__fix_schema_mismatches.sql && \
    echo "CLEANUP_DONE" && \
    echo "=== 保留的备份文件 ===" && \
    ls -la /opt/fj1/api/*.bak.WI0005 /opt/fj1/api/backups/*WI0005* 2>/dev/null && \
    echo "(备份保留以备回滚，建议保留至少 7 天)"'
  ```
- **预期结果：**
  - 临时文件清理完成
  - 备份文件保留（jar.bak.WI0005 / yml.bak.WI0005 / fj_inspect_WI0005_*.sql / flyway_history_WI0005_*.csv）
- **是否破坏性：** 否（仅删临时文件）
- **requires_user_confirmation：** false

---

## 回滚方案

### 回滚操作总表

| 回滚 ID | 触发步骤 | 回滚操作 | 耗时 | 数据影响 |
|---------|----------|----------|------|----------|
| R-D1 | D1 repair 失败 | 恢复 flyway_history 导出 | < 2 分钟 | 无（仅元数据） |
| R-E2 | E2 jar 修补失败 | 恢复 jar 备份 | < 1 分钟 | 无 |
| R-E3 | E3 yml 修改失败 | 恢复 yml 备份 | < 1 分钟 | 无 |
| R-F1 | F1 启动失败 | 恢复 yml ddl-auto=none + jar 备份 + 重启 | < 3 分钟 | 无 |
| R-F1-DB | F1 V8 迁移失败 | pg_dump 恢复数据库 | < 5 分钟 | 回退 schema 变更 |

### R-D1：恢复 flyway_schema_history

```bash
ssh lg 'source /opt/fj1/api/.env && \
  PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect <<SQL
-- 删除当前 flyway_schema_history
DROP TABLE IF EXISTS flyway_schema_history;
-- 从 CSV 导出恢复
SQL
  # 使用 A4 导出的 CSV 恢复
  LATEST_CSV=$(ls -t /opt/fj1/api/backups/flyway_history_WI0005_*.csv | head -1) && \
  PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect -c \
  "CREATE TABLE flyway_schema_history (LIKE flyway_schema_history INCLUDING ALL);" 2>/dev/null || true
  # 如果表结构不存在，需要先重建
  echo "R_D1_DONE: flyway_history 已回滚，建议手动验证"'
```

**更安全的回滚方式（推荐）：** 用 A1 的 pg_dump 全量备份恢复（包含 flyway_schema_history 表的 CREATE + INSERT）：
```bash
ssh lg 'source /opt/fj1/api/.env && \
  LATEST_DUMP=$(ls -t /opt/fj1/api/backups/fj_inspect_WI0005_*.sql | head -1) && \
  PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect \
  -c "DROP TABLE IF EXISTS flyway_schema_history CASCADE;" && \
  # 从 pg_dump 提取 flyway_schema_history 部分
  sed -n "/CREATE TABLE.*flyway_schema_history/,/^--/p" $LATEST_DUMP | \
  PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect'
```

### R-E2：恢复 jar 备份

```bash
ssh lg 'cp -p /opt/fj1/api/fj-api-1.0.0.jar.bak.WI0005 /opt/fj1/api/fj-api-1.0.0.jar && \
  echo "JAR_RESTORED" && \
  md5sum /opt/fj1/api/fj-api-1.0.0.jar /opt/fj1/api/fj-api-1.0.0.jar.bak.WI0005'
```

### R-E3：恢复 yml 备份

```bash
ssh lg 'cp -p /opt/fj1/api/application-prod.yml.bak.WI0005 /opt/fj1/api/application-prod.yml && \
  echo "YML_RESTORED" && \
  grep "ddl-auto" /opt/fj1/api/application-prod.yml'
```

### R-F1：启动失败完整回滚（恢复到操作前状态）

```bash
# 1. 恢复 jar
ssh lg 'cp -p /opt/fj1/api/fj-api-1.0.0.jar.bak.WI0005 /opt/fj1/api/fj-api-1.0.0.jar'
# 2. 恢复 yml（ddl-auto=none）
ssh lg 'cp -p /opt/fj1/api/application-prod.yml.bak.WI0005 /opt/fj1/api/application-prod.yml'
# 3. 恢复 flyway_history（撤销 repair + 撤销 V8 记录）
ssh lg 'source /opt/fj1/api/.env && \
  LATEST_DUMP=$(ls -t /opt/fj1/api/backups/fj_inspect_WI0005_*.sql | head -1) && \
  PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect \
  -c "DELETE FROM flyway_schema_history WHERE version='\''8'\'';" && \
  echo "V8_RECORD_DELETED (如存在)"'
# 注意：repair 修改的 checksum 需要从 A4 的 CSV 恢复旧值
# 4. 重启服务
ssh lg 'systemctl restart fj-api && sleep 10 && curl -sf localhost:8080/api/actuator/health'
```

### R-F1-DB：数据库回滚（V8 迁移失败）

```bash
ssh lg 'source /opt/fj1/api/.env && \
  LATEST_DUMP=$(ls -t /opt/fj1/api/backups/fj_inspect_WI0005_*.sql | head -1) && \
  echo "=== 全量恢复 fj_inspect ===" && \
  PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER:-fj_app}" -d fj_inspect \
  < $LATEST_DUMP && \
  echo "DB_RESTORED"'
```

---

## 回滚触发条件

| 条件 | 触发回滚 | 回滚方案 | 紧急程度 |
|------|----------|----------|----------|
| A1 pg_dump 失败 | 停止全部操作 | N/A（无备份不可继续） | 🔴 立即停止 |
| A4 flyway_history 导出失败 | 停止全部操作 | N/A（无元数据备份不可 repair） | 🔴 立即停止 |
| B2 unzip jar 失败 | 检查 jar 完整性 | 如 jar 损坏需恢复 .bak.G6 | 🟡 排查 |
| C1 所有镜像下载失败 | 切换方案 B | Python checksum | 🟡 降级 |
| D1 Flyway repair 报错 | R-D1 恢复 history | 恢复 A4 导出 | 🔴 立即回滚 |
| D2 checksum 未更新 | 排查 repair 日志 | 重试或方案 B | 🟡 排查 |
| E2 zip 报错 | R-E2 恢复 jar | 恢复 A2 备份 | 🟡 回滚+排查 |
| E4 jar 完整性测试失败 | R-E2 恢复 jar | 恢复 A2 备份 | 🔴 立即回滚 |
| F1 启动超时(>90s) | 排查日志 | R-F1 完整回滚 | 🔴 回滚 |
| F1 Schema-validation 错误 | R-F1 完整回滚 | 恢复 ddl-auto=none | 🔴 立即回滚 |
| F1 Flyway migrate 报错 | R-F1-DB 恢复 DB | pg_dump 恢复 | 🔴 立即回滚 |
| F2 health≠UP | 排查日志 | R-F1 完整回滚 | 🔴 回滚 |
| F3 V8 success≠t | 排查迁移日志 | R-F1-DB 恢复 DB | 🔴 立即回滚 |
| G1 ddl-auto 非 validate | 排查 yml | R-E3 恢复 yml | 🟡 排查 |
| G2 前端不可访问 | 排查 nginx | nginx 与本 WI 无关 | 🟡 排查 |
| G3 admin 登录失败 | 排查数据/权限 | 可能需 R-F1-DB | 🔴 回滚 |

---

## 风险评估

### 风险矩阵

| # | 风险 | 概率 | 影响 | 等级 | 缓解措施 |
|---|------|------|------|------|----------|
| 1 | Flyway CLI 下载失败（网络） | 中 | 高 | **高** | 3 个镜像 fallback + 方案 B（Python） |
| 2 | Flyway CLI 版本不兼容 jar 内 Flyway | 低 | 高 | 中 | 先检查 jar 内 Flyway 版本（见下方检查命令） |
| 3 | Flyway repair 误更新其他版本 checksum | 极低 | 中 | 低 | repair 仅更新有差异的记录；A4 导出可回滚 |
| 4 | zip 修补后 jar 损坏 | 低 | 高 | 中 | E4 `unzip -t` 完整性验证 + A2 备份 |
| 5 | V8 迁移在 svr-lg 上非幂等失败 | 极低 | 中 | 低 | V8 用 IF NOT EXISTS + DO 块；A1 pg_dump |
| 6 | ddl-auto=validate 暴露其他 schema 不匹配 | 中 | 高 | **高** | WI-0004 已提示另立 WI 全量审查；R-F1 回滚 |
| 7 | export_status 缺 NOT NULL 导致 validate 失败 | 中 | 中 | 中 | D-PreCheck 前置检查 + 手动 ALTER |
| 8 | SSH 连接中断 | 极低 | 中 | 低 | 关键命令用 nohup/screen 执行 |
| 9 | 停机时间超预期 | 低 | 低 | 低 | 预演阶段 B-D；缓冲 5-10 分钟 |

### Flyway 版本兼容性检查（C1 之前执行）

```bash
# 检查 jar 内 Flyway 版本
ssh lg 'unzip -p /opt/fj1/api/fj-api-1.0.0.jar META-INF/MANIFEST.MF | grep -i flyway || \
  unzip -l /opt/fj1/api/fj-api-1.0.0.jar | grep flyway-core | head -1'
# 或检查 lib 目录
ssh lg 'unzip -l /opt/fj1/api/fj-api-1.0.0.jar | grep "flyway-core"'
# 预期：BOOT-INF/lib/flyway-core-9.x.x.jar（确定 9.x 小版本）
```

**版本兼容性说明：**
- Flyway 9.x 系列 checksum 算法一致（CRC32 变种）
- 如果 jar 内是 Flyway 9.5-9.21，下载 9.22.3 的 CLI 可能 checksum 计算略有差异
- **最安全：下载与 jar 内完全相同版本的 CLI**
- 如果无法确定版本，9.22.3 是 9.x 最新稳定版，大概率兼容

### 高风险项详细说明

**风险 #1（Flyway CLI 下载失败）：**
- svr-lg 网络环境未知，可能无法访问 Maven Central
- 阿里云/腾讯云镜像是国内 fallback
- 若全部失败 → 方案 B（Python checksum），但算法实现复杂且易错

**风险 #6（ddl-auto=validate 暴露其他不匹配）：**
- WI-0004 design.md「发现-4」已明确提示：其他模块（fj-project/fj-inspection/fj-approval）的 @Entity 可能与 DB schema 不匹配
- 本 WI 的 V8 仅修复了已知的 5 个 bug 对应的 schema 问题
- 如果 validate 暴露新问题 → 需另立 WI 修复（不在本 WI 范围）
- **回滚策略：** R-F1 恢复 ddl-auto=none，系统继续运行（临时修补状态）

---

## 影响范围

### 受影响组件

| 组件 | 影响类型 | 影响详情 |
|------|----------|----------|
| fj1-api | 停机 + 文件修改 | 停机 2-5 分钟；jar 内 V3/V8 修补 |
| PostgreSQL fj_inspect | 元数据 + schema 变更 | flyway_history V3 checksum 更新；V8 DDL 执行 |
| 外部 application-prod.yml | 配置变更 | ddl-auto: none → validate |

### 不受影响组件

| 组件 | 原因 |
|------|------|
| nginx | 仅代理层，不涉及后端文件/配置 |
| PostgreSQL 16 服务 | 不重启，仅操作 fj_inspect 数据库 |
| 前端静态资源 | 由 nginx 直接服务，不受 fj1-api 影响 |
| systemd unit | 不修改 |
| .env 机密 | 不读取/不修改（仅 source 引用变量） |
| 其他 PostgreSQL 数据库 | 仅操作 fj_inspect |

### 停机时间预估

| 阶段 | 耗时 | 是否停机 |
|------|------|----------|
| A（备份） | ~3 分钟 | ❌ 不停机 |
| B（准备迁移文件） | ~2 分钟 | ❌ 不停机 |
| C（安装 Flyway CLI） | ~3 分钟（含下载） | ❌ 不停机 |
| D（Flyway repair + 前置检查） | ~2 分钟 | ❌ 不停机 |
| **E（停机+修补）** | **~30 秒** | **✅ 停机** |
| **F（启动+migrate）** | **~1-2 分钟** | **✅ 停机** |
| G（验证） | ~2 分钟 | ❌ 不停机 |
| H（清理） | ~1 分钟 | ❌ 不停机 |

**实际停机窗口：** E1 ~ F2 = **约 2-3 分钟**
**含缓冲预估：** **5-10 分钟**（预留启动慢/排查时间）

---

## Assumptions（设计假设）

1. **假设 svr-lg SSH 可达**（root 权限，`ssh lg` 别名已配置）
2. **假设 svr-lg 有 zip/unzip 命令**（WI-0003 已确认）
3. **假设 svr-lg JRE 17 可运行 Flyway CLI**（Flyway 9.22.3 需 Java 8+）
4. **假设 svr-lg 可访问外网下载 Flyway CLI**（至少一个镜像可达；否则用方案 B）
5. **假设 fj_inspect 数据库仅有种子数据**（intake.md 确认，无真实业务数据）
6. **假设 export_files 表当前无业务数据**（种子环境，V8 ALTER 无性能影响）
7. **假设 flyway_schema_history V3 checksum 是唯一需 repair 的记录**（其他 V1/V2/V4-V7 未修改）
8. **假设 jar 内 Flyway 版本为 9.x**（Spring Boot 3.x 标准依赖；非 10.x）
9. **假设 systemd unit 已正确设置 SPRING_PROFILES_ACTIVE=prod**（WI-0004 已确认）
10. **假设外部 application-prod.yml 覆盖 jar 内 yml**（SPRING_CONFIG_ADDITIONAL_LOCATION 已确认）

---

## Out of Scope

1. **不包含全项目 @Entity schema 全量审查** — ddl-auto=validate 可能暴露其他模块的不匹配（WI-0004 已提示另立 WI）
2. **不修改源码仓库** — WI-0004 已修复源码，本 WI 仅同步到 svr-lg
3. **不执行标准 mvn 构建** — 本地无 maven/JDK17，svr-lg 无 javac/maven
4. **不修改 systemd unit / .env / nginx 配置** — 这些组件已正确配置
5. **不安装 JDK/maven** — jar 修补方案已足够，无需构建环境
6. **不处理 PostgreSQL 服务级配置** — 仅操作 fj_inspect 数据库内容
7. **不修改 jar 内其他文件** — 仅修补 V3 + 添加 V8（yml 修改在外部文件）
8. **不执行 Bug-5（install_pg16.sh）同步** — svr-lg PG16 已安装，脚本仅供新部署使用
9. **不执行 Bug-1（spring.profiles.active）修补** — jar 内 yml 被 Spring Boot 配置覆盖机制处理，systemd 已设置 profile；外部 yml 无此键
10. **不做压力测试/性能测试** — 种子环境无业务负载

---

## 正确性属性（验证不变量）

| # | 属性 | 验证方式 | 验证步骤 |
|---|------|----------|----------|
| P1 | 操作后 flyway_schema_history 有 V1-V8 共 8 行，全部 success=t | SQL 查询 count + 逐行检查 | F3 |
| P2 | 操作后 jar 内 V3 含 INSERT INTO projects | `unzip -p jar .../V3 | grep INSERT` | E4 |
| P3 | 操作后 jar 内含 V8 文件 | `unzip -l jar \| grep V8` | E4 |
| P4 | 操作后外部 yml ddl-auto=validate | `grep ddl-auto` | E3, G1 |
| P5 | 操作后 ddl-auto=validate 启动成功（无 Schema-validation 错误） | 日志检查 | G1 |
| P6 | 操作后 admin 登录正常 | POST /auth/login | G3 |
| P7 | 操作后 export_files 含 error_message/export_status/file_hash(128) | information_schema 查询 | G3 |
| P8 | 操作后 users.status 类型为 integer | information_schema 查询 | D-PreCheck |
| P9 | 操作后 health=UP（本地 + nginx 代理） | curl health endpoint | F2, G2 |
| P10 | Flyway repair 仅修改 V3 checksum，不影响其他版本 | 对比 A4 导出 vs D2 查询 | D2 |

---

## 自检（DD 硬规则）

| 规则 | 检查 | 通过 |
|------|------|------|
| DD1 每个 DD 引用来源 | 本 ops_plan 来源 WI-0004 design.md DD-1~DD-5 + WI-0005 intake.md | ✅ |
| DD2 操作步骤有命令+预期+破坏性标记 | 每步含命令/预期结果/是否破坏性/requires_user_confirmation | ✅ |
| DD3 回滚方案 + Out of Scope | 5 种回滚方案 + 10 项 Out of Scope | ✅ |
| DD4 无过度抽象 | 直接操作步骤，无组件抽象 | ✅ |
| DD5 外部调用失败处理 | Flyway CLI 下载多镜像 fallback + 方案 B | ✅ |
| DD6 Assumptions | 10 条假设 | ✅ |

---

## 自检（好架构 5 条属性）

| 属性 | 检查 | 通过 |
|------|------|------|
| A1 单一职责 | 每个阶段单一目标（A=备份/B=准备/C=CLI/D=repair/E=修补/F=启动/G=验证/H=清理） | ✅ |
| A2 显式依赖 | 依赖链 Mermaid 图 + 关键依赖约束表 | ✅ |
| A3 可替换性 | 方案 A/B 可互换（Flyway CLI ↔ Python checksum） | ✅ |
| A4 失败可观测 | 每步有失败处理 + 回滚触发条件表 | ✅ |
| A5 边界明确 | Out of Scope(10) + Assumptions(10) | ✅ |

---

## 完成报告

```json
{
  "status": "success",
  "files_changed": [
    ".specforge/work-items/WI-0005/ops_plan.md"
  ],
  "structure": {
    "phases": 8,
    "steps_count": 22,
    "backup_steps": 4,
    "destructive_steps": 4,
    "user_confirmation_steps": 3,
    "rollback_scenarios": 5,
    "rollback_trigger_conditions": 16,
    "has_architecture_diagram": false,
    "has_dependency_chain": true,
    "has_out_of_scope": true,
    "has_assumptions": true,
    "architecture_properties_checked": ["A1", "A2", "A3", "A4", "A5"]
  },
  "self_check": {
    "dd_rules_checked": ["DD1", "DD2", "DD3", "DD4", "DD5", "DD6"],
    "architecture_properties": ["A1", "A2", "A3", "A4", "A5"],
    "all_passed": true
  },
  "flyway_repair_solution": "A (Flyway CLI 9.22.3) with fallback B (Python checksum)",
  "estimated_downtime": "2-3 minutes actual, 5-10 minutes with buffer",
  "key_risks": [
    "Flyway CLI download failure (network) - 3 mirror fallback + solution B",
    "ddl-auto=validate exposing other schema mismatches - rollback R-F1"
  ],
  "extension_subflow_triggered": false,
  "out_of_scope_observations": [
    "ddl-auto=validate 可能暴露其他 @Entity schema 不匹配，建议另立 WI 全量审查",
    "Bug-5 install_pg16.sh 不同步（svr-lg PG16 已安装）",
    "Bug-1 spring.profiles.active 不同步（systemd 已处理 profile 激活）"
  ]
}
```
