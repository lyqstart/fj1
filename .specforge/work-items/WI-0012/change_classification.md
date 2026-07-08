# Change Classification: WI-0012

## 变更类型
new_feature（新功能 — 安卓原生工程初始化）

## 变更范围
| 维度 | 评估 |
|------|------|
| 是否涉及需求变更 | 是（新增安卓端构建能力） |
| 是否涉及设计变更 | 是（原生工程架构、入口文件、配置） |
| 是否涉及数据库变更 | 否 |
| 是否涉及 API 契约变更 | 否（消费现有后端 API） |
| 是否影响数据语义 | 否 |

## 影响模块
- fj-android/android/（新建 — 原生工程）
- fj-android/App.tsx（新建 — RN 入口）
- fj-android/src/config/AppConfig.ts（新建 — 配置）

## 风险等级
中 — 原生工程初始化涉及 Gradle 配置、依赖解析，可能有版本兼容问题

## 约束
- 构建在 Docker 容器 fj-builder:react-native-0.74 中进行
- RN 0.74.0 已锁定
- 不修改现有 src/ 目录中的源文件（只新增文件）