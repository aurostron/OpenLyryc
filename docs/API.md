# OpenLyryc API Reference

The OpenLyryc backend runs on Cloudflare Workers and provides fast, edge-cached endpoints for lyric search, word-level timing resolution, format conversions, and community revisions.

- **Base URL:** your deployment (for local work, `http://localhost:8787`)
- **Specification:** OpenAPI 3.1.0 at `/api/v1/openapi.json`
- **CORS:** Enabled for all origins (`*`)
- **Rate Limit:** 3 requests per second per IP with an automated burst queue

---

## Endpoints

### 1. Health Check

Checks if the edge worker is online.

```http
GET /api/v1/health
```

#### Response (200 OK)

```json
{
  "status": "ok",
  "version": "1.0.0",
  "edge": "Cloudflare Workers",
  "timestamp": "2026-10-31T18:00:00.000Z"
}
```

---

### 2. Resolve Lyrics

Fetches word-by-word or line-by-line synchronized lyrics for a song. The service searches local storage first, then cascades through open lyric providers.

```http
GET /api/v1/lyrics?title={title}&artist={artist}&format={format}
```

#### Query Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `title` (or `t`) | string | Yes* | Track title (required if `q` is not provided) |
| `artist` (or `a`) | string | No | Artist name |
| `q` | string | Yes* | Combined query (e.g. `M83 - Midnight City`) |
| `format` | string | No | Output format: `json` (default), `lrc`, `compact`, `ttml` |
| `duration` (or `d`) | number | No | Track duration in seconds to improve accuracy |
| `transliterate` | string | No | Set to `romaji` to convert Japanese Kanji/Kana to Latin script |

#### Response (200 OK, `format=json`)

```json
{
  "$schema": "https://openlyrics.dev/schema/v1.json",
  "version": 1,
  "metadata": {
    "title": "Midnight City",
    "artist": "M83",
    "album": "Hurry Up, We're Dreaming",
    "duration": 243,
    "syncedBy": "OpenLyryc Community",
    "canonicalKey": "lrc_m83_midnightcity"
  },
  "lines": [
    {
      "id": "line_1",
      "text": "Waiting in a car",
      "start": 12.45,
      "end": 15.2,
      "tokens": [
        { "text": "Waiting", "start": 12.45, "end": 13.1 },
        { "text": "in", "start": 13.1, "end": 13.5 },
        { "text": "a", "start": 13.5, "end": 13.8 },
        { "text": "car", "start": 13.8, "end": 15.2 }
      ]
    }
  ]
}
```

#### Response (`format=lrc`)

```text
[00:12.45]Waiting in a car
[00:15.50]Waiting for a ride in the dark
```

#### Response (`format=compact`)

Enhanced Compact LRC using relative millisecond tags:

```text
[00:12.45]<0:650>Waiting <650:400>in <1050:300>a <1350:1400>car
```

#### Response (`format=ttml`)

Standard Apple Music Timed Text Markup Language XML document.

---

### 3. Catalog Search

Searches available tracks and lyric providers with match confidence ranking.

```http
GET /api/v1/search?q={query}&limit={limit}
```

#### Query Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `q` | string | Yes | Search term (title, artist, or keywords) |
| `limit` | number | No | Maximum results to return (default: 10, max: 50) |

#### Response (200 OK)

```json
{
  "query": "Daft Punk",
  "count": 1,
  "results": [
    {
      "id": "s_daft_punk_get_lucky",
      "title": "Get Lucky",
      "artist": "Daft Punk",
      "album": "Random Access Memories",
      "duration": 248,
      "hasWordSync": true,
      "hasLineSync": true,
      "source": "verified"
    }
  ]
}
```

---

### 4. Tempo & Musical Key (BPM)

Retrieves detected musical tempo, key signature, and duration for a song.

```http
GET /api/v1/bpm?q={query}
```

#### Query Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `q` | string | Yes | Song title and artist |

#### Response (200 OK)

```json
{
  "title": "Get Lucky",
  "artist": "Daft Punk",
  "bpm": 116,
  "key": "F# Minor",
  "timeSignature": "4/4",
  "duration": 248
}
```

---

### 5. Japanese Transliteration

Converts Japanese Kanji and Kana to Latin Romaji using an edge dictionary.

```http
GET /api/v1/transliterate?text={text}
```

#### Response (200 OK)

```json
{
  "original": "乾杯の歌",
  "romaji": "kanpai no uta"
}
```

---

### 6. Deduplication & SimHash

Computes a 64-bit SimHash fingerprint for lyric text to detect near-duplicates and track modifications across edits.

```http
GET /api/v1/dedup?text={lyrics}
```

#### Response (200 OK)

```json
{
  "simhash": "a4f8c12b90de43aa",
  "wordCount": 182,
  "lineCount": 32
}
```

---

### 7. Revisions & Sync Submissions

Submits an updated lyric timestamp or correction to the community database.

```http
POST /api/v1/revisions
Content-Type: application/json
X-Turnstile-Token: {optional_turnstile_token}
```

The `X-Turnstile-Token` header is optional. If your deployment sets `TURNSTILE_SECRET`, the server verifies any token that is sent. If no secret is configured, requests that include the header are rejected with `503`.

#### Request Body

```json
{
  "canonicalKey": "lrc_m83_midnightcity",
  "authorHandle": "audio_editor",
  "commitMessage": "Adjusted verse 2 word boundaries",
  "document": { ... }
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "revisionHash": "rev_7f9a2b0c",
  "status": "published"
}
```

---

## Local Development

To run the API locally using the Cloudflare Workers emulator:

```bash
cd packages/api
npm install
npm run dev
```

The local API server starts at `http://localhost:8787`.
