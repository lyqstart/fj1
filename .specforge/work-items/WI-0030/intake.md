# WI-0030 Intake

## 变更描述
AppLogService.java 中的日志目录路径硬编码为 `/opt/fj/api/logs/app-logs`，但服务器实际部署路径为 `/opt/fj1/api/`。需要修正为 `/opt/fj1/api/logs/app-logs` 并重新编译部署 jar。

## 背景
- WI-0029 实现了 App 日志后端端点（POST /api/v1/logs/batch）
- 服务器实际路径：`/opt/fj1/api/fj-api-1.0.0.jar`（由 systemd fj1-api.service 管理）
- 代码中路径错误：`/opt/fj/api/logs/app-logs`（少了 `1`）

## 变更范围
- 单文件单行修改：`AppLogService.java` 第 19 行 LOG_DIR 常量
- 编译新 jar 并部署到服务器
- 重启 fj1-api.service

## 守卫条件检查
- ✅ 无需求变更
- ✅ 无设计变更
- ✅ 无架构变更
- ✅ 无验收标准变更
- ✅ 无数据语义变更
- ✅ 无接口契约变化
- ✅ unknowns=[]
- ✅ 不新增用户可见功能
- ✅ code_only_fast_path 适用