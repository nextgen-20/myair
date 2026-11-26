package com.myair.app.provider

import androidx.activity.ComponentActivity
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Stands in for [GoogleHomePurifierProvider] while Google Home is set aside.
 *
 * Why this exists: com.google.android.gms:play-services-home and
 * play-services-home-types (the Home APIs SDK that GoogleHomePurifierProvider.kt needs)
 * are not published on dl.google.com or Maven Central at any version - Google only
 * distributes them to developers signed in to the Home APIs public beta, for
 * installation into each developer's own local Maven cache. See
 * docs/GOOGLE_HOME_SDK_SETUP.md for the full investigation. Keeping
 * GoogleHomePurifierProvider.kt in the main source set would make every build (local or
 * CI) fail at dependency resolution, so it has been moved out of the compiled source set
 * to docs/google-home-disabled/GoogleHomePurifierProvider.kt (full original content,
 * unmodified) and this honest stand-in is used in its place.
 *
 * This provider reports NOTHING: no devices, no fake readings, no commands that pretend
 * to succeed. It always reports phase = ERROR with an explanatory message, exactly like a
 * real provider would if its SDK were genuinely unavailable at runtime. The web dashboard's
 * existing "Google Home" integration card already renders whatever message a provider
 * reports, so this surfaces honestly with no change needed there.
 *
 * To restore real Google Home support: install the Home APIs AARs into mavenLocal() (see
 * the doc above), move GoogleHomePurifierProvider.kt back into this directory, delete this
 * file, and change MyAirApp.kt back to `GoogleHomePurifierProvider(this)`.
 */
class UnavailablePurifierProvider(private val reason: String) : PurifierProvider {
    override val providerName = "Google Home"
    override val snapshot: StateFlow<ProviderSnapshot> = MutableStateFlow(
        ProviderSnapshot(provider = "Google Home", phase = Phase.ERROR, message = reason, devices = emptyList())
    )

    override fun bindActivity(activity: ComponentActivity) { /* nothing to bind - no SDK is loaded */ }
    override suspend fun refresh() { /* nothing to refresh - no SDK is loaded */ }
    override suspend fun requestPermissions() { /* no permission flow exists while this stand-in is active */ }

    override suspend fun setPower(deviceId: String, on: Boolean) = CommandOutcome(false, false, reason)
    override suspend fun setFanMode(deviceId: String, modeId: String) = CommandOutcome(false, false, reason)
    override suspend fun setFanPercent(deviceId: String, percent: Int) = CommandOutcome(false, false, reason)
}
