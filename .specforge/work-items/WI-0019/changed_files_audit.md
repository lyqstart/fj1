# Changed Files Audit

Work Item: WI-0019
Command: scope_expanded to include ProfileScreen
Timestamp: 2026-07-05T09:12:59.856Z
Data Source: debug_hint.actual_changed_files (deprecated fallback; not a trusted Runtime source)
Policy Source: hard_stop_resolution.jsonl (0) + write_guard_authorizations.jsonl (9)

## Result: PASS

- Total files: 2
- In scope: 2
- Out of scope: 0
- Violations: 0
- Remote ops entries: 0
- Blocked write attempts: 1
- Historical/resolved blocked write attempts: 1
- Authorization-resolved blocked write attempts: 0
- Unresolved blocked write attempts: 0

## Remote Ops Entries

None.

## Blocked Write Attempts

- Total blocked write attempts: 1
- Historical/resolved: 1
- Authorization-resolved: 0
- Unresolved: 0
- Hard stop resolutions: 0
- Project-level write_guard authorizations: 9

### Historical / Resolved Blocked Writes

- [create] fj-android/src/screens/profile/ProfileScreen.tsx → historical_blocked_discovery_resolved (Blocked attempt is covered by final allowed_write_files scope and a later factual allowed write exists for the same path.)

### Unresolved Blocked Writes

None.

## Entries

- [modify] fj-android/src/navigation/AppNavigator.tsx → in_scope
- [modify] fj-android/src/screens/profile/ProfileScreen.tsx → in_scope
