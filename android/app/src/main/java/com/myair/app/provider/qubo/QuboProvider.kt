package com.myair.app.provider.qubo

import android.content.Context
import androidx.activity.ComponentActivity
import com.myair.app.provider.CommandOutcome
import com.myair.app.provider.Connectivity
import com.myair.app.provider.Controls
import com.myair.app.provider.CredentialAuthProvider
import com.myair.app.provider.FanModeOption
import com.myair.app.provider.Phase
import com.myair.app.provider.ProviderSnapshot
import com.myair.app.provider.PurifierDeviceModel
import com.myair.app.provider.PurifierProvider
import com.myair.app.provider.PurifierState
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.UUID

/**
 * Qubo cloud-account provider. Real REST calls against Qubo's own cloud (srvcapp.platform.
 * quboworld.com), authenticated as the user's own Qubo account — the same account + API the
 * official Qubo app uses, nothing bypassed or intercepted.
 *
 * STATUS: implemented from protocol details verified by reading selvakk2k/qubopy (MIT-licensed)
 * source — qubopy/auth.py, qubopy/client.py, qubopy/const.py, qubopy/devices/purifier.py and
 * qubopy/devices/base.py — not copied, reimplemented natively. Login, discovery and shadow READ
 * are the best-attested parts of that project (its own README credits a named contributor's
 * real-hardware test of "REST shadow controls & state telemetry" on a Q400). The shadow WRITE
 * route this file uses (`.../shadow/attribute`, PUT) is the same one that contributor's testing
 * covered, but qubopy's own client.py code comment separately calls its HTTP method "inferred,
 * unverified in the Java app layer" — so treat command-sending here as plausible, not proven.
 * NONE of this has been run against a real Qubo R250/HPH06 by this assistant. See
 * docs/QUBO_INVESTIGATION.md and the final report for exactly what that means.
 *
 * Qubo's HPH "mode" (auto/manual/sleep/qsense) is surfaced as this provider's fanMode; Qubo's
 * separate discrete "speed" (1-3) is surfaced as fanSpeedLevel — these are two independent
 * controls on the real device, not one.
 */
class QuboProvider(context: Context) : PurifierProvider, CredentialAuthProvider {

    override val providerName = "Qubo (community cloud protocol)"
    private val appContext = context.applicationContext
    private val tokenStore = QuboTokenStore(appContext)
    private val deviceIdPrefs = appContext.getSharedPreferences("myair_qubo_device", Context.MODE_PRIVATE)
    private val mutex = Mutex()
    private var devices: Map<String, QuboDeviceInfo> = emptyMap()

    private val api: QuboApiClient = QuboApiClient(tokenStore.load(), sourceDeviceId()) { tokenStore.save(it) }

    private val _snapshot = MutableStateFlow(
        ProviderSnapshot(
            providerName, if (tokenStore.load() == null) Phase.NEEDS_PERMISSION else Phase.LOADING,
            if (tokenStore.load() == null) "Sign in with your Qubo account to discover purifiers." else null,
            emptyList(),
        ),
    )
    override val snapshot: StateFlow<ProviderSnapshot> = _snapshot

    private fun sourceDeviceId(): String {
        deviceIdPrefs.getString("device_id", null)?.let { return it }
        val id = UUID.randomUUID().toString()
        deviceIdPrefs.edit().putString("device_id", id).apply()
        return id
    }

    override fun bindActivity(activity: ComponentActivity) { /* no system permission UI for a cloud-account provider */ }

    override suspend fun requestPermissions() { refresh() } // sign-in happens via CredentialAuthProvider.signIn

    override suspend fun signIn(identifier: String, password: String): CommandOutcome {
        setPhase(Phase.LOADING, "Signing in to Qubo…")
        return try {
            api.loginWithEmail(identifier, password).also { tokenStore.save(it) }
            refresh()
            CommandOutcome(true, true, null)
        } catch (e: QuboApiException) {
            setPhase(Phase.PERMISSION_DENIED, e.message)
            CommandOutcome(false, false, e.message)
        } catch (e: Exception) {
            setPhase(Phase.ERROR, "Unexpected error: ${e.message}")
            CommandOutcome(false, false, e.message)
        }
    }

