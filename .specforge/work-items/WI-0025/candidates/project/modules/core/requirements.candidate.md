# WI-0025 Bugfix 分析

## 当前行为
在安卓真机上运行 Release APK（app-release.apk，54MB）时，App 启动后立即崩溃：
```
Unable to load script. Make sure you're either running Metro or that your bundle 'index.android.bundle' is packaged correctly for release.
```
调用栈：`loadJSBundleFromAssets` → `ReactInstance.java` → `JSBundleLoader.java:27`

## 预期行为
Release APK 从 `assets/index.android.bundle` 加载 Hermes 字节码（v96），App 正常启动，无需 Metro server。

## 不变行为
- Debug APK 正常工作（从 Metro server 加载）
- API 端点不变（http://129.211.5.240）
- 业务代码不变
- 签名配置不变（fj-release.keystore）
- Hermes 引擎启用（hermesEnabled=true）
- 新架构启用（newArchEnabled=true）

## 根因分析

### 直接原因
APK 内 `assets/index.android.bundle` 被 **DEFLATE 压缩**（压缩率 52%）：
```
1537180  Defl:N   733208  52%  assets/index.android.bundle
```

Hermes 字节码加载器使用 `AAsset_getBuffer` 直接内存映射读取 bundle。该方法要求 bundle 以 **Stored**（未压缩）方式存储在 APK 中。DEFLATE 压缩的 bundle 在运行时需要解压，而 Hermes 加载器未实现解压逻辑，导致 "Unable to load script" 错误。

### 根本原因
RN 0.74 的 React Native Gradle Plugin **未自动配置** `noCompress 'bundle'` 规则。Gradle 默认的 AAPT 行为会压缩所有 assets 文件，除非显式声明 noCompress。

### 证据
1. APK 内 bundle 存在且有效（Hermes v96 字节码，1,537,180 字节，业务代码完整）
2. bundle 被 Defl:N 压缩，压缩率 52%
3. libhermes.so 四架构齐全且 Stored 未压缩（正确）
4. ProGuard/R8 未误删关键类（ReactNativeHost.getJSBundleFile() 在 seeds 中保留）
5. classes.dex 内含字符串 "index.android.bundle"（加载逻辑未被混淆）
6. build-wi22.log L53 createBundleReleaseJsAndAssets task 已执行

### 排除项
- ❌ 不是 bundle 未生成（task 执行成功，产物存在）
- ❌ 不是 Hermes 配置错误（libhermes.so 齐全）
- ❌ 不是 ProGuard 误删（mapping 验证通过）
- ❌ 不是路径错误（classes.dex 含正确路径字符串）
- ✅ 是 bundle 被 AAPT 压缩导致 Hermes 加载器无法读取