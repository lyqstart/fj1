---
requirements_format: ears
work_item_id: WI-0021
workflow_type: feature_spec
workflow_path: requirement_change_path
date: 2026-07-05
title: App 增强：Token 刷新 + HTTPS + UI Theme（Candidate）
target_path: .specforge/project/modules/core/requirements.md
operation: append
base_spec_version: PSV-0008
---

# Requirements Candidate — WI-0021 App 增强（Token 刷新 + HTTPS + UI Theme）

> 本文件为 Requirements Candidate（§8.2），拟追加写入正式规格真相源 `core/requirements.md`。
> 仅描述"做什么"与"验收什么"，不涉及架构选型与实现细节（属 sf-design 职责）。
> 具体刷新策略（单飞/定时器机制）、network_security_config 的 XML 结构、Theme 常量的组织方式均由 sf-design 决策。

## 简介

本规格为飞检安卓端 `fj-android` 增加三项横切增强：

1. **Token 定时刷新** — 在 accessToken 即将过期时，App 自动使用 refreshToken 在后台完成刷新，避免业务操作中遭遇 401 中断或被迫重新登录。
2. **HTTPS + Network Security Config** — 启用 HTTPS 通信，并通过 Android `network_security_config.xml` 显式声明域名信任策略；过渡期允许对白名单域名明文回退。
3. **UI Theme 统一设计令牌** — 定义集中式的 colors / spacing / typography 常量集合，供屏幕统一引用，消除各页面风格割裂。

**前置事实（仅供设计参考，不作为需求约束）**：
- intake 明确约束：不改变现有 API 端点；Token 刷新失败时沿用既有 logout 逻辑；HTTPS 允许明文 fallback（过渡期）。
- 影响分析列出受影响文件：`src/api/ApiClient.ts`、`src/store/auth/AuthContext.tsx`、`network_security_config.xml`（新建）、`AndroidManifest.xml`、`src/theme/**`（新建）。具体改动方式由 sf-design 决策。
- 变更分类标注：Token 刷新为中风险（并发竞态），HTTPS 与 UI 为低风险。竞态如何在需求侧表达？——以"至多发起一次刷新调用"的可观测行为约束体现，具体实现（单飞模式等）属设计决策。

## 术语表

| 术语 | 定义 |
|------|------|
| accessToken | 用于 API 调用的短期访问令牌，存在有效期，过期后需刷新。 |
| refreshToken | 用于换取新 accessToken 的长期凭证，有效期长于 accessToken。 |
| token 刷新 | 使用 refreshToken 向刷新端点换取新的 accessToken 的过程。 |
| 剩余有效期 | 当前 accessToken 距离过期还剩的时间。 |
| network_security_config | Android 的网络安全配置机制，通过 XML 声明域名的信任策略、是否允许明文流量。 |
| cleartext fallback | 过渡期内对显式声明白名单域名允许明文（HTTP）通信的回退策略。 |
| Theme 设计令牌 | 集中定义的可复用视觉常量（配色/间距/字体），供屏幕统一引用。本规格仅约束其"存在并被引用"，具体令牌值与组织结构属 sf-design 决策。 |
| barrel export | 将多个模块的导出聚合到单一入口文件统一导出的组织方式。 |
| tsc --noEmit | TypeScript 类型检查模式，仅校验类型不产出 JS。 |
| BUILD SUCCESSFUL | Gradle 构建成功标志，对应退出码 0。 |

## 需求

### REQ-1 Token 定时刷新

**用户故事**：作为飞检安卓 App 的最终用户，我希望 accessToken 即将过期时 App 自动使用 refreshToken 在后台完成刷新，以便我在连续操作过程中不会因 token 过期遭遇 401 中断或被迫重新登录。

**验收标准**：

1. [State-driven] WHILE 当前 accessToken 的剩余有效期 < `<token_refresh_threshold_minutes: 5>` 分钟（可配置），THE 系统 SHALL 自动使用 refreshToken 发起一次 token 刷新，并在刷新成功后用新 accessToken 替换内存中的旧令牌供后续请求使用。
2. [Unwanted-behavior] IF 多个请求或定时器在同一窗口期内同时检测到 token 需要刷新，THEN THE 系统 SHALL 至多向刷新端点发起一次实际的 refreshToken 调用，其余调用者复用同一次刷新结果。
3. [Unwanted-behavior] IF token 刷新请求失败（网络错误 / refreshToken 无效 / 服务端 4xx 或 5xx），THEN THE 系统 SHALL 触发既有 logout 流程清除本地凭证并跳转登录页（约束：不改变现有 logout 逻辑）。

**优先级**：Must

**依赖**：无（本 WI 起点；依赖既有 AuthContext 与 refresh 端点，不新增端点）

---

### REQ-2 HTTPS + Network Security Config

**用户故事**：作为飞检安卓 App 用户与运维人员，我希望 App 与后端的网络通信启用 HTTPS，以便传输的认证凭证与业务数据不被明文窃听或篡改。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 新建 `android/app/src/main/res/xml/network_security_config.xml`，为后端域名配置明确的信任策略，至少包含一个 `<domain-config>` 条目声明受信任域名。
2. [Ubiquitous] THE 系统 SHALL 在 `android/app/src/main/AndroidManifest.xml` 的 `<application>` 元素上设置 `android:networkSecurityConfig` 属性，引用上述 XML 资源。
3. [State-driven] WHILE HTTPS 尚处于过渡启用期，THE 系统 SHALL 允许对显式声明的白名单域名（`<cleartext_fallback_domains: []>`，可配置）设置明文通信回退，且该回退仅对声明白名单域名生效（约束：明文 fallback 仅限过渡期白名单）。

