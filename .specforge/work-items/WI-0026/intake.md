# WI-0026 Intake

## 缺陷描述
**当前行为**：WI-0025 修复后的 Release APK（55MB，bundle Stored）安装后启动**黑屏**，无崩溃弹窗，无任何 UI 元素。

**预期行为**：启动后应显示登录页（白色背景 + 登录表单）。

**复现步骤**：
1. 安装 WI-0025 修复后的 `app-release.apk`（55MB）
2. 点击启动
3. 黑屏，无任何内容

**对比信息**：
- 修复前：崩溃弹窗 "Unable to load script"
- 修复后：黑屏（无弹窗）
- 黑屏意味着 JS bundle 已成功加载（Hermes 字节码正常解析），但运行时某处异常或返回 null

## 初步怀疑（黑屏常见根因，按优先级）
1. **ErrorBoundary 吞错**：JS 运行时抛错，ErrorBoundary fallback view 渲染失败或返回 null
2. **RootNavigator 返回 null**：status='loading' 时未渲染 LoadingScreen，而是空 View
3. **initDatabase 永久 pending**：AppRoot 的 useState 未被 resolve，导致永远显示空白
4. **AuthContext 启动抛错**：WI-0021 Token 定时器 / WI-0024 BiometricAuth auto-login 在 Release 模式下首次启动抛错
5. **Provider 嵌套问题**：DatabaseProvider/SyncEngineInitializer/PhotoUploadInitializer 某个抛错
6. **新架构相关问题**：WI-0020 启用 newArchEnabled=true 后某些原生组件初始化失败
7. **R8/ProGuard 误删类**：WI-0014 的 proguard rules 未覆盖新架构下的某个关键类

## 关键差异点（与 WI-0013 能正常运行的 Debug 版本相比）
- WI-0020：新架构启用 + 3 模块解除屏蔽
- WI-0021：Token 定时器 + AuthContext 修改 + Theme 新建
- WI-0024：BiometricAuth + 启动时自动指纹登录 useEffect

Debug 版本（从 Metro 加载）从未在生产 Release 模式下测试过，所以问题可能在任何 WI-0014~0024 引入的代码。