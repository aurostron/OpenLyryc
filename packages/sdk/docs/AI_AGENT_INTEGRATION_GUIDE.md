# OpenLyryc SDK — AI Agent Integration Manual

> **Document Type**: Machine-Readable System Specification & Invariant Contract  
> **Audience**: LLM Coding Agents (Claude, GPT-4, Cursor, Copilot, Gemini)  
> **Objective**: Guide an autonomous AI agent to integrate OpenLyryc synchronized lyrics into an arbitrary codebase (Android, iOS/WebView, Tauri, Web) with **zero hallucinations** and **100% adherence to invariants**.

---

## 1. System Overview & Core Invariants

You are integrating **OpenLyryc**, a synchronized lyric stage, into a user's music player.

### CRITICAL INVARIANTS (Never Violate):
1. **Never build a custom lyric animation engine from scratch**. Use the OpenLyryc renderer.
2. **Embed URL Invariants**:
   * Always include `embed=true` and `pure=true` in the preview URL.
   * Format: `https://openlyryc.pages.dev/preview?embed=true&pure=true&q=<Artist>+-+<Title>`
   * Background video is **OFF by default**. Do NOT append `&bg=true` unless the user explicitly requests video wallpaper.
3. **Clock Frequency**:
   * Send `syncTime(seconds)` between **30Hz (33ms) and 60Hz (16ms)**. Do not hammer the bridge faster than 120Hz.
4. **Tap-to-Seek Invariant**:
   * Always listen for `onSeek(seconds)` from OpenLyryc and wire it to the host player's seek mechanism (`player.seekTo(...)`).

---

## 2. API Contract & URL Parameters

### Host -> Renderer URL Schema
```
https://openlyryc.pages.dev/preview
  ?embed=true           (REQUIRED: Disables header, back button, footer scrubber, search bars)
  &pure=true            (REQUIRED: Enables kiosk presentation mode)
  &q={Artist}+{Title}   (OPTIONAL: Initial song query)
  &mode={pivot|cube|whip} (OPTIONAL: Transition physics, default 'pivot')
  &bg=true              (OPTIONAL: Enables YouTube video wallpaper, default false)
```

---

## 3. Implementation Recipes by Stack

### Stack A: Android Native (Kotlin + ExoPlayer / Media3)

#### Step 1: Add Dependencies to `build.gradle.kts`
Ensure WebView and Media3 / ExoPlayer are present:
```kotlin
implementation("androidx.media3:media3-exoplayer:1.3.1")
```

#### Step 2: Injected Class: `OpenLyrycBridge.kt`
```kotlin
package dev.openlyrics.sdk

import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface

class OpenLyrycBridge(
    private val onSeek: (Double) -> Unit,
    private val onReady: (() -> Unit)? = null
) {
    private val handler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun onSeek(seconds: Double) {
        handler.post { onSeek(seconds) }
    }

    @JavascriptInterface
    fun onReady() {
        handler.post { onReady?.invoke() }
    }
}
```

#### Step 3: Minimal View Setup:
```kotlin
val webView = WebView(context).apply {
    settings.javaScriptEnabled = true
    settings.domStorageEnabled = true
    setLayerType(View.LAYER_TYPE_HARDWARE, null)
    setBackgroundColor(Color.BLACK)
    addJavascriptInterface(OpenLyrycBridge(
        onSeek = { seconds -> exoPlayer.seekTo((seconds * 1000).toLong()) }
    ), "OpenLyrycAndroid")
    loadUrl("https://openlyryc.pages.dev/preview?embed=true&pure=true&q=${Uri.encode("$artist - $title")}")
}
```

#### Step 4: Clock Synchronization Loop:
Run a coroutine or Handler loop while `player.isPlaying`:
```kotlin
viewLifecycleOwner.lifecycleScope.launch {
    while (isActive) {
        if (exoPlayer.isPlaying) {
            val sec = exoPlayer.currentPosition / 1000.0
            webView.evaluateJavascript("window.openlyryc?.syncTime?.($sec);", null)
        }
        delay(16) // 60 FPS
    }
}
```

---

### Stack B: Web / TypeScript / React / Tauri

#### Step 1: Embed Iframe
```typescript
import { OpenLyrycEmbed } from '@openlyryc/sdk';

const lyrics = new OpenLyrycEmbed({
  container: document.getElementById('lyrics-container')!,
  initialTrack: { title, artist },
  onSeek: (seconds) => {
    mediaElement.currentTime = seconds;
  }
});

// Update on RAF or timeupdate
mediaElement.ontimeupdate = () => {
  lyrics.syncTime(mediaElement.currentTime);
};
```

---

## 4. Verification & Testing Checklist for AI Agents

Before marking your integration as complete, verify:
* [ ] The webview/iframe loads without showing headers, back buttons, or search popups.
* [ ] When the host media player plays, `syncTime(seconds)` is continuously dispatched.
* [ ] When the host media player is paused, `syncTime` loop pauses or sends `pause()`.
* [ ] When a user taps a lyric line on screen, the host player jumps to that timestamp.
* [ ] The background is a clean dark ambient mesh (no unexpected YouTube video unless `bg=true` was specified).
