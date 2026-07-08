# WI-0033 Tasks

## Task 1: 修复 RemoteLogTransport.upload JSON 格式

**文件**: `fj-android/src/utils/LogPersistence.ts`

### 问题
当前 upload() 方法（约 84-107 行）：
```typescript
body: JSON.stringify(entries),
```
发送裸数组 `[{...}]`，且 level 是数字。

### 修复
在 upload() 方法中，构造正确的 payload：

```typescript
async upload(entries: LogEntry[]): Promise<void> {
  try {
    if (!entries || entries.length === 0) {
      return;
    }

    // Map entries: level number → string, wrap in {entries: [...]}
    const LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const payload = {
      entries: entries.map(e => ({
        timestamp: e.timestamp,
        level: LEVEL_NAMES[e.level] ?? 'INFO',
        module: e.module,
        message: e.message,
        data: e.data,
      })),
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    // ... rest unchanged
```

**verification**: grep 确认 payload 和 LEVEL_NAMES

## Task 2: 重建 Release APK

Docker 构建。

**verification**: APK 存在