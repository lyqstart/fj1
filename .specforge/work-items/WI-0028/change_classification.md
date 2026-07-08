# WI-0028 Change Classification

## Type: feature (new capability)
## Scope: App-wide logging infrastructure + boot diagnostics
## Risk: Medium (touches index.js entry point, but additions are additive/defensive)

## Affected Modules
1. `index.js` — boot entry (add try-catch + global error handler)
2. `src/utils/Logger.ts` — new module (core logging)
3. `src/utils/LogPersistence.ts` — new module (local + remote)
4. `App.tsx` — add Logger import + boot logging
5. `src/AppRoot.tsx` — add logging to DB init
6. `src/store/auth/AuthContext.tsx` — add logging to auth operations
7. `src/api/ApiClient.ts` — add logging to HTTP requests
8. `src/screens/profile/ProfileScreen.tsx` — add log viewer entry (optional)
9. `android/app/src/main/res/values/styles.xml` — DayNight → Light theme fix
10. `android/app/src/main/res/values-night/styles.xml` — new (force light background)