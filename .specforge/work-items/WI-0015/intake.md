# Intake — WI-0015

## Work Item: WI-0015
## Title: 数据库初始化 + WatermelonDB 同步引擎激活
## Date: 2026-07-05
## Workflow: feature_spec / requirement_change_path

## 核心目标

激活飞检安卓端的本地数据库（WatermelonDB）和与服务端的增量同步引擎（SyncEngine），为后续业务屏幕（WI-0016~0020）提供数据层基础。

## 范围

### IN-SCOPE
1. 解除 `@nozbe/watermelondb` 在 `react-native.config.js` 的 autolinking 屏蔽
2. 修改 `database.ts`：根据 TD-ANDROID-001 决策降级为不加密（普通 SQLite），移除 SQLCipher 依赖，激活 `initDatabase()` 函数
3. 修改 `App.tsx`：在 AuthProvider 内初始化 DatabaseProvider（WatermelonDB 官方 Provider）
4. 修改 `SyncEnginePort.tsx`：注入真实 SyncEngine 实例（基于 ApiClient + Database）
5. AuthContext 集成：登录成功后触发首次 `fullSync()`（非阻塞）
6. 实现 `SyncDatabasePort` 的 WatermelonDB 生产实现（基于 database.collections）
7. Docker 容器内执行 `assembleDebug` 构建验证 watermelondb 原生模块编译通过
8. TypeScript 类型检查通过

### OUT-OF-SCOPE
- SQLCipher 加密（TD-ANDROID-001 降级，留给未来迭代）
- 业务屏幕实装（WI-0016~0020 负责）
- 照片上传（WI-0018 负责）
- 冲突解决 UI（WI-0019 负责）

## 技术约束
- WatermelonDB 0.27+（已安装，需解除屏蔽）
- 构建：Docker `fj-builder:react-native-0.74`
- JSI 模式：保留 `jsi: true`（性能优势）
- 后端 API 已就绪：`/api/v1/sync/pull`、`/api/v1/sync/push`

## 关键风险
1. WatermelonDB 原生模块（JSI/C++）在 Docker 容器可能编译失败
2. SQLCipher 移除后数据库迁移路径（首次启动需重建）
3. AuthContext 中触发 fullSync 不能阻塞登录 UX
