# Packaging & PWA Notes

> **Status Notice:** Packaging is explicitly deferred for this phase. **No Android APK has been built.** This document specifies the operational procedure to synchronize Capacitor assets, open the native project in Android Studio, assemble the APK in a future phase, and verify PWA installability.

---

## 1. Capacitor Android Platform Workflow

Capacitor bridges the web build (`app/dist`) into the native Android container (`app/android`).

### 1.1 Synchronizing Assets

Whenever web assets, configuration, or plugins are updated:

```bash
cd app
bun run build       # Or bunx vite build: generates app/dist
bunx cap sync       # Copies dist into android/app/src/main/assets/public and updates plugins/config
```

Alternatively, to target Android only:

```bash
cd app
bunx cap sync android
```

### 1.2 Opening in Android Studio

To open the native project in Android Studio for debugging, emulator launch, or signing configuration:

```bash
cd app
bunx cap open android
```

### 1.3 Building the Android APK (Deferred / Future Phase)

When APK packaging is scheduled:

- **Via Android Studio (GUI):**
  1. Open project via `bunx cap open android`.
  2. Wait for Gradle sync to complete.
  3. Select **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
  4. The generated APK will be available in `app/android/app/build/outputs/apk/debug/app-debug.apk`.

- **Via Command Line (CLI):**
  ```bash
  cd app/android
  ./gradlew assembleDebug
  ```
  The resulting debug APK is located at:
  `app/android/app/build/outputs/apk/debug/app-debug.apk`

---

## 2. PWA Installability Checklist

The web client is configured for standalone PWA capability on mobile surfaces.

### 2.1 Manifest Specifications (`app/public/manifest.webmanifest`)

- [x] **Application Name:** `"Maestro de Personal"`
- [x] **Short Name:** `"Personal"`
- [x] **Display Mode:** `"standalone"` (provides native-like app frame without browser chrome)
- [x] **Start URL:** `"."` (opens app root)
- [x] **Icons Defined:**
  - 192x192 PNG: `/icons/icon-192.png` (Homescreen icon)
  - 512x512 PNG: `/icons/icon-512.png` (Splash / high-DPI icon)
- [x] **Palette Placeholders:** Neutral theme and background colors (`#ffffff`) pending final design palette.

### 2.2 HTML Meta Tags (`app/index.html`)

- [x] Manifest link: `<link rel="manifest" href="/manifest.webmanifest" />`
- [x] Theme color: `<meta name="theme-color" content="#ffffff" />`
- [x] iOS standalone support: `<meta name="apple-mobile-web-app-capable" content="yes" />`

### 2.3 Verification & Testing Checklist

- [ ] **HTTPS / Localhost:** Install prompts require serving over HTTPS in production or `localhost` during development.
- [ ] **DevTools Audit:**
  1. Open Chrome / Edge DevTools.
  2. Inspect **Application** > **Manifest** to confirm identity, icons, and display mode are recognized.
  3. Run **Lighthouse** audit selecting "Progressive Web App" to verify installability criteria.
- [ ] **Service Worker:** Deferred with packaging phase. When offline caching is required, register a service worker (e.g. via `vite-plugin-pwa` or custom SW).
