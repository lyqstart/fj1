# Trace Delta: WI-0028

> **Work Item**: WI-0028
> **生成 Agent**: sf-task-planner
> **依据**: requirements.candidate.md + design.candidate.md + candidates/tasks.md
> **变更路径**: requirement_change_path

---

## 追溯矩阵（REQ → AC → DD → TASK → FILE → 验证方式）

| REQ ID | AC ID | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|-------|-------|---------|---------|---------|
| REQ-1 | AC-1, AC-7 | DD-1 | TASK-1 | src/utils/Logger.ts | tsc --noEmit; grep LogLevel/logger 导出 |
| REQ-2 | AC-2 | DD-1 | TASK-1 | src/utils/Logger.ts | tsc --noEmit; grep buffer 环形逻辑 |
| REQ-3 | AC-5(部分) | DD-6 | TASK-2 | src/utils/LogPersistence.ts | tsc --noEmit; grep @fj_logs_buffer |
| REQ-4 | AC-5 | DD-5 | TASK-2 | src/utils/LogPersistence.ts | tsc --noEmit; grep maxRetries/防抖 |
| REQ-5 | AC-3 | DD-2, DD-3 | TASK-3, TASK-4 | src/components/BootErrorScreen.tsx, index.js | tsc --noEmit; grep try-catch/BootErrorScreen |
| REQ-6 | AC-4 | DD-9 | TASK-1 | src/utils/Logger.ts, src/types/globals.d.ts | tsc --noEmit; grep installGlobalErrorHandler |
| REQ-7 | AC-1(扩展) | DD-7 | TASK-5 | App.tsx, src/AppRoot.tsx | tsc --noEmit; grep logger.info('APP'/'DB') |
| REQ-8 | — | DD-7 | TASK-6 | src/store/auth/AuthContext.tsx | tsc --noEmit; grep logger AUTH（无 password/token） |
| REQ-9 | — | DD-7, DD-8 | TASK-6 | src/api/ApiClient.ts, src/utils/redact.ts | tsc --noEmit; grep REDACTED/redactAuthorization |
| REQ-10 | — | DD-7 | （未覆盖，Should） | src/api/SyncEngine.ts | 见范围外观察 |
| REQ-11 | — | DD-7 | （未覆盖，Should） | src/screens/**/*.tsx | 见范围外观察 |
| REQ-12 | AC-6 | DD-10 | TASK-7 | values/styles.xml, values-night/styles.xml | grep Light.NoActionBar; 构建验证(TASK-8) |
| NFR-4 | AC-7, AC-8 | — | TASK-8（+所有 TS task） | 全项目 | tsc --noEmit; Docker BUILD SUCCESSFUL |

---

## 文件覆盖

| 文件 | 创建/修改/删除 | 涉及 REQ | 涉及 TASK |
|------|----------------|---------|-----------|
| fj-android/src/utils/Logger.ts | 创建 | REQ-1, REQ-2, REQ-6 | TASK-1 |
| fj-android/src/types/globals.d.ts | 创建 | REQ-6 | TASK-1 |
| fj-android/src/utils/LogPersistence.ts | 创建 | REQ-3, REQ-4 | TASK-2 |
| fj-android/src/components/BootErrorScreen.tsx | 创建 | REQ-5 | TASK-3 |
| fj-android/index.js | 修改 | REQ-5, REQ-6 | TASK-4 |
| fj-android/App.tsx | 修改 | REQ-7 | TASK-5 |
| fj-android/src/AppRoot.tsx | 修改 | REQ-7 | TASK-5 |
| fj-android/src/utils/redact.ts | 创建 | REQ-9 | TASK-6 |
| fj-android/src/store/auth/AuthContext.tsx | 修改 | REQ-8 | TASK-6 |
| fj-android/src/api/ApiClient.ts | 修改 | REQ-9 | TASK-6 |
| fj-android/android/app/src/main/res/values/styles.xml | 修改 | REQ-12 | TASK-7 |
| fj-android/android/app/src/main/res/values-night/styles.xml | 创建 | REQ-12 | TASK-7 |

