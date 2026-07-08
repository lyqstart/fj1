# WI-0026 任务

## TASK-1: 重写 proguard-rules.pro
- 文件: `fj-android/android/app/proguard-rules.pro`
- 修改: 补全 7 处缺失/错误的 keep 规则
- 验证: grep 关键包名存在

## TASK-2: Docker 重建 Release APK
- 命令: docker assembleRelease（含 keystore 密码注入）
- 验证: BUILD SUCCESSFUL

## TASK-3: APK 大小确认
- 验证: APK 存在且大小合理（~55-60MB）