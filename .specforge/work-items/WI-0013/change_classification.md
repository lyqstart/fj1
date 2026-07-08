# Change Classification — WI-0013

## Work Item: WI-0013
## Date: 2026-07-05

---

## 1. 变更类型

**New Feature** — 新增用户可见功能（登录界面、认证流程）

## 2. 变更范围

| 维度 | 说明 |
|------|------|
| 用户可见 | ✅ 新增登录界面、登录状态切换 |
| 新增页面/路由 | ✅ LoginScreen（条件渲染，非 Tab 路由） |
| 验收标准 | ✅ 登录成功、登录失败、状态持久化、真机安装 |
| 数据语义 | ❌ 不涉及数据库 schema 变更 |
| 接口契约 | ❌ 后端 API 已就绪，仅消费方实现 |
| 架构变更 | ❌ 不涉及系统架构调整 |

## 3. 影响模块

| 模块 | 影响 | 说明 |
|------|------|------|
| `fj-android/src/screens/auth/` | 新增 | LoginScreen 组件 |
| `fj-android/src/store/auth/` | 新增 | AuthStore / 认证状态管理 |
| `fj-android/src/api/KeychainStorage.ts` | 新增 | AuthTokensProvider 实现 |
| `fj-android/src/navigation/AppNavigator.tsx` | 修改 | 增加登录守卫逻辑 |
| `fj-android/App.tsx` | 修改 | 条件渲染 Login/App |
| `fj-android/react-native.config.js` | 修改 | 解除 keychain 屏蔽 |

## 4. 复杂度评估

| 因素 | 等级 | 说明 |
|------|------|------|
| 代码量 | 中 | 约 5-8 个新文件，约 500-800 行 |
| 技术风险 | 低-中 | keychain autolinking 需验证 |
| 依赖项 | 1 | react-native-keychain 需解除屏蔽并重新构建 |
| 测试复杂度 | 中 | 需要真机安装验证 |

## 5. workflow_path 判定

- **不是** code_only_fast_path：新增用户可见功能、新增页面、新增验收标准
- **是** requirement_change_path：需要完整需求分析的新功能
