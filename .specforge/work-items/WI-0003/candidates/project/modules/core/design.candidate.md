# WI-0003 Ops Plan — fj1 飞检系统首次部署到 svr-lg

> **Work Item**: WI-0003
> **Workflow**: ops_task / task_change_path
> **产物类型**: design (ops_plan.md)
> **生成时间**: 2026-07-02
> **执行服务器**: svr-lg (内网 10.0.12.12, `ssh lg` 登录为 root)
> **标准依据**: specforge_final_fused_standard_v1_1_patch1_zh.md

---

## 操作目标

将 WI-0001/WI-0002 完成的 fj1 飞检现场管理系统（Java 17 + Spring Boot 后端 + React Web 前端）**首次部署**到生产服务器 svr-lg，实现端到端可用：

1. **后端**：fat jar `fj-api-1.0.0.jar` (78M) 部署到 `/opt/fj1/api/`，systemd 服务 `fj1-api.service` 托管，Flyway V1-V7 首次迁移，Spring Boot 监听 8080 端口，`/api/actuator/health` 返回 UP。
2. **前端**：`fj-web/dist/` 静态托管到 `/opt/fj1/web/`，Nginx 反代同域分发。
3. **全链路**：`http://10.0.12.12/` → React SPA；`http://10.0.12.12/api/` → SpringBoot:8080。
4. **旧系统处理**：旧版 NestJS 飞检系统（PM2 `fj-server`）停用替换，旧数据/文件完整备份后清理。
5. **基础设施升级**：PG13 → 全新安装 PG16；安装 JRE17 headless。

### 命名变更映射（D2 决策，必须严格遵守）

| 旧 | 新 |
|----|-----|
| `/opt/fj/api/` | `/opt/fj1/api/` |
| `/opt/fj/web/` (新前端) | `/opt/fj1/web/` |
| 系统用户 `fj` | `fj1` |
| systemd `fj-api.service` | `fj1-api.service` |
| Nginx `fj.conf` | `fj1.conf` |
| DB 用户 `fj_app` | `fj1_app` |
| DB 库名 `fj_inspect` | `fj1_inspect` |
| jar 名 `fj-api.jar` (systemd 引用) | `fj-api-1.0.0.jar` |

### 用户决策摘要

| 决策 | 内容 |
|------|------|
| D1 | 旧系统停用替换 |
| D2 | 命名 fj → fj1 全部变更 |
| D3 | /opt/fj/ 备份后清理，新系统部署到 /opt/fj1/ |
| D4 | PG13 数据先备份再销毁 |
| D5 | 后端 + 前端一起部署 |

---

## 前置条件

### P1 执行环境就绪
- `ssh lg` 可登录到 svr-lg 且为 root 权限（命令无需 `sudo` 前缀）。
- 服务器在线：OS CentOS Stream 9, 内网 10.0.12.12。
- 可用资源满足：RAM available ≥ 2.0GB, 磁盘 ≥ 20GB（当前 available 2.3GB / 23GB ✓）。

### P2 产物就绪（构建完成）
- 后端 fat jar：`fj-backend/fj-api/target/fj-api-1.0.0.jar` (78M) ✓
- 前端构建产物：`fj-web/dist/` ✓
- 部署脚本：`scripts/ops/install_pg16.sh`、`install_jre17.sh`、`init_database.sh` ✓
- 部署配置：`deploy/systemd/fj-api.service`、`deploy/config/application-prod.yml`、`deploy/config/.env.template` ✓

### P3 密钥准备（仅存在于服务器 .env，不写入本文件）
- `DB_PASSWORD`：用户提供值（标注"见服务器 /opt/fj1/api/.env"）。
- `JWT_SECRET`：Agent 生成值（标注"见服务器 /opt/fj1/api/.env"）。
- `DB_USER=fj1_app`，`CORS_ALLOWED_ORIGINS=http://10.0.12.12`。

> ⚠️ **密钥纪律**：本 ops_plan.md 不包含任何明文密码/JWT_SECRET。所有密钥仅写入服务器 `/opt/fj1/api/.env`（chmod 600）。

### P4 待调整的脚本/配置（执行时覆盖，不改原文件）
| 文件 | 需调整项 | 调整方式 |
|------|---------|---------|
| `scripts/ops/init_database.sh` | `DB_NAME="fj_inspect"`、`DB_USER="fj_app"` | 执行时改为 `fj1_inspect` / `fj1_app`（运行时覆盖或拷贝调整版） |
| `deploy/systemd/fj-api.service` | `User=fj`、`WorkingDirectory=/opt/fj/api`、`ExecStart ... fj-api.jar`、`HeapDumpPath=/opt/fj/api/logs/jvm` | 改为 `User=fj1`、`/opt/fj1/api`、`fj-api-1.0.0.jar`、`/opt/fj1/api/logs/jvm` |
| `deploy/config/application-prod.yml` | datasource.url 含 `fj_inspect`、`DB_USER:fj_app`、`logging.file.name=/opt/fj/api/...` | 改为 `fj1_inspect`、`fj1_app`、`/opt/fj1/api/...` |
| `deploy/config/.env.template` | `DB_USER=fj_app`、`CORS_ALLOWED_ORIGINS` | 改为 `fj1_app`、`http://10.0.12.12` |
| `deploy/nginx/fj.conf` | ⚠️ 完整 nginx.conf 格式（含 worker_processes/events/http 块） | **不使用该文件**；改为创建纯 `server{}` 块放到 `/etc/nginx/conf.d/fj1.conf` |
| `scripts/ops/install_pg16.sh` | 无需改名 | 需 `FJ_DB_PASSWORD` 环境变量；交互确认用 `echo yes \|` 管道喂入 |
| `scripts/ops/install_jre17.sh` | 无需改名 | 有 3 秒 sleep（非交互可直接执行） |

