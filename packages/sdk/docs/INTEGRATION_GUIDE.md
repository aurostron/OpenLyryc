# OpenLyryc SDK — Developer Integration Guide

This guide walks you through integrating OpenLyryc synchronized lyrics into any music player application—from Android (Kotlin Native & Jetpack Compose) to Desktop (Tauri & Rust), and Web (React, Vue, Svelte, or plain HTML).

---

## 1. Architectural Philosophy

OpenLyryc solves the two hardest problems of synchronized lyrics:
1. **Accurate Timed Data**: Aggregates verified word-level lyrics and public sources (like LRCLIB) behind a fast edge cache.
2. **Kinetic Typography Rendering**: Sub-millisecond text sweep animations, font metrics for complex non-Latin scripts, spring physics, and tap-to-seek.

Instead of writing hundreds of lines of complex Canvas or CSS animations from scratch, the SDK provides a **distraction-free, pure kiosk renderer** (`/preview?embed=true&pure=true`) controlled by your app via a 2-way IPC bridge.

```
┌──────────────────────────────────────────────┐
│             Your Music Player                │
│  (Android Kotlin / Tauri / React / Flutter)  │
│                                              │
│   • Audio Playback Engine (ExoPlayer/Audio)  │
│   • Play / Pause / Next / Previous controls  │
│   • Local Playlist / Library Management      │
└──────────────┬───────────────────────────────┘
               │ 
               │  2-Way High-Frequency Bridge (60Hz)
               │    ├── syncTime(seconds)
               │    ├── loadTrack(title, artist)
               │    └── onSeek(seconds)  [User taps lyric line]
               ▼
┌──────────────────────────────────────────────┐
│        OpenLyryc Kinetic Stage               │
│     (Hardware-Accelerated WebView / Iframe)  │
│                                              │
│   • 0 buttons, 0 headers, 0 search popups    │
│   • Pure kinetic typography & 3D turnover    │
│   • Sub-millisecond word sweeps              │
│   • Battery-friendly ambient background      │
└──────────────────────────────────────────────┘
```

---

## 2. Android Integration (Kotlin Native)

### Step 1: Copy SDK Files into Your Project
Copy the files from `packages/sdk/android/` into your app package (e.g., `com.yourapp.player.lyrics`):
* `OpenLyrycView.kt`
* `OpenLyrycBridge.kt`
* `OpenLyrycMediaSync.kt`

### Step 2: Add Internet Permission to `AndroidManifest.xml`
```xml
<manifest ...>
    <uses-permission android:name="android.permission.INTERNET" />
    ...
</manifest>
```

### Step 3: Add `OpenLyrycView` to your Layout XML
```xml
<!-- res/layout/activity_player.xml -->
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#000000">

    <!-- OpenLyryc Pure Stage View -->
    <dev.openlyrics.sdk.OpenLyrycView
        android:id="@+id/openlyrycView"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />

    <!-- Your Native Player Controls (Buttons, seekbar) on top -->
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_gravity="bottom"
        android:orientation="vertical"
        android:padding="16dp">
        <!-- Native play/pause, scrubbers, etc. -->
    </LinearLayout>
</FrameLayout>
```

### Step 4: Bind with ExoPlayer in Activity / Fragment
```kotlin
package com.yourapp.player

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import dev.openlyrics.sdk.OpenLyrycView
import dev.openlyrics.sdk.OpenLyrycMediaSync

class PlayerActivity : AppCompatActivity() {

    private lateinit var exoPlayer: ExoPlayer
    private lateinit var lyricView: OpenLyrycView
    private var mediaSync: OpenLyrycMediaSync? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_player)

        lyricView = findViewById(R.id.openlyrycView)
        setupExoPlayer()

        // 1. Automate 60 FPS clock synchronization & tap-to-seek feedback
        mediaSync = OpenLyrycMediaSync(
            lyricView = lyricView,
            getPositionMs = { exoPlayer.currentPosition },
            isPlaying = { exoPlayer.isPlaying },
            seekPlayer = { positionMs -> exoPlayer.seekTo(positionMs) }
        )
        mediaSync?.start()

        // 2. Play a song
        playTrack("The Weeknd", "Blinding Lights", 200.0)
    }

    private fun playTrack(artist: String, title: String, durationSec: Double) {
        // Load lyrics on the kinetic stage
        lyricView.loadTrack(title = title, artist = artist, duration = durationSec)

        // Start native playback
        // exoPlayer.setMediaItem(...)
        // exoPlayer.play()
    }

    private fun setupExoPlayer() {
        exoPlayer = ExoPlayer.Builder(this).build()
        exoPlayer.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (isPlaying) lyricView.play() else lyricView.pause()
            }
        })
    }

    override fun onDestroy() {
        super.onDestroy()
        mediaSync?.stop()
        exoPlayer.release()
    }
}
```

