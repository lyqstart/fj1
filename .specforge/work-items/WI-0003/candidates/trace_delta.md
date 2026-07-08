# Trace Delta: WI-0003

> **Work Item**: WI-0003
> **Workflow**: ops_task / task_change_path
> **派生源**: ops_plan.md（design.md）28 步骤 → tasks.md 28 tasks
> **生成时间**: 2026-07-02
> **执行服务器**: svr-lg (10.0.12.12, `ssh lg` root)

---

## 追溯说明

本 WI 为 **ops_task**（运维部署），无传统 REQ/AC/DD 软件需求追溯。追溯维度为：
**OPS_PLAN_STEP → TASK_ID → TARGET_FILE（服务器目标文件/目录）→ VERIFICATION**

所有目标文件/目录均位于服务器 svr-lg（非本地仓库）。命名变更映射（D2 决策）已体现在目标路径（fj→fj1）。

---

## 追溯矩阵（完整 28 步骤）

| OPS_PLAN步骤 | TASK_ID | 目标文件/目录(服务器) | 创建/修改/删除/进程 | 破坏性 | 验证方式 |
|-------------|---------|---------------------|---------------------|--------|---------|
| A1 | TASK-A1 | `/opt/pg13-backup-20260702/data` + `postgresql.service`(stop/start) | 创建（备份） | 否 | `cat PG_VERSION` → 13；`systemctl is-active postgresql` → active |
| A2 | TASK-A2 | `/opt/fj-backup-20260702/fj` | 创建（备份） | 否 | `ls -d {server,web,web-build,uploads}` 全部存在 |
| A3 | TASK-A3 | `/opt/fj-backup-20260702/nginx-fj.conf` | 创建（备份） | 否 | `test -s` 文件存在且非空 |
| A4 | TASK-A4 | `/opt/fj-backup-20260702/pm2-list.txt`、`/opt/fj-backup-20260702/pm2-dump.json` | 创建（备份） | 否 | 两文件均 `test -s` 非空 |
| B1 | TASK-B1 | PM2 `fj-server` 进程（stop） | 进程（停止） | 否 | `pm2 list` fj-server=stopped；`:3000` 空闲 |
| B2 | TASK-B2 | PM2 `fj-server` 进程（delete） | 进程（删除） | 否 | `pm2 list` 无 fj-server |
| B3 | TASK-B3 | PM2 dump（`~/.pm2/dump.pm2`） | 修改（覆盖） | 否 | `pm2 save` 成功；list 无 fj-server |
| C1 | TASK-C1 | `/var/lib/pgsql/16/data/`、`postgresql.conf`、`pg_hba.conf`、`postgresql-16.service`；销毁 `/var/lib/pgsql/data`(PG13) | 创建+删除（PG16 新装/PG13 销毁） | **是** | `systemctl is-active postgresql-16`=active；`psql --version` 16.x；conf 含 512MB/50/Asia/Shanghai |
| D1 | TASK-D1 | `/etc/profile.d/fj_java_home.sh` + JRE17 包 | 创建（安装） | 否 | `java -version` 17.x；profile.d 文件存在 |
| E1 | TASK-E1 | PG16 角色 `fj1_app` + 数据库 `fj1_inspect` | 创建（DB 对象） | 否 | `pg_roles` fj1_app=1；`fj1_inspect` owner=fj1_app |
| F1 | TASK-F1 | 系统用户 `fj1` + home `/opt/fj1` | 创建（用户） | 否 | `id fj1` 返回 uid |
| F2 | TASK-F2 | `/opt/fj1/api`、`/opt/fj1/web`、`/opt/fj1/api/logs`、`/data/photos` | 创建（目录） | 否 | 4 目录 `ls -ld` 存在 |
| F3 | TASK-F3 | `/opt/fj1/**`、`/data/photos/**`（属主） | 修改（chown） | 否 | `stat %U:%G` = fj1:fj1 |
| G1 | TASK-G1 | `/opt/fj1/api/fj-api-1.0.0.jar` | 创建（上传 78M） | 否 | 文件存在且 size > 70M |
| G2 | TASK-G2 | `/opt/fj1/api/.env`（600, fj1:fj1） | 创建（密钥） | 否 | stat 600 fj1:fj1；含 5 键 |
| G3 | TASK-G3 | `/opt/fj1/api/application-prod.yml` | 创建（配置） | 否 | grep fj1_inspect/fj1_app//opt/fj1/api/logs 命中 |
| G4 | TASK-G4 | `/etc/systemd/system/fj1-api.service` | 创建（systemd） | 否 | grep User=fj1/jar 路径/HeapDumpPath 命中 |
| G5 | TASK-G5 | systemd enable 符号链接（`fj1-api.service`） | 创建（enable） | 否 | `systemctl is-enabled` = enabled |
| G6 | TASK-G6 | `fj1-api` 进程（8080）+ `fj1_inspect` schema（Flyway V1-V7）+ `/opt/fj1/api/logs/fj-api.log` | 创建（启动+建表） | 否 | is-active=active；:8080 监听；日志含 migrat；无 fatal |
| H1 | TASK-H1 | `/opt/fj1/web/**`（前端静态资源） | 创建（上传） | 否 | index.html + assets/ 存在 |
| H2 | TASK-H2 | 移除 `/etc/nginx/conf.d/fj.conf` → `/opt/fj-backup-20260702/nginx-fj.conf.removed` | 删除+创建（mv） | **是** | `/etc/nginx/conf.d/fj.conf` 不存在；.removed 存在 |
| H3 | TASK-H3 | `/etc/nginx/conf.d/fj1.conf`（纯 server{} 块） | 创建（Nginx 配置） | 否 | grep 3 keys 命中；不含 worker_processes/events{/http{ |
| H4 | TASK-H4 | nginx 运行时配置（reload 生效） | 修改（reload） | **是** | `nginx -t` test is successful；curl / → 200 |
| I1 | TASK-I1 | （只读）`http://localhost:8080/api/actuator/health` | 无（验证） | 否 | 返回 `{"status":"UP"}` |
| I2 | TASK-I2 | （只读）`http://10.0.12.12/` | 无（验证） | 否 | HTML 含 `<div id="root">` |
| I3 | TASK-I3 | （只读）`http://10.0.12.12/api/actuator/health` | 无（验证） | 否 | 返回 `{"status":"UP"}` |
| I4 | TASK-I4 | （只读）`free -h`、`dmesg` | 无（验证） | 否 | available ≥ 500MB；无 java OOM killed |
| I5 | TASK-I5 | （只读）`journalctl -u fj1-api` | 无（验证） | 否 | 无 ERROR/Exception |

---

## 文件覆盖（服务器目标文件汇总）

| 文件/目录(服务器) | 操作 | 涉及 OPS步骤 | 涉及 TASK |
|------------------|------|-------------|-----------|
| `/opt/pg13-backup-20260702/data` | 创建 | A1 | TASK-A1 |
| `/opt/fj-backup-20260702/fj` | 创建 | A2 | TASK-A2 |
| `/opt/fj-backup-20260702/nginx-fj.conf` | 创建 | A3 | TASK-A3 |
| `/opt/fj-backup-20260702/pm2-list.txt` | 创建 | A4 | TASK-A4 |
| `/opt/fj-backup-20260702/pm2-dump.json` | 创建 | A4 | TASK-A4 |
| PM2 `fj-server` 进程 | 停止+删除 | B1, B2 | TASK-B1, TASK-B2 |
| `~/.pm2/dump.pm2` | 修改 | B3 | TASK-B3 |
| `/var/lib/pgsql/16/data/` | 创建 | C1 | TASK-C1 |
| `/var/lib/pgsql/16/data/postgresql.conf` | 创建 | C1 | TASK-C1 |
| `/var/lib/pgsql/16/data/pg_hba.conf` | 创建 | C1 | TASK-C1 |
| `postgresql-16.service`（systemd） | 创建 | C1 | TASK-C1 |
| `/var/lib/pgsql/data`（PG13 旧） | 删除 | C1 | TASK-C1 |
| `/etc/profile.d/fj_java_home.sh` | 创建 | D1 | TASK-D1 |
| JRE17 包 | 创建（安装） | D1 | TASK-D1 |
| PG 角色 `fj1_app` | 创建 | E1 | TASK-E1 |
| PG 数据库 `fj1_inspect` | 创建 | E1 | TASK-E1 |
| 系统用户 `fj1` | 创建 | F1 | TASK-F1 |
| `/opt/fj1`（home） | 创建 | F1 | TASK-F1 |
| `/opt/fj1/api` | 创建 | F2 | TASK-F2 |
| `/opt/fj1/web` | 创建 | F2 | TASK-F2 |
| `/opt/fj1/api/logs` | 创建 | F2 | TASK-F2 |
| `/data/photos` | 创建 | F2 | TASK-F2 |
| `/opt/fj1/**`（属主） | 修改 | F3 | TASK-F3 |
| `/data/photos/**`（属主） | 修改 | F3 | TASK-F3 |
| `/opt/fj1/api/fj-api-1.0.0.jar` | 创建 | G1 | TASK-G1 |
| `/opt/fj1/api/.env` | 创建 | G2 | TASK-G2 |
| `/opt/fj1/api/application-prod.yml` | 创建 | G3 | TASK-G3 |
| `/etc/systemd/system/fj1-api.service` | 创建 | G4 | TASK-G4 |
| systemd enable 链（`fj1-api`） | 创建 | G5 | TASK-G5 |
| `fj1-api` 进程（8080） | 创建（启动） | G6 | TASK-G6 |
| `fj1_inspect` schema（Flyway V1-V7） | 创建 | G6 | TASK-G6 |
| `/opt/fj1/api/logs/fj-api.log` | 创建 | G6 | TASK-G6 |
| `/opt/fj1/web/**`（前端资源） | 创建 | H1 | TASK-H1 |
| `/etc/nginx/conf.d/fj.conf` | 删除（mv 走） | H2 | TASK-H2 |
| `/opt/fj-backup-20260702/nginx-fj.conf.removed` | 创建 | H2 | TASK-H2 |
| `/etc/nginx/conf.d/fj1.conf` | 创建 | H3 | TASK-H3 |
| nginx 运行时配置 | 修改（reload） | H4 | TASK-H4 |

## 命名变更映射覆盖（D2 决策验证）

| 旧 | 新 | 涉及 TASK | 验证方式 |
|----|-----|-----------|---------|
| `/opt/fj/api/` | `/opt/fj1/api/` | F2, G1-G6 | TASK-G3 grep `/opt/fj1/api/logs` |
| `/opt/fj/web/` | `/opt/fj1/web/` | F2, H1, H3 | TASK-H3 grep `/opt/fj1/web` |
| 系统用户 `fj` | `fj1` | F1, F3, G2, G4 | TASK-F1 `id fj1`；TASK-G4 grep `User=fj1` |
| systemd `fj-api.service` | `fj1-api.service` | G4, G5, G6 | TASK-G5 `is-enabled fj1-api` |
| Nginx `fj.conf` | `fj1.conf` | H2, H3, H4 | TASK-H2 fj.conf 移除；TASK-H3 fj1.conf 创建 |
| DB 用户 `fj_app` | `fj1_app` | E1, G2, G3 | TASK-E1 pg_roles fj1_app |
| DB 库名 `fj_inspect` | `fj1_inspect` | E1, G3, G6 | TASK-E1 fj1_inspect owner；TASK-G3 grep fj1_inspect |
| jar 名 `fj-api.jar` | `fj-api-1.0.0.jar` | G1, G4 | TASK-G4 grep `fj-api-1.0.0.jar` |

---

## 覆盖统计

| 指标 | 值 |
|------|-----|
| 总 OPS_PLAN 步骤数 | 28 |
| 总 TASK 数 | 28 |
| 步骤→TASK 完全覆盖 | 28/28 ✅ |
| 无悬空 OPS 步骤 | ✅（全部映射） |
| 无悬空 TASK | ✅（全部反向映射到 OPS 步骤） |
| 服务器目标文件覆盖 | 38 项（含进程/服务/DB 对象） |
| 破坏性步骤 | 3（C1/H2/H4）+ 对应回滚方案引用 |
| requires_user_confirmation 步骤 | 22 |
| 命名变更映射（D2）覆盖 | 8/8 ✅ |
| 每个 TASK 有验证方式 | 28/28 ✅ |
| 每个目标文件有归属 TASK | ✅ |

---

## 自检（V7 强制）

1. ✅ 每个 OPS_PLAN 步骤是否至少关联一个 TASK？ → 28/28 全覆盖
2. ✅ 每个 TASK 是否有明确目标文件/进程/服务？ → 全部声明（I1-I5 为只读验证，目标为 HTTP 端点/系统指标）
3. ✅ 每个目标文件是否有验证方式？ → 全部 verification_commands 已定义于 tasks.md
4. ✅ trace_delta.md 是否真实写入？ → 本文件即为产物
5. ✅ 破坏性步骤是否标记 + 有回滚方案引用？ → C1/H2/H4 标记，回滚方案见 ops_plan.md
6. ✅ 命名变更映射（D2）是否在 trace 中体现？ → 8 项全部覆盖且可验证
