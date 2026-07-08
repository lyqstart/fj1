# WI-0029 Change Classification

## Type: bugfix (WI-0028 补救)
## Scope: Backend + Frontend log pipeline
## Risk: Low

## Backend Changes
1. NEW: fj-common/.../applog/AppLogController.java
2. NEW: fj-common/.../applog/AppLogService.java  
3. MODIFY: SecurityConfig.java (add permitAll for /api/v1/logs/**)

## Frontend Changes
1. MODIFY: src/utils/Logger.ts (connect flush to RemoteLogTransport)