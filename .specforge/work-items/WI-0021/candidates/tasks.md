---
tasks_format: task_contract
work_item_id: WI-0021
workflow_type: feature_spec
workflow_path: requirement_change_path
date: 2026-07-05
title: App 增强：Token 刷新 + HTTPS + UI Theme 任务清单（Candidate）
target_path: .specforge/project/modules/core/tasks.md
operation: append
base_spec_version: PSV-0008
---

# Tasks Candidate — WI-0021 App 增强（Token 刷新 + HTTPS + UI Theme）

> 本文件为 Tasks Candidate（§8.2），拟追加写入正式规格真相源 `core/tasks.md`。
> 每个 TASK 是一个完整合同（§11 Task Contract），executor 独立执行无需回查 design.md。
> 代码实现由 sf-executor 负责；本文件仅定义"做什么 + 怎么验证"。

## 前置说明

- **Extension Registry 检查**：已读取 `.specforge/project/extension_registry.json`，`namespaces.task_types=[]`；本任务清单使用标准 `TASK-N` 格式，未引入新 task_type 命名空间，无需 extension_request。
- **配置文件状态**：`prod-environment.md` / `project-rules.md` 当前为 TODO 未填充（与 design Assumption #9 一致）；verification_commands 以全局验证基线（tsc + Docker gradle）为准。
- **设计偏差声明**：design DD-1 将 SingleFlightRefresh 设计为独立模块 `src/store/auth/SingleFlightRefresh.ts`；本任务清单按规划指令将其合并入 `src/api/ApiClient.ts`（单例从 ApiClient 模块导出），以减少文件数量。此偏差不影响 REQ-1.AC2"至多一次刷新调用"的行为约束——单飞去重语义保持不变，仅物理位置调整。

## 依赖拓扑

```
TASK-1 (ApiClient.ts: token检查+单飞) ──┐
                                        ├──> TASK-5 (tsc + Docker 验证)
TASK-2 (AuthContext.tsx: 定时器) ───────┤
   ↑ depends_on TASK-1                  │
TASK-3 (network_security_config.xml) ───┤
TASK-4 (src/theme/) ────────────────────┘
```

- **并行批次 1**（无依赖，可并行）：TASK-3, TASK-4
- **串行链**：TASK-1 → TASK-2（AuthContext 复用 ApiClient 导出的单飞实例，T5 共享代码先建）
- **汇聚点**：TASK-5 依赖 TASK-1/2/3/4 全部完成

---

### TASK-1 ApiClient.ts 添加 token 过期检查 + 单飞刷新逻辑

**context_block**（executor 必读）：
- **What**: 在 `src/api/ApiClient.ts` 中添加 token 过期检查函数 `isExpiringSoon(token, thresholdMin)` 和单飞刷新类 `SingleFlightRefresh`（模块级单例导出 `singleFlightRefresh`），并在请求拦截器中接入：发起业务请求前若剩余有效期 < 5min 则触发单飞刷新，刷新成功后将新 token 写入请求 header。
- **Why**: 实现 REQ-1.AC1（剩余有效期 < 5min 自动刷新）与 REQ-1.AC2（并发至多一次刷新调用）。单飞保证拦截器（TASK-1）与定时器（TASK-2）两路触发共享同一 in-flight Promise。
- **Refs**: DD-1（Token 刷新策略：单飞 + 定时器双重保护）；REQ-1.AC1, REQ-1.AC2, REQ-1.AC3
- **Constraints**:
  - 不引入新依赖（复用既有 axios/fetch 与既有 refresh 端点）
  - 不修改既有 logout 逻辑（刷新失败时调用 authContext.logout()，不重写）
  - 单飞锁必须在 `finally` 中清理 inflight（保证失败后可重试，P2 不变量）
  - 刷新请求超时 10s，不重试（refreshToken 失败多为凭证失效）
  - `isExpiringSoon` 容忍 ±30s 时钟漂移（宁可早刷）
  - token exp 解析需考虑 Asia/Shanghai 时区偏移（host-profile 约束）
  - 遵守 project-rules（当前 TODO，按既有 ApiClient.ts 风格匹配相邻代码）
- **Done When**:
  - `src/api/ApiClient.ts` 存在且导出 `singleFlightRefresh` 单例与 `isExpiringSoon` 函数
  - `isExpiringSoon(token, 5)` 在 remaining=4min59s 时返回 true，remaining=5min1s 时返回 false
  - 并发 N 次 `singleFlightRefresh.refresh()` 仅发起 1 次实际刷新 HTTP 调用（P1 不变量）
  - 刷新 reject 后 `inflight` 归 null，下次调用可重试（P2 不变量）
  - `npx tsc --noEmit` 退出码 0

