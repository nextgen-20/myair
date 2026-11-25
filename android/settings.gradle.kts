pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        // mavenLocal() MUST come first: com.google.android.gms:play-services-home and
        // play-services-home-types (the Google Home "Home APIs" SDK) are NOT published to
        // dl.google.com or Maven Central at any version. Confirmed 2026-11-25 against
        // Google's own release notes (developers.home.google.com/apis/android/release-notes)
        // and the official sample app (github.com/google-home/google-home-api-sample-app-android),
        // whose settings.gradle.kts resolves these two artifacts from mavenLocal() too.
        // See docs/GOOGLE_HOME_SDK_SETUP.md for exactly how to obtain and install them before
        // `:app:assembleDebug` will succeed.
        mavenLocal()
        google()
        mavenCentral()
    }
}
rootProject.name = "MyAir"
include(":app")
