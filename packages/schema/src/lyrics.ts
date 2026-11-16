/**
 * OpenLyrics JSON v1 Canonical Specification
 * @see docs/02_data_spec_and_schemas.md
 */

export interface WordToken {
  /** The text content of the token (e.g., "Hello") */
  text: string;
  /** Timestamp in seconds relative to track start */
  start: number;
  /** Timestamp in seconds relative to track start */
  end: number;
  /** Optional duration in milliseconds for pitch-perfect karaoke wipes */
  durMs?: number;
  /** Optional flag for highlighting / drawing animated zig-zag emphasis */
  emphasis?: boolean;
}

export interface LyricLine {
  /** Line sequence index or unique ID */
  id: string | number;
  /** Parent sentence identifier for grouped word rows */
  sentenceId?: string | number;
  /** Full plain text of the line */
  text: string;
  /** Start time of the line in seconds */
  start: number;
  /** End time of the line in seconds */
  end: number;
  /** Optional word-by-word tokens. If present, word-level rendering is used. */
  tokens?: WordToken[];
  /** Speaker/Vocalist identifier for multi-vocalist songs */
  vocalist?: string;
  /** Song structural section tag (e.g. "Verse 1", "Chorus", "Bridge", "Outro") */
  section?: string;
  /** Optional translations or transliterations (e.g. { 'en': '...', 'ja-Latn': '...' }) */
  translations?: Record<string, string>;
  /** True if the line represents background vocal or instrumental */
  isBackground?: boolean;
  /** Optional flag for highlighting / drawing animated zig-zag emphasis */
  emphasis?: boolean;
}

export interface LyricMetadata {
  title: string;
  artist: string;
  album?: string;
  duration: number; // Duration in seconds
  language?: string; // ISO 639-1 code (e.g., "en", "ja")
  isrc?: string; // International Standard Recording Code
  spotifyId?: string; // Spotify track ID or URI
  youtubeId?: string; // YouTube / YouTube Music track ID
  appleMusicId?: string; // Apple Music track ID
  soundcloudUrl?: string; // SoundCloud track URL or permalink
  audioHash?: string; // Deterministic SHA-256 fingerprint of audio file
  audioFileName?: string; // Name of associated audio source file
  canonicalKey?: string; // Unique primary key in OpenLyryc Registry (e.g. isrc:USUM... or spotify:4cOd...)
  lyricsSimhash?: string; // 64-bit SimHash for fuzzy lyric deduplication
  lyricsHash?: string; // SHA-256 hash of normalized text
  platformLinks?: Array<{
    platform: 'spotify' | 'youtube' | 'isrc' | 'applemusic' | 'soundcloud';
    platformId: string;
    isPrimary?: boolean;
  }>;
  isCanonicalMaster?: boolean; // Flag indicating single canonical source of truth
  offset?: number; // Global time shift in milliseconds
  bpm?: number; // Detected or authored tempo in beats per minute
  key?: string; // Musical key signature (e.g. "C Major", "F# Minor")
  syncedBy: string; // Contributor handle
  precisionMode?: boolean; // 3 decimal places vs 2 decimal places
  coverArt?: string; // Base64 data URL or external artwork image URL
  ambientGlow?: boolean; // Toggle dynamic ambient blurred mesh background
  /** Map of vocalist IDs to singer names (e.g. { 'v1': 'Freddie Mercury', 'v2': 'David Bowie' }) */
  vocalists?: Record<string, string>;
}

export interface OpenLyricsDocument {
  $schema: string; // "https://openlyrics.dev/schema/v1.json"
  version: 1;
  metadata: LyricMetadata;
  lines: LyricLine[];
}

export interface CompactWordToken {
  /** Index in dictionary string table */
  wIdx: number;
  /** Start time offset in milliseconds relative to line start */
  dMs: number;
  /** Duration in milliseconds */
  durMs: number;
}

export interface CompactLyricLine {
  id: string | number;
  text: string;
  sMs: number; // Start time in milliseconds
  eMs: number; // End time in milliseconds
  tokens?: CompactWordToken[];
}

export interface PackedLyricDocument {
  v: 2; // Compact delta encoding version
  metadata: LyricMetadata;
  words: string[]; // Dictionary string table
  lines: CompactLyricLine[];
}