### P5 旧系统已知状态
- PM2 `fj-server`: online 28D, pid 2467114, 占内存 137.8MB, 端口 3000。
- `/opt/fj/`: NestJS 后端 + 旧前端 + uploads。
- Nginx `/etc/nginx/conf.d/fj.conf`: 纯 server{} 块，反代 127.0.0.1:3000。
- PG13: active, postgres 密码未知，`psql -l` 失败 → 备份采用文件级 cp（先停 PG13 服务）。

---

## 操作步骤

> **执行协议（fail-stop）**：每个步骤执行后必须验证"预期结果"。任一步骤失败立即停止，进入对应回滚方案，禁止跳过失败步骤继续。
> **执行者身份**：`ssh lg` 已为 root，所有命令无 `sudo` 前缀（sf_safe_bash 拦截 sudo，但此处不需要）。
> **变量约定**：`$BK_DATE` = 操作日期 YYYYMMDD（本次 = 20260702）；`$REMOTE` = 本地产物路径。

---

### 阶段 A: 备份旧系统（保护性，破坏性=否）

#### 步骤 A1：PG13 数据文件级备份
- **命令**：
  ```bash
  # 停止 PG13 以获得一致性快照（postgres 密码未知，pg_dump 不可用 → 文件级备份）
  systemctl stop postgresql
  mkdir -p /opt/pg13-backup-20260702
  cp -a /var/lib/pgsql/data /opt/pg13-backup-20260702/data
  # 备份完成后重新启动 PG13（保持旧系统临时可用，直到阶段 B 停用）
  systemctl start postgresql
  ```
- **预期结果**：`/opt/pg13-backup-20260702/data/` 存在且含 `PG_VERSION` 文件（内容应为 13）；PG13 重新 active。
- **是否破坏性**：否（只读拷贝 + 短暂停 PG13 服务）
- **requires_user_confirmation**：true（停 PG13 影响旧系统短暂下线）
- **parallel**：false

#### 步骤 A2：备份 /opt/fj/ 整体
- **命令**：
  ```bash
  mkdir -p /opt/fj-backup-20260702
  cp -a /opt/fj /opt/fj-backup-20260702/fj
  ```
- **预期结果**：`/opt/fj-backup-20260702/fj/` 含 server/、web/、web-build/、uploads/ 子目录。
- **是否破坏性**：否
- **requires_user_confirmation**：true
- **parallel**：false

#### 步骤 A3：备份 Nginx fj.conf
- **命令**：
  ```bash
  cp -p /etc/nginx/conf.d/fj.conf /opt/fj-backup-20260702/nginx-fj.conf
  ```
- **预期结果**：`/opt/fj-backup-20260702/nginx-fj.conf` 存在。
- **是否破坏性**：否
- **requires_user_confirmation**：true
- **parallel**：false

#### 步骤 A4：记录 PM2 进程信息
- **命令**：
  ```bash
  pm2 list > /opt/fj-backup-20260702/pm2-list.txt 2>&1
  pm2 save
  pm2 jlist > /opt/fj-backup-20260702/pm2-dump.json 2>&1
  ```
- **预期结果**：`/opt/fj-backup-20260702/` 下出现 `pm2-list.txt` 和 `pm2-dump.json`；`pm2 save` 输出成功保存。
- **是否破坏性**：否
- **requires_user_confirmation**：true
- **parallel**：false

---

### 阶段 B: 停止旧系统（破坏性=否，confirmation=是）

#### 步骤 B1：停止 PM2 fj-server
- **命令**：
  ```bash
  pm2 stop fj-server
  ```
- **预期结果**：`pm2 list` 中 fj-server 状态变为 `stopped`；端口 3000 释放（`ss -lntp | grep :3000` 无输出）。
- **是否破坏性**：否（可恢复）
- **requires_user_confirmation**：true
- **parallel**：false

#### 步骤 B2：删除 PM2 fj-server 进程
- **命令**：
  ```bash
  pm2 delete fj-server
  ```
- **预期结果**：`pm2 list` 中不再有 fj-server 条目。
- **是否破坏性**：否（pm2-dump.json 已备份，可 `pm2 resurrect` 恢复）
- **requires_user_confirmation**：true
- **parallel**：false

#### 步骤 B3：保存 PM2 状态
- **命令**：
  ```bash
  pm2 save
  ```
- **预期结果**：PM2 保存列表更新（不含 fj-server）；旧系统彻底下线，端口 3000 空闲。
- **是否破坏性**：否
- **requires_user_confirmation**：true
- **parallel**：false

---

### 阶段 C: PG13 → PG16 全新安装（破坏性=是，confirmation=是）

> ⚠️ 本阶段销毁 PG13 数据。前置依赖：阶段 A1 已完成 PG13 文件级备份。

