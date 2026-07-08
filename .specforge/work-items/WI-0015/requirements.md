---
requirements_format: ears
work_item_id: WI-0015
workflow_type: feature_spec
workflow_path: requirement_change_path
date: 2026-07-05
title: 数据库初始化 + WatermelonDB 同步引擎激活 需求规格（Candidate）
target_path: .specforge/project/modules/core/requirements.md
operation: replace
base_spec_version: PSV-0001
---

# Requirements — WI-0015 数据库初始化 + WatermelonDB 同步引擎激活

> 本文件为 Requirements Candidate（§8.2），拟替换写入正式规格真相源 `core/requirements.md`。
> 仅描述"做什么"与"验收什么"，不涉及架构选型与实现细节（属 sf-design 职责）。

## 简介

本规格激活飞检安卓端 `fj-android` 的**本地数据层**与**与服务端的增量同步引擎**，为后续业务屏幕（WI-0016~0020）提供数据基础。

当前状态（基线事实，仅供设计参考）：
- `@nozbe/watermelondb` 已通过 npm 安装，但其原生 autolinking 在 `react-native.config.js` 中被屏蔽（`platforms.android = null`），导致 JSI 原生模块未编译进 APK。
- `src/store/database.ts` 为骨架，依赖 SQLCipher + react-native-keychain 加密方案；`initDatabase()` 流程需要 Android Keystore 密钥，在当前未实现 native 加密模块时无法落地。
- `src/api/SyncEngine.ts` 为完整骨架，定义了 `SyncDatabasePort` 接口（4 个方法），但**没有 WatermelonDB 生产实现**；`push/pull/fullSync` 因依赖未实现的端口而无法运行。
- `src/di/SyncEnginePort.tsx` 仅暴露 Context 与 `useSyncEngine()` hook，未提供工厂函数与初始化逻辑，`useSyncEngine()` 始终返回 `null`。
- `App.tsx` 当前为三层包裹（`ErrorBoundary > AuthProvider > RootNavigator`），未集成 `DatabaseProvider` 与 `SyncEngineProvider`。
- `TD-ANDROID-001` 已决策 MVP 阶段降级为不加密普通 SQLite。

本 WI 完成后，App 启动流程应为：
`ErrorBoundary > AuthProvider > (await initDatabase) > DatabaseProvider > SyncEngineProvider > RootNavigator`；
登录成功后自动触发首次 `fullSync()`（非阻塞），后续业务屏幕可通过 `useDatabase()` 与 `useSyncEngine()` 获取运行时实例。

## 术语表

