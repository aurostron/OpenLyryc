# Studio Connect client

This folder is the web half of the Studio Connect bridge. It lets the Studio play YouTube Music through a companion browser extension. The extension lives in a separate repository and is not required to use the editor.

## How a track plays

1. `useStudioConnect()` pings the extension over `externally_connectable` (Chromium) or a content-script relay (Firefox).
2. `StudioConnectPlayer` watches the document's `youtubeId` in connect mode and calls `fetchTrackFile()` (`resolveFile.ts`).
3. `fetchTrackFile()` runs the player request in `resolver.ts` through YouTube.js, deciphering signature and `n` parameters with the player script. Age-gated tracks retry once signed in through the extension.
4. The response carries direct audio URLs. `info.toDash()` builds a DASH manifest with deciphered BaseURLs. `pickAudioUrl()` takes the opus AdaptationSet's highest-bandwidth Representation.
5. `downloadAudio()` reads that URL in 2 MB byte ranges through the extension's `yt.fetch`.

If the extension is missing, the Studio falls back to local files, YouTube embeds, and SoundCloud.
