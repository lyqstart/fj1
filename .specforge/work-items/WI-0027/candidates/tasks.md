# WI-0027 Tasks

## TASK-1: Disable ProGuard in Release build
- File: `fj-android/android/app/build.gradle`
- Change: `enableProguardInReleaseBuilds = false`, `shrinkResources false`
- Status: DONE

## TASK-2: Docker assembleRelease
- Command: docker assembleRelease
- Status: DONE (BUILD SUCCESSFUL 3m52s)

## TASK-3: Verify APK
- APK: 57MB (no R8 stripping)
- Status: DONE