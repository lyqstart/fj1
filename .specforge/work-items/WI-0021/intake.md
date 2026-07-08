# WI-0021 Intake

## 背景
fj-android RN App 核心骨架已完成（WI-0012~0020），现在需要三项增强：
1. Token 定时刷新（避免 accessToken 过期导致 API 401）
2. HTTPS + Network Security Config（当前使用明文 HTTP）
3. UI 美化（统一配色/间距/字体）

## 目标
- Token 刷新：ApiClient 在 accessToken 即将过期时自动用 refreshToken 刷新
- HTTPS：后端 nginx 配置 SSL + App 端 network_security_config.xml
- UI：统一 Theme（颜色/间距/字号常量）

## 范围
- src/api/ApiClient.ts — 请求拦截器中检查 token 过期
- src/store/auth/AuthContext.tsx — 定时刷新逻辑
- android/app/src/main/res/xml/network_security_config.xml — 新建
- android/app/src/main/AndroidManifest.xml — 引用 networkSecurityConfig
- src/theme/ — 新建 Theme 常量（colors/spacing/typography）

## 约束
- 不改变现有 API 端点
- Token 刷新失败时 logout（已有逻辑）
- HTTPS 配置允许明文 fallback（过渡期）

## 验收标准
- Token 刷新：accessToken 剩余 < 5 分钟时自动刷新
- HTTPS：network_security_config.xml 存在并被引用
- UI：Theme 常量定义并被至少 3 个屏幕引用
- tsc exit 0
- Docker BUILD SUCCESSFUL