| 术语 | 定义 |
|------|------|
| WatermelonDB | `@nozbe/watermelondb`，React Native 离线优先的本地数据库 ORM，底层基于 SQLite，支持 JSI 高性能模式。 |
| Autolinking | React Native CLI 自动将 npm 包的原生模块（Android Java/Kotlin、iOS ObjC）链接进原生工程的机制。 |
| JSI (JavaScript Interface) | React Native 0.73+ 提供的 C++ 同步桥接层，使 JS 可以同步调用原生 SQLite，相比传统 bridge 性能更高。 |
| SQLiteAdapter | WatermelonDB 提供的 SQLite 适配器构造器，配置 schema/migrations/jsi/dbName 后由 `Database` 持有。 |
| Database 单例 | `database.ts` 内的模块级 `Database` 实例，整个 App 生命周期共享一份；通过 `initDatabase()` 创建、`getDatabase()` 同步获取。 |
| DatabaseProvider | `@nozbe/watermelondb/react` 提供的 React Context Provider，把 `Database` 实例下发给子组件，配合 `useDatabase()` hook 消费。 |
| SyncEngine | 飞检安卓端的增量同步引擎，封装 `pull`（拉取服务端变更）/ `push`（推送本地 dirty）/ `fullSync`（先 push 后 pull）三类同步操作。 |
| SyncDatabasePort | SyncEngine 依赖的"本地库读写端口"接口（4 个方法），用于解耦 WatermelonDB，便于单测用内存实现替换。 |
| SyncDatabaseAdapter | SyncDatabasePort 的 WatermelonDB 生产实现（本 WI 新建）。 |
| ClientSyncStateManager | 管理 `last_server_seq`（增量游标）+ 同步互斥锁的同步状态管理器，依赖注入的 `KeyValueStorage`。 |
| Dirty Record | 本地变更未推送的记录，`sync_status = 'pending_push'`。 |
| fire-and-forget | 触发异步操作后不 await 其结果、不阻塞调用方执行的调用模式。 |
| TD-ANDROID-001 | 项目技术决策记录：MVP 阶段本地数据库降级为不加密（普通 SQLite），SQLCipher 加密留给未来迭代。 |
| SQLCipher | 提供 SQLite 透明加密的开源库；本 WI 不再使用其作为 DB 加密方案。 |
| Docker 构建环境 | 镜像 `fj-builder:react-native-0.74`，承载 React Native 0.74 编译工具链，所有 APK 构建均在该容器内执行。 |
| SyncEnginePort | 屏幕层获取 SyncEngine 的 React Context 注入点；本 WI 在此新增工厂函数与初始化 hook。 |
| LOGIN_SUCCESS | AuthContext reducer 的一个 action type，登录成功后 dispatch；本 WI 在此 action 之后触发 fullSync。 |

## 需求

### REQ-1 WatermelonDB 原生模块解除屏蔽

**用户故事**：作为安卓端开发者，我希望 `@nozbe/watermelondb` 的原生模块（JSI/C++）被正常链接进 APK，以便 App 在运行时能够实际打开 SQLite 数据库文件、执行 WatermelonDB 的所有读写操作。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 在 `fj-android/react-native.config.js` 中不再为 `@nozbe/watermelondb` 设置 `platforms.android = null`（即删除该条目），使其恢复 React Native CLI 默认 autolinking 行为。
2. [Ubiquitous] THE 系统 SHALL 在同一份 `react-native.config.js` 中保留对其余 `<retain_blocked_modules_count: 5>` 个模块的屏蔽（react-native-vision-camera / react-native-image-resizer / react-native-gesture-handler / react-native-safe-area-context / react-native-screens），不解除其屏蔽。
3. [Event-driven] WHEN 在 Docker 构建环境内执行原生编译流程, THE 系统 SHALL 在编译输出中体现 watermelondb 原生模块被链接（如出现 `@nozbe/watermelondb` 相关的 Java/Kotlin/C++ 编译日志或 Gradle task），且整个链接阶段不报错。
4. [Unwanted-behavior] IF 删除 watermelondb 屏蔽后 Docker 构建发生原生模块编译错误, THEN THE 系统 SHALL 在本 WI 内修正（不通过恢复屏蔽回避），或经明确设计降级方案（如 `jsi: false`）后再判定通过。

**优先级**：Must

**依赖**：REQ-7（Docker 构建验证）

---

### REQ-2 数据库初始化激活（不加密 SQLite）

