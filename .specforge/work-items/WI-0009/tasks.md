---
doc_type: tasks
schema_version: "1.0"
work_item_id: WI-0009
workflow_type: bugfix_spec
base_spec_version: current
---

# Tasks — WI-0009: 修复 application-prod.yml 非法 profile 声明

> Work Item: WI-0009
> Workflow Type: bugfix_spec
> 对应 Design: WI-0009 DD-1（删除 spring.profiles.active 声明）

## 任务总览

本次缺陷修复为**极简单文件变更**：删除 `application-prod.yml` 第 7-8 行非法声明。仅需 1 个 task。

| Task | 标题 | 修改文件数 | depends_on | 风险 |
|------|------|-----------|------------|------|
| TASK-1 | 删除 application-prod.yml 中的非法 spring.profiles.active 声明 | 1 | [] | 极低 |

---

## TASK-1 删除 application-prod.yml 中的非法 spring.profiles.active 声明

**目标**：移除 `application-prod.yml` 第 7-8 行（`profiles:` 与 `active: prod`），使该 profile-specific 资源符合 Spring Boot 3.2.5 ConfigData 规则，解除 `InvalidConfigDataPropertyException` 阻塞。

**对应验收标准**：AC-1, AC-2, AC-3, AC-4

**对应设计决策**：DD-1, DD-2, DD-5

### 修改内容

files_to_modify:
- `fj-backend/fj-api/src/main/resources/application-prod.yml`

**修改前（第 6-9 行）**：
```yaml
spring:
  profiles:
    active: prod
  datasource:
```

**修改后（第 6-8 行）**：
```yaml
spring:
  datasource:
```

**具体操作**：删除第 7 行 `  profiles:` 与第 8 行 `    active: prod` 共 2 行。保留第 6 行 `spring:` 键，使其下直接接原第 9 行 `  datasource:`（缩进 2 空格不变）。

### 任务属性

- **depends_on**: `[]`（无前置依赖）
- **parallel**: `false`（单文件单 task，无需并行）
- **destructive**: `false`（删除的是非法冗余声明，不破坏任何有效配置）
- **requires_user_confirmation**: `false`（修复方案已在 requirements.md 确认，属确定性修复）
- **estimated_complexity**: trivial（2 行删除）

### 验证命令（verification_commands）

修改完成后，依次执行以下验证：

1. **AC-1 静态检查：源文件不含 spring.profiles.active**
   ```bash
   # 预期：无输出（grep 返回非零退出码）
   grep -n "spring.profiles.active" fj-backend/fj-api/src/main/resources/application-prod.yml
   grep -n "profiles:" fj-backend/fj-api/src/main/resources/application-prod.yml
   ```

2. **AC-2 YAML 结构有效性检查**
   ```bash
   # 确认 spring: 下直接接 datasource:，缩进正确
   # 可用 python 校验 YAML 可解析且 spring.datasource.url 存在
   python3 -c "import yaml; d=yaml.safe_load(open('fj-backend/fj-api/src/main/resources/application-prod.yml')); assert d['spring']['datasource']['url']=='jdbc:postgresql://127.0.0.1:5432/fj_inspect'; assert 'profiles' not in d['spring']; print('YAML 结构有效')"
   ```

3. **AC-3 构建产物检查（可选，本地构建）**
   ```bash
   # 在 fj-backend 目录构建后检查 target/classes 副本
   # cd fj-backend && mvn package -DskipTests -q
   # 预期 target/classes/application-prod.yml 不含 spring.profiles.active
   grep -c "spring.profiles.active" fj-backend/fj-api/target/classes/application-prod.yml 2>/dev/null || echo "0"
   ```

4. **AC-4 主配置不变性检查**
   ```bash
   # 确认 application.yml 未被误改
   grep -n "SPRING_PROFILES_ACTIVE" fj-backend/fj-api/src/main/resources/application.yml
   # 预期输出第 13 行的合法激活入口
   ```

### 完成判据（Definition of Done）

- [x] application-prod.yml 第 7-8 行已删除
- [x] verification_commands 1-4 全部通过
- [x] application.yml 字节级未变
- [x] 其余 71 行配置字节级未变
