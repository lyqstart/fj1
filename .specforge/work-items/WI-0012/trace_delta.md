---
trace_format: specforge_v1_1
work_item_id: WI-0012
workflow_type: feature_spec
workflow_path: requirement_change_path
base_spec_version: PSV-0001
generated_by: sf-task-planner
generated_at: 2026-07-05T00:00:00Z
---

# Trace Delta — WI-0012

> 本追溯矩阵记录 `requirements.md`（12 REQ / 35 AC）→ `design.md`（6 DD）→ `tasks.md`（7 TASK）→ 目标文件 → 验证方式的完整追溯链路。

---

## 一、追溯矩阵（REQ → AC → DD → TASK → FILE → TEST）

| REQ ID | AC ID（关键 AC） | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-----------------|-------|---------|---------|---------|
| **REQ-1**（FR-1 Docker 工具链验证） | AC-1: 6 类工具版本可查 | DD-5 | TASK-1 | （容器环境，无项目文件） | `docker run ... java -version \| grep 17`; `docker run ... node --version \| grep v18+` |
| REQ-1 | AC-2: java -version 主版本 17 | DD-5 | TASK-1 | （容器环境） | `docker run --rm fj-builder:react-native-0.74 java -version 2>&1 \| grep '"17'` |
| REQ-1 | AC-3: node --version ≥ v18 | DD-5 | TASK-1 | （容器环境） | `docker run --rm fj-builder:react-native-0.74 node --version \| grep -qE 'v(1[89]\|2[0-9])'` |
| REQ-1 | AC-4: 挂载模式可访问 /build/package.json | DD-5 | TASK-1 | （容器挂载） | `docker run --rm -v ...:/build -w /build ... test -f /build/package.json` |
| REQ-1 | AC-5: 工具缺失时非零退出 | DD-5 | TASK-1 | （容器环境） | 工具链验证命令整体退出码非 0 时 fail-stop |
| **REQ-2**（FR-2 原生 android/ 工程初始化） | AC-1: 6 个必需文件存在 | DD-1 | TASK-1 | `android/settings.gradle`, `android/build.gradle`, `android/app/build.gradle`, `android/gradle/wrapper/gradle-wrapper.properties`, `android/gradlew`, `android/gradle.properties` | `test -f` 6 个文件 + `test -x gradlew` |
| REQ-2 | AC-2: 不覆盖 package.json dependencies | DD-1 | TASK-1 | `package.json`（forbidden） | `git diff --name-only fj-android/package.json` 无输出 |
| REQ-2 | AC-3: app.json 内容保留 | DD-1 | TASK-1 | `app.json`（forbidden） | `git diff --name-only fj-android/app.json` 无输出 |
| REQ-2 | AC-4: applicationId 与 app.json name 一致 | DD-4 | TASK-2 | `android/app/build.gradle` | `grep 'applicationId "com.fjandroid"' android/app/build.gradle` |
| REQ-2 | AC-5: android/ 已非空时终止 | DD-1 | TASK-1 | （前置检查） | 复制前 `test ! -d fj-android/android \|\| [ -z "$(ls -A fj-android/android)" ]` |
| REQ-2 | AC-6: MainActivity/MainApplication 包路径正确 | DD-1 | TASK-1 | `android/app/src/main/java/com/fjandroid/MainActivity.java`, `MainApplication.java` | `grep -rl "package com.fjandroid" ... \| wc -l == 2`; `! grep -rq "fjandroidtmp"` |
| **REQ-3**（FR-3 App.tsx 入口） | AC-1: 导入 AppNavigator 作为根组件 | DD-2 | TASK-4 | `App.tsx` | `grep -q "AppNavigator" App.tsx` |
| REQ-3 | AC-2: 不含网络/DB/登录逻辑 | DD-2 | TASK-4 | `App.tsx` | `grep -q "SafeAreaProvider" App.tsx`; 代码审查无 fetch/async/db 调用 |
| REQ-3 | AC-3: SafeAreaProvider 包裹 | DD-2 | TASK-4 | `App.tsx` | `grep -q "SafeAreaProvider" App.tsx` |
| REQ-3 | AC-4: tsc --noEmit 通过 | DD-2 | TASK-4 | `App.tsx` | `docker run ... npx tsc --noEmit`（退出码 0） |
| REQ-3 | AC-5: 返回类型 React.ReactElement 兼容 | DD-2 | TASK-4 | `App.tsx` | `tsc --noEmit` 通过即证明类型兼容 |
| **REQ-4**（FR-4 index.js + metro.config.js） | AC-1: registerComponent 注册名 'fj-android' | DD-2 | TASK-4 | `index.js` | `grep "fj-android" index.js \| grep registerComponent` |
| REQ-4 | AC-2: import App from './App' 无扩展名 | DD-2 | TASK-4 | `index.js` | `grep -q "import App from './App'" index.js` |
| REQ-4 | AC-3: getDefaultConfig 合并配置 | DD-2 | TASK-4 | `metro.config.js` | `grep -q "getDefaultConfig" metro.config.js` |
| REQ-4 | AC-4: metro.config.js 缺失/语法错误会阻止构建 | DD-2 | TASK-4 | `metro.config.js` | `node -e "require('./metro.config.js')"` 退出码 0 |
| REQ-4 | AC-5: npx react-native start 可加载配置 | DD-2 | TASK-4 | `metro.config.js` | `node -e require(...)` 不抛错 |
| **REQ-5**（FR-5 AppConfig.ts） | AC-1: 导出 AppConfig 含 API_BASE_URL | DD-3 | TASK-5 | `src/config/AppConfig.ts` | `grep -q "API_BASE_URL" AppConfig.ts`; `grep -q "export const AppConfig"` |
| REQ-5 | AC-2: API_BASE_URL 默认值 'http://129.211.5.240' | DD-3 | TASK-5 | `src/config/AppConfig.ts` | `grep -q "'http://129.211.5.240'" AppConfig.ts` |
| REQ-5 | AC-3: 导出 TypeScript 类型定义 | DD-3 | TASK-5 | `src/config/AppConfig.ts` | `grep -q "export interface AppConfigType" AppConfig.ts` |
| REQ-5 | AC-4: tsc --noEmit 通过 | DD-3 | TASK-5 | `src/config/AppConfig.ts` | `docker run ... npx tsc --noEmit`（退出码 0） |
| REQ-5 | AC-5: 预留环境扩展点（注释占位） | DD-3 | TASK-5 | `src/config/AppConfig.ts` | 代码审查含 `__DEV__` 或环境变量注释占位 |
| **REQ-6**（FR-6 Debug APK 构建） | AC-1: assembleDebug 退出码 0（1800s 内） | DD-5 | TASK-6 | `android/app/build/outputs/apk/debug/app-debug.apk` | `docker run ... ./gradlew assembleDebug`（退出码 0） |
| REQ-6 | AC-2: APK > 1 MB | DD-5 | TASK-6 | `app-debug.apk` | `stat -c%s app-debug.apk > 1048576` |
| REQ-6 | AC-3: 失败时输出 Task :app:xxx FAILED | DD-5/DD-6 | TASK-6 | （构建日志） | 构建失败时日志含 `FAILED`（fail-stop，不残留 APK） |
| REQ-6 | AC-4: APK 含 classes.dex ≥ 1 | DD-5 | TASK-7 | `app-debug.apk` | `unzip -l app-debug.apk \| grep -c classes.dex ≥ 1` |
| REQ-6 | AC-5: APK 含 index.android.bundle == 1 | DD-5 | TASK-7 | `app-debug.apk` | `unzip -l app-debug.apk \| grep -c "assets/index.android.bundle" == 1` |
| REQ-6 | AC-6: 使用容器既定工具版本 | DD-5 | TASK-6 | （容器环境） | 构建在 `fj-builder:react-native-0.74` 内执行，版本由镜像保证 |
| **REQ-7**（NFR-1 构建环境一致性） | AC-1: 所有命令在容器内执行 | DD-5 | TASK-6 | （执行方式约束） | 所有 verification_commands 使用 `docker run` 形式 |
| REQ-7 | AC-2: 容器内版本为准 | DD-5 | TASK-6 | （容器环境） | 工具链验证以容器输出为准 |
| REQ-7 | AC-3: 固定镜像标签 | DD-5 | TASK-1, TASK-6 | （执行方式约束） | 所有 docker run 使用 `fj-builder:react-native-0.74`（非 latest） |
| **REQ-8**（NFR-2 RN 版本锁定） | AC-1: react-native 固定 0.74.0 | DD-1 | TASK-1 | `package.json`（forbidden，不修改） | `git diff package.json` 无 dependencies 变更 |
| REQ-8 | AC-2: Gradle Plugin 与 0.74 兼容 | DD-1/DD-6 | TASK-1, TASK-3 | `android/app/build.gradle`（模板默认）, `react-native.config.js` | `npx react-native init --template react-native@0.74` 生成 |
| REQ-8 | AC-3: npx react-native --version 一致 | DD-1 | TASK-1 | （容器环境） | 容器内 CLI 版本与 0.74 系列一致 |
| **REQ-9**（NFR-3 构建可重复性） | AC-1: 干净重建成功（1800s 内） | DD-5 | TASK-6, TASK-7 | `android/build/`, `android/.gradle/`, `android/app/build/` | （可选）清空缓存后重跑 assembleDebug 退出码 0 |
| REQ-9 | AC-2: 依赖可缓存，不强制外网 | DD-5 | TASK-6 | （Gradle 缓存卷） | `-v fj1-gradle-cache:/root/.gradle` 命名卷复用 |
| REQ-9 | AC-3: 连续两次构建 APK 大小偏差 < 5% | DD-5 | TASK-7 | （APK 大小比对） | （可选）两次 `stat -c%s` 比对 |
| **REQ-10**（CON-1 不修改 src/ 骨架） | AC-1: 仅新增 config/AppConfig.ts | DD-1/DD-3 | TASK-5（唯一允许）, 其余 task forbidden | `src/config/AppConfig.ts`（新增） | 全部 task 的 forbidden_files 含 `fj-android/src/` |
| REQ-10 | AC-2: git diff --stat src/ 无其他变更 | DD-1/DD-3 | 全部 task | `src/`（保护） | `git diff --stat fj-android/src/` 仅显示 config/AppConfig.ts |
| REQ-10 | AC-3: 需修改时暂停报告 | — | 全部 task | （冲突处理协议） | 发现冲突时 fail-stop，在 work_log 报告 |
| **REQ-11**（CON-2 Docker 容器构建强制） | AC-1: docker run 形式 + 挂载 + /build 工作目录 | DD-5 | TASK-6 | （执行方式约束） | verification_commands 全部 `docker run -v ...:/build -w /build` |
| REQ-11 | AC-2: 容器内 whoami 确认 | DD-5 | TASK-6 | （容器环境） | 构建在容器内执行（非宿主机） |
| REQ-11 | AC-3: 禁止宿主机直接调 gradle/rn | DD-5 | 全部 task | （执行方式约束） | task 约束明确禁止宿主机执行 |
| **REQ-12**（CON-3 公网 IP 硬编码） | AC-1: API_BASE_URL 字面量硬编码 | DD-3 | TASK-5 | `src/config/AppConfig.ts` | `grep -q "'http://129.211.5.240'" AppConfig.ts`; `grep -rn IP \| wc -l == 1` |
| REQ-12 | AC-2: 不引入 env 读取库 | DD-3 | TASK-5 | `package.json`（forbidden） | `! grep -q "react-native-config\|dotenv" package.json` |
| REQ-12 | AC-3: 修改地址只需改 AppConfig.ts | DD-3 | TASK-5 | `src/config/AppConfig.ts` | 设计保证：字面量单点，无 env 注入 |

