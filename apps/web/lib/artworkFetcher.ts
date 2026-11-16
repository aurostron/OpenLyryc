/**
 * ARTWORK FETCHER — High-resolution album cover art resolution service.
 * Piggybacks across iTunes Search API, lrc.red, and LRCLIB to fetch authentic
 * 600x600+ album artwork for any track.
 */

import { shouldFetchArtwork } from './runtimeMode';

const artworkCacheMap = new Map<string, string>();
const inFlightArtworkPromises = new Map<string, Promise<string | null>>();

/**
 * Sanitizes track title and artist query string
 */
function cleanQueryTerm(str: string): string {
  if (!str) return '';
  const cleaned = str
    .replace(/[.!?,:;]+$/, '')
    .replace(/[\(\[](feat|ft|with|prod)\.?\s+[^\)\]]+[\)\]]/gi, '')
    .replace(/[\(\[](official|lyrics?|video|audio|visualizer|remix|edit|sped\s*up|slowed)[^\)\]]*[\)\]]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Guard against querying iTunes/LRCLIB for generic fallback strings like "Untitled Track" or "Unknown Artist"
  if (/^untitled\s*(track|song|project|audio)?$/i.test(cleaned) || /^unknown\s*(artist|author)?$/i.test(cleaned)) {
    return '';
  }

  return cleaned;
}

/**
 * Fetches high-resolution cover artwork URL for a given artist and track title.
 */
export async function fetchArtworkUrl(artist?: string, title?: string): Promise<string | null> {
  try {
    if (!shouldFetchArtwork()) return null;
  } catch {
    // ignore and continue
  }
  const cleanTitle = cleanQueryTerm(title || '');
  const cleanArtist = cleanQueryTerm(artist || '');

  // Require cleanTitle to be present; searching iTunes with artist alone returns random unrelated track artwork
  if (!cleanTitle) return null;

  const cacheKey = `${cleanArtist.toLowerCase()}:::${cleanTitle.toLowerCase()}`;
  if (artworkCacheMap.has(cacheKey)) {
    return artworkCacheMap.get(cacheKey)!;
  }

  if (inFlightArtworkPromises.has(cacheKey)) {
    return inFlightArtworkPromises.get(cacheKey)!;
  }

  const promise = (async (): Promise<string | null> => {
    const combinedQuery = `${cleanArtist} ${cleanTitle}`.trim();

    // Stage 1: iTunes Search API (Fast, high quality, worldwide CDN)
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(combinedQuery)}&entity=song&limit=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined });
      if (res.ok) {
        const data = await res.json();
        const rawArt = data?.results?.[0]?.artworkUrl100;
        if (rawArt && typeof rawArt === 'string') {
          const hdArt = rawArt.replace('100x100bb', '600x600bb');
          artworkCacheMap.set(cacheKey, hdArt);
          return hdArt;
        }
      }
    } catch (err) {
      // ignore & fallback to stage 2
    }

    // Stage 2: lrc.red match API
    try {
      const lrcUrl = `https://lrc.red/match.json?title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}`;
      const res = await fetch(lrcUrl, { signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined });
      if (res.ok) {
        const data = await res.json();
        const hitCover = data?.hits?.[0]?.cover;
        if (hitCover && typeof hitCover === 'string') {
          artworkCacheMap.set(cacheKey, hitCover);
          return hitCover;
        }
      }
    } catch (err) {
      // ignore & fallback to stage 3
    }

    // Stage 3: LRCLIB Search API fallback
    try {
      const lrclibUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(combinedQuery)}`;
      const res = await fetch(lrclibUrl, { signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined });
      if (res.ok) {
        const hits = await res.json();
        if (Array.isArray(hits) && hits.length > 0) {
          const art = hits[0]?.artworkUrl || hits[0]?.cover;
          if (art && typeof art === 'string') {
            artworkCacheMap.set(cacheKey, art);
            return art;
          }
        }
      }
    } catch (err) {
      // ignore
    }

    return null;
  })();

  inFlightArtworkPromises.set(cacheKey, promise);

  try {
    // The promise resolves to null on lookup failure, so this only rejects on
    // genuinely unexpected errors — still catch so callers never see a rejection.
    return await promise;
  } catch {
    return null;
  } finally {
    inFlightArtworkPromises.delete(cacheKey);
  }
}
