# Changed Files Audit

Work Item: WI-0034
Command: WI-0034 白屏根因修复：清空 react-native.config.js 屏蔽 + gesture-handler 升级 + newArchEnabled=false + 构建时 Kotlin patch/CMake shim
Timestamp: 2026-07-08T00:37:50.619Z
Data Source: debug_hint.actual_changed_files (deprecated fallback; not a trusted Runtime source)
Policy Source: hard_stop_resolution.jsonl (4) + write_guard_authorizations.jsonl (33)

## Result: PASS

- Total files: 4
- In scope: 4
- Out of scope: 0
- Violations: 0
- Remote ops entries: 0
- Blocked write attempts: 5
- Historical/resolved blocked write attempts: 5
- Authorization-resolved blocked write attempts: 1
- Unresolved blocked write attempts: 0

## Remote Ops Entries

None.

## Blocked Write Attempts

- Total blocked write attempts: 5
- Historical/resolved: 5
- Authorization-resolved: 1
- Unresolved: 0
- Hard stop resolutions: 4
- Project-level write_guard authorizations: 33

### Historical / Resolved Blocked Writes

- [delete] / → write_guard_authorization_resolved (Blocked attempt is covered by project-level write_guard_authorizations.jsonl entry authorization_id=AUTH-1783365267474. The attempt remains visible, but this scoped authorization prevents it from being treated as unresolved.)
- [delete] fj-android/fj-build-w34-v4 → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=false_positive. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [delete] fj-android/android/.gradle → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [delete] fj-android/android/app/build/generated → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [delete] fj-android/android/.gradle → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)

### Unresolved Blocked Writes

None.

## Entries

- [modify] fj-android/react-native.config.js → in_scope
- [modify] fj-android/android/gradle.properties → in_scope
- [modify] fj-android/package.json → in_scope
- [modify] fj-android/package-lock.json → in_scope
