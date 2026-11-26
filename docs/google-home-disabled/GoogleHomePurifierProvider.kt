package com.myair.app.provider

import android.content.Context
import android.util.Log
import androidx.activity.ComponentActivity
import com.google.home.DeviceType
import com.google.home.FactoryRegistry
import com.google.home.Home
import com.google.home.HomeClient
import com.google.home.HomeConfig
import com.google.home.HomeDevice
import com.google.home.HomeException
import com.google.home.PermissionsResultStatus
import com.google.home.PermissionsState
import com.google.home.Trait
import com.google.home.matter.standard.AirPurifierDevice
import com.google.home.matter.standard.FanControl
import com.google.home.matter.standard.FanControl.Companion.setFanMode
import com.google.home.matter.standard.FanControl.Companion.setPercentSetting
import com.google.home.matter.standard.FanControlTrait
import com.google.home.matter.standard.OnOff
import com.google.home.matter.standard.Pm25ConcentrationMeasurement
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

/**
 * The ONLY file that talks to Google Home Home APIs for Android.
 *
 * Everything surfaced is read from the SDK. Nothing is cached across process restarts, nothing is
 * simulated. If the SDK throws, the error is surfaced; if a trait is absent, the control is absent.
 *
 * NOTE ON VERIFICATION: written against Google's public Home APIs Kotlin reference
 * (developers.home.google.com/reference/kotlin/com/google/home/...) and the official sample app,
 * in an environment with no Android SDK and no access to the (sign-in-gated beta) Home APIs
 * artifact, so nothing here was compiled against the real SDK. Every symbol below was confirmed,
 * verbatim, on Google's reference site EXCEPT:
 *   - `HomeDevice.rooms()` / `Room.name` — HomeDevice's interface list includes `HasRooms`, so a
 *     `rooms()`-shaped accessor almost certainly exists, but its exact signature wasn't shown.
 *   - `HomeDevice.name` — used by analogy with every other named type in this API; not shown
 *     verbatim for HomeDevice specifically.
 * If the compiler disagrees with either of those two, they are the first two things to check.
 * Confirmed verbatim: FactoryRegistry/HomeConfig/Home.getClient, client.hasPermissions()/
 * requestPermissions(), PermissionsState/PermissionsResultStatus (package com.google.home),
 * device.types()/type.traits()/trait.supports(...), OnOff.on()/off()/Command.{On,Off},
 * FanControl.Attribute.{fanMode,percentSetting}, FanControlTrait.FanModeEnum,
 * FanControl.Companion.{setFanMode,setPercentSetting} used inside `trait.update { ... }`,
 * Pm25ConcentrationMeasurement.measuredValue, and `metadata.sourceConnectivity.connectivityState`.
 */
class GoogleHomePurifierProvider(context: Context) : PurifierProvider {

    override val providerName = "Google Home (Home APIs)"
    private val tag = "MyAir/GoogleHome"

    // Traits/types must be registered to be returned by bulk traits()/types() calls.
    private val client: HomeClient = Home.getClient(
        context.applicationContext,
        HomeConfig(
            coroutineContext = Dispatchers.IO,
            factoryRegistry = FactoryRegistry(
                traits = listOf(OnOff, FanControl),
                types = listOf(AirPurifierDevice),
            ),
        ),
    )

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val mutex = Mutex()
    private val watchers = mutableListOf<Job>()
    private val handles = mutableMapOf<String, HomeDevice>()

    private val _snapshot = MutableStateFlow(ProviderSnapshot(providerName, Phase.LOADING, null, emptyList()))
    override val snapshot: StateFlow<ProviderSnapshot> = _snapshot

    override fun bindActivity(activity: ComponentActivity) {
        client.registerActivityResultCallerForPermissions(activity)
    }

    // ---------------------------------------------------------------- permissions + discovery

    override suspend fun refresh() = mutex.withLock {
        setPhase(Phase.LOADING, null, keepDevices = false)
        cancelWatchers()
        try {
            val state = withTimeoutOrNull(15_000) {
                client.hasPermissions().first { it != PermissionsState.PERMISSIONS_STATE_UNINITIALIZED }
            }
            when (state) {
                null -> setPhase(Phase.ERROR, "Timed out waiting for Google Home permission state. Is Google Play services up to date?")
                PermissionsState.GRANTED -> loadDevices()
                PermissionsState.NOT_GRANTED -> setPhase(Phase.NEEDS_PERMISSION, "MyAir has not been granted access to your Google Home yet.")
                else -> setPhase(
                    Phase.ERROR,
                    "Google Home permissions state is unavailable ($state). Check Google Play services and that the OAuth client in Google Cloud matches this app's package name and signing SHA-1.",
                )
            }
        } catch (e: HomeException) {
            reportHomeException(e)
        } catch (e: Exception) {
            Log.e(tag, "refresh failed", e)
            setPhase(Phase.ERROR, "Unexpected error: ${e.message}")
        }
    }

