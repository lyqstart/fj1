# Change Classification — WI-0015

## 变更类型
Infrastructure Activation — 激活已有骨架代码（database.ts + SyncEngine.ts + SyncEnginePort.tsx），不新增业务功能。

## 影响模块
| 模块 | 影响 |
|------|------|
| `fj-android/react-native.config.js` | 修改：删除 watermelondb 屏蔽条目 |
| `fj-android/src/store/database.ts` | 修改：移除 SQLCipher 依赖，简化为普通 SQLite，激活 initDatabase |
| `fj-android/App.tsx` | 修改：集成 DatabaseProvider |
| `fj-android/src/di/SyncEnginePort.tsx` | 修改：注入真实 SyncEngine |
| `fj-android/src/store/auth/AuthContext.tsx` | 修改：登录成功后触发 fullSync |
| `fj-android/src/store/SyncDatabaseAdapter.ts` | 新建：SyncDatabasePort 的 WatermelonDB 生产实现 |

## workflow_path 判定
requirement_change_path — 涉及多个模块的协调修改，需要完整的需求分析和设计验证。