#### 步骤 C1：执行 install_pg16.sh
- **命令**：
  ```bash
  # FJ_DB_PASSWORD 由用户提供，仅存在于执行会话环境变量（不写入 ops_plan）
  export FJ_DB_PASSWORD='<见服务器 .env>'
  echo "yes" | bash scripts/ops/install_pg16.sh
  ```
- **预期结果**：
  - 脚本输出 `PostgreSQL 16 安装与配置完成` 和 `全部步骤完成 ✓`。
  - `systemctl is-active postgresql-16` → `active`。
  - `psql --version` → 显示 `psql (PostgreSQL) 16.x`。
  - PG13 包已卸载，PG16 监听 127.0.0.1:5432。
  - `postgresql.conf`: shared_buffers=512MB, max_connections=50, timezone=Asia/Shanghai。
  - `pg_hba.conf`: local=peer, 127.0.0.1=scram-sha-256。
- **是否破坏性**：**是**（卸载 PG13、销毁旧 PG13 数据目录）
- **requires_user_confirmation**：true
- **parallel**：false

> **脚本行为说明**：install_pg16.sh 内部含 `read -r -p` 交互确认，非交互执行用 `echo "yes" |` 管道喂入。脚本幂等：PG16 已装则跳过安装阶段，配置与服务始终幂等执行。

---

### 阶段 D: JRE17 安装（破坏性=否，confirmation=否）

#### 步骤 D1：执行 install_jre17.sh
- **命令**：
  ```bash
  bash scripts/ops/install_jre17.sh
  ```
- **预期结果**：
  - 脚本输出 java 版本 `openjdk version "17.x.x"`。
  - `java -version` → 17.x。
  - `/etc/profile.d/fj_java_home.sh` 存在（配置 JAVA_HOME + PATH）。
- **是否破坏性**：否（幂等，已装 17 则跳过）
- **requires_user_confirmation**：false
- **parallel**：false

> **脚本行为说明**：install_jre17.sh 有 3 秒 `sleep` 倒计时（非交互可直接执行，无需管道喂入）。脚本幂等：检测到主版本 17 则打印 `JRE 17 already installed` 并退出 0。

---

### 阶段 E: 数据库初始化（破坏性=否，confirmation=否）

> 本步骤基于 `init_database.sh` 逻辑，但 **DB 名/用户改为 fj1**（运行时覆盖硬编码值）。

#### 步骤 E1：创建 fj1_app 用户 + fj1_inspect 库
- **命令**（执行时覆盖 DB_NAME/DB_USER，不在原文件改动）：
  ```bash
  export FJ_DB_PASSWORD='<见服务器 .env>'
  # 直接用调整后的内联命令（基于 init_database.sh 逻辑，DB 名/用户改为 fj1）
  DB_NAME="fj1_inspect"
  DB_USER="fj1_app"
  DB_PASSWORD="$FJ_DB_PASSWORD"

  # 创建用户（幂等：已存在则跳过）
  USER_EXISTS=$(su - postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'\"" 2>/dev/null || echo "0")
  if [ "$USER_EXISTS" != "1" ]; then
    su - postgres -c "psql -c \"CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD'\""
  fi

  # 创建数据库（幂等：已存在则跳过）
  DB_EXISTS=$(su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='$DB_NAME'\"" 2>/dev/null || echo "0")
  if [ "$DB_EXISTS" != "1" ]; then
    su - postgres -c "createdb -O $DB_USER $DB_NAME"
  fi

  # 授予权限（幂等）
  su - postgres -c "psql -d $DB_NAME -c \"GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER\""
  su - postgres -c "psql -d $DB_NAME -c \"GRANT ALL PRIVILEGES ON SCHEMA public TO $DB_USER\""

  # 验证连接
  PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -h 127.0.0.1 -c "SELECT version();"
  ```
- **预期结果**：
  - 用户 `fj1_app` 存在（`\du fj1_app` 返回行）。
  - 数据库 `fj1_inspect` 存在且 owner 为 `fj1_app`（`\l fj1_inspect`）。
  - `psql -U fj1_app -d fj1_inspect -h 127.0.0.1` 连接成功，返回 PG16 版本号。
- **是否破坏性**：否（全新库，无旧数据）
- **requires_user_confirmation**：false
- **parallel**：false

---

### 阶段 F: 服务器目录准备（破坏性=否，confirmation=否）

#### 步骤 F1：创建 fj1 系统用户
- **命令**：
  ```bash
  useradd -r -m -d /opt/fj1 -s /sbin/nologin fj1
  ```
- **预期结果**：`id fj1` 返回 uid/gid；home 目录 `/opt/fj1` 自动创建。
- **是否破坏性**：否（幂等：已存在则 useradd 报错但不影响，可先 `id fj1 || useradd ...`）
- **requires_user_confirmation**：false
- **parallel**：false

> **幂等写法**（推荐）：`id fj1 || useradd -r -m -d /opt/fj1 -s /sbin/nologin fj1`

#### 步骤 F2：创建部署目录结构
- **命令**：
  ```bash
  mkdir -p /opt/fj1/api /opt/fj1/web /opt/fj1/api/logs /data/photos
  ```
- **预期结果**：四个目录均存在（`ls -ld /opt/fj1/api /opt/fj1/web /opt/fj1/api/logs /data/photos`）。
- **是否破坏性**：否
- **requires_user_confirmation**：false
- **parallel**：false

