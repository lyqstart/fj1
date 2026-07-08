---
trace_format: specforge_trace_delta_v1
work_item_id: WI-0014
workflow_type: feature_spec
workflow_path: requirement_change_path
base_spec_version: PSV-0001
date: 2026-07-05
title: Trace Delta — WI-0014 Release 签名 + ProGuard/R8 混淆
---

# Trace Delta: WI-0014

> 追溯矩阵覆盖完整链：**REQ → AC → DD → TASK → FILE → TEST / VERIFICATION_COMMAND → EVIDENCE**
> 来源：
> - REQ/AC：`candidates/project/modules/core/requirements.candidate.md`（REQ-1..REQ-4，每 REQ 含 5-6 条 AC）
> - DD：`candidates/project/modules/core/design.candidate.md`（DD-1..DD-6；design 中隐式 REQ-5/6/7 映射到 DD-4/5/6）
> - TASK/FILE/TEST：`candidates/tasks.md`（TASK-1..TASK-7）

---

## 1. 完整追溯矩阵

| REQ ID | AC ID | AC 描述（节选） | DD ID | TASK ID | 目标文件 | 验证方式（TEST） | Evidence |
|--------|-------|----------------|-------|---------|---------|-----------------|----------|
| REQ-1 Release 签名配置 | REQ-1.1 | keystore RSA 2048 / 有效期 ≥ 10000 天 | DD-1 | TASK-1 | `fj-android/android/app/fj-release.keystore` | `keytool -list -v` 显示 RSA 2048 + 有效期 | keystore_metadata |
| REQ-1 | REQ-1.2 | keystore 含别名 `fj` | DD-1 | TASK-1 | `fj-android/android/app/fj-release.keystore` | `keytool -list -v \| grep "Alias name: fj"` | keystore_metadata |
| REQ-1 | REQ-1.3 | release 变体用 signingConfigs.release，不再用 debug | DD-2 | TASK-3 | `fj-android/android/app/build.gradle` | `grep "signingConfigs.release"` + release 块不引用 debug | file_content |
| REQ-1 | REQ-1.4 | signingConfigs.release 四要素全部指向 fj-release.keystore + 别名 fj | DD-1, DD-2 | TASK-1, TASK-3 | `fj-release.keystore` + `build.gradle` | `grep "storeFile file('fj-release.keystore')"` + `grep "keyAlias 'fj'"` | file_content |
| REQ-1 | REQ-1.5 | keystore 缺失时构建前置错误（不回退 debug） | DD-1, DD-2 | TASK-3, TASK-5 | `build.gradle`（hasProperty 守卫）+ TASK-5 前置检查 | `grep "FJ_RELEASE_STORE_PASSWORD"` hasProperty 守卫 + TASK-5 缺密码时 assembleRelease 失败 | build_log |
| REQ-2 ProGuard 混淆 + 资源压缩 | REQ-2.1 | release 启用 minifyEnabled true | DD-2 | TASK-3 | `build.gradle` | `grep "enableProguardInReleaseBuilds = true"` | file_content |
| REQ-2 | REQ-2.2 | release 启用 shrinkResources true | DD-2 | TASK-3 | `build.gradle` | `grep "shrinkResources true"` | file_content |
| REQ-2 | REQ-2.3 | proguardFiles 同时引用默认 + 项目级 | DD-2 | TASK-3 | `build.gradle` | `grep "getDefaultProguardFile(\"proguard-android.txt\"), \"proguard-rules.pro\""` | file_content |
| REQ-2 | REQ-2.4a | -keep react-native-keychain（com.oblador.keychain.**） | DD-3 | TASK-4 | `proguard-rules.pro` | `grep "com.oblador.keychain"` | rule_coverage |
| REQ-2 | REQ-2.4b | -keep watermelondb（com.watermelon.db.**） | DD-3 | TASK-4 | `proguard-rules.pro` | `grep "com.watermelon.db"` | rule_coverage |
| REQ-2 | REQ-2.4c | -keep Hermes（com.facebook.hermes.**） | DD-3 | TASK-4 | `proguard-rules.pro` | `grep "com.facebook.hermes"` | rule_coverage |
| REQ-2 | REQ-2.4d | -keep OkHttp（okhttp3.**, okio.**） | DD-3 | TASK-4 | `proguard-rules.pro` | `grep "okhttp3"` + `grep "okio"` | rule_coverage |
| REQ-2 | REQ-2.4e | -keep RN 核心（com.facebook.react.**） | DD-3 | TASK-4 | `proguard-rules.pro` | `grep "com.facebook.react"` | rule_coverage |
| REQ-2 | REQ-2.4f | -keep MainApplication（com.fjandroid） | DD-3 | TASK-4 | `proguard-rules.pro` | `grep "com.fjandroid.MainApplication"` | rule_coverage |
| REQ-2 | REQ-2.5 | 运行时 ClassNotFoundException 时补充 -keep | DD-3, DD-4 | TASK-4, TASK-5（重试） | `proguard-rules.pro` | TASK-5 构建成功 + mapping.txt 存在 | build_log + r8_mapping |
| REQ-2 | REQ-2.6 | JS bundle 不被资源移除 | DD-3（注释） | TASK-4（注释）+ TASK-5 | `proguard-rules.pro`（无 -keep，由 Gradle assets 自动保留） | TASK-5 产出 app-release.apk 含 `assets/index.android.bundle` | artifact_inspection |
| REQ-3 Release 构建产物验证 | REQ-3.1 | assembleRelease 退出码 0 | DD-4 | TASK-5 | `app-release.apk`（产物） | `docker logs \| grep "BUILD SUCCESSFUL"` + 容器 ExitCode=0 | build_log |
| REQ-3 | REQ-3.2 | 产出 app-release.apk | DD-4 | TASK-5 | `fj-android/android/app/build/outputs/apk/release/app-release.apk` | `test -f app-release.apk` + size > 1MB | artifact_existence + artifact_size |
| REQ-3 | REQ-3.3 | apksigner verify 通过 | DD-4 | TASK-6 | `app-release.apk`（只读验证） | `apksigner verify --verbose \| grep "Verifies"` | signature_verification |
| REQ-3 | REQ-3.4 | Release 体积 < Debug × 0.85（缩减 ≥ 15%） | DD-4 | TASK-6 | `app-release.apk` vs `app-debug.apk` | `stat -c%s` 比较或降级 < 100MB | artifact_size |
| REQ-3 | REQ-3.5 | aapt dump badging 报告包名 com.fjandroid | DD-4 | TASK-6 | `app-release.apk`（只读验证） | `aapt dump badging \| head -1 \| grep "package: name='com.fjandroid'"` | manifest_metadata |
| REQ-3 | REQ-3.6 | Release APK 启动后 keychain 登录不崩 | DD-3, DD-4 | TASK-4（-keep）+ TASK-6（降级）| mapping.txt 含 com.oblador.keychain.* | TASK-6 mapping.txt 存在 + 用户真机 E2E（降级） | r8_mapping + e2e_deferred |
| REQ-4 密钥安全 | REQ-4.1 | AI 生成密码 + 一次性交付用户 | DD-1, DD-6 | TASK-1, TASK-7 | 密码（不入仓库） | TASK-1 keytool 接受密码 + TASK-7 报告含部署说明（密码脱敏） | keystore_metadata + report |
| REQ-4 | REQ-4.2 | .gitignore 含 fj-release.keystore 路径 | DD-5 | TASK-2 | `.gitignore` | `git check-ignore -q fj-release.keystore` | git_state |
| REQ-4 | REQ-4.3 | keystore POSIX 权限 600 | DD-1 | TASK-1 | `fj-release.keystore` | `stat -c '%a' = 600` | file_permission |
| REQ-4 | REQ-4.4 | 密码通过 gradle.properties/env 注入 | DD-1, DD-2 | TASK-3（hasProperty）+ TASK-5（容器注入） | `build.gradle` + 容器 `~/.gradle/gradle.properties` | TASK-3 `grep FJ_RELEASE_STORE_PASSWORD` + TASK-5 容器写入 | file_content + build_log |
| REQ-4 | REQ-4.5 | build.gradle 无密码明文 | DD-2 | TASK-3 | `build.gradle` | `! grep -nE "storePassword ['\"](Fj@|changeit)"` | security_lint |
| REQ-4 | REQ-4.6 | 承载密码的 gradle.properties 被 .gitignore 排除（容器 home 目录本就不在仓库） | DD-1, DD-5 | TASK-2（仓库内 .gitignore）+ TASK-5（容器 home） | 容器 `/root/.gradle/gradle.properties`（不入仓库） | TASK-5 容器内写入 + 不存在于 `git ls-files` | git_state |