---

## 二、文件覆盖矩阵

| 文件路径 | 创建/修改/删除 | 涉及 REQ | 涉及 TASK | 验证方式 |
|----------|---------------|---------|-----------|---------|
| `fj-android/android/settings.gradle` | 新增（TASK-1） | REQ-2 | TASK-1 | `test -f` |
| `fj-android/android/build.gradle` | 新增（TASK-1） | REQ-2 | TASK-1 | `test -f` |
| `fj-android/android/app/build.gradle` | 新增（TASK-1）+ 修改（TASK-2） | REQ-2, REQ-8 | TASK-1, TASK-2 | `test -f`; `grep 'applicationId "com.fjandroid"'` |
| `fj-android/android/gradle/wrapper/gradle-wrapper.properties` | 新增（TASK-1） | REQ-2 | TASK-1 | `test -f` |
| `fj-android/android/gradlew` | 新增（TASK-1） | REQ-2 | TASK-1 | `test -f`; `test -x`（可执行位） |
| `fj-android/android/gradlew.bat` | 新增（TASK-1） | REQ-2 | TASK-1 | `test -f` |
| `fj-android/android/gradle.properties` | 新增（TASK-1） | REQ-2 | TASK-1 | `test -f` |
| `fj-android/android/app/src/main/AndroidManifest.xml` | 新增（TASK-1） | REQ-2 | TASK-1 | `test -f` |
| `fj-android/android/app/src/main/java/com/fjandroid/MainActivity.java` | 新增+重命名（TASK-1） | REQ-2 | TASK-1 | `grep "package com.fjandroid"` |
| `fj-android/android/app/src/main/java/com/fjandroid/MainApplication.java` | 新增+重命名（TASK-1） | REQ-2 | TASK-1 | `grep "package com.fjandroid"` |
| `fj-android/android/app/src/main/res/values/strings.xml` | 新增（TASK-1） | REQ-2 | TASK-1 | `test -f` |
| `fj-android/android/app/src/main/res/values/styles.xml` | 新增（TASK-1） | REQ-2 | TASK-1 | `test -f` |
| `fj-android/android/app/src/debug/AndroidManifest.xml` | 新增（TASK-1） | REQ-2 | TASK-1 | `test -f` |
| `fj-android/android/app/proguard-rules.pro` | 新增（TASK-1） | REQ-2 | TASK-1 | `test -f` |
| `fj-android/react-native.config.js` | 新增（TASK-3） | REQ-6, REQ-8 | TASK-3 | `test -f`; `node -e require(...)`; `grep blocking` |
| `fj-android/App.tsx` | 新增（TASK-4） | REQ-3 | TASK-4 | `test -f`; `grep SafeAreaProvider`; `grep AppNavigator`; `tsc --noEmit` |
| `fj-android/index.js` | 新增（TASK-4） | REQ-4 | TASK-4 | `test -f`; `grep registerComponent('fj-android')` |
| `fj-android/metro.config.js` | 新增（TASK-4） | REQ-4 | TASK-4 | `test -f`; `grep getDefaultConfig`; `node -e require(...)` |
| `fj-android/src/config/AppConfig.ts` | 新增（TASK-5） | REQ-5, REQ-12 | TASK-5 | `test -f`; `grep API_BASE_URL`; `grep IP \| wc -l == 1`; `tsc --noEmit` |
| `fj-android/android/app/build/outputs/apk/debug/app-debug.apk` | 构建产物（TASK-6） | REQ-6 | TASK-6, TASK-7 | `test -f`; `stat > 1MB`; `unzip -l \| grep classes.dex`; `unzip -l \| grep index.android.bundle`; `aapt dump badging` |
| `fj-android/package.json` | **不修改**（forbidden） | REQ-2, REQ-8, REQ-10, REQ-12 | — | `git diff` 无输出 |
| `fj-android/app.json` | **不修改**（forbidden） | REQ-2, REQ-10 | — | `git diff` 无输出 |
| `fj-android/babel.config.js` | **不修改**（forbidden，DD-6 方案 B 备选） | REQ-10 | — | `git diff` 无输出 |
| `fj-android/tsconfig.json` | **不修改**（forbidden） | REQ-10 | — | `git diff` 无输出 |
| `fj-android/src/`（25 个既有骨架文件） | **不修改**（forbidden，REQ-10 保护） | REQ-10 | — | `git diff --stat src/` 仅 AppConfig.ts |

