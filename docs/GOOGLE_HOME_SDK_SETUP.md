# Google Home "Home APIs" SDK — why the build fails and how to fix it

## The actual CI failure

```
:app:checkDebugAarMetadata FAILED
Cause 1: Could not find com.google.android.gms:play-services-home:17.1.0.
  Searched: dl.google.com/dl/android/maven2/..., repo.maven.apache.org/maven2/...
Cause 2: Could not find com.google.android.gms:play-services-home-types:17.1.0.
  (same two repos searched)
```

This happened on a real, fully-networked GitHub Actions runner (not the sandbox used earlier
in this project's history), so it is **not** a proxy/network-allowlist problem. It is a genuine
dependency-resolution failure, confirmed by research on 2026-11-25.

## Root cause (verified against Google's own sources)

`com.google.android.gms:play-services-home` and `play-services-home-types` (the "Home APIs"
Android SDK that `QuboProvider`'s sibling, `GoogleHomePurifierProvider`, depends on) are **not
published to any public Maven repository** — not `dl.google.com`, not Maven Central — at any
version, including the latest (`17.12.0` as of SDK release 1.12, 2026‑11‑19). Sources:

- Google's own SDK page states the Home APIs "are not yet part of the standard libraries
  provided by Google for development," and that you must download the libraries and host them
  locally: https://developers.home.google.com/apis/android/sdk
- Google's release notes confirm per-release artifact version bumps
  (e.g. both artifacts go to `17.12.0` in SDK release 1.12) but never mention a Maven
  coordinate you can simply add — only a signed-in download of a zip from a Google Cloud
  Storage bucket: https://developers.home.google.com/apis/android/release-notes
- Google's own official sample app
  (`github.com/google-home/google-home-api-sample-app-android`) resolves these exact two
  artifacts from **`mavenLocal()`** (your own local `~/.m2` cache) in its
  `settings.gradle.kts` `dependencyResolutionManagement` block — not from `google()` or
  `mavenCentral()`. That confirms the intended distribution path: you install the
  Google-provided AARs into your local Maven repository yourself, after downloading them from
  a sign-in-gated location.

This matches what this project's own `android/gradle.properties` already anticipated in its
comment on `homeApisVersion`: *"If Google gives you the Home APIs SDK as a locally-hosted
Maven repo, add it here."*

## What this means for this repo right now

- `android/settings.gradle.kts` now lists `mavenLocal()` first (matching Google's own sample
  app), so once the AARs are installed locally the existing
  `implementation("com.google.android.gms:play-services-home:$homeApisVersion")` lines in
  `android/app/build.gradle.kts` will resolve with no further code changes.
- Nobody — not this CI workflow, not a sandboxed agent, not an anonymous script — can fetch
  these AARs automatically. The download requires **your own Google account**, signed in at
  Google Home Developers, to accept the Home APIs public-beta program and download the SDK
  zip. This is a credential/account-gated step, so it cannot be scripted into GitHub Actions
  without you first making the AARs available to the runner (e.g. by committing them, or by
  publishing them to a private Maven/GitHub Packages repo you control and adding that repo's
  URL + an auth token as a repo secret).
- Until that happens, `:app:assembleDebug` will keep failing at this exact step, in CI and
  locally, regardless of how correct the rest of the Gradle/Kotlin/Qubo/IR code is. This is an
  external SDK-distribution blocker, not a bug in this project's own code.

## Exact steps to unblock the build

1. Sign in to Google Home Developers and accept the Home APIs public-beta program:
   https://developers.home.google.com/apis/android/sdk
2. Download the Home APIs Android SDK zip for the version this project targets
   (`homeApisVersion` in `android/gradle.properties`, currently `17.1.0`) — or bump that
   property to a newer release (e.g. `17.12.0`) and download the matching zip instead; see
   the release-notes table linked above for which SDK release maps to which artifact version.
3. Unzip it; you get two files roughly named `play-services-home-<version>.aar` and
   `play-services-home-types-<version>.aar`.
4. Install both into your local Maven repository with the exact coordinates this project
   already declares, for example:
   ```
   mvn install:install-file -Dfile=play-services-home-17.1.0.aar \
     -DgroupId=com.google.android.gms -DartifactId=play-services-home \
     -Dversion=17.1.0 -Dpackaging=aar

   mvn install:install-file -Dfile=play-services-home-types-17.1.0.aar \
     -DgroupId=com.google.android.gms -DartifactId=play-services-home-types \
     -Dversion=17.1.0 -Dpackaging=aar
   ```
5. Run `./gradlew :app:assembleDebug` again (locally, or in a CI runner that has the same
   `~/.m2` populated, e.g. by restoring it from a cache step you control). It will now resolve
   both artifacts from `mavenLocal()` and proceed to actually compile the Google Home provider
   code.

This is why the GitHub Actions workflow in this repo cannot be made to produce a passing build
by itself: the missing piece is a credentialed download only you can perform, not a
configuration mistake in the workflow or the Gradle project.
