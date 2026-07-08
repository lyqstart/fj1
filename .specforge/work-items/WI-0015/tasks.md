# Tasks Candidate — WI-0015: 数据库初始化 + WatermelonDB 同步引擎激活

> **Work Item**: WI-0015
> **Workflow Type**: feature_spec
> **Workflow Path**: requirement_change_path
> **Base Spec Version**: PSV-0001
> **Date**: 2026-07-05
> **标准依据**: specforge_final_fused_standard_v1_1_patch1_zh.md (§8.2 Candidate, §11 Task Contract, §12.7 Changed Files Audit, §13.3 Verification)
> **作者 Agent**: sf-task-planner
> **Candidate Path**: .specforge/work-items/WI-0015/candidates/tasks.md
> **上游输入**: requirements.candidate.md (REQ-1~7), design.candidate.md (DD-1~8)

---

## 0. Extension Registry 前置检查

- 读取 `.specforge/project/extension_registry.json`，`namespaces.task_types = []`（空）。
- 本 tasks 使用标准 `TASK-N` Markdown 格式，未引入任何新 task_type / 结构化扩展类型。
- 结论：**无需触发 Extension Subflow**，可直接产出 Candidate。

---

## 1. 概述

### 1.1 任务清单总览

| TASK | 标题 | 目标文件 | 关联 DD | 关联 REQ | 依赖 |
|------|------|----------|---------|----------|------|
| TASK-1 | 解除 watermelondb autolinking 屏蔽 | react-native.config.js | DD-1 | REQ-1 | — |
| TASK-2 | 简化 database.ts（移除 SQLCipher） | src/store/database.ts | DD-2 | REQ-2 | — |
| TASK-3 | 新建 SyncDatabaseAdapter | src/store/SyncDatabaseAdapter.ts | DD-4 | REQ-4 | — |
| TASK-4 | SyncEnginePort 增强（工厂 + Initializer） | src/di/SyncEnginePort.tsx | DD-5, DD-6 | REQ-5, REQ-6 | TASK-3 |
| TASK-5 | AuthContext 暴露 apiClient | src/store/auth/types.ts, src/store/auth/AuthContext.tsx | DD-5 | REQ-5, REQ-6 | — |
| TASK-6 | AppRoot 新建 + App.tsx 集成 | App.tsx, src/AppRoot.tsx | DD-3 | REQ-3 | TASK-2, TASK-4, TASK-5 |
| TASK-7 | Docker assembleDebug 构建验证 | (无源码改动，构建产物验证) | DD-8 | REQ-7 | TASK-1~6 |
| TASK-8 | TypeScript 类型检查 + 证据收集 | (无源码改动，类型检查) | DD-8 | REQ-7 | TASK-1~6 |

> 注：DD-7（ClientSyncStateManager 评估）= 无需修改，仅被 TASK-4 工厂实例化，不单独建 TASK。

### 1.2 依赖图与并行批次

```
Batch 1 (独立，可并行):
  TASK-1 (config.js)      TASK-2 (database.ts)      TASK-3 (SyncDatabaseAdapter.ts 新建)      TASK-5 (AuthContext)
         │ (运行时)              │                          │                                        │
         ▼                       ▼                          ▼                                        ▼
Batch 2:                          TASK-4 (SyncEnginePort: 工厂 + Initializer) ← depends TASK-3
                                          │ (运行时消费 TASK-5 的 apiClient)
                                          ▼
Batch 3:                                  TASK-6 (AppRoot + App.tsx) ← depends TASK-2,4,5
                                          │
                                          ▼
Batch 4 (验证，可并行):                    TASK-7 (Docker assembleDebug)    TASK-8 (tsc --noEmit)
```

- **并行批次**: 4 批
- **可并行 task**: Batch 1 内 4 个（TASK-1/2/3/5 互不重叠）
- **串行 task**: TASK-4 → TASK-6（链式依赖）

### 1.3 配置事实源声明

- `.specforge/config/prod-environment.md`：当前为 TODO 占位（未填充）。verification_commands 使用跨平台标准工具（grep/test/node/wc）与项目自身构建命令（./gradlew assembleDebug / npx tsc），不依赖第三方 CLI（rg/jq/fd）。
- `.specforge/config/project-rules.md`：当前为 TODO 占位。task 实现遵循 design candidate §9 的 A1-A5 架构属性（单一职责、显式依赖、可替换、失败可观测、边界明确）与相邻文件代码风格。

---

## 2. 任务详细合同

### TASK-1 解除 watermelondb autolinking 屏蔽

**context_block**（executor 必读）：
- **What**: 在 `fj-android/react-native.config.js` 的 `dependencies` 块中删除 `'@nozbe/watermelondb': { platforms: { android: null } },` 这一行，使其恢复 React Native CLI 默认 autolinking 行为。保留其余 5 个模块的屏蔽配置不变。
- **Why**: WatermelonDB 的 JSI（C++ 同步桥接）原生模块当前被屏蔽，导致 `SQLiteAdapter({ jsi: true })` 在 Debug 运行时 crash（模块未 link 进 APK）。解除屏蔽是激活 `initDatabase()`（DD-2）与同步引擎（DD-4/5）的**编译前置条件**。
- **Refs**: DD-1, REQ-1（AC1/AC2/AC3/AC4）
- **Where**:
  - read_files: [`/mnt/1t_back/project/fj1/fj-android/react-native.config.js`]
  - allowed_write_files: [`/mnt/1t_back/project/fj1/fj-android/react-native.config.js`]
  - forbidden_files: [package.json, 其余所有 .gradle/.kt/.java 文件, 其余 5 个屏蔽模块的配置行]
- **Constraints**:
  - 仅删除 watermelondb 这 1 行；不得触碰其余 5 条屏蔽（react-native-vision-camera / react-native-image-resizer / react-native-gesture-handler / react-native-safe-area-context / react-native-screens）。
  - 修改后 `dependencies` 块从 6 条减为 5 条。
  - 可选择性更新文件头注释，注明 watermelondb 已于 WI-0015 解除屏蔽。
  - 不引入新依赖；不修改 native 层 build.gradle / settings.gradle。
- **Done When**:
  - `grep -c "@nozbe/watermelondb" fj-android/react-native.config.js` 返回 `0`。
  - `grep -c "android: null" fj-android/react-native.config.js` 返回 `5`。
  - 文件仍为合法 CommonJS 模块（`node -e "require(...)"` 退出码 0）。
