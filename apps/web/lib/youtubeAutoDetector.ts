/**
 * YouTube Auto-Detector — Same-Origin Proxy Architecture
 *
 * Queries our own /api/youtube/search endpoint which proxies InnerTube
 * server-side. Works identically on:
 *   - Local dev:  scripts/dev-server.mjs handles the proxy
 *   - Production: apps/web/functions/api/youtube/search.ts (Cloudflare Pages Function)
 *
 * Prioritizes YouTube's natural #1 search ranking with smart negative
 * keyword filtering to avoid unwanted remixes, covers, and fan-edits.
 */

import { shouldUseYouTubeAutoDetect } from './runtimeMode';
import { searchYouTubeViaExtension } from './studioConnect/search';
import { rankYouTubeCandidates } from './youtubeSearchRank';

export interface DetectedYouTubeMatch {
  videoId: string;
  title: string;
  channelTitle?: string;
  duration?: number;
}

export interface YouTubeSearchResult {
  bestMatch: DetectedYouTubeMatch | null;
  candidates: DetectedYouTubeMatch[];
}

export interface YouTubeSearchOptions {
  instrumentalOnly?: boolean;
}

// In-memory cache for sub-millisecond repeated lookups
const youtubeSearchCache = new Map<string, YouTubeSearchResult>();

/**
 * Sanitizes artist and title strings (strips slashes, brackets, feat tokens)
 */
export function sanitizeMusicQuery(artist: string, title: string): string {
  const cleanArtist = (artist || '')
    .replace(/[\/\\]+/g, ' ')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\b(feat|ft|featuring)\b\.?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let cleanTitle = (title || '')
    .replace(/\s*\([^)]*remaster[^)]*\)/gi, '')
    .replace(/\s*\([^)]*version[^)]*\)/gi, '')
    .replace(/[\/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If the title begins with the artist name (e.g. "RADWIMPS - Suzume"), strip the redundant artist prefix
  if (cleanArtist && cleanTitle.toLowerCase().startsWith(cleanArtist.toLowerCase())) {
    cleanTitle = cleanTitle.slice(cleanArtist.length).replace(/^[\s\-–—:]+/, '').trim();
  }

  return `${cleanArtist} ${cleanTitle}`.trim();
}

const DEFAULT_WORKER_API = 'https://openlyryc-core.aurostronyee1.workers.dev';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || DEFAULT_WORKER_API;

/**
 * Directly searches YouTube with a raw custom query string (used for manual mini search).
 */
export async function searchYouTubeDirect(
  rawQuery: string,
  targetDurationSeconds?: number,
  options?: YouTubeSearchOptions
): Promise<YouTubeSearchResult> {
  const query = (rawQuery || '').trim();
  if (!query || query.length < 2) return { bestMatch: null, candidates: [] };

  const isInstrumental = !!(options?.instrumentalOnly || /\binstrumentals?\b/i.test(query));
  const cacheKey = `${query.toLowerCase()}::${targetDurationSeconds || 0}::${isInstrumental ? 'inst' : 'std'}`;
  const cached = youtubeSearchCache.get(cacheKey);
  if (cached) return cached;

  // Offline mode: auto-detect and remote search disabled (manual video IDs still work).
  try {
    if (!shouldUseYouTubeAutoDetect()) return { bestMatch: null, candidates: [] };
  } catch {
    // ignore and continue with network search
  }

  // YouTube Music search through the extension's signed session first (skip if instrumental mode)
  if (!isInstrumental) {
    const viaExtension = await searchYouTubeViaExtension(query, targetDurationSeconds);
    if (viaExtension) {
      youtubeSearchCache.set(cacheKey, viaExtension);
      return viaExtension;
    }
  }

  const durParam = targetDurationSeconds ? `&duration=${targetDurationSeconds}` : '';
  const typeParam = isInstrumental ? '&type=instrumental' : '';
  const encodedQuery = encodeURIComponent(query);

  const isBrowser = typeof window !== 'undefined';
  const isLocalhost =
    isBrowser &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]');

  // Resilient endpoint resolution:
  // 1. Direct localhost:3099 companion proxy (if running locally during dev)
  // 2. Production Edge Worker API (always accessible via CORS, highly reliable)
  // 3. Same-origin /api/youtube/search (works when Cloudflare Pages Functions are active or reverse proxy)
  const endpoints: string[] = [];

  if (isLocalhost) {
    endpoints.push(`http://localhost:3099/api/youtube/search?q=${encodedQuery}${durParam}${typeParam}`);
    endpoints.push(`http://127.0.0.1:3099/api/youtube/search?q=${encodedQuery}${durParam}${typeParam}`);
  }

  if (API_BASE_URL) {
    endpoints.push(`${API_BASE_URL}/api/v1/youtube/search?q=${encodedQuery}${durParam}${typeParam}`);
    endpoints.push(`${API_BASE_URL}/api/youtube/search?q=${encodedQuery}${durParam}${typeParam}`);
  }

  // Same-origin fallback
  endpoints.push(`/api/youtube/search?q=${encodedQuery}${durParam}${typeParam}`);

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) continue;

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) continue;

      const data = await res.json();
      if (!data) continue;

      const rawCandidates: DetectedYouTubeMatch[] = (data.candidates || []).map((c: any) => ({
        videoId: c.videoId,
        title: c.title || '',
        channelTitle: c.channelTitle || '',
        duration: c.durationSeconds,
      }));

      // Apply client-side candidate ranking and strict instrumental filtering
      const rankedResult = rankYouTubeCandidates(
        rawCandidates.map((c) => ({
          videoId: c.videoId,
          title: c.title,
          channelTitle: c.channelTitle || '',
          durationSeconds: c.duration || 0,
        })),
        query,
        targetDurationSeconds,
        { instrumentalOnly: isInstrumental }
      );

      const finalCandidates: DetectedYouTubeMatch[] = rankedResult.candidates.map((c) => ({
        videoId: c.videoId,
        title: c.title,
        channelTitle: c.channelTitle,
        duration: c.durationSeconds,
      }));

      const bestMatch: DetectedYouTubeMatch | null = rankedResult.bestMatch
        ? {
            videoId: rankedResult.bestMatch.videoId,
            title: rankedResult.bestMatch.title,
            channelTitle: rankedResult.bestMatch.channelTitle,
            duration: rankedResult.bestMatch.durationSeconds,
          }
        : (finalCandidates[0] || null);

      if (bestMatch || finalCandidates.length > 0) {
        const result: YouTubeSearchResult = { bestMatch, candidates: finalCandidates };
        youtubeSearchCache.set(cacheKey, result);
        return result;
      }
    } catch {
      continue;
    }
  }

  return { bestMatch: null, candidates: [] };
}