**用户故事**：作为 App 启动流程，我希望首次调用 `initDatabase()` 即可获得一个普通（非加密）SQLite 底层的 `Database` 单例，以便整个 App 后续业务代码可以稳定地读写本地数据，而无需依赖尚未实现的 SQLCipher 与 Keystore native 模块。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 在 `fj-android/src/store/database.ts` 中遵循 TD-ANDROID-001 决策，将 `createAdapter()` 简化为构造**普通 SQLite**（不加密）的 `SQLiteAdapter`，配置项中保留 `jsi: true` 与 `dbName`，不再向 native 层注入任何加密密钥。
2. [Ubiquitous] THE 系统 SHALL 移除 `initDatabase()` 流程中对 `getOrCreateEncryptionKey()` 与 `NativeModules.FJDatabase.setEncryptionKey(...)` 的实际调用；`getOrCreateEncryptionKey` 函数本身可以删除或保留为 no-op（保留时不得在初始化路径中被调用）。
3. [Ubiquitous] THE 系统 SHALL 移除 `database.ts` 中作为 DB 加密用途的 `react-native-keychain` import（如该 import 仅服务于数据库加密）；保留 `DB_KEYCHAIN_SERVICE` 等导出常量可继续存在，但不再驱动任何运行时行为。
4. [Event-driven] WHEN 在 App 启动时首次调用 `await initDatabase()`, THE 系统 SHALL 返回一个非 null 的 `Database` 实例，且该实例的 `adapter` 为基于普通 SQLite 的 `SQLiteAdapter`。
5. [State-driven] WHILE `initDatabase()` 已经成功 resolve 一次, THE 系统 SHALL 保证后续任何再次调用 `initDatabase()` 或调用 `getDatabase()` 都同步/异步返回**同一个** `Database` 实例（单例语义），不重复创建。
6. [Unwanted-behavior] IF 在 `initDatabase()` resolve 之前调用 `getDatabase()`, THEN THE 系统 SHALL 抛出明确的错误提示（不可静默返回 null 或 undefined）。
7. [Optional-feature] WHERE 设备首次启动无既有数据库文件, THE 系统 SHALL 自动创建名为 `fj`（不含扩展名）的 SQLite 数据库文件并按 `schema.ts` 中的 `SCHEMA_VERSION = 1` 初始化全部 `<sync_tables_count: 7>` 张表。

**优先级**：Must

**依赖**：REQ-1

---

### REQ-3 DatabaseProvider 集成到 App.tsx

**用户故事**：作为业务屏幕开发者，我希望 App 根组件自动初始化数据库并通过 `@nozbe/watermelondb/react` 的 `DatabaseProvider` 把 `Database` 实例下发给整棵组件树，以便任意业务组件都能通过 `useDatabase()` hook 拿到可用实例。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 在 `fj-android/App.tsx` 中使用 `@nozbe/watermelondb/react` 导出的 `DatabaseProvider`，将 `Database` 实例通过 React Context 注入。
2. [Ubiquitous] THE 系统 SHALL 在 `App.tsx` 中维持如下从外到内的组件嵌套顺序：`ErrorBoundary` > `AuthProvider` > 数据库初始化守卫（loading/error 处理） > `DatabaseProvider` > `SyncEngineProvider` > `RootNavigator`。
3. [State-driven] WHILE 数据库初始化尚未完成, THE 系统 SHALL 在 UI 上渲染一个简单的加载提示（不得引入新的第三方 UI 组件库依赖）。
4. [Unwanted-behavior] IF `initDatabase()` 抛出异常, THEN THE 系统 SHALL 渲染错误提示并提供一个可点击的"重试"按钮，点击后重新触发 `initDatabase()`。
5. [Event-driven] WHEN App 启动且数据库初始化成功, THE 系统 SHALL 渲染被 `DatabaseProvider` 包裹的 `RootNavigator`，且任何 `RootNavigator` 子组件通过 `useDatabase()` 获取的值不为 null。
6. [Ubiquitous] THE 系统 SHALL 使用 React 的 `useEffect` + `useState`（或等效机制）管理数据库初始化的 loading/error 状态，不得在模块顶层直接 `await`（避免阻塞 JS bundle 解析）。

**优先级**Must

**依赖**：REQ-2、REQ-5

---

### REQ-4 SyncDatabasePort 的 WatermelonDB 生产实现

