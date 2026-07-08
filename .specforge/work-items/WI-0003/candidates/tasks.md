# WI-0003 Tasks — fj1 飞检系统首次部署到 svr-lg

> **Work Item**: WI-0003
> **Workflow**: ops_task / task_change_path
> **产物类型**: tasks（由 ops_plan.md 派生）
> **派生源**: `.specforge/work-items/WI-0003/design.md` (ops_plan.md, 28 步骤 / 9 阶段 A-I)
> **生成时间**: 2026-07-02
> **执行服务器**: svr-lg (内网 10.0.12.12, `ssh lg` 登录为 root)

---

## 执行协议（fail-stop，所有 task 必读）

- **fail-stop**：每个 task 执行后必须运行 verification_commands 验证"预期结果"。任一 task 失败立即停止，进入 ops_plan.md 对应回滚方案（C1 回滚 / G6 回滚 / H4 回滚 / 完整回滚），禁止跳过失败步骤继续。
- **执行者身份**：`ssh lg` 已为 root，所有服务器命令无 `sudo` 前缀（sf_safe_bash 拦截 sudo，但此处不需要）。
- **执行方式**：所有 task 的命令均在服务器 svr-lg 上执行（通过 `ssh lg` 或在 ssh 会话内）。verification_commands 同样在服务器执行，可加 `ssh lg '<cmd>'` 前缀或于 ssh 会话内直接运行。
- **变量约定**：`$BK_DATE`=20260702；密钥值（`DB_PASSWORD` / `JWT_SECRET` / `FJ_DB_PASSWORD`）仅存在于服务器 `/opt/fj1/api/.env` 或执行会话环境变量，**不写入本文件**。
- **并行性**：ops_plan.md 将所有步骤标记 `parallel: false`，本 tasks.md 严格继承——所有 task 串行执行，依赖链显式声明。
- **密钥纪律**：本 tasks.md 不含任何明文密码/JWT_SECRET。

## 依赖总览

```
A1 → A2 → A3 → A4
              ↓
       B1 → B2 → B3
                 ↓
                 C1 → D1 → E1 → F1 → F2 → F3
                                          ↓
                       G1 → G2 → G3 → G4 → G5 → G6
                                                  ↓
                                  H1 → H2 → H3 → H4
                                                    ↓
                                    I1 → I2 → I3 → I4 → I5
```

## 全局禁止文件（所有 task 通用）

每个 task 的 executor 均禁止修改：
- `.specforge/work-items/WI-0003/requirements.md`
- `.specforge/work-items/WI-0003/design.md`（ops_plan.md）
- `.specforge/work-items/WI-0003/tasks.md`（本文件）
- `.specforge/work-items/WI-0003/trace_delta.md`
- 其他 task 的 allowed_write_files 中声明的文件
- 源代码仓库（`fj-backend/**`, `fj-web/**`, `scripts/**`, `deploy/**`）—— 本 WI 只部署已构建产物，不改源码

---

## 阶段 A：备份旧系统（保护性）

### TASK-A1 PG13 数据文件级备份

**对应 ops_plan 步骤**：A1

**context_block**（executor 必读）：
- **What**：停止 PG13 服务以获得一致性快照（postgres 密码未知，pg_dump 不可用 → 文件级 cp），将 `/var/lib/pgsql/data` 整体拷贝到 `/opt/pg13-backup-20260702/data`，备份完成后重启 PG13 保持旧系统临时可用。
- **Why**：D4 决策——PG13 数据先备份再销毁。阶段 C 将销毁 PG13，此备份是唯一回滚源（C1 回滚依赖此备份）。
- **Refs**：ops_plan §阶段A 步骤A1；决策 D4；假设 A2
- **Where**:
  - `read_files`（服务器）: `/var/lib/pgsql/data`（PG13 数据目录，只读）
  - `allowed_write_files`（服务器）: `/opt/pg13-backup-20260702/data`
  - `forbidden_files`: 全局禁止文件 + `/var/lib/pgsql/data`（只读不改）
- **Constraints**:
  - 必须先 `systemctl stop postgresql` 再 cp，保证一致性
  - cp 完成后必须 `systemctl start postgresql` 恢复旧系统临时可用
  - 使用 `cp -a` 保留属主/权限/时间戳
- **Done When**:
  - `/opt/pg13-backup-20260702/data/PG_VERSION` 存在且内容为 `13`
  - `systemctl is-active postgresql` → `active`（PG13 已重启）

**命令**（服务器执行）：
```bash
systemctl stop postgresql
mkdir -p /opt/pg13-backup-20260702
cp -a /var/lib/pgsql/data /opt/pg13-backup-20260702/data
systemctl start postgresql
```

**expected_file_changes**（服务器）:
- 新建 `/opt/pg13-backup-20260702/data/`（PG13 数据副本）

**verification_commands**:
- `ssh lg 'cat /opt/pg13-backup-20260702/data/PG_VERSION'` → 期望输出 `13`
- `ssh lg 'systemctl is-active postgresql'` → 期望输出 `active`

**verification_evidence_expected**:
- `{command: "cat .../PG_VERSION", expected_exit_code: 0, expected_output_pattern: "^13$", evidence_type: "file_content"}`
- `{command: "systemctl is-active postgresql", expected_exit_code: 0, expected_output_pattern: "^active$", evidence_type: "service_status"}`

- **depends_on**: []（无）
- **refs**: [OPS-A1, D4]
- **requires_user_confirmation**: true（停 PG13 影响旧系统短暂下线）
- **parallel**: false
- **是否破坏性**: 否（只读拷贝 + 短暂停 PG13 服务）
- **out_of_scope**: 不做 pg_dump（密码未知）；不解析业务数据；不修改 PG13 配置

---

### TASK-A2 备份 /opt/fj/ 整体

**对应 ops_plan 步骤**：A2

**context_block**（executor 必读）：
- **What**：将旧系统根目录 `/opt/fj/` 整体拷贝到 `/opt/fj-backup-20260702/fj/`。
- **Why**：D3 决策——/opt/fj/ 备份后清理，新系统部署到 /opt/fj1/。此备份是旧系统（NestJS 后端 + 旧前端 + uploads）的完整回滚源（完整回滚方案依赖此备份）。
- **Refs**：ops_plan §阶段A 步骤A2；决策 D1/D3
- **Where**:
  - `read_files`（服务器）: `/opt/fj`（旧系统根，只读）
  - `allowed_write_files`（服务器）: `/opt/fj-backup-20260702/fj`
  - `forbidden_files`: 全局禁止文件 + `/opt/fj`（只读不改）
- **Constraints**: 使用 `cp -a` 保留属性；备份目录 `/opt/fj-backup-20260702` 后续步骤 A3/A4 也写入
- **Done When**: `/opt/fj-backup-20260702/fj/` 含 `server/`、`web/`、`web-build/`、`uploads/` 子目录

**命令**（服务器执行）：
```bash
mkdir -p /opt/fj-backup-20260702
cp -a /opt/fj /opt/fj-backup-20260702/fj
```

**expected_file_changes**（服务器）:
- 新建 `/opt/fj-backup-20260702/fj/`（旧系统副本）

**verification_commands**:
- `ssh lg 'ls -d /opt/fj-backup-20260702/fj/{server,web,web-build,uploads}'` → 期望 4 个目录全部列出无 "No such file" 错误（exit 0）

**verification_evidence_expected**:
- `{command: "ls -d .../{server,web,web-build,uploads}", expected_exit_code: 0, expected_output_pattern: "uploads$", evidence_type: "directory_listing"}`

- **depends_on**: [TASK-A1]
- **refs**: [OPS-A2, D1, D3]
- **requires_user_confirmation**: true
- **parallel**: false
- **是否破坏性**: 否
- **out_of_scope**: 不删除原 /opt/fj（仅备份）；不解析旧系统业务数据

---

### TASK-A3 备份 Nginx fj.conf

**对应 ops_plan 步骤**：A3

**context_block**（executor 必读）：
- **What**：将 `/etc/nginx/conf.d/fj.conf` 拷贝到 `/opt/fj-backup-20260702/nginx-fj.conf`（保留权限 `-p`）。
- **Why**：阶段 H 将移除 fj.conf 并创建 fj1.conf，此备份是 H4 回滚（Nginx 配置回退）的源文件。
- **Refs**：ops_plan §阶段A 步骤A3；H4 回滚方案
- **Where**:
  - `read_files`（服务器）: `/etc/nginx/conf.d/fj.conf`
  - `allowed_write_files`（服务器）: `/opt/fj-backup-20260702/nginx-fj.conf`
  - `forbidden_files`: 全局禁止文件 + `/etc/nginx/conf.d/fj.conf`（只读不改）
- **Constraints**: 使用 `cp -p` 保留权限/时间戳
- **Done When**: `/opt/fj-backup-20260702/nginx-fj.conf` 存在且非空

