# Changed Files Audit

Work Item: WI-0016
Command: WI-0016 implementation: AppNavigator integration + nested Stack + tsc + Docker build
Timestamp: 2026-07-05T08:19:21.874Z
Data Source: none
Policy Source: hard_stop_resolution.jsonl (2) + write_guard_authorizations.jsonl (5)

## Result: PASS

- Total files: 0
- In scope: 0
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
- Project-level write_guard authorizations: 5

### Historical / Resolved Blocked Writes

- [modify] /build/tsc-wi16.log → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=user_authorized_retry. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [delete] fj-tsc-wi16 → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=false_positive. The blocked attempt remains visible, but is not an unresolved audit violation.)
- [modify] /dev/null) → hard_stop_resolution_resolved (Blocked attempt has a structured hard_stop_resolution.jsonl entry with resolution_type=false_positive. The blocked attempt remains visible, but is not an unresolved audit violation.)

### Unresolved Blocked Writes

None.

## Entries

No project file changes detected.
