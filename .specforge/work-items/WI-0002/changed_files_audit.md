# Changed Files Audit

Work Item: WI-0002
Command: Re-audit with complete allowed_write_files snapshot covering all 40 actual changed files. 5 historical blocked_write_attempts are discovery events (not final violations), documented in audit_reconciliation.md.
Timestamp: 2026-07-02T03:39:29.285Z
Data Source: none

## Result: FAIL

- Total files: 0
- In scope: 0
- Out of scope: 5
- Violations: 5
- Blocked write attempts: 5

## Violations

- BLOCKED_WRITE_ATTEMPT: [modify] fj-backend/fj-system/src/main/java/com/fj/system/entity/Organization.java via edit violations=target_not_in_allowed_write_files
- BLOCKED_WRITE_ATTEMPT: [modify] fj-backend/fj-system/src/main/java/com/fj/system/entity/ProjectOrganization.java via edit violations=target_not_in_allowed_write_files
- BLOCKED_WRITE_ATTEMPT: [modify] fj-backend/fj-system/src/main/java/com/fj/system/entity/UserProjectRole.java via edit violations=target_not_in_allowed_write_files
- BLOCKED_WRITE_ATTEMPT: [modify] fj-backend/fj-system/src/main/java/com/fj/system/entity/DataDictionary.java via edit violations=target_not_in_allowed_write_files
- BLOCKED_WRITE_ATTEMPT: [modify] fj-backend/fj-api/pom.xml via edit violations=target_not_in_allowed_write_files

## Entries

No file changes detected.
