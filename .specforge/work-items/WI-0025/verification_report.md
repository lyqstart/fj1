# WI-0025 验证报告

## 范围
修复 Release APK bundle 加载崩溃（"Unable to load script"）

## Acceptance Criteria

### AC-1: build.gradle 添加 noCompress 配置
- 状态: PASS
- 证据: build.gradle L77-80 `androidResources { noCompress += ["bundle"] }`

### AC-2: Release APK BUILD SUCCESSFUL
- 状态: PASS
- 证据: build-wi25.log "BUILD SUCCESSFUL in 3m 24s", EXIT_CODE=0

### AC-3: bundle 以 Stored 方式存储
- 状态: PASS
- 证据: `unzip -lv` 显示 `1541060 Stored 1541060 0% assets/index.android.bundle`
- 对比修复前: `1537180 Defl:N 733208 52%`（压缩）

### AC-4: APK 大小合理
- 状态: PASS
- 证据: 55MB（修复前 54MB，增 1MB 因 bundle 未压缩）

## 验证结论
conclusion: pass

## 运行时验证（待用户确认）
用户需安装新 APK 到真机，确认 App 正常启动（不再崩溃）。