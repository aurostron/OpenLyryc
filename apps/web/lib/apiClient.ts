import {
  OpenLyricsDocument,
  SearchResponse,
  SongSearchResult,
  CreateRevisionRequest,
  CreateRevisionResponse,
  RevisionHistoryResponse,
  SongRevision,
  DuplicateCheckRequest,
  DuplicateCheckResponse,
  computeHammingDistance,
} from '@openlyryc/schema';
import { getCachedDocument, setCachedDocument } from './cache';
import { getApiBaseUrl, getRuntimeMode } from './runtimeMode';
import { decompressDeltaToDocument, PackedLyricDocument } from '@openlyryc/schema';
import { computeLyricsHash, computeLyricsSimHash } from './lyricsFingerprint';

const FALLBACK_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://openlyryc-core.aurostronyee1.workers.dev';

/**
 * Mode-aware Worker URL. Null in Offline mode so every caller below
 * transparently falls back to local-only behavior.
 */
function getApiBase(): string | null {
  try {
    return getApiBaseUrl(getRuntimeMode());
  } catch {
    return FALLBACK_API_BASE_URL;
  }
}

const STORAGE_CATALOG_KEY = 'openlyrics_catalog';
const STORAGE_DOC_PREFIX = 'openlyrics_doc_';
const STORAGE_REVISIONS_PREFIX = 'openlyrics_revisions_';

/**
 * Derive a stable, deterministic songId from the document's canonicalKey.
 * Falls back to title+artist slug if no canonical key exists.
 */
function deriveSongId(canonicalKey?: string, title?: string, artist?: string): string {
  if (canonicalKey && canonicalKey.length > 0) {
    return `cl_${canonicalKey.replace(/[^a-z0-9]/g, '_')}`;
  }
  const a = (artist || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '');
  const t = (title || 'untitled').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `song_${a}_${t}`;
}

function getLocalCatalog(): SongSearchResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_CATALOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalCatalog(catalog: SongSearchResult[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_CATALOG_KEY, JSON.stringify(catalog));
  } catch (e) {
    console.error('Failed to persist catalog to localStorage', e);
  }
}

// ─── Deduplication Lookup Helpers ─────────────────────────────────────────────

/**
 * Performs a comprehensive duplicate check across official platform ID, canonicalKey,
 * exact lyric hash, and 64-bit SimHash near-duplicate distance.
 */