    override suspend fun signOut() {
        tokenStore.clear()
        devices = emptyMap()
        _snapshot.value = ProviderSnapshot(providerName, Phase.NEEDS_PERMISSION, "Sign in with your Qubo account to discover purifiers.", emptyList())
    }

    override suspend fun refresh() = mutex.withLock {
        if (tokenStore.load() == null) {
            _snapshot.value = ProviderSnapshot(providerName, Phase.NEEDS_PERMISSION, "Sign in with your Qubo account to discover purifiers.", emptyList())
            return@withLock
        }
        setPhase(Phase.LOADING, null)
        try {
            val units = api.getUnits()
            if (units.isEmpty()) {
                _snapshot.value = ProviderSnapshot(providerName, Phase.READY, "Signed in, but your Qubo account has no homes/units.", emptyList())
                return@withLock
            }
            val allDevices = units.flatMap { api.getDevicesForUnit(it) }
            devices = allDevices.associateBy { it.deviceUuid }
            val models = allDevices.map { buildModel(it) }
                .sortedWith(compareByDescending<PurifierDeviceModel> { it.supported }.thenBy { it.name })
            _snapshot.value = ProviderSnapshot(providerName, Phase.READY, null, models)
        } catch (e: QuboApiException) {
            val denied = e.httpStatus == 401 || e.httpStatus == 403
            setPhase(if (denied) Phase.PERMISSION_DENIED else Phase.ERROR, e.message)
        } catch (e: Exception) {
            setPhase(Phase.ERROR, "Unexpected error: ${e.message}")
        }
    }

    private suspend fun buildModel(d: QuboDeviceInfo): PurifierDeviceModel {
        val isPurifier = d.model.uppercase().startsWith(QuboConstants.PREFIX_AIR_PURIFIER) ||
            d.deviceType.uppercase().contains("PURIFIER")
        if (!isPurifier) {
            return PurifierDeviceModel(
                id = d.deviceUuid, name = d.name, room = null, connectivity = if (d.isOnline) Connectivity.ONLINE else Connectivity.OFFLINE,
                supported = false, unsupportedReason = "Device model \"${d.model.ifBlank { d.deviceType }}\" is not a Qubo air purifier (HPH series).",
                traits = emptyList(), controls = Controls(power = false, fanMode = false, fanPercent = false),
                state = PurifierState(null, null, null, emptyList()), lastConfirmedAt = null, model = d.model.ifBlank { null },
            )
        }
        val shadow = try { api.getDeviceShadow(d.deviceUuid) } catch (e: Exception) {
            return PurifierDeviceModel(
                id = d.deviceUuid, name = d.name, room = null, connectivity = Connectivity.UNKNOWN,
                supported = true, unsupportedReason = "Could not read device state: ${e.message}",
                traits = listOf("lcSwitchControl", "fanSpeedControl", "fanControlMode"), controls = Controls(false, false, false),
                state = PurifierState(null, null, null, emptyList()), lastConfirmedAt = null, model = d.model,
            )
        }
        return toModel(d, shadow)
    }

