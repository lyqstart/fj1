---
requirements_format: ears
work_item_id: WI-0014
workflow_type: feature_spec
workflow_path: requirement_change_path
date: 2026-07-05
title: Release 签名 + ProGuard/R8 混淆 需求规格（Candidate）
---

# Requirements — WI-0014 Release 签名 + ProGuard/R8 混淆

> 本文件为 Requirements Candidate（§8.2），拟写入正式规格真相源。包含完整 requirements.md 结构。
> 范围：仅描述"做什么"与"验收什么"，不涉及技术栈选型与实现细节（属 sf-design 职责）。

## 简介

本规格定义为安卓应用 `com.fjandroid` 生成**可分发 Release APK** 所需的能力：配置 Release 签名密钥、启用 ProGuard/R8 代码混淆与资源压缩、验证构建产物、保障密钥安全。

当前状态（基线事实，仅供设计参考）：
- `buildTypes.release.signingConfig` 当前指向 `signingConfigs.debug`（使用 debug.keystore）。
- `minifyEnabled` 当前为 `false`（由 `enableProguardInReleaseBuilds = false` 控制）。
- `shrinkResources` 未配置。
- `proguard-rules.pro` 当前为空（仅注释占位）。

本 WI 通过后，应用应能产出经过正式签名、代码混淆、资源压缩的 `app-release.apk`，并通过签名校验。

## 术语表

| 术语 | 定义 |
|------|------|
| Release APK | 经过正式签名、可用于分发的 Android 安装包（`app-release.apk`），区别于调试用的 `app-debug.apk`。 |
| Keystore | 存储私钥与证书的加密容器文件（`.keystore`），Android 用其对 APK 进行数字签名。 |
| Key Alias | Keystore 内某条密钥条目的别名，配合密码用于签名时检索私钥。 |
| Signing Config | Gradle 中描述签名所需四要素（storeFile / storePassword / keyAlias / keyPassword）的配置块。 |
| ProGuard / R8 | Android 官方代码缩减与混淆工具，R8 为新一代默认实现，兼用 `proguard-rules.pro` 规则文件。 |
| minifyEnabled | Gradle `buildTypes` 开关，启用后对 Java/Kotlin 字节码进行混淆、裁剪、优化。 |
| shrinkResources | Gradle `buildTypes` 开关，启用后移除未引用的资源文件，减小 APK 体积。 |
| -keep 规则 | ProGuard 规则，指示混淆器保留指定类/成员不被重命名或移除，常用于反射场景。 |
| apksigner | Android SDK 提供的 APK 签名验证工具，可校验 v1/v2/v3 签名方案。 |
| aapt | Android Asset Packaging Tool，可读取 APK 的 manifest 元信息（包名、版本等）。 |
| 反射类（Reflection-critical class） | 在运行时通过反射被框架按名字加载的类，混淆其类名将导致 `ClassNotFoundException`，必须保留。 |
| ABI Split | 按 CPU 架构（armeabi-v7a / arm64-v8a / x86 等）拆分多 APK 的能力。本 WI 不涉及。 |
| Hermes | React Native 默认 JS 引擎，其原生桥接类对混淆敏感。 |

## 需求

### REQ-1 Release 签名配置

**用户故事**：作为应用发布者，我希望 Release 构建使用独立的正式签名密钥（而非 debug.keystore），以便产出的 APK 能被正式分发、升级和身份验证。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 在 `fj-android/android/app/` 目录下存在一个名为 `fj-release.keystore` 的签名密钥文件，其 RSA 密钥长度为 2048 位、有效期不少于 10000 天。
2. [Ubiquitous] THE 系统 SHALL 在所述 keystore 中包含一个别名为 `fj` 的密钥条目。
3. [State-driven] WHILE `buildTypes.release` 处于激活状态, THE 系统 SHALL 使用名为 `release` 的 `signingConfigs` 块对该变体的 APK 进行签名, 且不再引用 `signingConfigs.debug`。
4. [Ubiquitous] THE 系统 SHALL 在 `build.gradle` 的 `signingConfigs` 块中定义一个名为 `release` 的配置, 其四要素 `storeFile` / `keyAlias` / `storePassword` / `keyPassword` 全部指向 REQ-1.1 / REQ-1.2 生成的密钥及对应密码。
5. [Unwanted-behavior] IF `fj-release.keystore` 文件缺失, THEN THE 系统 SHALL 在执行 Release 构建前以明确的 Gradle 配置错误终止构建, 而不是回退到 `debug.keystore`。

