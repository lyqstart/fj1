# WI-0025 任务

## TASK-1: 修改 build.gradle 添加 noCompress
- 文件: `fj-android/android/app/build.gradle`
- 修改: 在 `android {}` 块内（compileSdk 之后）添加 `androidResources { noCompress += ['bundle'] }`
- 验证: grep "noCompress" 存在

## TASK-2: Docker 重建 Release APK
- 命令: docker assembleRelease（含 keystore 密码注入）
- 验证: BUILD SUCCESSFUL

## TASK-3: 验证 bundle 存储方式
- 命令: unzip -l app-release.apk | grep bundle
- 预期: 显示 "Stored" 而非 "Defl:N"
- 验证: APK 大小约 55MB（增 800KB）