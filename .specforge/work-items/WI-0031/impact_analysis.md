# WI-0031 Impact Analysis

## 影响范围
- **文件**: `fj-android/src/utils/Logger.ts`
- **模块**: 日志系统
- **影响**: ERROR 日志立即触发远程上传；定时器周期缩短到 5s

## 无影响项
- 不影响日志格式
- 不影响日志接口（debug/info/warn/error 签名不变）
- 不影响后端 API
- 不影响其他前端模块

## 性能影响
- ERROR 立即 flush：fire-and-forget HTTP，不阻塞主线程
- 5s 定时器：比 30s 更频繁上传，诊断阶段可接受；后续可改回 30s