---
trace_format: structured
work_item_id: WI-0013
workflow_type: feature_spec
workflow_path: requirement_change_path
base_spec_version: PSV-0001
candidate_type: trace_delta
generated_by: sf-task-planner
---

# Trace Delta: WI-0013 — 登录功能实现 + 真机安装测试

## 一、追溯矩阵（REQ → AC → DD → TASK → FILE → VERIFICATION）

> 完整覆盖 18 REQ / 103 AC / 15 DD / 10 TASK / 10 文件（7 新建 + 3 修改）。

| REQ ID | AC 覆盖 | DD 覆盖 | TASK ID | 目标文件 | 验证方式 |
|--------|---------|---------|---------|---------|---------|
| **REQ-001** LoginScreen 渲染 | AC-1,2,3,4,5 | DD-1, DD-6 | TASK-5, TASK-6, TASK-7 | LoginScreen.tsx, RootNavigator.tsx, App.tsx | grep(TextInput/secureTextEntry), tsc --noEmit, 真机验证(TASK-10) |
| **REQ-002** 表单输入与即时校验 | AC-1,2,3,4,5,6 | DD-6 | TASK-5 | LoginScreen.tsx | grep(isButtonDisabled/disabled/opacity), tsc, 真机验证 |
| **REQ-003** 登录提交与加载状态 | AC-1,2,3,4,5 | DD-6, DD-12, DD-13 | TASK-4, TASK-5 | AuthContext.tsx, LoginScreen.tsx | grep('/auth/login'), grep(ActivityIndicator), tsc, 真机验证 |
| **REQ-004** 登录失败错误处理 | AC-1,2,3,4,5,6,7 | DD-6, DD-7, DD-13 | TASK-4, TASK-5 | AuthContext.tsx, LoginScreen.tsx | grep(中文错误文案×4), grep(errorDismissed), tsc, 真机验证 |
| **REQ-005** 认证状态机 | AC-1,2,3,4,5,6,7 | DD-2, DD-3, DD-8 | TASK-2, TASK-4 | types.ts, authReducer.ts, AuthContext.tsx | grep(AuthStatus/9 actions), grep(useReducer), tsc |
| **REQ-006** KeychainStorage 安全存储 | AC-1,2,3,4,5,6,7 | DD-4 | TASK-3 | KeychainStorage.ts | grep(implements AuthTokensProvider/setInternetCredentials/fj1-auth), tsc |
| **REQ-007** 令牌自动刷新 | AC-1,2,3,4,5,6 | DD-4, DD-5, DD-14 | TASK-3 | KeychainStorage.ts | grep(refreshTokens/bareAuthClient), tsc |
| **REQ-008** 登出流程 | AC-1,2,3,4,5 | DD-12, DD-15 | TASK-4 | AuthContext.tsx | grep('/auth/logout'/clearTokens/LOGOUT_COMPLETE), tsc |
| **REQ-009** 登录状态持久化 | AC-1,2,3,4,5,6 | DD-4, DD-12 | TASK-3, TASK-4 | KeychainStorage.ts, AuthContext.tsx | grep(getKeychainData/RESTORE_SESSION/STARTUP_CHECK), tsc, 真机验证(TASK-10 持久化恢复) |
| **REQ-010** 导航守卫 | AC-1,2,3,4,5,6 | DD-1 | TASK-6, TASK-7 | RootNavigator.tsx, App.tsx | grep(5 status branches/AppNavigator/LoginScreen), grep(ErrorBoundary+AuthProvider+RootNavigator in App.tsx), tsc |
| **REQ-011** 全局错误边界 | AC-1,2,3,4,5 | DD-1, DD-9 | TASK-6, TASK-7 | ErrorBoundary.tsx, App.tsx | grep(class/getDerivedStateFromError/componentDidCatch/重新加载), grep(ErrorBoundary in App.tsx), tsc |
| **REQ-012** 令牌安全 NFR | AC-1,2,3,4,5 | DD-4, DD-6, DD-7 | TASK-3, TASK-4, TASK-5 | KeychainStorage.ts, AuthContext.tsx, LoginScreen.tsx | grep(无 AsyncStorage for tokens), code review(token log ≤8 chars), tsc |
| **REQ-013** 明文 HTTP 配置 | AC-1,2,3,4 | DD-11 | TASK-1, TASK-8 | AndroidManifest.xml | grep(usesCleartextTraffic="true"), Docker assembleDebug, 真机网络验证 |
| **REQ-014** keychain autolinking 恢复 | AC-1,2,3,4,5 | DD-10 | TASK-1, TASK-8 | react-native.config.js | node -e(keychain unblocked + 6 preserved), Docker assembleDebug(BUILD SUCCESSFUL) |
| **REQ-015** 登录性能与超时 | AC-1,2,3,4 | DD-5, DD-7 | TASK-3, TASK-4 | KeychainStorage.ts, AuthContext.tsx | tsc(timeout via ApiClient DEFAULT_TIMEOUT_MS=30000), 真机 P95 验证(TASK-10) |
| **REQ-016** 真机安装与端到端 | AC-1,2,3,4,5,6,7 | 文件清单支持 | TASK-8, TASK-10 | app-debug.apk | Docker build(APK>1MB), adb install, 真机登录流程验证(6 步清单) |
| **REQ-017** 后端 API 契约一致性 | AC-1,2,3,4,5,6 | DD-3, DD-4, DD-5 | TASK-2, TASK-3, TASK-4 | types.ts, KeychainStorage.ts, AuthContext.tsx | grep(User{id,username,realName}), grep(/auth/login /auth/refresh /auth/logout), grep(API_ROOT), tsc |
| **REQ-018** 文件修改范围约束 | AC-1,2,3,4,5,6,7 | 文件清单 | TASK-1 ~ TASK-7 | 全部 10 文件 | git diff --stat(仅 7 新建 + 3 修改), grep(ApiClient/AppConfig/AppNavigator 未修改), tsc |

