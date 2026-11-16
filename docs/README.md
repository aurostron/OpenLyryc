# OpenLyryc Documentation

This directory contains technical guides, architecture specifications, API references, and file format definitions for OpenLyryc.

---

## Core Documentation

| Document | Description |
| :--- | :--- |
| **[Architecture](./ARCHITECTURE.md)** | Monorepo layout, system components, local Web Audio pipeline, and offline storage. |
| **[API Reference](./API.md)** | Cloudflare Workers edge API endpoints, search cascading, parameters, and responses. |
| **[Format Specification](./FORMAT_SPEC.md)** | `OpenLyricsDocument` JSON schema, Enhanced Compact LRC `<offset:dur>` syntax, and Apple Music TTML dialect. |
| **[Contributing Guide](./CONTRIBUTING.md)** | Setting up your environment, compiling packages, monorepo commands, and pull request guidelines. |
| **[Assets and Licenses](./ASSETS.md)** | Which images, fonts, and samples are safe to share, and which are not in this repo. |

The Studio Connect browser extension is maintained separately and is not part of this public repo. The Studio works without it and falls back to local files, YouTube embeds, and SoundCloud.
