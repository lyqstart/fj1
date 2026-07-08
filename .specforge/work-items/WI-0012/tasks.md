---
tasks_format: specforge_v1_1
work_item_id: WI-0012
workflow_type: feature_spec
workflow_path: requirement_change_path
base_spec_version: PSV-0001
generated_by: sf-task-planner
generated_at: 2026-07-05T00:00:00Z
---

# Tasks — RN 安卓端构建环境搭建 + 原生工程初始化

> 本文档基于 `.specforge/work-items/WI-0012/design.md`（6 DD）和 `requirements.md`（12 REQ / 35 AC）生成。
> 约束来源：`prod-environment.md` / `project-rules.md` 当前为 TODO 占位（design.md §8 已确认），
> 所有 constrained_by 引用均以 requirements.md 内嵌版本矩阵与 AC 文本为准。

---

## 容器命令标准模板（所有 task 通用）

> 以下模板在所有需要在 Docker 容器内执行的 task 中复用（DD-5）。

```bash
# === 容器执行标准模板（DD-5）===
# 项目源码 bind mount + Gradle 缓存命名卷 + npm 缓存命名卷
DOCKER_RUN='docker run --rm \
  -v /mnt/1t_back/project/fj1/fj-android:/build \
  -v fj1-gradle-cache:/root/.gradle \
  -v fj1-npm-cache:/root/.npm \
  -w /build \
  fj-builder:react-native-0.74'
```

---

## 任务依赖关系总览

```
批次 1（并行）: TASK-1 ──┬──> TASK-2 ──┐
           TASK-3 ──────┼─────────────┼──> TASK-6 ──> TASK-7
           TASK-4 ──────┼─────────────┤
           TASK-5 ──────┘             │
                                       └─────────────┘
```

| Task | 服务 DD | 服务 REQ | 依赖 | 并行批次 |
|------|---------|----------|------|----------|
| TASK-1 | DD-1 | REQ-1, REQ-2, REQ-8 | 无 | 1 |
| TASK-2 | DD-4 | REQ-2 | TASK-1 | 2 |
| TASK-3 | DD-6 | REQ-6, REQ-8 | 无 | 1 |
| TASK-4 | DD-2 | REQ-3, REQ-4 | 无 | 1 |
| TASK-5 | DD-3 | REQ-5, REQ-12 | 无 | 1 |
| TASK-6 | DD-5 | REQ-6, REQ-7, REQ-9, REQ-11 | TASK-1, TASK-2, TASK-3, TASK-4, TASK-5 | 3 |
| TASK-7 | — | REQ-6, REQ-9 | TASK-6 | 4 |

---

### TASK-1 容器工具链验证 + android/ 原生工程生成

**context_block**（executor 必读）：

- **What**: 分两步执行：
  1. **工具链验证**（REQ-1）：在 Docker 容器 `fj-builder:react-native-0.74` 中验证 JDK 17、Android SDK 27.1、NDK、CMake 3.30.5、Node ≥ 18、Gradle 共 6 类工具可用。
  2. **原生工程生成**（DD-1）：在容器内 `/tmp/fj-init-<timestamp>/` 临时目录执行 `npx react-native init fj-android-tmp --template react-native@0.74 --skip-install --npm`，然后将 `/tmp/fj-init-<timestamp>/fj-android-tmp/android/` 整体复制到 `fj-android/android/`，最后将 Java 包路径从 `com.fjandroidtmp` 重命名为 `com.fjandroid`（目录名 + .java 文件内的 package 声明）。
- **Why**: 实现 REQ-1 的工具链验证 + REQ-2 的原生工程骨架初始化。现有 `fj-android/` 已有 package.json/src/babel.config.js 等文件，直接在项目根执行 init 会覆盖既有文件（REQ-2 AC-5 要求隔离生成）。
- **Refs**: DD-1（原生工程生成策略，步骤 1-3/5），REQ-1 AC-1~AC-5，REQ-2 AC-1/AC-3/AC-5/AC-6，REQ-8 AC-2
- **Constraints**:
  - 必须在容器内执行所有 RN/Gradle/SDK 命令（REQ-7 AC-1, REQ-11 AC-1）
  - 使用 `--template react-native@0.74` 锁定版本（REQ-8 AC-2）
  - 使用 `--skip-install` 跳过 npm install（node_modules 已存在）
  - **复制前必检**：若 `fj-android/android/` 已存在且非空 → 立即终止，退出码 ≠ 0（REQ-2 AC-5）
  - **不得修改** `fj-android/package.json` 的 dependencies/devDependencies（REQ-2 AC-2, REQ-10）
  - **不得修改** `fj-android/app.json`（REQ-2 AC-3）
  - **不得修改** `fj-android/src/` 下任何既有文件（REQ-10 AC-1）
  - 包路径重命名：`android/app/src/main/java/com/fjandroidtmp/` → `com/fjandroid/`，`.java` 文件内 `package com.fjandroidtmp;` → `package com.fjandroid;`（DD-1 步骤 5）
  - 镜像标签固定 `fj-builder:react-native-0.74`，禁止使用 `latest`（REQ-7 AC-3）