**优先级**：Must

**依赖**：REQ-4（密钥安全策略）

---

### REQ-2 ProGuard/R8 代码混淆与资源压缩

**用户故事**：作为应用发布者，我希望 Release APK 中的字节码经过混淆、资源经过压缩，以便减小分发包体积并提高逆向成本，同时不破坏运行时反射依赖的类。

**验收标准**：

1. [State-driven] WHILE 构建变体为 `release`, THE 系统 SHALL 启用 `minifyEnabled true` 以对 Java/Kotlin 字节码执行 R8 混淆与裁剪。
2. [State-driven] WHILE 构建变体为 `release`, THE 系统 SHALL 启用 `shrinkResources true` 以移除未被代码引用的资源文件。
3. [Ubiquitous] THE 系统 SHALL 通过 `proguardFiles` 同时引用 Android 默认规则文件（`proguard-android-optimize.txt` 或 `proguard-android.txt`）与项目级 `proguard-rules.pro`。
4. [Ubiquitous] THE 系统 SHALL 在 `proguard-rules.pro` 中为以下反射敏感类族配置 `-keep` 规则，使其类名与关键成员不被重命名：
   - `com.oblador.keychain.**`（react-native-keychain）；
   - `com.watermelon.db.**`（watermelondb，即使当前 autolinking 屏蔽其 jar 仍在）；
   - Hermes 引擎相关类（`com.facebook.hermes.**`）；
   - OkHttp 类（`okhttp3.**`、`okio.**`）；
   - React Native 核心反射类（`com.facebook.react.**`）；
   - 应用自定义 Application 类 `com.fjandroid.MainApplication`。
5. [Unwanted-behavior] IF 启用混淆后 Release 构建因缺少 `-keep` 规则而在运行时抛出 `ClassNotFoundException` 或 `NoSuchMethodException`, THEN THE 系统 SHALL 在 `proguard-rules.pro` 中补充对应类族的保留规则直至构建与运行均通过。
6. [Optional-feature] WHERE 资源为 JS bundle 产物（`assets/index.android.bundle` 及其 sourcemap）, THE 系统 SHALL 不对其执行资源移除或重命名。

**优先级**：Must

**依赖**：REQ-3（构建产物验证）

---

### REQ-3 Release 构建产物验证

**用户故事**：作为应用发布者，我希望在每次产出 Release APK 后能以可重复的命令验证其签名有效、体积显著缩减、包名正确，以便确信该 APK 可安全分发。

**验收标准**：

1. [Event-driven] WHEN 在 Docker 构建环境内执行 `./gradlew assembleRelease`, THE 系统 SHALL 以退出码 0 完成构建且无编译/混淆致命错误。
2. [Event-driven] WHEN 构建成功完成, THE 系统 SHALL 在 `fj-android/android/app/build/outputs/apk/release/` 目录下产出名为 `app-release.apk` 的文件。
3. [Event-driven] WHEN 对产出的 `app-release.apk` 执行 `apksigner verify`, THE 系统 SHALL 返回验证通过（退出码 0），证明 APK 携带有效签名。
4. [Ubiquitous] THE 系统 SHALL 保证 `app-release.apk` 的体积相比同次构建产出的 `app-debug.apk` 显著减小（`shrinkResources` + `minify` 生效的客观证据），缩减比例不低于 `<release_size_reduction_min: 15%>`（可配置）。
5. [Event-driven] WHEN 对产出的 `app-release.apk` 执行 `aapt dump badging`, THE 系统 SHALL 在输出中报告 `package: name='com.fjandroid'`，证明包名未被混淆破坏。
6. [Optional-feature] WHERE 应用启动后执行登录流程, THE 系统 SHALL 在 Release APK 上不因混淆产生崩溃（keychain 反射依赖保留生效）。

**优先级**：Must

**依赖**：REQ-1、REQ-2

---

### REQ-4 密钥安全

