# WI-0003 影响分析

**Work Item**: WI-0003
**日期**: 2026-07-02

## 1. 受影响组件

### 服务器 svr-lg (10.0.12.12)
| 组件 | 当前 | 变更后 | 影响 |
|------|------|--------|------|
| PostgreSQL | 13.23 (md5 认证) | 16 (scram-sha-256) | PG13 数据备份后销毁 |
| Java | 未安装 | JRE17 headless | 新增 |
| PM2 fj-server | online 28D | 停止 | 旧 NestJS 系统下线 |
| Nginx fj.conf | 反代 3000 | fj1.conf 反代 8080 + SPA | 旧配置备份替换 |
| /opt/fj/ | 旧系统 | 备份后清理 | 旧系统文件归档 |
| /opt/fj1/ | 不存在 | 新系统部署目标 | 新建 |
| 端口 3000 | PM2 占用 | 释放 | — |
| 端口 8080 | 空闲 | Spring Boot | — |
| 内存 | 1.0G used | ~2.3G used (JVM+PG) | 3.6G 总量，2.3G available 可承载 |

### PG13 备份策略
- pg_hba.conf: `local all all md5`（需密码，postgres 密码未知）
- 备份方案: 临时改 pg_hba → trust → pg_dump all → 恢复；或文件级 cp 整个 data 目录（需停服务）
- 推荐双保险：文件级备份 + 逻辑备份

### 命名变更影响
| WI-0002 产物 | 需调整为 |
|-------------|---------|
| deploy/systemd/fj-api.service | fj1-api.service (User=fj1, paths=/opt/fj1) |
| deploy/nginx/fj.conf | fj1.conf (root /opt/fj1/web) |
| deploy/config/application-prod.yml | paths /opt/fj1 |
| scripts/ops/init_database.sh | DB fj_app→fj1_app, fj_inspect→fj1_inspect |
| scripts/ops/deploy_backend.sh | /opt/fj→/opt/fj1 |

## 2. 不受影响
- 本地代码仓库（不修改业务源码）
- Android 工程（不在范围）
- 其他服务器

## 3. 风险评估
- R1(高): PG13 postgres 密码未知 → 临时改 pg_hba trust 备份
- R2(高): 系统首次运行 → fail-stop 逐步验证
- R3(中): 内存紧张 → -Xmx768m + shared_buffers=512MB + Swap
- R4(中): Flyway 首次迁移 → 失败回滚 jar
- R5(高): 旧系统下线后新系统启动失败 → 保留备份 + 回滚方案