- **Done When**:
  - 容器内 `java -version 2>&1` 输出含 `17`（主版本）
  - 容器内 `node --version` 输出 ≥ `v18`
  - 容器内 `ls /build/package.json` 退出码 0（挂载可访问）
  - `fj-android/android/settings.gradle` 存在
  - `fj-android/android/build.gradle` 存在
  - `fj-android/android/app/build.gradle` 存在
  - `fj-android/android/gradle/wrapper/gradle-wrapper.properties` 存在
  - `fj-android/android/gradlew` 存在且有可执行位（`-rwxr-xr-x`）
  - `fj-android/android/gradle.properties` 存在
  - `grep -rl "package com.fjandroid" fj-android/android/app/src/main/java/` 命中恰好 2 个文件（MainActivity.java + MainApplication.java）
  - `grep -r "fjandroidtmp" fj-android/android/` 无任何匹配（重命名彻底）
  - `git diff --name-only fj-android/package.json` 无输出（未修改 package.json）

- **依赖**: 无
- refs: [DD-1, REQ-1, REQ-2, REQ-8]
- **expected_file_changes**:
  - 新增 `fj-android/android/` 整个目录树（由 `npx react-native init` 生成，含 settings.gradle / build.gradle / app/build.gradle / gradle/wrapper/ / gradlew / gradle.properties / app/src/main/java/com/fjandroid/{MainActivity,MainApplication}.java / app/src/main/AndroidManifest.xml / app/src/main/res/** 等）
- **allowed_write_files**:
  - `fj-android/android/settings.gradle`
  - `fj-android/android/build.gradle`
  - `fj-android/android/app/build.gradle`
  - `fj-android/android/gradle/wrapper/gradle-wrapper.properties`
  - `fj-android/android/gradlew`
  - `fj-android/android/gradlew.bat`
  - `fj-android/android/gradle.properties`
  - `fj-android/android/settings.gradle`
  - `fj-android/android/app/src/main/AndroidManifest.xml`
  - `fj-android/android/app/src/main/java/com/fjandroid/MainActivity.java`
  - `fj-android/android/app/src/main/java/com/fjandroid/MainApplication.java`
  - `fj-android/android/app/src/main/res/values/strings.xml`
  - `fj-android/android/app/src/main/res/values/styles.xml`
  - `fj-android/android/app/src/debug/AndroidManifest.xml`
  - `fj-android/android/app/proguard-rules.pro`
  - `fj-android/android/.watchmanconfig`
  - `fj-android/android/gradle/wrapper/gradle-wrapper.jar`
  > 注：`npx react-native init` 会生成完整目录树，上述为 REQ-2 AC-1 要求的必需文件 + 已知关键文件；executor 不得删除生成树中的任何其他模板文件。
- **forbidden_files**:
  - `fj-android/package.json`（REQ-2 AC-2 禁止修改 dependencies）
  - `fj-android/app.json`（REQ-2 AC-3 禁止覆盖）
  - `fj-android/src/`（REQ-10 保护既有 25 个骨架文件）
  - `fj-android/babel.config.js`
  - `fj-android/tsconfig.json`
  - `.specforge/work-items/WI-0012/requirements.md`
  - `.specforge/work-items/WI-0012/design.md`
  - `.specforge/work-items/WI-0012/candidates/tasks.md`
- **verification_commands**:
  - `test -f fj-android/android/settings.gradle`
  - `test -f fj-android/android/build.gradle`
  - `test -f fj-android/android/app/build.gradle`
  - `test -f fj-android/android/gradle/wrapper/gradle-wrapper.properties`
  - `test -f fj-android/android/gradlew`
  - `test -x fj-android/android/gradlew`
  - `test -f fj-android/android/gradle.properties`
  - `test -f fj-android/android/app/src/main/java/com/fjandroid/MainActivity.java`
  - `test -f fj-android/android/app/src/main/java/com/fjandroid/MainApplication.java`
  - `bash -c 'grep -rl "package com.fjandroid" fj-android/android/app/src/main/java/ | wc -l | tr -d " "' | grep -qx 2`
  - `bash -c '! grep -rq "fjandroidtmp" fj-android/android/'`
  - `docker run --rm fj-builder:react-native-0.74 java -version 2>&1 | grep -q '"17'`
  - `docker run --rm fj-builder:react-native-0.74 node --version | grep -qE 'v(1[89]|2[0-9])'`
  - `docker run --rm -v /mnt/1t_back/project/fj1/fj-android:/build -w /build fj-builder:react-native-0.74 test -f /build/package.json`
- **verification_evidence_expected**:
  - `test -f ...` 系列：退出码 0（文件存在）
  - `test -x gradlew`：退出码 0（可执行位存在）
  - `grep -rl ... | wc -l`：输出恰好 `2`
  - `! grep -rq fjandroidtmp`：退出码 0（无残留）
  - `java -version | grep 17`：退出码 0
  - `node --version | grep v18+`：退出码 0
  - `test -f /build/package.json`：退出码 0
- **out_of_scope**:
  - 不调整 `android/app/build.gradle` 的 applicationId（留给 TASK-2）
  - 不创建 react-native.config.js（留给 TASK-3）
  - 不创建 App.tsx / index.js / metro.config.js（留给 TASK-4）
  - 不执行 assembleDebug 构建（留给 TASK-6）
  - 不配置 Release 签名（WI-0014）

---

### TASK-2 调整 android/app/build.gradle（applicationId + namespace + 版本号）

**context_block**（executor 必读）：

- **What**: 修改 TASK-1 生成的 `fj-android/android/app/build.gradle`，将 `applicationId` 和 `namespace` 设置为 `com.fjandroid`（DD-4 决策），并同步 `versionCode` / `versionName` 与 `app.json` 的 `version: 0.1.0` 一致。
- **Why**: `npx react-native init fj-android-tmp` 生成的 applicationId 默认为 `com.fjandroidtmp`（取自临时项目名），必须改为与 `app.json` 的 `name: fj-android` 对应的 `com.fjandroid`（DD-4 决策），否则 APK 的 package name 与设计不符。
- **Refs**: DD-4（包名决策），REQ-2 AC-4（applicationId 与 app.json name 一致）
- **Constraints**:
  - `applicationId "com.fjandroid"`（DD-4，纯字母无连字符，Gradle 合法）
  - `namespace "com.fjandroid"`（AGP 7.0+ 要求，建议与 applicationId 一致）
  - `versionCode 1`（首次构建）
  - `versionName "0.1.0"`（与 app.json version 一致）
  - **不得修改** build.gradle 中的 `dependencies` / `buildscript` / `project.ext.react` 块（保持 RN 0.74 模板默认）
  - **不得修改** `android/build.gradle`（根级，仅改 app 级）
  - **不得修改** `fj-android/src/` 下任何文件（REQ-10）
- **Done When**:
  - `grep 'applicationId "com.fjandroid"' fj-android/android/app/build.gradle` 命中 1 行
  - `grep 'namespace "com.fjandroid"' fj-android/android/app/build.gradle` 命中 1 行
  - `grep 'versionName "0.1.0"' fj-android/android/app/build.gradle` 命中 1 行
  - `grep 'fjandroidtmp' fj-android/android/app/build.gradle` 无匹配

- **依赖**: TASK-1（需要 android/app/build.gradle 已生成）
- refs: [DD-4, REQ-2]
- **expected_file_changes**:
  - 修改 `fj-android/android/app/build.gradle`（applicationId / namespace / versionName / versionCode 字段）
- **allowed_write_files**:
  - `fj-android/android/app/build.gradle`
- **forbidden_files**:
  - `fj-android/android/build.gradle`（根级 build.gradle 不改）
  - `fj-android/android/settings.gradle`
  - `fj-android/package.json`
  - `fj-android/app.json`
  - `fj-android/src/`（REQ-10）
  - `.specforge/work-items/WI-0012/requirements.md`
  - `.specforge/work-items/WI-0012/design.md`
  - `.specforge/work-items/WI-0012/candidates/tasks.md`
- **verification_commands**:
  - `grep -q 'applicationId "com.fjandroid"' fj-android/android/app/build.gradle`
  - `grep -q 'namespace "com.fjandroid"' fj-android/android/app/build.gradle`
  - `grep -q 'versionName "0.1.0"' fj-android/android/app/build.gradle`
  - `bash -c '! grep -q "fjandroidtmp" fj-android/android/app/build.gradle'`
- **verification_evidence_expected**:
  - `grep -q ...` 系列：退出码 0（配置项存在）
  - `! grep -q fjandroidtmp`：退出码 0（无残留临时包名）
- **out_of_scope**:
  - 不修改 dependencies / buildscript / react 配置块
  - 不配置 Release 签名 signingConfigs（WI-0014）
  - 不配置 ProGuard / R8（Debug 默认禁用）

---

### TASK-3 创建 react-native.config.js（屏蔽原生模块 autolinking）

**context_block**（executor 必读）：

- **What**: 在 `fj-android/react-native.config.js`（项目根目录，不在 src/ 下）创建原生模块降级配置，将 `@nozbe/watermelondb`、`react-native-vision-camera`、`react-native-keychain` 三个高风险原生模块的安卓原生链接设为 `blocking: true`（跳过原生编译，JS 仍可打包）。
- **Why**: 这三个模块含 C++ JSI / Kotlin 原生代码，在 RN 0.74 + Android SDK 27.1 矩阵下首次 assembleDebug 极可能编译失败（DD-6 风险分析）。本 WI 的 App.tsx 不引用它们（REQ-3 AC-2 无业务逻辑），屏蔽其原生链接可让最小 Debug APK 构建通过（DD-6 方案 A，首选）。
- **Refs**: DD-6（原生模块兼容性降级策略，方案 A），REQ-6 AC-1（assembleDebug 退出码 0），REQ-8 AC-2（Gradle Plugin 兼容）
- **Constraints**:
  - 文件位置：`fj-android/react-native.config.js`（**不在** `src/` 下，不违反 REQ-10；不在 REQ-2 AC-1 的 6 必需文件清单内，可自由新增）
  - 配置内容必须导出 `module.exports = { dependencies: { ... } }` 对象
  - 三个模块均设 `platforms: { android: { blocking: true } }`
  - **不得修改** `fj-android/babel.config.js`（方案 B 备选，本 task 仅实施方案 A）
  - **不得修改** `fj-android/src/` 下任何文件（REQ-10）
  - 文件头部须含注释说明依据（DD-6 / 范围外观察 #1）
- **Done When**:
  - `test -f fj-android/react-native.config.js` 通过
  - `grep -q "watermelondb" fj-android/react-native.config.js` 命中
  - `grep -q "vision-camera" fj-android/react-native.config.js` 命中
  - `grep -q "keychain" fj-android/react-native.config.js` 命中
  - `grep -c "blocking: true" fj-android/react-native.config.js` 输出 ≥ 3
  - 容器内 `node -e "require('./react-native.config.js')"` 不抛错（语法正确）

- **依赖**: 无（独立于 TASK-1，react-native.config.js 在项目根目录）
- refs: [DD-6, REQ-6, REQ-8]
- **expected_file_changes**:
  - 新增 `fj-android/react-native.config.js`
- **allowed_write_files**:
  - `fj-android/react-native.config.js`
- **forbidden_files**:
  - `fj-android/babel.config.js`（方案 B 备选，本 task 不动）
  - `fj-android/src/`（REQ-10）
  - `fj-android/android/`（TASK-1 范围）
  - `fj-android/package.json`
  - `.specforge/work-items/WI-0012/requirements.md`
  - `.specforge/work-items/WI-0012/design.md`
  - `.specforge/work-items/WI-0012/candidates/tasks.md`
- **verification_commands**:
  - `test -f fj-android/react-native.config.js`
  - `grep -q "watermelondb" fj-android/react-native.config.js`
  - `grep -q "vision-camera" fj-android/react-native.config.js`
  - `grep -q "keychain" fj-android/react-native.config.js`
  - `bash -c 'grep -c "blocking: true" fj-android/react-native.config.js | tr -d " "' | grep -qE '^[3-9]$'`
  - `docker run --rm -v /mnt/1t_back/project/fj1/fj-android:/build -w /build fj-builder:react-native-0.74 node -e "require('/build/react-native.config.js')"`
- **verification_evidence_expected**:
  - `test -f`：退出码 0
  - `grep -q` 系列：退出码 0（三个模块均被引用）
  - `grep -c "blocking: true"`：输出 ≥ 3
  - `node -e require(...)`：退出码 0（配置文件语法正确，可被 Node 加载）
- **out_of_scope**:
  - 不修改 babel.config.js（方案 B 仅在方案 A 失败时启用，非本 task 范围）
  - 不修复三个原生模块本身的编译问题（范围外观察 #1，留给后续 WI）
  - 不验证屏蔽后三个模块的 JS 功能（本 WI 仅要求 APK 可构建，不要求功能可用）
  - 不引入 ProGuard / R8 混淆

---

### TASK-4 创建 App.tsx + index.js + metro.config.js（JS 最小入口层）

**context_block**（executor 必读）：

- **What**: 创建 3 个 JS 入口层文件：
  1. `fj-android/App.tsx` — 根组件，用 `SafeAreaProvider` 包裹 `<AppNavigator />`，默认导出 `App` 函数组件，返回类型 `React.ReactElement`。
  2. `fj-android/index.js` — 注册入口，`import { AppRegistry } from 'react-native'` + `AppRegistry.registerComponent('fj-android', () => App)`。
  3. `fj-android/metro.config.js` — Metro 打包配置，通过 `getDefaultConfig(__dirname)` 获取 RN 0.74 默认配置并导出。
- **Why**: 实现 REQ-3（App.tsx 入口）+ REQ-4（index.js + metro.config.js），为 Metro 打包器提供 JS bundle 根节点。DD-2 设计决策：App.tsx 仅渲染既有 AppNavigator（不引入业务逻辑），用 SafeAreaProvider 包裹（满足 react-navigation 对 NavigationContainer 的上下文要求）。
- **Refs**: DD-2（App.tsx 入口设计），REQ-3 AC-1~AC-5，REQ-4 AC-1~AC-5
- **Constraints**:
  - **App.tsx**:
    - 从 `./src/navigation/AppNavigator` 默认导入 `AppNavigator`（既有文件，**只读不修改**）
    - 用 `SafeAreaProvider`（来自 `react-native-safe-area-context`，已在 package.json 依赖中）包裹
    - 默认导出 `App` 函数组件，返回类型 `React.ReactElement`
    - **不得**包含网络请求、数据库初始化、登录逻辑（REQ-3 AC-2）
    - **不得**引用 AppConfig（暂不需要网络，DD-2 决策）
    - **不得**引入 ErrorBoundary / SplashScreen（留给 WI-0013+）
  - **index.js**:
    - `import { AppRegistry } from 'react-native'`
    - `import App from './App'`（不带 .tsx 扩展名）
    - `AppRegistry.registerComponent('fj-android', () => App)` — 注册名 `fj-android` 必须与 app.json name 一致
    - 可选保留 `console.log` / 注释，但不得有其他副作用
  - **metro.config.js**:
    - `const { getDefaultConfig } = require('metro-config')`（或 `require('metro-react-native/babel-transformer')` 风格，与 RN 0.74 模板一致）
    - 通过 `getDefaultConfig(__dirname)` 获取默认配置
    - 导出合并后的配置对象
  - 容器内 `tsc --noEmit` 须通过（REQ-3 AC-4, REQ-5 AC-4 类型检查）
  - **不得修改** `fj-android/src/` 下任何文件（REQ-10）
- **Done When**:
  - `test -f fj-android/App.tsx` 通过
  - `test -f fj-android/index.js` 通过
  - `test -f fj-android/metro.config.js` 通过
  - `grep -q "SafeAreaProvider" fj-android/App.tsx` 命中
  - `grep -q "AppNavigator" fj-android/App.tsx` 命中
  - `grep -q "AppRegistry.registerComponent" fj-android/index.js` 命中
  - `grep -q "'fj-android'" fj-android/index.js` 命中（注册名匹配 app.json）
  - `grep -q "getDefaultConfig" fj-android/metro.config.js` 命中
  - 容器内 `docker run ... node -e "require('./metro.config.js')"` 不抛错
  - 容器内 `docker run ... npx tsc --noEmit` 退出码 0（类型检查通过，REQ-3 AC-4）

- **依赖**: 无（AppNavigator 已存在于 src/navigation/，只读引用）
- refs: [DD-2, REQ-3, REQ-4]
- **expected_file_changes**:
  - 新增 `fj-android/App.tsx`
  - 新增 `fj-android/index.js`
  - 新增 `fj-android/metro.config.js`
- **allowed_write_files**:
  - `fj-android/App.tsx`
  - `fj-android/index.js`
  - `fj-android/metro.config.js`
- **forbidden_files**:
  - `fj-android/src/navigation/AppNavigator.tsx`（只读引用，REQ-10 保护）
  - `fj-android/src/` 下所有其他既有文件（REQ-10）
  - `fj-android/package.json`（不得新增依赖，SafeAreaProvider 已在依赖中）
  - `fj-android/babel.config.js`
  - `fj-android/tsconfig.json`
  - `fj-android/android/`（TASK-1 范围）
  - `.specforge/work-items/WI-0012/requirements.md`
  - `.specforge/work-items/WI-0012/design.md`
  - `.specforge/work-items/WI-0012/candidates/tasks.md`
- **verification_commands**:
  - `test -f fj-android/App.tsx`
  - `test -f fj-android/index.js`
  - `test -f fj-android/metro.config.js`
  - `grep -q "SafeAreaProvider" fj-android/App.tsx`
  - `grep -q "AppNavigator" fj-android/App.tsx`
  - `grep -q "export default" fj-android/App.tsx`
  - `grep -q "AppRegistry.registerComponent" fj-android/index.js`
  - `bash -c 'grep "fj-android" fj-android/index.js | grep -q registerComponent'`
  - `grep -q "getDefaultConfig" fj-android/metro.config.js`
  - `docker run --rm -v /mnt/1t_back/project/fj1/fj-android:/build -w /build fj-builder:react-native-0.74 node -e "require('/build/metro.config.js')"`
  - `docker run --rm -v /mnt/1t_back/project/fj1/fj-android:/build -v fj1-gradle-cache:/root/.gradle -v fj1-npm-cache:/root/.npm -w /build fj-builder:react-native-0.74 npx tsc --noEmit`
- **verification_evidence_expected**:
  - `test -f` / `grep -q` 系列：退出码 0
  - `node -e require(metro.config.js)`：退出码 0（Metro 配置可加载）
  - `npx tsc --noEmit`：退出码 0（TypeScript 类型检查通过，证明 App.tsx 与 AppNavigator 签名兼容）
- **out_of_scope**:
  - 不引入 Provider 链（Redux / MobX / Context 业务 Provider）
  - 不引入 ErrorBoundary / SplashScreen（WI-0013+）
  - 不引入 DatabaseProvider / SyncEngineProvider（DD-2 明确排除）
  - 不修改 tsconfig.json（若类型检查失败，暂停并在 work_log 报告冲突）

---

### TASK-5 创建 src/config/AppConfig.ts（API 地址配置单点）

**context_block**（executor 必读）：

- **What**: 在 `fj-android/src/config/AppConfig.ts` 创建应用级配置单点文件，导出 `AppConfigType` interface 和 `AppConfig` 常量对象，其中 `API_BASE_URL` 字段硬编码为 `'http://129.211.5.240'`。
- **Why**: 实现 REQ-5（集中管理后端 API 地址）+ REQ-12（公网 IP 硬编码策略，用户决策）。后续修改 API 端点只需改这一个文件，无需改动业务代码。DD-3 设计：单点字面量 + TypeScript 类型安全，不引入 react-native-config / dotenv。
- **Refs**: DD-3（AppConfig.ts 配置设计），REQ-5 AC-1~AC-5，REQ-12 AC-1~AC-3
- **Constraints**:
  - **路径**：`fj-android/src/config/AppConfig.ts`（这是 `src/` 下**唯一**允许新增的文件，REQ-10 AC-1）
  - 导出 `interface AppConfigType { API_BASE_URL: string }`
  - 导出 `const AppConfig: AppConfigType = { API_BASE_URL: 'http://129.211.5.240' } as const`
  - `API_BASE_URL` 为字面量字符串硬编码，**不得**通过 `process.env` / `react-native-config` / `dotenv` 读取（REQ-12 AC-1/AC-2）
  - **不得**在 `fj-android/` 其他位置硬编码 `129.211.5.240`（DD-3 属性 P-CFG-1：全 src 仅此一处）
  - **不得修改** `fj-android/src/` 下其他任何既有文件（REQ-10 AC-1）
  - **不得引入** `react-native-config` / `dotenv` / `react-native-dotenv` 到 package.json（REQ-12 AC-2）
  - 预留扩展点注释（REQ-5 AC-5：后续 WI 可基于 `__DEV__` 或环境变量分支，本 WI 不实现）
  - 容器内 `tsc --noEmit` 须通过（REQ-5 AC-4）
- **Done When**:
  - `test -f fj-android/src/config/AppConfig.ts` 通过
  - `grep -q "export interface AppConfigType" fj-android/src/config/AppConfig.ts` 命中
  - `grep -q "export const AppConfig" fj-android/src/config/AppConfig.ts` 命中
  - `grep -q "API_BASE_URL" fj-android/src/config/AppConfig.ts` 命中
  - `grep -q "'http://129.211.5.240'" fj-android/src/config/AppConfig.ts` 命中（字面量硬编码）
  - `bash -c 'grep -rn "129.211.5.240" fj-android/src/ | wc -l | tr -d " "' | grep -qx 1`（全 src 仅此一处出现 IP）
  - `bash -c '! grep -rq "process.env.API\|react-native-config\|dotenv" fj-android/src/'`（无 env 读取机制）
  - `bash -c '! grep -rq "react-native-config\|dotenv\|react-native-dotenv" fj-android/package.json'`（未引入 env 库）
  - 容器内 `npx tsc --noEmit` 退出码 0（REQ-5 AC-4）

- **依赖**: 无（独立新增文件）
- refs: [DD-3, REQ-5, REQ-12]
- **expected_file_changes**:
  - 新增 `fj-android/src/config/AppConfig.ts`
- **allowed_write_files**:
  - `fj-android/src/config/AppConfig.ts`
- **forbidden_files**:
  - `fj-android/src/` 下所有其他既有文件（REQ-10 AC-1，含 AppNavigator.tsx / ApiClient / SyncEngine / 屏幕骨架 / 模型等 25 个文件）
  - `fj-android/package.json`（REQ-12 AC-2 禁止引入 env 库）
  - `fj-android/babel.config.js`
  - `fj-android/tsconfig.json`
  - `fj-android/android/`（TASK-1 范围）
  - `.specforge/work-items/WI-0012/requirements.md`
  - `.specforge/work-items/WI-0012/design.md`
  - `.specforge/work-items/WI-0012/candidates/tasks.md`
- **verification_commands**:
  - `test -f fj-android/src/config/AppConfig.ts`
  - `grep -q "export interface AppConfigType" fj-android/src/config/AppConfig.ts`
  - `grep -q "export const AppConfig" fj-android/src/config/AppConfig.ts`
  - `grep -q "API_BASE_URL" fj-android/src/config/AppConfig.ts`
  - `grep -q "129.211.5.240" fj-android/src/config/AppConfig.ts`
  - `bash -c 'grep -rn "129.211.5.240" fj-android/src/ | wc -l' | grep -qx 1`
  - `bash -c '! grep -rq "process.env.API\|react-native-config\|dotenv" fj-android/src/'`
  - `bash -c '! grep -q "react-native-config\|dotenv\|react-native-dotenv" fj-android/package.json'`
  - `docker run --rm -v /mnt/1t_back/project/fj1/fj-android:/build -v fj1-gradle-cache:/root/.gradle -v fj1-npm-cache:/root/.npm -w /build fj-builder:react-native-0.74 npx tsc --noEmit`
- **verification_evidence_expected**:
  - `test -f` / `grep -q` 系列：退出码 0
  - `grep -rn IP | wc -l`：输出恰好 `1`（P-CFG-1 属性验证）
  - `! grep -rq env-mechanism`：退出码 0（P-CFG-2 属性验证）
  - `npx tsc --noEmit`：退出码 0（类型检查通过）
- **out_of_scope**:
  - 不区分 dev / staging / prod 环境（REQ-5 AC-5 仅留注释占位）
  - 不引入 react-native-config / dotenv（REQ-12 AC-2 明确禁止）
  - 不在 App.tsx 中引用 AppConfig（DD-2 决策：本 WI 不发起网络请求）
  - 不修改 ApiClient / SyncEngine 等既有 src 文件（REQ-10）

---

### TASK-6 容器内执行 assembleDebug 构建 Debug APK

**context_block**（executor 必读）：

- **What**: 在 Docker 容器 `fj-builder:react-native-0.74` 中执行 `cd /build/android && ./gradlew assembleDebug`，在 1800s 超时内构建 Debug APK。构建须使用容器内 JDK 17 / Android SDK 27.1 / Gradle 8.6 等既定版本（DD-5 挂载策略）。
- **Why**: 实现 REQ-6（Debug APK 构建与产物验证的核心步骤），验证 TASK-1~TASK-5 的所有产物（android/ 工程、build.gradle 配置、react-native.config.js 降级、App.tsx/index.js/metro.config.js 入口、AppConfig.ts 配置）在容器内能完整构建出 APK。这是整个 WI 的集大成验证点。
- **Refs**: DD-5（构建环境 Docker 挂载策略），REQ-6 AC-1/AC-3/AC-6，REQ-7 AC-1/AC-3，REQ-9 AC-2，REQ-11 AC-1/AC-2
- **Constraints**:
  - 必须在容器内执行（`docker run` 形式，REQ-7 AC-1, REQ-11 AC-1）
  - 挂载 `-v /mnt/1t_back/project/fj1/fj-android:/build`，工作目录 `/build`（REQ-11 AC-1）
  - 挂载 `-v fj1-gradle-cache:/root/.gradle`（DD-5 Gradle 缓存命名卷，跨构建复用）
  - 挂载 `-v fj1-npm-cache:/root/.npm`（DD-5 npm 缓存命名卷）
  - 镜像标签固定 `fj-builder:react-native-0.74`（REQ-7 AC-3，禁止 latest）
  - 构建超时 1800s（REQ-6 AC-1）
  - 构建非幂等，不自动重试（DD-5 失败处理表）
  - 构建失败时按 DD-6 决策树处理（若日志含原生模块编译错误，检查 TASK-3 的 react-native.config.js 是否生效）
  - **不得**在宿主机直接调用 gradle 或 react-native（REQ-11 AC-3）
  - **不得修改** `fj-android/src/` 下任何文件（REQ-10）
  - 产物路径（权威）：`/build/android/app/build/outputs/apk/debug/app-debug.apk`（容器内路径），对应宿主机 `fj-android/android/app/build/outputs/apk/debug/app-debug.apk`
- **Done When**:
  - 容器内 `cd /build/android && ./gradlew assembleDebug` 退出码 0（REQ-6 AC-1）
  - `test -f fj-android/android/app/build/outputs/apk/debug/app-debug.apk` 通过
  - APK 文件大小 > 1048576 字节（1 MB，REQ-6 AC-2）

- **依赖**: TASK-1（android/ 工程）, TASK-2（build.gradle 配置）, TASK-3（react-native.config.js 降级）, TASK-4（App.tsx / index.js / metro.config.js 入口）, TASK-5（AppConfig.ts 配置）
- refs: [DD-5, REQ-6, REQ-7, REQ-9, REQ-11]
- **expected_file_changes**:
  - 构建产物 `fj-android/android/app/build/outputs/apk/debug/app-debug.apk`（Gradle 生成）
  - 构建中间产物 `fj-android/android/app/build/` 下其他文件（Gradle 生成）
  - 构建中间产物 `fj-android/android/build/` 下文件（Gradle 生成）
  - 构建中间产物 `fj-android/android/.gradle/` 下文件（Gradle 生成）
- **allowed_write_files**:
  - `fj-android/android/app/build/outputs/apk/debug/app-debug.apk`
  > 注：Gradle 构建会在 `fj-android/android/app/build/`、`fj-android/android/build/`、`fj-android/android/.gradle/` 下生成大量中间产物（.class / .dex / .jar / 资源文件等），这些是构建过程的自然产物，executor 不手动修改它们。
- **forbidden_files**:
  - `fj-android/src/`（REQ-10）
  - `fj-android/App.tsx`
  - `fj-android/index.js`
  - `fj-android/metro.config.js`
  - `fj-android/react-native.config.js`
  - `fj-android/android/app/build.gradle`（TASK-2 已完成）
  - `fj-android/android/settings.gradle`
  - `fj-android/android/app/src/main/java/com/fjandroid/`（TASK-1 已完成）
  - `fj-android/package.json`
  - `fj-android/app.json`
  - `.specforge/work-items/WI-0012/requirements.md`
  - `.specforge/work-items/WI-0012/design.md`
  - `.specforge/work-items/WI-0012/candidates/tasks.md`
- **verification_commands**:
  - `docker run --rm -v /mnt/1t_back/project/fj1/fj-android:/build -v fj1-gradle-cache:/root/.gradle -v fj1-npm-cache:/root/.npm -w /build fj-builder:react-native-0.74 bash -c 'cd /build/android && ./gradlew assembleDebug'`
  - `test -f fj-android/android/app/build/outputs/apk/debug/app-debug.apk`
  - `bash -c 'stat -c%s fj-android/android/app/build/outputs/apk/debug/app-debug.apk | tr -d " "' | awk '{if ($1 > 1048576) exit 0; else exit 1}'`
- **verification_evidence_expected**:
  - `./gradlew assembleDebug`：退出码 0（BUILD SUCCESSFUL，REQ-6 AC-1）
  - `test -f app-debug.apk`：退出码 0
  - `stat -c%s > 1048576`：退出码 0（APK > 1MB，REQ-6 AC-2）
- **out_of_scope**:
  - 不执行真机安装测试（WI-0013）
  - 不配置 Release 签名 / ProGuard（WI-0014）
  - 不验证原生模块功能（watermelondb / vision-camera / keychain，范围外观察 #1）
  - 不优化构建性能（Gradle Daemon / 并行 / 构建缓存，范围外观察 #5）
  - APK 内容深度验证（classes.dex / index.android.bundle）由 TASK-7 负责

---

### TASK-7 验证 APK 产物完整性 + 构建可重复性

**context_block**（executor 必读）：

- **What**: 对 TASK-6 生成的 Debug APK 执行 5 项产物验证：
  1. APK 内含 `classes.dex`（至少 1 个，REQ-6 AC-4）
  2. APK 内含 `assets/index.android.bundle`（恰好 1 个，REQ-6 AC-5，证明 Metro 已将 JS bundle 打入）
  3. APK 的 `applicationId` 为 `com.fjandroid`（DD-4 验证点）
  4. IP 字面量单点验证（P-CFG-1：全 src 仅 AppConfig.ts 一处出现 `129.211.5.240`）
  5. （可选）构建可重复性验证（REQ-9 AC-1：清空 build/.gradle/app/build 缓存后重建，二次构建仍成功）
- **Why**: 实现 REQ-6 AC-4/AC-5（APK 内容验证）+ REQ-9（构建可重复性）+ DD-4（包名验证）。构建成功（TASK-6）不等于产物正确，需验证 APK 内部结构（DEX 字节码 + JS bundle）和元数据（applicationId）满足设计要求。
- **Refs**: REQ-6 AC-4/AC-5, REQ-9 AC-1/AC-3, DD-4 验证点, DD-3 属性 P-CFG-1
- **Constraints**:
  - 所有验证命令在宿主机执行（APK 文件通过 bind mount 双向可见）
  - `unzip -l` 用于检查 APK 内容（不解压到磁盘）
  - `aapt dump badging` 用于检查 applicationId（若容器内有 aapt，则需容器内执行）
  - **不得修改**任何源代码文件（纯验证 task）
  - **不得删除** APK 产物
  - 构建可重复性验证为**可选**步骤（REQ-9 优先级 Should），若时间允许可执行
- **Done When**:
  - `unzip -l fj-android/android/app/build/outputs/apk/debug/app-debug.apk | grep -c classes.dex` 输出 ≥ 1（REQ-6 AC-4）
  - `unzip -l fj-android/android/app/build/outputs/apk/debug/app-debug.apk | grep -c "assets/index.android.bundle"` 输出恰好 1（REQ-6 AC-5）
  - 容器内 `aapt dump badging` 输出含 `package: name='com.fjandroid'`（DD-4 验证点）

- **依赖**: TASK-6（APK 已生成）
- refs: [REQ-6, REQ-9, DD-4, DD-3]
- **expected_file_changes**:
  - 无（纯验证 task，不新增/不修改文件）
- **allowed_write_files**:
  - （无 — 本 task 不修改任何文件）
- **forbidden_files**:
  - `fj-android/src/`（REQ-10）
  - `fj-android/android/`（不修改工程文件）
  - `fj-android/android/app/build/outputs/apk/debug/app-debug.apk`（只验证不修改）
  - `.specforge/work-items/WI-0012/requirements.md`
  - `.specforge/work-items/WI-0012/design.md`
  - `.specforge/work-items/WI-0012/candidates/tasks.md`
- **verification_commands**:
  - `bash -c 'unzip -l fj-android/android/app/build/outputs/apk/debug/app-debug.apk | grep -c classes.dex | tr -d " "' | grep -qE '^[1-9]'`
  - `bash -c 'unzip -l fj-android/android/app/build/outputs/apk/debug/app-debug.apk | grep -c "assets/index.android.bundle" | tr -d " "' | grep -qx 1`
  - `docker run --rm -v /mnt/1t_back/project/fj1/fj-android:/build -w /build fj-builder:react-native-0.74 bash -c 'cd /build/android && $ANDROID_HOME/build-tools/*/aapt dump badging app/build/outputs/apk/debug/app-debug.apk 2>/dev/null | grep "package: name=.com.fjandroid."'`
  - `bash -c 'grep -rn "129.211.5.240" fj-android/src/ | wc -l' | grep -qx 1`