---

## 三、覆盖统计

| 统计项 | 数量 | 状态 |
|--------|------|------|
| 总 REQ 数 | 12 | — |
| 总 AC 数（关键 AC） | 35 | — |
| 总 DD 数 | 6 | — |
| 总 TASK 数 | 7 | — |
| **REQ 覆盖率** | 12/12 = **100%** | ✅ 无悬空 REQ |
| **DD 覆盖率** | 6/6 = **100%** | ✅ 无悬空 DD |
| **TASK 覆盖率** | 7/7 = **100%** | ✅ 无悬空 TASK |
| **AC 覆盖率** | 35/35 = **100%** | ✅ 无悬空 AC |
| **REQ → DD 映射** | 12/12 | ✅ 每个 REQ 至少 1 个 DD |
| **DD → TASK 映射** | 6/6 | ✅ 每个 DD 至少 1 个 TASK |
| **TASK → FILE 映射** | 7/7 | ✅ 每个 TASK 有明确目标文件 |
| **FILE → 验证方式映射** | 全覆盖 | ✅ 每个目标文件有验证命令 |

### 无悬空检查

- ✅ **无悬空 REQ**：所有 12 个 REQ 均有 DD 覆盖 + TASK 覆盖
- ✅ **无悬空 DD**：所有 6 个 DD 均有 TASK 覆盖（DD-1→TASK-1, DD-2→TASK-4, DD-3→TASK-5, DD-4→TASK-2, DD-5→TASK-6, DD-6→TASK-3）
- ✅ **无悬空 TASK**：所有 7 个 TASK 均有明确的 REQ/DD 引用 + 目标文件 + 验证方式
- ✅ **无悬空 FILE**：所有目标文件均有验证命令

