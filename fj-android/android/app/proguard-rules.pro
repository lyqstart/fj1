# Add project specific ProGuard rules here.
# For more details, see http://developer.android.com/guide/developing/tools/proguard.html

# ============================================================
# fj-android Release ProGuard / R8 rules (WI-0026 full revision)
# build.gradle: minifyEnabled=true, shrinkResources=true
# ============================================================

# General attributes
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses
-keepattributes SourceFile
-keepattributes LineNumberTable

# --- React Native core (native modules, bridge) ---
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-dontwarn com.facebook.**

# DoNotStrip annotation (correct keep method for WI-0026)
-keep @com.facebook.proguard.annotations.DoNotStrip class * { *; }
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}

# OkHttp / okio
-dontwarn okhttp3.**
-dontwarn okio.*
-dontwarn javax.annotation.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# --- React Native new architecture runtime (newArchEnabled=true codegen) ---
-keep class com.facebook.react.runtime.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.fabric.** { *; }
-keep class com.facebook.react.uimanager.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.module.** { *; }
-dontwarn com.facebook.react.runtime.**
-dontwarn com.facebook.react.turbomodule.**
-dontwarn com.facebook.react.fabric.**
-dontwarn com.facebook.react.uimanager.**

# --- react-native-keychain (com.oblador) ---
-keep class com.oblador.keychain.** { *; }
-keep class com.oblador.keychain.exceptions.** { *; }
-dontwarn com.oblador.keychain.**

# --- Facebook Conceal (crypto used by keychain) ---
-keep class com.facebook.crypto.** { *; }
-dontwarn com.facebook.crypto.**

# --- WatermelonDB (CORRECT package name: com.nozbe.watermelondb) ---
# WI-0026 fix: previous rules used wrong package com.watermelon.db
-keep class com.nozbe.watermelondb.** { *; }
-keep class com.nozbe.watermelondb.jsi.** { *; }
-dontwarn com.nozbe.watermelondb.**

# --- React Native Vision Camera (WI-0020 unblocked native module) ---
-keep class com.mrousavy.camera.** { *; }
-dontwarn com.mrousavy.camera.**

# --- React Native Safe Area Context ---
-keep class com.th3rdwave.safeareacontext.** { *; }
-dontwarn com.th3rdwave.safeareacontext.**

# --- React Native Image Resizer ---
-keep class com.RNImageResizer.** { *; }
-dontwarn com.RNImageResizer.**

# Suppress remaining warnings
-dontwarn java.**
-dontwarn javax.**
-dontwarn org.jetbrains.annotations.**

# --- Application classes ---
-keep class com.fjandroid.** { *; }
-keep class com.fjandroid.MainApplication { *; }
-keep class com.fjandroid.MainActivity { *; }