**用户故事**：作为应用发布者，我希望签名密钥及其密码不被泄露到版本库或硬编码进构建脚本，以便长期保障应用签名身份安全。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 由 AI（代表用户）预先生成 `fj-release.keystore` 及其密码，并将生成的密码明文一次性交付给用户记录，不写入任何受版本控制的文件。
2. [Ubiquitous] THE 系统 SHALL 在仓库的 `.gitignore` 中加入 `fj-release.keystore` 条目（路径相对于 `fj-android/android/app/`），确保该文件不被 Git 跟踪。
3. [Ubiquitous] THE 系统 SHALL 保证 `fj-release.keystore` 文件的 POSIX 权限为 `600`（仅属主可读写），防止其他用户读取。
4. [Ubiquitous] THE 系统 SHALL 通过 `gradle.properties`（受 `.gitignore` 保护）或进程环境变量向 `build.gradle` 注入 `storePassword` / `keyPassword`，不得在 `build.gradle` 中以明文硬编码任何密码字面量。
5. [Unwanted-behavior] IF `build.gradle` 中出现任何密码明文字面量（如 `'changeit'`、`storePassword 'xxx'` 等纯字符串形式）, THEN THE 系统 SHALL 视为不符合本需求并修正为从外部属性/环境变量读取。
6. [Ubiquitous] THE 系统 SHALL 保证承载密码的 `gradle.properties` 文件同样被 `.gitignore` 排除（若其承载密钥密码）。

**优先级**：Must

**依赖**：REQ-1

---

## 非目标（Out of Scope）

以下事项**不属于**本 WI 范围，如有需要应另立 WI：

1. **ABI Split** — 按CPU架构拆分多 APK（armeabi-v7a / arm64-v8a / x86_64）的优化，本 WI 只产出通用 APK。
2. **应用商店发布配置** — Google Play / 国内应用商店的上架元数据、隐私政策、截图、App Bundle（`.aab`）格式产出。
3. **App Bundle（.aab）格式** — 本 WI 仅产出 `.apk`；`.aab` 输出留给后续 WI。
4. **签名密钥的 HSM / 硬件安全模块管理** — 本 WI 使用本地 keystore 文件，不涉及硬件密钥托管或 V2 签名密钥轮换方案。
5. **签名方案升级（v4 / 密钥轮换）** — APK Signature Scheme v4 与 `apksigner rotate-keys` 不在本 WI 范围。
6. **Debug 构建签名变更** — `signingConfigs.debug` 保持不变。
7. **代码层面的功能变更** — 本 WI 不修改 JS/TS 业务代码与原生业务逻辑，仅触及构建配置与混淆规则。
8. **CI/CD 自动化签名** — 将密钥注入 CI runner 的密钥管理服务（如 GitHub Actions secrets、Vault）不在本 WI 范围。
9. **多 Flavor / 多环境构建矩阵** — `productFlavors`（dev/staging/prod）拆分不在本 WI 范围。

## 配置点清单

| 配置项 | 默认值 | 位置 | 说明 |
|--------|--------|------|------|
| `release_size_reduction_min` | 15% | REQ-3.4 | Release APK 相比 Debug APK 的最小体积缩减比例阈值，用于验收判定。后续若引入更激进优化可上调。 |
| keystore 有效期 | 10000 天 | REQ-1.1 | 约等于 27.4 年，满足长期发布需求；若组织签名策略有上限可下调。 |
| 密钥算法 | RSA 2048 | REQ-1.1 | 当前 Android 推荐基线；后续可升级至 RSA 3072 或 EC。 |
| 密钥别名 | `fj` | REQ-1.2 | 与项目代号对齐；如有多应用矩阵可改为带环境后缀。 |

---

## 自检（Self-Check）

| # | 自问自答 | 答案 |
|---|---------|------|
| 1 | 是否有含"等"/"包括但不限于"的未拆分需求？ | 否，所有并列子项已展开为独立 AC。 |
| 2 | 每条 AC 是否含可测量值或可执行命令？ | 是（`apksigner verify`、`aapt dump badging`、`assembleRelease` 退出码、体积缩减 15%、文件权限 600 等）。 |
| 3 | 是否避免编写设计/任务/代码内容？ | 是，未指定 Gradle DSL 写法、未给 -keep 规则原文、未拆任务。 |
| 4 | 是否覆盖 intake 的全部 IN-SCOPE 项？ | 是（签名、ProGuard、shrinkResources、assembleRelease、产物验证、密钥安全）。 |
| 5 | 是否标注了与 WI-0013（keychain）的运行时依赖？ | 是，REQ-2.4 与 REQ-3.6 显式覆盖 keychain 反射类。 |
| 6 | 是否声明了 watermelondb 即使屏蔽仍需 keep？ | 是，REQ-2.4 明确"jar 仍在"理由。 |
| 7 | 非目标是否清晰隔离 ABI Split / .aab / HSM？ | 是，非目标章节 9 条。 |
