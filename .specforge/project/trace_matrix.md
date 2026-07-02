# Trace Delta: WI-0002

> 追溯矩阵：REQ → AC → DD → TASK → FILE → TEST / VERIFICATION_COMMAND
> 基于 requirements.candidate.md（30 REQ）+ design.candidate.md（19 DD）+ tasks.md（34 TASK）
> 覆盖率目标：100%（每个 REQ 都有 TASK 对应）

---

## 1. 追溯矩阵 — 修复需求 (REQ-FIX-001~011)

| REQ ID | AC 摘要 | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|---------|-------|---------|---------|---------|
| REQ-FIX-001 (G1 密码脱敏) | API 响应无 passwordHash | DD-FIX-001 | TASK-W02-013 | fj-system/dto/UserResponseDTO.java, UserResponseConverter.java, UserController.java, User.java | mvn compile fj-system; grep 无 passwordHash in DTO; Controller 引用 DTO |
| REQ-FIX-002 (G2 审计留痕) | 越权→ACCESS_DENIED 记录+链式哈希 | DD-FIX-002 | TASK-W02-014, TASK-W02-042 | fj-common/audit/aspect/OperationLogAspect.java, test/OperationLogAspectTest.java | mvn compile fj-common; grep AfterThrowing+ACCESS_DENIED; mvn test PASS |
| REQ-FIX-003 (G3 DD-9 联动) | 被引用→CORRECTED/未引用→VOIDED | DD-FIX-003 | TASK-W02-015, TASK-W02-041 | fj-common/port/IssueReferenceChecker.java, fj-report/service/ReportIssueReferenceChecker.java, ReportIssueSnapshotRepository.java, IssueReviewService.java, test/IssueReviewServiceTest.java | mvn compile fj-issue,fj-report; grep 端口接口+countByIssueId; mvn test PASS |
| REQ-FIX-004 (G4 照片快照) | photo_reference_snapshot 填充 | DD-FIX-004 | TASK-W02-016, TASK-W02-043 | fj-report/service/ReportSnapshotService.java, test/ReportSnapshotServiceTest.java | mvn compile fj-report; grep photoReferenceSnapshot+photoCount; mvn test PASS |
| REQ-FIX-005 (G5 hours 起算) | confirmedAt+hours 精确起算 | DD-FIX-005 | TASK-W02-017, TASK-W02-040 | fj-issue/service/RectificationDeadlineCalculator.java, test/RectificationDeadlineCalculatorTest.java | mvn compile fj-issue; Javadoc 含 confirmedAt; mvn test 3 场景 PASS |
| REQ-FIX-006 (G6 EnableJpa) | Repository bean 全注册 | DD-FIX-006 | TASK-W02-010 | fj-api/FjApplication.java | mvn compile fj-api; grep @EnableJpaRepositories+@EntityScan |
| REQ-FIX-007 (G7 BaseEntity) | 统一到 fj-common | DD-FIX-007 | TASK-W02-011 | fj-system/entity/BaseEntity.java（删除）, 各实体 import 修改 | mvn compile 全模块; grep "class BaseEntity" 仅 fj-common; 无残留 import |
| REQ-FIX-008 (G8 字段名) | projectId/project_id 双兼容 | DD-FIX-008 | TASK-W02-012 | fj-auth/rbac/ProjectAccessFilter.java | mvn compile fj-auth; grep projectId+project_id |
| REQ-FIX-009 (G9 SQLCipher 降级) | 文档化技术债 TD-ANDROID-001 | DD-FIX-009, DD-ANDROID-002 | TASK-W02-030 | fj-android/src/store/schema.ts | grep SQLCipher+TD-ANDROID+降级 |
| REQ-FIX-010 (G10 相机实现) | 拍照→压缩→SHA-256→上传 | DD-FIX-010, DD-ANDROID-001 | TASK-W02-031, TASK-W02-032 | fj-android/package.json, AndroidManifest.xml, build.gradle, services/VisionCameraPhotoService.ts, PhotoCapture.tsx | grep vision-camera+image-resizer in package.json; test -d node_modules; grep captureAndCompress+1920+sha256 |
| REQ-FIX-011 (G11 Word 模板) | poi-tl 真实模板+关闭 fallback | DD-FIX-011 | TASK-W02-020, TASK-W02-021 | fj-export/resources/templates/report_default_v1.docx, PoiTlExportEngine.java | test -f report_default_v1.docx; mvn compile fj-export; grep 5001 |

