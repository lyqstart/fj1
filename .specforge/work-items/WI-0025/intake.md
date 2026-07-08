# WI-0025 Intake

## 缺陷描述
**当前行为**：在安卓真机上运行 Release APK（app-release.apk，54MB）时，App 启动后立即崩溃，弹出错误：
```
Unable to load script. Make sure you're either running Metro (run 'npx react-native start') or that your bundle 'index.android.bundle' is packaged correctly for release.
```
调用栈：`loadJSBundleFromAssets` → `ReactInstance.java` → `JSBundleLoader.java:27`

**预期行为**：Release APK 应该从 assets 中加载预打包的 `index.android.bundle`，无需 Metro server，App 正常启动。

**复现步骤**：
1. 安装 `fj-android/android/app/build/outputs/apk/release/app-release.apk`（WI-0022 构建，54MB）
2. 点击启动 App
3. 立即崩溃，弹出上述错误

**环境信息**：
- RN 0.74（新架构启用，WI-0020）
- Hermes 引擎（hermesEnabled=true）
- R8/ProGuard 启用（enableProguardInReleaseBuilds=true，WI-0014）
- 签名：fj-release.keystore
- Docker 构建：fj-builder:react-native-0.74

## 初步怀疑
1. R8/ProGuard 混淆了关键类（com.facebook.react.common.assets.ReactBundleAssetHelper 等），导致 bundle 加载失败
2. Gradle React Plugin 在 release 构建时未正确生成 Hermes bundle 到 assets
3. ProGuard rules 中缺少对 bundle 加载相关类的 -keep 规则

## Debug APK 对比
Debug APK（133MB）从 Metro server 加载，不需要预打包 bundle，所以能正常工作。这进一步指向 Release 模式特有的 bundle 加载问题。