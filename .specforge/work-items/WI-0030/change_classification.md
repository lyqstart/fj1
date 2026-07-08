# WI-0030 Change Classification

## 分类
- **类型**: bugfix（路径配置错误）
- **范围**: 单文件单行常量修改
- **风险**: 极低
- **workflow_path**: code_only_fast_path

## 理由
代码中的绝对路径常量与服务器实际部署路径不一致，导致日志文件会写入错误目录。修复是单 token 变更（`/opt/fj` → `/opt/fj1`），不涉及任何规格、设计或架构变更。