- **依赖**: 无
- **depends_on**: []
- **refs**: [REQ-1.AC1, REQ-1.AC2, REQ-1.AC3, DD-1]
- **expected_file_changes**:
  - `src/api/ApiClient.ts`（修改）
- **read_files**: `src/api/ApiClient.ts`, `src/store/auth/AuthContext.tsx`（了解既有 logout/token 访问接口）
- **allowed_write_files**:
  - `src/api/ApiClient.ts`
- **forbidden_files**:
  - `.specforge/work-items/WI-0021/requirements.md`
  - `.specforge/work-items/WI-0021/design.md`
  - `.specforge/work-items/WI-0021/candidates/tasks.md`
  - `src/store/auth/AuthContext.tsx`（属 TASK-2）
  - `android/app/src/main/res/xml/network_security_config.xml`（属 TASK-3）
  - `src/theme/colors.ts`、`src/theme/spacing.ts`、`src/theme/typography.ts`、`src/theme/index.ts`（属 TASK-4）
- **out_of_scope**:
  - 不实现定时器（属 TASK-2）
  - 不修改 refresh 端点
  - 不重写 logout 逻辑
  - 不做运行时 E2E 验证

- **verification_commands**:
  - `test -f src/api/ApiClient.ts`（文件存在，期望 exit 0）
  - `grep -c "export const singleFlightRefresh" src/api/ApiClient.ts`（单例导出存在，期望 ≥1）
  - `grep -c "isExpiringSoon" src/api/ApiClient.ts`（函数定义存在，期望 ≥1）
  - `grep -c "finally" src/api/ApiClient.ts`（finally 清理存在，期望 ≥1）
  - `npx tsc --noEmit`（类型检查，期望退出码 0）

- **verification_evidence_expected**:
  - 文件存在性检查通过（exit 0）
  - grep 计数 ≥1（exit 0）
  - tsc 退出码 0，输出无 TS2339/TS2304 错误
  - evidence_type: test_output + type_check

---

### TASK-2 AuthContext.tsx 添加定时刷新（每 10 分钟）+ refreshAccessToken 方法

**context_block**（executor 必读）：
- **What**: 在 `src/store/auth/AuthContext.tsx` 中：①添加 `refreshAccessToken()` 方法，内部委托给 TASK-1 导出的 `singleFlightRefresh.refresh()` 单例；②在 AuthContext mount 时启动 `setInterval`（间隔 600000ms = 10min），每次 tick 检查当前 accessToken 剩余有效期 < 5min 则调用 `refreshAccessToken()`；③unmount 时 `clearInterval`。
- **Why**: 实现 DD-1 的"定时器主动触发"路径，与 TASK-1 的"拦截器被动触发"共享同一单飞实例，保证 REQ-1.AC2 在双路并发下仍至多一次刷新调用。
- **Refs**: DD-1（双重触发 + 共享单飞锁）；REQ-1.AC1, REQ-1.AC2, REQ-1.AC3
- **Constraints**:
  - 必须复用 TASK-1 的 `singleFlightRefresh` 单例（禁止重新实现单飞逻辑，T5 共享代码先建原则）
  - 定时器间隔固定 10min，使用 setInterval（非基于 Date.now 的递归 setTimeout，P4 不变量防漂移）
  - refreshAccessToken 失败时调用既有 `logout()`（不修改 logout）
  - 不引入新依赖
  - 遵守 project-rules（当前 TODO，匹配 AuthContext.tsx 既有 JSX/TS 风格）
- **Done When**:
  - `AuthContext.tsx` 存在 `refreshAccessToken` 方法
  - `AuthContext.tsx` 存在 `setInterval(..., 600000)` 定时器
  - `AuthContext.tsx` 存在 `clearInterval` 清理（防泄漏）
  - 定时器与拦截器并发触发时，refresh 端点调用计数 = 1（集成验证，P1）
  - `npx tsc --noEmit` 退出码 0

- **依赖**: TASK-1（AuthContext 需 import `singleFlightRefresh` from ApiClient）
- **depends_on**: [TASK-1]
- **refs**: [REQ-1.AC1, REQ-1.AC2, REQ-1.AC3, DD-1]
- **expected_file_changes**:
  - `src/store/auth/AuthContext.tsx`（修改）