---

## 四、DD → TASK 映射速查

| DD ID | DD 标题 | 服务 TASK | 服务 REQ |
|-------|--------|-----------|----------|
| DD-1 | 原生工程生成策略（临时目录 + android/ 子树合并） | TASK-1 | REQ-1, REQ-2, REQ-8, REQ-10 |
| DD-2 | App.tsx 入口设计（最小化渲染 + SafeAreaProvider 包裹） | TASK-4 | REQ-3, REQ-4 |
| DD-3 | AppConfig.ts 配置设计（单点字面量 + 类型安全） | TASK-5 | REQ-5, REQ-10, REQ-12 |
| DD-4 | 包名（applicationId = com.fjandroid） | TASK-2 | REQ-2 |
| DD-5 | 构建环境 Docker 挂载策略（项目卷 + Gradle 缓存卷） | TASK-1, TASK-6 | REQ-1, REQ-6, REQ-7, REQ-9, REQ-11 |
| DD-6 | 原生模块兼容性降级策略（react-native.config.js 方案 A） | TASK-3 | REQ-6, REQ-8, REQ-9 |

---

## 五、REQ → TASK 映射速查

| REQ ID | REQ 标题 | 服务 TASK | 覆盖 AC |
|--------|----------|-----------|---------|
| REQ-1 | Docker 构建工具链验证 | TASK-1 | AC-1~AC-5 |
| REQ-2 | 原生 android/ 工程初始化 | TASK-1, TASK-2 | AC-1~AC-6 |
| REQ-3 | App.tsx 入口文件创建 | TASK-4 | AC-1~AC-5 |
| REQ-4 | index.js 与 metro.config.js 创建 | TASK-4 | AC-1~AC-5 |
| REQ-5 | src/config/AppConfig.ts 配置文件创建 | TASK-5 | AC-1~AC-5 |
| REQ-6 | Debug APK 构建与产物验证 | TASK-6, TASK-7 | AC-1~AC-6 |
| REQ-7 | 构建环境一致性（Docker 容器化） | TASK-6, TASK-1 | AC-1~AC-3 |
| REQ-8 | React Native 版本锁定 | TASK-1, TASK-3 | AC-1~AC-3 |
| REQ-9 | 构建可重复性 | TASK-6, TASK-7 | AC-1~AC-3 |
| REQ-10 | 不修改现有 src/ 骨架文件 | 全部 task（forbidden_files） | AC-1~AC-3 |
| REQ-11 | Docker 容器构建强制约束 | TASK-6 | AC-1~AC-3 |
| REQ-12 | 公网 IP 硬编码配置策略 | TASK-5 | AC-1~AC-3 |