#### 步骤 F3：设置目录属主
- **命令**：
  ```bash
  chown -R fj1:fj1 /opt/fj1
  chown -R fj1:fj1 /data/photos
  ```
- **预期结果**：`ls -ld /opt/fj1 /data/photos` owner 为 `fj1:fj1`。
- **是否破坏性**：否
- **requires_user_confirmation**：false
- **parallel**：false

---

### 阶段 G: 部署后端（破坏性=否，confirmation=是）

> 本地产物路径：`fj-backend/fj-api/target/fj-api-1.0.0.jar`。scp 到服务器后所有后续命令在服务器执行。

#### 步骤 G1：上传 fat jar
- **命令**（本地执行 scp，或服务器侧从构建机拉取）：
  ```bash
  scp fj-backend/fj-api/target/fj-api-1.0.0.jar lg:/opt/fj1/api/fj-api-1.0.0.jar
  ```
- **预期结果**：服务器 `/opt/fj1/api/fj-api-1.0.0.jar` 存在，大小约 78M。
- **是否破坏性**：否
- **requires_user_confirmation**：true
- **parallel**：false

#### 步骤 G2：创建 /opt/fj1/api/.env（密钥文件）
- **命令**（在服务器执行，密钥值见服务器 .env，不在此写明文）：
  ```bash
  cat > /opt/fj1/api/.env <<'EOF'
  # FJ1 API 生产环境变量（chmod 600，不提交 Git）
  JWT_SECRET=<见服务器 .env — Agent 生成值>
  DB_PASSWORD=<见服务器 .env — 用户提供值>
  DB_USER=fj1_app
  CORS_ALLOWED_ORIGINS=http://10.0.12.12
  SPRING_PROFILES_ACTIVE=prod
  EOF
  chmod 600 /opt/fj1/api/.env
  chown fj1:fj1 /opt/fj1/api/.env
  ```
- **预期结果**：`/opt/fj1/api/.env` 存在，权限 `-rw-------`（600），owner fj1:fj1。
- **是否破坏性**：否
- **requires_user_confirmation**：true（涉及密钥写入）
- **parallel**：false

> ⚠️ **密钥纪律**：`<见服务器 .env>` 占位符表示真实值仅写入服务器，不进入本 ops_plan.md、不进入 Git。

#### 步骤 G3：创建调整后的 application-prod.yml
- **命令**（基于 `deploy/config/application-prod.yml`，调整 3 处：fj_inspect→fj1_inspect, fj_app→fj1_app, 日志路径 /opt/fj→/opt/fj1）：
  ```bash
  cat > /opt/fj1/api/application-prod.yml <<'EOF'
  server:
    port: 8080
    servlet:
      context-path: /api

  spring:
    profiles:
      active: prod
    datasource:
      url: jdbc:postgresql://127.0.0.1:5432/fj1_inspect
      username: ${DB_USER:fj1_app}
      password: ${DB_PASSWORD}
      driver-class-name: org.postgresql.Driver
      hikari:
        maximum-pool-size: 10
        minimum-idle: 2
        connection-timeout: 30000
        idle-timeout: 600000
        max-lifetime: 1800000
    flyway:
      enabled: true
      locations: classpath:db/migration
      baseline-on-migrate: true
      baseline-version: 0
      validate-on-migrate: true
    jpa:
      hibernate:
        ddl-auto: validate
      properties:
        hibernate:
          dialect: org.hibernate.dialect.PostgreSQLDialect
      open-in-view: false
    jackson:
      default-property-inclusion: non_null
      date-format: yyyy-MM-dd HH:mm:ss
      time-zone: Asia/Shanghai
    servlet:
      multipart:
        max-file-size: 15MB
        max-request-size: 15MB

  fj:
    security:
      jwt:
        secret: ${JWT_SECRET}
        expire-minutes: 30
        refresh-expire-days: 7
      cors:
        allowed-origins: ${CORS_ALLOWED_ORIGINS}
        allow-credentials: true
    cache:
      caffeine:
        expire-minutes: 30
        max-size: 10000
    export:
      template-fallback: false

  logging:
    level:
      root: INFO
      com.fj: INFO
      org.hibernate.SQL: WARN
    file:
      name: /opt/fj1/api/logs/fj-api.log

  management:
    endpoints:
      web:
        exposure:
          include: health,info
    endpoint:
      health:
        show-details: when-authorized
  EOF
  chown fj1:fj1 /opt/fj1/api/application-prod.yml
  ```
- **预期结果**：`/opt/fj1/api/application-prod.yml` 存在；`grep fj1_inspect` 命中 datasource.url；`grep fj1_app` 命中 username；`grep /opt/fj1/api/logs` 命中 logging.file.name。
- **是否破坏性**：否
- **requires_user_confirmation**：true
- **parallel**：false