**优先级**：Must

**依赖**：无

---

### REQ-3 UI Theme 统一设计令牌

**用户故事**：作为飞检安卓 App 用户，我希望 App 的配色、间距、字体在不同屏幕间保持一致，以便获得统一的视觉体验，而不出现各页面风格割裂。

**验收标准**：

1. [Ubiquitous] THE 系统 SHALL 定义集中式的 Theme 常量集合，至少覆盖三个维度：colors（配色）、spacing（间距）、typography（字体/字号），并通过统一入口导出供屏幕引用。
2. [Ubiquitous] THE 系统 SHALL 确保 Theme 常量被 ≥ `<min_theme_referencing_screens: 3>` 个（可配置）屏幕文件引用。
3. [Unwanted-behavior] IF Theme 常量缺失或被引用时键名错误，THEN THE 系统 SHALL 在 TypeScript 类型检查阶段暴露错误（即采用类型安全的常量导出，禁止以裸字符串字面量散落各处）。

**优先级**：Should

**依赖**：无

---

## 全局验证基线

以下验证标准适用于本 WI 全部需求，作为合并/验证阶段的共享基线（非独立 REQ）：

- [Event-driven] WHEN 在 `fj-android` 工程执行 `npx tsc --noEmit`，THE 系统 SHALL 以退出码 `0` 完成。
- [Event-driven] WHEN 在 Docker 容器（镜像 `fj-builder:react-native-0.74`）内执行 `./gradlew assembleDebug`，THE 系统 SHALL 以退出码 `0` 完成（输出 `BUILD SUCCESSFUL`）。

## 非目标（Out of Scope）

以下事项**不属于**本 WI 范围，如有需要应另立 WI：

1. **新增/修改 API 端点** — intake 约束"不改变现有 API 端点"，刷新逻辑复用既有端点。
2. **修改既有 logout 逻辑** — 刷新失败时直接复用现有 logout 流程。
3. **全量强制 HTTPS（无 fallback）** — 过渡期保留白名单明文回退；移除 fallback 属后续 WI。
4. **全量重构现有屏幕样式** — Theme 引用为可选渐进式，仅要求 ≥ 3 屏幕引用（约束），不强制一次性重构所有屏幕。
5. **运行时 E2E 验证** — 真实 HTTPS 握手、token 刷新时序的运行时验证留给后续质量 WI；本 WI 以类型检查 + Docker 构建为基线。
6. **单飞（single-flight）/ 定时器算法选型** — 属 sf-design 决策，本规格仅以"至多一次刷新调用"的可观测行为约束表达。

## 配置点清单

| 配置项 | 默认值 | 位置 | 说明 |
|--------|--------|------|------|
| `token_refresh_threshold_minutes` | 5 | REQ-1.1 | 触发 token 自动刷新的剩余有效期阈值（分钟）。 |
| `cleartext_fallback_domains` | `[]`（空，需按实际后端域名声明） | REQ-2.3 | 过渡期允许明文回退的白名单域名列表。 |
| `min_theme_referencing_screens` | 3 | REQ-3.2 | Theme 常量被引用的最小屏幕数量阈值。 |

---

## 自检（Self-Check）

| # | 自问自答 | 答案 |
|---|---------|------|
| 1 | 是否有含"等"/"包括但不限于"的未拆分需求？ | 否。REQ-1（刷新）/REQ-2（HTTPS）/REQ-3（UI Theme）各自独立；每条 AC 点名具体文件、阈值、退出码。 |
| 2 | 每条 AC 是否含可测量值或可执行命令？ | 是。剩余有效期 < 5 分钟、至多一次刷新调用、≥ 1 个 domain-config、networkSecurityConfig 属性存在、≥ 3 屏幕引用、tsc 退出码 0、BUILD SUCCESSFUL。 |
| 3 | 是否避免编写设计/任务/代码内容？ | 是。未指定单飞/定时器实现、XML 具体结构、Theme 常量具体值与组织方式，均留给 sf-design；任务拆分留给 sf-task-planner。 |
| 4 | 是否覆盖 intake 全部 IN-SCOPE 项？ | 是。①Token 刷新 → REQ-1；②HTTPS + network_security_config → REQ-2；③UI Theme → REQ-3；④tsc + Docker 验证 → 全局验证基线。 |
| 5 | 模糊量词是否替换为可测量值？ | 是。"即将过期"→"< 5 分钟"；"多个并发"→"至多一次刷新调用"；"统一配色"→"≥ 3 屏幕引用 + 类型安全"。 |
| 6 | 是否声明 REQ 依赖与优先级？ | 是。REQ-1/REQ-2 为 Must，REQ-3 为 Should；无跨 REQ 强依赖。 |
| 7 | 是否标注约束（不改端点/沿用 logout/明文 fallback）？ | 是，REQ-1.AC3、REQ-2.AC3、非目标章节均与 intake 约束一致。 |
| 8 | 是否避免读取 host-profile.json / prod-environment.md？ | 是，全程未读取技术事实源。 |
| 9 | 竞态需求是否以可观测行为表达而非实现细节？ | 是，REQ-1.AC2 表达为"至多一次刷新调用"的行为约束，单飞模式留作设计决策。 |