> design 中隐式 REQ 映射（来自 design 第 27-35 行追溯表）：REQ-5→DD-4、REQ-6→DD-5、REQ-7→DD-6。本表合并到 REQ-3/4 矩阵中（REQ-5 即 REQ-3 验证链、REQ-6 即 REQ-4.2、REQ-7 即 REQ-4.1 部署说明）。

---

## 2. 文件覆盖矩阵

| 文件 | 创建/修改/删除 | 涉及 REQ | 涉及 TASK | 涉及 DD |
|------|----------------|---------|-----------|---------|
| `fj-android/android/app/fj-release.keystore` | 创建（二进制） | REQ-1.1, REQ-1.2, REQ-4.1, REQ-4.3 | TASK-1 | DD-1 |
| `.gitignore` | 修改（追加 3 行） | REQ-4.2, REQ-4.6 | TASK-2 | DD-5 |
| `fj-android/android/app/build.gradle` | 修改（+8/-1/改3 行） | REQ-1.3, REQ-1.4, REQ-1.5, REQ-2.1, REQ-2.2, REQ-2.3, REQ-4.4, REQ-4.5 | TASK-3 | DD-2 |
| `fj-android/android/app/proguard-rules.pro` | 重写（替换空模板，+40 行） | REQ-2.3, REQ-2.4a-f, REQ-2.5, REQ-2.6, REQ-3.6 | TASK-4 | DD-3 |
| `fj-android/android/app/build/outputs/apk/release/app-release.apk` | 创建（构建产物） | REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4, REQ-3.5 | TASK-5（产出）+ TASK-6（验证） | DD-4 |
| `fj-android/android/app/build/outputs/mapping/release/mapping.txt` | 创建（R8 映射） | REQ-2.5, REQ-3.6 | TASK-5（产出）+ TASK-6（验证） | DD-3, DD-4 |
| 容器 `/root/.gradle/gradle.properties` | 创建（容器 home，不入仓库） | REQ-4.4, REQ-4.6 | TASK-5 | DD-1, DD-6 |
| `.specforge/work-items/WI-0014/candidates/verification_report.md` | 创建（验证报告） | REQ-3.1-3.5（证据汇总） | TASK-7 | DD-4, DD-6 |
| `.specforge/work-items/WI-0014/evidence_manifest.json` | 创建（证据清单） | REQ-3.1-3.5 | TASK-7 | DD-4 |

