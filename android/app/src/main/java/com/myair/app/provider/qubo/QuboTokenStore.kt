package com.myair.app.provider.qubo

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Stores the Qubo session (account-issued access/refresh token, never a password) in
 * Android's Keystore-backed EncryptedSharedPreferences. Nothing here is ever sent to the
 * WebView/JS layer — only sanitized device-state JSON crosses that bridge (see Json.kt).
 */
class QuboTokenStore(context: Context) {
    private val masterKey = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
    private val prefs = EncryptedSharedPreferences.create(
        context, "myair_qubo_session", masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    fun load(): QuboTokens? {
        val access = prefs.getString(KEY_ACCESS, null) ?: return null
        val userUuid = prefs.getString(KEY_USER, null) ?: return null
        val expires = prefs.getLong(KEY_EXPIRES, 0L)
        return QuboTokens(access, prefs.getString(KEY_REFRESH, null), userUuid, expires)
    }

    fun save(tokens: QuboTokens) {
        prefs.edit()
            .putString(KEY_ACCESS, tokens.accessToken)
            .putString(KEY_REFRESH, tokens.refreshToken)
            .putString(KEY_USER, tokens.userUuid)
            .putLong(KEY_EXPIRES, tokens.expiresAtEpochSeconds)
            .apply()
    }

    fun clear() { prefs.edit().clear().apply() }

    companion object {
        private const val KEY_ACCESS = "access_token"
        private const val KEY_REFRESH = "refresh_token"
        private const val KEY_USER = "user_uuid"
        private const val KEY_EXPIRES = "expires_at"
    }
}
