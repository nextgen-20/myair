package com.myair.app.bridge

import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.myair.app.ir.IrRemoteController
import com.myair.app.ir.toJson
import com.myair.app.provider.CommandOutcome
import com.myair.app.provider.CredentialAuthProvider
import com.myair.app.provider.PurifierProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/**
 * JS interface exposed to the web dashboard as `window.MyAirNative`.
 * The web side never sees Google/Qubo SDK or network types — only the JSON from Json.kt.
 *
 * Google Home and Qubo are two independent providers with their own bridge channels
 * (`google*` / `qubo*`), so neither implementation depends on or can be confused with the other.
 */
class NativeBridge(
    private val googleHome: PurifierProvider,
    private val qubo: PurifierProvider,
    private val ir: IrRemoteController,
    private val webView: WebView,
    private val scope: CoroutineScope, // must run on Main
) {
    private fun runCommand(provider: PurifierProvider, requestId: String, callback: String, json: String) {
        scope.launch {
            val outcome = try {
                val o = JSONObject(json)
                val id = o.getString("deviceId")
                when (o.getString("type")) {
                    "power" -> provider.setPower(id, o.getBoolean("on"))
                    "fanMode" -> provider.setFanMode(id, o.getString("modeId"))
                    "fanPercent" -> provider.setFanPercent(id, o.getInt("percent"))
                    "fanSpeedLevel" -> provider.setFanSpeedLevel(id, o.getInt("level"))
                    "childLock" -> provider.setChildLock(id, o.getBoolean("enabled"))
                    else -> CommandOutcome(false, false, "Unknown command.")
                }
            } catch (e: Exception) {
                CommandOutcome(false, false, "Bad command request: ${e.message}")
            }
            webView.evaluateJavascript(
                "window.$callback&&window.$callback(${JSONObject.quote(requestId)},${JSONObject.quote(outcome.toJson())})", null,
            )
        }
    }

    // --- Google Home channel (unchanged behaviour from the original single-provider bridge) ---

    @JavascriptInterface
    fun getSnapshot(): String = googleHome.snapshot.value.toJson()
    @JavascriptInterface
    fun requestPermissions() { scope.launch { googleHome.requestPermissions() } }
    @JavascriptInterface
    fun refresh() { scope.launch { googleHome.refresh() } }
    @JavascriptInterface
    fun command(requestId: String, json: String) = runCommand(googleHome, requestId, "__myairOnCommand", json)

    fun pushSnapshot(json: String) {
        webView.evaluateJavascript("window.__myairOnSnapshot&&window.__myairOnSnapshot(${JSONObject.quote(json)})", null)
    }

    // --- Qubo channel (cloud-account provider; see QuboProvider.kt) ---

    @JavascriptInterface
    fun quboGetSnapshot(): String = qubo.snapshot.value.toJson()
    @JavascriptInterface
    fun quboRefresh() { scope.launch { qubo.refresh() } }
    @JavascriptInterface
    fun quboCommand(requestId: String, json: String) = runCommand(qubo, requestId, "__myairOnQuboCommand", json)

    @JavascriptInterface
    fun quboSignIn(requestId: String, email: String, password: String) {
        scope.launch {
            val outcome = (qubo as CredentialAuthProvider).signIn(email, password)
            webView.evaluateJavascript(
                "window.__myairOnQuboAuth&&window.__myairOnQuboAuth(${JSONObject.quote(requestId)},${JSONObject.quote(outcome.toJson())})", null,
            )
        }
    }

    @JavascriptInterface
    fun quboSignOut() { scope.launch { (qubo as CredentialAuthProvider).signOut() } }

    fun pushQuboSnapshot(json: String) {
        webView.evaluateJavascript("window.__myairOnQuboSnapshot&&window.__myairOnQuboSnapshot(${JSONObject.quote(json)})", null)
    }

    // --- Add Remote (Consumer IR). Separate from purifier control; see IrRemoteController. ---

    @JavascriptInterface
    fun hasInfraredHardware(): Boolean = ir.hasInfraredHardware()

    @JavascriptInterface
    fun supportedIrFrequencies(): String = JSONArray(ir.supportedCarrierFrequencies().toList()).toString()

    /** payload: {"mode":"nec","address":N,"command":N} or {"mode":"raw","frequencyHz":N,"pattern":[...]} */
    @JavascriptInterface
    fun transmitIr(requestId: String, json: String) {
        val result = try {
            val o = JSONObject(json)
            when (o.getString("mode")) {
                "nec" -> ir.transmitNec(o.getInt("address"), o.getInt("command"))
                "raw" -> {
                    val arr = o.getJSONArray("pattern")
                    val pattern = IntArray(arr.length()) { arr.getInt(it) }
                    ir.transmitRaw(o.getInt("frequencyHz"), pattern)
                }
                else -> IrRemoteController.TransmitResult.Failed("Unknown IR mode.")
            }
        } catch (e: Exception) {
            IrRemoteController.TransmitResult.Failed("Bad IR request: ${e.message}")
        }
        webView.evaluateJavascript(
            "window.__myairOnIrResult&&window.__myairOnIrResult(${JSONObject.quote(requestId)},${JSONObject.quote(result.toJson())})", null,
        )
    }
}