**命令**（服务器执行）：
```bash
cp -p /etc/nginx/conf.d/fj.conf /opt/fj-backup-20260702/nginx-fj.conf
```

**expected_file_changes**（服务器）:
- 新建 `/opt/fj-backup-20260702/nginx-fj.conf`

**verification_commands**:
- `ssh lg 'test -s /opt/fj-backup-20260702/nginx-fj.conf && echo OK'` → 期望输出 `OK`（文件存在且非空）

**verification_evidence_expected**:
- `{command: "test -s .../nginx-fj.conf", expected_exit_code: 0, expected_output_pattern: "^OK$", evidence_type: "file_existence"}`

- **depends_on**: [TASK-A2]
- **refs**: [OPS-A3]
- **requires_user_confirmation**: true
- **parallel**: false
- **是否破坏性**: 否
- **out_of_scope**: 不修改原 fj.conf；不备份 nginx.conf 主文件

---

### TASK-A4 记录 PM2 进程信息

**对应 ops_plan 步骤**：A4

**context_block**（executor 必读）：
- **What**：导出 PM2 进程列表（`pm2 list`）、保存当前 PM2 dump（`pm2 save` + `pm2 jlist`）到 `/opt/fj-backup-20260702/`。
- **Why**：阶段 B 将 stop+delete PM2 fj-server，此 dump 是完整回滚方案中 `pm2 resurrect` 恢复旧后端的源。
- **Refs**：ops_plan §阶段A 步骤A4；完整回滚方案
- **Where**:
  - `read_files`（服务器）: PM2 运行时状态
  - `allowed_write_files`（服务器）: `/opt/fj-backup-20260702/pm2-list.txt`, `/opt/fj-backup-20260702/pm2-dump.json`
  - `forbidden_files**: 全局禁止文件
- **Constraints**: `pm2 save` 必须成功（输出成功保存）；重定向 `2>&1` 捕获 stderr
- **Done When**: `/opt/fj-backup-20260702/` 下存在 `pm2-list.txt` 和 `pm2-dump.json` 且均非空

**命令**（服务器执行）：
```bash
pm2 list > /opt/fj-backup-20260702/pm2-list.txt 2>&1
pm2 save
pm2 jlist > /opt/fj-backup-20260702/pm2-dump.json 2>&1
```

**expected_file_changes**（服务器）:
- 新建 `/opt/fj-backup-20260702/pm2-list.txt`
- 新建 `/opt/fj-backup-20260702/pm2-dump.json`

**verification_commands**:
- `ssh lg 'test -s /opt/fj-backup-20260702/pm2-list.txt && test -s /opt/fj-backup-20260702/pm2-dump.json && echo OK'` → 期望 `OK`

**verification_evidence_expected**:
- `{command: "test -s pm2-list.txt && test -s pm2-dump.json", expected_exit_code: 0, expected_output_pattern: "^OK$", evidence_type: "file_existence"}`

- **depends_on**: [TASK-A3]
- **refs**: [OPS-A4]
- **requires_user_confirmation**: true
- **parallel**: false
- **是否破坏性**: 否
- **out_of_scope**: 不停止任何 PM2 进程（仅记录）；不修改 PM2 配置

---

## 阶段 B：停止旧系统

### TASK-B1 停止 PM2 fj-server

**对应 ops_plan 步骤**：B1

**context_block**（executor 必读）：
- **What**：执行 `pm2 stop fj-server`，停止旧 NestJS 飞检后端进程。
- **Why**：D1 决策——旧系统停用替换。停止旧后端释放端口 3000，准备新系统接管。
- **Refs**：ops_plan §阶段B 步骤B1；决策 D1
- **Where**:
  - `read_files`（服务器）: PM2 运行时
  - `allowed_write_files`（服务器）: 无文件写入（PM2 进程状态变更）
  - `forbidden_files**: 全局禁止文件 + `/opt/fj/**`
- **Constraints**: 仅 stop 不 delete（delete 在 B2）；可恢复（pm2 start fj-server）
- **Done When**: `pm2 list` 中 fj-server 状态为 `stopped`；`ss -lntp | grep :3000` 无输出（端口释放）

**命令**（服务器执行）：
```bash
pm2 stop fj-server
```

**expected_file_changes**（服务器）: 无（进程状态变更）

**verification_commands**:
- `ssh lg 'pm2 list | grep fj-server | grep -q stopped && echo STOPPED'` → 期望 `STOPPED`
- `ssh lg 'ss -lntp | grep :3000 || echo PORT_FREE'` → 期望 `PORT_FREE`（无输出时 fallback）

**verification_evidence_expected**:
- `{command: "pm2 list | grep ... stopped", expected_exit_code: 0, expected_output_pattern: "^STOPPED$", evidence_type: "process_state"}`
- `{command: "ss -lntp | grep :3000", expected_exit_code: 0, expected_output_pattern: "^PORT_FREE$", evidence_type: "port_status"}`

- **depends_on**: [TASK-A4]
- **refs**: [OPS-B1, D1]
- **requires_user_confirmation**: true
- **parallel**: false
- **是否破坏性**: 否（可恢复）
- **out_of_scope**: 不 delete 进程；不停其他 PM2 进程；不动 /opt/fj 文件

---

### TASK-B2 删除 PM2 fj-server 进程

**对应 ops_plan 步骤**：B2

**context_block**（executor 必读）：
- **What**：执行 `pm2 delete fj-server`，从 PM2 进程列表彻底移除 fj-server 条目。
- **Why**：D1 决策——旧系统彻底下线。delete 后 PM2 不再托管该进程，避免误启动。可从 A4 的 pm2-dump.json 经 `pm2 resurrect` 恢复。
- **Refs**：ops_plan §阶段B 步骤B2；决策 D1
- **Where**:
  - `allowed_write_files`（服务器）: 无（PM2 进程列表变更）
  - `forbidden_files**: 全局禁止文件
- **Constraints**: 仅 delete fj-server；不影响其他 PM2 进程
- **Done When**: `pm2 list` 中无 fj-server 条目

**命令**（服务器执行）：
```bash
pm2 delete fj-server
```

**expected_file_changes**（服务器）: 无

**verification_commands**:
- `ssh lg 'pm2 list | grep -q fj-server && echo STILL_EXIST || echo DELETED'` → 期望 `DELETED`

**verification_evidence_expected**:
- `{command: "pm2 list | grep fj-server", expected_exit_code: 0, expected_output_pattern: "^DELETED$", evidence_type: "process_state"}`

- **depends_on**: [TASK-B1]
- **refs**: [OPS-B2, D1]
- **requires_user_confirmation**: true
- **parallel**: false
- **是否破坏性**: 否（pm2-dump.json 已备份可 resurrect）
- **out_of_scope**: 不 delete 其他 PM2 进程；不动 /opt/fj 文件

---

### TASK-B3 保存 PM2 状态

**对应 ops_plan 步骤**：B3

**context_block**（executor 必读）：
- **What**：执行 `pm2 save`，将当前 PM2 列表（不含 fj-server）持久化到 PM2 dump 文件。
- **Why**：固化"旧系统已下线"状态，防止服务器重启后 PM2 自动 resurrect 旧 fj-server。
- **Refs**：ops_plan §阶段B 步骤B3
- **Where**:
  - `allowed_write_files`（服务器）: PM2 内部 dump 文件（`~/.pm2/dump.pm2`，PM2 自管）
  - `forbidden_files**: 全局禁止文件
- **Constraints**: `pm2 save` 必须成功
- **Done When**: `pm2 save` 输出成功保存；`pm2 list` 不含 fj-server

**命令**（服务器执行）：
```bash
pm2 save
```

**expected_file_changes**（服务器）:
- 覆盖 PM2 内部 dump（`~/.pm2/dump.pm2`）

**verification_commands**:
- `ssh lg 'pm2 save 2>&1 | grep -qi "successfully\|saved" && echo SAVED'` → 期望 `SAVED`
- `ssh lg 'pm2 list | grep -q fj-server && echo FAIL || echo NO_FJ'` → 期望 `NO_FJ`

**verification_evidence_expected**:
- `{command: "pm2 save", expected_exit_code: 0, expected_output_pattern: "^SAVED$", evidence_type: "command_output"}`

- **depends_on**: [TASK-B2]
- **refs**: [OPS-B3]
- **requires_user_confirmation**: true
- **parallel**: false
- **是否破坏性**: 否
- **out_of_scope**: 不动其他 PM2 进程

---

## 阶段 C：PG13 → PG16 全新安装（破坏性）

### TASK-C1 执行 install_pg16.sh

**对应 ops_plan 步骤**：C1

