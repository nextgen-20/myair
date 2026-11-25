# MyAir

Local-first air purifier dashboard. **No mock sensor readings, fake devices, fake provider, or fake successful commands.**

## Layout
- `src/` — web dashboard (React/Vite). Depends only on `src/providers/types.ts` (the provider boundary).
- `android/` — Android shell (Kotlin). Hosts the built dashboard in a WebView and owns the **Google Home Home APIs** client.
  - `provider/PurifierProvider.kt` — Kotlin provider interface
  - `provider/GoogleHomePurifierProvider.kt` — the only file that imports `com.google.home.*`
  - `bridge/` — `window.MyAirNative` JSON bridge to the web UI
- `docs/GOOGLE_HOME_SETUP.md` — manual Google Cloud / OAuth / device steps.

## Run
- Browser (`npm run dev`): UI only. Home APIs cannot run in a browser, so it shows "Not running in the MyAir Android app".
- Android: `npm install && npm run build`, then open `android/` in Android Studio and run on a physical phone.

## Status
See "Integration status" in the app. This implementation has not been compiled against the Home APIs SDK
by its author — see docs for the verification checklist.
