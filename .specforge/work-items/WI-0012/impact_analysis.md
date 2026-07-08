# Impact Analysis: WI-0012

## 影响评估

### 新增文件
| 文件 | 说明 |
|------|------|
| fj-android/android/（整个目录） | RN 原生工程（Gradle、AndroidManifest、MainActivity、build.gradle） |
| fj-android/App.tsx | RN 应用入口，包裹 AppNavigator |
| fj-android/index.js | RN 注册入口 |
| fj-android/metro.config.js | Metro 打包配置 |
| fj-android/src/config/AppConfig.ts | 应用配置（API_BASE_URL 等） |

### 受影响文件
| 文件 | 影响 |
|------|------|
| fj-android/package.json | 可能需要补充 react-native 相关依赖 |
| fj-android/babel.config.js | 可能需要调整 presets |

### 不受影响
- 现有 src/ 目录所有源文件（只读引用，不修改）
- 后端 fj-backend/
- Web 前端 fj-frontend/

## 技术风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| RN 0.74 init 生成的 build.gradle 与现有 babel.config.js 冲突 | 中 | 中 | 用临时目录生成后只合并 android/ |
| WatermelonDB 原生模块需要额外 Gradle 配置 | 高 | 高 | 暂时注释 WatermelonDB 引用，先构建空白屏 APK |
| VisionCamera 原生模块编译失败 | 中 | 中 | 同上，先排除原生模块依赖 |
| Gradle 下载依赖网络超时 | 中 | 中 | 使用容器内已缓存的依赖 |

## 关键决策
- **原生工程生成策略**：不在 fj-android/ 直接 init（会覆盖现有文件），而是在 /tmp 临时目录 init，然后只复制 android/ 目录到 fj-android/
- **入口文件策略**：App.tsx 最小化，只渲染 AppNavigator（不引入 Database Provider，避免 WatermelonDB 原生模块依赖）
- **配置策略**：AppConfig.ts 包含 API_BASE_URL='http://129.211.5.240'（用户决策：公网IP）