**不修改的文件（Out of Scope 显式声明）**：
- `fj-android/android/gradle.properties`（R8 默认行为已满足，DD-2 论证）
- `fj-android/android/app/src/**`（无 Java/Kotlin 源码改动，非目标 7）
- `package.json` / `node_modules`（无 JS 依赖改动，非目标 7）
- `fj-android/android/app/build.gradle` 的 `react {}` / `dependencies` / `defaultConfig`（DD-2 保持不变）
- `fj-android/android/app/debug.keystore`（非目标 6，debug 签名不变）

---

## 3. TASK 依赖图（DAG）

```
TASK-1 (keystore)  ─────┐
TASK-2 (.gitignore) ────┤   TASK-4 (proguard) ─────┐
                        ├─► TASK-3 (build.gradle) ─┤
                        │                          ├─► TASK-5 (docker assembleRelease) ─► TASK-6 (verify APK) ─┐
                        │                          │                                                            ├─► TASK-7 (tsc + report)
                        │                          │                                                            │
                        └──────────────────────────┴────────────────────────────────────────────────────────────┘
```

- **可并行批次 B1**：TASK-1 / TASK-2 / TASK-4（修改文件互不重叠）
- **批次 B2**：TASK-3（依赖 TASK-1 确认 alias/storeFile 一致）
- **批次 B3**：TASK-5（依赖 TASK-1 + TASK-3 + TASK-4）
- **批次 B4**：TASK-6（依赖 TASK-5）
- **批次 B5**：TASK-7（依赖 TASK-5 + TASK-6 汇总证据）
- **无循环依赖** ✅

