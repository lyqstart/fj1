# WI-0028 Intake: 应用日志系统 + 启动诊断

## 背景
Release APK 在华为 Nova 9 (HarmonyOS) 上显示深灰色屏幕，React Native 未渲染。WI-0026 (ProGuard 修复) 和 WI-0027 (无 ProGuard 诊断版) 均未解决问题。根因不明，缺少运行时诊断手段。

## 用户需求
"app所有关键地方都写日志，日志保存在本地和服务器上。日志要分级管理，开发阶段要详细，app发布后记录关键信息。"

## 功能目标

### 1. 日志系统核心 (Logger)
- 4 个级别: DEBUG / INFO / WARN / ERROR
- 开发阶段 (`__DEV__=true`): 最低级别 DEBUG，输出到 console
- 发布阶段 (Release): 最低级别 INFO，仅记录关键信息
- 格式: `[LEVEL] [timestamp] [module] message {data}`

### 2. 本地持久化
- 内存环形缓冲区 (500 条，启动时立即可用)
- 持久化到本地存储 (文件或数据库)
- App 重启后可读取历史日志

### 3. 远程上传
- 批量上传到后端服务器
- 通过现有 ApiClient 发送
- 网络可用时自动 flush

### 4. 启动诊断 (关键！)
- 修改 `index.js`，在 `require('./App')` 外包裹 try-catch
- 如果 App 模块加载失败，注册一个降级错误展示组件
- 降级组件在屏幕上显示错误信息和堆栈
- 安装全局错误处理器 (`ErrorUtils.setGlobalHandler`)
- 捕获未处理的 Promise 拒绝

### 5. 关键路径集成
- App 启动: JS bundle 加载 / App 模块导入 / AppRegistry 注册
- 数据库初始化: initDatabase 开始/成功/失败
- 认证: 登录/登出/token 刷新
- API 调用: 请求/响应/错误
- 同步引擎: 同步开始/进度/完成/失败
- 屏幕生命周期: 各屏幕 mount/unmount

## 附加修复
- 将 `styles.xml` 的 `DayNight` 主题改为固定 Light 主题（消除 HarmonyOS 暗色模式下的深灰色背景）