- **read_files**: `src/store/auth/AuthContext.tsx`, `src/api/ApiClient.ts`（TASK-1 产出，确认 singleFlightRefresh 导出签名）
- **allowed_write_files**:
  - `src/store/auth/AuthContext.tsx`
- **forbidden_files**:
  - `.specforge/work-items/WI-0021/requirements.md`
  - `.specforge/work-items/WI-0021/design.md`
  - `.specforge/work-items/WI-0021/candidates/tasks.md`
  - `src/api/ApiClient.ts`（属 TASK-1，只读）
  - `android/**`（属 TASK-3）
  - `src/theme/**`（属 TASK-4）
- **out_of_scope**:
  - 不重新实现单飞逻辑（复用 TASK-1）
  - 不修改既有 logout
  - 不做运行时定时器时序 E2E 验证

- **verification_commands**:
  - `test -f src/store/auth/AuthContext.tsx`（文件存在，期望 exit 0）
  - `grep -c "refreshAccessToken" src/store/auth/AuthContext.tsx`（方法存在，期望 ≥1）
  - `grep -c "setInterval" src/store/auth/AuthContext.tsx`（定时器存在，期望 ≥1）
  - `grep -c "600000" src/store/auth/AuthContext.tsx`（间隔常量存在，期望 ≥1）
  - `grep -c "clearInterval" src/store/auth/AuthContext.tsx`（清理存在，期望 ≥1）
  - `grep -c "singleFlightRefresh" src/store/auth/AuthContext.tsx`（复用 TASK-1 单例，期望 ≥1）
  - `npx tsc --noEmit`（类型检查，期望退出码 0）

- **verification_evidence_expected**:
  - 文件存在性检查通过（exit 0）
  - 各 grep 计数 ≥1（exit 0）
  - tsc 退出码 0
  - evidence_type: test_output + type_check

---

### TASK-3 新建 network_security_config.xml + 修改 AndroidManifest.xml

**context_block**（executor 必读）：
- **What**: ①新建 `android/app/src/main/res/xml/network_security_config.xml`，包含 base-config（cleartextTrafficPermitted=false 默认禁明文）、domain-config（cleartextTrafficPermitted=true 允许 `129.211.5.240` 明文回退）、生产域名 domain-config（含 pin-set ≥2 公钥 + expiration）；②修改 `android/app/src/main/AndroidManifest.xml` 的 `<application>` 元素添加 `android:networkSecurityConfig="@xml/network_security_config"` 属性。
- **Why**: 实现 REQ-2（HTTPS + Network Security Config）：默认禁明文（安全基线 P5）、过渡期白名单 `129.211.5.240` 明文回退（intake 约束）、生产域名证书公钥 pin 防中间人（P7 容灾 ≥2 公钥）。
- **Refs**: DD-2（HTTPS network_security_config.xml：明文白名单 + 证书公钥 pin）；REQ-2.AC1, REQ-2.AC2, REQ-2.AC3
- **Constraints**:
  - XML 必须符合 Android network security config schema（API 24+）
  - `129.211.5.240` 的 domain-config 必须 `includeSubdomains="false"`（P6 白名单最小化）
  - pin-set 必须含 ≥ 2 个公钥（主 + 备份，P7 容灾）
  - pin-set 必须有 `expiration` 属性（证书轮换容灾）
  - 互斥规则：同一域名不得同时出现在 cleartext 白名单与 pin-set 中
  - AndroidManifest 只新增 `android:networkSecurityConfig` 属性，不改动其他属性（最小改动）
  - 占位公钥哈希（`productionPublicKeyHash` / `backupPublicKeyHash`）由运维后续替换为真实 SHA-256；本任务保留占位并加 TODO 注释
- **Done When**:
  - `android/app/src/main/res/xml/network_security_config.xml` 存在
  - XML 含 `<base-config cleartextTrafficPermitted="false">`
  - XML 含 `<domain-config cleartextTrafficPermitted="true">` 且 domain 为 `129.211.5.240`
  - XML 含 `<pin-set` 且至少 2 个 `<pin` 元素
  - AndroidManifest.xml 的 `<application` 元素含 `android:networkSecurityConfig="@xml/network_security_config"`
  - Docker `./gradlew assembleDebug` 输出 `BUILD SUCCESSFUL`（XML 资源编译通过，由 TASK-5 统一执行）

