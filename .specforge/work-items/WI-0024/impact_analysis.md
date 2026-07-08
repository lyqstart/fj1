# WI-0024 影响分析

## 受影响文件
1. src/store/auth/BiometricAuth.ts — 新建
2. src/store/auth/AuthContext.tsx — 添加 biometric login
3. src/screens/profile/ProfileScreen.tsx — 添加指纹开关

## 下游影响
- 登录流程增加生物识别路径（可选）
- 不影响已有登录逻辑