/**
 * Searches for all YouTube video matches with candidate alternatives based on artist & title.
 */
export async function searchYouTubeMatches(
  artist: string,
  title: string,
  targetDurationSeconds?: number,
  options?: YouTubeSearchOptions
): Promise<YouTubeSearchResult> {
  const query = sanitizeMusicQuery(artist, title);
  return searchYouTubeDirect(query, targetDurationSeconds, options);
}

/**
 * Searches YouTube strictly for instrumental backing tracks, favouring titles with "instrumental".
 */
export async function searchYouTubeInstrumentalMatches(
  artist: string,
  title: string,
  targetDurationSeconds?: number
): Promise<YouTubeSearchResult> {
  const clean = sanitizeMusicQuery(artist, title);
  const query = `${clean} instrumental`.trim();
  const res = await searchYouTubeDirect(query, targetDurationSeconds, { instrumentalOnly: true });

  // If primary query returned 0 matches, fallback to title-only instrumental query
  if (!res.bestMatch && title) {
    const fallbackQuery = `${title.trim()} instrumental`;
    return searchYouTubeDirect(fallbackQuery, targetDurationSeconds, { instrumentalOnly: true });
  }

  return res;
}

/**
 * Auto-detects the best YouTube video match via same-origin proxy.
 */
export async function detectBestYouTubeMatch(
  artist: string,
  title: string,
  targetDurationSeconds?: number,
  _isrc?: string,
  _spotifyId?: string
): Promise<DetectedYouTubeMatch | null> {
  const result = await searchYouTubeMatches(artist, title, targetDurationSeconds);
  return result.bestMatch;
}

/**
 * Auto-detects the best instrumental/karaoke YouTube audio match for a song.
 * Strictly favours and selects titles with "instrumental".
 */
export async function detectBestInstrumentalYouTubeMatch(
  artist: string,
  title: string,
  targetDurationSeconds?: number
): Promise<DetectedYouTubeMatch | null> {
  const result = await searchYouTubeInstrumentalMatches(artist, title, targetDurationSeconds);
  return result.bestMatch;
}

/**
 * Shared one-shot helper behind every "Auto-fetch from YouTube" entry point
 * (metadata sidebar Auto button, No-Audio modal Fetch from YT). Returns the
 * best match or null — callers apply `updateMetadata({ youtubeId })`.
 */
export async function fetchBestYouTubeMatchId(
  artist: string,
  title: string,
  targetDurationSeconds?: number,
  options?: YouTubeSearchOptions
): Promise<DetectedYouTubeMatch | null> {
  if (!artist.trim() && !title.trim()) return null;
  if (options?.instrumentalOnly) {
    return detectBestInstrumentalYouTubeMatch(artist, title, targetDurationSeconds);
  }
  return detectBestYouTubeMatch(artist, title, targetDurationSeconds);
}
