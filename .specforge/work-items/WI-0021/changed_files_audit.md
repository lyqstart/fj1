# Changed Files Audit

Work Item: WI-0021
Command: WI-0021 Token refresh + HTTPS + Theme
Timestamp: 2026-07-05T14:56:25.590Z
Data Source: debug_hint.actual_changed_files (deprecated fallback; not a trusted Runtime source)
Policy Source: hard_stop_resolution.jsonl (2) + write_guard_authorizations.jsonl (18)

## Result: PASS

- Total files: 9
- In scope: 9
- Out of scope: 0
- Violations: 0
- Remote ops entries: 0
- Blocked write attempts: 2
- Historical/resolved blocked write attempts: 2
- Authorization-resolved blocked write attempts: 0
- Unresolved blocked write attempts: 0

## Remote Ops Entries

None.

## Blocked Write Attempts

- Total blocked write attempts: 2
- Historical/resolved: 2
- Authorization-resolved: 0
- Unresolved: 0
- Hard stop resolutions: 2
- Project-level write_guard authorizations: 18

### Historical / Resolved Blocked Writes

- [delete] --mount → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [delete] fjw21 → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)

### Unresolved Blocked Writes

None.

## Entries

- [modify] fj-android/src/api/ApiClient.ts → in_scope
- [modify] fj-android/src/store/auth/AuthContext.tsx → in_scope
- [modify] fj-android/src/store/auth/types.ts → in_scope
- [modify] fj-android/android/app/src/main/res/xml/network_security_config.xml → in_scope
- [modify] fj-android/android/app/src/main/AndroidManifest.xml → in_scope
- [modify] fj-android/src/theme/colors.ts → in_scope
- [modify] fj-android/src/theme/spacing.ts → in_scope
- [modify] fj-android/src/theme/typography.ts → in_scope
- [modify] fj-android/src/theme/index.ts → in_scope