- **依赖**: 无（与 TASK-1/2/4 独立，可并行）
- **depends_on**: []
- **refs**: [REQ-2.AC1, REQ-2.AC2, REQ-2.AC3, DD-2]
- **expected_file_changes**:
  - `android/app/src/main/res/xml/network_security_config.xml`（新建）
  - `android/app/src/main/AndroidManifest.xml`（修改）
- **read_files**: `android/app/src/main/AndroidManifest.xml`（了解既有 `<application>` 元素结构）
- **allowed_write_files**:
  - `android/app/src/main/res/xml/network_security_config.xml`
  - `android/app/src/main/AndroidManifest.xml`
- **forbidden_files**:
  - `.specforge/work-items/WI-0021/requirements.md`
  - `.specforge/work-items/WI-0021/design.md`
  - `.specforge/work-items/WI-0021/candidates/tasks.md`
  - `src/api/ApiClient.ts`（属 TASK-1）
  - `src/store/auth/AuthContext.tsx`（属 TASK-2）
  - `src/theme/**`（属 TASK-4）
- **out_of_scope**:
  - 不替换占位公钥哈希为真实值（运维职责）
  - 不移除过渡期明文回退（属后续 WI）
  - 不修改其他 AndroidManifest 属性

- **verification_commands**:
  - `test -f android/app/src/main/res/xml/network_security_config.xml`（文件存在，期望 exit 0）
  - `grep -c 'cleartextTrafficPermitted="false"' android/app/src/main/res/xml/network_security_config.xml`（默认禁明文，期望 ≥1）
  - `grep -c "129.211.5.240" android/app/src/main/res/xml/network_security_config.xml`（白名单域名，期望 ≥1）
  - `grep -c "<pin" android/app/src/main/res/xml/network_security_config.xml`（pin 元素，期望 ≥2）
  - `grep -c "networkSecurityConfig" android/app/src/main/AndroidManifest.xml`（Manifest 引用，期望 ≥1）
  - 注：Docker `./gradlew assembleDebug` BUILD SUCCESSFUL 验证由 TASK-5 统一执行

- **verification_evidence_expected**:
  - 文件存在性检查通过（exit 0）
  - base-config cleartext=false 计数 ≥1
  - 白名单域名计数 ≥1
  - pin 元素计数 ≥2
  - Manifest networkSecurityConfig 属性计数 ≥1
  - evidence_type: file_check +（Docker 构建验证见 TASK-5）

---

### TASK-4 新建 src/theme/ 目录（colors.ts / spacing.ts / typography.ts / index.ts）

**context_block**（executor 必读）：
- **What**: 新建 `src/theme/` 目录及 4 个文件：①`colors.ts`（primary/danger/success/background/white 五色，`as const` + ColorKey/ColorValue 类型导出）；②`spacing.ts`（xs/sm/md/lg/xl/xxl 六档间距，值 `[4,8,12,16,24,32]` 严格递增，`as const`）；③`typography.ts`（fontSize: caption/body/title/subtitle/headline `[12,14,16,18,24]` 递增；fontWeight: regular/medium/semibold/bold `[400,500,600,700]`，`as const`）；④`index.ts`（barrel export 聚合三模块）。
- **Why**: 实现 REQ-3（UI Theme 统一设计令牌）：集中式常量覆盖 colors/spacing/typography 三维度（AC1），barrel 统一入口（AC1），`as const` 类型安全使键名错误在 tsc 编译期暴露（AC3）。
- **Refs**: DD-3（Theme 设计令牌：colors/spacing/typography + barrel export）；REQ-3.AC1, REQ-3.AC2, REQ-3.AC3
- **Constraints**:
  - 所有常量必须 `as const` 冻结（P12 类型封闭）
  - spacing 值严格递增 `[4,8,12,16,24,32]`（P10）
  - fontSize 值严格递增 `[12,14,16,18,24]`（P11）
  - colors 键集合恰好为 `['primary','danger','success','background','white']`（P9）
  - 不引入 ThemeProvider / Context 抽象（DD-3 YAGNI，1 消费模式不抽象）
  - 不引入新依赖
  - 遵守 project-rules（当前 TODO，TypeScript strict 模式）
  - REQ-3.AC2 要求 ≥3 屏幕引用 Theme：本任务仅创建常量，屏幕引用属后续渐进式（非目标，见 Out of Scope）
- **Done When**:
  - `src/theme/colors.ts` 存在且导出 `colors` 常量（5 个键）
  - `src/theme/spacing.ts` 存在且导出 `spacing` 常量（6 个键，值递增）
  - `src/theme/typography.ts` 存在且导出 `typography` 常量（fontSize 5 键 + fontWeight 4 键）
  - `src/theme/index.ts` 存在且 barrel export 三模块
  - 所有导出含 `as const`
  - `npx tsc --noEmit` 退出码 0（类型安全 P12）