    override suspend fun requestPermissions() {
        withContext(Dispatchers.Main) {
            try {
                val result = client.requestPermissions()
                when (result.status) {
                    PermissionsResultStatus.SUCCESS -> Unit // refresh below re-reads the real state
                    PermissionsResultStatus.CANCELLED ->
                        setPhase(Phase.PERMISSION_DENIED, "You closed the Google permission screen without granting access.")
                    else -> setPhase(
                        Phase.ERROR,
                        "Google could not open or complete the permission flow: ${result.errorMessage ?: "no details"}. " +
                            "Usually this means the OAuth client / test user / SHA-1 is not configured. See docs/GOOGLE_HOME_SETUP.md.",
                    )
                }
            } catch (e: HomeException) {
                reportHomeException(e)
                return@withContext
            }
        }
        // Always re-verify rather than trusting the result of the flow.
        if (_snapshot.value.phase != Phase.PERMISSION_DENIED && _snapshot.value.phase != Phase.ERROR) refresh()
    }

    private suspend fun loadDevices() {
        val devices = client.devices().list()
        handles.clear()
        val models = devices.map { d ->
            handles[d.id.id] = d
            buildModel(d)
        }.sortedWith(compareByDescending<PurifierDeviceModel> { it.supported }.thenBy { it.name })
        _snapshot.value = ProviderSnapshot(providerName, Phase.READY, null, models)

        // Live updates: every emission is a real read from Home APIs.
        models.filter { it.supported }.forEach { m ->
            val handle = handles[m.id] ?: return@forEach
            watchers += scope.launch {
                try {
                    handle.types().drop(1).collect {
                        replaceDevice(buildModel(handle))
                    }
                } catch (e: HomeException) {
                    Log.w(tag, "watch failed for ${m.id}", e)
                } catch (e: kotlinx.coroutines.CancellationException) {
                    throw e
                } catch (e: Exception) {
                    Log.w(tag, "watch failed for ${m.id}", e)
                }
            }
        }
    }

    /** HomeDevice implements HasRooms (per the Home APIs interface list); exact accessor
     * signature wasn't shown verbatim on the reference site — see file header note. */
    private suspend fun roomOf(device: HomeDevice): String? =
        runCatching { device.rooms().first().firstOrNull()?.name }.getOrNull()

    // ---------------------------------------------------------------- reading a device

    private suspend fun buildModel(device: HomeDevice): PurifierDeviceModel {
        val types: Set<DeviceType> = device.types().first()
        val purifier = types.filterIsInstance<AirPurifierDevice>().firstOrNull()
        val allTraits: List<Trait> = types.flatMap { it.traits() }
        val traitNames = allTraits.map { it::class.simpleName ?: "UnknownTrait" }.distinct().sorted()
        val connectivity = connectivityOf(purifier ?: types.firstOrNull())
        val fan = allTraits.filterIsInstance<FanControl>().firstOrNull()
        val onOff = allTraits.filterIsInstance<OnOff>().firstOrNull()
        // Not part of AirPurifierDevice's documented required/optional trait list, but read
        // defensively in case a device exposes it anyway — never assumed present.
        val pm25Trait = allTraits.filterIsInstance<Pm25ConcentrationMeasurement>().firstOrNull()

        val unsupported: String? = when {
            purifier == null ->
                "Device type is ${types.map { it::class.simpleName }.ifEmpty { listOf("unknown") }.joinToString()}, not AirPurifierDevice."
            fan == null -> "AirPurifierDevice did not expose the FanControl trait."
            else -> null
        }

        val powerControl = onOff != null && onOff.supports(OnOff.Command.On) && onOff.supports(OnOff.Command.Off)
        val modes = fan?.let(::availableFanModes).orEmpty()
        val modeControl = fan != null && fan.supports(FanControl.Attribute.fanMode) && modes.isNotEmpty()
        val percentControl = fan != null && fan.supports(FanControl.Attribute.percentSetting)

        return PurifierDeviceModel(
            id = device.id.id,
            name = device.name,
            room = roomOf(device),
            connectivity = connectivity,
            supported = unsupported == null,
            unsupportedReason = unsupported,
            traits = traitNames,
            controls = Controls(
                power = unsupported == null && powerControl,
                fanMode = unsupported == null && modeControl,
                fanPercent = unsupported == null && percentControl,
            ),
            state = PurifierState(
                power = if (powerControl) onOff?.onOff else null,
                fanMode = fan?.fanMode?.name,
                fanPercent = fan?.percentSetting?.toInt(),
                fanModesAvailable = modes,
                pm25 = pm25Trait?.measuredValue?.toInt(),
            ),
            lastConfirmedAt = System.currentTimeMillis(),
        )
    }

