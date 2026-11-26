package com.myair.app.ir

import android.content.Context
import android.content.pm.PackageManager
import android.hardware.ConsumerIrManager
import org.json.JSONObject

/**
 * Real Android Consumer IR transmit support (android.hardware.ConsumerIrManager).
 *
 * IMPORTANT SCOPE NOTE: Android has a transmit-only IR API. There is no public Android API to
 * receive (i.e. learn) an IR signal from an existing remote, so this cannot be a "point your old
 * remote at the phone and learn it" feature. It also ships with NO built-in brand code database — Qubo and
 * most consumer-electronics IR code sets are proprietary and were not available to source honestly,
 * so inventing hex codes would mean fake commands that silently do nothing on a real TV/AC. Instead:
 *   - MyAir detects real IR hardware and refuses to show remote controls if it's absent.
 *   - MyAir encodes standard, publicly documented IR protocols (currently NEC) from a device address
 *     + command number you (or a future verified code-set) provide, and transmits the real pattern.
 *   - A "raw pattern" mode accepts a known on/off microsecond pattern directly (e.g. captured with a
 *     logic analyzer, or from a LIRC conf file you trust) for any protocol.
 */
class IrRemoteController(private val context: Context) {

    fun hasInfraredHardware(): Boolean =
        context.packageManager.hasSystemFeature(PackageManager.FEATURE_CONSUMER_IR)

    private val manager: ConsumerIrManager? by lazy {
        if (hasInfraredHardware()) context.getSystemService(Context.CONSUMER_IR_SERVICE) as? ConsumerIrManager else null
    }

    /** Carrier frequencies this phone's IR blaster actually supports, or empty if none/no hardware. */
    fun supportedCarrierFrequencies(): IntArray =
        manager?.carrierFrequencies?.map { it.minFrequency }?.toIntArray() ?: IntArray(0)

    sealed interface TransmitResult {
        data class Sent(val frequencyHz: Int, val patternLength: Int) : TransmitResult
        data class Failed(val reason: String) : TransmitResult
    }

    /** Transmits an exact on/off microsecond pattern at the given carrier frequency. */
    fun transmitRaw(frequencyHz: Int, pattern: IntArray): TransmitResult {
        val m = manager ?: return TransmitResult.Failed("This phone has no IR blaster (ConsumerIrManager unavailable).")
        if (pattern.isEmpty()) return TransmitResult.Failed("Empty pattern.")
        return try {
            m.transmit(frequencyHz, pattern)
            TransmitResult.Sent(frequencyHz, pattern.size)
        } catch (e: Exception) {
            TransmitResult.Failed("Transmit failed: ${e.message}")
        }
    }

    /**
     * Encodes a standard NEC-protocol frame (address, command) and transmits it at 38kHz.
     * NEC is a published, royalty-free IR protocol (not Qubo- or brand-specific); using it does not
     * require or imply knowledge of any proprietary Qubo/brand code table.
     */
    fun transmitNec(address: Int, command: Int): TransmitResult {
        if (address !in 0..0xFF || command !in 0..0xFF) return TransmitResult.Failed("NEC address/command must be 0-255.")
        return transmitRaw(38000, NecProtocol.encode(address, command))
    }
}

/** NEC IR protocol frame encoder. Timings per the public NEC IR specification. */
object NecProtocol {
    private const val UNIT = 562 // microseconds

    fun encode(address: Int, command: Int): IntArray {
        val invAddress = address.inv() and 0xFF
        val invCommand = command.inv() and 0xFF
        val bits = buildList {
            addAll(byteBitsLsbFirst(address))
            addAll(byteBitsLsbFirst(invAddress))
            addAll(byteBitsLsbFirst(command))
            addAll(byteBitsLsbFirst(invCommand))
        }
        val pattern = mutableListOf(9000, 4500) // leader
        for (bit in bits) {
            pattern.add(UNIT) // mark
            pattern.add(if (bit) UNIT * 3 else UNIT) // space
        }
        pattern.add(UNIT) // final mark
        return pattern.toIntArray()
    }

    private fun byteBitsLsbFirst(byte: Int): List<Boolean> = (0 until 8).map { ((byte shr it) and 1) == 1 }
}

fun IrRemoteController.TransmitResult.toJson(): String = when (this) {
    is IrRemoteController.TransmitResult.Sent -> JSONObject()
        .put("sent", true).put("frequencyHz", frequencyHz).put("patternLength", patternLength).toString()
    is IrRemoteController.TransmitResult.Failed -> JSONObject().put("sent", false).put("error", reason).toString()
}
