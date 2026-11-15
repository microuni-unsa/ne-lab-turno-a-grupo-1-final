# Packaging & PWA Notes

> **Status Notice:** **Android Debug APK compiled and verified.** El proyecto Capacitor está configurado en `capacitor.config.ts` (`appId: "com.solucionesmoviles.maestropersonal"`, `webDir: "dist"`), el directorio nativo `android/` fue sincronizado (`bunx cap sync android`) y el APK fue compilado en `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 1. Capacitor Android Platform Workflow

Capacitor bridges the web build (`dist/`) into the native Android container (`android/`).

### 1.1 Adding & Synchronizing Android Assets

If `android/` does not yet exist in the workspace (`@capacitor/android` is already in `package.json`; initialize once):

```bash
bunx cap add android
```

Whenever web assets, configuration, or plugins are updated:

```bash
bun run build       # Generates dist/
bunx cap sync       # Copies dist/ into android/app/src/main/assets/public and updates plugins/config
```

Alternatively, to target Android only:

```bash
bunx cap sync android
```

### 1.2 Opening in Android Studio

To open the native project in Android Studio for debugging, emulator launch, or signing configuration:

```bash
bunx cap open android
```

### 1.3 Building the Android APK (Deferred / Future Phase)

When APK packaging is scheduled:

- **Via Android Studio (GUI):**
  1. Open project via `bunx cap open android`.
  2. Wait for Gradle sync to complete.
  3. Select **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
  4. The generated APK will be available in `android/app/build/outputs/apk/debug/app-debug.apk`.

- **Via Command Line (CLI):**
  ```bash
  cd android
  ./gradlew assembleDebug
  ```
  The resulting debug APK is located at:
  `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 2. PWA Installability Checklist

The web client is configured for standalone PWA capability on mobile surfaces.

### 2.1 Manifest Specifications (`public/manifest.webmanifest`)

- [x] **Application Name:** `"Maestro de Personal"`
- [x] **Short Name:** `"Personal"`
- [x] **Display Mode:** `"standalone"` (provides native-like app frame without browser chrome)
- [x] **Start URL:** `"."` (opens app root)
- [x] **Icons Defined:**
  - 192x192 PNG: `/icons/icon-192.png` (Homescreen icon)
  - 512x512 PNG: `/icons/icon-512.png` (Splash / high-DPI icon)
- [x] **Neutral Palette:** Matches UI theme tokens (`#ffffff`).

### 2.2 HTML Meta Tags (`index.html`)

- [x] Viewport with safe-area & virtual keyboard fit: `viewport-fit=cover, interactive-widget=resizes-content`
- [x] Manifest link: `<link rel="manifest" href="/manifest.webmanifest" />`
- [x] Touch & browser icons: `<link rel="icon" ... />` and `<link rel="apple-touch-icon" href="/icons/icon-192.png" />`
- [x] Theme color: `<meta name="theme-color" content="#ffffff" />`
- [x] iOS standalone support: `<meta name="apple-mobile-web-app-capable" content="yes" />`

### 2.3 Verification & Testing Checklist

- [x] **Automated Preview Verification:** Playwright E2E verifies `manifest.webmanifest` HTTP 200 and PNG icon assets (`192×192`, `512×512`) served from `vite preview` (`dist/`).
- [ ] **HTTPS / Production Host:** Install prompts require serving over HTTPS in production or `localhost` during development.
- [ ] **DevTools Audit:**
  1. Open Chrome / Edge DevTools on the deployed HTTPS URL.
  2. Inspect **Application** > **Manifest** to confirm identity, icons, and display mode are recognized.
  3. Run **Lighthouse** audit selecting "Progressive Web App" to verify installability criteria.
- [ ] **Service Worker:** Deferred per `SPEC §14` (live network required against Supabase; no offline mode).