#### 步骤 G4：安装调整后的 systemd 服务 fj1-api.service
- **命令**（基于 `deploy/systemd/fj-api.service`，调整 User=fj1、路径 /opt/fj1、jar 名 fj-api-1.0.0.jar、HeapDumpPath /opt/fj1）：
  ```bash
  cat > /etc/systemd/system/fj1-api.service <<'EOF'
  [Unit]
  Description=FJ1 Inspection Site Management System API
  After=network.target postgresql-16.service
  Wants=postgresql-16.service

  [Service]
  Type=simple
  User=fj1
  Group=fj1
  WorkingDirectory=/opt/fj1/api

  EnvironmentFile=/opt/fj1/api/.env

  Environment="JAVA_OPTS=-Xms512m -Xmx768m -XX:MetaspaceSize=128m -XX:MaxMetaspaceSize=192m -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/opt/fj1/api/logs/jvm"

  Environment="SPRING_PROFILES_ACTIVE=prod"
  Environment="SPRING_CONFIG_ADDITIONAL_LOCATION=/opt/fj1/api/"

  ExecStart=/usr/bin/java $JAVA_OPTS -jar /opt/fj1/api/fj-api-1.0.0.jar
  ExecStop=/bin/kill -TERM $MAINPID

  Restart=on-failure
  RestartSec=10
  StartLimitBurst=3
  StartLimitIntervalSec=60

  TimeoutStartSec=90

  StandardOutput=journal
  StandardError=journal
  SyslogIdentifier=fj1-api

  NoNewPrivileges=true
  PrivateTmp=true

  [Install]
  WantedBy=multi-user.target
  EOF
  ```
- **预期结果**：`/etc/systemd/system/fj1-api.service` 存在；`grep 'User=fj1'`、`grep '/opt/fj1/api/fj-api-1.0.0.jar'`、`grep 'HeapDumpPath=/opt/fj1'` 均命中。
- **是否破坏性**：否
- **requires_user_confirmation**：true
- **parallel**：false

> **JVM 参数说明**（3.6GB RAM 调优）：`-Xms512m -Xmx768m`（堆 512-768MB）+ MetaspaceSize 128-192m + G1GC + MaxGCPauseMillis=200 + HeapDumpOnOutOfMemoryError。与 PG16 shared_buffers=512MB 合计约 1.3GB，available 2.3GB 可承载。

#### 步骤 G5：加载并启用 systemd 服务
- **命令**：
  ```bash
  systemctl daemon-reload
  systemctl enable fj1-api.service
  ```
- **预期结果**：`systemctl is-enabled fj1-api` → `enabled`；无报错。
- **是否破坏性**：否
- **requires_user_confirmation**：true
- **parallel**：false

#### 步骤 G6：启动 fj1-api（触发 Flyway V1-V7 首次迁移）
- **命令**：
  ```bash
  systemctl start fj1-api.service
  # 等待启动 + Flyway 迁移（首次较慢）
  sleep 30
  systemctl status fj1-api.service --no-pager
  journalctl -u fj1-api.service -n 100 --no-pager
  ```
- **预期结果**：
  - `systemctl is-active fj1-api` → `active (running)`。
  - journalctl 日志含 `Successfully applied 7 migrations`（Flyway V1-V7）或 `Migrating schema ... to version "7 - ..."`。
  - 日志无 `ERROR`、无 `Migration failed`、无 `OutOfMemoryError`。
  - `ss -lntp | grep :8080` → java 进程监听 8080。
- **是否破坏性**：否（首次启动，全新库）
- **requires_user_confirmation**：true
- **parallel**：false

> ⚠️ **关键监控点**：Flyway V1-V7 任何一个报错 = 启动失败，立即进入回滚。检查 `journalctl -u fj1-api | grep -iE 'flyway|error|exception'`。

---

### 阶段 H: 部署前端 + Nginx（破坏性=是，confirmation=是）

> ⚠️ Nginx 配置变更影响线上流量（当前 Nginx 服务旧系统，阶段 B 已停旧系统，此刻 80 端口返回旧前端但 API 已断）。

#### 步骤 H1：上传前端构建产物
- **命令**（本地 scp）：
  ```bash
  scp -r fj-web/dist/* lg:/opt/fj1/web/
  ```
- **预期结果**：服务器 `/opt/fj1/web/index.html` 存在；`/opt/fj1/web/` 含 assets/ 等静态资源。
- **是否破坏性**：否
- **requires_user_confirmation**：true
- **parallel**：false

#### 步骤 H2：移除旧 Nginx fj.conf
- **命令**：
  ```bash
  # 先备份（阶段 A3 已备份到 /opt/fj-backup，此处移除启用）
  mv /etc/nginx/conf.d/fj.conf /opt/fj-backup-20260702/nginx-fj.conf.removed
  ```
- **预期结果**：`/etc/nginx/conf.d/fj.conf` 不存在（已移走）。
- **是否破坏性**：是（旧系统 Nginx 配置下线，但阶段 B 已停旧后端，影响可控）
- **requires_user_confirmation**：true
- **parallel**：false

