# WI-0033 Intake

## 变更描述
修复前端日志上传的 JSON 格式不匹配问题。后端日志显示 App 每 5 秒发送日志请求但全部被拒绝（HTTP 400 JSON parse error）。

## 重大发现
**JS 实际上在运行！** 白屏时 Logger 正常工作，定时器每 5 秒触发 flush，只是上传格式错误：
- 前端发送：`[{timestamp, level:1, ...}]`（裸数组 + level 是数字）
- 后端期望：`{"entries":[{timestamp, level:"INFO", ...}]}`（对象包装 + level 是字符串）

## 变更范围（单文件）
- `fj-android/src/utils/LogPersistence.ts` 的 `RemoteLogTransport.upload()` 方法：
  1. body 从 `JSON.stringify(entries)` 改为 `JSON.stringify({entries: mappedEntries})`
  2. level 从数字（0-3）转为字符串（"DEBUG"/"INFO"/"WARN"/"ERROR"）

## 守卫条件检查
- ✅ 无需求/设计/架构变更
- ✅ unknowns=[]
- ✅ code_only_fast_path 适用