export async function checkDuplicate(req: DuplicateCheckRequest): Promise<DuplicateCheckResponse> {
  // 1. Try remote edge API first if configured
  if (getApiBase()) {
    try {
      const res = await fetch(`${getApiBase()}/dedup/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback to local catalog
    }
  }

  const catalog = getLocalCatalog();
  const { platformId, canonicalKey, lyricsSimhash, lyricsHash, artist, title } = req;

  // 2. Exact Platform ID check
  if (platformId) {
    const platMatch = catalog.find((s) => {
      if (s.canonicalKey && (s.canonicalKey === `spotify:${platformId}` || s.canonicalKey === `yt:${platformId}` || s.canonicalKey === `isrc:${platformId}`)) {
        return true;
      }
      return s.platformLinks?.some((l) => l.platformId.toLowerCase() === platformId.toLowerCase());
    });

    if (platMatch) {
      return {
        isDuplicate: true,
        matchType: 'exact_platform',
        matchedSong: platMatch,
        message: `An official entry already exists for this track: "${platMatch.title}" by ${platMatch.artist}.`,
      };
    }
  }

  // 3. Exact Canonical Key check
  if (canonicalKey) {
    const keyMatch = catalog.find((s) => s.canonicalKey === canonicalKey);
    if (keyMatch) {
      return {
        isDuplicate: true,
        matchType: 'exact_platform',
        matchedSong: keyMatch,
        message: `An entry with canonical key "${canonicalKey}" already exists.`,
      };
    }
  }

  // 4. Exact Lyrics Hash check
  if (lyricsHash) {
    const exactLyricsMatch = catalog.find(
      (s) => s.lyricsHash === lyricsHash && s.canonicalKey !== canonicalKey && s.status !== 'rejected'
    );
    if (exactLyricsMatch) {
      return {
        isDuplicate: true,
        matchType: 'exact_lyrics',
        matchedSong: exactLyricsMatch,
        hammingDistance: 0,
        message: `Identical lyric text already exists under "${exactLyricsMatch.title}" by ${exactLyricsMatch.artist}.`,
      };
    }
  }

  // 5. 64-bit SimHash Fuzzy Duplicate Check (Hamming distance <= 3)
  if (lyricsSimhash && lyricsSimhash.length === 16) {
    let closestSong: SongSearchResult | undefined = undefined;
    let minDistance = 64;

    for (const song of catalog) {
      if (song.lyricsSimhash && song.lyricsSimhash.length === 16 && song.canonicalKey !== canonicalKey) {
        const dist = computeHammingDistance(lyricsSimhash, song.lyricsSimhash);
        if (dist < minDistance) {
          minDistance = dist;
          closestSong = song;
        }
      }
    }

    if (closestSong && minDistance <= 3) {
      return {
        isDuplicate: true,
        matchType: minDistance === 0 ? 'exact_lyrics' : 'fuzzy_lyrics',
        matchedSong: closestSong,
        hammingDistance: minDistance,
        message:
          minDistance === 0
            ? `Identical lyric text found under "${closestSong.title}" by ${closestSong.artist}.`
            : `Near-identical lyric text (${100 - minDistance * 3}% match) found under "${closestSong.title}" by ${closestSong.artist}.`,
      };
    }
  }

  // 6. Normalized Artist + Title Slug Match
  if (artist && title) {
    const normA = artist.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normT = title.toLowerCase().replace(/[^a-z0-9]/g, '');

    const slugMatch = catalog.find((s) => {
      const sNormA = s.artist.toLowerCase().replace(/[^a-z0-9]/g, '');
      const sNormT = s.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      return normA.length > 2 && normT.length > 2 && sNormA === normA && sNormT === normT;
    });

    if (slugMatch) {
      return {
        isDuplicate: true,
        matchType: 'slug_match',
        matchedSong: slugMatch,
        message: `A track titled "${slugMatch.title}" by ${slugMatch.artist} is already registered.`,
      };
    }
  }

  return {
    isDuplicate: false,
    matchType: 'none',
  };
}

/**
 * Find any approved catalog entry whose lyrics content hash matches exactly.
 */
export function findDuplicateByLyricsHash(
  lyricsHash: string,
  ownCanonicalKey?: string
): SongSearchResult | null {
  if (!lyricsHash) return null;
  const catalog = getLocalCatalog();
  return (
    catalog.find(
      (s) =>
        s.lyricsHash === lyricsHash &&
        s.canonicalKey !== ownCanonicalKey &&
        s.status !== 'rejected'
    ) ?? null
  );
}

/**
 * Find any catalog entry whose audio fingerprint hash matches exactly.
 */
export function findDuplicateByAudioHash(
  audioHash: string,
  ownCanonicalKey?: string
): SongSearchResult | null {
  if (!audioHash) return null;
  const catalog = getLocalCatalog();
  return (
    catalog.find(
      (s) =>
        s.audioHash === audioHash &&
        s.canonicalKey !== ownCanonicalKey &&
        s.status !== 'rejected'
    ) ?? null
  );
}


import { searchAllOnlineLyrics, fetchOnlineLyricsDocument } from './onlineLyricsService';
import { shouldUseOnlineLyrics } from './runtimeMode';

export async function searchSongs(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  const catalog = getLocalCatalog();
  const q = query.toLowerCase().trim();

  // 1. Local community catalog results
  const localMatches = catalog.filter(
    (s) =>
      s.status !== 'pending' &&
      s.status !== 'rejected' &&
      (
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        (s.album && s.album.toLowerCase().includes(q)) ||
        (s.canonicalKey && s.canonicalKey.toLowerCase().includes(q))
      )
  );

  // 2. Query Multi-Provider live APIs in parallel (skipped in Offline mode)
  let onlineMatches: SongSearchResult[] = [];
  if (q.length >= 2 && shouldUseOnlineLyrics()) {
    try {
      onlineMatches = await searchAllOnlineLyrics(query, signal);
    } catch (e) {
      console.warn('Online multi-provider search error:', e);
    }
  }

  // 3. Deduplicate & Merge (Local community word-synced entries take precedence)
  const mergedMap = new Map<string, SongSearchResult>();

  // Add local songs first
  for (const song of localMatches) {
    const key = song.canonicalKey || `${song.artist.toLowerCase()}_${song.title.toLowerCase()}`;
    mergedMap.set(key, song);
  }

  // Add Online multi-provider songs if not already in local catalog
  for (const song of onlineMatches) {
    const key = song.canonicalKey || `${song.artist.toLowerCase()}_${song.title.toLowerCase()}`;
    if (!mergedMap.has(key)) {
      mergedMap.set(key, song);
    }
  }

  const results = Array.from(mergedMap.values()).sort((a, b) => {
    // Priority 1: Word-synced / Syllable-synced versions first
    if (a.hasWordSync && !b.hasWordSync) return -1;
    if (!a.hasWordSync && b.hasWordSync) return 1;
    // Priority 2: Line-synced over unsynced
    if (a.hasLineSync && !b.hasLineSync) return -1;
    if (!a.hasLineSync && b.hasLineSync) return 1;
    // Priority 3: Higher quality score
    return (b.qualityScore ?? 0) - (a.qualityScore ?? 0);
  });

  return { query, total: results.length, results };
}

export async function fetchLyricsDocument(songId: string): Promise<OpenLyricsDocument | null> {
  const cached = await getCachedDocument(songId);
  if (cached) return cached;

  // 1. Check local storage
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`${STORAGE_DOC_PREFIX}${songId}`);
      if (raw) {
        const doc = JSON.parse(raw) as OpenLyricsDocument;
        setCachedDocument(songId, doc);
        return doc;
      }
    } catch {
      // ignore
    }
  }

  // 2. On-demand online provider tracks (skipped in Offline mode)
  if ((songId.startsWith('mxm_') || songId.startsWith('bini_') || songId.startsWith('lrc_') || songId.startsWith('lrcred_')) && shouldUseOnlineLyrics()) {
    const doc = await fetchOnlineLyricsDocument(songId);
    if (doc) {
      if ((!doc.metadata.duration || doc.metadata.duration < 1) && doc.lines && doc.lines.length > 0) {
        doc.metadata.duration = Math.round(doc.lines[doc.lines.length - 1].end * 100) / 100;
      }
      setCachedDocument(songId, doc);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`${STORAGE_DOC_PREFIX}${songId}`, JSON.stringify(doc));
        } catch {
          // ignore localStorage quota limit
        }
      }
      return doc;
    }
  }

  // 3. Fallback to API if configured
  if (getApiBase()) {
    try {
      const res = await fetch(`${getApiBase()}/lyrics/${songId}?format=compact`);
      if (res.ok) {
        const data = await res.json();
        const doc: OpenLyricsDocument =
          data.v === 2 ? decompressDeltaToDocument(data as PackedLyricDocument) : data;
        setCachedDocument(songId, doc);
        return doc;
      }
    } catch {
      // Fallback
    }
  }

  return null;
}

/**
 * Retrieve the last published document snapshot for a given canonicalKey.
 * Used by the diff engine before publishing a new revision.
 */
export function getLastPublishedDocument(canonicalKey: string): OpenLyricsDocument | null {
  if (typeof window === 'undefined') return null;
  try {
    const songId = deriveSongId(canonicalKey);
    const raw = localStorage.getItem(`${STORAGE_DOC_PREFIX}${songId}`);
    if (!raw) return null;
    return JSON.parse(raw) as OpenLyricsDocument;
  } catch {
    return null;
  }
}

export async function publishRevision(req: CreateRevisionRequest): Promise<CreateRevisionResponse> {
  if (getApiBase()) {
    try {
      const res = await fetch(`${getApiBase()}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback to localStorage
    }
  }

  const doc = req.document;
  const canonicalKey = doc.metadata.canonicalKey;
  const songId = req.songId || deriveSongId(canonicalKey, doc.metadata.title, doc.metadata.artist);

  const rawHash = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const revisionHash = `0x${rawHash.slice(0, 10)}`;
  const now = new Date().toISOString();

  const lineCount = doc.lines?.length || 0;
  const hasWordSync = Boolean(doc.lines?.some((l) => l.tokens && l.tokens.length > 0));

  // Compute lyrics content hash and SimHash for deduplication
  let lyricsHash: string | undefined;
  let lyricsSimhash: string | undefined;
  try {
    lyricsHash = await computeLyricsHash(doc.lines ?? []);
    lyricsSimhash = computeLyricsSimHash(doc.lines ?? []);
    doc.metadata.lyricsHash = lyricsHash;
    doc.metadata.lyricsSimhash = lyricsSimhash;
  } catch {
    // non-fatal
  }

  // All new submissions go to pending — awaiting moderation
  const submissionStatus = 'pending';

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${STORAGE_DOC_PREFIX}${songId}`, JSON.stringify(doc));

      const catalog = getLocalCatalog();
      const existingIdx = catalog.findIndex(
        (s) =>
          s.id === songId ||
          (canonicalKey && s.canonicalKey === canonicalKey)
      );

      const platformLinks = doc.metadata.platformLinks || [
        ...(doc.metadata.youtubeId ? [{ platform: 'youtube' as const, platformId: doc.metadata.youtubeId, isPrimary: true }] : []),
        ...(doc.metadata.spotifyId ? [{ platform: 'spotify' as const, platformId: doc.metadata.spotifyId, isPrimary: false }] : []),
        ...(doc.metadata.isrc ? [{ platform: 'isrc' as const, platformId: doc.metadata.isrc, isPrimary: false }] : [])
      ];

      const catalogEntry: SongSearchResult = {
        id: songId,
        title: req.title || doc.metadata.title || 'Untitled Track',
        artist: req.artist || doc.metadata.artist || 'Untitled Artist',
        album: req.album || doc.metadata.album,
        duration: doc.metadata.duration || 0,
        hasWordSync,
        qualityScore: 0.98,
        revisionHash,
        updatedAt: now,
        canonicalKey,
        lyricsHash,
        lyricsSimhash,
        audioHash: doc.metadata.audioHash,
        platformLinks,
        status: submissionStatus,
      };

      if (existingIdx >= 0) {
        catalog[existingIdx] = { ...catalogEntry, id: catalog[existingIdx].id };
      } else {
        catalog.unshift(catalogEntry);
      }
      saveLocalCatalog(catalog);

      // Revision history
      const revisionsKey = `${STORAGE_REVISIONS_PREFIX}${songId}`;
      const rawRev = localStorage.getItem(revisionsKey);
      const revisions: SongRevision[] = rawRev ? JSON.parse(rawRev) : [];
      const authorHandle = req.authorHandle || doc.metadata.syncedBy || 'Anonymous';
      const newRev: SongRevision = {
        hash: revisionHash,
        songId,
        authorId: `u_${authorHandle.toLowerCase().replace(/[^a-z0-9]/g, '') || 'anon'}`,
        authorHandle,
        commitMessage: req.commitMessage || 'Updated lyrics',
        status: submissionStatus,
        qualityScore: 0.98,
        createdAt: now,
        lineCount,
        hasWordSync,
      };
      revisions.unshift(newRev);
      localStorage.setItem(revisionsKey, JSON.stringify(revisions));
    } catch (e) {
      console.error('Failed to save revision to localStorage', e);
    }
  }

  // Submit to remote Cloudflare Worker API / D1 database if API URL is available
  if (getApiBase()) {
    try {
      const res = await fetch(`${getApiBase()}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document: doc,
          songId,
          title: req.title || doc.metadata.title,
          artist: req.artist || doc.metadata.artist,
          authorHandle: req.authorHandle || doc.metadata.syncedBy || 'Contributor',
          commitMessage: req.commitMessage || 'Updated lyrics sync',
        }),
      });
      if (res.ok) {
        const remoteData = (await res.json()) as CreateRevisionResponse;
        if (remoteData && remoteData.songId) {
          return remoteData;
        }
      }
    } catch (e) {
      console.warn('Failed to publish revision to remote Worker API:', e);
    }
  }

  return {
    songId,
    revisionHash,
    status: submissionStatus,
    qualityScore: 0.98,
    createdAt: now,
  };
}