**用户故事**：作为 SyncEngine，我希望有一个基于 WatermelonDB 的 `SyncDatabasePort` 生产实现，以便我能真正读写本地表（collect dirty / apply pulled / apply accepted / mark conflict），完成与服务端的数据同步。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 在 `fj-android/src/store/SyncDatabaseAdapter.ts` 中导出一个实现了 `SyncDatabasePort`（定义于 `src/api/SyncEngine.ts`）的类（构造函数注入 `Database` 实例）。
2. [Ubiquitous] THE 系统 SHALL 实现以下全部 `<sync_port_method_count: 4>` 个方法且签名与接口完全一致：`collectDirtyRecords()` / `applyPulledChanges(changes)` / `applyAcceptedRecords(accepted)` / `markConflictRecords(conflicts)`，不得缺失或新增方法名。
3. [Ubiquitous] THE 系统 SHALL 通过 `database.collections.get<T>(tableName)` 操作 `<sync_tables_count: 7>` 张同步表（daily_reports / daily_report_issues / photos / inspection_tasks / project_issues / notifications / standard_clauses），不得遗漏任一张同步表。
4. [Event-driven] WHEN `collectDirtyRecords()` 被调用, THE 系统 SHALL 返回所有 `sync_status = 'pending_push'` 的本地记录，按表分组为 `DirtyRecords` 结构，每条记录携带 `client_uuid` / `op` / `base_server_seq` / `fields`。
5. [Event-driven] WHEN `applyPulledChanges(changes)` 被调用, THE 系统 SHALL 对 `op = 'upsert'` 的记录执行新增/更新、对 `op = 'delete'` 的记录执行软删，并在写入后将这些记录置 `sync_status = 'synced'`，返回实际处理的记录数。
6. [Event-driven] WHEN `applyAcceptedRecords(accepted)` 被调用, THE 系统 SHALL 按 `client_uuid` 在对应表中找到本地记录，回填 `server_id` 与 `server_seq`，并置 `sync_status = 'synced'`。
7. [Event-driven] WHEN `markConflictRecords(conflicts)` 被调用, THE 系统 SHALL 按 `client_uuid` 将对应本地记录置 `sync_status = 'conflict'`，V1 不自动合并（人工裁决留给 WI-0019）。
8. [Ubiquitous] THE 系统 SHALL 在转换服务端字段与本地字段时，统一处理 4 个同步元数据字段（`server_id` / `sync_status` / `server_seq` / `client_uuid`），不与 WatermelonDB 隐式字段（`id` / `created_at` / `updated_at` / `_status` / `_changed`）混淆。
9. [Event-driven] WHEN 对 `fj-android` 工程执行 TypeScript 类型检查（如 `tsc --noEmit` 或项目配置的 typecheck 脚本）, THE 系统 SHALL 保证 `SyncDatabaseAdapter.ts` 与所有调用点类型一致、无 `any` 绕过接口的情况。

**优先级**：Must

**依赖**：REQ-2

---

### REQ-5 SyncEngine 注入到 SyncEnginePort

**用户故事**：作为业务屏幕开发者，我希望 App 根组件在数据库就绪后自动构造真实 `SyncEngine` 实例并通过 `SyncEngineProvider` 注入，以便任意组件通过 `useSyncEngine()` 获取非 null 的同步引擎。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 在 `fj-android/src/di/SyncEnginePort.tsx` 中新增一个工厂函数 `createSyncEngine(apiClient, database, projectId?)`，构造并返回真实 `SyncEngine` 实例（注入 ApiClient + Database + ClientSyncStateManager + SyncDatabaseAdapter）。
2. [Ubiquitous] THE 系统 SHALL 在 `SyncEnginePort.tsx` 中新增一个 React hook `useSyncEngineInitializer(...)`（或等效机制），在数据库就绪后创建 SyncEngine 实例并返回给 `SyncEngineProvider`。
3. [Ubiquitous] THE 系统 SHALL 在工厂函数内部新建一个 `ClientSyncStateManager` 实例（依赖注入 AsyncStorage 或等效 `KeyValueStorage`），且其命名空间按 `projectId`（若提供）隔离。
4. [Ubiquitous] THE 系统 SHALL 在工厂函数内部新建一个 `SyncDatabaseAdapter` 实例（REQ-4 实现）作为 SyncEngine 的 `database` 依赖，确保 SyncEngine 与 WatermelonDB 解耦接口对齐。
5. [State-driven] WHILE `SyncEngineProvider` 已挂载且 SyncEngine 实例已构造完成, THE 系统 SHALL 保证 `useSyncEngine()` 在被 `DatabaseProvider` 包裹的任意子组件中返回非 null 的 `SyncEnginePort` 实例。
6. [Unwanted-behavior] IF 数据库实例为 null 或尚未初始化, THEN THE 系统 SHALL 不构造 SyncEngine（避免在无库状态下触发同步），由调用方降级处理。
7. [Ubiquitous] THE 系统 SHALL 在 App 组件树中保证 `SyncEngineProvider` 嵌套在 `DatabaseProvider` 内（即 SyncEngine 依赖 Database 实例的注入顺序）。

