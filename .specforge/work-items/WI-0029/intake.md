# WI-0029 Intake: 日志系统真正接通

## 问题
WI-0028 声称实现了日志远程上传，但实际：
1. 后端没有 /api/v1/logs/batch 端点
2. Logger.flush() 是占位符，没有调用 LogPersistenceManager
3. 日志根本没有上传到服务器

## 方案（文件存储，不走数据库）

### 后端
1. 新建 AppLogController: POST /api/v1/logs/batch
2. 日志写入文件 /opt/fj/api/logs/app-logs/app-yyyy-MM-dd.log
3. SecurityConfig 加入 permitAll 白名单（未认证也可上传）

### 前端
1. Logger.ts: flush() 真正调用 LogPersistenceManager.flushToRemote
2. Logger.ts: buffer 达到阈值时触发 flush
3. Logger.ts: 定时 flush (每 30 秒)