---
doc_type: trace_delta
schema_version: "1.0"
work_item_id: WI-0009
workflow_type: bugfix_spec
base_spec_version: current
---

# Trace Delta — WI-0009: 验收标准 → 任务 → 文件 追溯

> Work Item: WI-0009
> Workflow Type: bugfix_spec
> 来源: requirements.md（AC-1..AC-4）、tasks candidate（TASK-1）、design（DD-1..DD-5）

## 追溯矩阵

| AC | 描述 | TASK | 目标文件 | 验证方式 |
|----|------|------|----------|----------|
| AC-1 | application-prod.yml 不再含 `spring.profiles.active` 及 `profiles:` 声明 | TASK-1 | `fj-backend/fj-api/src/main/resources/application-prod.yml` | `grep -n "spring.profiles.active" <file>` 无输出；`grep -n "profiles:" <file>` 无输出 |
| AC-2 | YAML 结构有效：`spring:` 键下直接为 `datasource:`，缩进正确 | TASK-1 | `fj-backend/fj-api/src/main/resources/application-prod.yml` | python yaml 解析成功且 `d['spring']['datasource']['url']` 存在；`'profiles' not in d['spring']` |
| AC-3 | 重新构建的 jar 内 application-prod.yml 不含 `spring.profiles.active` | TASK-1 | `fj-backend/fj-api/target/classes/application-prod.yml`（构建产物） | `mvn package -DskipTests` 后 `grep -c "spring.profiles.active" target/classes/application-prod.yml` 返回 0 |
| AC-4 | 用修复后配置 + `SPRING_PROFILES_ACTIVE=prod` 可正常初始化 Spring Boot 上下文（无 `InvalidConfigDataPropertyException`） | TASK-1 | `fj-backend/fj-api/src/main/resources/application-prod.yml` | 本地 `SPRING_PROFILES_ACTIVE=prod` 启动验证（最终由 WI-0008 部署阶段确认） |

---

## AC → DD 映射（设计决策覆盖）

| AC | 覆盖的 DD |
|----|-----------|
| AC-1 | DD-1（删除方案）、DD-5（不变行为契约 P1/P2） |
| AC-2 | DD-1（删除方案）、DD-5（不变行为契约 invariant #2） |
| AC-3 | DD-1（删除方案）、DD-4（风险评估） |
| AC-4 | DD-2（ConfigData 规则约束）、DD-3（激活路径保障） |

**覆盖完整性**：AC-1..AC-4 全部被 DD 覆盖，无悬空 AC。✅

---

## TASK → File 映射

| TASK | 文件 | 操作 | 行影响 |
|------|------|------|--------|
| TASK-1 | `fj-backend/fj-api/src/main/resources/application-prod.yml` | delete | 删除第 7-8 行（`profiles:` / `active: prod`） |

**文件清单完整性**：仅 1 个文件受影响，与 requirements.md「变更范围」一致。✅

---

## 覆盖率统计

| 维度 | 覆盖数 | 总数 | 覆盖率 |
|------|--------|------|--------|
| AC → TASK | 4 | 4 | 100% |
| AC → DD | 4 | 4 | 100% |
| TASK → File | 1 | 1 | 100% |

**结论**：trace_delta 完整，无未覆盖的验收标准，无未追溯的任务，无游离文件。状态 = **complete**。