**优先级**：Must

**依赖**：REQ-3、REQ-4

---

### REQ-6 AuthContext 集成 fullSync（非阻塞）

**用户故事**：作为已登录用户，我希望登录成功后 App 自动在后台触发一次完整同步（拉取最新数据 + 推送本地变更），且不阻塞登录 UX、不影响我立刻看到主界面。

**验收标准**：

1. [Event-driven] WHEN `AuthContext` 的 reducer 收到 `LOGIN_SUCCESS` action, THE 系统 SHALL 触发一次 `syncEngine.fullSync()` 调用。
2. [Ubiquitous] THE 系统 SHALL 以 **fire-and-forget** 方式触发 `fullSync()`，即不 `await` 其 Promise、不阻塞 `LOGIN_SUCCESS` 后的状态转换与 UI 渲染。
3. [Unwanted-behavior] IF 触发的 `fullSync()` Promise 被 reject, THEN THE 系统 SHALL 仅通过 `console.warn` 记录（截断 ≤ `<console_warn_max_chars: 100>` 字符），不得向 UI 弹出错误提示或阻塞后续登录 UX。
4. [Ubiquitous] THE 系统 SHALL 让 AuthContext 通过 props 显式传递或通过 React Context 消费获取 `SyncEngine` 实例（不得通过模块级全局变量直接 import 单例，保持可测试性）。
5. [Event-driven] WHEN `LOGIN_SUCCESS` 后成功触发 `fullSync()`, THE 系统 SHALL 在控制台输出可识别的调试日志（如 `"SyncEngine fullSync triggered"`），便于人工/自动化验证触发行为。
6. [Unwanted-behavior] IF 在 SyncEngine 实例不可用（null）的情况下收到 `LOGIN_SUCCESS`, THEN THE 系统 SHALL 安全降级（如跳过触发并 `console.warn`），不得抛出未捕获异常导致登录流程中断。

**优先级**：Must

**依赖**：REQ-5

---

### REQ-7 Docker 构建验证

**用户故事**：作为发布工程师，我希望在 Docker 构建环境中以可重复的命令验证：watermelondb 原生模块编译通过、TypeScript 类型检查通过、Debug APK 成功产出，以便确信本 WI 的所有改动在 CI 流水线中可重现。

**验收标准**：

