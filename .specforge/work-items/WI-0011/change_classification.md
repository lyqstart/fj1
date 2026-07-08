# Change Classification: WI-0011

## 变更类型
bugfix（生产阻断性缺陷修复）

## 变更范围
| 维度 | 评估 |
|------|------|
| 是否涉及需求变更 | 否（修复已有登录功能，不新增需求） |
| 是否涉及设计变更 | 是（新增 SecurityConfig 配置类，属于遗漏的实现） |
| 是否涉及数据库变更 | 否（V2 种子数据修复，不影响 schema） |
| 是否涉及 API 契约变更 | 否（API 路径和响应格式不变） |
| 是否影响数据语义 | 否（仅哈希编码格式统一） |

## 影响模块
- fj-api（新增 SecurityConfig.java）
- fj-auth（JwtAuthFilter 路径修复）
- fj-api resources（V2 种子数据哈希修复）

## 风险等级
P0 — 所有用户无法登录，系统完全不可用

## 紧急度
最高 — 生产环境阻断性缺陷，需立即修复