# Changed Files Audit

Work Item: WI-0025
Command: WI-0025 noCompress fix
Timestamp: 2026-07-05T17:32:01.840Z
Data Source: debug_hint.actual_changed_files (deprecated fallback; not a trusted Runtime source)
Policy Source: hard_stop_resolution.jsonl (2) + write_guard_authorizations.jsonl (24)

## Result: PASS

- Total files: 2
- In scope: 2
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
- Hard stop resolutions: 2
- Project-level write_guard authorizations: 24

### Historical / Resolved Blocked Writes

- [modify] /root/.gradle/gradle.properties → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [modify] /build/build-wi25.log → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [delete] fjw25 → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)

### Unresolved Blocked Writes

None.

## Entries

- [modify] fj-android/android/app/build.gradle → in_scope
- [modify] fj-android/android/app/build/outputs/apk/release/app-release.apk → in_scope
