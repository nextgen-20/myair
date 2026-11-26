package com.myair.app

import android.annotation.SuppressLint
import android.graphics.Color
import android.Manifest
import android.content.pm.PackageManager
import android.webkit.GeolocationPermissions
import android.webkit.WebChromeClient
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.webkit.WebViewAssetLoader
import com.myair.app.bridge.NativeBridge
import com.myair.app.bridge.toJson
import com.myair.app.ir.IrRemoteController
import kotlinx.coroutines.launch

/** Hosts the existing MyAir web dashboard (built from ../dist into assets) and the Home APIs bridge. */
class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var bridge: NativeBridge

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as MyAirApp
        val googleHome = app.googleHomeProvider
        val qubo = app.quboProvider

        // Must happen in onCreate: lets the Home APIs launch Google's permission UI.
        googleHome.bindActivity(this)
        qubo.bindActivity(this) // no-op for Qubo (cloud-account sign-in, no system permission UI)

        webView = WebView(this).apply { setBackgroundColor(Color.parseColor("#071426")) }
        setContentView(webView)
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), 42)
        }

        val assets = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        webView.settings.apply {
            javaScriptEnabled = true
            // React uses localStorage for theme/session state. Android WebView does not
            // guarantee DOM storage is enabled by default, so enable it explicitly.
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = false
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
                val granted = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                    checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                callback.invoke(origin, granted, false)
                if (!granted) requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), 42)
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assets.shouldInterceptRequest(request.url)

            // The JS bridge is only reachable from our own bundled origin: block all other navigation.
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                request.url.host != WebViewAssetLoader.DEFAULT_DOMAIN
        }
        bridge = NativeBridge(googleHome, qubo, IrRemoteController(this), webView, lifecycleScope)
        webView.addJavascriptInterface(bridge, "MyAirNative")
        webView.loadUrl("https://${WebViewAssetLoader.DEFAULT_DOMAIN}/assets/index.html")

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else { isEnabled = false; onBackPressedDispatcher.onBackPressed() }
            }
        })

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                // Permissions/session must be re-checked on every app start (they can be revoked).
                launch { googleHome.refresh() }
                launch { qubo.refresh() }
                launch { googleHome.snapshot.collect { bridge.pushSnapshot(it.toJson()) } }
                launch { qubo.snapshot.collect { bridge.pushQuboSnapshot(it.toJson()) } }
            }
        }
    }

    private fun showStartupError(message: String) {
        val errorView = TextView(this).apply {
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#071426"))
            textSize = 15f
            gravity = android.view.Gravity.CENTER
            setPadding(40, 40, 40, 40)
            text = "MyAir\\n\\n$message"
        }
        setContentView(errorView)
    }

    override fun onDestroy() {
        webView.removeJavascriptInterface("MyAirNative")
        webView.destroy()
        super.onDestroy()
    }
}
