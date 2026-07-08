# Changed Files Audit

Work Item: WI-0026
Command: Docker assembleRelease rebuild with fixed proguard-rules.pro
Timestamp: 2026-07-06T02:47:25.617Z
Data Source: debug_hint.actual_changed_files (deprecated fallback; not a trusted Runtime source)
Policy Source: hard_stop_resolution.jsonl (1) + write_guard_authorizations.jsonl (25)

## Result: PASS

- Total files: 1
- In scope: 1
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
- Project-level write_guard authorizations: 25

### Historical / Resolved Blocked Writes

- [modify] /root/.gradle/gradle.properties → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [modify] /build/build-wi26.log → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [delete] fjw26 → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)

### Unresolved Blocked Writes

None.

## Entries

- [modify] fj-android/android/app/proguard-rules.pro → in_scope
