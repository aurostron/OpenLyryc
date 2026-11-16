import { OpenLyricsDocument, LyricLine, SongSearchResult, WordToken } from '@/types/lyrics';
import { searchLrclib, fetchLrclibDocument, parseLrcStringToLines } from './lrclibService';
import { parseTTML } from './ttmlParser';
import { computeLyricsHash } from './lyricsFingerprint';
import { corsResilientFetch } from './security/sandbox';
import { shouldUseOnlineLyrics } from './runtimeMode';

const MXM_ROOT = 'https://apic-desktop.musixmatch.com/ws/1.1/';
const MXM_APP_ID = 'web-desktop-app-v1.0';
const BINIMUM_API_BASE = 'https://lyrics-api.binimum.org/';
const LRC_RED_API_BASE = 'https://lrc.red/';

// Cached user token for Musixmatch with Local/Session storage persistence
const MXM_STORAGE_KEY = 'openlyryc_mxm_token_v1';
let cachedMxmToken: string | null = null;
let mxmTokenPromise: Promise<string | null> | null = null;

// Track caches for instant 0ms document retrieval on "Load" click
interface CachedTrackRecord {
  source: 'musixmatch' | 'binimum' | 'lrclib' | 'lrcred';
  mxmTrackId?: number;
  lyricsUrl?: string;
  isrc?: string;
  rawPayload?: any;
}
const onlineTrackCache = new Map<string, CachedTrackRecord>();

// Multi-tier Query Cache (Memory + SessionStorage with 10-minute TTL)
interface SearchCacheEntry {
  timestamp: number;
  results: SongSearchResult[];
}
const searchQueryCache = new Map<string, SearchCacheEntry>();
const QUERY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const inFlightSearches = new Map<string, Promise<SongSearchResult[]>>();

// Provider Cooldown Tracking for Rate-Limit (429) Protection
const providerCooldowns = {
  musixmatch: 0,
  binimum: 0,
  lrclib: 0,
  lrcred: 0,
};

function isProviderCoolingDown(provider: 'musixmatch' | 'binimum' | 'lrclib' | 'lrcred'): boolean {
  return Date.now() < providerCooldowns[provider];
}

function setProviderCooldown(provider: 'musixmatch' | 'binimum' | 'lrclib' | 'lrcred', cooldownMs = 15000) {
  providerCooldowns[provider] = Date.now() + cooldownMs;
}

/**
 * Creates an AbortSignal that aborts if either the parent signal aborts
 * or the per-provider timeout expires (default 4500ms).
 */
function createProviderSignal(parentSignal?: AbortSignal, timeoutMs = 4500): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException('Provider search timed out', 'TimeoutError'));
  }, timeoutMs);

  const onParentAbort = () => {
    clearTimeout(timer);
    controller.abort(parentSignal?.reason);
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      clearTimeout(timer);
      controller.abort(parentSignal.reason);
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  const cleanup = () => {
    clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  };

  return { signal: controller.signal, cleanup };
}

interface MxmRichSyncWord {
  c: string; // word text
  o: number; // offset in seconds from ts
}

interface MxmRichSyncLine {
  ts: number; // start time (s)
  te: number; // end time (s)
  l: MxmRichSyncWord[];
  x: string;  // full line text
}

interface BinimumResultItem {
  id?: string;
  track_name?: string;
  artist_name?: string;
  album_name?: string;
  duration?: number;
  isrc?: string;
  timing_type?: 'syllable' | 'line';
  lyricsUrl?: string;
  artwork_url?: string;
  artwork?: string;
  cover?: string;
  release_date?: string | number;
}

/**
 * Acquires a Musixmatch desktop user token (browser CORS-friendly) with storage caching
 */