#### 步骤 H3：创建 /etc/nginx/conf.d/fj1.conf（纯 server{} 块）
- **命令**（⚠️ **不使用 deploy/nginx/fj.conf 的完整 nginx.conf 格式**；创建纯 server{} 块，由 nginx.conf 的 http{} include）：
  ```bash
  cat > /etc/nginx/conf.d/fj1.conf <<'EOF'
  # FJ1 飞检系统 — Nginx server 块（由 /etc/nginx/nginx.conf 的 http{} include）
  # 命名变更：fj.conf → fj1.conf

  upstream fj1_backend {
      server 127.0.0.1:8080;
      keepalive 16;
  }

  server {
      listen 80;
      server_name _;

      # 照片分片上传支持 15MB
      client_max_body_size 15m;

      # Web 前端静态资源（命名变更 /opt/fj/web → /opt/fj1/web）
      root /opt/fj1/web;
      index index.html;

      # SPA 路由 — 前端路由回退到 index.html
      location / {
          try_files $uri $uri/ /index.html;
      }

      # API 反向代理 → SpringBoot:8080
      location /api/ {
          proxy_pass http://fj1_backend;
          proxy_http_version 1.1;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
          proxy_connect_timeout 30s;
          proxy_send_timeout 120s;
          proxy_read_timeout 120s;
      }

      # 照片内部重定向 — X-Accel-Redirect（Java 不读大文件到内存）
      location /internal/photos/ {
          internal;
          alias /data/photos/;
      }

      # 静态资源缓存
      location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
          expires 30d;
          add_header Cache-Control "public, immutable";
      }

      # 健康检查端点
      location /api/actuator/health {
          proxy_pass http://fj1_backend;
          access_log off;
      }
  }
  EOF
  ```
- **预期结果**：`/etc/nginx/conf.d/fj1.conf` 存在；`grep '/opt/fj1/web'`、`grep 'fj1_backend'`、`grep '127.0.0.1:8080'` 均命中；文件**不含** `worker_processes`/`events{`/`http{` 顶层指令（纯 server{} 块）。
- **是否破坏性**：否
- **requires_user_confirmation**：true
- **parallel**：false

> ⚠️ **格式冲突说明**：`deploy/nginx/fj.conf` 是完整 nginx.conf 格式（含 worker_processes/events/http 块），**直接放到 /etc/nginx/conf.d/ 会导致指令重复冲突**（worker_processes/http 已在主 nginx.conf 定义）。因此本步骤创建纯 server{} 块版本。

#### 步骤 H4：测试并重载 Nginx
- **命令**：
  ```bash
  nginx -t
  systemctl reload nginx
  ```
- **预期结果**：
  - `nginx -t` 输出 `syntax is ok` 和 `test is successful`。
  - `systemctl reload nginx` 无报错。
  - `curl -I http://10.0.12.12/` → HTTP 200，Content-Type: text/html。
- **是否破坏性**：是（线上 Nginx 配置生效）
- **requires_user_confirmation**：true
- **parallel**：false

---

### 阶段 I: 验证（破坏性=否，confirmation=否）

#### 步骤 I1：后端直连健康检查
- **命令**：
  ```bash
  curl -s http://localhost:8080/api/actuator/health
  ```
- **预期结果**：返回 `{"status":"UP"}`。
- **是否破坏性**：否
- **requires_user_confirmation**：false
- **parallel**：false

#### 步骤 I2：前端页面访问
- **命令**：
  ```bash
  curl -s http://10.0.12.12/ | head -20
  ```
- **预期结果**：返回 HTML，含 `<div id="root">` 或 React SPA 入口标记。
- **是否破坏性**：否
- **requires_user_confirmation**：false
- **parallel**：false

#### 步骤 I3：全链路 API 健康检查（经 Nginx）
- **命令**：
  ```bash
  curl -s http://10.0.12.12/api/actuator/health
  ```
- **预期结果**：返回 `{"status":"UP"}`（证明 Nginx → SpringBoot:8080 反代通）。
- **是否破坏性**：否
- **requires_user_confirmation**：false
- **parallel**：false

#### 步骤 I4：内存检查（防 OOM）
- **命令**：
  ```bash
  free -h
  ```
- **预期结果**：available ≥ 500MB；无 OOM；`dmesg | grep -i 'killed process'` 无 java 被杀记录。
- **是否破坏性**：否
- **requires_user_confirmation**：false
- **parallel**：false

#### 步骤 I5：服务日志检查
- **命令**：
  ```bash
  journalctl -u fj1-api.service --since "10 min ago" --no-pager | grep -iE 'error|exception|warn' | head -20
  ```
- **预期结果**：无 ERROR / Exception；WARN 可接受（如 Hibernate 提示）但需人工 review。
- **是否破坏性**：否
- **requires_user_confirmation**：false
- **parallel**：false

---

## 回滚方案

### 总原则
- **优先回滚到备份点**：阶段 A 已备份 PG13 数据（`/opt/pg13-backup-20260702/`）、旧系统文件（`/opt/fj-backup-20260702/`）、Nginx 配置、PM2 dump。
- **破坏性步骤必须可回滚**：阶段 C（PG）、阶段 H（Nginx）有专属回滚。
- **fail-stop**：任一步骤失败立即停止后续，执行对应回滚。

### 步骤 C1 回滚（PG16 安装失败 / PG13 销毁后需恢复）
- **触发**：install_pg16.sh 报错；或 PG16 启动失败；或后续需恢复旧 PG13 数据。
- **命令**：
  ```bash
  # 停 PG16
  systemctl stop postgresql-16
  systemctl disable postgresql-16
  # 卸载 PG16（可选）
  dnf remove -y postgresql16-server
  # 恢复 PG13 数据目录（从 A1 备份）
  systemctl stop postgresql 2>/dev/null || true
  rm -rf /var/lib/pgsql/data
  cp -a /opt/pg13-backup-20260702/data /var/lib/pgsql/data
  chown -R postgres:postgres /var/lib/pgsql/data
  # 重装 PG13 包（如已卸载）并启动
  dnf install -y postgresql-server
  systemctl enable postgresql
  systemctl start postgresql
  ```