---

## DD 覆盖

| DD ID | 标题 | 覆盖 TASK | 状态 |
|-------|------|-----------|------|
| DD-1 | Logger 核心架构 | TASK-1 | ✅ 覆盖 |
| DD-2 | index.js 启动诊断 | TASK-4 | ✅ 覆盖 |
| DD-3 | BootErrorScreen 组件 | TASK-3 | ✅ 覆盖 |
| DD-4 | ConsoleTransport | TASK-1（内联） | ✅ 覆盖 |
| DD-5 | RemoteTransport | TASK-2 | ✅ 覆盖 |
| DD-6 | LogPersistence | TASK-2 | ✅ 覆盖 |
| DD-7 | 集成点埋点（App/DB/Auth/API/Sync/Screens） | TASK-5, TASK-6 | ⚠️ 部分（Sync/Screens 未覆盖，Should） |
| DD-8 | ApiClient Token 脱敏 | TASK-6 | ✅ 覆盖 |
| DD-9 | 全局错误处理器 | TASK-1 | ✅ 覆盖 |
| DD-10 | Android 主题修复 | TASK-7 | ✅ 覆盖 |
| DD-11 | Logger 初始化编排 | TASK-1, TASK-4 | ✅ 覆盖 |

---

## 覆盖统计

- **总 REQ 数**: 12（REQ-1 ~ REQ-12）
- **总 AC 数（系统级）**: 8（AC-1 ~ AC-8）
- **已覆盖 REQ**: 10（REQ-1~9, REQ-12）
- **未覆盖 REQ**: 2（REQ-10 同步引擎日志、REQ-11 屏幕生命周期日志）— 均为 Should 优先级，见范围外观察
- **已覆盖 AC**: 8（AC-1~AC-8 全覆盖，其中 AC-5 的持久化+上传部分由 TASK-2 覆盖）
- **无悬空 REQ**: ✅（所有 Must REQ 均有 TASK 覆盖）
- **无悬空 DD**: ✅（DD-1~6, DD-8~11 完全覆盖；DD-7 部分覆盖但 Must 部分 App/DB/Auth/API 已覆盖）
- **无悬空 TASK**: ✅（所有 TASK-1~8 均映射到 REQ/DD）

---

## 验证方式汇总

| TASK | 主验证命令 | 退出码要求 |
|------|-----------|-----------|
| TASK-1 | `cd fj-android && npx tsc --noEmit` + grep 导出 | 0 |
| TASK-2 | `cd fj-android && npx tsc --noEmit` + grep 类定义 | 0 |
| TASK-3 | `cd fj-android && npx tsc --noEmit` + grep 组件导出 | 0 |
| TASK-4 | `cd fj-android && npx tsc --noEmit` + grep installGlobalErrorHandler/try | 0 |
| TASK-5 | `cd fj-android && npx tsc --noEmit` + grep logger APP/DB | 0 |
| TASK-6 | `cd fj-android && npx tsc --noEmit` + grep REDACTED/AUTH/API | 0 |
| TASK-7 | grep Light.NoActionBar + test values-night 存在 | 0 |
| TASK-8 | `cd fj-android && npx tsc --noEmit` + Docker BUILD SUCCESSFUL + APK 存在 | 0 |

---

## 自检（V7 强制）

1. ✅ 每个 REQ 是否至少关联一个 AC？— Must REQ 全部关联；REQ-10/11（Should）暂无系统级 AC，属预期。
2. ✅ 每个 AC 是否至少关联一个 TASK？— AC-1~AC-8 均映射到 TASK。
3. ✅ 每个 DD 是否至少关联一个 TASK？— DD-1~6, DD-8~11 完全覆盖；DD-7 Must 部分覆盖。
4. ✅ 每个 TASK 是否有明确目标文件？— 8 个 task 均有 allowed_write_files。
5. ✅ 每个目标文件是否有验证方式？— 全部文件有 tsc/grep/构建验证。
6. ✅ trace_delta.md 是否真实写入？— 本文件已通过 sf_artifact_write 写入。
