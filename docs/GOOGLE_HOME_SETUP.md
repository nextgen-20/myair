# Google Home Home APIs — manual setup for MyAir

MyAir uses the official **Google Home Home APIs for Android** (not Cloud-to-cloud, no manufacturer APIs).
These steps cannot be done from code; you must do them.

## 1. Prerequisites
- Android Studio (Ladybug 2024.2.1 or later), JDK 17+, Android SDK 36.
- A **physical Android 10+ phone** with up-to-date Google Play services, signed in with the Google Account you will test with.
  (Emulators are not a supported way to test Home APIs.)
- A Google Home with at least one real device that Google Home exposes as an **air purifier**
  (Matter device type `AirPurifierDevice`). Qubo is not required; a Qubo only works if Google Home exposes it as this type.

## 2. Get the SDK
Home APIs are `com.google.android.gms:play-services-home` and `play-services-home-types`
(both required). Google's docs say that, depending on release stage, the SDK may need to be downloaded
after signing in to Google Home Developers and hosted as a local Maven repo. If a plain Gradle sync
cannot resolve them, add the local repo in `android/settings.gradle.kts` (commented example included).
Version is `homeApisVersion` in `android/gradle.properties` (17.1.0 = version in Google's sample app; check
the release notes for newer). Home APIs 1.11+ need **Kotlin 2.4.0** and explicit kotlinx.coroutines (already set).

## 3. Google Cloud / OAuth
1. Create (or pick) a Google Cloud project.
2. APIs & Services → **OAuth consent screen** (Google Auth Platform): choose External (or Internal), fill app info.
3. **Audience → Test users → add the Google Account** you will use. Unverified apps work only for listed test users (max 100).
4. APIs & Services → Credentials → **Create OAuth client ID → Android**:
   - Package name: `com.myair.app` (or your own — then change `namespace`/`applicationId` in `android/app/build.gradle.kts` and the Kotlin package declarations are unaffected by applicationId).
   - SHA-1: your debug key's fingerprint. Get it with `./gradlew :app:signingReport` (or `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`).
   - For a release build, add the release key's SHA-1 as a second Android client.
5. No client ID is pasted into MyAir's code: Google matches the app by package name + SHA-1.
6. Scope: the standard Home APIs scope is `home.platform.selected.devices`. Google's sample notes that its
   default `home.platform.v2` scope needs partner approval. MyAir does not set a scope in code; confirm in the current
   Google docs which scope your project needs and that it is allowed on your consent screen.
7. Google Home Developer Console registration is **not** needed to test, only to publish.

## 4. Build and run
```
npm install && npm run build        # builds the web dashboard to ./dist
# open ./android in Android Studio, Sync, run on the phone
```
`./dist` is copied into the APK by the `syncWebAssets` Gradle task; the build fails with a clear message if it is missing.

## 5. First run
Setup page → "Continue to Google Home permissions" → pick the home and the devices to share.
Integration status shows provider, device name, room, online/offline, traits, and last confirmed state.

## What MyAir will never show unless Google Home confirms it
- "Online" comes from the device's `sourceConnectivity` as reported by Home APIs.
- A command is "Confirmed" only if a fresh read-back shows the requested value. Otherwise: "accepted, not confirmed", or the error.
