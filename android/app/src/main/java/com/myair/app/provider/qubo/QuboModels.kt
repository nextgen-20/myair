package com.myair.app.provider.qubo

/** Mirrors qubopy's TokenPayload (qubopy/models.py). */
data class QuboTokens(
    val accessToken: String,
    val refreshToken: String?,
    val userUuid: String,
    val expiresAtEpochSeconds: Long,
)

/** Mirrors the fields qubopy/models.py's DeviceModelInfo reads off the raw discovery JSON. */
data class QuboDeviceInfo(
    val deviceUuid: String,
    val name: String,
    val model: String,
    val deviceType: String,
    val unitUuid: String,
    val entityUuid: String,
    val isOnline: Boolean,
)

/** Flattened `reported` shadow map, keyed exactly as Qubo's cloud returns it (serviceName_attributeName). */
typealias QuboShadow = Map<String, Any?>