async function getMusixmatchToken(): Promise<string | null> {
  if (cachedMxmToken) {
    if (/^0+$/.test(cachedMxmToken)) {
      cachedMxmToken = null;
    } else {
      return cachedMxmToken;
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(MXM_STORAGE_KEY) || sessionStorage.getItem(MXM_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed?.token &&
          typeof parsed.token === 'string' &&
          !/^0+$/.test(parsed.token) &&
          Date.now() - (parsed.time || 0) < 12 * 3600 * 1000
        ) {
          cachedMxmToken = parsed.token;
          return cachedMxmToken;
        } else {
          localStorage.removeItem(MXM_STORAGE_KEY);
          sessionStorage.removeItem(MXM_STORAGE_KEY);
        }
      }
    } catch {}
  }

  if (mxmTokenPromise) return mxmTokenPromise;

  mxmTokenPromise = (async () => {
    try {
      const res = await fetch(`${MXM_ROOT}token.get?app_id=${MXM_APP_ID}&user_language=en&t=${Date.now()}`, {
        signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
      });
      if (!res.ok) return null;
      const data = await res.json();
      const token = data?.message?.body?.user_token;
      if (token && typeof token === 'string' && !/^0+$/.test(token)) {
        cachedMxmToken = token;
        if (typeof window !== 'undefined') {
          try {
            const payload = JSON.stringify({ token, time: Date.now() });
            localStorage.setItem(MXM_STORAGE_KEY, payload);
            sessionStorage.setItem(MXM_STORAGE_KEY, payload);
          } catch {}
        }
        return token;
      }
      return null;
    } catch (err) {
      console.warn('[OpenLyryc] Musixmatch token error:', err);
      return null;
    } finally {
      mxmTokenPromise = null;
    }
  })();

  return mxmTokenPromise;
}

/**
 * Searches Musixmatch catalog for richsync word-synced & line-synced lyrics
 */
async function searchMusixmatch(query: string, parentSignal?: AbortSignal): Promise<SongSearchResult[]> {
  if (isProviderCoolingDown('musixmatch')) return [];

  const { signal, cleanup } = createProviderSignal(parentSignal, 4500);
  try {
    const token = await getMusixmatchToken();
    if (!token) return [];

    const url = new URL(`${MXM_ROOT}track.search`);
    url.searchParams.append('app_id', MXM_APP_ID);
    url.searchParams.append('usertoken', token);
    url.searchParams.append('q', query);
    url.searchParams.append('f_has_lyrics', '1');
    url.searchParams.append('page_size', '15');
    url.searchParams.append('t', Date.now().toString());

    const res = await fetch(url.toString(), { signal });
    if (res.status === 429) {
      setProviderCooldown('musixmatch', 20000);
      return [];
    }
    if (!res.ok) return [];

    const data = await res.json();
    const trackList = data?.message?.body?.track_list;
    if (!Array.isArray(trackList)) return [];

    const results: SongSearchResult[] = [];

    for (const item of trackList) {
      const track = item?.track;
      if (!track || !track.track_id) continue;

      const trackId = track.track_id;
      const title = track.track_name || 'Untitled';
      const artist = track.artist_name || 'Unknown Artist';
      const hasWordSync = Boolean(track.has_richsync === 1);
      const hasLineSync = Boolean(track.has_subtitles === 1);
      const songId = `mxm_${trackId}`;

      onlineTrackCache.set(songId, {
        source: 'musixmatch',
        mxmTrackId: trackId,
        rawPayload: track,
      });

      results.push({
        id: songId,
        title,
        artist,
        album: track.album_name || undefined,
        duration: Math.round(track.track_length || 0),
        syncedBy: hasWordSync ? 'Musixmatch (Word Sync)' : 'Musixmatch',
        hasWordSync,
        hasLineSync,
        source: 'musixmatch',
        qualityScore: hasWordSync ? 0.96 : (hasLineSync ? 0.88 : 0.40),
        revisionHash: songId,
        updatedAt: new Date().toISOString(),
        canonicalKey: `mxm:${trackId}`,
        status: 'approved',
        coverArt: track.album_coverart_500x500 || track.album_coverart_350x350 || track.album_coverart_100x100 || undefined,
        year: track.first_release_date ? track.first_release_date.slice(0, 4) : undefined,
      });
    }

    return results;
  } catch (err: any) {
    if (err?.name !== 'AbortError' && err?.name !== 'TimeoutError') {
      console.warn('[OpenLyryc] Musixmatch search error:', err);
    }
    return [];
  } finally {
    cleanup();
  }
}

/**
 * Searches Binimum catalog for Apple Music syllable-synced & line-synced TTML
 */
