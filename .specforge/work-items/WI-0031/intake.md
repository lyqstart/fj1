# WI-0031 Intake

## 变更描述
Logger 的 flush 策略改为分级：ERROR 级别日志立即触发远程上传（不等定时器），定时器周期从 30s 缩短到 5s（诊断阶段）。

## 背景
- 白屏诊断需要尽快收到 App 端日志
- 当前 ERROR 级别日志（包括 GlobalErrorHandler 捕获的致命异常）只入缓冲，等 30s 定时器才上传
- 如果 App 在 30s 内崩溃或 JS 引擎终止，日志永远传不出去
- 启动阶段的关键 INFO 日志也要更快上传（5s 而非 30s）

## 变更范围（单文件）
- `fj-android/src/utils/Logger.ts`
  1. `log()` 方法：ERROR 级别写入缓冲后立即调用 `this.flush()`
  2. `startPeriodicFlush()`：定时器 30000ms → 5000ms

## 守卫条件检查
- ✅ 无需求变更
- ✅ 无设计变更
- ✅ 无架构变更
- ✅ 无验收标准变更
- ✅ 无数据语义变更
- ✅ 无接口契约变化
- ✅ unknowns=[]
- ✅ 不新增用户可见功能
- ✅ code_only_fast_path 适用