1. [Event-driven] WHEN 在 Docker 容器（镜像 `fj-builder:react-native-0.74` 或等效构建镜像）内执行 Android Debug 构建命令（如 `./gradlew assembleDebug` 或项目约定的构建入口）, THE 系统 SHALL 以退出码 0 完成构建，证明 watermelondb 原生模块（JSI/C++）成功编译进 APK。
2. [Event-driven] WHEN 构建成功完成, THE 系统 SHALL 在 `fj-android/android/app/build/outputs/apk/debug/` 目录下产出名为 `app-debug.apk` 的文件，且文件大小 > `<min_apk_size_bytes: 1048576>`（可配置，默认 1 MiB）。
3. [Event-driven] WHEN 对 `fj-android` 工程执行 TypeScript 类型检查（如 `npx tsc --noEmit` 或 `package.json` 中配置的 typecheck 脚本）, THE 系统 SHALL 以退出码 0 完成，无类型错误（特别是 REQ-4 的 SyncDatabaseAdapter 实现与 REQ-5 的工厂函数）。
4. [Unwanted-behavior] IF 构建过程中 watermelondb JSI 原生模块编译失败, THEN THE 系统 SHALL 在本 WI 内修复（如调整 cmake/ndk 配置、补全 proguard 规则、或在明确设计降级下临时关闭 `jsi`），不通过恢复 autolinking 屏蔽回避问题。
5. [Optional-feature] WHERE 设备/模拟器首次安装本 WI 产出的 `app-debug.apk`, THE 系统 SHALL 在启动后无 crash 地完成数据库初始化并进入 RootNavigator（依赖 REQ-2/3/5 的运行时正确性）。

**优先级**：Must

**依赖**：REQ-1、REQ-2、REQ-3、REQ-4、REQ-5、REQ-6

---

## 非目标（Out of Scope）

以下事项**不属于**本 WI 范围，如有需要应另立 WI：

1. **SQLCipher 加密回归** — TD-ANDROID-001 已决策 MVP 不加密；后续在受控设备上重新引入 SQLCipher + Android Keystore 的加密升级留给未来 WI。
2. **业务屏幕实装** — WI-0016（日报列表）/ WI-0017（日报编辑）/ WI-0018（照片上传）/ WI-0019（冲突 UI）/ WI-0020（任务详情）负责具体业务功能屏幕，本 WI 仅提供数据层。
3. **照片文件上传** — PhotoUploadQueue 与照片二进制文件上传流程属于 WI-0018，本 WI 不实现 photos 表的 file_upload_status 状态机。
4. **冲突解决 UI** — V1 仅将冲突记录置 `sync_status = 'conflict'`，UI 人工裁决留给 WI-0019。
5. **后端 API 实现** — `/api/v1/sync/pull` 与 `/api/v1/sync/push` 假定已就绪，本 WI 不修改服务端契约。
6. **增量游标重置与多账号切换** — ClientSyncStateManager.clear() 在登出时的调用语义留给后续 WI。
7. **WatermelonDB Schema 变更与数据迁移** — 当前 `SCHEMA_VERSION = 1`，首次安装无迁移问题；后续 schema 演进与 `migrations.ts` 维护不在本 WI 范围。
8. **定时后台同步 / 网络监听触发同步** — NetworkMonitor 与周期同步策略不在本 WI 范围；本 WI 仅覆盖"登录成功后触发一次 fullSync"。
9. **预加载/种子数据** — 拉取并缓存 standard_clauses 离线条款库的预加载逻辑不在本 WI 范围。
10. **单元测试与集成测试套件** — 本 WI 仅保证 TypeScript 类型检查 + Docker 构建通过；为 SyncDatabaseAdapter 与 SyncEngine 编写完整单测留给后续质量 WI（接口已为单测解耦预留）。
11. **Release APK 构建** — 本 WI 仅产出 Debug APK；Release 签名与 ProGuard 由 WI-0014 负责。
12. **SafeAreaProvider 集成回归** — safe-area-context 仍处于屏蔽状态，本 WI 不解除其屏蔽。

## 配置点清单

