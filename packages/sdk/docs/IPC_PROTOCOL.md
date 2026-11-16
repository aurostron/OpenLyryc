# OpenLyryc IPC Bridge Protocol Specification

> **Specification Version**: `1.0.0`  
> **Transports**: `window.postMessage` (Web/Iframe/Tauri), Android `@JavascriptInterface` (Native WebViews)  
> **Format**: JSON / JavaScript direct evaluation  

The OpenLyryc IPC Protocol defines communication between a Host Music Player and the embedded OpenLyryc Stage Renderer.

---

## 1. Direction: Host -> Renderer (Commands)

Commands sent by the host player into the OpenLyryc stage.

### 1.1. `openlyryc:time` / `syncTime`

Updates current playback position. Renderer interpolates word sweep positions in real time.

* **JavaScript Evaluation**:
  ```javascript
  window.openlyryc.syncTime(124.52);
  ```
* **PostMessage Format**:
  ```json
  {
    "type": "openlyryc:time",
    "time": 124.52
  }
  ```

### 1.2. `openlyryc:play` & `openlyryc:pause`

Notifies the stage of playback state transitions.

* **JavaScript Evaluation**:
  ```javascript
  window.openlyryc.play();
  window.openlyryc.pause();
  ```
* **PostMessage Format**:
  ```json
  { "type": "openlyryc:play" }
  { "type": "openlyryc:pause" }
  ```

### 1.3. `openlyryc:track` / `loadTrack`

Loads a new song dynamically without reloading the webview/iframe.

* **JavaScript Evaluation**:
  ```javascript
  window.openlyryc.loadTrack({
    title: "Blinding Lights",
    artist: "The Weeknd",
    duration: 200.0
  });
  ```
* **PostMessage Format**:
  ```json
  {
    "type": "openlyryc:track",
    "track": {
      "title": "Blinding Lights",
      "artist": "The Weeknd",
      "duration": 200.0
    }
  }
  ```

### 1.4. `openlyryc:document` / `setDocument`

Directly injects an `OpenLyricsDocument` (JSON with millisecond word timestamps) bypassing network search.

* **JavaScript Evaluation**:
  ```javascript
  window.openlyryc.setDocument(documentObject);
  ```
* **PostMessage Format**:
  ```json
  {
    "type": "openlyryc:document",
    "doc": { ... }
  }
  ```

---

## 2. Direction: Renderer -> Host (Events)

Events fired by the OpenLyryc stage and received by the host player.

### 2.1. `openlyryc:seek` (Tap-to-Seek)

Fired when the user clicks or taps any lyric line or word on screen.

* **Android Callback**:
  ```kotlin
  @JavascriptInterface
  fun onSeek(seconds: Double) { ... }
  ```
* **PostMessage Received by Parent Window**:
  ```json
  {
    "type": "openlyryc:seek",
    "time": 45.20
  }
  ```
* **Action Required**: The host player MUST seek audio playback to `time` seconds.

### 2.2. `openlyryc:ready`

Fired when the stage has finished DOM initialization and the IPC bridge is ready to receive commands.

* **Android Callback**:
  ```kotlin
  @JavascriptInterface
  fun onReady() { ... }
  ```
* **PostMessage Received by Parent Window**:
  ```json
  {
    "type": "openlyryc:ready"
  }
  ```

### 2.3. `openlyryc:loaded`

Fired when lyrics have been fetched and parsed successfully.

* **Android Callback**:
  ```kotlin
  @JavascriptInterface
  fun onLyricsLoaded(title: String, artist: String, duration: Double) { ... }
  ```
* **PostMessage Received by Parent Window**:
  ```json
  {
    "type": "openlyryc:loaded",
    "title": "Blinding Lights",
    "artist": "The Weeknd",
    "duration": 200.0,
    "lineCount": 48
  }
  ```
