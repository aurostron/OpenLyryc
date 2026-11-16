# OpenLyryc Android SDK Quickstart

Embed distraction-free, 60/120 FPS synchronized kinetic lyrics into your Android music player.

---

### 1. In XML Layout

```xml
<dev.openlyrics.sdk.OpenLyrycView
    android:id="@+id/openlyrycView"
    android:layout_width="match_parent"
    android:layout_height="match_parent" />
```

---

### 2. Connect with ExoPlayer / Media3 in Kotlin

```kotlin
val lyricView = findViewById<OpenLyrycView>(R.id.openlyrycView)

// 1. Load a song
lyricView.loadTrack(
    title = "Blinding Lights",
    artist = "The Weeknd",
    duration = 200.0
)

// 2. Automate 60 FPS clock synchronization & tap-to-seek
val sync = OpenLyrycMediaSync(
    lyricView = lyricView,
    getPositionMs = { exoPlayer.currentPosition },
    isPlaying = { exoPlayer.isPlaying },
    seekPlayer = { positionMs -> exoPlayer.seekTo(positionMs) }
)

// Start clock loop when playback starts
sync.start()

// Listen for playback state changes
exoPlayer.addListener(object : Player.Listener {
    override fun onIsPlayingChanged(isPlaying: Boolean) {
        if (isPlaying) lyricView.play() else lyricView.pause()
    }
})
```

---

### 3. In Jetpack Compose

```kotlin
@Composable
fun SyncedLyricsScreen(exoPlayer: ExoPlayer, trackTitle: String, trackArtist: String) {
    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { context ->
            OpenLyrycView(context).apply {
                loadTrack(trackTitle, trackArtist)

                onSeekListener = { seconds ->
                    exoPlayer.seekTo((seconds * 1000).toLong())
                }
            }
        },
        update = { view ->
            if (exoPlayer.isPlaying) {
                view.syncTime(exoPlayer.currentPosition / 1000.0)
            }
        }
    )
}
```

---

### Features & Settings:
* **Distraction-Free Kiosk Mode**: Zero buttons, zero headers, zero search bars. Only pure typography.
* **Background Video**: Off by default for maximum performance. Set `view.enableBackgroundVideo = true` if you want YouTube video wallpapers.
* **Transitions**: Call `view.setTransitionMode("pivot")`, `"cube"`, or `"whip"`.
* **Tap-to-Seek**: Automatically fires `onSeekListener` when the user taps any lyric line or word.
