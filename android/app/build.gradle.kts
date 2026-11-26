plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val homeApisVersion: String by project

android {
    namespace = "com.myair.app"
    compileSdk = 36
    defaultConfig {
        // applicationId + signing SHA-1 must match the Android OAuth client in Google Cloud.
        applicationId = "com.myair.app"
        minSdk = 29          // Google's sample uses 29; Home APIs need a test device on Android 10+
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/myairWeb"))
}

// Copies the built web dashboard (../dist, from `npm run build`) into the APK's assets.
val syncWebAssets by tasks.registering(Copy::class) {
    val dist = rootProject.projectDir.resolve("../dist")
    from(dist)
    into(layout.buildDirectory.dir("generated/myairWeb"))
    doFirst {
        if (!dist.resolve("index.html").exists()) {
            throw GradleException("Web dashboard not built. Run `npm install && npm run build` in the MyAir project root first (expected ${dist.absolutePath}/index.html).")
        }
    }
}
tasks.named("preBuild") { dependsOn(syncWebAssets) }

dependencies {
    // --- Google Home Home APIs: set aside (see docs/GOOGLE_HOME_SDK_SETUP.md and
    // docs/google-home-disabled/README.md) because these two artifacts are not published on
    // dl.google.com or Maven Central at any version - only distributed to developers signed in
    // to the Home APIs public beta, for local Maven installation. Uncomment once you've done
    // that AND moved GoogleHomePurifierProvider.kt back into src/main (see the README above).
    // implementation("com.google.android.gms:play-services-home:$homeApisVersion")
    // implementation("com.google.android.gms:play-services-home-types:$homeApisVersion")

    // Home APIs 1.11+ require kotlinx.coroutines to be declared by the app; QuboProvider also
    // uses coroutines directly, so this stays regardless of the Google Home dependency above.
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.11.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")

    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-ktx:1.12.4")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.10.0")
    implementation("androidx.webkit:webkit:1.14.0")

    // Qubo provider: Keystore-backed storage for the account session (access/refresh token only;
    // the password itself is never stored).
    implementation("androidx.security:security-crypto:1.1.0")
}
