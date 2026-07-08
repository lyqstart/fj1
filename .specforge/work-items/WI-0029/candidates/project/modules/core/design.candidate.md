# WI-0029 Design

## DD-1: AppLogController
```java
@RestController
@RequestMapping("/api/v1/logs")
public class AppLogController {
    @PostMapping("/batch")
    public ApiResponse<Void> batch(@RequestBody LogBatchRequest req) {
        appLogService.writeLogs(req.getEntries());
        return ApiResponse.ok();
    }
}
```

## DD-2: LogBatchRequest DTO
```java
public class LogBatchRequest {
    private List<LogEntry> entries;
}
public class LogEntry {
    private String timestamp;
    private String level;   // DEBUG/INFO/WARN/ERROR
    private String module;
    private String message;
    private Object data;
}
```

## DD-3: AppLogService
- 使用 java.nio.file 写入文件
- 路径: /opt/fj/api/logs/app-logs/app-yyyy-MM-dd.log
- 每行 JSON: `{timestamp} [{level}] [{module}] {message} {data_json}`
- 创建目录如果不存在
- 异常只 log.error，不抛出

## DD-4: SecurityConfig 修改
```java
.requestMatchers("/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/logs/**").permitAll()
```

## DD-5: 前端 Logger.flush() 接通
- 在 Logger 构造函数中创建 LogPersistenceManager 实例
- flush() 方法调用 manager.flushToRemote(this.buffer.slice())
- 设置 30 秒 setInterval 定时 flush