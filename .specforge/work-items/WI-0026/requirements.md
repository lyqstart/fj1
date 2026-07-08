# WI-0026 Bugfix 分析

## 当前行为
WI-0025 修复 bundle 压缩后，Release APK（55MB）启动**黑屏**，无崩溃弹窗，无任何 UI。JS bundle 已成功加载（Hermes 字节码正常解析），但 React 树从未完成首次 mount 或 mount 后无像素产出。

## 预期行为
Release APK 启动后显示登录页（白色背景 + 登录表单）。

## 不变行为
- Debug APK 从 Metro 加载正常工作
- API 端点不变（http://129.211.5.240）
- 业务代码不变
- 签名配置不变
- Hermes 引擎启用
- 新架构启用（newArchEnabled=true）

## 根因分析

### 直接原因
ProGuard/R8 在 Release 构建时混淆/裁剪了多个关键 NativeModule 的 Java 类，导致运行时反射调用失败（NoClassDefFoundError / NoSuchMethodError），React Native bridge 初始化静默失败，React 树无法完成首次 commit，最终黑屏。

### 根本原因
`proguard-rules.pro` 存在多处配置缺陷：

#### 缺陷 1: WatermelonDB 包名错误（致命）
```diff
- -keep class com.watermelon.db.** { *; }    # 错误：不存在的包名
+ -keep class com.nozbe.watermelondb.** { *; } # 正确：实际包名
```
证据：build-wi25.log L19 `> Task :nozbe_watermelondb:preReleaseBuild`，Java 源码包 `com.nozbe.watermelondb`。

#### 缺陷 2: Facebook Conceal 未 keep（致命，影响 keychain）
react-native-keychain 8.x 在 Android 依赖 Facebook Conceal 加密库（`com.facebook.crypto.**`），APK 已打包 `libconceal.so`，但 Java 侧未 keep。R8 改名后，KeychainModule 内部实例化 ConcealCrypto 会 NoClassDefFoundError。
```diff
+ -keep class com.facebook.crypto.** { *; }
```

#### 缺陷 3: vision-camera 未 keep
vision-camera 4.x 在 WI-0020 解除屏蔽后已编译进 APK，但 proguard-rules 未 keep `com.mrousavy.camera.**`。
```diff
+ -keep class com.mrousavy.camera.** { *; }
```

#### 缺陷 4: safe-area-context 未 keep
```diff
+ -keep class com.th3rdwave.safeareacontext.** { *; }
```

#### 缺陷 5: image-resizer 未 keep
```diff
+ -keep class com.RNImageResizer.** { *; }
```

#### 缺陷 6: DoNotStrip 注解 keep 方式错误
当前规则只 keep 注解类本身，未 keep 带注解的目标类。
```diff
- -keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
+ -keep @com.facebook.proguard.annotations.DoNotStrip class * { *; }
+ -keepclassmembers @com.facebook.proguard.annotations.DoNotStripAnyAccess * { *; }
```

#### 缺陷 7: 新架构 codegen 类未 keep
新架构下 codegen 生成的类位于 `com.facebook.react.runtime.**` 和 ViewManager 命名空间，需要显式 keep。
```diff
+ -keep class com.facebook.react.runtime.** { *; }
+ -keep class com.facebook.react.turbomodule.** { *; }
+ -keep class com.facebook.react.fabric.** { *; }
```

### 为什么是黑屏而非错误 UI
纯 JS 层错误会被 ErrorBoundary 捕获并显示错误页（已验证 ErrorBoundary fallback 非 null）。黑屏只能是：
- JS bundle 加载成功，但 React Native bridge 初始化时某个 NativeModule 实例化抛 NoClassDefFoundError
- 该错误发生在 JS 首次 commit 之前的原生层，不冒泡到 JS ErrorBoundary
- React RootView 未接到任何 commit → 黑屏

### 排除项
- ❌ 不是 initDatabase 卡死（AppRoot loading 状态会显示 spinner，不是黑屏）
- ❌ 不是 AuthContext 阻塞（Provider 从不 return null）
- ❌ 不是 RootNavigator 返回 null（所有 status 状态都有非 null UI）
- ❌ 不是 ErrorBoundary fallback null（fallback 是完整 View+Text+Button）
- ❌ 不是 BiometricAuth 抛错（所有函数 try/catch 兜底）
- ✅ 是 R8 混淆导致 NativeModule 类被裁剪/重命名，bridge 初始化失败