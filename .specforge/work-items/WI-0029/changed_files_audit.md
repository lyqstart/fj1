# Changed Files Audit

Work Item: WI-0029
Command: Backend log endpoint + frontend flush connection + Release build
Timestamp: 2026-07-06T10:29:16.447Z
Data Source: debug_hint.actual_changed_files (deprecated fallback; not a trusted Runtime source)
Policy Source: hard_stop_resolution.jsonl (1) + write_guard_authorizations.jsonl (28)

## Result: PASS

- Total files: 6
- In scope: 6
- Out of scope: 0
- Violations: 0
- Remote ops entries: 0
- Blocked write attempts: 3
- Historical/resolved blocked write attempts: 3
- Authorization-resolved blocked write attempts: 0
- Unresolved blocked write attempts: 0

## Remote Ops Entries

None.

## Blocked Write Attempts

- Total blocked write attempts: 3
- Historical/resolved: 3
- Authorization-resolved: 0
- Unresolved: 0
- Hard stop resolutions: 1
- Project-level write_guard authorizations: 28

### Historical / Resolved Blocked Writes

- [modify] /root/.gradle/gradle.properties → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [modify] /build/build-wi29.log → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [delete] fjw29 → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)

### Unresolved Blocked Writes

None.

## Entries

- [modify] fj-backend/fj-common/src/main/java/com/fj/common/applog/dto/LogEntryDTO.java → in_scope
- [modify] fj-backend/fj-common/src/main/java/com/fj/common/applog/dto/LogBatchRequest.java → in_scope
- [modify] fj-backend/fj-common/src/main/java/com/fj/common/applog/AppLogService.java → in_scope
- [modify] fj-backend/fj-common/src/main/java/com/fj/common/applog/AppLogController.java → in_scope
- [modify] fj-backend/fj-api/src/main/java/com/fj/api/config/SecurityConfig.java → in_scope
- [modify] fj-android/src/utils/Logger.ts → in_scope