---

## 3. Jetpack Compose Integration

If your Android app is written in Jetpack Compose:

```kotlin
@Composable
fun LyricsPlayerScreen(
    exoPlayer: ExoPlayer,
    artist: String,
    title: String,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val lyricView = remember {
        OpenLyrycView(context).apply {
            onSeekListener = { seconds ->
                exoPlayer.seekTo((seconds * 1000).toLong())
            }
        }
    }

    // Load track whenever artist/title changes
    LaunchedEffect(artist, title) {
        lyricView.loadTrack(title, artist)
    }

    // 60Hz Clock sync effect
    LaunchedEffect(exoPlayer) {
        while (isActive) {
            if (exoPlayer.isPlaying) {
                val currentSec = exoPlayer.currentPosition / 1000.0
                lyricView.syncTime(currentSec)
            }
            delay(16) // ~60 FPS
        }
    }

    Box(modifier = modifier.fillMaxSize().background(Color.Black)) {
        AndroidView(
            factory = { lyricView },
            modifier = Modifier.fillMaxSize()
        )
    }
}
```

---

## 4. Web & Desktop Integration (Tauri / Electron / Browser)

### Installation
```bash
npm install @openlyryc/sdk
```

### Usage in TypeScript / JavaScript
```typescript
import { OpenLyrycEmbed } from '@openlyryc/sdk';

const container = document.getElementById('lyrics-container')!;
const audio = document.getElementById('my-audio') as HTMLAudioElement;

const player = new OpenLyrycEmbed({
  container,
  initialTrack: {
    title: 'Starboy',
    artist: 'The Weeknd'
  },
  onSeek: (seconds) => {
    // Fired when user taps a line in the kinetic typography stage
    audio.currentTime = seconds;
  },
  onLyricsLoaded: (meta) => {
    console.log(`Lyrics loaded: ${meta.lineCount} lines.`);
  }
});

// Update audio clock in sync with HTML5 audio
audio.addEventListener('timeupdate', () => {
  player.syncTime(audio.currentTime);
});

audio.addEventListener('play', () => player.play());
audio.addEventListener('pause', () => player.pause());
```

---

## 5. Configuration Options

### Video Background (Off by Default)
By default, the stage renders on an ultra-clean, battery-friendly ambient dark mesh background.
To turn ON YouTube video background wallpaper:

* **In URL**: Add `&bg=true` (e.g. `https://openlyryc.pages.dev/preview?embed=true&pure=true&bg=true`)
* **In Android**: Set `lyricView.enableBackgroundVideo = true`
* **In Web SDK**: Set `backgroundVideo: true`

### 3D Transition Modes
The renderer supports three kinetic transition physics:
1. `'pivot'` (Default): Cinematic 90° clockwise pivot roll.
2. `'cube'`: 3D spatial billboard cube turnover.
3. `'whip'`: High-energy kinetic whip-sweep.

Change mode at runtime:
```kotlin
lyricView.setTransitionMode("cube") // or "pivot", "whip"
```
```typescript
player.setMode('whip');
```

---

## 6. Performance & Battery Optimization Tips

1. **Hardware Acceleration**: Always ensure `android:hardwareAccelerated="true"` in your Android manifest (enabled by default on modern Android).
2. **Tick Interval**: Keep clock updates between 16ms (60 FPS) and 33ms (30 FPS). OpenLyryc's client-side interpolation smooths out micro-jitter automatically.
3. **Pausable Loop**: Always stop your sync loop when playback is paused or the activity is backgrounded to preserve battery life.
