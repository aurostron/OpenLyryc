/**
 * Canonical OpenLyrics Data Specifications v1
 */

export interface WordToken {
  /** Text content of the token (e.g. "Listen") */
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
  /** Line identifier */
  id: string | number;
  /** Parent sentence identifier for grouped word rows */
  sentenceId?: string | number;
  /** Full plain text of the line */
  text: string;
  /** Start time of the line in seconds */
  start: number;
  /** End time of the line in seconds */
  end: number;
  /** Optional word-by-word tokens */
  tokens?: WordToken[];
  /** Vocalist identifier for multi-vocalist songs */
  vocalist?: string;
  /** Optional layer identifier for multi-layer timeline positioning */
  layerId?: string;
  /** Song structural section tag (e.g. "Verse 1", "Chorus", "Bridge", "Outro") */
  section?: string;
  /** Optional translations or transliterations (e.g. { 'en': '...', 'ja-Latn': '...' }) */
  translations?: Record<string, string>;
  /** True if the line represents non-vocal audio or instrumental break */
  isBackground?: boolean;
  /** Optional flag for highlighting / drawing animated zig-zag emphasis */
  emphasis?: boolean;
}

export interface LyricMetadata {
  title: string;
  artist: string;
  album?: string;
  duration: number; // In seconds
  language?: string; // e.g. "en", "ja"
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
  precisionMode?: boolean; // Fine timing mode (3 decimal places vs 2)
  coverArt?: string; // Base64 data URL or artwork image URL
  ambientGlow?: boolean; // Dynamic ambient blurred mesh background
  syncedBy: string; // Contributor handle
  /** Map of vocalist IDs to singer names (e.g. { 'v1': 'Freddie Mercury', 'v2': 'David Bowie' }) */
  vocalists?: Record<string, string>;
}

export interface OpenLyricsDocument {
  $schema: string;
  version: 1;
  metadata: LyricMetadata;
  lines: LyricLine[];
}

export interface SongSearchResult {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  syncedBy?: string;
  hasWordSync?: boolean;
  hasLineSync?: boolean;
  isInstrumental?: boolean;
  source?: 'openlyryc' | 'lrclib' | 'musixmatch' | 'binimum' | 'lrcred' | 'local';
  qualityScore?: number;
  revisionHash?: string;
  currentRevisionId?: string;
  updatedAt?: string;
  canonicalKey?: string;
  /** SHA-256 of normalized lyrics text — used for exact-content deduplication */
  lyricsHash?: string;
  /** 64-bit SimHash for fuzzy lyric deduplication */
  lyricsSimhash?: string;
  /** SHA-256 audio file fingerprint — used for audio cross-check deduplication */
  audioHash?: string;
  platformLinks?: Array<{
    platform: 'spotify' | 'youtube' | 'isrc' | 'applemusic' | 'soundcloud';
    platformId: string;
    isPrimary?: boolean;
  }>;
  coverArt?: string;
  year?: string | number;
  /** Moderation status: 'pending' = awaiting review, 'approved' = public */
  status?: 'pending' | 'approved' | 'rejected';
}



export interface SearchResponse {
  query: string;
  total: number;
  results: SongSearchResult[];
}

export interface CreateRevisionRequest {
  songId?: string;
  title?: string;
  artist?: string;
  album?: string;
  commitMessage?: string;
  authorHandle?: string;
  document: OpenLyricsDocument;
}

export interface CreateRevisionResponse {
  success?: boolean;
  revisionId?: string;
  revisionHash: string;
  songId: string;
  title?: string;
  artist?: string;
  commitMessage?: string;
  status?: string;
  qualityScore?: number;
  createdAt: string;
}

export interface RevisionItem {
  hash: string;
  revisionId?: string;
  revisionHash?: string;
  songId: string;
  authorId?: string;
  authorHandle?: string;
  parentHash?: string;
  commitMessage: string;
  status?: string;
  qualityScore?: number;
  createdAt: string;
  lineCount?: number;
  hasWordSync?: boolean;
}

export interface RevisionHistoryResponse {
  songId: string;
  songTitle?: string;
  artistName?: string;
  currentRevisionHash?: string;
  revisions: RevisionItem[];
}

export type SongRevision = RevisionItem;
