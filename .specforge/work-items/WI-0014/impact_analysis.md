# Impact Analysis — WI-0014

## 代码影响
| 文件 | 操作 | 说明 |
|------|------|------|
| `fj-android/android/app/build.gradle` | 修改 | 添加 signingConfigs.release + buildTypes.release 配置 |
| `fj-android/android/app/proguard-rules.pro` | 新建 | ProGuard/R8 保留规则 |
| `fj-android/android/gradle.properties` | 可能修改 | android.enableR8=true（如未设置） |

## 风险
| 风险 | 缓解 |
|------|------|
| ProGuard 过度混淆导致运行时崩溃 | 完整的 -keep 规则覆盖 RN/keychain/Hermes/OkHttp |
| 密钥泄露 | keystore 不提交 Git，加入 .gitignore |
| Release APK 与 Debug 行为不一致 | 验证 Release APK 启动+登录流程 |

## 依赖
- WI-0013 产物（登录功能 + keychain）
- Docker 构建环境 + AUTH 授权
