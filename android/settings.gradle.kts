pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // If Google gives you the Home APIs SDK as a locally-hosted Maven repo, add it here, e.g.:
        // maven { url = uri(file("../../google-home-sdk-repo")) }
    }
}
rootProject.name = "MyAir"
include(":app")
