# WI-0021 影响分析

## 受影响文件
1. src/api/ApiClient.ts — 添加 token 过期检查 + 刷新逻辑
2. src/store/auth/AuthContext.tsx — 定时刷新 + refreshAccessToken 方法
3. android/app/src/main/res/xml/network_security_config.xml — 新建
4. android/app/src/main/AndroidManifest.xml — 添加 networkSecurityConfig 属性
5. src/theme/colors.ts — 新建
6. src/theme/spacing.ts — 新建
7. src/theme/typography.ts — 新建
8. src/theme/index.ts — 新建（barrel export）

## 下游影响
- Token 刷新影响所有 API 调用（透明层，不改变接口）
- HTTPS 影响所有网络请求
- UI Theme 是可选引用（不强制重构现有屏幕）