**context_block**（executor 必读）：
- **What**：设置 `FJ_DB_PASSWORD` 环境变量（值见服务器 .env，不写入本文件），用 `echo "yes" |` 管道喂入交互确认，执行 `scripts/ops/install_pg16.sh`。
- **Why**：基础设施升级——卸载 PG13、销毁旧 PG13 数据目录、全新安装 PG16。前置依赖 TASK-A1 已完成 PG13 文件级备份（C1 回滚源）。本步骤是整个部署最危险的破坏性操作。
- **Refs**：ops_plan §阶段C 步骤C1；决策 D4；假设 A2/A8；回滚触发 T1/T2
- **Where**:
  - `read_files`（仓库）: `scripts/ops/install_pg16.sh`（执行不改源文件）
  - `allowed_write_files`（服务器）: `/var/lib/pgsql/16/data/`, `/var/lib/pgsql/16/data/postgresql.conf`, `/var/lib/pgsql/16/data/pg_hba.conf`, systemd `postgresql-16.service`
  - `forbidden_files**: 全局禁止文件 + `/opt/pg13-backup-20260702/**`（备份只读，回滚源）
- **Constraints**:
  - `FJ_DB_PASSWORD` 仅存在于执行会话环境变量，不写入任何文件、不进入 Git
  - 用 `echo "yes" |` 喂入 `read -r -p` 交互确认
  - 脚本幂等：PG16 已装则跳过安装阶段
  - 预期 postgresql.conf: shared_buffers=512MB, max_connections=50, timezone=Asia/Shanghai
  - 预期 pg_hba.conf: local=peer, 127.0.0.1=scram-sha-256
- **Done When**:
  - 脚本输出 `PostgreSQL 16 安装与配置完成` 和 `全部步骤完成 ✓`
  - `systemctl is-active postgresql-16` → `active`
  - `psql --version` → `psql (PostgreSQL) 16.x`

**命令**（服务器执行，仓库根目录）：
```bash
export FJ_DB_PASSWORD='<见服务器 .env>'
echo "yes" | bash scripts/ops/install_pg16.sh
```

**expected_file_changes**（服务器）:
- 新建 `/var/lib/pgsql/16/data/`（PG16 数据目录）
- 新建/修改 `/var/lib/pgsql/16/data/postgresql.conf`、`pg_hba.conf`
- 新建 systemd `postgresql-16.service`
- 卸载 PG13 包，销毁 `/var/lib/pgsql/data`（旧 PG13）

**verification_commands**:
- `ssh lg 'systemctl is-active postgresql-16'` → 期望 `active`
- `ssh lg 'psql --version'` → 期望含 `PostgreSQL) 16.`
- `ssh lg 'grep -E "^shared_buffers|^max_connections|^timezone" /var/lib/pgsql/16/data/postgresql.conf'` → 期望含 `512MB`、`50`、`Asia/Shanghai`
- `ssh lg 'ss -lntp | grep 127.0.0.1:5432'` → 期望 PG16 监听 5432

**verification_evidence_expected**:
- `{command: "systemctl is-active postgresql-16", expected_exit_code: 0, expected_output_pattern: "^active$", evidence_type: "service_status"}`
- `{command: "psql --version", expected_exit_code: 0, expected_output_pattern: "PostgreSQL\\) 16\\.", evidence_type: "version_output"}`
- `{command: "grep postgresql.conf", expected_exit_code: 0, expected_output_pattern: "Asia/Shanghai", evidence_type: "config_content"}`

- **depends_on**: [TASK-B3, TASK-A1]（A1 备份是回滚前提）
- **refs**: [OPS-C1, D4]
- **requires_user_confirmation**: true（破坏性，销毁 PG13）
- **parallel**: false
- **是否破坏性**: **是**（卸载 PG13、销毁旧 PG13 数据目录）
- **out_of_scope**: 不做 PG13→PG16 数据迁移（D4 决策为销毁旧数据全新安装）；不修改 install_pg16.sh 源文件（运行时执行）

---

## 阶段 D：JRE17 安装

### TASK-D1 执行 install_jre17.sh

**对应 ops_plan 步骤**：D1

**context_block**（executor 必读）：
- **What**：执行 `bash scripts/ops/install_jre17.sh`，安装 OpenJDK 17 headless 并配置 JAVA_HOME。
- **Why**：基础设施升级——Spring Boot fat jar 需要 JRE17 运行。阶段 G 启动 fj1-api 依赖此 JRE。
- **Refs**：ops_plan §阶段D 步骤D1；假设 A8
- **Where**:
  - `read_files`（仓库）: `scripts/ops/install_jre17.sh`
  - `allowed_write_files`（服务器）: `/etc/profile.d/fj_java_home.sh`, JRE17 安装目录（dnf 管理）
  - `forbidden_files**: 全局禁止文件
- **Constraints**:
  - 脚本含 3 秒 `sleep` 倒计时，非交互可直接执行（无需管道喂入）
  - 幂等：检测到主版本 17 则打印 `JRE 17 already installed` 并退出 0
- **Done When**:
  - `java -version` 输出 `openjdk version "17.x.x"`
  - `/etc/profile.d/fj_java_home.sh` 存在

**命令**（服务器执行，仓库根目录）：
```bash
bash scripts/ops/install_jre17.sh
```

**expected_file_changes**（服务器）:
- 新建 `/etc/profile.d/fj_java_home.sh`
- 安装 JRE17 包

**verification_commands**:
- `ssh lg 'java -version 2>&1 | head -1'` → 期望含 `openjdk version "17` 或 `version "17`
- `ssh lg 'test -f /etc/profile.d/fj_java_home.sh && echo OK'` → 期望 `OK`

**verification_evidence_expected**:
- `{command: "java -version", expected_exit_code: 0, expected_output_pattern: "version \"17", evidence_type: "version_output"}`
- `{command: "test -f fj_java_home.sh", expected_exit_code: 0, expected_output_pattern: "^OK$", evidence_type: "file_existence"}`

- **depends_on**: [TASK-C1]
- **refs**: [OPS-D1]
- **requires_user_confirmation**: false
- **parallel**: false
- **是否破坏性**: 否（幂等）
- **out_of_scope**: 不安装 JDK（仅 JRE headless）；不修改 install_jre17.sh 源文件

---

## 阶段 E：数据库初始化

### TASK-E1 创建 fj1_app 用户 + fj1_inspect 库

**对应 ops_plan 步骤**：E1

**context_block**（executor 必读）：
- **What**：基于 `scripts/ops/init_database.sh` 逻辑，运行时覆盖 DB_NAME=`fj1_inspect`、DB_USER=`fj1_app`（不改原文件，直接用调整后的内联命令）。创建用户、创建库、授权、验证连接。
- **Why**：命名变更映射（D2 决策）——DB 用户 `fj_app`→`fj1_app`，库名 `fj_inspect`→`fj1_inspect`。Flyway 迁移需要目标库已存在。
- **Refs**：ops_plan §阶段E 步骤E1；决策 D2；P4 待调整脚本表
- **Where**:
  - `read_files`（仓库）: `scripts/ops/init_database.sh`（参考逻辑，不改源文件）
  - `allowed_write_files`（服务器）: PG16 内部——`fj1_app` 角色、`fj1_inspect` 数据库
  - `forbidden_files**: 全局禁止文件 + 仓库源码
- **Constraints**:
  - DB_NAME/DB_USER 改为 fj1（运行时覆盖，不修改 init_database.sh 源文件）
  - 幂等：用户/库已存在则跳过创建
  - `FJ_DB_PASSWORD` 仅在执行会话环境变量，不写入文件
  - 必须用 `su - postgres -c` 以 postgres 身份执行 psql 管理命令
- **Done When**:
  - PG 角色 `fj1_app` 存在
  - 数据库 `fj1_inspect` 存在且 owner 为 `fj1_app`
  - `PGPASSWORD=$FJ_DB_PASSWORD psql -U fj1_app -d fj1_inspect -h 127.0.0.1 -c "SELECT version();"` 连接成功返回 PG16 版本

**命令**（服务器执行，完整内联命令见 ops_plan 步骤 E1，DB_NAME=fj1_inspect / DB_USER=fj1_app）：
```bash
export FJ_DB_PASSWORD='<见服务器 .env>'
DB_NAME="fj1_inspect"; DB_USER="fj1_app"; DB_PASSWORD="$FJ_DB_PASSWORD"
# 创建用户（幂等）
USER_EXISTS=$(su - postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'\"" 2>/dev/null || echo "0")
if [ "$USER_EXISTS" != "1" ]; then
  su - postgres -c "psql -c \"CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD'\""
fi
# 创建数据库（幂等）
DB_EXISTS=$(su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='$DB_NAME'\"" 2>/dev/null || echo "0")
if [ "$DB_EXISTS" != "1" ]; then
  su - postgres -c "createdb -O $DB_USER $DB_NAME"
fi
# 授权（幂等）
su - postgres -c "psql -d $DB_NAME -c \"GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER\""
su - postgres -c "psql -d $DB_NAME -c \"GRANT ALL PRIVILEGES ON SCHEMA public TO $DB_USER\""
# 验证连接
PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -h 127.0.0.1 -c "SELECT version();"
```

**expected_file_changes**（服务器）:
- PG16 新建角色 `fj1_app`
- PG16 新建数据库 `fj1_inspect`（owner=fj1_app）

**verification_commands**:
- `ssh lg 'su - postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='"'"'fj1_app'"'"'\""'` → 期望 `1`
- `ssh lg 'su - postgres -c "psql -tAc \"SELECT pg_catalog.pg_get_userbyid(datdba) FROM pg_database WHERE datname='"'"'fj1_inspect'"'"'\""'` → 期望 `fj1_app`

**verification_evidence_expected**:
- `{command: "SELECT 1 FROM pg_roles ... fj1_app", expected_exit_code: 0, expected_output_pattern: "^1$", evidence_type: "db_query"}`
- `{command: "SELECT owner ... fj1_inspect", expected_exit_code: 0, expected_output_pattern: "^fj1_app$", evidence_type: "db_query"}`

- **depends_on**: [TASK-D1]
- **refs**: [OPS-E1, D2]
- **requires_user_confirmation**: false
- **parallel**: false
- **是否破坏性**: 否（全新库，无旧数据）
- **out_of_scope**: 不修改 init_database.sh 源文件；不导入旧数据；不做 Flyway 迁移（在 G6 由 Spring Boot 触发）

---

## 阶段 F：服务器目录准备

### TASK-F1 创建 fj1 系统用户

**对应 ops_plan 步骤**：F1

**context_block**（executor 必读）：
- **What**：创建系统用户 `fj1`（home=`/opt/fj1`，shell=`/sbin/nologin`），用于 systemd fj1-api.service 运行身份。
- **Why**：命名变更（D2）——系统用户 `fj`→`fj1`。systemd 服务 `User=fj1` 需要此用户存在。home `/opt/fj1` 自动创建（F2 在此基础上建子目录）。
- **Refs**：ops_plan §阶段F 步骤F1；决策 D2
- **Where**:
  - `allowed_write_files`（服务器）: `fj1` 用户（系统账户），`/opt/fj1`（home 自动创建）
  - `forbidden_files**: 全局禁止文件 + `/opt/fj/**`
- **Constraints**: 幂等写法 `id fj1 || useradd ...`；shell 为 nologin（服务账户不可登录）
- **Done When**: `id fj1` 返回 uid/gid；`/opt/fj1` 存在

**命令**（服务器执行）：
```bash
id fj1 || useradd -r -m -d /opt/fj1 -s /sbin/nologin fj1
```

**expected_file_changes**（服务器）:
- 新建系统用户 `fj1`
- 新建 home 目录 `/opt/fj1`

**verification_commands**:
- `ssh lg 'id fj1'` → 期望输出含 `uid=` 且 `fj1` 组（exit 0）

**verification_evidence_expected**:
- `{command: "id fj1", expected_exit_code: 0, expected_output_pattern: "uid=.*fj1", evidence_type: "user_existence"}`

- **depends_on**: [TASK-E1]
- **refs**: [OPS-F1, D2]
- **requires_user_confirmation**: false
- **parallel**: false
- **是否破坏性**: 否（幂等）
- **out_of_scope**: 不创建子目录（F2 负责）；不删除旧 fj 用户

---

### TASK-F2 创建部署目录结构

**对应 ops_plan 步骤**：F2

**context_block**（executor 必读）：
- **What**：`mkdir -p /opt/fj1/api /opt/fj1/web /opt/fj1/api/logs /data/photos`。
- **Why**：阶段 G 后端 jar/.env/yml 部署到 `/opt/fj1/api/`，日志到 `/opt/fj1/api/logs/`；阶段 H 前端到 `/opt/fj1/web/`；照片存储到 `/data/photos/`（Nginx X-Accel-Redirect 别名）。
- **Refs**：ops_plan §阶段F 步骤F2
- **Where**:
  - `allowed_write_files`（服务器）: `/opt/fj1/api`, `/opt/fj1/web`, `/opt/fj1/api/logs`, `/data/photos`
  - `forbidden_files**: 全局禁止文件
- **Constraints**: 使用 `mkdir -p` 幂等
- **Done When**: 4 个目录均存在

**命令**（服务器执行）：
```bash
mkdir -p /opt/fj1/api /opt/fj1/web /opt/fj1/api/logs /data/photos
```

**expected_file_changes**（服务器）:
- 新建 `/opt/fj1/api/`、`/opt/fj1/web/`、`/opt/fj1/api/logs/`、`/data/photos/`

**verification_commands**:
- `ssh lg 'ls -ld /opt/fj1/api /opt/fj1/web /opt/fj1/api/logs /data/photos'` → 期望 4 行目录列表（exit 0）

**verification_evidence_expected**:
- `{command: "ls -ld 4 dirs", expected_exit_code: 0, expected_output_pattern: "/data/photos$", evidence_type: "directory_listing"}`

- **depends_on**: [TASK-F1]
- **refs**: [OPS-F2]
- **requires_user_confirmation**: false
- **parallel**: false
- **是否破坏性**: 否
- **out_of_scope**: 不设置属主（F3 负责）；不上传文件

---

### TASK-F3 设置目录属主

**对应 ops_plan 步骤**：F3

**context_block**（executor 必读）：
- **What**：`chown -R fj1:fj1 /opt/fj1 /data/photos`，确保 systemd `User=fj1` 能读写部署目录和照片目录。
- **Why**：systemd fj1-api.service 以 fj1 身份运行，需读 `/opt/fj1/api/.env`（600 权限）和写 `/opt/fj1/api/logs/`、`/data/photos/`。R9 风险缓解。
- **Refs**：ops_plan §阶段F 步骤F3；风险 R9
- **Where**:
  - `allowed_write_files`（服务器）: `/opt/fj1/**`（属主变更）、`/data/photos/**`（属主变更）
  - `forbidden_files**: 全局禁止文件
- **Constraints**: 递归 chown；fj1 用户必须已存在（依赖 F1）
- **Done When**: `ls -ld /opt/fj1 /data/photos` owner 为 `fj1:fj1`

**命令**（服务器执行）：
```bash
chown -R fj1:fj1 /opt/fj1
chown -R fj1:fj1 /data/photos
```

**expected_file_changes**（服务器）:
- 修改 `/opt/fj1/**` 属主为 fj1:fj1
- 修改 `/data/photos/**` 属主为 fj1:fj1

**verification_commands**:
- `ssh lg 'stat -c "%U:%G" /opt/fj1 /data/photos'` → 期望两行均为 `fj1:fj1`

**verification_evidence_expected**:
- `{command: "stat -c %U:%G /opt/fj1 /data/photos", expected_exit_code: 0, expected_output_pattern: "fj1:fj1", evidence_type: "ownership"}`

- **depends_on**: [TASK-F2]
- **refs**: [OPS-F3, R9]
- **requires_user_confirmation**: false
- **parallel**: false
- **是否破坏性**: 否
- **out_of_scope**: 不改 /opt/fj（旧系统）属主

---

## 阶段 G：部署后端

### TASK-G1 上传 fat jar

**对应 ops_plan 步骤**：G1

**context_block**（executor 必读）：
- **What**：本地执行 `scp fj-backend/fj-api/target/fj-api-1.0.0.jar lg:/opt/fj1/api/fj-api-1.0.0.jar`，上传 fat jar 到服务器。
- **Why**：阶段 G4 systemd `ExecStart ... fj-api-1.0.0.jar` 需要此文件存在于 `/opt/fj1/api/`。命名变更（D2）——jar 名固定 `fj-api-1.0.0.jar`（旧 systemd 引用 `fj-api.jar`）。
- **Refs**：ops_plan §阶段G 步骤G1；决策 D2；假设 A3
- **Where**:
  - `read_files`（本地）: `fj-backend/fj-api/target/fj-api-1.0.0.jar`（构建产物，78M）
  - `allowed_write_files`（服务器）: `/opt/fj1/api/fj-api-1.0.0.jar`
  - `forbidden_files**: 全局禁止文件 + 本地源码（不改）
- **Constraints**: jar 必须是 fat jar（含所有依赖，A3 假设）；scp 目标路径属主 fj1（F3 已设）
- **Done When**: 服务器 `/opt/fj1/api/fj-api-1.0.0.jar` 存在，大小约 78M（>70M）

**命令**（本地执行 scp）：
```bash
scp fj-backend/fj-api/target/fj-api-1.0.0.jar lg:/opt/fj1/api/fj-api-1.0.0.jar
```

**expected_file_changes**（服务器）:
- 新建 `/opt/fj1/api/fj-api-1.0.0.jar`（约 78M）

**verification_commands**:
- `ssh lg 'test -f /opt/fj1/api/fj-api-1.0.0.jar && sz=$(stat -c%s /opt/fj1/api/fj-api-1.0.0.jar) && [ "$sz" -gt 70000000 ] && echo JAR_OK'` → 期望 `JAR_OK`

**verification_evidence_expected**:
- `{command: "test jar size > 70M", expected_exit_code: 0, expected_output_pattern: "^JAR_OK$", evidence_type: "file_size"}`

- **depends_on**: [TASK-F3]
- **refs**: [OPS-G1, D2, A3]
- **requires_user_confirmation**: true
- **parallel**: false
- **是否破坏性**: 否
- **out_of_scope**: 不重新构建 jar（产物已就绪 P2）；不上传源码

---

### TASK-G2 创建 /opt/fj1/api/.env（密钥文件）

**对应 ops_plan 步骤**：G2

**context_block**（executor 必读）：
- **What**：在服务器创建 `/opt/fj1/api/.env`，含 `JWT_SECRET`（Agent 生成值）、`DB_PASSWORD`（用户提供值）、`DB_USER=fj1_app`、`CORS_ALLOWED_ORIGINS=http://10.0.12.12`、`SPRING_PROFILES_ACTIVE=prod`。权限 600，属主 fj1:fj1。
- **Why**：systemd fj1-api.service 通过 `EnvironmentFile=/opt/fj1/api/.env` 加载环境变量。密钥纪律——明文密码/JWT 仅存在于此文件（chmod 600），不进入 Git、不进入 ops_plan。
- **Refs**：ops_plan §阶段G 步骤G2；P3 密钥准备；密钥纪律
- **Where**:
  - `allowed_write_files`（服务器）: `/opt/fj1/api/.env`
  - `forbidden_files**: 全局禁止文件 + 任何仓库文件（密钥绝不写入仓库）
- **Constraints**:
  - ⚠️ 密钥纪律：`<见服务器 .env>` 占位符表示真实值仅写入服务器，不进入 tasks.md/ops_plan.md/Git
  - chmod 600（仅 fj1 可读）
  - chown fj1:fj1
  - JWT_SECRET 由 Agent 生成强随机值；DB_PASSWORD 由用户提供
- **Done When**: `/opt/fj1/api/.env` 存在，权限 `-rw-------`（600），owner fj1:fj1，含 5 个键

**命令**（服务器执行，密钥值见服务器不写明文）：
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

**expected_file_changes**（服务器）:
- 新建 `/opt/fj1/api/.env`（600，fj1:fj1）

**verification_commands**:
- `ssh lg 'stat -c "%a %U:%G" /opt/fj1/api/.env'` → 期望 `600 fj1:fj1`
- `ssh lg 'grep -qE "^(JWT_SECRET|DB_PASSWORD|DB_USER|CORS_ALLOWED_ORIGINS|SPRING_PROFILES_ACTIVE)=" /opt/fj1/api/.env && echo ENV_OK'` → 期望 `ENV_OK`

**verification_evidence_expected**:
- `{command: "stat .env", expected_exit_code: 0, expected_output_pattern: "^600 fj1:fj1$", evidence_type: "permission_ownership"}`
- `{command: "grep keys .env", expected_exit_code: 0, expected_output_pattern: "^ENV_OK$", evidence_type: "file_content"}`

- **depends_on**: [TASK-G1]
- **refs**: [OPS-G2, P3]
- **requires_user_confirmation**: true（涉及密钥写入）
- **parallel**: false
- **是否破坏性**: 否
- **out_of_scope**: 密钥值不写入本文件；不修改 .env.template 源文件

---

### TASK-G3 创建调整后的 application-prod.yml

**对应 ops_plan 步骤**：G3

**context_block**（executor 必读）：
- **What**：在服务器创建 `/opt/fj1/api/application-prod.yml`，基于 `deploy/config/application-prod.yml` 调整 3 处命名变更：`fj_inspect`→`fj1_inspect`（datasource.url）、`fj_app`→`fj1_app`（username）、`/opt/fj`→`/opt/fj1`（logging.file.name）。
- **Why**：命名变更（D2）+ 路径变更（D3）。R5 风险——部署配置硬编码 /opt/fj 需调整为 /opt/fj1，否则服务起不来。systemd 通过 `SPRING_CONFIG_ADDITIONAL_LOCATION=/opt/fj1/api/` 加载此文件。
- **Refs**：ops_plan §阶段G 步骤G3；决策 D2/D3；P4 待调整配置表；风险 R5
- **Where**:
  - `read_files`（仓库）: `deploy/config/application-prod.yml`（参考，不改源文件）
  - `allowed_write_files`（服务器）: `/opt/fj1/api/application-prod.yml`
  - `forbidden_files**: 全局禁止文件 + 仓库 `deploy/config/application-prod.yml`（不改源文件）
- **Constraints**:
  - 调整 3 处命名/路径（fj1_inspect / fj1_app / /opt/fj1）
  - 其余配置与 deploy/config/application-prod.yml 一致（端口 8080、context-path /api、Flyway enabled、HikariCP、JPA validate、CORS、Caffeine、actuator health）
  - chown fj1:fj1
- **Done When**: 文件存在；`grep fj1_inspect` 命中 datasource.url；`grep fj1_app` 命中 username；`grep /opt/fj1/api/logs` 命中 logging.file.name

**命令**（服务器执行，完整 yml 内容见 ops_plan 步骤 G3）：
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

**expected_file_changes**（服务器）:
- 新建 `/opt/fj1/api/application-prod.yml`

**verification_commands**:
- `ssh lg 'grep -q "fj1_inspect" /opt/fj1/api/application-prod.yml && grep -q "fj1_app" /opt/fj1/api/application-prod.yml && grep -q "/opt/fj1/api/logs" /opt/fj1/api/application-prod.yml && echo YML_OK'` → 期望 `YML_OK`

**verification_evidence_expected**:
- `{command: "grep 3 keys yml", expected_exit_code: 0, expected_output_pattern: "^YML_OK$", evidence_type: "file_content"}`

- **depends_on**: [TASK-G2]
- **refs**: [OPS-G3, D2, D3, R5]
- **requires_user_confirmation**: true
- **parallel**: false
- **是否破坏性**: 否
- **out_of_scope**: 不修改仓库 deploy/config/application-prod.yml 源文件

---

### TASK-G4 安装调整后的 systemd 服务 fj1-api.service

**对应 ops_plan 步骤**：G4

**context_block**（executor 必读）：
- **What**：创建 `/etc/systemd/system/fj1-api.service`，基于 `deploy/systemd/fj-api.service` 调整：`User=fj1`、`WorkingDirectory=/opt/fj1/api`、`ExecStart ... fj-api-1.0.0.jar`、`HeapDumpPath=/opt/fj1/api/logs/jvm`、`After/Wants=postgresql-16.service`、`EnvironmentFile=/opt/fj1/api/.env`。
- **Why**：命名变更（D2）+ PG16 依赖。R5 风险——systemd 配置硬编码 /opt/fj 需调整。JVM 参数针对 3.6GB RAM 调优（-Xmx768m + G1GC）。
- **Refs**：ops_plan §阶段G 步骤G4；决策 D2；P4 待调整 systemd 表；风险 R3/R5；JVM 调优说明
- **Where**:
  - `read_files`（仓库）: `deploy/systemd/fj-api.service`（参考，不改源文件）
  - `allowed_write_files`（服务器）: `/etc/systemd/system/fj1-api.service`
  - `forbidden_files**: 全局禁止文件 + 仓库 `deploy/systemd/fj-api.service`（不改源文件）
- **Constraints**:
  - 调整 User/路径/jar 名/HeapDumpPath（fj1）
  - `After=network.target postgresql-16.service` + `Wants=postgresql-16.service`（PG16 依赖）
  - JVM: -Xms512m -Xmx768m -XX:MetaspaceSize=128m -XX:MaxMetaspaceSize=192m -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:+HeapDumpOnOutOfMemoryError
  - EnvironmentFile=/opt/fj1/api/.env
  - SPRING_CONFIG_ADDITIONAL_LOCATION=/opt/fj1/api/
  - Restart=on-failure, TimeoutStartSec=90
- **Done When**: 文件存在；`grep 'User=fj1'`、`grep '/opt/fj1/api/fj-api-1.0.0.jar'`、`grep 'HeapDumpPath=/opt/fj1'` 均命中

**命令**（服务器执行，完整 service 内容见 ops_plan 步骤 G4）：
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

**expected_file_changes**（服务器）:
- 新建 `/etc/systemd/system/fj1-api.service`

**verification_commands**:
- `ssh lg 'grep -q "User=fj1" /etc/systemd/system/fj1-api.service && grep -q "/opt/fj1/api/fj-api-1.0.0.jar" /etc/systemd/system/fj1-api.service && grep -q "HeapDumpPath=/opt/fj1" /etc/systemd/system/fj1-api.service && echo SVC_OK'` → 期望 `SVC_OK`

**verification_evidence_expected**:
- `{command: "grep 3 keys service", expected_exit_code: 0, expected_output_pattern: "^SVC_OK$", evidence_type: "file_content"}`

- **depends_on**: [TASK-G3]
- **refs**: [OPS-G4, D2, R3, R5]
- **requires_user_confirmation**: true
- **parallel**: false
- **是否破坏性**: 否
- **out_of_scope**: 不修改仓库 deploy/systemd/fj-api.service 源文件；不启动服务（G6 负责）

---

### TASK-G5 加载并启用 systemd 服务

**对应 ops_plan 步骤**：G5

**context_block**（executor 必读）：
- **What**：`systemctl daemon-reload` 加载新 service 文件，`systemctl enable fj1-api.service` 设置开机自启。
- **Why**：G4 创建的 service 文件需 daemon-reload 才被 systemd 识别；enable 确保服务器重启后 fj1-api 自动启动。
- **Refs**：ops_plan §阶段G 步骤G5
- **Where**:
  - `allowed_write_files`（服务器）: systemd enable 符号链接（systemd 自管）
  - `forbidden_files**: 全局禁止文件
- **Constraints**: daemon-reload 必须在 enable 前；不 start（start 在 G6）
- **Done When**: `systemctl is-enabled fj1-api` → `enabled`；无报错

**命令**（服务器执行）：
```bash
systemctl daemon-reload
systemctl enable fj1-api.service
```

**expected_file_changes**（服务器）:
- systemd 创建 enable 符号链接

**verification_commands**:
- `ssh lg 'systemctl is-enabled fj1-api'` → 期望 `enabled`

**verification_evidence_expected**:
- `{command: "systemctl is-enabled fj1-api", expected_exit_code: 0, expected_output_pattern: "^enabled$", evidence_type: "service_status"}`

- **depends_on**: [TASK-G4]
- **refs**: [OPS-G5]
- **requires_user_confirmation**: true
- **parallel**: false
- **是否破坏性**: 否
- **out_of_scope**: 不 start 服务（G6）；不 disable 其他服务

---

### TASK-G6 启动 fj1-api（触发 Flyway V1-V7 首次迁移）

**对应 ops_plan 步骤**：G6（⚠️ 关键监控点）

**context_block**（executor 必读）：
- **What**：`systemctl start fj1-api.service` 启动 Spring Boot，触发 Flyway V1-V7 首次迁移；等待 30 秒后检查 status 和 journalctl 日志。
- **Why**：首次启动在全新 fj1_inspect 库执行 Flyway V1-V7 建表。这是端到端验证的核心——任一迁移失败即整个部署失败（G6 回滚）。
- **Refs**：ops_plan §阶段G 步骤G6；假设 A4；回滚触发 T3/T4；G6 回滚方案
- **Where**:
  - `allowed_write_files`（服务器）: fj1-api 进程（启动）、`fj1_inspect` 数据库 schema（Flyway 建表）、`/opt/fj1/api/logs/fj-api.log`
  - `forbidden_files**: 全局禁止文件
- **Constraints**:
  - start 后 `sleep 30` 等待启动 + Flyway 迁移（首次较慢）
  - TimeoutStartSec=90s（G4 配置）
  - 日志不得含 `ERROR`、`Migration failed`、`OutOfMemoryError`
  - 监控命令：`journalctl -u fj1-api | grep -iE 'flyway|error|exception'`
- **Done When**:
  - `systemctl is-active fj1-api` → `active (running)`
  - journalctl 含 `Successfully applied 7 migrations` 或迁移版本日志
  - `ss -lntp | grep :8080` → java 进程监听 8080

**命令**（服务器执行）：
```bash
systemctl start fj1-api.service
sleep 30
systemctl status fj1-api.service --no-pager
journalctl -u fj1-api.service -n 100 --no-pager
```

**expected_file_changes**（服务器）:
- 启动 fj1-api 进程（监听 8080）
- fj1_inspect 数据库新建表结构（Flyway V1-V7）
- 新建 `/opt/fj1/api/logs/fj-api.log`

**verification_commands**:
- `ssh lg 'systemctl is-active fj1-api'` → 期望 `active`
- `ssh lg 'ss -lntp | grep :8080 | grep -q java && echo LISTEN_OK'` → 期望 `LISTEN_OK`
- `ssh lg 'journalctl -u fj1-api.service --since "5 min ago" --no-pager | grep -qi "migrat" && echo FLYWAY_OK'` → 期望 `FLYWAY_OK`
- `ssh lg 'journalctl -u fj1-api.service --since "5 min ago" --no-pager | grep -iE "Migration failed|OutOfMemoryError" && echo FAIL || echo NO_FATAL'` → 期望 `NO_FATAL`

**verification_evidence_expected**:
- `{command: "systemctl is-active", expected_exit_code: 0, expected_output_pattern: "^active$", evidence_type: "service_status"}`
- `{command: "ss grep :8080", expected_exit_code: 0, expected_output_pattern: "^LISTEN_OK$", evidence_type: "port_status"}`
- `{command: "journalctl grep migrat", expected_exit_code: 0, expected_output_pattern: "^FLYWAY_OK$", evidence_type: "log_content"}`
- `{command: "journalctl grep fatal", expected_exit_code: 0, expected_output_pattern: "^NO_FATAL$", evidence_type: "log_content"}`

- **depends_on**: [TASK-G5]
- **refs**: [OPS-G6, A4, T3, T4]
- **requires_user_confirmation**: true（关键监控点）
- **parallel**: false
- **是否破坏性**: 否（首次启动，全新库）
- **out_of_scope**: 不做业务功能测试（阶段 I 仅 health check）；不做 E2E（out of scope）

---

## 阶段 H：部署前端 + Nginx（破坏性）

### TASK-H1 上传前端构建产物

**对应 ops_plan 步骤**：H1

**context_block**（executor 必读）：
- **What**：本地 `scp -r fj-web/dist/* lg:/opt/fj1/web/`，上传前端构建产物到服务器 `/opt/fj1/web/`。
- **Why**：命名变更（D3）——新前端部署到 `/opt/fj1/web/`（旧前端在 `/opt/fj/web`）。Nginx root 指向 `/opt/fj1/web`。
- **Refs**：ops_plan §阶段H 步骤H1；决策 D3；假设 A5
- **Where**:
  - `read_files`（本地）: `fj-web/dist/`（构建产物）
  - `allowed_write_files`（服务器）: `/opt/fj1/web/**`
  - `forbidden_files**: 全局禁止文件 + 本地源码 + `/opt/fj/web/**`（旧前端不动）
- **Constraints**: dist 内容（含 index.html、assets/）整体上传；API base URL 指向 /api（A5 假设，同域反代）
- **Done When**: 服务器 `/opt/fj1/web/index.html` 存在；`/opt/fj1/web/` 含 assets/ 等静态资源

**命令**（本地执行 scp）：
```bash
scp -r fj-web/dist/* lg:/opt/fj1/web/
```

**expected_file_changes**（服务器）:
- 新建 `/opt/fj1/web/**`（前端静态资源）

**verification_commands**:
- `ssh lg 'test -f /opt/fj1/web/index.html && test -d /opt/fj1/web/assets && echo WEB_OK'` → 期望 `WEB_OK`

**verification_evidence_expected**:
- `{command: "test index.html && assets", expected_exit_code: 0, expected_output_pattern: "^WEB_OK$", evidence_type: "file_existence"}`

- **depends_on**: [TASK-G6]
- **refs**: [OPS-H1, D3, A5]
- **requires_user_confirmation**: true
- **parallel**: false
- **是否破坏性**: 否
- **out_of_scope**: 不重新构建前端（产物已就绪 P2）；不动旧前端 /opt/fj/web

---

### TASK-H2 移除旧 Nginx fj.conf

**对应 ops_plan 步骤**：H2（破坏性）

**context_block**（executor 必读）：
- **What**：`mv /etc/nginx/conf.d/fj.conf /opt/fj-backup-20260702/nginx-fj.conf.removed`，移除旧 Nginx 配置（已 A3 备份）。
- **Why**：命名变更（D2）——Nginx `fj.conf`→`fj1.conf`。移除旧配置避免与 fj1.conf 冲突（两个 server 块抢 80 端口）。阶段 B 已停旧后端，移除影响可控。
- **Refs**：ops_plan §阶段H 步骤H2；决策 D2；A3 备份
- **Where**:
  - `read_files`（服务器）: `/etc/nginx/conf.d/fj.conf`
  - `allowed_write_files`（服务器）: `/opt/fj-backup-20260702/nginx-fj.conf.removed`（mv 目标）
  - `forbidden_files**: 全局禁止文件 + `/etc/nginx/nginx.conf`（主配置不动）
- **Constraints**: mv 而非 rm（保留备份副本 .removed）；阶段 A3 已备份原文件
- **Done When**: `/etc/nginx/conf.d/fj.conf` 不存在（已移走）

**命令**（服务器执行）：
```bash
mv /etc/nginx/conf.d/fj.conf /opt/fj-backup-20260702/nginx-fj.conf.removed
```

**expected_file_changes**（服务器）:
- 移除 `/etc/nginx/conf.d/fj.conf`
- 新建 `/opt/fj-backup-20260702/nginx-fj.conf.removed`

**verification_commands**:
- `ssh lg 'test -e /etc/nginx/conf.d/fj.conf && echo STILL_EXIST || test -e /opt/fj-backup-20260702/nginx-fj.conf.removed && echo REMOVED'` → 期望 `REMOVED`

**verification_evidence_expected**:
- `{command: "test fj.conf gone", expected_exit_code: 0, expected_output_pattern: "^REMOVED$", evidence_type: "file_removal"}`

- **depends_on**: [TASK-H1]
- **refs**: [OPS-H2, D2]
- **requires_user_confirmation**: true
- **parallel**: false
- **是否破坏性**: **是**（旧系统 Nginx 配置下线）
- **out_of_scope**: 不动 nginx.conf 主文件；不 reload（H4 负责）

---

### TASK-H3 创建 /etc/nginx/conf.d/fj1.conf（纯 server{} 块）

**对应 ops_plan 步骤**：H3

**context_block**（executor 必读）：
- **What**：创建 `/etc/nginx/conf.d/fj1.conf`，**纯 server{} 块**（⚠️ 不使用 `deploy/nginx/fj.conf` 的完整 nginx.conf 格式——后者含 worker_processes/events/http 顶层指令，直接放 conf.d 会与主 nginx.conf 冲突）。配置：upstream fj1_backend→127.0.0.1:8080、server listen 80、root /opt/fj1/web、SPA try_files、/api/ 反代、/internal/photos/ X-Accel-Redirect、静态资源缓存、health 端点。
- **Why**：R7 风险——deploy/nginx/fj.conf 是完整 nginx.conf 格式，放 conf.d 会导致指令重复冲突。H3 创建纯 server{} 块由主 nginx.conf 的 http{} include。命名变更（D2）+ 照片 X-Accel-Redirect（/data/photos）。
- **Refs**：ops_plan §阶段H 步骤H3；决策 D2；风险 R7；P4 nginx 说明
- **Where**:
  - `read_files`（仓库）: `deploy/nginx/fj.conf`（参考格式，不直接使用）
  - `allowed_write_files`（服务器）: `/etc/nginx/conf.d/fj1.conf`
  - `forbidden_files**: 全局禁止文件 + 仓库 `deploy/nginx/fj.conf`（不改源文件）+ `/etc/nginx/nginx.conf`
- **Constraints**:
  - ⚠️ 必须是纯 server{} 块，**不含** worker_processes/events{/http{ 顶层指令
  - client_max_body_size 15m（照片分片上传）
  - /internal/photos/ internal + alias /data/photos/
  - /api/ proxy_pass http://fj1_backend（保持 /api 前缀）
- **Done When**: 文件存在；`grep '/opt/fj1/web'`、`grep 'fj1_backend'`、`grep '127.0.0.1:8080'` 命中；文件不含 `worker_processes`/`events{`/`http{`

**命令**（服务器执行，完整配置见 ops_plan 步骤 H3）：
```bash
cat > /etc/nginx/conf.d/fj1.conf <<'EOF'
# FJ1 飞检系统 — Nginx server 块（由 /etc/nginx/nginx.conf 的 http{} include）
upstream fj1_backend {
    server 127.0.0.1:8080;
    keepalive 16;
}
server {
    listen 80;
    server_name _;
    client_max_body_size 15m;
    root /opt/fj1/web;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
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
    location /internal/photos/ {
        internal;
        alias /data/photos/;
    }
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    location /api/actuator/health {
        proxy_pass http://fj1_backend;
        access_log off;
    }
}
EOF
```

**expected_file_changes**（服务器）:
- 新建 `/etc/nginx/conf.d/fj1.conf`

**verification_commands**:
- `ssh lg 'grep -q "/opt/fj1/web" /etc/nginx/conf.d/fj1.conf && grep -q "fj1_backend" /etc/nginx/conf.d/fj1.conf && grep -q "127.0.0.1:8080" /etc/nginx/conf.d/fj1.conf && echo CONF_OK'` → 期望 `CONF_OK`
- `ssh lg 'grep -qE "worker_processes|events\s*\{|^http\s*\{" /etc/nginx/conf.d/fj1.conf && echo BAD_FORMAT || echo PURE_SERVER'` → 期望 `PURE_SERVER`

**verification_evidence_expected**:
- `{command: "grep 3 keys", expected_exit_code: 0, expected_output_pattern: "^CONF_OK$", evidence_type: "file_content"}`
- `{command: "grep forbidden directives", expected_exit_code: 0, expected_output_pattern: "^PURE_SERVER$", evidence_type: "format_check"}`

- **depends_on**: [TASK-H2]
- **refs**: [OPS-H3, D2, R7]
- **requires_user_confirmation**: true
- **parallel**: false
- **是否破坏性**: 否
- **out_of_scope**: 不使用 deploy/nginx/fj.conf 完整格式；不 reload（H4）；不改主 nginx.conf

---

### TASK-H4 测试并重载 Nginx

**对应 ops_plan 步骤**：H4（破坏性）

**context_block**（executor 必读）：
- **What**：`nginx -t` 测试配置语法，`systemctl reload nginx` 平滑重载。然后 curl 验证前端 200。
- **Why**：H3 新配置生效的关键步骤。R7 风险——配置语法错误会导致 nginx -t 失败（H4 回滚）。reload 影响线上 80 端口所有站点（<1s 中断）。
- **Refs**：ops_plan §阶段H 步骤H4；风险 R7；回滚触发 T7/T8；H4 回滚方案
- **Where**:
  - `allowed_write_files`（服务器）: nginx 运行时配置（reload 生效）
  - `forbidden_files**: 全局禁止文件 + `/etc/nginx/conf.d/fj1.conf`（H3 已建，不改）
- **Constraints**:
  - 必须 `nginx -t` 通过后才 reload（fail-stop）
  - reload 而非 restart（平滑，连接不中断）
- **Done When**:
  - `nginx -t` 输出 `syntax is ok` 和 `test is successful`
  - `curl -I http://10.0.12.12/` → HTTP 200，Content-Type: text/html

**命令**（服务器执行）：
```bash
nginx -t
systemctl reload nginx
```

**expected_file_changes**（服务器）:
- nginx 应用新配置（运行时）

**verification_commands**:
- `ssh lg 'nginx -t 2>&1 | grep -q "test is successful" && echo TEST_OK'` → 期望 `TEST_OK`
- `ssh lg 'curl -sI http://10.0.12.12/ | head -1 | grep -q "200" && echo HTTP_200'` → 期望 `HTTP_200`

**verification_evidence_expected**:
- `{command: "nginx -t", expected_exit_code: 0, expected_output_pattern: "^TEST_OK$", evidence_type: "config_test"}`
- `{command: "curl -I /", expected_exit_code: 0, expected_output_pattern: "^HTTP_200$", evidence_type: "http_response"}`

- **depends_on**: [TASK-H3]
- **refs**: [OPS-H4, R7, T7, T8]
- **requires_user_confirmation**: true（破坏性，线上 Nginx 配置生效）
- **parallel**: false
- **是否破坏性**: **是**（线上 Nginx 配置生效）
- **out_of_scope**: 不配置 HTTPS/TLS（out of scope）；不重启 nginx（用 reload）

---

## 阶段 I：验证

### TASK-I1 后端直连健康检查

**对应 ops_plan 步骤**：I1

**context_block**（executor 必读）：
- **What**：`curl -s http://localhost:8080/api/actuator/health` 直连后端（绕过 Nginx）。
- **Why**：验证 Spring Boot + Flyway + DB 连接正常。若此步失败说明后端本身有问题（G6 回滚触发 T5）。
- **Refs**：ops_plan §阶段I 步骤I1；回滚触发 T5
- **Where**:
  - `allowed_write_files`（服务器）: 无（只读验证）
  - `forbidden_files**: 全局禁止文件
- **Constraints**: 直连 localhost:8080（不经 Nginx）；期望 JSON `{"status":"UP"}`
- **Done When**: 返回 `{"status":"UP"}`

**命令**（服务器执行）：
```bash
curl -s http://localhost:8080/api/actuator/health
```

**expected_file_changes**（服务器）: 无（只读）

**verification_commands**:
- `ssh lg 'curl -s http://localhost:8080/api/actuator/health | grep -q "\"status\":\"UP\"" && echo HEALTH_UP'` → 期望 `HEALTH_UP`

**verification_evidence_expected**:
- `{command: "curl health", expected_exit_code: 0, expected_output_pattern: "^HEALTH_UP$", evidence_type: "http_response"}`

- **depends_on**: [TASK-H4]
- **refs**: [OPS-I1, T5]
- **requires_user_confirmation**: false
- **parallel**: false
- **是否破坏性**: 否
- **out_of_scope**: 不做业务接口测试；不做性能压测

---

### TASK-I2 前端页面访问

**对应 ops_plan 步骤**：I2

**context_block**（executor 必读）：
- **What**：`curl -s http://10.0.12.12/ | head -20`，经 Nginx 访问前端首页。
- **Why**：验证 Nginx 静态托管 + SPA 入口正常。
- **Refs**：ops_plan §阶段I 步骤I2
- **Where**:
  - `allowed_write_files`（服务器）: 无（只读）
  - `forbidden_files**: 全局禁止文件
- **Constraints**: 经 Nginx 80 端口；期望 HTML 含 React SPA 入口（`<div id="root">`）
- **Done When**: 返回 HTML，含 `<div id="root">` 或 React SPA 标记

**命令**（服务器执行）：
```bash
curl -s http://10.0.12.12/ | head -20
```

**expected_file_changes**（服务器）: 无

**verification_commands**:
- `ssh lg 'curl -s http://10.0.12.12/ | grep -q "id=\"root\"\|<div id=\"root\"" && echo SPA_OK'` → 期望 `SPA_OK`

**verification_evidence_expected**:
- `{command: "curl / | grep root", expected_exit_code: 0, expected_output_pattern: "^SPA_OK$", evidence_type: "http_response"}`

- **depends_on**: [TASK-I1]
- **refs**: [OPS-I2]
- **requires_user_confirmation**: false
- **parallel**: false
- **是否破坏性**: 否
- **out_of_scope**: 不渲染 JS（仅 HTML 源码检查）；不做前端功能测试

---

### TASK-I3 全链路 API 健康检查（经 Nginx）

**对应 ops_plan 步骤**：I3

**context_block**（executor 必读）：
- **What**：`curl -s http://10.0.12.12/api/actuator/health`，经 Nginx 反代访问后端 health。
- **Why**：验证 Nginx → SpringBoot:8080 反代链路通（端到端）。区别于 I1（直连），I3 经 Nginx。若失败说明反代配置有问题（H4 回滚触发 T8）。
- **Refs**：ops_plan §阶段I 步骤I3；回滚触发 T8
- **Where**:
  - `allowed_write_files`（服务器）: 无（只读）
  - `forbidden_files**: 全局禁止文件
- **Constraints**: 经 Nginx /api/ 路径；期望 `{"status":"UP"}`
- **Done When**: 返回 `{"status":"UP"}`（证明 Nginx → SpringBoot:8080 反代通）

**命令**（服务器执行）：
```bash
curl -s http://10.0.12.12/api/actuator/health
```

**expected_file_changes**（服务器）: 无

**verification_commands**:
- `ssh lg 'curl -s http://10.0.12.12/api/actuator/health | grep -q "\"status\":\"UP\"" && echo E2E_UP'` → 期望 `E2E_UP`

**verification_evidence_expected**:
- `{command: "curl /api/health", expected_exit_code: 0, expected_output_pattern: "^E2E_UP$", evidence_type: "http_response"}`

- **depends_on**: [TASK-I2]
- **refs**: [OPS-I3, T8]
- **requires_user_confirmation**: false
- **parallel**: false
- **是否破坏性**: 否
- **out_of_scope**: 不做业务 API 功能测试；不做认证测试

---

### TASK-I4 内存检查（防 OOM）

**对应 ops_plan 步骤**：I4

**context_block**（executor 必读）：
- **What**：`free -h` 检查内存；`dmesg | grep -i 'killed process'` 检查 OOM killer。
- **Why**：R3 风险——3.6GB RAM 下 JVM+PG 可能 OOM。验证部署后内存余量充足，无 java 进程被 OOM killer 杀（回滚触发 T6）。
- **Refs**：ops_plan §阶段I 步骤I4；风险 R3；回滚触发 T6
- **Where**:
  - `allowed_write_files`（服务器）: 无（只读）
  - `forbidden_files**: 全局禁止文件
- **Constraints**: available ≥ 500MB；dmesg 无 java 被 killed 记录
- **Done When**: available ≥ 500MB；无 OOM；dmesg 无 java killed

**命令**（服务器执行）：
```bash
free -h
dmesg | grep -i 'killed process' | head -5
```

**expected_file_changes**（服务器）: 无

**verification_commands**:
- `ssh lg 'free -m | awk "/Mem:/{print \$7}"'` → 期望数值 ≥ 500（available MB）
- `ssh lg 'dmesg | grep -i "killed process" | grep -qi java && echo JAVA_OOM || echo NO_OOM'` → 期望 `NO_OOM`

**verification_evidence_expected**:
- `{command: "free -m available", expected_exit_code: 0, expected_output_pattern: "^[5-9][0-9]{2,}$|^[0-9]{4,}$", evidence_type: "memory_metric"}`
- `{command: "dmesg grep java killed", expected_exit_code: 0, expected_output_pattern: "^NO_OOM$", evidence_type: "kernel_log"}`

- **depends_on**: [TASK-I3]
- **refs**: [OPS-I4, R3, T6]
- **requires_user_confirmation**: false
- **parallel**: false
- **是否破坏性**: 否
- **out_of_scope**: 不调整 JVM 参数（若 OOM 走 G6 回滚重试）；不监控长期趋势

---

### TASK-I5 服务日志检查

**对应 ops_plan 步骤**：I5

**context_block**（executor 必读）：
- **What**：`journalctl -u fj1-api.service --since "10 min ago" | grep -iE 'error|exception|warn' | head -20`，检查启动后日志。
- **Why**：捕获健康检查无法发现的运行时错误/异常（如 Hibernate 警告、连接泄漏）。WARN 可接受但需人工 review；ERROR/Exception 必须处理。
- **Refs**：ops_plan §阶段I 步骤I5
- **Where**:
  - `allowed_write_files`（服务器）: 无（只读日志）
  - `forbidden_files**: 全局禁止文件
- **Constraints**: 仅检查近 10 分钟日志；ERROR/Exception 须为 0；WARN 可接受需 review
- **Done When**: 无 ERROR / Exception（exit 0 时 grep 无匹配）；WARN 可接受

**命令**（服务器执行）：
```bash
journalctl -u fj1-api.service --since "10 min ago" --no-pager | grep -iE 'error|exception|warn' | head -20
```

**expected_file_changes**（服务器）: 无

**verification_commands**:
- `ssh lg 'journalctl -u fj1-api.service --since "10 min ago" --no-pager | grep -iE "error|exception" | grep -vi "warn" | head -5; rc=$?; [ $rc -eq 1 ] && echo NO_ERROR || echo HAS_ERROR'` → 期望 `NO_ERROR`（grep 无匹配 exit 1）

**verification_evidence_expected**:
- `{command: "journalctl grep error|exception", expected_exit_code: 0, expected_output_pattern: "^NO_ERROR$", evidence_type: "log_content"}`

- **depends_on**: [TASK-I4]
- **refs**: [OPS-I5]
- **requires_user_confirmation**: false
- **parallel**: false
- **是否破坏性**: 否
- **out_of_scope**: 不修复发现的 bug（如需则回 WI-0001/WI-0002 修 jar 后重部署）；不做长期日志监控接入

---

## Task 统计

| 维度 | 值 |
|------|-----|
| 总 task 数 | 28 |
| 阶段 | 9（A-I） |
| 串行 task（parallel=false） | 28（全部） |
| 并行批次 | 0（ops_plan 全部串行） |
| 破坏性 task | 3（TASK-C1, TASK-H2, TASK-H4） |
| requires_user_confirmation=true | 22（A1-A4, B1-B3, C1, G1-G6, H1-H4） |
| requires_user_confirmation=false | 6（D1, E1, F1-F3, I1-I5） |
| 全部 task 含 context_block | ✅ |
| 全部 task 含 verification_commands | ✅ |
| 全部 task 含 verification_evidence_expected | ✅ |
| 全部 task 含 out_of_scope | ✅ |
| 全部 task 含 allowed_write_files | ✅ |
| 全部 task 含 forbidden_files | ✅ |

## 覆盖完整性自检

- ✅ ops_plan 28 步骤全部映射（A1-A4, B1-B3, C1, D1, E1, F1-F3, G1-G6, H1-H4, I1-I5）
- ✅ 每个 task 唯一 task_id（TASK-A1 ... TASK-I5）
- ✅ 每个 task 引用对应 ops_plan 步骤
- ✅ 每个 task 有可机器验证的 verification_commands
- ✅ 依赖链完整无循环（A→B→C→D→E→F→G→H→I 线性）
- ✅ 破坏性步骤（C1/H2/H4）显式标记 + 对应回滚方案
- ✅ requires_user_confirmation 从 ops_plan 继承
- ✅ 密钥纪律：DB_PASSWORD/JWT_SECRET/FJ_DB_PASSWORD 不写入本文件
