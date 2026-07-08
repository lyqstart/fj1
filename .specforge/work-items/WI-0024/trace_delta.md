# Trace Delta — WI-0024

Work Item: WI-0024
功能：生物识别指纹登录

## 1. 变更类型
新增 Trace（全新功能，无已有 Trace 条目受影响）

## 2. 新增 Trace 条目

| REQ | AC | DD | TASK | FILE | TEST | EVIDENCE | 状态 |
|-----|----|----|------|------|------|----------|------|
| REQ-1 | REQ-1.1（开关触发指纹验证） | DD-1 | TASK-3 | src/screens/profile/ProfileScreen.tsx | — | — | new |
| REQ-1 | REQ-1.2（验证通过存储凭证） | DD-1 | TASK-1 | src/store/auth/BiometricAuth.ts | — | — | new |
| REQ-1 | REQ-1.3（验证失败不存储） | DD-1 | TASK-3 | src/screens/profile/ProfileScreen.tsx | — | — | new |
| REQ-2 | REQ-2.1（启动检测触发指纹） | DD-2 | TASK-2 | src/store/auth/AuthContext.tsx | — | — | new |
| REQ-2 | REQ-2.2（验证通过自动登录） | DD-2 | TASK-2 | src/store/auth/AuthContext.tsx | — | — | new |
| REQ-2 | REQ-2.3（失败回退手动登录） | DD-2 | TASK-2 | src/store/auth/AuthContext.tsx | — | — | new |

## 3. 修改 Trace
无

## 4. 删除 Trace
无

## 5. 影响范围
- 需要更新 module trace: `core`
- 需要更新 project `trace_matrix.md`（新增 6 条 Trace）

## 6. Trace 不变项确认
- 现有手动登录相关 Trace 不受影响（生物识别是独立可选分支，手动登录逻辑完全不变）
