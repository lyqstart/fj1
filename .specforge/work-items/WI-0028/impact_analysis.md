# WI-0028 Impact Analysis

## Impact Assessment

### High Impact
- **index.js**: Critical boot entry. Adding try-catch is purely additive — if App imports successfully, behavior is unchanged. If App fails to import, fallback component shows error (better than black screen).
- **styles.xml**: Theme change from DayNight to Light. On HarmonyOS dark mode, DayNight produces dark gray background visible before RN renders. Light theme ensures white background.

### Medium Impact  
- **Logger.ts (new)**: No existing code affected. New utility module.
- **LogPersistence.ts (new)**: No existing code affected.
- **App.tsx**: Adding Logger import and boot logging calls. Non-breaking.
- **AppRoot.tsx**: Adding logger.info/error calls around DB init. Non-breaking.
- **AuthContext.tsx**: Adding logger calls. Non-breaking.
- **ApiClient.ts**: Adding logger calls. Non-breaking.

### Low Impact
- **ProfileScreen.tsx**: Optional log viewer button. Non-breaking.

## Dependencies
- No new npm packages required (Logger is pure JS)
- Uses existing ApiClient for remote upload
- Uses existing AsyncStorage if available, otherwise in-memory buffer only

## Risk Mitigation
- Logger is designed to never throw (all methods wrapped in try-catch)
- Boot diagnostics only activates on import failure (zero overhead on success path)
- Theme change is Android-only, does not affect JS behavior