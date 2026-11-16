import { OpenLyricsDocument, LyricLine, SongSearchResult, WordToken } from '@/types/lyrics';
import { computeLyricsHash } from './lyricsFingerprint';
import { tokenizeLineIntoWords } from './tokenizer';

const LRCLIB_API_BASE = 'https://lrclib.net/api';

export interface LrclibTrack {
  id: number;
  name?: string;
  trackName?: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
  isrc?: string;
  spotifyId?: string;
}

// In-memory cache for fast search responses & zero redundant network calls
const searchCache = new Map<string, { timestamp: number; results: SongSearchResult[] }>();
const trackCache = new Map<number, { timestamp: number; track: LrclibTrack }>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes
const SESSION_CACHE_PREFIX = 'openlyrics_lrc_track_';

let activeSearchAbortController: AbortController | null = null;

/**
 * Retrieve track from memory or sessionStorage cache
 */
function getCachedTrack(id: number): LrclibTrack | null {
  const mem = trackCache.get(id);
  if (mem && Date.now() - mem.timestamp < CACHE_TTL_MS) {
    return mem.track;
  }
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = sessionStorage.getItem(`${SESSION_CACHE_PREFIX}${id}`);
      if (raw) {
        const track = JSON.parse(raw) as LrclibTrack;
        trackCache.set(id, { timestamp: Date.now(), track });
        return track;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Save track into memory and sessionStorage cache
 */
function setCachedTrack(id: number, track: LrclibTrack) {
  trackCache.set(id, { timestamp: Date.now(), track });
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      sessionStorage.setItem(`${SESSION_CACHE_PREFIX}${id}`, JSON.stringify(track));
    } catch {
      // ignore quota limits
    }
  }
}

/**
 * Generate a deterministic canonical key from artist and title
 */
function deriveCanonicalKey(artist: string, title: string): string {
  const a = (artist || 'unknown').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const t = (title || 'untitled').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  return `lrc_${a}_${t}`;
}

/**
 * Parses raw LRC timecode string into chronological LyricLine array with word tokens.
 */
