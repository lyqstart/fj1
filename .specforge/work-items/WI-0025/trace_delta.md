# WI-0025 追溯增量

## BUG → FIX → TASK 映射

| BUG | 根因 | FIX | TASK | 文件 | 验证 |
|-----|------|-----|------|------|------|
| BUG-1: Release APK 启动崩溃 "Unable to load script" | assets/index.android.bundle 被 DEFLATE 压缩，Hermes 加载器无法读取 | FIX-1: androidResources noCompress 'bundle' | TASK-1 | build.gradle | unzip -l Stored |
| BUG-1 | 同上 | FIX-1 | TASK-2 | app-release.apk | BUILD SUCCESSFUL |
| BUG-1 | 同上 | FIX-1 | TASK-3 | app-release.apk | bundle Stored 0% |