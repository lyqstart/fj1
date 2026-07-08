# WI-0026 修复设计

## DD-1: ProGuard 规则补全

### 方案
重写 `proguard-rules.pro`，补全所有缺失的 keep 规则。

### 完整规则清单
1. 通用属性（保留现有）
2. React Native 核心 + DoNotStrip 注解（修正 keep 方式）
3. Hermes 引擎（保留现有）
4. 新架构运行时（新增：runtime/turbomodule/fabric）
5. OkHttp/okio（保留现有）
6. react-native-keychain + Facebook Conceal（新增 crypto）
7. WatermelonDB（修正包名：com.nozbe.watermelondb）
8. vision-camera（新增：com.mrousavy.camera）
9. safe-area-context（新增：com.th3rdwave.safeareacontext）
10. image-resizer（新增：com.RNImageResizer）
11. 应用自定义类（保留现有）

## DD-2: 验证策略

### 构建后验证
1. Docker assembleRelease 重建
2. BUILD SUCCESSFUL
3. APK 内 classes.dex 包含关键类（可选：用 dexdump 验证）

### 运行时验证（用户侧）
- 安装新 APK 到真机
- 启动 App，应显示登录页（不再黑屏）