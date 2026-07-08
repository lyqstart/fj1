# WI-0029 Requirements

## REQ-1: 日志接收端点
- POST /api/v1/logs/batch
- 接收 JSON: `{ entries: [{ timestamp, level, module, message, data }] }`
- permitAll（不要求 JWT 认证，因为白屏时无法登录）
- 返回 ApiResponse.ok()

## REQ-2: 日志文件存储
- 写入 /opt/fj/api/logs/app-logs/app-yyyy-MM-dd.log
- 每行一条 JSON：`{timestamp} [{level}] [{module}] {message} {data}`
- 按日期自动分文件

## REQ-3: 前端 Logger.flush() 接通
- Logger.flush() 调用 LogPersistenceManager.flushToRemote(buffer)
- buffer 达到 400 条时自动触发 flush
- 每 30 秒定时触发 flush

## AC-1: curl POST /api/v1/logs/batch 返回 200 + code:0
## AC-2: 日志文件出现在 /opt/fj/api/logs/app-logs/
## AC-3: Logger.ts 中 flush() 不再是占位符
## AC-4: 后端 mvn compile 成功
## AC-5: 前端 tsc --noEmit exit 0