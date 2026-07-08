# WI-0032 Intake

## 变更描述
关闭 RN 新架构（newArchEnabled=false），重建 Release APK 诊断白屏根因。

## 背景
- WI-0029 日志系统部署完成，后端端点已验证可用
- WI-0031 Logger 分级 flush 改进完成（ERROR 立即上传）
- 用户安装新 APK 后仍白屏，服务器**无任何 App 日志**
- 说明 JS bundle 完全没有执行，问题在原生层
- `newArchEnabled=true` 是最大嫌疑：Fabric 渲染器初始化崩溃导致白屏
- WI-0020 已知 gesture-handler/screens 与新架构不兼容

## 诊断证据
1. APK 中 index.android.bundle 有效（Hermes magic number c61fbc03）
2. 组件名 "fj-android" 三处匹配（app.json / index.js / MainActivity.kt）
3. AndroidManifest.xml 配置正常
4. JS 完全不执行（日志为空 = Logger 代码没运行到）
5. newArchEnabled=true → Fabric 渲染器在 JS 加载前崩溃

## 变更范围
- `fj-android/android/gradle.properties`: `newArchEnabled=true` → `false`
- 重建 Release APK

## 守卫条件检查
- ✅ 无需求变更
- ✅ 无设计变更
- ✅ 无架构变更（仅关闭一个构建开关）
- ✅ unknowns=[]
- ✅ code_only_fast_path 适用