package com.myair.app.provider.qubo

/**
 * Endpoint paths, headers and prefixes verified by inspecting selvakk2k/qubopy (MIT license),
 * specifically qubopy/const.py, qubopy/auth.py and qubopy/devices/purifier.py. MyAir does not
 * depend on qubopy as code (it's a Python package); these are the protocol facts it documents,
 * reimplemented here natively in Kotlin using the user's own Qubo account credentials over
 * Qubo's real cloud, with ordinary platform TLS verification (no bypass, no pinning defeat).
 *
 * qubopy itself notes these endpoints were determined by static inspection of Qubo's own
 * published Android app (`com.hero.iot`) — not by bypassing authentication, breaking encryption,
 * or intercepting someone else's traffic. See docs/QUBO_INVESTIGATION.md for the full trail.
 */
object QuboConstants {
    const val BASE_URL = "https://srvcapp.platform.quboworld.com:443"
    const val SP_ID = "d10e4bfb0153496e8e8bb955f7ebe413" // fixed service-provider id used by every install of the Qubo app
    const val APP_ID = "com.hero.iot"

    fun loginEmailPath(sp: String = SP_ID) = "/sms/api/v1/sp/$sp/user/login?system=CS"
    fun authRefreshPath(sp: String = SP_ID, userUuid: String) = "/sms/api/v1/sp/$sp/users/$userUuid/auth/refresh"
    fun unitsPath(sp: String = SP_ID) = "/unit-entity-management/api/v1/sp/$sp/units"
    fun unitDevicesPath(sp: String = SP_ID, unitUuid: String) = "/unit-entity-management/api/v1/sp/$sp/units/$unitUuid/devices"
    fun deviceShadowV2Path(sp: String = SP_ID, deviceUuid: String) = "/unit-entity-management/api/v2/sp/$sp/devices/$deviceUuid/deviceshadow"
    fun updateShadowAttributePath(sp: String = SP_ID, unitUuid: String, entityUuid: String, deviceUuid: String) =
        "/unit-entity-management/api/v1/sp/$sp/units/$unitUuid/entities/$entityUuid/devices/$deviceUuid/shadow/attribute"

    /** Model prefix for Qubo's HPH air-purifier family (HPH01..HPH08 / Q200..Q1000, including the R250 = HPH06). */
    const val PREFIX_AIR_PURIFIER = "HPH"
}
