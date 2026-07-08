# Impact Analysis — WI-0015

## 代码影响
| 文件 | 操作 | 说明 |
|------|------|------|
| `react-native.config.js` | 修改 | 删除 watermelondb 屏蔽（保留其余 5 个） |
| `src/store/database.ts` | 修改 | 移除 SQLCipher + keychain 依赖（保留 KEYCHAIN_SERVICE 常量但不再使用），简化 createAdapter |
| `src/store/SyncDatabaseAdapter.ts` | 新建 | SyncDatabasePort 的 WatermelonDB 实现（~200 行） |
| `src/di/SyncEnginePort.tsx` | 修改 | 新增 createSyncEngine 工厂 + useSyncEngineInitializer hook |
| `App.tsx` | 修改 | 新增 DatabaseProvider + SyncEngineProvider 包裹层 |
| `src/store/auth/AuthContext.tsx` | 修改 | LOGIN_SUCCESS 后 fire-and-forget 触发 syncEngine.fullSync() |

## 风险
| 风险 | 缓解 |
|------|------|
| WatermelonDB JSI 编译失败 | Docker 构建验证；保留降级方案：jsi: false |
| 数据库初始化耗时 | 异步初始化，UI 显示加载态 |
| fullSync 阻塞登录 UX | fire-and-forget（不 await），失败 console.warn |
| keychain 依赖移除影响 | 保留 keychain 用于 Auth（仅移除 DB 加密用途） |
| schema 变更需迁移 | 当前 schema 是 v1，首次安装无迁移问题 |

## 依赖
- WI-0013 产物（AuthContext + ApiClient）
- 后端 `/api/v1/sync/pull` + `/api/v1/sync/push` 已就绪
- Docker 构建环境 + AUTH 授权