| 配置项 | 默认值 | 位置 | 说明 |
|--------|--------|------|------|
| `retain_blocked_modules_count` | 5 | REQ-1.2 | 解除 watermelondb 屏蔽后仍保留屏蔽的其它原生模块数量。新增屏蔽模块或恢复其中之一时需同步调整。 |
| `sync_tables_count` | 7 | REQ-2.7 / REQ-4.3 | 当前 schema.ts 中参与同步的本地表数量（daily_reports / daily_report_issues / photos / inspection_tasks / project_issues / notifications / standard_clauses）。新增同步表时需更新。 |
| `sync_port_method_count` | 4 | REQ-4.2 | SyncDatabasePort 接口的方法数（collectDirtyRecords / applyPulledChanges / applyAcceptedRecords / markConflictRecords）。接口扩展时需更新。 |
| `console_warn_max_chars` | 100 | REQ-6.3 | fullSync 失败时 console.warn 输出的最大字符数，避免泄漏完整堆栈/敏感信息。 |
| `min_apk_size_bytes` | 1048576 (1 MiB) | REQ-7.2 | 验证 app-debug.apk 非空的最小体积阈值。 |
| `jsi_enabled` | true | REQ-2.1 | WatermelonDB SQLiteAdapter 是否启用 JSI 模式；如 Docker 编译失败可经明确设计降级为 false。 |

---

## 自检（Self-Check）

| # | 自问自答 | 答案 |
|---|---------|------|
| 1 | 是否有含"等"/"包括但不限于"的未拆分需求？ | 否。所有 7 张表、4 个方法、5 个保留屏蔽模块等并列子项均已展开为独立 AC（REQ-1.2 / REQ-2.7 / REQ-4.2 / REQ-4.3）。 |
| 2 | 每条 AC 是否含可测量值或可执行命令？ | 是（`tsc --noEmit`、`./gradlew assembleDebug` 退出码、`app-debug.apk` 体积 ≥ 1 MiB、`useDatabase() !== null`、单例引用相等、console 日志可识别字符串等）。 |
| 3 | 是否避免编写设计/任务/代码内容？ | 是。未规定 React 组件实现细节、未给 TypeScript 类签名、未拆任务、未选型。仅描述"必须存在哪些文件/导出/方法签名约束"。 |
| 4 | 是否覆盖 intake 的全部 IN-SCOPE 项（8 项）？ | 是：①解除屏蔽 → REQ-1；②database.ts 简化 → REQ-2；③App.tsx DatabaseProvider → REQ-3；④SyncEnginePort 注入 → REQ-5；⑤AuthContext fullSync → REQ-6；⑥SyncDatabasePort 实现 → REQ-4；⑦Docker assembleDebug → REQ-7.1；⑧TypeScript 检查 → REQ-7.3。 |
| 5 | 是否标注了 TD-ANDROID-001 的不加密降级？ | 是，REQ-2.1 显式遵循 TD-ANDROID-001；非目标 1 隔离了 SQLCipher 回归。 |
| 6 | 是否覆盖"fire-and-forget 不阻塞登录"关键风险？ | 是，REQ-6.2 / REQ-6.3 / REQ-6.6 三条 AC 共同保证。 |
| 7 | 是否覆盖嵌套顺序 `ErrorBoundary > AuthProvider > initDatabase > DatabaseProvider > SyncEngineProvider > RootNavigator`？ | 是，REQ-3.2 显式声明，REQ-5.7 补充 SyncEngineProvider 必须在 DatabaseProvider 内。 |
| 8 | 是否声明与 WI-0013（AuthContext/ApiClient）、WI-0014（Release）、WI-0016~0020（业务屏幕）的边界？ | 是，依赖章节 + 非目标 1~12 共同隔离。 |
| 9 | 是否处理了"未初始化时调用 getDatabase()"边界？ | 是，REQ-2.6 显式要求抛错而非返回 null。 |
| 10 | 是否处理了"SyncEngine 不可用时仍触发 LOGIN_SUCCESS"边界？ | 是，REQ-6.6 显式要求安全降级不抛错。 |
| 11 | 是否声明 REQ 之间的依赖关系？ | 是，每个 REQ 末尾标注"依赖"。 |
| 12 | 是否避免读取 host-profile.json / prod-environment.md？ | 是，全程未读取技术事实源，仅基于业务行为描述。 |
