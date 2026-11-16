package dev.openlyrics.sdk

import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface

/**
 * OpenLyryc JavaScriptInterface Bridge
 * Receives real-time user gestures and lifecycle callbacks from the OpenLyryc kinetic renderer.
 */
class OpenLyrycBridge(
    private val onSeekCallback: ((Double) -> Unit)? = null,
    private val onLyricsLoadedCallback: ((String, String, Double) -> Unit)? = null,
    private val onReadyCallback: (() -> Unit)? = null,
    private val onErrorCallback: ((String) -> Unit)? = null
) {
    private val mainHandler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun onSeek(seconds: Double) {
        mainHandler.post {
            onSeekCallback?.invoke(seconds)
        }
    }

    @JavascriptInterface
    fun onLyricsLoaded(title: String, artist: String, duration: Double) {
        mainHandler.post {
            onLyricsLoadedCallback?.invoke(title, artist, duration)
        }
    }

    @JavascriptInterface
    fun onReady() {
        mainHandler.post {
            onReadyCallback?.invoke()
        }
    }

    @JavascriptInterface
    fun onError(message: String) {
        mainHandler.post {
            onErrorCallback?.invoke(message)
        }
    }
}