- **依赖**: 无（与 TASK-1/2/3 独立，可并行）
- **depends_on**: []
- **refs**: [REQ-3.AC1, REQ-3.AC2, REQ-3.AC3, DD-3]
- **expected_file_changes**:
  - `src/theme/colors.ts`（新建）
  - `src/theme/spacing.ts`（新建）
  - `src/theme/typography.ts`（新建）
  - `src/theme/index.ts`（新建）
- **read_files**: `tsconfig.json`（可选，确认 strict 模式）
- **allowed_write_files**:
  - `src/theme/colors.ts`
  - `src/theme/spacing.ts`
  - `src/theme/typography.ts`
  - `src/theme/index.ts`
- **forbidden_files**:
  - `.specforge/work-items/WI-0021/requirements.md`
  - `.specforge/work-items/WI-0021/design.md`
  - `.specforge/work-items/WI-0021/candidates/tasks.md`
  - `src/api/ApiClient.ts`（属 TASK-1）
  - `src/store/auth/AuthContext.tsx`（属 TASK-2）
  - `android/**`（属 TASK-3）
- **out_of_scope**:
  - 不创建 ThemeProvider / Context（DD-3 YAGNI）
  - 不重构现有屏幕样式引用（REQ-3.AC2 ≥3 屏幕引用为渐进式，属后续）
  - 不做暗色模式 / 运行时主题切换

- **verification_commands**:
  - `test -f src/theme/colors.ts`（文件存在，期望 exit 0）
  - `test -f src/theme/spacing.ts`（文件存在，期望 exit 0）
  - `test -f src/theme/typography.ts`（文件存在，期望 exit 0）
  - `test -f src/theme/index.ts`（文件存在，期望 exit 0）
  - `grep -c "as const" src/theme/colors.ts`（类型冻结，期望 ≥1）
  - `grep -c "as const" src/theme/spacing.ts`（类型冻结，期望 ≥1）
  - `grep -c "as const" src/theme/typography.ts`（类型冻结，期望 ≥1）
  - `grep -c "export" src/theme/index.ts`（barrel 导出，期望 ≥3）
  - `npx tsc --noEmit`（类型检查，期望退出码 0）

- **verification_evidence_expected**:
  - 4 个文件存在性检查通过（exit 0）
  - 各 as const 计数 ≥1
  - index.ts export 计数 ≥3
  - tsc 退出码 0
  - evidence_type: file_check + type_check

---

### TASK-5 tsc + Docker BUILD SUCCESSFUL 验证（全局基线）

**context_block**（executor 必读）：
- **What**: 在 TASK-1/2/3/4 全部完成后，执行两项全局验证基线命令并采集证据：①`npx tsc --noEmit`（TypeScript 类型检查）；②Docker 容器内 `./gradlew assembleDebug`（Android 资源编译 + 打包）。
- **Why**: 实现全局验证基线（requirements.md "全局验证基线"段）：tsc 覆盖 REQ-3.AC3 类型安全 + 全部 TS 改动；Docker BUILD SUCCESSFUL 覆盖 REQ-2 network_security_config.xml 资源编译 + AndroidManifest 引用合法性。
- **Refs**: 全局验证基线（requirements.md）；REQ-2.AC1/AC2（gradle 覆盖）、REQ-3.AC3（tsc 覆盖）、REQ-1（TS 改动覆盖）
- **Constraints**:
  - 本任务**不修改任何源码文件**（纯验证任务，allowed_write_files 为空）
  - tsc 必须在项目根（含 tsconfig.json）执行
  - Docker 必须使用镜像 `fj-builder:react-native-0.74`（host-profile 约束）
  - 若验证失败，不得自行修复代码（报告失败，回到对应 TASK 修复）
  - Docker 容器需挂载项目目录至 `/build`（host-path prefix `/mnt/1t_back/project/fj1`）
- **Done When**:
  - `npx tsc --noEmit` 退出码 0
  - Docker `./gradlew assembleDebug` 输出含 `BUILD SUCCESSFUL` 且退出码 0

