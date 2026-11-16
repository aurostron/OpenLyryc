package dev.openlyrics.sdk

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.net.Uri
import android.util.AttributeSet
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout

/**
 * OpenLyrycView — Turnkey Android View for synchronized cinema & kinetic lyrics.
 * Embeds the distraction-free OpenLyryc pure stage with sub-millisecond audio sync.
 */
@SuppressLint("SetJavaScriptEnabled")
class OpenLyrycView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    private val webView: WebView = WebView(context)
    private var isRendererReady = false
    private val pendingScripts = mutableListOf<String>()

    var onSeekListener: ((Double) -> Unit)? = null
    var onLyricsLoadedListener: ((String, String, Double) -> Unit)? = null
    var onReadyListener: (() -> Unit)? = null
    var onErrorListener: ((String) -> Unit)? = null

    var baseUrl: String = "https://openlyryc.pages.dev/preview"
    var enableBackgroundVideo: Boolean = false // Off by default

    init {
        setBackgroundColor(Color.BLACK)
        webView.layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        webView.setBackgroundColor(Color.TRANSPARENT)
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)

        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.loadsImagesAutomatically = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        val bridge = OpenLyrycBridge(
            onSeekCallback = { seconds -> onSeekListener?.invoke(seconds) },
            onLyricsLoadedCallback = { title, artist, duration ->
                onLyricsLoadedListener?.invoke(title, artist, duration)
            },
            onReadyCallback = {
                isRendererReady = true
                flushPendingScripts()
                onReadyListener?.invoke()
            },
            onErrorCallback = { message ->
                onErrorListener?.invoke(message)
            }
        )

        webView.addJavascriptInterface(bridge, "OpenLyrycAndroid")
        webView.addJavascriptInterface(bridge, "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                webView.evaluateJavascript(
                    "(function() { if (window.openlyryc) { window.OpenLyrycAndroid?.onReady?.(); return true; } return false; })()"
                ) { result ->
                    if (result == "true") {
                        isRendererReady = true
                        flushPendingScripts()
                        onReadyListener?.invoke()
                    }
                }
            }
        }

        webView.webChromeClient = WebChromeClient()
        addView(webView)

        loadEmbedUrl()
    }

    /**
     * Rebuild and load the embed URL
     */
    fun loadEmbedUrl(initialQuery: String? = null) {
        val uriBuilder = Uri.parse(baseUrl).buildUpon()
            .appendQueryParameter("embed", "true")
            .appendQueryParameter("pure", "true")

        if (enableBackgroundVideo) {
            uriBuilder.appendQueryParameter("bg", "true")
        }

        if (!initialQuery.isNullOrBlank()) {
            uriBuilder.appendQueryParameter("q", initialQuery)
        }

        webView.loadUrl(uriBuilder.build().toString())
    }

    /**
     * Real-time audio clock synchronization (call this from ExoPlayer/MediaPlayer tick loop)
     */
    fun syncTime(seconds: Double) {
        evaluateJs("window.openlyryc?.syncTime?.($seconds);")
    }

    /**
     * Load a new song by title and artist
     */
    fun loadTrack(title: String, artist: String, duration: Double? = null) {
        val durParam = if (duration != null && duration > 0) ", duration: $duration" else ""
        val safeTitle = title.replace("'", "\\'")
        val safeArtist = artist.replace("'", "\\'")
        evaluateJs("window.openlyryc?.loadTrack?.({ title: '$safeTitle', artist: '$safeArtist'$durParam });")
    }

    /**
     * Load a new song by single query string (e.g. "Artist - Title" or "Title")
     */
    fun loadTrack(query: String) {
        val safeQuery = query.replace("'", "\\'")
        evaluateJs("window.openlyryc?.loadTrack?.('$safeQuery');")
    }

    /**
     * Provide raw synced LRC string directly (100% offline & source-agnostic)
     */
    fun setLrc(lrcContent: String, title: String? = null, artist: String? = null) {
        val safeLrc = lrcContent.replace("\\", "\\\\").replace("`", "\\`").replace("$", "\\$")
        val safeTitle = title?.replace("'", "\\'") ?: ""
        val safeArtist = artist?.replace("'", "\\'") ?: ""
        evaluateJs("window.openlyryc?.setLrc?.(`$safeLrc`, '$safeTitle', '$safeArtist');")
    }

    /**
     * Notify renderer of playback start
     */
    fun play() {
        evaluateJs("window.openlyryc?.play?.();")
    }

    /**
     * Notify renderer of playback pause
     */
    fun pause() {
        evaluateJs("window.openlyryc?.pause?.();")
    }

    /**
     * Switch 3D transition mode ('pivot', 'cube', or 'whip')
     */
    fun setTransitionMode(mode: String) {
        evaluateJs("window.openlyryc?.setMode?.('$mode');")
    }

    private fun evaluateJs(script: String) {
        if (!isRendererReady) {
            pendingScripts.add(script)
            return
        }
        webView.evaluateJavascript(script, null)
    }

    private fun flushPendingScripts() {
        while (pendingScripts.isNotEmpty()) {
            val script = pendingScripts.removeAt(0)
            webView.evaluateJavascript(script, null)
        }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        webView.destroy()
    }
}