---

## 六、验证方式汇总（verification_commands 类型统计）

| 验证类型 | 命令示例 | 使用 TASK | 对应属性 |
|----------|----------|-----------|---------|
| 文件存在检查 | `test -f <path>` | TASK-1,4,5,6 | 结构完整性 |
| 可执行位检查 | `test -x <path>` | TASK-1 | gradlew 权限 |
| 内容存在检查 | `grep -q <pattern> <file>` | TASK-2,3,4,5 | 配置项存在 |
| 内容计数检查 | `grep -c <pattern> \| grep -qx N` | TASK-1,3,5,7 | 精确匹配数 |
| 内容排除检查 | `! grep -rq <pattern>` | TASK-1,2,5 | 无残留/无禁止项 |
| 容器工具链验证 | `docker run ... <tool> --version` | TASK-1 | REQ-1 版本矩阵 |
| 容器 Node.js 加载 | `docker run ... node -e "require(...)"` | TASK-3,4 | 配置文件语法正确 |
| 容器类型检查 | `docker run ... npx tsc --noEmit` | TASK-4,5 | TypeScript 类型安全 |
| 容器构建 | `docker run ... ./gradlew assembleDebug` | TASK-6 | APK 构建成功 |
| 文件大小检查 | `stat -c%s \| awk > threshold` | TASK-6 | APK > 1MB |
| ZIP 内容检查 | `unzip -l \| grep -c <entry>` | TASK-7 | APK 内含 DEX/JS bundle |
| APK 元数据检查 | `aapt dump badging \| grep package` | TASK-7 | applicationId 验证 |
