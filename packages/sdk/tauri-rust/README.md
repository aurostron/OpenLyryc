# OpenLyryc Tauri & Rust Integration

Embed synchronized lyrics in desktop music players built with Tauri and Rust.

---

### In Tauri (HTML / TS Frontend)

```typescript
import { OpenLyrycEmbed } from '@openlyryc/sdk';

const container = document.getElementById('lyrics-container')!;

const openlyryc = new OpenLyrycEmbed({
  container,
  initialTrack: {
    title: 'Starboy',
    artist: 'The Weeknd'
  },
  onSeek: (seconds) => {
    // Jump your desktop audio playback
    audioPlayer.seek(seconds);
  }
});

// Update audio time during playback
audioPlayer.onTimeUpdate((currentSec) => {
  openlyryc.syncTime(currentSec);
});
```

---

### In Tauri Window / Rust Direct

You can open a secondary lyrics window directly in Tauri:

```rust
use tauri::Manager;

// Open a pure, distraction-free lyrics stage window
let lyrics_window = app.create_window(
    "lyrics",
    tauri::WindowUrl::External("https://openlyryc.pages.dev/preview?embed=true&pure=true&q=The+Weeknd+-+Starboy".parse().unwrap()),
    |window_builder, webview_builder| {
        (window_builder.title("OpenLyryc Stage").inner_size(800.0, 900.0), webview_builder)
    },
)?;

// Send clock sync events via eval
lyrics_window.eval(&format!("window.openlyryc?.syncTime?.({});", current_seconds))?;
```
