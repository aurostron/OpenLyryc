# Architecture Overview

OpenLyryc is an open-source, local-first ecosystem for creating, syncing, and displaying synchronized lyrics. It is structured as an npm workspaces monorepo.

---

## Workspace Structure

```
OpenLyryc/
├── apps/
│   └── web/           # Next.js 16 Web Studio, Player, Stage, and Chords
├── packages/
│   ├── api/           # Cloudflare Workers / Hono edge API
│   ├── schema/        # OpenLyrics schema, LRC parsers, and SimHash algorithms
│   └── sdk/           # Cross-platform embedding SDK (Web, Android, Tauri)
├── docs/              # Technical documentation and specifications
│   ├── API.md         # Edge API reference
│   ├── ARCHITECTURE.md # This document
│   ├── FORMAT_SPEC.md # OpenLyrics and Enhanced LRC file formats
│   └── CONTRIBUTING.md # Development workflow and setup
└── scripts/           # Development helpers
```

---

## Monorepo Components

### 1. Web Studio (`apps/web`)

The primary web application built with Next.js 16 (App Router) and React 19.

- **Studio (`/studio`):** An NLE-style audio editor for timing lyrics to music. Uses the browser Web Audio API to decode MP3, WAV, FLAC, and OGG files locally in memory. YouTube playback is available through the local dev proxy and YouTube embeds. A browser extension for session playback is maintained separately and is not part of this repo.
- **Stage Mode (`/preview`):** A fullscreen kinetic stage display designed for singers, live performances, and smart TV screens.
- **Chords (`/chords`):** Interactive guitar chord charts synchronized to song playback with transpose and diagram lookup.
- **Lyrics Player (`/lyrics`):** Dedicated playback viewer with background customization and album art matching.

### 2. Edge API (`packages/api`)

A serverless Hono application deployed to Cloudflare Workers.

- Provides lyrics resolution across local D1 storage, LRCLIB, and fallback providers.
- Computes SimHash fingerprints for deduplication and quality grading.
- Optionally verifies Cloudflare Turnstile tokens on revision submissions. Verification is only enabled when `TURNSTILE_SECRET` is set.

### 3. Schema & Parsers (`packages/schema`)

The core TypeScript package providing:

- `OpenLyricsDocument`: Structured data specification with millisecond timestamps, syllable tokens, backing vocal roles, and romanization tracks.
- `parseLRC` / `exportLRC`: High-speed parser and serializer supporting standard line tags and Enhanced Compact LRC format (`<offset:duration>`).
- `simhash`: 64-bit fingerprinting for detecting near-duplicate lyric files.

### 4. Universal SDK (`packages/sdk`)

A lightweight client library allowing third-party applications to embed the OpenLyryc stage:

- **Web Embed:** Controller for `<iframe>` embedding with bidirectional `postMessage` synchronization.
- **Android Bridge:** Kotlin WebView integration (`OpenLyrycView.kt`) with hardware acceleration and tap-to-seek callbacks.
- **Tauri / Rust:** Desktop IPC protocol for embedding stage views in native apps.

---

## Hosted services not in this repo

Unison Hub (submissions, badges, leaderboards) runs on a separate private service with its own database and accounts. The web client can talk to the hosted service, but you need an account. Its server code, database, and deployment config are not part of this repository.

The production site auth gate, Cloudflare Pages deployment files, and maintenance scripts are also kept private. The editor and the API run without them.

The Tauri desktop companion and the Windows live wallpaper are separate apps and are not part of this repo.

---

## Technical Principles

### Local Audio Processing

Audio decoding runs completely inside the user's browser using the Web Audio API. When a user drops a song into the editor:

1. The file is read into memory as an `ArrayBuffer`.
2. The browser decodes the raw audio into PCM channel data.
3. Waveform peaks are generated on a Web Worker without blocking the UI thread.
4. Audio never uploads to an external server.

### Offline Resilience

OpenLyryc is designed so the studio functions without an active internet connection. All project autosaves and history stacks are stored in the browser using IndexedDB. External API calls are strictly optional conveniences (for catalog search and community database sharing).