---

## 二、文件覆盖矩阵

| # | 文件路径 | 操作 | 涉及 REQ | 涉及 DD | 涉及 TASK |
|---|---------|------|---------|---------|-----------|
| 1 | `fj-android/src/store/auth/types.ts` | **新建** | REQ-005, REQ-009, REQ-017 | DD-2, DD-3 | TASK-2 |
| 2 | `fj-android/src/store/auth/authReducer.ts` | **新建** | REQ-005 | DD-2, DD-8 | TASK-2 |
| 3 | `fj-android/src/api/KeychainStorage.ts` | **新建** | REQ-006, REQ-007, REQ-009, REQ-012, REQ-015, REQ-017 | DD-4, DD-5 | TASK-3 |
| 4 | `fj-android/src/store/auth/AuthContext.tsx` | **新建** | REQ-003, REQ-004, REQ-005, REQ-007, REQ-008, REQ-009, REQ-010, REQ-017 | DD-2, DD-7, DD-12 | TASK-4 |
| 5 | `fj-android/src/screens/auth/LoginScreen.tsx` | **新建** | REQ-001, REQ-002, REQ-003, REQ-004, REQ-012 | DD-6, DD-7 | TASK-5 |
| 6 | `fj-android/src/components/ErrorBoundary.tsx` | **新建** | REQ-011 | DD-9 | TASK-6 |
| 7 | `fj-android/src/navigation/RootNavigator.tsx` | **新建** | REQ-010, REQ-011 | DD-1 | TASK-6 |
| 8 | `fj-android/App.tsx` | **修改** | REQ-010, REQ-011, REQ-018 | DD-1 | TASK-7 |
| 9 | `fj-android/react-native.config.js` | **修改** | REQ-014, REQ-018 | DD-10 | TASK-1 |
| 10 | `fj-android/android/app/src/main/AndroidManifest.xml` | **修改** | REQ-013, REQ-018 | DD-11 | TASK-1 |

### 受保护文件（禁止修改，REQ-018 AC-4）

| 文件路径 | 保护理由 | 验证方式 |
|---------|---------|---------|
| `fj-android/src/api/ApiClient.ts` | AuthTokensProvider 接口已定义，本 WI 仅实现该接口 | git diff 确认无改动 |
| `fj-android/src/config/AppConfig.ts` | API_ROOT 已就绪 | git diff 确认无改动 |
| `fj-android/src/navigation/AppNavigator.tsx` | WI-0012 骨架导航，仅被 RootNavigator 导入使用 | git diff 确认无改动 |
| `fj-android/package.json` | 依赖已安装，不新增/删除 | git diff 确认无改动 |
| `fj-android/babel.config.js` | 编译配置保护 | git diff 确认无改动 |
| `fj-android/tsconfig.json` | TS 配置保护 | git diff 确认无改动 |
| `fj-android/app.json` | RN 应用配置保护 | git diff 确认无改动 |

---

## 三、设计决策（DD）覆盖统计