---

## 2. 追溯矩阵 — 部署需求 (REQ-DEPLOY-001~006)

| REQ ID | AC 摘要 | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|---------|-------|---------|---------|---------|
| REQ-DEPLOY-001 (PG16 安装) | PG16+scram+库用户 | DD-DEPLOY-005 | TASK-W02-001, TASK-W02-007 | scripts/ops/install_pg16.sh, scripts/ops/init_database.sh | bash -n; grep postgresql16-server+scram+FJ_DB_PASSWORD+fj_app+fj_inspect+GRANT |
| REQ-DEPLOY-002 (JRE17) | java-17-openjdk-headless | DD-DEPLOY-005 | TASK-W02-002 | scripts/ops/install_jre17.sh | bash -n; grep java-17-openjdk-headless+JAVA_HOME |
| REQ-DEPLOY-003 (systemd) | active+Xmx768m+重启 | DD-DEPLOY-002 | TASK-W02-004 | deploy/systemd/fj-api.service, deploy/config/.env.template | grep Xmx768m+Restart=on-failure+User=fj+JWT_SECRET |
| REQ-DEPLOY-004 (Nginx) | proxy+15m+SPA | DD-DEPLOY-003 | TASK-W02-005 | deploy/nginx/fj.conf | grep proxy_pass 8080+client_max_body_size 15m+try_files+internal |
| REQ-DEPLOY-005 (密钥零硬编码) | ${ENV_VAR} 占位无默认 | DD-DEPLOY-004 | TASK-W02-003 | deploy/config/application-prod.yml, fj-api/application-prod.yml, .gitignore | grep JWT_SECRET+template-fallback false; 无硬编码默认值 |
| REQ-DEPLOY-006 (本地构建+scp) | fat jar+scp+backup+回滚 | DD-DEPLOY-001 | TASK-W02-006, TASK-W02-050, TASK-W02-061, TASK-W02-063 | scripts/ops/deploy_backend.sh, rollback_backend.sh, docs/deployment_guide.md, docs/rollback_procedure.md | bash -n; grep mvn package+scp+backup; test jar; 回滚文档四场景 |

---

## 3. 追溯矩阵 — 运行时需求 (REQ-RUNTIME-001~004)

| REQ ID | AC 摘要 | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|---------|-------|---------|---------|---------|
| REQ-RUNTIME-001 (后端启动) | 60s 内启动+health UP | DD-5, §4.3 | TASK-W02-050, TASK-W02-051 | fj-api/target/fj-api-*.jar | mvn package exit=0; curl /actuator/health 返回 UP |
| REQ-RUNTIME-002 (Flyway) | V1~V7 全 success+28 表 | DD-7, §4.1 | TASK-W02-051 | db/migration/V1~V7*.sql | spring-boot:run + curl health; flyway_schema_history 全 success |
| REQ-RUNTIME-003 (种子数据) | 4 角色+20 权限+admin BCrypt | REQ-1, REQ-2 | TASK-W02-052 | db/migration/V2__seed_data.sql | 登录 API 返回 JWT; role=4 permission=20 |
| REQ-RUNTIME-004 (API 可访问) | 非 404+401+ApiResponse | DD-5 §5, REQ-1 | TASK-W02-053 | scripts/smoke_test_api.sh | curl 核心端点; 无 passwordHash; 未认证 401 |

---

## 4. 追溯矩阵 — Android 需求 (REQ-ANDROID-001~002)

