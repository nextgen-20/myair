package com.myair.app.provider.qubo

import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

class QuboApiException(message: String, val httpStatus: Int? = null) : IOException(message)

/**
 * Qubo cloud REST client. Endpoint/header shapes verified against selvakk2k/qubopy
 * (qubopy/auth.py, qubopy/client.py) — see QuboConstants.kt. Plain HttpsURLConnection with the
 * platform's default trust manager: no certificate pinning defeat, no custom TrustManager, no
 * cleartext fallback. Every call here authenticates as the signed-in Qubo account, exactly like
 * the official app would.
 *
 * [deviceId] is a random UUID generated once by the caller and persisted alongside the session
 * (see QuboProvider) — it only labels this MyAir install in "Logged In Devices" in the Qubo app,
 * the same way qubopy generates and persists its own `Source-Device-Id`.
 */
class QuboApiClient(
    private var tokens: QuboTokens?,
    private val deviceId: String,
    private val onTokensRefreshed: (QuboTokens) -> Unit,
) {

    private fun connection(path: String, method: String): HttpURLConnection {
        val url = URL(QuboConstants.BASE_URL + path)
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = 15000
        conn.readTimeout = 15000
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("App-Id", QuboConstants.APP_ID)
        conn.setRequestProperty("Source", "Android")
        conn.setRequestProperty("Source-Device-Id", deviceId)
        return conn
    }

    private fun authedConnection(path: String, method: String): HttpURLConnection {
        val t = tokens ?: throw QuboApiException("Not signed in to Qubo.")
        val conn = connection(path, method)
        conn.setRequestProperty("Authorization", "Bearer ${t.accessToken}")
        conn.setRequestProperty("Token-Type", "USER")
        conn.setRequestProperty("User-UUID", t.userUuid)
        conn.setRequestProperty("Subscriber-Key", t.accessToken)
        return conn
    }

    private fun writeBody(conn: HttpURLConnection, body: JSONObject) {
        conn.doOutput = true
        conn.outputStream.use { it.write(body.toString().toByteArray(StandardCharsets.UTF_8)) }
    }

    private fun readBody(conn: HttpURLConnection): Pair<Int, String> {
        val code = conn.responseCode
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        val text = stream?.bufferedReader(StandardCharsets.UTF_8)?.use { it.readText() } ?: ""
        return code to text
    }

    // ------------------------------------------------------------ auth

    suspend fun loginWithEmail(email: String, password: String): QuboTokens = withContext(Dispatchers.IO) {
        val conn = connection(QuboConstants.loginEmailPath(), "POST")
        conn.setRequestProperty("Source", "USER")
        conn.setRequestProperty("Token-Type", "USER")
        writeBody(conn, JSONObject().apply {
            put("username", email); put("email", email); put("password", password)
            put("deviceAttribute", "MyAir")
        })
        val (code, text) = readBody(conn)
        if (code != 200) throw QuboApiException(describeError(code, text), code)
        val data = JSONObject(text)
        val access = data.optString("accessToken", null) ?: data.optString("token", null)
            ?: throw QuboApiException("Qubo login response had no access token.")
        val userUuid = data.optString("uuid", null) ?: data.optString("userUUID", null)
            ?: throw QuboApiException("Qubo login response had no account id.")
        val t = QuboTokens(access, data.optString("refreshToken", null), userUuid, jwtExpiry(access))
        tokens = t
        t
    }

    private suspend fun refresh(): QuboTokens = withContext(Dispatchers.IO) {
        val t = tokens ?: throw QuboApiException("Not signed in to Qubo.")
        val rt = t.refreshToken ?: throw QuboApiException("Session expired; please sign in to Qubo again.")
        val conn = connection(QuboConstants.authRefreshPath(userUuid = t.userUuid), "POST")
        conn.setRequestProperty("Authorization", "Bearer ${t.accessToken}")
        conn.setRequestProperty("Subscriber-Key", t.accessToken)
        conn.setRequestProperty("User-UUID", t.userUuid)
        conn.setRequestProperty("Token-Type", "USER")
        writeBody(conn, JSONObject().apply { put("accessToken", t.accessToken); put("refreshToken", rt) })
        val (code, text) = readBody(conn)
        if (code != 200) { tokens = null; throw QuboApiException("Qubo session refresh rejected; please sign in again.", code) }
        val data = JSONObject(text)
        val access = data.optString("accessToken", null) ?: throw QuboApiException("Refresh response had no access token.")
        val newT = QuboTokens(access, data.optString("refreshToken", rt), t.userUuid, jwtExpiry(access))
        tokens = newT
        onTokensRefreshed(newT)
        newT
    }

    /** Runs [block] once, and once more after a token refresh if the first attempt was rejected as unauthenticated. */
    private suspend fun <T> withAuth(block: suspend () -> T): T {
        val t = tokens
        if (t != null && t.expiresAtEpochSeconds > 0 && t.expiresAtEpochSeconds - nowSeconds() < 300 && t.refreshToken != null) {
            runCatching { refresh() }
        }
        return try {
            block()
        } catch (e: QuboApiException) {
            if (e.httpStatus == 401 && tokens?.refreshToken != null) { refresh(); block() } else throw e
        }
    }

    // ------------------------------------------------------------ discovery

    /**
     * Qubo's REST gateway returns either a bare JSON array, or a JSON object with the list
     * under "data" (sometimes "units"/"devices"). qubopy's own client.py handles both shapes
     * defensively (`get_units`/`get_devices_for_unit`) because even its author could not
     * confirm which one the server sends — so this does the same, rather than assuming one
     * shape and silently returning "no devices" if the other one comes back.
     */
    private fun extractArray(text: String, vararg objectKeys: String): JSONArray {
        val trimmed = text.trim()
        if (trimmed.startsWith("[")) return JSONArray(trimmed)
        if (trimmed.startsWith("{")) {
            val obj = JSONObject(trimmed)
            for (key in objectKeys) {
                obj.optJSONArray(key)?.let { return it }
            }
        }
        return JSONArray()
    }

    suspend fun getUnits(): List<String> = withAuth {
        withContext(Dispatchers.IO) {
            val conn = authedConnection(QuboConstants.unitsPath(), "GET")
            val (code, text) = readBody(conn)
            if (code != 200) throw QuboApiException(describeError(code, text), code)
            val arr = extractArray(text, "data", "units")
            (0 until arr.length()).mapNotNull { i ->
                val o = arr.optJSONObject(i) ?: return@mapNotNull null
                o.optString("unitUUID", null) ?: o.optString("uuid", null) ?: o.optString("unitId", null)
            }
        }
    }

    suspend fun getDevicesForUnit(unitUuid: String): List<QuboDeviceInfo> = withAuth {
        withContext(Dispatchers.IO) {
            val conn = authedConnection(QuboConstants.unitDevicesPath(unitUuid = unitUuid), "GET")
            val (code, text) = readBody(conn)
            if (code != 200) throw QuboApiException(describeError(code, text), code)
            val arr = extractArray(text, "data", "devices")
            (0 until arr.length()).mapNotNull { i ->
                val o = arr.optJSONObject(i) ?: return@mapNotNull null
                val uuid = o.optString("deviceUUID", null) ?: o.optString("deviceId", null) ?: o.optString("uuid", null) ?: return@mapNotNull null
                QuboDeviceInfo(
                    deviceUuid = uuid,
                    name = o.optString("deviceName", o.optString("name", "Qubo Device")),
                    model = o.optString("deviceModel", o.optString("model", o.optString("aModelNo", ""))),
                    deviceType = o.optString("deviceType", o.optString("type", "")),
                    unitUuid = unitUuid,
                    entityUuid = o.optString("entityUUID", o.optString("entityId", uuid)),
                    isOnline = o.optBoolean("isOnline", o.optBoolean("online", true)),
                )
            }
        }
    }

    /** Flattens the v2 shadow's `services[].attributes` into `serviceName_attributeName -> value`,
     * matching qubopy's `_parse_shadow_payload`. */
    suspend fun getDeviceShadow(deviceUuid: String): QuboShadow = withAuth {
        withContext(Dispatchers.IO) {
            val conn = authedConnection(QuboConstants.deviceShadowV2Path(deviceUuid = deviceUuid), "GET")
            val (code, text) = readBody(conn)
            if (code != 200) throw QuboApiException(describeError(code, text), code)
            val root = JSONObject(text)
            val reported = linkedMapOf<String, Any?>()
            val services = root.optJSONArray("services")
            if (services != null) {
                for (i in 0 until services.length()) {
                    val svc = services.optJSONObject(i) ?: continue
                    val svcName = svc.optString("service", null) ?: continue
                    val attrs = svc.optJSONObject("attributes") ?: continue
                    val keys = attrs.keys()
                    while (keys.hasNext()) {
                        val k = keys.next()
                        val v = attrs.opt(k)
                        val value = if (v is JSONObject) v.opt("value") else v
                        if (value != null) reported["${svcName}_$k"] = value
                    }
                }
            }
            reported
        }
    }

    /** PUT {instanceId, serviceName, attributeName, attributeValue} to the shadow/attribute route —
     * the exact envelope QuboAirPurifier.set_* calls use (qubopy/devices/purifier.py, base.py write_attribute). */
    suspend fun setShadowAttribute(device: QuboDeviceInfo, serviceName: String, attributeName: String, value: String): Unit = withAuth {
        withContext(Dispatchers.IO) {
            val conn = authedConnection(
                QuboConstants.updateShadowAttributePath(unitUuid = device.unitUuid, entityUuid = device.entityUuid, deviceUuid = device.deviceUuid),
                "PUT",
            )
            writeBody(conn, JSONObject().apply {
                put("instanceId", 0); put("serviceName", serviceName); put("attributeName", attributeName); put("attributeValue", value)
            })
            val (code, text) = readBody(conn)
            if (code !in 200..299) throw QuboApiException(describeError(code, text), code)
        }
    }

    private fun describeError(code: Int, text: String): String = try {
        val o = JSONObject(text)
        val msg = o.optString("message", o.optString("errorMessage", null))
        val err = o.optString("code", o.optString("error", null))
        when {
            !msg.isNullOrBlank() && !err.isNullOrBlank() -> "Qubo API error (HTTP $code: $err — $msg)"
            !msg.isNullOrBlank() -> "Qubo API error (HTTP $code: $msg)"
            else -> "Qubo API error (HTTP $code)"
        }
    } catch (e: Exception) { "Qubo API error (HTTP $code)" }

    private fun jwtExpiry(token: String): Long = try {
        val parts = token.split(".")
        val payload = String(Base64.decode(parts[1].replace('-', '+').replace('_', '/'), Base64.DEFAULT), StandardCharsets.UTF_8)
        JSONObject(payload).optLong("exp", nowSeconds() + 86400)
    } catch (e: Exception) { nowSeconds() + 86400 }

    private fun nowSeconds(): Long = System.currentTimeMillis() / 1000
}
