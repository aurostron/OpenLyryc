# @openlyryc/sdk

Embed the OpenLyryc stage in a web page, a Tauri app, or an Android player.

The stage is an iframe that renders synchronized lyrics. The host sends playback time, and the stage can send seek events back. Lyric data comes from an OpenLyryc API deployment.

## Layout

```
packages/sdk/
├── src/
│   ├── index.ts      # exports
│   ├── protocol.ts   # message types
│   ├── api.ts        # API client and embed URL builder
│   └── embed.ts      # OpenLyrycEmbed controller
├── android/          # Kotlin WebView and ExoPlayer helpers
├── tauri-rust/       # Tauri notes
└── docs/             # integration, API, and IPC references
```

## Web or Tauri

```ts
import { OpenLyrycEmbed } from '@openlyryc/sdk';

const lyrics = new OpenLyrycEmbed({
  container: document.getElementById('lyrics')!,
  previewUrl: 'https://your-openlyryc-site.example',
  initialTrack: { title: 'Starboy', artist: 'The Weeknd' },
  onSeek: (seconds) => {
    audio.currentTime = seconds;
  },
});

audio.ontimeupdate = () => {
  lyrics.syncTime(audio.currentTime);
};
```

`previewUrl` is the site that serves the stage. If you omit it, the SDK uses its default hosted URL.

## Android

The `android/` folder has three Kotlin files:

- `OpenLyrycView.kt`: a WebView that loads the stage.
- `OpenLyrycBridge.kt`: the JavaScript bridge.
- `OpenLyrycMediaSync.kt`: a 60 Hz clock loop for ExoPlayer or MediaPlayer.

```kotlin
val lyricView = findViewById<OpenLyrycView>(R.id.openlyrycView)
lyricView.loadTrack("Blinding Lights", "The Weeknd", 200.0)

val sync = OpenLyrycMediaSync(
    lyricView = lyricView,
    getPositionMs = { exoPlayer.currentPosition },
    isPlaying = { exoPlayer.isPlaying },
    seekPlayer = { ms -> exoPlayer.seekTo(ms) }
)
sync.start()
```

See `android/README.md` for the full setup.

## API

The SDK can also fetch lyric documents directly:

```ts
import { fetchLyrics } from '@openlyryc/sdk';

const doc = await fetchLyrics({
  baseUrl: 'http://localhost:8787',
  title: 'Starboy',
  artist: 'The Weeknd',
});
```

`baseUrl` is your API deployment. The request and response shapes are in [docs/API_SPECIFICATION.md](./docs/API_SPECIFICATION.md).

## More docs

- [Integration guide](./docs/INTEGRATION_GUIDE.md)
- [API specification](./docs/API_SPECIFICATION.md)
- [IPC protocol](./docs/IPC_PROTOCOL.md)
