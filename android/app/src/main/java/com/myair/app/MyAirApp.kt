package com.myair.app

import android.app.Application
import com.myair.app.provider.GoogleHomePurifierProvider
import com.myair.app.provider.PurifierProvider
import com.myair.app.provider.qubo.QuboProvider

/** Home APIs recommends a single Home client per process, so providers live here, one per
 * process, for the app's whole lifetime. Google Home and Qubo are independent providers —
 * neither one's code is reachable from the other. */
class MyAirApp : Application() {
    lateinit var googleHomeProvider: PurifierProvider
        private set
    lateinit var quboProvider: PurifierProvider
        private set

    override fun onCreate() {
        super.onCreate()
        googleHomeProvider = GoogleHomePurifierProvider(this)
        quboProvider = QuboProvider(this)
    }
}
