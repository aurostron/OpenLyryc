import { OpenLyricsDocument, LyricLine, SongSearchResult, WordToken } from '@/types/lyrics';
import { parseTTML } from './ttmlParser';
import { convertLrclibToOpenLyricsDocument, fetchLrclibDocument, parseLrcStringToLines, LrclibTrack } from './lrclibService';
import { corsResilientFetch } from './security/sandbox';
import { searchAllOnlineLyrics, fetchOnlineLyricsDocument } from './onlineLyricsService';

const LRC_RED_BASE = 'https://lrc.red';
const LRCLIB_BASE = 'https://lrclib.net/api';
const BINIMUM_BASE = 'https://lyrics-api.binimum.org';

export interface ResolveTrackQuery {
  id?: string | number;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  query?: string;
  youtubeId?: string;
}

export interface RetryProgress {
  attempt: number;
  maxRetries: number;
  status: string;
}

/**
 * Strips cosmetic punctuation, bracketed metadata (feat, official video, etc.)
 */
export function sanitizeSongQuery(text: string): string {
  if (!text) return '';
  return text
    // Remove trailing punctuation like "misery." -> "misery"
    .replace(/[.!?,:;]+$/, '')
    // Remove (feat. ...), [feat ...], (with ...)
    .replace(/[\(\[](feat|ft|with|prod)\.?\s+[^\)\]]+[\)\]]/gi, '')
    // Remove (Official Video), (Lyric Video), [Audio], etc.
    .replace(/[\(\[](official|lyrics?|video|audio|visualizer|remix|edit|sped\s*up|slowed)[^\)\]]*[\)\]]/gi, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts title and artist from an unstructured string like "Artist - Title" or "Title by Artist"
 */
export function parseUnstructuredTrackString(raw: string): { title: string; artist: string } {
  const trimmed = raw.trim();
  if (trimmed.includes(' - ')) {
    const parts = trimmed.split(' - ');
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  }
  if (trimmed.includes(' – ')) {
    const parts = trimmed.split(' – ');
    return { artist: parts[0].trim(), title: parts.slice(1).join(' – ').trim() };
  }
  if (/\s+by\s+/i.test(trimmed)) {
    const parts = trimmed.split(/\s+by\s+/i);
    return { title: parts[0].trim(), artist: parts.slice(1).join(' ').trim() };
  }
  return { title: trimmed, artist: '' };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Direct Endpoint Fetchers (Zero Search Roundtrip)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Direct match lookup against lrc.red match.json API.
 * High accuracy, returns Apple Music TTML with syllable & line sync.
 */
export async function fetchLrcRedDirect(
  title: string,
  artist: string,
  signal?: AbortSignal
): Promise<OpenLyricsDocument | null> {
  if (!title || !title.trim()) return null;
  try {
    const cleanT = sanitizeSongQuery(title);
    const cleanA = sanitizeSongQuery(artist);
    const url = new URL(`${LRC_RED_BASE}/match.json`);
    url.searchParams.set('title', cleanT || title);
    if (cleanA || artist) {
      url.searchParams.set('artist', cleanA || artist);
    }

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: signal || (AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const hits: any[] = data?.hits || [];
    const normTarget = (cleanT || title).toLowerCase().replace(/[\p{P}\p{Z}\p{S}]+/gu, '');
    const hit = hits.find((h) => {
      const hTitle = (h.title || '').toLowerCase().replace(/[\p{P}\p{Z}\p{S}]+/gu, '');
      return hTitle.includes(normTarget) || normTarget.includes(hTitle);
    });
    if (!hit || !hit.isrc) return null;

    // Fetch the TTML
    const ttmlUrl = `${LRC_RED_BASE}/s/${hit.isrc}.ttml`;
    const ttmlRes = await fetch(ttmlUrl, {
      signal: signal || (AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined),
    });
    if (!ttmlRes.ok) return null;

    const ttmlText = await ttmlRes.text();
    if (!ttmlText || !ttmlText.trim()) return null;

    const doc = parseTTML(ttmlText);
    if (!doc.lines || doc.lines.length === 0) return null;

    doc.metadata.title = hit.title || title;
    doc.metadata.artist = hit.artist || artist;
    doc.metadata.album = hit.album || doc.metadata.album;
    doc.metadata.duration = Math.round(hit.duration || doc.metadata.duration || 0);
    doc.metadata.isrc = hit.isrc;
    doc.metadata.coverArt = hit.cover;
    doc.metadata.syncedBy = 'Apple Music (lrc.red)';

    return doc;
  } catch (err: any) {
    if (err?.name !== 'AbortError' && err?.name !== 'TimeoutError') {
      console.warn('[lyricsResolver] lrc.red direct match skipped/failed:', err?.message || err);
    }
    return null;
  }
}

/**
 * Direct match lookup against LRCLIB /api/get endpoint.
 */
export async function fetchLrclibDirect(
  title: string,
  artist: string,
  duration?: number,
  signal?: AbortSignal
): Promise<OpenLyricsDocument | null> {
  if (!title || !title.trim()) return null;
  try {
    const cleanT = sanitizeSongQuery(title);
    const cleanA = sanitizeSongQuery(artist);
    const url = new URL(`${LRCLIB_BASE}/get`);
    url.searchParams.set('track_name', cleanT || title);
    if (cleanA || artist) {
      url.searchParams.set('artist_name', cleanA || artist);
    }
    if (duration && duration > 0) {
      url.searchParams.set('duration', String(Math.round(duration)));
    }

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: signal || (AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined),
    });

    if (!res.ok) return null;
    const track: LrclibTrack = await res.json();
    if (!track || (!track.syncedLyrics && !track.plainLyrics)) return null;

    const doc = await convertLrclibToOpenLyricsDocument(track);
    return doc.lines && doc.lines.length > 0 ? doc : null;
  } catch (err: any) {
    if (err?.name !== 'AbortError' && err?.name !== 'TimeoutError') {
      console.warn('[lyricsResolver] LRCLIB direct get skipped/failed:', err?.message || err);
    }
    return null;
  }
}

