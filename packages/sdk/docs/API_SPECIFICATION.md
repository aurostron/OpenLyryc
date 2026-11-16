# OpenLyryc Edge API Specification

> **Base URL**: `https://openlyryc-core.aurostronyee1.workers.dev`  
> **API Version**: `v1`  
> **Protocol**: HTTPS / JSON & Plain Text (LRC)  
> **Edge Network**: Cloudflare Global Anycast Edge Network  

The OpenLyryc Edge API provides unified access to synchronized lyric documents. It functions as an intelligent federated proxy and cache—resolving lyrics from the OpenLyryc canonical store first, and piggybacking on public open lyric sources (like LRCLIB) with zero-configuration fallbacks.

---

## 1. Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/lyrics` | **Primary**: Resolve & fetch synchronized lyrics by title, artist, duration, or ISRC |
| `GET` | `/api/v1/lyrics/:id` | Fetch canonical document by ID or slug |
| `GET` | `/api/v1/lyrics/:id/lrc` | Export track as standard or enhanced word-synced `.lrc` text |
| `GET` | `/api/v1/search?q=` | Search OpenLyryc catalog and verified songs |
| `GET` | `/api/v1/health` | Service health check and node status |

---

## 2. Detailed Endpoint Documentation

### 2.1. Resolve Synchronized Lyrics

#### `GET /api/v1/lyrics`

Fetches word-by-word or line-synchronized lyrics for a track. If the track is not present in OpenLyryc's verified store, the edge worker automatically piggybacks on public sources (LRCLIB), normalizes the response into a canonical `OpenLyricsDocument`, caches it at the Cloudflare edge, and returns it.

#### Query Parameters

| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `title` / `t` | `string` | **Yes**\* | Track title (e.g., song name) | `Blinding Lights` |
| `artist` / `a` | `string` | **Yes**\* | Artist or band name | `The Weeknd` |
| `q` | `string` | Optional | Freeform search query (can be used instead of title+artist) | `The Weeknd - Blinding Lights` |
| `duration` / `d`| `number` | Optional | Track runtime in seconds (used for duration tie-breaking) | `200` |
| `isrc` | `string` | Optional | International Standard Recording Code | `USUG11904206` |
| `format` | `string` | Optional | Response format: `json` (default), `compact` (delta-compressed), or `lrc` | `json` |

*\*Either `title` + `artist` or `q` must be provided.*

#### Request Headers

| Header | Type | Description |
| :--- | :--- | :--- |
| `Accept` | `string` | `application/json` (or `text/plain` for `format=lrc`) |

#### Example Request

```http
GET /api/v1/lyrics?artist=The+Weeknd&title=Blinding+Lights&duration=200 HTTP/1.1
Host: openlyryc-core.aurostronyee1.workers.dev
Accept: application/json
```

#### Example Response (`200 OK`)

```json
{
  "$schema": "https://openlyrics.dev/schema/v1.json",
  "version": 1,
  "metadata": {
    "title": "Blinding Lights",
    "artist": "The Weeknd",
    "album": "After Hours",
    "duration": 200,
    "canonicalKey": "lrc_theweeknd_blindinglights",
    "syncedBy": "LRCLIB (via OpenLyryc Engine)"
  },
  "lines": [
    {
      "id": 1,
      "text": "Yeah",
      "start": 12.45,
      "end": 14.20
    },
    {
      "id": 2,
      "text": "I've been tryin' to call",
      "start": 26.50,
      "end": 28.90,
      "tokens": [
        { "text": "I've", "start": 26.50, "end": 27.05 },
        { "text": "been", "start": 27.05, "end": 27.40 },
        { "text": "tryin'", "start": 27.40, "end": 28.10 },
        { "text": "to", "start": 28.10, "end": 28.35 },
        { "text": "call", "start": 28.35, "end": 28.90 }
      ]
    }
  ]
}
```

#### Caching Headers Returned

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Cache-Control: public, max-age=300, s-maxage=86400, stale-while-revalidate=604800
CF-Cache-Status: HIT
```

* **`s-maxage=86400`**: Edge cache persists for 24 hours globally.
* **`stale-while-revalidate=604800`**: Serves stale copies while updating in the background for 7 days.

---

### 2.2. Delta-Compressed Lyrics

#### `GET /api/v1/lyrics?title=...&artist=...&format=compact`

Returns a packed binary-like JSON format (`PackedLyricDocument`) where token timestamps are delta-encoded relative to line start. This cuts payload size by ~45% for high-latency mobile networks.

---

### 2.3. Export Standard / Enhanced LRC

#### `GET /api/v1/lyrics/:id/lrc`

Returns standard `.lrc` text.

```http
GET /api/v1/lyrics/s_m83_midnight/lrc HTTP/1.1
Host: openlyryc-core.aurostronyee1.workers.dev
```

#### Response (`200 OK`)

```text
[ti:Midnight City]
[ar:M83]
[by:OpenLyryc]

[00:12.45]<00:12.45>Waiting <00:13.10>in <00:13.50>a <00:13.80>car
[00:15.50]<00:15.50>Waiting <00:16.20>for <00:16.60>a <00:16.90>ride <00:17.80>in <00:18.20>the <00:18.60>dark
```

---

## 3. Error Codes & Handling

| Status Code | Error Code | Reason | Resolution |
| :--- | :--- | :--- | :--- |
| `400` | `BAD_REQUEST` | Missing `title` and `artist`, and no `q` parameter provided | Supply valid track parameters |
| `404` | `NOT_FOUND` | No synchronized lyrics exist across internal and public sources | Fallback to un-synced plain lyrics or show empty stage |
| `429` | `RATE_LIMITED` | Exceeded 120 requests/minute per IP address | Implement client-side debounce or exponential backoff |
| `500` | `INTERNAL_ERROR` | Edge execution error | Retry with exponential backoff |

---

## 4. Multi-Source Federation Waterfall

When querying `/api/v1/lyrics`, the engine follows a strict waterfall:

```mermaid
flowchart TD
    Req["GET /api/v1/lyrics?title=...&artist=..."] --> CacheCheck{"Cloudflare Edge Cache<br/>(CF CDN)"}
    CacheCheck -->|HIT (Sub-10ms)| FastReturn["Return Cached OpenLyrics JSON"]
    
    CacheCheck -->|MISS| StoreCheck{"In-Memory / D1 Store"}
    StoreCheck -->|Found| ReturnAndCache["Cache at Edge & Return"]
    
    StoreCheck -->|Not Found| LRCLIBExact{"LRCLIB Exact Query<br/>/api/get?artist=&track="}
    LRCLIBExact -->|200 OK with SyncedLyrics| ParseReturn["Parse to OpenLyricsDocument,<br/>Save in Store & Return"]
    
    LRCLIBExact -->|404 / Missing| LRCLIBFuzzy{"LRCLIB Search Query<br/>/api/search?q="}
    LRCLIBFuzzy -->|Found Synced Candidate| ParseReturn
    LRCLIBFuzzy -->|No synced candidates| Return404["404 NOT_FOUND"]
```
