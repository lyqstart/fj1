# WI-0025 影响分析

## 受影响文件
1. `fj-android/android/app/build.gradle` — 添加 androidResources noCompress 'bundle'

## 不受影响
- 源码不变
- ProGuard rules 不变
- Hermes 配置不变
- 签名配置不变

## 下游影响
- Release APK 大小略增（bundle 从 733KB 增到 1.5MB，未压缩）
- 运行时 bundle 加载恢复正常