---
name: webapp-to-android
description: >-
  Comprehensive guide and production runbook for converting any web application
  into a high-performance, bug-free native Android APK using Capacitor. Covers
  notch adaptation, touch architecture, reference-counted scroll locking, spacebar
  input fixes, hardware back button hierarchy, native notification channels,
  anti-theft code obfuscation, ProGuard/R8, and release signing.
---

# Webapp-to-Android APK Conversion Skill

Refer to the complete master runbook in [Webapp-2-Androidapk.md](file:///home/krish/Downloads/Coding/Lifelog-main/Webapp-2-Androidapk.md) for full code examples, configurations, and step-by-step instructions.

## Key Checklists for Any Web App to Android APK

### 1. Viewport & Cutouts
- Add `viewport-fit=cover` to `<meta name="viewport">`.
- Set `android:windowLayoutInDisplayCutoutMode="shortEdges"` in `styles.xml`.
- Use `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.

### 2. Touch & Scroll Safety
- Never use simple `document.body.style.overflow = "hidden"` (causes permanent screen freeze). Use reference-counted `useBodyScrollLock`.
- Add `overscroll-behavior: contain` to all modal/drawer scroll containers.
- Disable `history.scrollRestoration` (`manual`).
- Never rely on `group-hover` or `:hover` for critical buttons. Ensure touch buttons have minimum 44x44px hit areas.

### 3. Keystroke & Input Safety
- Never call `.trim()` on live `onChange` handlers (it destroys the spacebar).
- Set `android:windowSoftInputMode="adjustResize"`.

### 4. Native Hardware Back Button
- Implement a hierarchical closer:
  `Modals -> Drawers -> Views -> Minimize (never abrupt kill)`.

### 5. Native Notifications & Audio
- Create Android `NotificationChannel` with `IMPORTANCE_HIGH`.
- Declare and request `POST_NOTIFICATIONS` (Android 13+).
- Unlock `AudioContext` on user touch gesture.

### 6. Code Protection (Anti-Theft)
- Apply JavaScript Obfuscation (bytecode/VM, string encryption, control flow flattening).
- Enable ProGuard / R8 (`minifyEnabled true`, `shrinkResources true`).