export async function fetchRevisionHistory(songId: string): Promise<RevisionHistoryResponse> {
  if (getApiBase()) {
    try {
      const res = await fetch(`${getApiBase()}/revisions/song/${songId}`);
      // Guard the JSON parse too: a proxy/404 HTML body throws here, and an
      // escaping rejection from a caller's finally-only try kills the whole tree.
      if (res.ok) return (await res.json()) as RevisionHistoryResponse;
    } catch {
      // Fallback
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const revisionsKey = `${STORAGE_REVISIONS_PREFIX}${songId}`;
      const rawRev = localStorage.getItem(revisionsKey);
      const revisions: SongRevision[] = rawRev ? JSON.parse(rawRev) : [];

      const docRaw = localStorage.getItem(`${STORAGE_DOC_PREFIX}${songId}`);
      const doc = docRaw ? (JSON.parse(docRaw) as OpenLyricsDocument) : null;

      return {
        songId,
        songTitle: doc?.metadata.title || 'Untitled Track',
        artistName: doc?.metadata.artist || 'Untitled Artist',
        currentRevisionHash: revisions[0]?.hash || '0x0000000000',
        revisions,
      };
    } catch {
      // Empty fallback
    }
  }

  return {
    songId,
    songTitle: 'Untitled Track',
    artistName: 'Untitled Artist',
    currentRevisionHash: '0x0000000000',
    revisions: [],
  };
}
