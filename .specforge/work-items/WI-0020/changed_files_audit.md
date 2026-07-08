# Changed Files Audit

Work Item: WI-0020
Command: WI-0020 解除屏蔽 3/5 RN 模块 + 新架构启用
Timestamp: 2026-07-05T11:15:06.111Z
Data Source: debug_hint.actual_changed_files (deprecated fallback; not a trusted Runtime source)
Policy Source: hard_stop_resolution.jsonl (9) + write_guard_authorizations.jsonl (16)

## Result: PASS

- Total files: 3
- In scope: 3
- Out of scope: 0
- Violations: 0
- Remote ops entries: 0
- Blocked write attempts: 12
- Historical/resolved blocked write attempts: 12
- Authorization-resolved blocked write attempts: 1
- Unresolved blocked write attempts: 0

## Remote Ops Entries

None.

## Blocked Write Attempts

- Total blocked write attempts: 12
- Historical/resolved: 12
- Authorization-resolved: 1
- Unresolved: 0
- Hard stop resolutions: 9
- Project-level write_guard authorizations: 16

### Historical / Resolved Blocked Writes

- [delete] --mount → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [delete] fj-build-wi20 → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [delete] fj-build-wi20 → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [delete] $CID → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [delete] fj-android/fj-build-wi20 → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [delete] fj-android/fj-build-wi20b → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [delete] fj-android/fj-build-wi20 → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [delete] fj-android/fj-build-wi20b → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [delete] 44d11b64221d → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [create] fj-android/android/app/build/tmp/wi20-build.sh → write_guard_authorization_resolved (Blocked attempt is covered by project-level write_guard_authorizations.jsonl entry authorization_id=AUTH-1783248702764. The attempt remains visible, but this scoped authorization prevents it from being treated as unresolved.)
- [delete] wi20rb → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [delete] wi20rb → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)

### Unresolved Blocked Writes

None.

## Entries

- [modify] fj-android/react-native.config.js → in_scope
- [modify] fj-android/android/app/build.gradle → in_scope
- [modify] fj-android/android/gradle.properties → in_scope