| REQ ID | AC 摘要 | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|---------|-------|---------|---------|---------|
| REQ-ANDROID-001 (Debug Build) | app-debug.apk 生成+启动 | DD-ANDROID-003 | TASK-W02-031, TASK-W02-032, TASK-W02-033 | fj-android/package.json, AndroidManifest.xml, build.gradle, VisionCameraPhotoService.ts | grep minSdkVersion 28+targetSdkVersion 34; 依赖已装; Service 存在 |
| REQ-ANDROID-002 (离线作业) | 离线拍照→同步 | DD-FIX-009, DD-1 | TASK-W02-030, TASK-W02-032, TASK-W02-060 | fj-android/src/store/schema.ts, VisionCameraPhotoService.ts | grep SQLCipher 降级注释; grep captureAndCompress+sha256; E2E 清单 |

---

## 5. 追溯矩阵 — 测试需求 (REQ-TEST-001~002)

| REQ ID | AC 摘要 | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|---------|-------|---------|---------|---------|
| REQ-TEST-001 (核心 Service 单测) | 4 Service+正反用例 | DD-FIX-002~005 | TASK-W02-040, TASK-W02-041, TASK-W02-042, TASK-W02-043 | test/RectificationDeadlineCalculatorTest.java, test/IssueReviewServiceTest.java, test/OperationLogAspectTest.java, test/ReportSnapshotServiceTest.java | mvn test 各 -Dtest PASS; grep @Test 计数 |
| REQ-TEST-002 (关键 API 集成) | 登录+权限+日报+报告 | DD-5 | TASK-W02-053, TASK-W02-060 | scripts/smoke_test_api.sh, scripts/e2e_checklist.md | curl 冒烟; E2E 清单全通过 |

---

## 6. 追溯矩阵 — E2E 需求 (REQ-E2E-001)

| REQ ID | AC 摘要 | DD ID | TASK ID | 目标文件 | 验证方式 |
|--------|---------|-------|---------|---------|---------|
| REQ-E2E-001 (全流程 E2E) | 4 步链路全成功+Word 导出 | DD-9, §9.1 | TASK-W02-060, TASK-W02-061, TASK-W02-062 | scripts/e2e_checklist.md, docs/deployment_guide.md, scripts/smoke_test_remote.sh | test -f e2e_checklist; 部署指引完整; 远程冒烟脚本 |

---

## 7. 文件覆盖矩阵

