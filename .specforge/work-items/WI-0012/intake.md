# Intake: RN 安卓端构建环境搭建 + 原生工程初始化

## 功能标题
完成 React Native 安卓端构建环境验证和原生工程初始化，使项目能在 Docker 容器中构建 Debug APK。

## 用户故事
作为 fj1 项目的开发者，我需要在 Docker 容器（fj-builder:react-native-0.74）中完成 RN 安卓工程的构建链验证和原生工程初始化，使得后续 WI（登录屏、功能屏幕）能在此基础上开发并最终交付可安装的 APK。

## 背景
fj1 项目包含一个 React Native 安卓端（fj-android/），当前状态：
- 有 25 个 TypeScript 源文件（ApiClient、SyncEngine、屏幕骨架、数据模型）
- 三个 Tab 导航全是占位组件
- 没有 `android/` 原生工程目录
- 没有 `App.tsx` / `index.js` 入口文件
- 无法构建 APK

## 目标（本 WI 范围）
1. 在 Docker 容器中验证构建链（JDK17 + Android SDK + Node + Gradle）
2. 用 `npx react-native init` 生成原生 `android/` 工程
3. 整合现有 `src/` 骨架到新工程
4. 创建 `App.tsx` 入口（渲染 AppNavigator，最小可运行）
5. 在容器中构建 Debug APK
6. 验证 APK 文件生成（不需要真机安装，真机安装在 WI-0013）

## 不在范围内
- 登录功能（WI-0013）
- 业务屏幕实装（WI-0015~0019）
- Release 签名（WI-0014）
- 真机安装测试（WI-0013）

## 技术约束
- 构建环境：Docker 容器 `fj-builder:react-native-0.74`（已存在，6.88GB）
  - JDK 17、Android SDK/NDK 27.1、CMake 3.30.5、Node、Gradle
- RN 版本：0.74.0（package.json 已锁定）
- 原生工程生成方式：`npx react-native init fj-android --template react-native@0.74`（临时目录生成后合并 android/ 到现有项目）
- 项目根目录：`/mnt/1t_back/project/fj1/fj-android/`
- 容器挂载：`-v /mnt/1t_back/project/fj1/fj-android:/build`

## API 地址配置策略
用户决策：公网 IP 硬编码到配置文件，以后修改配置文件即可。
- 生产 API 地址：`http://129.211.5.240`
- 配置文件位置：`src/config/AppConfig.ts`（本 WI 创建占位，WI-0013 实际使用）

## 签名密钥
用户决策：由我生成新密钥（本 WI 不涉及，WI-0014 执行）

## 验收标准（初步）
- AC-1: Docker 容器 `fj-builder:react-native-0.74` 可运行且构建工具链可用
- AC-2: `fj-android/android/` 原生工程目录存在且结构完整
- AC-3: `fj-android/App.tsx` 入口文件存在，渲染 AppNavigator
- AC-4: `fj-android/src/config/AppConfig.ts` 配置文件存在，包含 API_BASE_URL
- AC-5: 容器内 `cd android && ./gradlew assembleDebug` 成功生成 APK
- AC-6: APK 文件 `android/app/build/outputs/apk/debug/app-debug.apk` 存在

## 相关文件
- `fj-android/package.json` — RN 0.74 依赖
- `fj-android/app.json` — RN 应用配置
- `fj-android/src/navigation/AppNavigator.tsx` — 根导航（已存在，将被 App.tsx 引用）
- `fj-android/babel.config.js` — Babel 配置
- `fj-android/tsconfig.json` — TypeScript 配置

## 依赖
- Docker 26.1.3（本机已安装）
- `fj-builder:react-native-0.74` 镜像（已存在）
- 后端 API 已就绪（WI-0011 修复后登录可用）