async function searchBinimum(query: string, parentSignal?: AbortSignal): Promise<SongSearchResult[]> {
  if (isProviderCoolingDown('binimum')) return [];

  const { signal, cleanup } = createProviderSignal(parentSignal, 4500);
  try {
    const url = new URL(`${BINIMUM_API_BASE}search`);
    url.searchParams.append('q', query);

    const res = await fetch(url.toString(), { signal });
    if (res.status === 429) {
      setProviderCooldown('binimum', 20000);
      return [];
    }
    if (!res.ok) return [];

    const data = await res.json();
    const items: BinimumResultItem[] = data?.results || [];
    if (!Array.isArray(items)) return [];

    const results: SongSearchResult[] = [];

    for (const item of items) {
      if (!item.lyricsUrl) continue;
      const title = item.track_name || query;
      const artist = item.artist_name || 'Unknown Artist';
      const isSyllable = item.timing_type === 'syllable';
      const songId = `bini_${item.id || encodeURIComponent(item.lyricsUrl)}`;

      onlineTrackCache.set(songId, {
        source: 'binimum',
        lyricsUrl: item.lyricsUrl,
        rawPayload: item,
      });

      results.push({
        id: songId,
        title,
        artist,
        album: item.album_name || undefined,
        duration: Math.round(item.duration || 0),
        syncedBy: isSyllable ? 'Apple Music (Syllable Sync)' : 'Apple Music',
        hasWordSync: isSyllable,
        hasLineSync: true,
        source: 'binimum',
        qualityScore: isSyllable ? 0.98 : 0.89,
        revisionHash: songId,
        updatedAt: new Date().toISOString(),
        canonicalKey: item.isrc ? `isrc:${item.isrc}` : `bini:${item.id || 'apple'}`,
        status: 'approved',
        coverArt: item.artwork_url || item.artwork || item.cover || undefined,
        year: item.release_date ? String(item.release_date).slice(0, 4) : undefined,
      });
    }

    return results;
  } catch (err: any) {
    if (err?.name !== 'AbortError' && err?.name !== 'TimeoutError') {
      console.warn('[OpenLyryc] Binimum search error:', err);
    }
    return [];
  } finally {
    cleanup();
  }
}

/**
 * Searches lrc.red catalog for Apple Music syllable-synced & line-synced TTML
 */
async function searchLrcRed(query: string, parentSignal?: AbortSignal): Promise<SongSearchResult[]> {
  if (isProviderCoolingDown('lrcred')) return [];

  const { signal, cleanup } = createProviderSignal(parentSignal, 4500);
  try {
    const url = new URL(`${LRC_RED_API_BASE}search.json`);
    url.searchParams.append('q', query);

    const res = await fetch(url.toString(), { signal });
    if (res.status === 429) {
      setProviderCooldown('lrcred', 20000);
      return [];
    }
    if (!res.ok) return [];

    const data = await res.json();
    const hits = data?.hits || [];
    if (!Array.isArray(hits)) return [];

    const results: SongSearchResult[] = [];

    for (const item of hits) {
      if (!item.isrc) continue;
      const title = item.title || query;
      const artist = item.artist || 'Unknown Artist';
      const lyricsUrl = `${LRC_RED_API_BASE}s/${item.isrc}.ttml`;
      const songId = `lrcred_${item.isrc}`;

      onlineTrackCache.set(songId, {
        source: 'lrcred',
        lyricsUrl,
        isrc: item.isrc,
        rawPayload: item,
      });

      results.push({
        id: songId,
        title,
        artist,
        album: item.album || undefined,
        duration: Math.round(item.duration || 0),
        syncedBy: 'Apple Music (lrc.red)',
        hasWordSync: true,
        hasLineSync: true,
        source: 'lrcred',
        qualityScore: 0.98,
        revisionHash: songId,
        updatedAt: new Date().toISOString(),
        canonicalKey: `isrc:${item.isrc}`,
        status: 'approved',
        coverArt: item.cover || undefined,
        year: item.year || undefined,
      });
    }

    return results;
  } catch (err: any) {
    if (err?.name !== 'AbortError' && err?.name !== 'TimeoutError') {
      console.warn('[OpenLyryc] lrc.red search error:', err);
    }
    return [];
  } finally {
    cleanup();
  }
}

/**
 * Calculates keyword overlap relevance ratio [0..1] between query and (title + artist).
 */
function computeQueryRelevance(query: string, title: string, artist: string): number {
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);
  const qTokens = normalize(query);
  if (qTokens.length === 0) return 1;

  const targetTokens = new Set([...normalize(title), ...normalize(artist)]);
  let matchCount = 0;
  for (const qt of qTokens) {
    if (
      targetTokens.has(qt) ||
      Array.from(targetTokens).some((tt) => tt.includes(qt) || qt.includes(tt))
    ) {
      matchCount++;
    }
  }
  return matchCount / qTokens.length;
}

/**
 * Searches across Musixmatch, Binimum (Apple Music), and LRCLIB in parallel,
 * with multi-tier caching, deduplication, and fast fallback timeouts.
 */
