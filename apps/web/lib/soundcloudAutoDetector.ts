/**
 * SoundCloud Auto-Detector & Search Helper
 *
 * Resolves SoundCloud tracks without requiring user API keys.
 * Queries our Edge Worker endpoint (/api/v1/soundcloud/search) or Localhost Companion proxy.
 */

import { sanitizeMusicQuery } from './youtubeAutoDetector';

export interface DetectedSoundCloudMatch {
  url: string;
  title: string;
  author: string;
  score?: number;
}

export interface SoundCloudSearchResult {
  bestMatch: DetectedSoundCloudMatch | null;
  candidates: DetectedSoundCloudMatch[];
}

const DEFAULT_WORKER_API = 'https://openlyryc-core.aurostronyee1.workers.dev';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || DEFAULT_WORKER_API;

export const MAJOR_NEGATIVE_KEYWORDS = [
  'acapella', 'a capella', 'acappella',
  'karaoke', 'instrumental', 'backing track',
  'cover', 'tribute', 'parody', 'reaction', 'tutorial', 'lesson',
  'marathi', 'bhojpuri', 'bengali', 'tamil', 'telugu', 'gujarati', 'kannada', 'malayalam',
  '10 hours', '1 hour', 'loop', 'extended loop',
];

export const MODERATE_NEGATIVE_KEYWORDS = [
  'slowed', 'reverb', 'remix', 'bass boosted', 'mashup', 'nightcore',
  'sped up', 'speed up', 'lofi', 'lo-fi', 'flip', 'freestyle',
];

export function normalizeSoundCloudText(s: string): string {
  return (s || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reranks candidate matches by token similarity, negative keywords, and official badges.
 */
export function rankSoundCloudCandidates(
  query: string,
  candidates: DetectedSoundCloudMatch[]
): DetectedSoundCloudMatch[] {
  const normQuery = normalizeSoundCloudText(query);
  const qTokens = normQuery.split(' ').filter((t) => t.length > 1);

  const scored = candidates.map((cand) => {
    let score = cand.score ?? 50;
    const normTitle = normalizeSoundCloudText(cand.title);
    const normAuthor = normalizeSoundCloudText(cand.author);
    const combined = `${normTitle} ${normAuthor}`;

    if (qTokens.length > 0) {
      let matched = 0;
      for (const t of qTokens) {
        if (combined.includes(t)) matched++;
      }
      score = 50 + Math.round((matched / qTokens.length) * 50);
    }

    for (const kw of MAJOR_NEGATIVE_KEYWORDS) {
      if (combined.includes(kw) && !normQuery.includes(kw)) {
        score -= 45;
      }
    }

    for (const kw of MODERATE_NEGATIVE_KEYWORDS) {
      if (combined.includes(kw) && !normQuery.includes(kw)) {
        score -= 25;
      }
    }

    if (
      combined.includes('official') ||
      combined.includes('original') ||
      combined.includes('radio edit') ||
      combined.includes('studio master')
    ) {
      score += 15;
    }

    return {
      ...cand,
      score: Math.max(0, score),
    };
  });

  return scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/**
 * Searches SoundCloud using raw query string across available edge / companion endpoints.
 */
export async function searchSoundCloudDirect(
  rawQuery: string
): Promise<SoundCloudSearchResult> {
  const query = (rawQuery || '').trim();
  if (!query || query.length < 2) return { bestMatch: null, candidates: [] };

  const encodedQuery = encodeURIComponent(query);

  const isBrowser = typeof window !== 'undefined';
  const isLocalhost =
    isBrowser &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]');

  const endpoints: string[] = [];

  // 1. Localhost companion proxy (if active)
  if (isLocalhost) {
    endpoints.push(`http://localhost:3099/api/soundcloud/search?q=${encodedQuery}`);
    endpoints.push(`http://127.0.0.1:3099/api/soundcloud/search?q=${encodedQuery}`);
  }

  // 2. Production Edge Worker API
  if (API_BASE_URL) {
    endpoints.push(`${API_BASE_URL}/api/v1/soundcloud/search?q=${encodedQuery}`);
    endpoints.push(`${API_BASE_URL}/api/soundcloud/search?q=${encodedQuery}`);
  }

  // 3. Same-origin fallback
  endpoints.push(`/api/soundcloud/search?q=${encodedQuery}`);

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

      let candidates: DetectedSoundCloudMatch[] = (data.candidates || []).map((c: any) => ({
        url: c.url,
        title: c.title || '',
        author: c.author || '',
        score: c.score,
      }));

      candidates = rankSoundCloudCandidates(query, candidates);
      const bestMatch: DetectedSoundCloudMatch | null = candidates[0] || null;

      if (bestMatch || candidates.length > 0) {
        return { bestMatch, candidates };
      }
    } catch {
      continue;
    }
  }

  return { bestMatch: null, candidates: [] };
}

/**
 * Searches for all SoundCloud matches based on artist & song title.
 */
export async function searchSoundCloudMatches(
  artist: string,
  title: string
): Promise<SoundCloudSearchResult> {
  const query = sanitizeMusicQuery(artist, title);
  return searchSoundCloudDirect(query);
}

/**
 * Auto-detects the best SoundCloud track match via same-origin proxy / edge worker.
 */
export async function fetchBestSoundCloudMatch(
  artist: string,
  title: string
): Promise<DetectedSoundCloudMatch | null> {
  const result = await searchSoundCloudMatches(artist, title);
  return result.bestMatch;
}
