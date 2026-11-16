package dev.openlyrics.sdk

import android.os.Handler
import android.os.Looper
import java.io.Closeable

/**
 * OpenLyrycMediaSync — High-frequency audio clock synchronizer for Android audio players.
 * Bridges any media player (ExoPlayer, Media3, Android MediaPlayer) to OpenLyrycView at 60Hz.
 */
class OpenLyrycMediaSync(
    private val lyricView: OpenLyrycView,
    private val getPositionMs: () -> Long,
    private val isPlaying: () -> Boolean,
    private val seekPlayer: (Long) -> Unit
) : Closeable {

    private val handler = Handler(Looper.getMainLooper())
    private var isRunning = false
    private val frameIntervalMs = 16L // ~60 FPS smooth clock tick

    private val syncRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return

            if (isPlaying()) {
                val currentSeconds = getPositionMs() / 1000.0
                lyricView.syncTime(currentSeconds)
            }

            handler.postDelayed(this, frameIntervalMs)
        }
    }

    init {
        // Wire user tap-to-seek feedback from lyrics view to the native player
        lyricView.onSeekListener = { targetSeconds ->
            val targetMs = (targetSeconds * 1000).toLong()
            seekPlayer(targetMs)
            lyricView.syncTime(targetSeconds)
        }
    }

    /**
     * Start the 60Hz clock sync loop
     */
    fun start() {
        if (isRunning) return
        isRunning = true
        handler.post(syncRunnable)
    }

    /**
     * Stop the clock sync loop
     */
    fun stop() {
        isRunning = false
        handler.removeCallbacks(syncRunnable)
    }

    override fun close() {
        stop()
    }
}