export async function searchAllOnlineLyrics(query: string, signal?: AbortSignal): Promise<SongSearchResult[]> {
  try {
    if (!shouldUseOnlineLyrics()) return [];
  } catch {
    // ignore and continue
  }
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const cacheKey = trimmed.toLowerCase();

  // 1. Check in-memory search cache (0ms instant return)
  const cached = searchQueryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < QUERY_CACHE_TTL_MS) {
    return cached.results;
  }

  // 2. Check in-flight duplicate promise
  if (inFlightSearches.has(cacheKey)) {
    return inFlightSearches.get(cacheKey)!;
  }

  const searchPromise = (async () => {
    try {
      const [mxmResults, biniResults, lrcredResults, lrcResults] = await Promise.allSettled([
        searchMusixmatch(trimmed, signal),
        searchBinimum(trimmed, signal),
        searchLrcRed(trimmed, signal),
        searchLrclib(trimmed, signal),
      ]);

      const mxm = mxmResults.status === 'fulfilled' ? mxmResults.value : [];
      const bini = biniResults.status === 'fulfilled' ? biniResults.value : [];
      const lrcred = lrcredResults.status === 'fulfilled' ? lrcredResults.value : [];
      const lrc = lrcResults.status === 'fulfilled' ? lrcResults.value : [];

      // Combine all provider candidates
      const allCandidates = [...lrcred, ...bini, ...mxm, ...lrc];

      // Calculate relevance for each candidate and drop zero-relevance poison results
      const scoredCandidates = allCandidates
        .map((song) => ({
          song,
          relevance: computeQueryRelevance(trimmed, song.title, song.artist),
        }))
        .filter((item) => item.relevance > 0);

      // Deduplicate by normalized title + artist
      const mergedMap = new Map<string, { song: SongSearchResult; relevance: number }>();

      for (const item of scoredCandidates) {
        const key = `${item.song.title.toLowerCase().trim()}_${item.song.artist.toLowerCase().trim()}`;
        const existing = mergedMap.get(key);
        if (!existing) {
          mergedMap.set(key, item);
        } else {
          // If existing doesn't have word sync but new one does, upgrade to the word-synced version
          if (!existing.song.hasWordSync && item.song.hasWordSync) {
            mergedMap.set(key, item);
          }
        }
      }

      // Sort: Highest Relevance first, then Word Sync, then Line Sync, then Quality Score
      const sorted = Array.from(mergedMap.values())
        .sort((a, b) => {
          if (Math.abs(b.relevance - a.relevance) > 0.01) {
            return b.relevance - a.relevance;
          }
          if (a.song.hasWordSync && !b.song.hasWordSync) return -1;
          if (!a.song.hasWordSync && b.song.hasWordSync) return 1;
          if (a.song.hasLineSync && !b.song.hasLineSync) return -1;
          if (!a.song.hasLineSync && b.song.hasLineSync) return 1;
          return (b.song.qualityScore ?? 0) - (a.song.qualityScore ?? 0);
        })
        .map((item) => item.song);

      // Cache successful non-empty searches
      if (sorted.length > 0) {
        searchQueryCache.set(cacheKey, { timestamp: Date.now(), results: sorted });
      }

      return sorted;
    } finally {
      inFlightSearches.delete(cacheKey);
    }
  })();

  inFlightSearches.set(cacheKey, searchPromise);
  return searchPromise;
}

/**
 * Loads and converts any online provider lyrics track into an OpenLyricsDocument.
 */
