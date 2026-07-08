# WI-0003 Intake — fj1 飞检系统服务器部署

**Work Item**: WI-0003
**Workflow**: ops_task / task_change_path
**创建时间**: 2026-07-02

---

## 1. 操作目标和业务背景

将 WI-0001/WI-0002 完成的 fj1 飞检现场管理系统（Java 17 + Spring Boot 后端 + React Web 前端）首次部署到生产服务器 svr-lg，使系统真正运行起来。

**目标**：
- 后端 fat jar 部署 + systemd 服务 + Flyway 首次迁移 + API 冒烟
- 前端 dist 静态托管 + Nginx 反代
- 全链路：Nginx:80 → /api → SpringBoot:8080，/ → React SPA

---

## 2. 目标环境

| 项 | 值 |
|----|-----|
| 服务器 | svr-lg (内网 10.0.12.12) |
| OS | CentOS Stream 9 |
| 登录 | `ssh lg`（root 权限） |
| RAM | 3.6GB total，2.3GB available |
| Swap | 4.0GB（已配置） |
| 磁盘 | 40G，23GB 可用 |
| PG | 当前 13.23（active），目标全新安装 16 |
| Java | 当前未安装，目标 JRE17 headless |
| Nginx | 1.20.1（active，服务旧系统） |

---

## 3. 服务器现状（2026-07-02 探测）

### ⚠️ 重大冲突：已有旧版飞检系统运行中

服务器上存在一套 **NestJS (Node.js) 旧版飞检系统**，在线运行 28 天：

| 旧系统组件 | 状态 |
|-----------|------|
| PM2 `fj-server` | online 28D，pid 2467114，占内存 137.8MB |
| 端口 3000 | 被 PM2 node 进程占用 |
| `/opt/fj/server/` | NestJS 后端（dist/main.js） |
| `/opt/fj/web/` | 旧版前端 |
| `/opt/fj/web-build/` | 构建产物 |
| `/opt/fj/uploads/` | 旧系统上传文件 |
| Nginx `fj.conf` | 反代 127.0.0.1:3000，root /opt/fj/web |
| PG13 | 旧系统数据库（psql -l 访问失败，postgres 用户有密码） |

### 端口状态
- 80: Nginx 占用（服务旧系统）
- 3000: PM2 fj-server 占用
- 8080: **空闲**

### 缺失
- 无 Java/JRE
- 无 fj 系统用户
- 无 fj systemd 服务

---

## 4. 用户决策（D1-D5）

### D1: 旧系统处理 → 停用替换
- 停止 PM2 `fj-server`
- 新系统接管，不再保留旧系统在线

### D2: 命名变更 fj → fj1
**所有 `fj` 命名变更为 `fj1`**，避免与旧系统混淆：

| 旧 | 新 |
|----|-----|
| `/opt/fj/api/` | `/opt/fj1/api/` |
| `/opt/fj/web/` (新前端) | `/opt/fj1/web/` |
| 系统用户 `fj` | `fj1` |
| systemd `fj-api.service` | `fj1-api.service` |
| Nginx `fj.conf` | `fj1.conf` |
| DB 用户 `fj_app` | `fj1_app` |
| DB 库名 `fj_inspect` | `fj1_inspect` |

### D3: /opt/fj/ 备份后清理
- 旧系统 `/opt/fj/` 整体备份到安全位置（如 `/opt/fj-backup-20260702/`）
- 备份后清理旧目录，新系统部署到 `/opt/fj1/`

### D4: PG13 数据先备份再销毁
- 先对 PG13 中旧系统数据做 `pg_dump` 备份（文件级或逻辑备份）
- 即使 postgres 用户密码未知，需设法备份（修改 pg_hba 为 trust 临时访问，或文件级 copy）
- 备份完成后销毁 PG13 → 全新安装 PG16

### D5: 后端 + 前端一起部署
- 本次同时部署后端 API 和 Web 前端
- Nginx 同域：/ → React SPA，/api → SpringBoot:8080

---

## 5. 密钥策略（不写入 committed 区）

| 变量 | 来源 | 值 |
|------|------|----|
| `FJ1_DB_PASSWORD` | 用户提供 | （仅写入服务器 .env，不进 Git） |
| `JWT_SECRET` | Agent 生成（openssl rand -base64 48） | （仅写入服务器 .env，不进 Git） |
| `DB_USER` | 命名变更 | `fj1_app` |
| `DB_NAME` | 命名变更 | `fj1_inspect` |
| `CORS_ALLOWED_ORIGINS` | 服务器 IP | `http://10.0.12.12` |

密钥仅写入服务器 `/opt/fj1/api/.env`（chmod 600），不写入 intake.md / ops_plan.md / 任何 Git 跟踪文件。

---

## 6. 操作时间窗口和约束

- **时间**：即时执行
- **停机窗口**：旧系统在 PM2 停止时下线，新系统部署完成后恢复服务
- **内存约束**：3.6GB RAM 紧张。需确保：旧 PM2 停止（释放 ~138MB）→ JVM -Xmx768m + PG16 shared_buffers=512MB，合计约 1.3GB，available 2.3GB 可承载
- **sudo 拦截**：sf_safe_bash 拦截 sudo；`ssh lg` 直接为 root，无需 sudo 前缀

---

## 7. 已知风险

| # | 风险 | 等级 | 缓解 |
|---|------|------|------|
| R1 | PG13 postgres 密码未知，无法 pg_dump | 高 | 修改 pg_hba.conf 为 trust 临时访问后备份 |
| R2 | 系统从未运行过，首次启动可能失败 | 高 | fail-stop 协议，逐步骤验证 |
| R3 | 3.6GB RAM，JVM+PG 可能 OOM | 中 | -Xmx768m + shared_buffers=512MB + Swap 4GB 兜底 |
| R4 | Flyway V1-V7 首次在 PG16 执行可能不兼容 | 中 | 失败则回滚 jar + 日志分析 |
| R5 | 部署脚本硬编码 /opt/fj，需调整为 /opt/fj1 | 中 | 执行前调整脚本/配置或运行时覆盖路径 |
| R6 | 旧系统下线后新系统启动失败 = 服务全断 | 高 | 保留旧系统备份 + 回滚方案 |

---

## 8. 不在本次范围

- Android 原生工程（单独 WI）
- 运行时 E2E 全流程测试（部署冒烟后另开任务）
