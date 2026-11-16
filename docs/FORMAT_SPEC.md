# OpenLyryc File Format Specification

OpenLyryc supports five lyric formats across the web studio and edge API:

1. **OpenLyrics JSON v1** (canonical internal document)
2. **Enhanced Compact LRC** (`<offset:duration>` delta tags)
3. **Enhanced Standard LRC** (`<mm:ss.xx>` word-level timestamps)
4. **Standard LRC** (`[mm:ss.xx]` line-level timestamps)
5. **Apple Music TTML** (Timed Text Markup Language XML)

---

## 1. OpenLyrics JSON v1 (`OpenLyricsDocument`)

OpenLyrics JSON is the internal document model used by the web studio, schema package, and edge API.

```json
{
  "$schema": "https://openlyrics.dev/schema/v1.json",
  "version": 1,
  "metadata": {
    "title": "Midnight City",
    "artist": "M83",
    "album": "Hurry Up, We're Dreaming",
    "duration": 243,
    "language": "en",
    "isrc": "FR6V81100072",
    "bpm": 105,
    "key": "B Minor",
    "syncedBy": "OpenLyryc Community",
    "precisionMode": false
  },
  "lines": [
    {
      "id": 1,
      "text": "Waiting in a car",
      "start": 18.52,
      "end": 21.40,
      "tokens": [
        { "text": "Waiting", "start": 18.52, "end": 19.10, "durMs": 580 },
        { "text": "in", "start": 19.12, "end": 19.45, "durMs": 330 },
        { "text": "a", "start": 19.46, "end": 19.70, "durMs": 240 },
        { "text": "car", "start": 19.72, "end": 21.40, "durMs": 1680 }
      ]
    }
  ]
}
```

### Metadata Fields (`metadata`)

| Field | Type | Description |
| :--- | :--- | :--- |
| `title` | `string` | Track title |
| `artist` | `string` | Performing artist or group |
| `album` | `string?` | Album title |
| `duration` | `number` | Total track duration in seconds |
| `language` | `string?` | ISO 639-1 two-letter language code (e.g. `en`, `es`, `ja`) |
| `isrc` | `string?` | 12-character International Standard Recording Code |
| `spotifyId` | `string?` | Spotify track ID (e.g. `4cOdK2wGLETKBW3PvgPWqT`) |
| `appleMusicId` | `string?` | Apple Music track ID |
| `youtubeId` | `string?` | YouTube video ID or YouTube Music identifier |
| `bpm` | `number?` | Musical tempo in beats per minute |
| `key` | `string?` | Musical key signature (e.g. `C Major`, `F# Minor`) |
| `offset` | `number?` | Global timing shift applied to all lines in milliseconds |
| `syncedBy` | `string` | Handle or username of the contributor |
| `precisionMode`| `boolean?`| Whether timestamps use 3 decimal places (milliseconds) instead of 2 (centiseconds) |
| `vocalists` | `Record<string, string>?` | Map of singer IDs to display names (e.g. `{"v1": "Lead", "v2": "Backing"}`) |