| 文件 | 创建/修改/删除 | 涉及 REQ | 涉及 TASK |
|------|----------------|---------|-----------|
| scripts/ops/install_pg16.sh | 创建 | REQ-DEPLOY-001 | TASK-W02-001 |
| scripts/ops/install_jre17.sh | 创建 | REQ-DEPLOY-002 | TASK-W02-002 |
| scripts/ops/init_database.sh | 创建 | REQ-DEPLOY-001, REQ-RUNTIME-003 | TASK-W02-007 |
| scripts/ops/deploy_backend.sh | 创建 | REQ-DEPLOY-006 | TASK-W02-006 |
| scripts/ops/rollback_backend.sh | 创建 | REQ-DEPLOY-006, NFR-FIX-004 | TASK-W02-006, TASK-W02-063 |
| deploy/config/application-prod.yml | 创建 | REQ-DEPLOY-005 | TASK-W02-003 |
| deploy/config/.env.template | 创建 | REQ-DEPLOY-005 | TASK-W02-004 |
| deploy/systemd/fj-api.service | 创建 | REQ-DEPLOY-003 | TASK-W02-004 |
| deploy/nginx/fj.conf | 创建 | REQ-DEPLOY-004 | TASK-W02-005 |
| fj-backend/fj-api/.../FjApplication.java | 修改 | REQ-FIX-006 | TASK-W02-010 |
| fj-backend/fj-api/.../application-prod.yml | 修改 | REQ-DEPLOY-005 | TASK-W02-003 |
| fj-backend/fj-api/.../application.yml | 确认 | REQ-DEPLOY-005 | TASK-W02-003 |
| fj-backend/fj-common/.../BaseEntity.java | 保留(唯一) | REQ-FIX-007 | TASK-W02-011 |
| fj-backend/fj-system/.../BaseEntity.java | 删除 | REQ-FIX-007 | TASK-W02-011 |
| fj-backend/fj-system/.../entity/*.java | 修改 import | REQ-FIX-007 | TASK-W02-011 |
| fj-backend/fj-system/dto/UserResponseDTO.java | 创建 | REQ-FIX-001 | TASK-W02-013 |
| fj-backend/fj-system/dto/UserResponseConverter.java | 创建 | REQ-FIX-001 | TASK-W02-013 |
| fj-backend/fj-system/controller/UserController.java | 修改 | REQ-FIX-001 | TASK-W02-013 |
| fj-backend/fj-system/entity/User.java | 修改 | REQ-FIX-001 | TASK-W02-013 |
| fj-backend/fj-common/.../audit/aspect/OperationLogAspect.java | 修改 | REQ-FIX-002 | TASK-W02-014 |
| fj-backend/fj-common/.../port/IssueReferenceChecker.java | 创建 | REQ-FIX-003 | TASK-W02-015 |
| fj-backend/fj-report/.../service/ReportIssueReferenceChecker.java | 创建 | REQ-FIX-003 | TASK-W02-015 |
| fj-backend/fj-report/.../repository/ReportIssueSnapshotRepository.java | 修改 | REQ-FIX-003 | TASK-W02-015 |
| fj-backend/fj-issue/.../service/IssueReviewService.java | 修改 | REQ-FIX-003 | TASK-W02-015 |
| fj-backend/fj-report/.../service/ReportSnapshotService.java | 修改 | REQ-FIX-004 | TASK-W02-016 |
| fj-backend/fj-issue/.../service/RectificationDeadlineCalculator.java | 修改 | REQ-FIX-005 | TASK-W02-017 |
| fj-backend/fj-auth/.../rbac/ProjectAccessFilter.java | 修改 | REQ-FIX-008 | TASK-W02-012 |
| fj-backend/fj-export/.../templates/report_default_v1.docx | 创建 | REQ-FIX-011 | TASK-W02-020 |
| fj-backend/fj-export/.../service/PoiTlExportEngine.java | 修改 | REQ-FIX-011 | TASK-W02-021 |
| fj-backend/fj-issue/src/test/.../RectificationDeadlineCalculatorTest.java | 创建 | REQ-TEST-001, REQ-FIX-005 | TASK-W02-040 |
| fj-backend/fj-issue/src/test/.../IssueReviewServiceTest.java | 创建 | REQ-TEST-001, REQ-FIX-003 | TASK-W02-041 |
| fj-backend/fj-common/src/test/.../OperationLogAspectTest.java | 创建 | REQ-TEST-001, REQ-FIX-002 | TASK-W02-042 |
| fj-backend/fj-report/src/test/.../ReportSnapshotServiceTest.java | 创建 | REQ-TEST-001, REQ-FIX-004 | TASK-W02-043 |
| fj-android/src/store/schema.ts | 修改 | REQ-FIX-009 | TASK-W02-030 |
| fj-android/package.json | 修改 | REQ-FIX-010 | TASK-W02-031 |
| fj-android/android/app/src/main/AndroidManifest.xml | 创建/修改 | REQ-FIX-010 | TASK-W02-031 |
| fj-android/android/app/build.gradle | 创建/修改 | REQ-FIX-010, REQ-ANDROID-001 | TASK-W02-031, TASK-W02-033 |
| fj-android/src/services/VisionCameraPhotoService.ts | 创建 | REQ-FIX-010 | TASK-W02-032 |
| fj-android/src/components/photo/PhotoCapture.tsx | 修改 | REQ-FIX-010 | TASK-W02-032 |
| fj-android/src/screens/inspection/IssueEvidenceScreen.tsx | 修改 | REQ-FIX-010 | TASK-W02-032 |
| scripts/smoke_test_api.sh | 创建 | REQ-RUNTIME-004 | TASK-W02-053 |
| scripts/smoke_test_remote.sh | 创建 | REQ-RUNTIME-001, REQ-RUNTIME-004 | TASK-W02-062 |
| scripts/e2e_checklist.md | 创建 | REQ-E2E-001 | TASK-W02-060 |
| docs/deployment_guide.md | 创建 | REQ-DEPLOY-006 | TASK-W02-061 |
| docs/rollback_procedure.md | 创建 | REQ-DEPLOY-006, NFR-FIX-004 | TASK-W02-063 |
| .gitignore | 修改 | REQ-DEPLOY-005 | TASK-W02-003 |

---

## 8. 覆盖统计

| 指标 | 数值 |
|------|------|
| 总 REQ 数 | 30（11 FIX + 6 DEPLOY + 4 RUNTIME + 2 ANDROID + 2 TEST + 1 E2E + 4 NFR） |
| 总 AC 数 | 89（各 REQ 的验收标准汇总） |
| 已覆盖 REQ | 30 / 30 = 100% ✅ |
| 未覆盖 REQ | 0 |
| 总 DD 数 | 19（11 DD-FIX + 5 DD-DEPLOY + 3 DD-ANDROID） |
| 已覆盖 DD | 19 / 19 = 100% ✅ |
| 未覆盖 DD | 0 |
| 总 TASK 数 | 34 |
| 有明确目标文件的 TASK | 34 / 34 = 100% ✅ |
| 有验证方式的 TASK | 34 / 34 = 100% ✅ |
| 无悬空 REQ | ✅（每个 REQ 至少关联 1 个 TASK） |
| 无悬空 DD | ✅（每个 DD 至少关联 1 个 TASK） |
| 无悬空 TASK | ✅（每个 TASK 至少关联 1 个 REQ/DD） |
| Gap 覆盖 | 11/11 = 100% ✅ |

---

## 9. Gap → REQ → DD → TASK 专项追溯

| Gap | REQ | DD | TASK | 状态 |
|-----|-----|----|------|------|
| G1 密码脱敏 | REQ-FIX-001 | DD-FIX-001 | TASK-W02-013 | ✅ |
| G2 审计留痕 | REQ-FIX-002 | DD-FIX-002 | TASK-W02-014, TASK-W02-042 | ✅ |
| G3 DD-9 联动 | REQ-FIX-003 | DD-FIX-003 | TASK-W02-015, TASK-W02-041 | ✅ |
| G4 照片快照 | REQ-FIX-004 | DD-FIX-004 | TASK-W02-016, TASK-W02-043 | ✅ |
| G5 hours 起算 | REQ-FIX-005 | DD-FIX-005 | TASK-W02-017, TASK-W02-040 | ✅ |
| G6 EnableJpa | REQ-FIX-006 | DD-FIX-006 | TASK-W02-010 | ✅ |
| G7 BaseEntity | REQ-FIX-007 | DD-FIX-007 | TASK-W02-011 | ✅ |
| G8 字段名 | REQ-FIX-008 | DD-FIX-008 | TASK-W02-012 | ✅ |
| G9 SQLCipher 降级 | REQ-FIX-009 | DD-FIX-009, DD-ANDROID-002 | TASK-W02-030 | ✅ |
| G10 相机实现 | REQ-FIX-010 | DD-FIX-010, DD-ANDROID-001 | TASK-W02-031, TASK-W02-032 | ✅ |
| G11 Word 模板 | REQ-FIX-011 | DD-FIX-011 | TASK-W02-020, TASK-W02-021 | ✅ |

**11/11 Gap 全部覆盖，无遗漏。**

---

## 10. NFR 追溯

| NFR ID | 追溯 | 覆盖 TASK | 状态 |
|--------|------|-----------|------|
| NFR-FIX-001 (资源约束 3.6GB) | §4.3 | TASK-W02-004 (JVM Xmx768m), TASK-W02-062 (free -m 验证) | ✅ |
| NFR-FIX-002 (密钥零硬编码) | NFR-10, DD-4 | TASK-W02-003 (application-prod.yml) | ✅ |
| NFR-FIX-003 (可观测性日志) | §5.2, NFR-7 | TASK-W02-053 (trace_id 验证), TASK-W02-051 (启动日志) | ✅ |
| NFR-FIX-004 (可回滚性) | 变更分类 | TASK-W02-006, TASK-W02-063 (回滚脚本+文档) | ✅ |