- **预期结果**：PG13 active，旧数据恢复，旧系统数据库可访问。

### 步骤 G6 回滚（Flyway 迁移失败 / Spring Boot 启动失败）
- **触发**：Flyway V1-V7 任一报错；`systemctl status` 非 active；日志含 Exception。
- **命令**：
  ```bash
  # 停服务
  systemctl stop fj1-api
  systemctl disable fj1-api
  # 删除残留库（Flyway 部分迁移的数据）以便干净重试
  su - postgres -c "dropdb fj1_inspect"
  # 分析迁移错误后重建（回到步骤 E1）
  # 检查 journalctl 定位失败迁移版本
  journalctl -u fj1-api.service --since "30 min ago" --no-pager | grep -A5 -i flyway
  ```
- **预期结果**：fj1_inspect 库删除，服务停止；修正迁移脚本或配置后从阶段 E1 重试。
- **备注**：若 Flyway 迁移本身有 bug，需回 WI-0001/WI-0002 修复 jar 后重新 scp（步骤 G1）。

### 步骤 H4 回滚（Nginx 配置测试失败 / reload 失败）
- **触发**：`nginx -t` 报 syntax error；reload 后站点不可访问。
- **命令**：
  ```bash
  # 移除新配置，恢复旧配置
  rm -f /etc/nginx/conf.d/fj1.conf
  cp -p /opt/fj-backup-20260702/nginx-fj.conf /etc/nginx/conf.d/fj.conf
  nginx -t && systemctl reload nginx
  ```
- **预期结果**：旧 fj.conf 生效（反代 127.0.0.1:3000）。注：旧后端 PM2 已在阶段 B 停用，若需完全恢复旧系统需 `pm2 resurrect`（从 pm2-dump.json 恢复）。

### 完整回滚（新系统部署彻底失败，恢复旧系统在线）
- **触发**：多阶段失败，决定放弃本次部署。
- **命令**：
  ```bash
  # 1. 停新系统
  systemctl stop fj1-api; systemctl disable fj1-api
  rm -f /etc/nginx/conf.d/fj1.conf
  # 2. 恢复旧 Nginx
  cp -p /opt/fj-backup-20260702/nginx-fj.conf /etc/nginx/conf.d/fj.conf
  nginx -t && systemctl reload nginx
  # 3. 恢复旧 PM2 fj-server
  pm2 resurrect   # 从 pm2-dump.json 恢复
  # 4.（可选）恢复 PG13：见 C1 回滚
  ```
- **预期结果**：旧系统恢复 online，端口 3000 + Nginx:80 反代恢复。

---

## 回滚触发条件

任一条件命中立即停止部署，执行对应回滚方案：

| # | 触发条件 | 对应回滚 |
|---|---------|---------|
| T1 | PG16 安装失败（install_pg16.sh 退出非 0） | C1 回滚 |
| T2 | PG16 启动后 `systemctl is-active postgresql-16` 非 active | C1 回滚 |
| T3 | Flyway 迁移失败（V1-V7 任何一个报错 `Migration failed`） | G6 回滚 |
| T4 | Spring Boot 启动失败（`systemctl status fj1-api` 非 active，TimeoutStartSec=90s 内未起来） | G6 回滚 |
| T5 | 后端 API health check 失败（步骤 I1 curl 非 UP 或连接拒绝） | G6 回滚 |
| T6 | 内存 OOM（`dmesg` 显示 killed java 进程 / free -h available 接近 0） | G6 回滚 + 降低 -Xmx 重试 |
| T7 | Nginx `nginx -t` 配置测试失败 | H4 回滚 |
| T8 | 全链路 health check 失败（步骤 I3 非 UP） | H4 回滚（检查反代） |
| T9 | 磁盘空间不足（部署中途 /opt 或 / 满） | 清理备份后重试 / 完整回滚 |
| T10 | 旧系统备份失败（阶段 A 任一步骤失败） | **停止整个部署**，不进入阶段 B |

---

## 风险评估

| # | 风险 | 等级 | 概率 | 影响 | 缓解措施 |
|---|------|------|------|------|---------|
| R1 | PG13 postgres 密码未知，无法 pg_dump | 高 | 已知 | 旧数据无法逻辑备份 | **已缓解**：阶段 A1 用文件级 cp（停 PG13 后拷贝 /var/lib/pgsql/data），最可靠 |
| R2 | 系统首次运行，启动可能失败 | 高 | 中 | 服务不可用 | fail-stop 协议 + 逐步骤验证 + G6 回滚 |
| R3 | 3.6GB RAM，JVM+PG 可能 OOM | 中 | 中 | 服务崩溃 | -Xmx768m + shared_buffers=512MB + Swap 4GB 兜底 + I4 内存检查 + HeapDumpOnOutOfMemoryError |
| R4 | Flyway V1-V7 首次在 PG16 执行不兼容 | 中 | 低 | 启动失败 | G6 回滚 dropdb 重试；迁移脚本已在 WI-0001/WI-0002 评审 |
| R5 | 部署配置硬编码 /opt/fj 需调整为 /opt/fj1 | 中 | 已知 | 路径错服务起不来 | **已缓解**：阶段 G3/G4 创建调整后的 yml/service，命名变更映射表覆盖 |
| R6 | 旧系统下线后新系统启动失败 = 服务全断 | 高 | 中 | 业务中断 | 保留完整备份 + 完整回滚方案（恢复 PM2+Nginx+PG13） |
| R7 | Nginx fj.conf 格式冲突（完整 nginx.conf vs 纯 server 块） | 中 | 已知 | nginx -t 失败 | **已缓解**：阶段 H3 创建纯 server{} 块，不使用 deploy/nginx/fj.conf 完整格式 |
| R8 | 磁盘空间（40G, 23GB 可用）紧张 | 中 | 低 | 部署中途满盘 | 备份占用约 1-2GB；jar 78M + 前端 ~50M；监控 df -h |
| R9 | systemd 服务 User=fj1 权限不足读 .env | 低 | 低 | 启动失败 | F3 chown fj1:fj1 /opt/fj1；G2 chown .env 给 fj1 |
| R10 | 交互脚本非交互执行（read/sleep）卡住 | 低 | 已知 | 部署卡住 | C1 用 `echo yes \|` 喂入；D1 sleep 3s 可直接执行 |

