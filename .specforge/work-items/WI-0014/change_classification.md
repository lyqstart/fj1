# Change Classification — WI-0014

## 变更类型
New Feature — 构建配置变更，新增 Release 签名和代码混淆能力。

## 影响模块
| 模块 | 影响 |
|------|------|
| `fj-android/android/app/build.gradle` | 修改：signingConfigs + buildTypes.release |
| `fj-android/android/app/proguard-rules.pro` | 新建：ProGuard 保留规则 |
| `fj-android/android/gradle.properties` | 可能修改：调整 Release 构建相关属性 |

## workflow_path 判定
requirement_change_path — 新增构建能力，需要需求分析（ProGuard 规则覆盖面）和设计（签名配置方案）。