- **Out of Scope**: 不解除其余 5 个模块屏蔽；不修改 package.json；Docker 编译验证归 TASK-7。

- **task_id**: TASK-1
- **depends_on**: []
- **expected_file_changes**: [`fj-android/react-native.config.js`（修改：删除 1 行）]
- **verification_commands**:
  - `grep -c "@nozbe/watermelondb" fj-android/react-native.config.js`（期望 stdout `0`）
  - `grep -c "android: null" fj-android/react-native.config.js`（期望 stdout `5`）
  - `node -e "const c=require('./fj-android/react-native.config.js'); console.log(Object.keys(c.dependencies).length)"`（期望 stdout `5`）
- **verification_evidence_expected**:
  - { command: "grep -c @nozbe/watermelondb", expected_exit_code: 0, expected_output_pattern: "^0$", evidence_type: "grep_count" }
  - { command: "grep -c android: null", expected_exit_code: 0, expected_output_pattern: "^5$", evidence_type: "grep_count" }
  - { command: "node require check", expected_exit_code: 0, expected_output_pattern: "^5$", evidence_type: "node_require_check" }

---

### TASK-2 简化 database.ts（移除 SQLCipher 加密路径）

**context_block**（executor 必读）：
- **What**: 对 `fj-android/src/store/database.ts`（当前 206 行）执行删减与简化，目标 ~80 行。遵循 TD-ANDROID-001 决策（MVP 不加密普通 SQLite）。具体操作：
  1. **删除** `import { NativeModules } from 'react-native'`（不再用 native 注入密钥）。
  2. **删除** `import * as Keychain from 'react-native-keychain'`（DB 加密用途移除；Auth 仍用 Keychain 由 AuthContext 自行 import）。
  3. **删除** `FJDatabaseNativeModule` 接口定义、`FJDatabase` 实例、`DB_KEY_BYTES` 常量。
  4. **删除** `generateHexKey` 函数、`getOrCreateEncryptionKey` 函数（直接删除，不保留 no-op；全代码库无外部引用）。
  5. **简化** `createAdapter()`：移除加密相关注释/参数，仅保留 `jsi: true` + `dbName` + `schema` + `migrations`。
  6. **简化** `initDatabase()`：移除"步骤 1 取密钥"和"步骤 2 注入 native"，仅保留"创建 adapter + new Database + 缓存单例"。
  7. **保留** `DB_NAME`、`schema/migrations/MODEL_CLASSES` 导入、`MODEL_CLASSES` 数组、`databaseInstance/initializationPromise` 单例缓存、`getDatabase()`、`resetDatabaseInstance()`。
  8. **保留 + 标记 @deprecated** `DB_KEYCHAIN_SERVICE` 常量（兼容性，JSDoc 注明 TD-ANDROID-001 后不再使用）。
- **Why**: TD-ANDROID-001 已决策 MVP 降级为不加密普通 SQLite，但 database.ts 仍保留完整 SQLCipher + Keystore 加密路径 = 死代码 + 误导。激活 `initDatabase()` 必须先移除对未实现 native 模块（`FJDatabase.setEncryptionKey`）的依赖，否则运行时 crash。
- **Refs**: DD-2, REQ-2（AC1~AC7）
- **Where**:
  - read_files: [`/mnt/1t_back/project/fj1/fj-android/src/store/database.ts`, `/mnt/1t_back/project/fj1/fj-android/src/store/schema.ts`（确认 SCHEMA_VERSION / MODEL_CLASSES 引用）]
  - allowed_write_files: [`/mnt/1t_back/project/fj1/fj-android/src/store/database.ts`]
  - forbidden_files: [schema.ts, migrations.ts, requirements.md, design.md, tasks.md, 其余所有文件]
- **Constraints**:
  - 简化后 `initDatabase()` 形态（伪代码）：
    ```typescript
    export async function initDatabase(): Promise<Database> {
      if (databaseInstance) return databaseInstance;
      if (initializationPromise) return initializationPromise;
      initializationPromise = (async () => {
        const adapter = createAdapter();
        databaseInstance = new Database({ adapter, modelClasses: MODEL_CLASSES });
        return databaseInstance;
      })();
      return initializationPromise;
    }
    ```
  - `getDatabase()` 在 `databaseInstance` 为 null 时**必须抛错**（不得返回 null/undefined，REQ-2.AC6）。
  - 单例语义：多次调用 `initDatabase()` 返回同一 `Database` 实例（REQ-2.AC5）。
  - `createAdapter()` 中 `jsi: true` 保留（REQ-2.AC1）；如 Docker 编译失败由 TASK-7 决定是否降级 `jsi: false`。
  - 不删除 `DB_KEYCHAIN_SERVICE` 常量（标 @deprecated 保留，防外部引用断裂）。
  - 文件头注释更新为 TD-ANDROID-001 降级说明 + WI-0015 链接。
- **Done When**:
  - `grep -c "FJDatabaseNativeModule" src/store/database.ts` 返回 `0`。
  - `grep -c "generateHexKey" src/store/database.ts` 返回 `0`。
  - `grep -c "getOrCreateEncryptionKey" src/store/database.ts` 返回 `0`。
  - `grep -c "react-native-keychain" src/store/database.ts` 返回 `0`。
  - `grep -c "export async function initDatabase" src/store/database.ts` 返回 `≥1`。
  - `grep -c "export function getDatabase" src/store/database.ts` 返回 `≥1`。
  - `grep -c "MODEL_CLASSES" src/store/database.ts` 返回 `≥1`（保留）。
  - `wc -l src/store/database.ts` 行数 ≤ 120（目标 ~80，上限 120）。
- **Out of Scope**: 不修改 schema.ts / migrations.ts；不实现 SQLCipher native 模块；不处理旧加密 db 文件迁移（Assumption 3）；Docker 编译验证归 TASK-7；tsc 类型检查归 TASK-8。

- **task_id**: TASK-2
- **depends_on**: []
- **expected_file_changes**: [`fj-android/src/store/database.ts`（修改：206 → ~80 行）]
- **verification_commands**:
  - `grep -c "FJDatabaseNativeModule" fj-android/src/store/database.ts`（期望 `0`）
  - `grep -c "generateHexKey\|getOrCreateEncryptionKey\|react-native-keychain" fj-android/src/store/database.ts`（期望 `0`）
  - `grep -c "export async function initDatabase\|export function getDatabase\|MODEL_CLASSES" fj-android/src/store/database.ts`（期望 `≥3`，三者均在）
  - `wc -l fj-android/src/store/database.ts`（期望 ≤ 120）
