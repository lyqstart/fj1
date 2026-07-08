# WI-0031 Tasks

## Task 1: Logger 分级 flush 改进

**文件**: `fj-android/src/utils/Logger.ts`

### 改动 1: ERROR 级别立即 flush

在 `log()` 方法中，第 5 步（缓冲超过阈值触发 flush）之后，添加：

```typescript
// 6. ERROR 级别立即 flush（崩溃前必须上传，不等定时器）
if (level === LogLevel.ERROR) {
  this.flush();
}
```

### 改动 2: 定时器周期 30s → 5s

在 `startPeriodicFlush()` 方法中：

```typescript
// 旧
}, 30000);
// 新
}, 5000);
```

**verification_commands**:
- `grep -n "5000\|ERROR.*flush\|level === LogLevel.ERROR" fj-android/src/utils/Logger.ts`

## Task 2: 重新构建 Release APK

Docker 构建命令（通过 sf_safe_bash + docker run）。

**verification_commands**:
- 检查 APK 文件存在且大小 > 50MB