---

## 影响范围

### 受影响的服务
| 服务 | 影响 | 时段 |
|------|------|------|
| 旧 NestJS 飞检系统（PM2 fj-server） | **永久下线**（D1 决策） | 阶段 B 起 |
| 旧前端（/opt/fj/web via Nginx fj.conf） | **永久替换** | 阶段 H 起 |
| Nginx（端口 80） | 配置变更，短暂 reload 中断（<1s） | 阶段 H4 |
| PostgreSQL 13 | **销毁**，替换为 PG16 | 阶段 C 起 |
| 端口 3000 | 释放 | 阶段 B 起 |
| 端口 8080 | 新占用（fj1-api） | 阶段 G6 起 |

### 受影响的用户
- **飞检系统使用者**（现场飞检人员）：旧系统下线后，新系统部署完成前**服务中断**。窗口期 = 阶段 B 到阶段 I 完成（预计 30-60 分钟）。
- **服务器其他服务**：Nginx 80 端口共享，reload 时所有站点短暂中断（<1s）。

### 受影响的文件系统
- `/opt/fj/`：备份后保留（阶段 A2 备份，不删除原始，仅阶段 H2 移除 Nginx 引用）。
- `/opt/fj1/`：新建（阶段 F2）。
- `/opt/pg13-backup-20260702/`、`/opt/fj-backup-20260702/`：新建备份目录。
- `/var/lib/pgsql/data/`：PG13 销毁；`/var/lib/pgsql/16/data/`：PG16 新建。
- `/etc/nginx/conf.d/fj.conf`：移除；`/etc/nginx/conf.d/fj1.conf`：新建。
- `/etc/systemd/system/fj1-api.service`：新建。
- `/data/photos/`：新建（照片存储目录）。
- `/etc/profile.d/fj_java_home.sh`：新建（JRE17 JAVA_HOME）。

### 受影响的数据库
- PG13 `fj_inspect`（旧）：随 PG13 销毁（已文件级备份到 /opt/pg13-backup-20260702/）。
- PG16 `fj1_inspect`（新）：Flyway V1-V7 创建表结构。

### 不受影响
- 服务器 OS、网络配置、其他 systemd 服务、SSH。
- Android 原生工程（单独 WI，本次不涉及）。

---

## Assumptions（设计假设）

- A1: 假设 `ssh lg` 登录后为 root，所有 systemctl/dnf/cp 命令无需 sudo（来自 intake 探测）。
- A2: 假设 PG13 数据目录在 `/var/lib/pgsql/data`（CentOS Stream 9 PG13 默认路径），文件级 cp 可获得一致性快照。
- A3: 假设 fat jar `fj-api-1.0.0.jar` 内含所有依赖（fat jar），无需额外 classpath。
- A4: 假设 Flyway 迁移脚本 V1-V7 已在 WI-0001/WI-0002 通过评审，与 PG16 兼容。
- A5: 假设前端 `fj-web/dist/` 构建产物的 API base URL 指向 `/api`（同域反代）。
- A6: 假设服务器内网 10.0.12.12 可被飞检终端访问（CORS_ALLOWED_ORIGINS=http://10.0.12.12）。
- A7: 假设 3.6GB RAM 下 JVM -Xmx768m + PG shared_buffers=512MB + Nginx + OS 合计 < 2.3GB available（当前探测值），Swap 4GB 兜底。
- A8: 假设 install_pg16.sh / install_jre17.sh 已在仓库且可执行（来自 scripts/ops/）。

---

## Out of Scope

- **不在本次范围**：
  - Android 原生工程打包部署（单独 WI）。
  - 运行时 E2E 全流程测试（部署冒烟后另开任务）。
  - PG13 → PG16 数据迁移（D4 决策为销毁旧数据全新安装，不做数据迁移）。
  - 旧系统数据导出为业务可读格式（仅文件级备份用于回滚，不解析业务数据）。
  - HTTPS/TLS 证书配置（当前 http://10.0.12.12，内网直连）。
  - 日志收集/监控告警系统接入（Prometheus/Grafana 等）。
  - 数据库定期备份 cron 配置（部署成功后另开运维任务）。
  - 性能压测（部署冒烟后另开任务）。