- **verification_evidence_expected**:
  - { command: "grep FJDatabaseNativeModule", expected_exit_code: 0, expected_output_pattern: "^0$", evidence_type: "grep_count" }
  - { command: "grep removed-funcs", expected_exit_code: 0, expected_output_pattern: "^0$", evidence_type: "grep_count" }
  - { command: "grep retained-exports", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "wc -l", expected_exit_code: 0, evidence_type: "line_count" }

---

### TASK-3 新建 SyncDatabaseAdapter（SyncDatabasePort 生产实现）

**context_block**（executor 必读）：
- **What**: 新建 `fj-android/src/store/SyncDatabaseAdapter.ts`（~200 行），实现 `SyncDatabasePort` 接口（定义于 `src/api/SyncEngine.ts` L154-175）的 4 个方法。
  1. 定义 `TABLE_TO_MODEL` 映射表（仅 4 个已注册表：daily_reports / daily_report_issues / photos / inspection_tasks）。
  2. 实现 `collectDirtyRecords()`：查询所有 `sync_status='pending_push'` 记录，按表分组返回 `DirtyRecords`。
  3. 实现 `applyPulledChanges(changes)`：对 `op='upsert'` 执行 create/update，对 `op='delete'` 执行 markAsDeleted；写入后置 `sync_status='synced'`；返回处理记录数。
  4. 实现 `applyAcceptedRecords(accepted)`：按 `client_uuid` 找本地记录，回填 `server_id`/`server_seq`，置 `sync_status='synced'`。
  5. 实现 `markConflictRecords(conflicts)`：按 `client_uuid` 置 `sync_status='conflict'`（V1 不自动合并）。
  6. 私有辅助：`findByServerId` / `findByClientUuid` / `toDirtyRecord` / `applyFields`。
  7. 所有写操作包裹在 `database.write(async () => { ... database.batch(...) })` 原子事务内。
- **Why**: SyncEngine（已完整实现于 SyncEngine.ts）依赖 `SyncDatabasePort` 接口读写本地库，但目前无生产实现，导致 push/pull/fullSync 无法运行。本类是激活同步引擎的**核心数据层缺口**（REQ-4）。
- **Refs**: DD-4, REQ-4（AC1~AC9）
- **Where**:
  - read_files:
    - `/mnt/1t_back/project/fj1/fj-android/src/api/SyncEngine.ts`（SyncDatabasePort 接口 L154-175 + DirtyRecords/PulledChangesByTable/SYNC_STATUS 类型）
    - `/mnt/1t_back/project/fj1/fj-android/src/store/schema.ts`（表名 + MODEL_CLASSES）
    - `/mnt/1t_back/project/fj1/fj-android/src/store/models/`（DailyReportModel / DailyReportIssueModel / PhotoModel / InspectionTaskModel 的字段定义与 extract 函数）
  - allowed_write_files: [`/mnt/1t_back/project/fj1/fj-android/src/store/SyncDatabaseAdapter.ts`]
  - forbidden_files: [SyncEngine.ts, schema.ts, Model 文件, requirements.md, design.md, tasks.md, database.ts, SyncEnginePort.tsx]
- **Constraints**:
  - 必须实现**全部 4 个方法**，签名与 `SyncDatabasePort` 接口完全一致（REQ-4.AC2）。
  - `TABLE_TO_MODEL` 仅含 4 表；对其余 3 表（project_issues / notifications / standard_clauses）在 `applyPulledChanges` 内 `console.warn` 跳过（不抛错，REQ-4 / DD-4 范围声明）。
  - 4 个同步元数据字段（`server_id` / `sync_status` / `server_seq` / `client_uuid`）与 WatermelonDB 隐式字段（`id` / `created_at` / `updated_at` / `_status` / `_changed`）严格区分（REQ-4.AC8）。
  - 字段提取复用各 Model 的 `extractXxxBusinessFields`（如 DailyReportModel 已有）；其余表在 adapter 内联提取函数（每表 ~10 行）。
  - Date 字段需 `.getTime()` ↔ `new Date()` 转换（@date decorator 要求 Date 实例）。
  - `findByServerId/findByClientUuid` 返回 null 时跳过该条（不抛错，避免单条脏数据中断整批）。
  - 不得使用 `any` 绕过接口（REQ-4.AC9，tsc 检查归 TASK-8）。
  - 不处理物理删除同步（`_status=deleted`），业务删除走软删（Assumption 4）。
- **Done When**:
  - 文件存在：`test -f fj-android/src/store/SyncDatabaseAdapter.ts`。
  - `grep -c "class SyncDatabaseAdapter implements SyncDatabasePort" src/store/SyncDatabaseAdapter.ts` 返回 `≥1`。
  - 4 方法均在：`grep -c "collectDirtyRecords\|applyPulledChanges\|applyAcceptedRecords\|markConflictRecords" src/store/SyncDatabaseAdapter.ts` 返回 `≥4`。
  - `grep -c "daily_reports\|daily_report_issues\|photos\|inspection_tasks" src/store/SyncDatabaseAdapter.ts` 返回 `≥4`（4 表映射）。
  - `grep -c "database.write" src/store/SyncDatabaseAdapter.ts` 返回 `≥3`（3 个写方法各一事务）。
- **Out of Scope**: 不注册 project_issues / notifications / standard_clauses 三表 Model（后续 WI）；不修改 SyncEngine.ts 接口；不写单元测试（质量 WI）；tsc 归 TASK-8。

- **task_id**: TASK-3
- **depends_on**: []
- **expected_file_changes**: [`fj-android/src/store/SyncDatabaseAdapter.ts`（新建：0 → ~200 行）]
- **verification_commands**:
  - `test -f fj-android/src/store/SyncDatabaseAdapter.ts && echo OK`（期望 stdout `OK`）
  - `grep -c "class SyncDatabaseAdapter implements SyncDatabasePort" fj-android/src/store/SyncDatabaseAdapter.ts`（期望 `≥1`）
  - `grep -cE "collectDirtyRecords|applyPulledChanges|applyAcceptedRecords|markConflictRecords" fj-android/src/store/SyncDatabaseAdapter.ts`（期望 `≥4`）
  - `grep -cE "daily_reports|daily_report_issues|photos|inspection_tasks" fj-android/src/store/SyncDatabaseAdapter.ts`（期望 `≥4`）
  - `grep -c "database.write" fj-android/src/store/SyncDatabaseAdapter.ts`（期望 `≥3`）