- **verification_evidence_expected**:
  - `unzip -l | grep -c classes.dex`：输出 ≥ 1（APK 含 DEX 字节码，REQ-6 AC-4）
  - `unzip -l | grep -c index.android.bundle`：输出恰好 `1`（JS bundle 打入 APK，REQ-6 AC-5）
  - `aapt dump badging | grep package`：命中 `package: name='com.fjandroid'`（DD-4 包名验证）
  - `grep -rn IP | wc -l`：输出恰好 `1`（P-CFG-1 IP 单点验证）
- **out_of_scope**:
  - 不执行真机安装（WI-0013）
  - 不验证 watermelondb / vision-camera / keychain 功能（范围外观察 #1）
  - 不执行 ABI Split / 多架构验证（Debug universal APK 即可）
  - 不执行连续两次构建大小偏差比对（REQ-9 AC-3，若需可后续补充，本 task 仅要求首次构建产物完整）

---

## 自检（Self-Check）

完成前对本文件的 10 项自检：

| # | 检查项 | 结果 | 备注 |
|---|--------|------|------|
| 1 | 每个 DD 都有对应的 task 覆盖吗？ | ✅ | DD-1→TASK-1, DD-2→TASK-4, DD-3→TASK-5, DD-4→TASK-2, DD-5→TASK-6, DD-6→TASK-3 |
| 2 | 每个 REQ 都有对应的 task 覆盖吗？ | ✅ | REQ-1→TASK-1, REQ-2→TASK-1/2, REQ-3→TASK-4, REQ-4→TASK-4, REQ-5→TASK-5, REQ-6→TASK-6/7, REQ-7→TASK-6, REQ-8→TASK-1/3, REQ-9→TASK-6/7, REQ-10→全部forbidden, REQ-11→TASK-6, REQ-12→TASK-5 |
| 3 | 每个 task 的 context_block 是否充分？ | ✅ | 全部含 What/Why/Refs/Constraints/Done When，executor 无需回查 design.md |
| 4 | verification_commands 是否真能机器跑？ | ✅ | 全部使用 test/grep/docker run/unzip/stat，返回 0/非0 退出码 |
| 5 | 并行批次内的 task 是否互相独立？ | ✅ | 批次1: TASK-1/3/4/5 修改文件不重叠（android/ vs react-native.config.js vs App.tsx/index.js/metro.config.js vs src/config/AppConfig.ts） |
| 6 | 有没有共享代码需要先建独立 task？ | ✅ | 无共享工具函数，各 task 产物独立 |
| 7 | 每个 task 大小是否在 30-200 行改动区间？ | ✅ | TASK-5 ~20行, TASK-4 ~60行, TASK-3 ~20行, TASK-2 ~5行修改, TASK-1 脚手架生成, TASK-6/7 验证类 |
| 8 | allowed_write_files 路径是否具体无通配符？ | ✅ | 全部为具体文件路径 |
| 9 | forbidden_files 是否包含 requirements/design/tasks？ | ✅ | 每个 task 均含 |
| 10 | Extension Registry 前置检查？ | ✅ | namespaces.task_types 为空，本 WI 用标准 task 类型，不触发 Extension Subflow |

---

## 完成报告（结构化摘要）

```json
{
  "status": "success",
  "files_changed": [
    ".specforge/work-items/WI-0012/candidates/tasks.md",
    ".specforge/work-items/WI-0012/trace_delta.md"
  ],
  "structure": {
    "tasks_count": 7,
    "parallel_batches": 4,
    "batch_1_parallel": ["TASK-1", "TASK-3", "TASK-4", "TASK-5"],
    "batch_2_serial": ["TASK-2"],
    "batch_3_serial": ["TASK-6"],
    "batch_4_serial": ["TASK-7"],
    "serial_tasks": 3,
    "all_tasks_have_context_block": true,
    "all_tasks_have_verification": true,
    "all_tasks_have_allowed_write_files": true,
    "all_tasks_have_forbidden_files": true
  },
  "self_check": { "passed": [1,2,3,4,5,6,7,8,9,10], "failed": [] },
  "trace_delta": {
    "generated": true,
    "requirements_covered": true,
    "design_decisions_covered": true,
    "tasks_covered": true,
    "files_covered": true
  },
  "out_of_scope_observations": []
}
```
