package com.myair.app

import android.app.Application
import com.myair.app.provider.PurifierProvider
import com.myair.app.provider.UnavailablePurifierProvider
import com.myair.app.provider.qubo.QuboProvider

/** Home APIs recommends a single Home client per process, so providers live here, one per
 * process, for the app's whole lifetime. Google Home and Qubo are independent providers —
 * neither one's code is reachable from the other.
 *
 * Google Home is currently set aside: the real GoogleHomePurifierProvider.kt (unmodified) has
 * been moved to docs/google-home-disabled/ because its required SDK
 * (com.google.android.gms:play-services-home / play-services-home-types) is not resolvable from
 * any public Maven repository (see docs/GOOGLE_HOME_SDK_SETUP.md). UnavailablePurifierProvider
 * reports an honest "set aside" state instead of faking Google Home support. Qubo and IR Remote
 * are unaffected. */
class MyAirApp : Application() {
    lateinit var googleHomeProvider: PurifierProvider
        private set
    lateinit var quboProvider: PurifierProvider
        private set

    override fun onCreate() {
        super.onCreate()
        googleHomeProvider = UnavailablePurifierProvider(
            "Google Home is set aside in this build: the Home APIs SDK (play-services-home) " +
                "is not available from any public Maven repository. See docs/GOOGLE_HOME_SDK_SETUP.md."
        )
        quboProvider = QuboProvider(this)
    }
}