export async function fetchOnlineLyricsDocument(songId: string): Promise<OpenLyricsDocument | null> {
  try {
    if (!shouldUseOnlineLyrics()) return null;
  } catch {
    // ignore and continue
  }
  // 1. Musixmatch Track
  if (songId.startsWith('mxm_')) {
    const trackIdStr = songId.replace('mxm_', '');
    const trackId = parseInt(trackIdStr, 10);
    if (!isNaN(trackId)) {
      try {
        const token = await getMusixmatchToken();
        if (!token) return null;

        const cachedRec = onlineTrackCache.get(songId)?.rawPayload;
        const trackTitle = cachedRec?.track_name || 'Untitled';
        const trackArtist = cachedRec?.artist_name || 'Unknown Artist';
        const trackAlbum = cachedRec?.album_name || '';
        const trackDuration = Math.round(cachedRec?.track_length || 0);

        // Try RichSync first
        const richRes = await fetch(
          `${MXM_ROOT}track.richsync.get?app_id=${MXM_APP_ID}&usertoken=${token}&track_id=${trackId}&t=${Date.now()}`
        );

        if (richRes.ok) {
          const richData = await richRes.json();
          const richBodyStr = richData?.message?.body?.richsync?.richsync_body;
          if (richBodyStr) {
            const richLines: MxmRichSyncLine[] = JSON.parse(richBodyStr);
            if (Array.isArray(richLines) && richLines.length > 0) {
              const lines: LyricLine[] = richLines.map((item, idx) => {
                const lineStart = item.ts;
                const lineEnd = item.te || lineStart + 4.0;
                const tokens: WordToken[] = [];

                if (Array.isArray(item.l)) {
                  item.l.forEach((w, wIdx) => {
                    const wStart = item.ts + w.o;
                    const nextWord = item.l[wIdx + 1];
                    const wEnd = nextWord ? item.ts + nextWord.o : lineEnd;
                    if (w.c && w.c.trim().length > 0) {
                      tokens.push({
                        text: w.c,
                        start: Math.round(wStart * 1000) / 1000,
                        end: Math.round(Math.max(wStart + 0.1, wEnd) * 1000) / 1000,
                      });
                    }
                  });
                }

                return {
                  id: `line-${idx + 1}`,
                  text: item.x || tokens.map((t) => t.text).join(' ') || '♪',
                  start: Math.round(lineStart * 1000) / 1000,
                  end: Math.round(lineEnd * 1000) / 1000,
                  tokens: tokens.length > 0 ? tokens : undefined,
                };
              });

              return {
                $schema: 'https://openlyrics.dev/schema/v1.json',
                version: 1,
                metadata: {
                  title: trackTitle,
                  artist: trackArtist,
                  album: trackAlbum || undefined,
                  duration: trackDuration,
                  canonicalKey: `mxm:${trackId}`,
                  syncedBy: 'Musixmatch RichSync',
                },
                lines,
              };
            }
          }
        }

        // Fallback to subtitle LRC
        const subRes = await fetch(
          `${MXM_ROOT}track.subtitle.get?app_id=${MXM_APP_ID}&usertoken=${token}&track_id=${trackId}&subtitle_format=lrc&t=${Date.now()}`
        );
        if (subRes.ok) {
          const subData = await subRes.json();
          const lrcStr = subData?.message?.body?.subtitle?.subtitle_body;
          if (lrcStr && typeof lrcStr === 'string') {
            const lines = parseLrcStringToLines(lrcStr, trackDuration);
            return {
              $schema: 'https://openlyrics.dev/schema/v1.json',
              version: 1,
              metadata: {
                title: trackTitle,
                artist: trackArtist,
                album: trackAlbum || undefined,
                duration: trackDuration,
                canonicalKey: `mxm:${trackId}`,
                syncedBy: 'Musixmatch Subtitles',
              },
              lines,
            };
          }
        }
      } catch (err) {
        console.warn('[OpenLyryc] Error fetching Musixmatch document:', err);
      }
    }
  }

  // 2. Binimum Apple Music TTML Track
  if (songId.startsWith('bini_')) {
    let cached = onlineTrackCache.get(songId);
    const biniId = songId.replace('bini_', '');

    // Rehydrate metadata if memory cache missed on direct page reload
    if (!cached || !cached.rawPayload) {
      try {
        const infoRes = await fetch(`${BINIMUM_API_BASE}search?q=${encodeURIComponent(biniId)}`);
        if (infoRes.ok) {
          const infoData = await infoRes.json();
          const hit = Array.isArray(infoData?.results)
            ? infoData.results.find((item: any) => String(item.id) === biniId || item.lyricsUrl?.includes(biniId)) || infoData.results[0]
            : null;
          if (hit && hit.lyricsUrl) {
            const trackRecord: CachedTrackRecord = {
              source: 'binimum',
              lyricsUrl: hit.lyricsUrl,
              rawPayload: hit,
            };
            onlineTrackCache.set(songId, trackRecord);
            cached = trackRecord;
          }
        }
      } catch {
        // ignore
      }
    }

    let lyricsUrl = cached?.lyricsUrl;
    if (!lyricsUrl && songId.startsWith('bini_http')) {
      lyricsUrl = decodeURIComponent(songId.replace('bini_', ''));
    }
    if (lyricsUrl) {
      try {
        const res = await corsResilientFetch(lyricsUrl);
        if (res.ok) {
          const ttmlXml = await res.text();
          if (ttmlXml && ttmlXml.trim().length > 0) {
            const doc = parseTTML(ttmlXml);
            const rawRec = cached?.rawPayload;
            if (rawRec) {
              if (rawRec.track_name) doc.metadata.title = rawRec.track_name;
              if (rawRec.artist_name) doc.metadata.artist = rawRec.artist_name;
              if (rawRec.album_name) doc.metadata.album = rawRec.album_name;
              if (rawRec.duration) doc.metadata.duration = Math.round(rawRec.duration);
              if (rawRec.isrc) doc.metadata.isrc = rawRec.isrc;
              if (rawRec.artwork_url || rawRec.artwork || rawRec.cover) {
                doc.metadata.coverArt = rawRec.artwork_url || rawRec.artwork || rawRec.cover;
              }
              doc.metadata.syncedBy = 'Apple Music (Binimum)';
            }
            return doc;
          }
        }
      } catch (err) {
        console.warn('[OpenLyryc] Error fetching Binimum document:', err);
      }
    }
  }

  // 3. LRCLIB Track
  if (songId.startsWith('lrc_')) {
    const numericId = parseInt(songId.replace('lrc_', ''), 10);
    if (!isNaN(numericId)) {
      return await fetchLrclibDocument(numericId);
    }
  }

  // 4. lrc.red Apple Music TTML Track
  if (songId.startsWith('lrcred_')) {
    const isrc = songId.replace('lrcred_', '');
    let cached = onlineTrackCache.get(songId);

    // Rehydrate metadata by ISRC if memory cache missed on direct URL load
    if (!cached || !cached.rawPayload) {
      try {
        const infoRes = await fetch(`${LRC_RED_API_BASE}search.json?q=${encodeURIComponent(isrc)}`);
        if (infoRes.ok) {
          const infoData = await infoRes.json();
          const hit = Array.isArray(infoData?.hits)
            ? infoData.hits.find((h: any) => h.isrc === isrc) || infoData.hits[0]
            : null;
          if (hit) {
            const trackRecord: CachedTrackRecord = {
              source: 'lrcred',
              lyricsUrl: `${LRC_RED_API_BASE}s/${isrc}.ttml`,
              isrc,
              rawPayload: hit,
            };
            onlineTrackCache.set(songId, trackRecord);
            cached = trackRecord;
          }
        }
      } catch {
        // ignore
      }

      // iTunes ISRC lookup fallback (100% reliable for any global ISRC code)
      if (!cached || !cached.rawPayload) {
        try {
          const itunesRes = await fetch(`https://itunes.apple.com/lookup?isrc=${encodeURIComponent(isrc)}`);
          if (itunesRes.ok) {
            const itunesData = await itunesRes.json();
            const item = itunesData?.results?.[0];
            if (item) {
              const trackRecord: CachedTrackRecord = {
                source: 'lrcred',
                lyricsUrl: `${LRC_RED_API_BASE}s/${isrc}.ttml`,
                isrc,
                rawPayload: {
                  title: item.trackName,
                  artist: item.artistName,
                  album: item.collectionName,
                  duration: item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 0,
                  cover: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : undefined,
                  isrc,
                },
              };
              onlineTrackCache.set(songId, trackRecord);
              cached = trackRecord;
            }
          }
        } catch {
          // ignore
        }
      }
    }

    const lyricsUrl = cached?.lyricsUrl || `${LRC_RED_API_BASE}s/${isrc}.ttml`;
    try {
      const res = await fetch(lyricsUrl);
      if (res.ok) {
        const ttmlXml = await res.text();
        if (ttmlXml && ttmlXml.trim().length > 0) {
          const doc = parseTTML(ttmlXml);
          const rawRec = cached?.rawPayload;
          if (rawRec) {
            if (rawRec.title) doc.metadata.title = rawRec.title;
            if (rawRec.artist) doc.metadata.artist = rawRec.artist;
            if (rawRec.album) doc.metadata.album = rawRec.album;
            if (rawRec.duration) doc.metadata.duration = Math.round(rawRec.duration);
            if (rawRec.isrc) doc.metadata.isrc = rawRec.isrc;
            if (rawRec.cover) doc.metadata.coverArt = rawRec.cover;
          }
          doc.metadata.syncedBy = 'Apple Music (lrc.red)';
          return doc;
        }
      }
    } catch (err) {
      console.warn('[OpenLyryc] Error fetching lrc.red document:', err);
    }
  }

  return null;
}