- **verification_evidence_expected**:
  - { command: "test -f", expected_exit_code: 0, expected_output_pattern: "OK", evidence_type: "file_existence" }
  - { command: "grep class implements", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep 4 methods", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep 4 tables", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep database.write", expected_exit_code: 0, evidence_type: "grep_count" }

---

### TASK-4 SyncEnginePort 增强（createSyncEngine 工厂 + SyncEngineInitializer 组件）

**context_block**（executor 必读）：
- **What**: 修改 `fj-android/src/di/SyncEnginePort.tsx`（当前 70 行 → ~140 行），追加两部分：
  1. **`createSyncEngine` 工厂函数**（纯函数，便于测试）：
     ```typescript
     export function createSyncEngine(deps: {
       apiClient: ApiClient;
       database: Database;
       projectId?: string;
       storage?: KeyValueStorage;
     }): SyncEngine {
       const storage = deps.storage ?? AsyncStorage;
       const syncStateMgr = new ClientSyncStateManager(storage, deps.projectId);
       const dbAdapter = new SyncDatabaseAdapter(deps.database);
       return new SyncEngine(deps.apiClient, syncStateMgr, dbAdapter, { projectId: deps.projectId });
     }
     ```
  2. **`SyncEngineInitializer` React 组件**（消费 useAuth + useDatabase，构造 engine 并注入 SyncEngineProvider）：
     - `useMemo` 稳定 engine 引用（依赖 database / apiClient / projectId）。
     - `useEffect` 监听 `state.status === 'authenticated'`：fire-and-forget 触发 `engine.fullSync()`，失败仅 `console.warn`（截断 ≤100 字符），不 await 不阻塞（DD-6 / REQ-6）。
     - database 或 apiClient 为 null 时 useMemo 返回 null（REQ-5.AC6 降级）。
- **Why**: SyncEnginePort 当前仅有 Provider/hook 骨架，`useSyncEngine()` 始终返回 null。本 TASK 提供工厂 + 初始化组件，是 REQ-5（注入真实 SyncEngine）与 REQ-6（登录后 fire-and-forget fullSync）的落地点。
- **Refs**: DD-5（5.2 + 5.3）, DD-6, REQ-5（AC1~AC7）, REQ-6（AC1~AC6）
- **Where**:
  - read_files:
    - `/mnt/1t_back/project/fj1/fj-android/src/di/SyncEnginePort.tsx`（现有 Provider/hook）
    - `/mnt/1t_back/project/fj1/fj-android/src/api/SyncEngine.ts`（SyncEngine 构造函数签名）
    - `/mnt/1t_back/project/fj1/fj-android/src/api/ClientSyncStateManager.ts`（构造函数 + KeyValueStorage 接口）
    - `/mnt/1t_back/project/fj1/fj-android/src/store/SyncDatabaseAdapter.ts`（TASK-3 产物）
    - `/mnt/1t_back/project/fj1/fj-android/src/store/auth/AuthContext.tsx`（useAuth + AuthContextValue，TASK-5 加 apiClient）
  - allowed_write_files: [`/mnt/1t_back/project/fj1/fj-android/src/di/SyncEnginePort.tsx`]
  - forbidden_files: [AuthContext.tsx, types.ts, SyncEngine.ts, ClientSyncStateManager.ts, SyncDatabaseAdapter.ts, App.tsx, requirements.md, design.md, tasks.md]
- **Constraints**:
  - `createSyncEngine` 与 `SyncEngineInitializer` 都**导出**（`export function`）。
  - `SyncEngineInitializer` 必须同时位于 DatabaseProvider 与 AuthProvider 之内（由 TASK-6 的 AppRoot 保证嵌套顺序）。
  - `useMemo` 依赖数组 `[database, apiClient, projectId]`，避免每次 render 重建 SyncEngine。
  - fullSync 的 useEffect 依赖数组 `[engine, state.status]`；React 18 StrictMode 双触发由 fullSync 内部 `withSyncLock` 保证幂等（Assumption 7）。
  - fullSync 成功/失败均打可识别日志（REQ-6.AC5：含 `"SyncEngine"` 字样）。
  - 不得通过模块级全局变量 import 单例 SyncEngine（REQ-6.AC4，保持可测试性）。
  - import AsyncStorage：`import AsyncStorage from '@react-native-async-storage/async-storage'`（Assumption 1 假设已安装；若未装由 TASK-7 暴露）。
  - 不修改现有 SyncEngineProvider / useSyncEngine / SyncEngineContext 定义（追加而非重写）。
- **Done When**:
  - `grep -c "export function createSyncEngine" src/di/SyncEnginePort.tsx` 返回 `≥1`。
  - `grep -c "export function SyncEngineInitializer" src/di/SyncEnginePort.tsx` 返回 `≥1`。
  - `grep -c "SyncDatabaseAdapter" src/di/SyncEnginePort.tsx` 返回 `≥1`（工厂内实例化）。
  - `grep -c "ClientSyncStateManager" src/di/SyncEnginePort.tsx` 返回 `≥1`。
  - `grep -c "fullSync" src/di/SyncEnginePort.tsx` 返回 `≥1`（useEffect 内触发）。
  - `grep -c "SyncEngineProvider" src/di/SyncEnginePort.tsx` 返回 `≥2`（既有定义 + Initializer 内使用）。
  - 现有 `useSyncEngine` / `SyncEngineContext` 导出仍在（`grep -c "export function useSyncEngine"` ≥1）。
- **Out of Scope**: 不修改 AuthContext（TASK-5 负责）；不修改 App.tsx 嵌套（TASK-6 负责）；不修改 SyncEngine/ClientSyncStateManager 内部；不写单测；tsc 归 TASK-8。

- **task_id**: TASK-4
- **depends_on**: [TASK-3]
- **expected_file_changes**: [`fj-android/src/di/SyncEnginePort.tsx`（修改：70 → ~140 行）]
- **verification_commands**:
  - `grep -c "export function createSyncEngine" fj-android/src/di/SyncEnginePort.tsx`（期望 `≥1`）
  - `grep -c "export function SyncEngineInitializer" fj-android/src/di/SyncEnginePort.tsx`（期望 `≥1`）
  - `grep -cE "SyncDatabaseAdapter|ClientSyncStateManager|fullSync" fj-android/src/di/SyncEnginePort.tsx`（期望 `≥3`）
  - `grep -c "export function useSyncEngine" fj-android/src/di/SyncEnginePort.tsx`（期望 `≥1`，现有导出保留）
- **verification_evidence_expected**:
  - { command: "grep createSyncEngine", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep SyncEngineInitializer", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep deps", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep useSyncEngine retained", expected_exit_code: 0, evidence_type: "grep_count" }

---

### TASK-5 AuthContext 暴露 apiClient（AuthContextValue 扩展）

**context_block**（executor 必读）：
- **What**: 修改两个文件，让 AuthContext 通过 Context 暴露 `apiClient` 实例（供 TASK-4 的 SyncEngineInitializer 消费）：
  1. **`src/store/auth/types.ts`**：在 `AuthContextValue` 接口新增 `apiClient: ApiClient` 字段。
     ```typescript
     interface AuthContextValue {
       state: AuthState;
       login: (username: string, password: string) => Promise<void>;
       logout: () => Promise<void>;
       clearError: () => void;
       apiClient: ApiClient;  // ← NEW
     }
     ```
  2. **`src/store/auth/AuthContext.tsx`**：在 `AuthProvider` 的 `useMemo` value 对象中加入 `apiClient`，并加入依赖数组。
     - apiClient 已在 AuthContext 内部 L97-104 由 useMemo 稳定引用，加入 value 不破坏渲染性能。
- **Why**: SyncEngineInitializer（TASK-4）需要 ApiClient 实例构造 SyncEngine。ApiClient 在 AuthProvider 内构造（含 token 刷新逻辑，WI-0013），通过 Context 暴露是最低成本传递方式（避免再造 ApiClientProvider，DD-5 否决该方案）。
- **Refs**: DD-5（5.1）, REQ-5（AC1/AC4）, REQ-6（AC4）
- **Where**:
  - read_files:
    - `/mnt/1t_back/project/fj1/fj-android/src/store/auth/types.ts`（AuthContextValue 定义）
    - `/mnt/1t_back/project/fj1/fj-android/src/store/auth/AuthContext.tsx`（AuthProvider useMemo value，L97-104 apiClient 构造）
    - `/mnt/1t_back/project/fj1/fj-android/src/api/ApiClient.ts`（ApiClient 类型，仅 import type）
  - allowed_write_files: [`/mnt/1t_back/project/fj1/fj-android/src/store/auth/types.ts`, `/mnt/1t_back/project/fj1/fj-android/src/store/auth/AuthContext.tsx`]
  - forbidden_files: [ApiClient.ts, SyncEnginePort.tsx, App.tsx, requirements.md, design.md, tasks.md]
- **Constraints**:
  - `apiClient` 字段类型为 `ApiClient`（非 `ApiClient | null`，因 AuthProvider 内 useMemo 保证非 null）。
  - useMemo value 依赖数组须包含 `apiClient`（避免 stale closure）。
  - 不改变现有 `state` / `login` / `logout` / `clearError` 字段与签名。
  - 不在 AuthContext 内触发 fullSync（DD-6 决策：fullSync 放 SyncEngineInitializer，避免 AuthContext 反向依赖 SyncEngine）。
  - 不新增 ApiClientProvider（DD-5 否决，YAGNI）。
- **Done When**:
  - `grep -c "apiClient" src/store/auth/types.ts` 返回 `≥1`（AuthContextValue 新增字段）。
  - `grep -c "apiClient" src/store/auth/AuthContext.tsx` 返回 `≥2`（value 对象 + 依赖数组）。
  - 现有字段保留：`grep -cE "login|logout|clearError" src/store/auth/types.ts` 返回 `≥3`。
- **Out of Scope**: 不修改 ApiClient 内部；不在 AuthContext 触发 fullSync（TASK-4 负责）；不修改 login/logout 实现；tsc 归 TASK-8。

- **task_id**: TASK-5
- **depends_on**: []
- **expected_file_changes**: [`fj-android/src/store/auth/types.ts`（修改：+1 字段）, `fj-android/src/store/auth/AuthContext.tsx`（修改：+2 行）]
- **verification_commands**:
  - `grep -c "apiClient" fj-android/src/store/auth/types.ts`（期望 `≥1`）
  - `grep -c "apiClient" fj-android/src/store/auth/AuthContext.tsx`（期望 `≥2`）
  - `grep -cE "login|logout|clearError" fj-android/src/store/auth/types.ts`（期望 `≥3`，现有字段保留）
- **verification_evidence_expected**:
  - { command: "grep apiClient in types", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep apiClient in AuthContext", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep existing fields", expected_exit_code: 0, evidence_type: "grep_count" }

---

### TASK-6 AppRoot 新建 + App.tsx 集成（四层包裹架构）

**context_block**（executor 必读）：
- **What**: 实现四层包裹架构 `ErrorBoundary > AuthProvider > AppRoot > DatabaseProvider > SyncEngineInitializer > RootNavigator`，涉及两文件：
  1. **新建 `src/AppRoot.tsx`**（~60 行）：
     - `useState<{ status: 'loading'|'error'|'ready'; db: Database|null; error: Error|null }>` 管理初始化状态。
     - `useEffect(() => { initDatabase().then(db => setStatus ready).catch(setError) }, [])` 触发一次性异步初始化。
     - `loading` 态：渲染 `<View><Text>初始化数据库...</Text></View>`（无第三方 UI 组件依赖）。
     - `error` 态：渲染错误文案 + "重试"按钮（重试 = 重置 state 后再调 initDatabase）。
     - `ready` 态：渲染 `<DatabaseProvider database={db}><SyncEngineInitializer><RootNavigator /></SyncEngineInitializer></DatabaseProvider>`。
  2. **修改 `App.tsx`**（26 → ~15 行）：改为 `ErrorBoundary > AuthProvider > AppRoot`。
     ```tsx
     import ErrorBoundary from './src/components/ErrorBoundary';
     import { AuthProvider } from './src/store/auth/AuthContext';
     import AppRoot from './src/AppRoot';
     export default function App(): React.ReactElement {
       return (
         <ErrorBoundary>
           <AuthProvider>
             <AppRoot />
           </AuthProvider>
         </ErrorBoundary>
       );
     }
     ```
- **Why**: 数据库初始化是异步耗时操作，必须在渲染业务 UI 前完成（intake 关键风险 2）。AppRoot 单独成文件管理 DB 生命周期（A1 单一职责），DatabaseProvider 必须在 SyncEngineInitializer（消费 useDatabase）之上。嵌套顺序由 REQ-3.AC2 强制。
- **Refs**: DD-3, REQ-3（AC1~AC6）
- **Where**:
  - read_files:
    - `/mnt/1t_back/project/fj1/fj-android/App.tsx`（现有三层）
    - `/mnt/1t_back/project/fj1/fj-android/src/store/database.ts`（TASK-2 简化后的 initDatabase/getDatabase）
    - `/mnt/1t_back/project/fj1/fj-android/src/di/SyncEnginePort.tsx`（TASK-4 的 SyncEngineInitializer）
    - `/mnt/1t_back/project/fj1/fj-android/src/navigation/RootNavigator.tsx`（现有导航）
    - `/mnt/1t_back/project/fj1/fj-android/src/components/ErrorBoundary.tsx`（现有）
  - allowed_write_files: [`/mnt/1t_back/project/fj1/fj-android/App.tsx`, `/mnt/1t_back/project/fj1/fj-android/src/AppRoot.tsx`]
  - forbidden_files: [database.ts, SyncEnginePort.tsx, AuthContext.tsx, RootNavigator.tsx, requirements.md, design.md, tasks.md]
- **Constraints**:
  - DatabaseProvider 来源：`import { DatabaseProvider } from '@nozbe/watermelondb/react'`（官方组件）。
  - App.tsx 只管组合根（ErrorBoundary > AuthProvider > AppRoot），不内联 initDatabase 逻辑（A1）。
  - 必须用 `useEffect + useState` 管理 loading/error，不得模块顶层 `await`（REQ-3.AC6，避免阻塞 JS bundle 解析）。
  - loading 态不得引入新第三方 UI 组件库（REQ-3.AC3），用最简 `<View><Text>`。
  - error 态必须提供"重试"按钮（REQ-3.AC4），重试不冒泡到 ErrorBoundary。
  - SyncEngineInitializer 必须嵌套在 DatabaseProvider 内（REQ-3.AC2 / REQ-5.AC7）。
  - AppRoot 内 initDatabase reject 由 error 分支捕获，不冒泡（DD-3 失败处理）。
- **Done When**:
  - `test -f fj-android/src/AppRoot.tsx && echo OK`。
  - `grep -c "import AppRoot" fj-android/App.tsx` 返回 `≥1`。
  - `grep -c "DatabaseProvider" fj-android/src/AppRoot.tsx` 返回 `≥1`。
  - `grep -c "SyncEngineInitializer" fj-android/src/AppRoot.tsx` 返回 `≥1`。
  - `grep -c "initDatabase" fj-android/src/AppRoot.tsx` 返回 `≥1`。
  - `grep -c "ErrorBoundary" fj-android/App.tsx` 返回 `≥1`（外层保留）。
  - `grep -c "AuthProvider" fj-android/App.tsx` 返回 `≥1`（第二层保留）。
  - App.tsx 中 RootNavigator 不再直接出现于 App（已移入 AppRoot）：`grep -c "RootNavigator" fj-android/App.tsx` 返回 `0`。
- **Out of Scope**: 不修改 initDatabase 内部（TASK-2）；不修改 SyncEngineInitializer（TASK-4）；不修改 RootNavigator；不集成 SafeAreaProvider（Out of Scope 7）；tsc 归 TASK-8；Docker 构建归 TASK-7。

- **task_id**: TASK-6
- **depends_on**: [TASK-2, TASK-4, TASK-5]
- **expected_file_changes**: [`fj-android/App.tsx`（修改：26 → ~15 行）, `fj-android/src/AppRoot.tsx`（新建：0 → ~60 行）]
- **verification_commands**:
  - `test -f fj-android/src/AppRoot.tsx && echo OK`（期望 stdout `OK`）
  - `grep -c "import AppRoot" fj-android/App.tsx`（期望 `≥1`）
  - `grep -cE "DatabaseProvider|SyncEngineInitializer|initDatabase" fj-android/src/AppRoot.tsx`（期望 `≥3`）
  - `grep -c "RootNavigator" fj-android/App.tsx`（期望 `0`，已移入 AppRoot）
  - `grep -cE "ErrorBoundary|AuthProvider" fj-android/App.tsx`（期望 `≥2`，外两层保留）
- **verification_evidence_expected**:
  - { command: "test -f AppRoot", expected_exit_code: 0, expected_output_pattern: "OK", evidence_type: "file_existence" }
  - { command: "grep import AppRoot", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep AppRoot internals", expected_exit_code: 0, evidence_type: "grep_count" }
  - { command: "grep RootNavigator absent in App", expected_exit_code: 0, expected_output_pattern: "^0$", evidence_type: "grep_count" }
  - { command: "grep outer layers", expected_exit_code: 0, evidence_type: "grep_count" }

---

### TASK-7 Docker assembleDebug 构建验证（watermelondb 原生模块编译）

**context_block**（executor 必读）：
- **What**: 在 Docker 构建环境（镜像 `fj-builder:react-native-0.74`）内执行 Android Debug 构建 `./gradlew assembleDebug`，验证：
  1. watermelondb 原生模块（JSI/C++）成功编译进 APK（构建日志含 `@nozbe/watermelondb` 相关 Java/Kotlin/C++ 编译痕迹，退出码 0）。
  2. 产出 `app-debug.apk`，文件大小 > 1 MiB（`min_apk_size_bytes=1048576`）。
  3. APK 内含 `libwatermelondb-jsi.so`（lib/arm64-v8a/ 下，可选验证）。
  - 本 TASK **不改源码**，仅构建验证。如构建失败需修复，回退到对应 TASK（TASK-1/2）或评估 `jsi:false` 降级（DD-8 失败分支）。
- **Why**: 解除 autolinking 屏蔽后，必须以真实编译验证 JSI C++ 模块能 link 进 APK（intake 关键风险 1）。TS 类型检查（TASK-8）无法发现原生编译问题，构建是"硬门"。
- **Refs**: DD-8, REQ-7（AC1/AC2/AC4）, REQ-1（AC3/AC4 运行时验证）
- **Where**:
  - read_files: [所有 TASK-1~6 产出的源文件（只读，确认改动就位）]
  - allowed_write_files: []（本 TASK 不修改源码；构建产物 app-debug.apk 在 build/ 目录，属构建输出非源码改动）
  - forbidden_files: [所有源码文件，.specforge/ 下所有文件]
- **Constraints**（⚠️ Docker 构建关键注意事项）:
  - **必须用分离模式**：`docker run -d`（后台运行）+ 日志轮询（`docker logs -f <cid>` 或定期 `docker logs --tail`），不得用 `docker run` 前台阻塞（构建耗时长，易超时）。
  - **挂载优先用 `--mount type=bind`**：避免 `-v host:container` 中的 `:` 被 Write Guard 误判为危险模式。示例：`--mount type=bind,source=/mnt/1t_back/project/fj1/fj-android,target=/workspace`。
  - **Gradle 缓存隔离**：加 `--mount type=bind,source=/mnt/1t_back/project/fj1/.gradle-home,target=/root/.gradle` 或 `--project-cache-dir=/tmp/gradle-project-cache` 避免 stale lock。
  - **镜像**：`fj-builder:react-native-0.74`（项目约定）。
  - **构建命令**：`cd /workspace && cd android && ./gradlew assembleDebug`（或项目约定的构建入口）。
  - **Write Guard 授权**：WI-0014 已安装 `write_guard_authorization AUTH-1783234226677`（scope=work_item），但 **WI-0014 已关闭，授权可能已失效**。若 Docker 命令触发 hard_stop，需通过 `sf_hard_stop_resolve` 重新安装 work_item 级授权（authorization_command_family=`docker_run`，authorization_image=`fj-builder:react-native-0.74`，authorization_container_targets=`[/workspace]`，authorization_expires_when=`work_item_closed`），并附用户确认原话。
  - **构建模板**：参考 WI-0013 的 Docker 构建命令模板（分离模式 + 日志轮询）。
  - **失败处理分支**（DD-8）：
    - C++ 编译失败 → 检查 NDK/CMake；若 JSI 路径失败 → 降级 TASK-2 的 `createAdapter` 为 `jsi: false`（性能损失但可运行），并在本 WI 内记录降级决策。
    - autolinking 未生效 → 运行 `npx react-native config` 确认 watermelondb 在 dependencies 列表（回查 TASK-1）。
    - AsyncStorage 原生缺失 → 检查 package.json 是否已装 `@react-native-async-storage/async-storage`，未装则补装 + autolinking。
  - **不通过恢复屏蔽回避**：REQ-1.AC4 / REQ-7.AC4 明确禁止通过恢复 autolinking 屏蔽来回避编译错误。
- **Done When**:
  - 构建命令退出码 `0`（构建成功）。
  - `app-debug.apk` 存在：`test -f fj-android/android/app/build/outputs/apk/debug/app-debug.apk`。
  - APK 大小 > 1 MiB：`stat -c %s <apk>` > 1048576。
  - 构建日志含 watermelondb 编译痕迹（grep `watermelondb` 在构建日志中 ≥1 次）。
- **Out of Scope**: 不做 Release 构建（DD-8 仅 Debug）；不做 E2E 运行时验证（REQ-7.AC5 可选，留给 WI-0016）；不修改源码（如需修复回退对应 TASK）；tsc 归 TASK-8。

- **task_id**: TASK-7
- **depends_on**: [TASK-1, TASK-2, TASK-3, TASK-4, TASK-5, TASK-6]
- **expected_file_changes**: []（构建产物 app-debug.apk 非源码）
- **verification_commands**:
  - `docker run -d --mount type=bind,... fj-builder:react-native-0.74 sh -c "cd /workspace/android && ./gradlew assembleDebug"` + 日志轮询（期望退出码 `0`）
  - `test -f fj-android/android/app/build/outputs/apk/debug/app-debug.apk && echo OK`（期望 stdout `OK`）
  - `stat -c %s fj-android/android/app/build/outputs/apk/debug/app-debug.apk`（期望 > 1048576）
  - 构建日志 `grep -c "watermelondb" <build_log>`（期望 `≥1`）
- **verification_evidence_expected**:
  - { command: "docker assembleDebug", expected_exit_code: 0, evidence_type: "build_log" }
  - { command: "test -f app-debug.apk", expected_exit_code: 0, expected_output_pattern: "OK", evidence_type: "file_existence" }
  - { command: "stat apk size", expected_exit_code: 0, evidence_type: "file_size" }
  - { command: "grep watermelondb in build log", expected_exit_code: 0, evidence_type: "build_log_grep" }

---

### TASK-8 TypeScript 类型检查 + 验证证据收集

**context_block**（executor 必读）：
- **What**: 在 Docker 容器（镜像 `fj-builder:react-native-0.74`）内对 `fj-android` 工程执行 TypeScript 类型检查 `npx tsc --noEmit`（或 package.json 中配置的 typecheck 脚本），验证：
  1. TASK-3 的 `SyncDatabaseAdapter.ts` 与 `SyncDatabasePort` 接口类型一致、无 `any` 绕过（REQ-4.AC9）。
  2. TASK-4 的 `createSyncEngine` / `SyncEngineInitializer` 类型正确（REQ-5）。
  3. TASK-5 的 `AuthContextValue.apiClient` 字段类型对齐（REQ-5）。
  4. TASK-6 的 AppRoot/App.tsx 组件树类型正确（REQ-3）。
  5. 收集构建日志和 tsc 输出作为 verification evidence。
  - 本 TASK **不写源码**，仅类型检查 + 证据收集。verification_report 和 evidence_manifest 的正式写入由 Orchestrator 通过 sf-verifier 完成。
- **Why**: tsc 是类型期的"软门"，与 TASK-7 的编译期"硬门"互补，覆盖接口对齐、泛型、null 安全等编译器可检错误（DD-8）。
- **Refs**: DD-8, REQ-7（AC3）, REQ-4（AC9）
- **Where**:
  - read_files: [所有 TASK-1~6 产出的源文件（只读）]
  - allowed_write_files: []（本 TASK 不修改源码；evidence 收集产物由 Orchestrator/sf-verifier 写入 governance 路径）
  - forbidden_files: [所有源码文件，.specforge/work-items/ 下所有文件（governance 产物由 sf-verifier 写）]
- **Constraints**:
  - **Docker 执行**：与 TASK-7 相同的 Docker 约束（分离模式 / `--mount type=bind` / 镜像 `fj-builder:react-native-0.74` / Write Guard 授权注意）。
  - tsc 命令：`cd /workspace && npx tsc --noEmit`（或 `npm run typecheck` 若 package.json 已配置）。
  - 退出码必须为 `0`（无类型错误）。
  - 若 tsc 报错：不得用 `any` / `@ts-ignore` / `as unknown as` 绕过（REQ-4.AC9）；回退到对应 TASK 修复类型。
  - 证据收集：tsc stdout/stderr 完整日志 + 退出码，供 sf-verifier 写入 evidence_manifest。
  - 可与 TASK-7 复用同一 Docker 容器（先 tsc 后 assembleDebug，或分开）。
- **Done When**:
  - `npx tsc --noEmit` 退出码 `0`。
  - tsc 输出无 error 行（`grep -c "error TS" <tsc_log>` 返回 `0`）。
  - 证据日志已收集（tsc 完整输出保存）。
- **Out of Scope**: 不修改源码（回退对应 TASK）；不写 governance 产物（sf-verifier 负责）；不做 Release 构建；不做单测（质量 WI）。

- **task_id**: TASK-8
- **depends_on**: [TASK-1, TASK-2, TASK-3, TASK-4, TASK-5, TASK-6]
- **expected_file_changes**: []
- **verification_commands**:
  - Docker 内 `cd /workspace && npx tsc --noEmit`（期望退出码 `0`）
  - `grep -c "error TS" <tsc_log>`（期望 `0`）
- **verification_evidence_expected**:
  - { command: "npx tsc --noEmit", expected_exit_code: 0, expected_output_pattern: "no error", evidence_type: "tsc_output" }
  - { command: "grep error TS", expected_exit_code: 0, expected_output_pattern: "^0$", evidence_type: "tsc_log_grep" }

---

## 3. 自检（Self-Check）

| # | 自问自答 | 答案 |
|---|---------|------|
| 1 | 每个 DD 都有对应的 task 覆盖吗？ | ✅ DD-1→TASK-1; DD-2→TASK-2; DD-3→TASK-6; DD-4→TASK-3; DD-5→TASK-4+5; DD-6→TASK-4; DD-7→无需 task（不改代码）; DD-8→TASK-7+8 |
| 2 | 每个 REQ 都有 task 覆盖吗？ | ✅ REQ-1→TASK-1; REQ-2→TASK-2; REQ-3→TASK-6; REQ-4→TASK-3; REQ-5→TASK-4+5; REQ-6→TASK-4; REQ-7→TASK-7+8 |
| 3 | 每个 task 的 context_block 是否充分（executor 不需回查 design.md）？ | ✅ 每个 task 含 What/Why/Refs/Where(read+allowed_write+forbidden)/Constraints/Done When/Out of Scope |
| 4 | verification_commands 是否真能机器跑（返回退出码）？ | ✅ 全部用 grep/test/node/wc/docker/gradlew/tsc，均可返回 0/非0 |
| 5 | 并行批次内的 task 是否互相独立（文件不重叠）？ | ✅ Batch1: TASK-1(config.js)/TASK-2(database.ts)/TASK-3(SyncDatabaseAdapter.ts 新建)/TASK-5(types.ts+AuthContext.tsx) 文件互不重叠 |
| 6 | 有没有共享代码需要先建独立 task？ | ✅ SyncDatabaseAdapter（TASK-3 新建）被 TASK-4 工厂依赖，TASK-4 depends_on TASK-3 |
| 7 | allowed_write_files 是否具体（无通配符/目录）？ | ✅ 全部为具体文件绝对路径 |
| 8 | 并行 task 的 allowed_write_files 是否不重叠？ | ✅ Batch1 四个 task 写文件集合互不相交 |
| 9 | forbidden_files 是否包含 requirements/design/tasks？ | ✅ 每个 task 的 forbidden_files 显式排除规格文档与其他 task 的写文件 |
| 10 | done_when 每条是否可通过 verification_commands 验证？ | ✅ 每条 done_when 对应至少一条 grep/test 命令 |
| 11 | Docker TASK 是否标注分离模式/挂载/授权约束？ | ✅ TASK-7/8 的 Constraints 含 docker run -d / --mount type=bind / AUTH 授权失效 / project-cache-dir |
| 12 | 是否避免 T6 大小超限（单 task >200 行）？ | ✅ TASK-3 最大 ~200 行（边界）；其余均 <200 行 |

---

## 4. 完成报告

```json
{
  "status": "success",
  "files_changed": [
    ".specforge/work-items/WI-0015/candidates/tasks.md",
    ".specforge/work-items/WI-0015/trace_delta.md"
  ],
  "structure": {
    "tasks_count": 8,
    "parallel_batches": 4,
    "batch1_independent": ["TASK-1", "TASK-2", "TASK-3", "TASK-5"],
    "batch2": ["TASK-4"],
    "batch3": ["TASK-6"],
    "batch4_verification": ["TASK-7", "TASK-8"],
    "all_tasks_have_context_block": true,
    "all_tasks_have_verification": true
  },
  "trace_delta": {
    "generated": true,
    "requirements_covered": true,
    "design_decisions_covered": true,
    "tasks_covered": true,
    "files_covered": true
  },
  "self_check": { "passed": [1,2,3,4,5,6,7,8,9,10,11,12], "failed": [] },
  "out_of_scope_observations": [
    "DD-7 ClientSyncStateManager 评估为'无需修改'，不单独建 task（仅被 TASK-4 工厂实例化）",
    "project_issues / notifications / standard_clauses 三表 Model 注册留给后续 WI（WI-0017+）"
  ]
}
```

---

**文档结束**。本 Candidate 待 Gate（required_files / schema / trace / spec_consistency / candidate_manifest）通过 + User Decision 后，由 Merge Runner 写入正式 tasks 真相源。