### Line Fields (`lines[]`)

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string \| number` | Unique identifier or line index |
| `text` | `string` | Full plain text of the line |
| `start` | `number` | Line start timestamp in floating-point seconds |
| `end` | `number` | Line end timestamp in floating-point seconds |
| `tokens` | `WordToken[]?` | Array of word-level timing tokens |
| `vocalist` | `string?` | Key linking to `metadata.vocalists` |
| `section` | `string?` | Song section label (e.g. `Verse 1`, `Chorus`, `Bridge`, `Outro`) |
| `isBackground`| `boolean?` | True if the line represents backing vocals or ad-libs |
| `emphasis` | `boolean?` | True if line should render with visual highlight or emphasis styling |

### Word Tokens (`tokens[]`)

| Field | Type | Description |
| :--- | :--- | :--- |
| `text` | `string` | Word or syllable string |
| `start` | `number` | Word start timestamp in floating-point seconds |
| `end` | `number` | Word end timestamp in floating-point seconds |
| `durMs` | `number?` | Word duration in milliseconds (`Math.round((end - start) * 1000)`) |
| `emphasis` | `boolean?` | True if word has specific emphasis |

---

## 2. Enhanced Compact LRC (`enhanced_compact`)

Standard enhanced LRC files repeat absolute timecodes `<mm:ss.xx>` before every single word, creating large files.

OpenLyryc's **Enhanced Compact LRC** format saves 50% to 65% of file size by anchoring the first word to the line timestamp, and encoding following words with relative offset and duration delta tags:

```lrc
[00:18.52]Waiting <600:330>in <940:240>a <1200:1680>car
[00:22.10]Waiting <400:200>for <650:180>a <880:1200>ride
```

### Syntax Rules

1. **Line header:** `[mm:ss.xx]` marks the start of the line.
2. **First word:** Starts at line start time (`00:18.52`). It does not need a leading tag.
3. **Subsequent words:** Prefixed by `<offsetMs:durationMs>`:
   - `offsetMs`: Milliseconds elapsed from the line start timestamp to this word's start.
   - `durationMs`: Length of the word in milliseconds.

---

## 3. Enhanced Standard LRC (`enhanced_standard`)

Traditional enhanced LRC puts absolute timecode tags before each word.

```lrc
[00:18.52]<00:18.52>Waiting <00:19.12>in <00:19.46>a <00:19.72>car
[00:22.10]<00:22.10>Waiting <00:22.50>for <00:22.75>a <00:22.98>ride
```

---

## 4. Standard Line-Level LRC (`standard`)

Universal line-level LRC supported by media players such as Spotify, foobar2000, VLC, and Plex.

```lrc
[ti:Midnight City]
[ar:M83]
[al:Hurry Up, We're Dreaming]
[length:04:03]
[by:OpenLyryc]

[00:18.52]Waiting in a car
[00:22.10]Waiting for a ride in the dark
[00:26.34]The night city grows
```

### Supported Header Tags

- `[ti:Song Title]`
- `[ar:Artist Name]`
- `[al:Album Name]`
- `[length:mm:ss]`
- `[by:Contributor]`
- `[offset:+/-ms]` (global timing offset in milliseconds)
- `[tempo:120]` (BPM tempo)

---

## 5. Apple Music TTML (`.ttml`)

Timed Text Markup Language (TTML 1.0 XML) compatible with Apple Music, karaoke players, and media servers.

```xml
<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml"
    xmlns:ttm="http://www.w3.org/ns/ttml#metadata"
    xmlns:itunes="http://music.apple.com/lyric-ttml-extensions">
  <head>
    <metadata>
      <ttm:title>Midnight City</ttm:title>
      <ttm:agent type="person">M83</ttm:agent>
    </metadata>
  </head>
  <body>
    <div>
      <p begin="00:18.520" end="00:21.400">
        <span begin="00:18.520" end="00:19.100">Waiting </span>
        <span begin="00:19.120" end="00:19.450">in </span>
        <span begin="00:19.460" end="00:19.700">a </span>
        <span begin="00:19.720" end="00:21.400">car</span>
      </p>
    </div>
  </body>
</tt>
```

### Key Elements

- `<p begin="..." end="...">`: Line-level container and timing.
- `<span begin="..." end="...">`: Word-level or syllable-level timing token.
- `itunes:emphasis="true"` or `ttm:role="emphasis"`: Marks accented lyrics.
- `itunes:key="..."`: Song musical key.
- `itunes:tempo="..."`: Song BPM.

---

## 6. Lyric Deduplication & 64-bit SimHash

To identify duplicate submissions across minor whitespace, punctuation, and capitalization differences, `@openlyryc/schema` calculates a 64-bit SimHash from normalized lyric text:

1. Text is lowercased and stripped of punctuation.
2. Words are tokenized into 3-gram character shingles.
3. Each shingle is hashed into 64 bits with FNV-1a.
4. A 64-dimensional weight vector sums bits (`+1` for 1, `-1` for 0).
5. The final 64-bit fingerprint is produced: `1` where the sum is positive, `0` otherwise.

Two lyric submissions with a Hamming distance $\le 3$ are flagged as identical songs with minor formatting variations.
