package com.myair.app.provider

import androidx.activity.ComponentActivity
import kotlinx.coroutines.flow.StateFlow

/**
 * Provider boundary for the Android side. Nothing outside GoogleHomePurifierProvider
 * may import com.google.home.*; the bridge and the web dashboard see only these types.
 */
interface PurifierProvider {
    val providerName: String
    val snapshot: StateFlow<ProviderSnapshot>

    /** Must be called from Activity.onCreate (before STARTED) so the permission UI can launch. */
    fun bindActivity(activity: ComponentActivity)

    /** Re-checks permission and re-reads devices from the provider. */
    suspend fun refresh()
    suspend fun requestPermissions()

    suspend fun setPower(deviceId: String, on: Boolean): CommandOutcome
    suspend fun setFanMode(deviceId: String, modeId: String): CommandOutcome
    suspend fun setFanPercent(deviceId: String, percent: Int): CommandOutcome
    /** No-op for providers (e.g. Qubo) whose real controls the device doesn't expose. */
    suspend fun setFanSpeedLevel(deviceId: String, level: Int): CommandOutcome = CommandOutcome(false, false, "Not supported by this provider.")
    suspend fun setChildLock(deviceId: String, enabled: Boolean): CommandOutcome = CommandOutcome(false, false, "Not supported by this provider.")
}

/** Implemented only by providers that authenticate with a username/password-style account
 * (currently QuboProvider) rather than a system permission flow (Google Home). */
interface CredentialAuthProvider {
    suspend fun signIn(identifier: String, password: String): CommandOutcome
    suspend fun signOut()
}

enum class Phase(val wire: String) {
    LOADING("loading"),
    NEEDS_PERMISSION("needs-permission"),
    PERMISSION_DENIED("permission-denied"),
    READY("ready"),
    ERROR("error"),
}

enum class Connectivity(val wire: String) { ONLINE("online"), OFFLINE("offline"), PARTIALLY_ONLINE("partially_online"), UNKNOWN("unknown") }

data class FanModeOption(val id: String, val label: String)

data class PurifierState(
    val power: Boolean?,
    val fanMode: String?,
    val fanPercent: Int?,
    val fanModesAvailable: List<FanModeOption>,
    /** null unless the device actually exposes a PM2.5-reporting trait. Never estimated. */
    val pm25: Int? = null,
    /** null unless the device actually reports remaining filter life. Never estimated. */
    val filterLifePercent: Int? = null,
    /** null unless the device actually exposes a discrete fan-speed-level control (e.g. Qubo's 1/2/3),
     * distinct from the percent-based FanControl trait above. */
    val fanSpeedLevel: Int? = null,
    val fanSpeedLevelsAvailable: List<Int> = emptyList(),
    val childLockOn: Boolean? = null,
)

data class Controls(
    val power: Boolean,
    val fanMode: Boolean,
    val fanPercent: Boolean,
    val fanSpeedLevel: Boolean = false,
    val childLock: Boolean = false,
)

data class PurifierDeviceModel(
    val id: String,
    val name: String,
    val room: String?,
    val connectivity: Connectivity,
    val supported: Boolean,
    val unsupportedReason: String?,
    val traits: List<String>,
    val controls: Controls,
    val state: PurifierState,
    /** epoch ms of the last successful read from the provider; null if never read */
    val lastConfirmedAt: Long?,
    /** null unless the provider actually reports a model/SKU string (e.g. Qubo's "HPH06"). */
    val model: String? = null,
)

data class ProviderSnapshot(
    val provider: String,
    val phase: Phase,
    val message: String?,
    val devices: List<PurifierDeviceModel>,
)

/**
 * accepted  = provider returned without error.
 * confirmed = a read-back from the provider showed the requested state.
 * The UI may only say "successful" when confirmed == true.
 */
data class CommandOutcome(val accepted: Boolean, val confirmed: Boolean, val error: String?)