    private fun toModel(d: QuboDeviceInfo, shadow: QuboShadow): PurifierDeviceModel {
        val power = asBool(shadow["lcSwitchControl_power"])
        val mode = (shadow["fanControlMode_state"] as? String)?.lowercase()
        val speed = (shadow["fanSpeedControl_speed"] as? String)?.toIntOrNull()
            ?: (shadow["fanSpeedControl_speed"] as? Number)?.toInt()
        val pm25 = (shadow["aqiStatus_PM25"] as? Number)?.toInt() ?: (shadow["aqiStatus_PM25"] as? String)?.toIntOrNull()
        val filterPct = (shadow["filterReset_percentage"] as? Number)?.toInt() ?: (shadow["filterReset_percentage"] as? String)?.toIntOrNull()
        val childLock = asBool(shadow["childLockControl_state"])
        val traitsPresent = listOfNotNull(
            "lcSwitchControl".takeIf { shadow.containsKey("lcSwitchControl_power") },
            "fanSpeedControl".takeIf { shadow.containsKey("fanSpeedControl_speed") },
            "fanControlMode".takeIf { shadow.containsKey("fanControlMode_state") },
            "aqiStatus".takeIf { shadow.containsKey("aqiStatus_PM25") },
            "filterReset".takeIf { shadow.containsKey("filterReset_percentage") },
            "childLockControl".takeIf { shadow.containsKey("childLockControl_state") },
        )
        // Qubo's app exposes these four preset modes; a given HPH model may not honor all of them.
        val modes = listOf("auto", "manual", "sleep", "qsense")
        return PurifierDeviceModel(
            id = d.deviceUuid,
            name = d.name,
            room = null, // qubopy's discovery response does not include a human room/entity name field
            connectivity = if (d.isOnline) Connectivity.ONLINE else Connectivity.OFFLINE,
            supported = true,
            unsupportedReason = null,
            traits = traitsPresent,
            controls = Controls(
                power = shadow.containsKey("lcSwitchControl_power"),
                fanMode = shadow.containsKey("fanControlMode_state"),
                fanPercent = false,
                fanSpeedLevel = shadow.containsKey("fanSpeedControl_speed"),
                childLock = shadow.containsKey("childLockControl_state"),
            ),
            state = PurifierState(
                power = power, fanMode = mode, fanPercent = null,
                fanModesAvailable = if (shadow.containsKey("fanControlMode_state")) modes.map { FanModeOption(it, it.replaceFirstChar(Char::uppercase)) } else emptyList(),
                pm25 = pm25, filterLifePercent = filterPct,
                fanSpeedLevel = speed, fanSpeedLevelsAvailable = if (shadow.containsKey("fanSpeedControl_speed")) listOf(1, 2, 3) else emptyList(),
                childLockOn = childLock,
            ),
            lastConfirmedAt = System.currentTimeMillis(),
            model = d.model.ifBlank { null },
        )
    }

    private fun asBool(v: Any?): Boolean? = when (v) {
        null -> null
        is Boolean -> v
        is String -> when (v.lowercase()) { "on", "enable", "true", "1" -> true; "off", "disable", "false", "0" -> false; else -> null }
        is Number -> v.toInt() != 0
        else -> null
    }

    // ------------------------------------------------------------ commands

    override suspend fun setPower(deviceId: String, on: Boolean): CommandOutcome =
        command(deviceId, "lcSwitchControl", "power", if (on) "on" else "off") { it.state.power == on }

    override suspend fun setFanMode(deviceId: String, modeId: String): CommandOutcome =
        command(deviceId, "fanControlMode", "state", modeId.lowercase()) { it.state.fanMode == modeId.lowercase() }

    override suspend fun setFanSpeedLevel(deviceId: String, level: Int): CommandOutcome {
        if (level !in 1..3) return CommandOutcome(false, false, "Qubo fan speed must be 1, 2 or 3.")
        return command(deviceId, "fanSpeedControl", "speed", level.toString()) { it.state.fanSpeedLevel == level }
    }

    override suspend fun setFanPercent(deviceId: String, percent: Int): CommandOutcome =
        CommandOutcome(false, false, "Qubo purifiers use discrete fan speed levels (1-3), not a percent control.")

    override suspend fun setChildLock(deviceId: String, enabled: Boolean): CommandOutcome =
        command(deviceId, "childLockControl", "state", if (enabled) "enable" else "disable") { it.state.childLockOn == enabled }

    private suspend fun command(deviceId: String, service: String, attribute: String, value: String, matches: (PurifierDeviceModel) -> Boolean): CommandOutcome {
        val device = devices[deviceId] ?: return CommandOutcome(false, false, "Unknown device. Refresh and try again.")
        return try {
            api.setShadowAttribute(device, service, attribute, value)
            var last: PurifierDeviceModel? = null
            repeat(6) {
                delay(700)
                last = buildModel(device)
                if (matches(last!!)) {
                    replaceDevice(last!!)
                    return CommandOutcome(accepted = true, confirmed = true, error = null)
                }
            }
            last?.let { replaceDevice(it) }
            CommandOutcome(accepted = true, confirmed = false, error = null)
        } catch (e: QuboApiException) {
            CommandOutcome(false, false, e.message)
        } catch (e: Exception) {
            CommandOutcome(false, false, "Unexpected error: ${e.message}")
        }
    }

    private fun replaceDevice(m: PurifierDeviceModel) {
        _snapshot.value = _snapshot.value.copy(devices = _snapshot.value.devices.map { if (it.id == m.id) m else it })
    }

    private fun setPhase(phase: Phase, message: String?) {
        _snapshot.value = _snapshot.value.copy(phase = phase, message = message)
    }
}
