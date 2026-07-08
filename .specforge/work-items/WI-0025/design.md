# WI-0025 修复设计

## DD-1: androidResources noCompress 配置

### 方案
在 `fj-android/android/app/build.gradle` 的 `android {}` 块内添加：
```gradle
androidResources {
    noCompress += ['bundle']
}
```

### 原理
- `androidResources.noCompress` 声明的扩展名文件在打包时以 Stored（未压缩）方式存储
- Hermes 字节码加载器使用 `AAsset_getBuffer` 直接内存映射，要求未压缩格式
- 这是 RN 社区已知问题，RN 0.75+ 已在模板中默认添加此配置

### 替代方案（不采用）
- `aaptOptions { noCompress 'bundle' }` — AGP 8.x 已弃用 aaptOptions，推荐 androidResources
- 禁用整个 APK 压缩 — 过度，影响其他 assets

## DD-2: 验证策略

### 构建后验证
1. Docker assembleRelease 重建
2. unzip -l 检查 bundle 存储方式（应显示 Stored 而非 Defl:N）
3. APK 大小可能略增（bundle 未压缩，从 733KB 增到 1.5MB，总 APK 增约 800KB）

### 运行时验证（用户侧）
- 安装新 APK 到真机
- 启动 App，应正常进入登录页（不再崩溃）

## 不变行为保护
- build.gradle 其他配置不变（signingConfigs/buildTypes/dependencies）
- ProGuard rules 不变
- Hermes 配置不变