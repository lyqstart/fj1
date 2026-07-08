# WI-0027 Intake

## Bug Description
Release APK shows pure black screen on Huawei Nova 9 (HarmonyOS). App does NOT crash/exit. Stays permanently on black screen.

## WI-0026 Did NOT Fix It
WI-0026 fixed 7 ProGuard rule defects, rebuilt Release APK (BUILD SUCCESSFUL, 55MB). User reports black screen persists.

## Key Diagnosis
- ErrorBoundary would show gray (#f5f5f5) background with text → NOT triggered
- AppRoot loading screen would show gray background with spinner → NOT shown
- Pure black means React is NOT mounting at all
- JS bundle either: not executing, or failing during module evaluation before React renders

## Plan
Build diagnostic Release APK with `minifyEnabled=false`:
- Still bundled (standalone, no Metro needed)
- Still signed with release key
- NO R8/ProGuard code stripping
- If this works → R8 is the problem (need R8 mapping analysis)
- If this also shows black → NOT R8, need to investigate JS/Hermes/native rendering