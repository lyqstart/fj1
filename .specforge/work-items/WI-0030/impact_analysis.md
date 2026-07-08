# WI-0030 Impact Analysis

## 影响范围
- **文件**: `fj-backend/fj-common/src/main/java/com/fj/common/applog/AppLogService.java`（第 19 行）
- **模块**: fj-common（AppLog 日志服务）
- **影响**: 修正后日志文件将正确写入 `/opt/fj1/api/logs/app-logs/`

## 无影响项
- 不影响 API 接口契约（POST /api/v1/logs/batch 不变）
- 不影响前端代码
- 不影响数据库
- 不影响安全配置
- 不影响其他后端模块

## 部署影响
- 需重新编译 fj-api jar
- 需 scp 到服务器并重启 fj1-api.service
- 服务短暂中断（约 10-30 秒）