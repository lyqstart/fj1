# WI-0026 影响分析

## 受影响文件
1. `fj-android/android/app/proguard-rules.pro` — 补全缺失的 keep 规则

## 不受影响
- 源码不变
- build.gradle 不变（minifyEnabled 保持 true）
- 业务逻辑不变

## 下游影响
- Release APK 大小可能略增（更多类被 keep）
- 运行时所有 NativeModule/JSI 绑定恢复正常