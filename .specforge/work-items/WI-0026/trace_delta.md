# WI-0026 追溯增量

| BUG | 根因 | FIX | TASK | 文件 | 验证 |
|-----|------|-----|------|------|------|
| BUG-1: Release 黑屏 | WatermelonDB 包名错 com.watermelon.db | FIX-1: 改 com.nozbe.watermelondb | TASK-1 | proguard-rules.pro | grep |
| BUG-1 | Facebook Conceal 未 keep → keychain NoClassDefFoundError | FIX-1: 添加 com.facebook.crypto keep | TASK-1 | proguard-rules.pro | grep |
| BUG-1 | vision-camera/safe-area/image-resizer 未 keep | FIX-1: 添加对应 keep | TASK-1 | proguard-rules.pro | grep |
| BUG-1 | DoNotStrip 注解 keep 方式错 | FIX-1: 改为 @annotation class keep | TASK-1 | proguard-rules.pro | grep |
| BUG-1 | 新架构 codegen 类未 keep | FIX-1: 添加 runtime/turbomodule/fabric keep | TASK-1 | proguard-rules.pro | grep |
| BUG-1 | 同上 | FIX-1 | TASK-2 | app-release.apk | BUILD SUCCESSFUL |