---

## 4. 覆盖统计

| 维度 | 数量 | 覆盖情况 |
|------|------|----------|
| 总 REQ 数 | 4（requirements.md 显式）+ 3（design 隐式 REQ-5/6/7）= 7 | 7/7 覆盖 ✅ |
| 总 AC 数 | REQ-1(5) + REQ-2(6) + REQ-3(6) + REQ-4(6) = 23 | 23/23 覆盖 ✅ |
| 总 DD 数 | 6（DD-1..DD-6） | 6/6 覆盖 ✅ |
| 总 TASK 数 | 7（TASK-1..TASK-7） | 7/7 有明确目标文件 ✅ |
| 总目标文件数 | 9（含容器内 1 个 + 构建产物 2 个 + 报告 2 个 + 配置 4 个） | 9/9 有验证方式 ✅ |

**完整性断言**：
- ✅ 无悬空 REQ（每个 REQ 至少关联 1 个 AC + 1 个 TASK）
- ✅ 无悬空 AC（每个 AC 至少关联 1 个 TASK + 1 个验证命令）
- ✅ 无悬空 DD（DD-1→TASK-1, DD-2→TASK-3, DD-3→TASK-4, DD-4→TASK-5/6/7, DD-5→TASK-2, DD-6→TASK-7）
- ✅ 无悬空 TASK（每个 TASK 有 refs 到 REQ/DD + allowed_write_files 具体路径）
- ✅ 无未验证文件（每个目标文件至少 1 条 verification_command）

---

## 5. Self-Check（trace_delta 完整性）

| # | 自问自答 | 答案 |
|---|---------|------|
| 1 | 每个 REQ 是否至少关联一个 AC？ | ✅ REQ-1→5AC, REQ-2→6AC, REQ-3→6AC, REQ-4→6AC |
| 2 | 每个 AC 是否至少关联一个 TASK？ | ✅ 见完整追溯矩阵 23 行 |
| 3 | 每个 DD 是否至少关联一个 TASK？ | ✅ DD-1→TASK-1, DD-2→TASK-3, DD-3→TASK-4, DD-4→TASK-5/6/7, DD-5→TASK-2, DD-6→TASK-7 |
| 4 | 每个 TASK 是否有明确目标文件？ | ✅ 见文件覆盖矩阵 9 个目标文件 |
| 5 | 每个目标文件是否有验证方式？ | ✅ keystore→keytool, .gitignore→git check-ignore, build.gradle→grep, proguard→grep, apk→apksigner/aapt/stat, mapping→test, report→test, evidence→node JSON.parse |
| 6 | trace_delta.md 是否真实写入？ | ✅ 本文件已通过 sf_artifact_write 写入 `.specforge/work-items/WI-0014/trace_delta.md` |

---

## 6. 风险与降级

| 风险 | 降级方案 | 对应 TASK |
|------|----------|-----------|
| 容器内无 emulator 无法 E2E | TASK-6 降级为产物校验 + mapping.txt 证据，真机 E2E 由用户在 verification 阶段执行 | TASK-6 |
| Debug APK 不存在无法体积对比 | 降级断言 `release_size < 100MB`（Debug 基线 124MB，DD-4 论证） | TASK-6 |
| `tsc:check` script 不存在 | TASK-7 降级用 `npx tsc --noEmit -p /build` 并在报告标注 | TASK-7 |
| Write Guard 拦截 `-v host:container` | TASK-5 双策略：先试 `--mount type=bind`，失败则 sf_hard_stop_resolve 安装 write_guard_authorization | TASK-5 |
| sf_safe_bash 30s 超时 | TASK-5 强制 `docker run -d` + 日志轮询模式 | TASK-5 |
| watermelondb 实际包名与 design 假设不符 | TASK-5 构建失败时回查 TASK-4 -keep 规则包名（design Assumptions 8） | TASK-4 + TASK-5 |