| DD ID | 决策摘要 | 覆盖 TASK | 状态 |
|-------|---------|-----------|------|
| DD-1 | 三层架构 ErrorBoundary→AuthProvider→RootNavigator | TASK-6, TASK-7 | ✅ 已覆盖 |
| DD-2 | AuthStore: Context + useReducer（零新依赖） | TASK-2, TASK-4 | ✅ 已覆盖 |
| DD-3 | AuthState/AuthAction 数据模型（5 status, 9 actions） | TASK-2 | ✅ 已覆盖 |
| DD-4 | KeychainStorage: setInternetCredentials JSON blob | TASK-3 | ✅ 已覆盖 |
| DD-5 | 双 ApiClient 防 refresh 递归（BareAuthClient） | TASK-3 | ✅ 已覆盖 |
| DD-6 | LoginScreen UI: RN 内置组件 + 内联样式 | TASK-5 | ✅ 已覆盖 |
| DD-7 | 错误分类映射（5 kind → 中文文案） | TASK-4 | ✅ 已覆盖 |
| DD-8 | 状态转换矩阵（9 action 合法 from→to） | TASK-2 | ✅ 已覆盖 |
| DD-9 | ErrorBoundary: React Class Component | TASK-6 | ✅ 已覆盖 |
| DD-10 | react-native.config.js 仅解除 keychain | TASK-1 | ✅ 已覆盖 |
| DD-11 | AndroidManifest usesCleartextTraffic="true" | TASK-1 | ✅ 已覆盖 |
| DD-12 | 启动初始化 + login + logout 副作用逻辑 | TASK-4 | ✅ 已覆盖 |
| DD-13 | 登录时序图（实现参考，无独立文件） | TASK-4, TASK-5 | ✅ 已覆盖（时序图由实现体现） |
| DD-14 | Token 刷新时序图（实现参考，无独立文件） | TASK-3 | ✅ 已覆盖（时序图由实现体现） |
| DD-15 | 回滚预案（AsyncStorage 降级） | TASK-8 | ✅ 已覆盖（构建失败时触发） |

---

## 四、覆盖统计

| 指标 | 值 | 达标 |
|------|-----|------|
| 总 REQ 数 | 18 | — |
| 总 AC 数 | 103 | — |
| 总 DD 数 | 15 | — |
| 总 TASK 数 | 10 | — |
| 总文件数 | 10（7 新建 + 3 修改） | — |
| **已覆盖 REQ** | **18 / 18** | ✅ 100% |
| **已覆盖 AC** | **103 / 103** | ✅ 100% |
| **已覆盖 DD** | **15 / 15** | ✅ 100% |
| **已覆盖 TASK** | **10 / 10** | ✅ 100% |
| **已覆盖文件** | **10 / 10** | ✅ 100% |
| 悬空 REQ（无 AC） | 0 | ✅ 无悬空 |
| 悬空 DD（无 TASK） | 0 | ✅ 无悬空 |
| 悬空 TASK（无 REQ/DD） | 0 | ✅ 无悬空 |
| 悬空文件（无 TASK） | 0 | ✅ 无悬空 |
| TASK 间 allowed_write_files 重叠 | 0 | ✅ 无重叠 |

---

## 五、验证层级映射

| 验证层级 | TASK | 验证手段 | 覆盖 REQ |
|---------|------|---------|---------|
| **L1: 静态结构验证** | TASK-1 ~ TASK-7 | `test -f` + `grep -c`（文件存在 + 符号存在） | 全部（代码结构层面） |
| **L2: 类型安全验证** | TASK-9 | `npx tsc --noEmit`（全量 TypeScript 类型检查） | 全部（类型正确性层面） |
| **L3: 原生编译验证** | TASK-8 | Docker `gradlew assembleDebug`（含 keychain 原生模块编译） | REQ-013, REQ-014, REQ-016(AC-1), REQ-018 |
| **L4: 真机端到端验证** | TASK-10 | `adb install` + 人工验证清单（6 步登录流程） | REQ-001, REQ-003, REQ-004, REQ-009, REQ-016(AC-2~7) |

---

## 六、自检

| # | 检查项 | 结果 |
|---|--------|------|
| 1 | 每个 REQ 是否至少关联一个 AC？ | ✅ 18/18 REQ 均有 ≥4 条 AC |
| 2 | 每个 AC 是否至少关联一个 TASK？ | ✅ 103/103 AC 均映射到 TASK（通过 REQ→TASK 间接覆盖） |
| 3 | 每个 DD 是否至少关联一个 TASK？ | ✅ 15/15 DD 均有 TASK 覆盖 |
| 4 | 每个 TASK 是否有明确目标文件？ | ✅ 10/10 TASK 均有 allowed_write_files（TASK-8/9/10 为验证 task，allowed_write_files=[] 但有明确验证目标） |
| 5 | 每个目标文件是否有验证方式？ | ✅ 10/10 文件均有 grep/tsc/build 验证 |
| 6 | trace_delta.md 是否真实写入？ | ✅ 本文件已通过 sf_artifact_write 写入 |
