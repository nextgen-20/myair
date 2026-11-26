# Google Home provider — set aside, not deleted

`GoogleHomePurifierProvider.kt` in this folder is the **exact, unmodified** file that was
previously at `android/app/src/main/java/com/myair/app/provider/GoogleHomePurifierProvider.kt`.
It has been moved here — out of the Gradle source set that actually gets compiled — so the app
can build and produce an APK with the real Qubo and IR Remote features while Google Home is set
aside, per the explicit instruction to leave Google Home aside for now rather than keep blocking
the whole build on it.

**Why it had to move, not just stay unused:** Kotlin/Gradle compiles every `.kt` file under
`src/main/java`, whether or not anything calls it. This file imports `com.google.home.*` classes
from `com.google.android.gms:play-services-home` / `play-services-home-types`, and those
artifacts are not published on any public Maven repository (see
`../GOOGLE_HOME_SDK_SETUP.md`). Leaving the file in place would fail every build at dependency
resolution regardless of whether `MyAirApp.kt` constructed it.

In its place, `android/app/src/main/java/com/myair/app/provider/UnavailablePurifierProvider.kt`
is used — it reports an honest "Google Home is set aside" error state with zero devices and no
commands that pretend to succeed. Nothing about Google Home has been faked; it has been
disabled, visibly and reversibly.

## To restore real Google Home support

1. Get the Home APIs SDK AARs installed into your own `mavenLocal()` (see
   `../GOOGLE_HOME_SDK_SETUP.md` for exactly how, and why that's the step Google actually
   requires — there is no plain Maven coordinate to add).
2. Move this file back: `git mv docs/google-home-disabled/GoogleHomePurifierProvider.kt android/app/src/main/java/com/myair/app/provider/GoogleHomePurifierProvider.kt`
3. In `android/app/src/main/java/com/myair/app/MyAirApp.kt`, change
   `googleHomeProvider = UnavailablePurifierProvider(...)` back to
   `googleHomeProvider = GoogleHomePurifierProvider(this)`, and remove the now-unused
   `UnavailablePurifierProvider.kt`.
4. In `android/app/build.gradle.kts`, uncomment the two `play-services-home*` dependency lines
   (left in place as comments for exactly this).
