# WI-0032 Tasks

## Task 1: 关闭新架构

**文件**: `fj-android/android/gradle.properties`（第 37 行）

```properties
# 旧
newArchEnabled=true
# 新
newArchEnabled=false
```

**verification**: `grep newArchEnabled gradle.properties` 确认 false

## Task 2: 重建 Release APK

Docker 构建 assembleRelease。

**verification**: APK 存在且大小 > 50MB