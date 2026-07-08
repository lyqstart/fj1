# WI-0030 Trace Delta

## 规格影响
**无规格影响**（code_only_fast_path）

## 变更追溯
| REQ | AC | DD | TASK | FILE | TEST |
|-----|----|----|------|------|------|
| N/A | N/A | N/A | T1 | AppLogService.java | mvn compile |
| N/A | N/A | N/A | T2 | fj-api-1.0.0.jar (deploy) | curl endpoint test |

## 说明
本 WI 仅修正部署路径配置错误，不涉及任何需求、设计或架构变更。