    /** Derived from the device's own FanModeSequence — never assumed. */
    private fun availableFanModes(fan: FanControl): List<FanModeOption> {
        val seq = fan.fanModeSequence?.name ?: return emptyList() // e.g. "OffLowMedHighAuto"
        return buildList {
            if (seq.contains("Off")) add(FanModeOption("Off", "Off"))
            if (seq.contains("Low")) add(FanModeOption("Low", "Low"))
            if (seq.contains("Med")) add(FanModeOption("Medium", "Medium"))
            if (seq.contains("High")) add(FanModeOption("High", "High"))
            if (seq.contains("Auto")) add(FanModeOption("Auto", "Auto"))
        }
    }

    private fun connectivityOf(type: DeviceType?): Connectivity =
        when (type?.metadata?.sourceConnectivity?.connectivityState?.name) {
            "ONLINE" -> Connectivity.ONLINE
            "PARTIALLY_ONLINE" -> Connectivity.PARTIALLY_ONLINE // Google: show as "Online"
            "OFFLINE" -> Connectivity.OFFLINE
            else -> Connectivity.UNKNOWN
        }

    // ---------------------------------------------------------------- commands

    override suspend fun setPower(deviceId: String, on: Boolean): CommandOutcome = command(deviceId) { traits ->
        val onOff = traits.filterIsInstance<OnOff>().firstOrNull()
            ?: return@command Prepared.Rejected("This device does not expose the OnOff trait.")
        Prepared.Run({ if (on) onOff.on() else onOff.off() }) { it.state.power == on }
    }

    override suspend fun setFanMode(deviceId: String, modeId: String): CommandOutcome = command(deviceId) { traits ->
        val fan = traits.filterIsInstance<FanControl>().firstOrNull()
            ?: return@command Prepared.Rejected("This device does not expose the FanControl trait.")
        if (availableFanModes(fan).none { it.id == modeId }) {
            return@command Prepared.Rejected("Fan mode \"$modeId\" is not in this device's FanModeSequence.")
        }
        val mode = FanControlTrait.FanModeEnum.entries.firstOrNull { it.name == modeId }
            ?: return@command Prepared.Rejected("Unknown fan mode \"$modeId\".")
        Prepared.Run({ fan.update { setFanMode(mode) } }) { it.state.fanMode == modeId }
    }

    override suspend fun setFanPercent(deviceId: String, percent: Int): CommandOutcome = command(deviceId) { traits ->
        val fan = traits.filterIsInstance<FanControl>().firstOrNull()
            ?: return@command Prepared.Rejected("This device does not expose the FanControl trait.")
        if (!fan.supports(FanControl.Attribute.percentSetting)) {
            return@command Prepared.Rejected("This device does not support setting fan speed percent.")
        }
        val p = percent.coerceIn(1, 100)
        Prepared.Run({ fan.update { setPercentSetting(p.toUByte()) } }) { it.state.fanPercent == p }
    }

    private sealed interface Prepared {
        class Rejected(val reason: String) : Prepared
        class Run(val action: suspend () -> Unit, val matches: (PurifierDeviceModel) -> Boolean) : Prepared
    }

    private suspend fun command(deviceId: String, prepare: (List<Trait>) -> Prepared): CommandOutcome {
        return try {
            val handle = handles[deviceId] ?: return CommandOutcome(false, false, "Unknown device. Refresh and try again.")
            val traits = handle.types().first().flatMap { it.traits() }
            when (val p = prepare(traits)) {
                is Prepared.Rejected -> CommandOutcome(false, false, p.reason)
                is Prepared.Run -> {
                    p.action() // throws HomeException if Google Home rejects / device unreachable
                    var last: PurifierDeviceModel? = null
                    repeat(8) {
                        last = buildModel(handle) // fresh read
                        if (p.matches(last!!)) {
                            replaceDevice(last!!)
                            return CommandOutcome(accepted = true, confirmed = true, error = null)
                        }
                        delay(500)
                    }
                    last?.let { replaceDevice(it) }
                    // Accepted, but a read-back never showed the requested state => NOT confirmed.
                    CommandOutcome(accepted = true, confirmed = false, error = null)
                }
            }
        } catch (e: HomeException) {
            CommandOutcome(false, false, describe(e))
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            CommandOutcome(false, false, "Unexpected error: ${e.message}")
        }
    }

    // ---------------------------------------------------------------- helpers

    private fun replaceDevice(m: PurifierDeviceModel) = _snapshot.update { s ->
        s.copy(devices = s.devices.map { if (it.id == m.id) m else it })
    }

    private fun setPhase(phase: Phase, message: String?, keepDevices: Boolean = false) = _snapshot.update {
        it.copy(phase = phase, message = message, devices = if (keepDevices) it.devices else emptyList())
    }

    private fun reportHomeException(e: HomeException) {
        Log.w(tag, "HomeException", e)
        val denied = e.code.toString().contains("PERMISSION_DENIED")
        setPhase(if (denied) Phase.PERMISSION_DENIED else Phase.ERROR, describe(e))
    }

    private fun describe(e: HomeException): String = "${e.code}: ${e.message ?: "no message"}"

    private fun cancelWatchers() { watchers.forEach { it.cancel() }; watchers.clear() }
}