export function parseLrcStringToLines(lrcContent: string, totalDuration: number = 0): LyricLine[] {
  if (!lrcContent || !lrcContent.trim()) return [];

  const rawLines = lrcContent.split(/\r?\n/);
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
  const parsedItems: { start: number; text: string }[] = [];

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Check for ID tags like [ar: Artist], [ti: Title], etc. - skip them
    if (/^\[[a-zA-Z]+:/.test(trimmed)) continue;

    // Collect all timestamps in this line (handles repeated chorus tags like [00:12.34][00:45.67] lyrics)
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;

    timeRegex.lastIndex = 0;
    while ((match = timeRegex.exec(trimmed)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const msStr = match[3] || '0';
      const ms = parseFloat(`0.${msStr}`);
      const totalSec = Math.round((min * 60 + sec + ms) * 1000) / 1000;
      timestamps.push(totalSec);
    }

    if (timestamps.length === 0) continue;

    // Strip timecodes to extract lyric text
    const text = trimmed.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim();

    // Attach text to each extracted timestamp
    for (const start of timestamps) {
      parsedItems.push({ start, text });
    }
  }

  // Sort chronologically by start timestamp
  parsedItems.sort((a, b) => a.start - b.start);

  if (parsedItems.length === 0) return [];

  // Construct LyricLine objects with calculated end times and default word tokens
  const lines: LyricLine[] = [];

  for (let i = 0; i < parsedItems.length; i++) {
    const current = parsedItems[i];
    const next = parsedItems[i + 1];

    let end: number;
    if (next) {
      // End line 100ms before next line starts (capped to a reasonable max)
      const gapDuration = next.start - current.start;
      if (gapDuration > 8.0) {
        end = Math.round((current.start + 5.0) * 1000) / 1000;
      } else {
        end = Math.max(current.start + 0.5, Math.round((next.start - 0.1) * 1000) / 1000);
      }
    } else {
      // Last line
      if (totalDuration > current.start) {
        end = Math.min(current.start + 5.0, totalDuration);
      } else {
        end = Math.round((current.start + 4.0) * 1000) / 1000;
      }
    }

    // Auto-generate word tokens
    const words = tokenizeLineIntoWords(current.text);
    const lineDuration = Math.max(0.1, end - current.start);
    const step = words.length > 0 ? lineDuration / words.length : lineDuration;

    const tokens: WordToken[] = words.map((w, wIdx) => ({
      text: w,
      start: Math.round((current.start + wIdx * step) * 1000) / 1000,
      end: Math.round((current.start + (wIdx + 1) * step) * 1000) / 1000,
    }));

    lines.push({
      id: `line-${i + 1}`,
      text: current.text,
      start: current.start,
      end,
      tokens: tokens.length > 0 ? tokens : undefined,
    });
  }

  return lines;
}

/**
 * Converts a raw LRCLIB API record into a full canonical OpenLyricsDocument.
 */
export async function convertLrclibToOpenLyricsDocument(track: LrclibTrack): Promise<OpenLyricsDocument> {
  const title = track.trackName || track.name || 'Untitled Track';
  const artist = track.artistName || 'Unknown Artist';
  const album = track.albumName || '';
  const duration = Math.round(track.duration || 0);

  let lines: LyricLine[] = [];

  if (track.syncedLyrics && track.syncedLyrics.trim().length > 0) {
    lines = parseLrcStringToLines(track.syncedLyrics, duration);
  } else if (track.plainLyrics && track.plainLyrics.trim().length > 0) {
    // Unsynced plain lyrics fallback: create lines with 0 timestamps ready for stamping
    const plainLines = track.plainLyrics.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    lines = plainLines.map((text, idx) => ({
      id: `line-${idx + 1}`,
      text,
      start: 0,
      end: 0,
    }));
  }

  const lyricsHash = await computeLyricsHash(lines);
  const canonicalKey = deriveCanonicalKey(artist, title);

  return {
    $schema: 'https://openlyryc.org/schema/v1/lyrics.json',
    version: 1,
    metadata: {
      title,
      artist,
      album: album || undefined,
      duration,
      isrc: track.isrc,
      spotifyId: track.spotifyId,
      canonicalKey,
      audioHash: undefined,
      offset: 0,
      precisionMode: true,
      syncedBy: 'LRCLIB Archive',
    },
    lines,
  };
}

/**
 * Search LRCLIB live API for matching tracks.
 * Features:
 * - Gated on minimum 2 characters
 * - Immediate abort of previous in-flight requests (AbortController)
 * - Multi-tier memory & session caching
 * - Automatic track pre-caching for 0-roundtrip document loading
 */
export async function searchLrclib(query: string, externalSignal?: AbortSignal): Promise<SongSearchResult[]> {
  const trimmed = query.trim().replace(/\s+/g, ' ');
  // Minimum length gate to protect public API from 1-letter spam
  if (trimmed.length < 2) return [];

  const cacheKey = trimmed.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.results;
  }

  // Cancel any prior pending search request
  if (activeSearchAbortController) {
    activeSearchAbortController.abort();
  }
  activeSearchAbortController = new AbortController();
  const signal = externalSignal || activeSearchAbortController.signal;

  try {
    const res = await fetch(`${LRCLIB_API_BASE}/search?q=${encodeURIComponent(trimmed)}`, {
      headers: {
        Accept: 'application/json',
      },
      signal,
    });

    if (!res.ok) {
      return [];
    }

    const data: LrclibTrack[] = await res.json();
    if (!Array.isArray(data)) return [];

    // Limit to top 30 to keep memory footprint light
    const topTracks = data.slice(0, 30);

    const results: SongSearchResult[] = topTracks.map((item) => {
      const title = item.trackName || item.name || 'Untitled';
      const artist = item.artistName || 'Unknown';
      const hasSynced = Boolean(item.syncedLyrics && item.syncedLyrics.trim().length > 0);
      const isInst = Boolean(item.instrumental);

      // Pre-cache track payload so clicking "Load" requires 0 additional network roundtrips
      setCachedTrack(item.id, item);

      return {
        id: `lrc_${item.id}`,
        title,
        artist,
        album: item.albumName || undefined,
        duration: Math.round(item.duration || 0),
        syncedBy: 'LRCLIB',
        hasWordSync: false,
        hasLineSync: hasSynced,
        isInstrumental: isInst,
        source: 'lrclib',
        qualityScore: hasSynced ? 0.85 : 0.40,
        revisionHash: `lrc_${item.id}`,
        updatedAt: new Date().toISOString(),
        canonicalKey: deriveCanonicalKey(artist, title),
        status: 'approved',
      };
    });

    searchCache.set(cacheKey, { timestamp: Date.now(), results });
    return results;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      // Expected cancellation from rapid keystrokes - silently return cached or empty
      return [];
    }
    console.warn('LRCLIB live search error (network offline or rate-limited):', err);
    return [];
  }
}

/**
 * Fetch full track details and parse into an OpenLyricsDocument.
 * If the track was already returned in search, it uses the cached copy (0ms, 0 network requests).
 */
export async function fetchLrclibDocument(numericId: number): Promise<OpenLyricsDocument | null> {
  const cached = getCachedTrack(numericId);
  if (cached && (cached.syncedLyrics || cached.plainLyrics || cached.instrumental)) {
    return await convertLrclibToOpenLyricsDocument(cached);
  }

  try {
    const res = await fetch(`${LRCLIB_API_BASE}/get/${numericId}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) return null;

    const track: LrclibTrack = await res.json();
    setCachedTrack(numericId, track);
    return await convertLrclibToOpenLyricsDocument(track);
  } catch (err) {
    console.error('Failed to fetch track from LRCLIB:', err);
    return null;
  }
}