/**
 * Direct match lookup against Binimum API.
 */
export async function fetchBinimumDirect(
  title: string,
  artist: string,
  signal?: AbortSignal
): Promise<OpenLyricsDocument | null> {
  if (!title || !title.trim()) return null;
  try {
    const cleanT = sanitizeSongQuery(title);
    const cleanA = sanitizeSongQuery(artist);
    const url = new URL(BINIMUM_BASE);
    url.searchParams.set('track', cleanT || title);
    if (cleanA || artist) {
      url.searchParams.set('artist', cleanA || artist);
    }

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: signal || (AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const results: any[] = data?.results || [];
    const normTarget = (cleanT || title).toLowerCase().replace(/[\p{P}\p{Z}\p{S}]+/gu, '');
    const candidate = results.find((r) => {
      const rTitle = (r.track_name || '').toLowerCase().replace(/[\p{P}\p{Z}\p{S}]+/gu, '');
      return rTitle.includes(normTarget) || normTarget.includes(rTitle);
    });
    if (!candidate || !candidate.lyricsUrl) return null;

    const ttmlRes = await corsResilientFetch(candidate.lyricsUrl);
    if (!ttmlRes.ok) return null;
    const ttmlText = await ttmlRes.text();
    if (!ttmlText || !ttmlText.trim()) return null;

    const doc = parseTTML(ttmlText);
    if (!doc.lines || doc.lines.length === 0) return null;

    doc.metadata.title = candidate.track_name || title;
    doc.metadata.artist = candidate.artist_name || artist;
    doc.metadata.album = candidate.album_name || doc.metadata.album;
    doc.metadata.duration = Math.round(candidate.duration || doc.metadata.duration || 0);
    doc.metadata.syncedBy = 'Apple Music (Binimum)';

    return doc;
  } catch (err: any) {
    if (err?.name !== 'AbortError' && err?.name !== 'TimeoutError') {
      console.warn('[lyricsResolver] Binimum direct match skipped/failed:', err?.message || err);
    }
    return null;
  }
}

/**
 * Direct match lookup against Musixmatch catalog.
 */
export async function fetchMusixmatchDirect(
  title: string,
  artist: string,
  signal?: AbortSignal
): Promise<OpenLyricsDocument | null> {
  if (!title || !title.trim()) return null;
  try {
    const cleanT = sanitizeSongQuery(title);
    const cleanA = sanitizeSongQuery(artist);
    const q = `${cleanA ? cleanA + ' ' : ''}${cleanT || title}`.trim();
    const hits = await searchAllOnlineLyrics(q, signal);
    const mxmHit = hits.find((h) => h.source === 'musixmatch');
    if (mxmHit && mxmHit.id) {
      return await fetchOnlineLyricsDocument(mxmHit.id);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Ranks multiple lyric documents live based on sync quality and provider preference.
 * Priority 1: Word-level (syllable) synced lines
 * Priority 2: Line-level synced lines
 * Priority 3: Provider quality score (Apple Music lrc.red / Binimum > Musixmatch > LRCLIB)
 */
export function rankLyricsDocuments(docs: OpenLyricsDocument[]): OpenLyricsDocument[] {
  if (!docs || docs.length === 0) return [];

  const getDocScore = (doc: OpenLyricsDocument): number => {
    const hasWordSync = doc.lines?.some((l) => l.tokens && l.tokens.length > 0);
    const hasLineSync = doc.lines?.some((l) => l.start > 0 || l.end > 0);
    const syncedBy = (doc.metadata.syncedBy || '').toLowerCase();

    let syncScore = 0;
    if (hasWordSync) syncScore = 50;
    else if (hasLineSync) syncScore = 30;

    let providerScore = 10;
    if (syncedBy.includes('lrc.red')) providerScore = 20;
    else if (syncedBy.includes('binimum')) providerScore = 18;
    else if (syncedBy.includes('richsync') || syncedBy.includes('musixmatch')) providerScore = 16;
    else if (syncedBy.includes('lrclib')) providerScore = 12;

    const lineCountScore = Math.min(10, (doc.lines?.length || 0) / 10);

    return syncScore + providerScore + lineCountScore;
  };

  return [...docs].sort((a, b) => getDocScore(b) - getDocScore(a));
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Piggybacked Multi-Provider Cascade
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves lyrics by piggybacking across lrc.red, lrclib, binimum, and musixmatch
 * with live preference ranking (Word Sync > Line Sync > Source Reputation).
 */
export async function resolveTrackLyrics(
  track: ResolveTrackQuery,
  signal?: AbortSignal
): Promise<OpenLyricsDocument | null> {
  // If specific ID is already provided:
  if (track.id) {
    const idStr = String(track.id);
    if (idStr.startsWith('lrc_') || idStr.startsWith('bini_') || idStr.startsWith('mxm_') || idStr.startsWith('lrcred_')) {
      const doc = await fetchOnlineLyricsDocument(idStr);
      if (doc && doc.lines && doc.lines.length > 0) return doc;
    }
    const num = parseInt(idStr.replace(/^lrc_/, ''), 10);
    if (!isNaN(num)) {
      const doc = await fetchLrclibDocument(num);
      if (doc && doc.lines && doc.lines.length > 0) return doc;
    }
  }

  let title = (track.title || '').trim();
  let artist = (track.artist || '').trim();

  // If title was not provided or query was passed instead
  if (!title && track.query) {
    const parsed = parseUnstructuredTrackString(track.query);
    title = parsed.title;
    artist = parsed.artist || artist;
  }

  if (!title) return null;

  // ── Phase 1: Parallel Direct Race across ALL 4 online providers ───────────
  const directPromises = [
    fetchLrcRedDirect(title, artist, signal),
    fetchBinimumDirect(title, artist, signal),
    fetchMusixmatchDirect(title, artist, signal),
    fetchLrclibDirect(title, artist, track.duration, signal),
  ];

  const phase1Results = await Promise.allSettled(directPromises);
  const phase1Docs = phase1Results
    .filter((r): r is PromiseFulfilledResult<OpenLyricsDocument | null> => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value!);

  const rankedPhase1 = rankLyricsDocuments(phase1Docs);
  if (rankedPhase1.length > 0) return rankedPhase1[0];

  // ── Phase 2: Cleaned Title / Artist Sanitization Direct Race ─────────────────
  const cleanTitle = sanitizeSongQuery(title);
  const cleanArtist = sanitizeSongQuery(artist);
  if (cleanTitle !== title || cleanArtist !== artist) {
    const phase2Results = await Promise.allSettled([
      fetchLrcRedDirect(cleanTitle, cleanArtist, signal),
      fetchBinimumDirect(cleanTitle, cleanArtist, signal),
      fetchMusixmatchDirect(cleanTitle, cleanArtist, signal),
      fetchLrclibDirect(cleanTitle, cleanArtist, track.duration, signal),
    ]);

    const phase2Docs = phase2Results
      .filter((r): r is PromiseFulfilledResult<OpenLyricsDocument | null> => r.status === 'fulfilled' && r.value !== null)
      .map((r) => r.value!);

    const rankedPhase2 = rankLyricsDocuments(phase2Docs);
    if (rankedPhase2.length > 0) return rankedPhase2[0];
  }

  // ── Phase 3: Broad Multi-Provider Catalog Search Piggybacking ───────────────
  const searchQueriesToTry = [
    `${artist ? artist + ' ' : ''}${title}`.trim(),
    `${cleanArtist ? cleanArtist + ' ' : ''}${cleanTitle}`.trim(),
    cleanTitle,
  ].filter(Boolean);

  for (const q of Array.from(new Set(searchQueriesToTry))) {
    try {
      const candidates = await searchAllOnlineLyrics(q, signal);
      if (candidates.length > 0) {
        // Find top candidate with synced lines
        const best = candidates.find((c) => c.hasWordSync) || candidates.find((c) => c.hasLineSync) || candidates[0];
        if (best && best.id) {
          const doc = await fetchOnlineLyricsDocument(best.id);
          if (doc && doc.lines && doc.lines.length > 0) {
            return doc;
          }
        }
      }
    } catch {
      // Continue to next query variation
    }
  }

  // ── Phase 4: Swapped Artist/Title Fallback ──────────────────────────────────
  if (artist && title) {
    const swappedQuery = `${title} ${artist}`.trim();
    try {
      const candidates = await searchAllOnlineLyrics(swappedQuery, signal);
      const best = candidates.find((c) => c.hasWordSync) || candidates.find((c) => c.hasLineSync);
      if (best && best.id) {
        const doc = await fetchOnlineLyricsDocument(best.id);
        if (doc && doc.lines && doc.lines.length > 0) {
          return doc;
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Auto-Retry Engine with Exponential Backoff up to Critical Limit
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RETRY_LIMIT = 4;
const RETRY_BACKOFF_MS = [0, 600, 1500, 3000];

/**
 * Resolves lyrics with automatic retry & exponential backoff up to the critical limit.
 * Guaranteed not to freeze: informs caller on every attempt, handles network recovery,
 * and recovers gracefully if endpoints cold-start or hiccup.
 */
export async function resolveLyricsWithAutoRetry(
  track: ResolveTrackQuery,
  options?: {
    maxRetries?: number;
    onProgress?: (progress: RetryProgress) => void;
    signal?: AbortSignal;
  }
): Promise<OpenLyricsDocument> {
  const maxRetries = options?.maxRetries ?? MAX_RETRY_LIMIT;
  const onProgress = options?.onProgress;
  const signal = options?.signal;

  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Search cancelled', 'AbortError');
    }

    const delay = RETRY_BACKOFF_MS[attempt - 1] || 2500;
    if (delay > 0) {
      onProgress?.({
        attempt,
        maxRetries,
        status: `Retrying lyrics search (attempt ${attempt}/${maxRetries})…`,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    } else {
      onProgress?.({
        attempt,
        maxRetries,
        status: `Connecting to lyric engines (attempt ${attempt}/${maxRetries})…`,
      });
    }

    if (signal?.aborted) {
      throw new DOMException('Search cancelled', 'AbortError');
    }

    try {
      const doc = await resolveTrackLyrics(track, signal);
      if (doc && doc.lines && doc.lines.length > 0) {
        return doc;
      }
      lastError = new Error(`Synced lyrics not found on attempt ${attempt}`);
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      lastError = err;
      console.warn(`[lyricsResolver] Attempt ${attempt} failed:`, err?.message || err);
    }
  }

  throw lastError || new Error(`Could not find synced lyrics after ${maxRetries} attempts.`);
}