- **依赖**: TASK-1, TASK-2, TASK-3, TASK-4（汇聚验证点）
- **depends_on**: [TASK-1, TASK-2, TASK-3, TASK-4]
- **refs**: [REQ-1, REQ-2.AC1, REQ-2.AC2, REQ-3.AC3, 全局验证基线]
- **expected_file_changes**: 无（纯验证）
- **read_files**: `tsconfig.json`（确认 tsc 配置）、`android/app/build.gradle`（确认 gradle 入口）
- **allowed_write_files**: []（不修改任何文件）
- **forbidden_files**:
  - `.specforge/work-items/WI-0021/**`（governance 产物，executor 禁写）
  - 所有源码文件（验证任务不改代码）
- **out_of_scope**:
  - 不修复验证失败的代码（回退到对应 TASK）
  - 不做运行时 E2E 验证（真实 HTTPS 握手、token 刷新时序留给后续质量 WI）
  - 不替换占位公钥哈希

- **verification_commands**:
  - `npx tsc --noEmit`（类型检查，期望退出码 0）
  - `docker run --rm -v /mnt/1t_back/project/fj1:/build -w /build fj-builder:react-native-0.74 ./gradlew assembleDebug`（期望输出 `BUILD SUCCESSFUL`，退出码 0）
  - 输出捕获：tsc stdout 末尾无 error 行；gradle stdout 含 `BUILD SUCCESSFUL`

- **verification_evidence_expected**:
  - tsc 命令退出码 0，stdout 无 `error TS` 行
  - docker gradle 命令退出码 0，stdout 含 `BUILD SUCCESSFUL` 字符串
  - evidence_type: build_output

---

## 执行批次建议

| 批次 | TASK | 说明 |
|------|------|------|
| 批次 1（并行） | TASK-3, TASK-4 | 无依赖，文件不重叠（android/ vs src/theme/），可同时分派两个 executor |
| 批次 2（串行） | TASK-1 → TASK-2 | TASK-2 依赖 TASK-1 的 singleFlightRefresh 导出（T5 共享代码先建） |
| 批次 3（汇聚） | TASK-5 | 依赖前 4 个 TASK 全部完成 |

## 合同完整性自检（§11 Task Contract）

| 检查项 | TASK-1 | TASK-2 | TASK-3 | TASK-4 | TASK-5 |
|--------|--------|--------|--------|--------|--------|
| refs 非空且引用存在 | ✅ REQ-1/DD-1 | ✅ REQ-1/DD-1 | ✅ REQ-2/DD-2 | ✅ REQ-3/DD-3 | ✅ REQ-1/2/3 |
| allowed_write_files 具体（无通配符） | ✅ ApiClient.ts | ✅ AuthContext.tsx | ✅ 2 具体文件 | ✅ 4 具体文件 | ✅ [] 验证任务 |
| forbidden_files 含规格文档 | ✅ | ✅ | ✅ | ✅ | ✅ |
| verification_commands 返回退出码 | ✅ | ✅ | ✅ | ✅ | ✅ |
| done_when 可机器验证 | ✅ | ✅ | ✅ | ✅ | ✅ |
| out_of_scope 明确 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 并行批次文件不重叠 | ✅ | ✅ | ✅ (android/) | ✅ (src/theme/) | N/A |
| depends_on 声明 | ✅ [] | ✅ [TASK-1] | ✅ [] | ✅ [] | ✅ [1,2,3,4] |

## 自检（Self-Check）

| # | 自问自答 | 答案 |
|---|---------|------|
| 1 | 每个 DD 都有对应的 task 覆盖吗？ | 是。DD-1→TASK-1/2，DD-2→TASK-3，DD-3→TASK-4，全局基线→TASK-5。 |
| 2 | 每个 task 的 context_block 是否充分（executor 不需回查 design.md）？ | 是。What/Why/Refs/Constraints/Done When 齐全。 |
| 3 | verification_commands 是否真能机器跑？ | 是。全部为 test/grep/tsc/docker，返回退出码。 |
| 4 | 并行批次内 task 是否互相独立？ | 是。批次1 TASK-3(android/) 与 TASK-4(src/theme/) 文件零重叠。 |
| 5 | 有没有共享代码需要先建独立 task？ | 是。singleFlightRefresh 在 TASK-1 建立，TASK-2 通过 depends_on 复用（T5）。 |
| 6 | 每 task 改动文件数/行数是否在区间？ | 是。TASK-1/2 单文件；TASK-3 2文件；TASK-4 4文件（同目录新建，可接受）；TASK-5 0文件。 |
| 7 | task 间 allowed_write_files 是否重叠？ | 否。无交集（T4 独立可执行）。 |
| 8 | 是否避免执行任务/编写代码实现？ | 是。仅规划，未写实现代码。 |
