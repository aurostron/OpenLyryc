import { Hono } from 'hono';

export const bpmRouter = new Hono();

export interface SongBpmResult {
  title: string;
  artist: string;
  bpm: number | null;
  key: string | null;
  duration: string | null;
  coverUrl: string | null;
  url: string;
}

// In-memory edge cache: 24-hour TTL to maximize free-tier efficiency
const cache = new Map<string, { data: SongBpmResult[]; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Sanitizes search queries for SongBPM:
 * If format is "Title - Artist", reorders to "Artist Title" because SongBPM's
 * search index takes 21+ seconds on Title-first queries, but under 1 second on Artist-first queries.
 * Strips hyphens, en-dashes, em-dashes, parentheticals, brackets, and extraneous noise.
 */
export function sanitizeSongBpmQuery(rawQuery: string): string {
  let q = rawQuery;

  // If query is "Title - Artist", reorder to "Artist Title"
  const dashMatch = q.match(/^(.*?)\s*[\u2010-\u2015\u2212\-–—]\s*(.*?)$/);
  if (dashMatch) {
    const p1 = dashMatch[1].trim();
    const p2 = dashMatch[2].trim();
    if (p1 && p2) {
      q = `${p2} ${p1}`;
    }
  }

  const noDashes = q
    .replace(/[\u2010-\u2015\u2212\-–—_]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(feat\.?|ft\.?)\b.*$/i, '')
    .replace(/\b(official|music|audio|video|lyrics?|remaster(?:ed)?|hd|4k)\b/gi, ' ')
    .replace(/['"“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Deduplicate consecutive or repeated words (e.g. "Shubh One Love Shubh" -> "Shubh One Love")
  const words = noDashes.split(/\s+/);
  const seen = new Set<string>();
  const dedupped: string[] = [];
  for (const w of words) {
    const lower = w.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      dedupped.push(w);
    }
  }

  return dedupped.join(' ').trim();
}

/**
 * Executes a single POST search to SongBPM.
 */
async function fetchSongBpmHtml(query: string, timeoutMs = 20000): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://songbpm.com/searches', {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://songbpm.com',
        'Referer': 'https://songbpm.com/',
      },
      body: new URLSearchParams({ query: query.trim() }).toString(),
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`SongBPM search returned status ${res.status}`);
    }

    return await res.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parses search result HTML cards returned by SongBPM.
 */
function parseSongBpmHtml(html: string): SongBpmResult[] {
  const results: SongBpmResult[] = [];
  const cardRegex = /<a[^>]*href="(\/@[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = cardRegex.exec(html)) !== null) {
    const path = match[1];
    const card = match[2];

    // Extract cover artwork (Spotify CDN URL inside background-image style)
    const coverMatch =
      card.match(/background-image:\s*url\(&quot;([^&]+)&quot;\)/i) ||
      card.match(/background-image:\s*url\(["']?([^"']+)["']?\)/i);
    const coverUrl = coverMatch ? coverMatch[1] : null;

    // Extract paragraphs: index 0 is Artist, index 1 is Title
    const pMatches = [...card.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, '').trim()
    );
    const artist = pMatches[0] || 'Unknown';
    const title = pMatches[1] || 'Unknown';

    // Key
    const keyMatch = card.match(/<span[^>]*>Key<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/i);
    const key = keyMatch ? keyMatch[1].replace(/<[^>]+>/g, '').trim() : null;

    // Duration
    const durationMatch = card.match(/<span[^>]*>Duration<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/i);
    const duration = durationMatch ? durationMatch[1].replace(/<[^>]+>/g, '').trim() : null;

    // BPM
    const bpmMatch = card.match(/<span[^>]*>BPM<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/i);
    const bpm = bpmMatch ? parseInt(bpmMatch[1].replace(/<[^>]+>/g, '').trim(), 10) : null;

    if (bpm || key || title !== 'Unknown') {
      results.push({
        title,
        artist,
        bpm,
        key,
        duration,
        coverUrl,
        url: `https://songbpm.com${path}`,
      });
    }
  }

  return results;
}

/**
 * Searches SongBPM by submitting a POST form request to /searches (Astro v7 protocol).
 * Features automatic query sanitization and fallback retry.
 */
export async function scrapeSongBpmSearch(query: string): Promise<SongBpmResult[]> {
  const cleanQuery = sanitizeSongBpmQuery(query) || query.trim();
  const normalizedQuery = cleanQuery.toLowerCase();

  const cached = cache.get(normalizedQuery);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  let html: string | null = null;

  try {
    html = await fetchSongBpmHtml(cleanQuery);
  } catch (err) {
    // If sanitized query failed and was different from raw query, attempt raw query as fallback
    if (cleanQuery !== query.trim()) {
      try {
        html = await fetchSongBpmHtml(query.trim());
      } catch {
        throw err;
      }
    } else {
      throw err;
    }
  }

  let results = parseSongBpmHtml(html);

  // If 0 results and query had multiple words, try reversing word order (e.g. "One Love Shubh" -> "Shubh One Love")
  if (results.length === 0) {
    const tokens = cleanQuery.split(/\s+/);
    if (tokens.length >= 2 && tokens.length <= 4) {
      const reversed = [...tokens].reverse().join(' ');
      try {
        const fallbackHtml = await fetchSongBpmHtml(reversed, 8000);
        const fallbackResults = parseSongBpmHtml(fallbackHtml);
        if (fallbackResults.length > 0) {
          results = fallbackResults;
        }
      } catch {
        // Silently proceed with empty results
      }
    }
  }

  if (results.length > 0) {
    cache.set(normalizedQuery, { data: results, timestamp: Date.now() });
    cache.set(query.trim().toLowerCase(), { data: results, timestamp: Date.now() });
  }

  return results;
}

/**
 * Scrapes a single song page directly by SongBPM URL.
 */
export async function scrapeSongBpmPage(url: string): Promise<SongBpmResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://songbpm.com/',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch SongBPM page with status ${res.status}`);
    }

    const html = await res.text();

    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Unknown';

    const artistMatch = html.match(/<a[^>]*href="\/@[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    const artist = artistMatch ? artistMatch[1].replace(/<[^>]+>/g, '').trim() : 'Unknown';

    const coverMatch =
      html.match(/background-image:\s*url\(&quot;([^&]+)&quot;\)/i) ||
      html.match(/background-image:\s*url\(["']?([^"']+)["']?\)/i);
    const coverUrl = coverMatch ? coverMatch[1] : null;

    const bpmMatch =
      html.match(/(\d{2,3})\s*<span[^>]*>\s*BPM\s*<\/span>/i) ||
      html.match(/(\d{2,3})\s*BPM/i);
    const bpm = bpmMatch ? parseInt(bpmMatch[1], 10) : null;

    const keyMatch = html.match(/<dt[^>]*>\s*Key\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i);
    const key = keyMatch ? keyMatch[1].replace(/<[^>]+>/g, '').trim() : null;

    const durationMatch = html.match(/<dt[^>]*>\s*Duration\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i);
    const duration = durationMatch ? durationMatch[1].replace(/<[^>]+>/g, '').trim() : null;

    return {
      title,
      artist,
      bpm,
      key,
      duration,
      coverUrl,
      url,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/bpm?q=... or ?title=...&artist=...
 */
bpmRouter.get('/', async (c) => {
  const query = (
    c.req.query('q') ||
    c.req.query('query') ||
    `${c.req.query('artist') || ''} ${c.req.query('title') || ''}`
  ).trim();

  const directUrl = (c.req.query('url') || '').trim();

  if (directUrl && directUrl.startsWith('https://songbpm.com/')) {
    try {
      const song = await scrapeSongBpmPage(directUrl);
      c.header('Cache-Control', 'public, max-age=86400, s-maxage=604800');
      return c.json({
        status: 'success',
        source: 'songbpm',
        data: song,
      });
    } catch (err: any) {
      return c.json(
        { status: 'error', message: err.message || 'Failed to scrape song page' },
        502
      );
    }
  }

  if (!query) {
    return c.json(
      {
        status: 'error',
        message: 'Missing search query. Pass ?q=song+title or ?url=https://songbpm.com/...',
      },
      400
    );
  }

  try {
    const results = await scrapeSongBpmSearch(query);
    c.header('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    return c.json({
      status: 'success',
      source: 'songbpm',
      query,
      count: results.length,
      results,
    });
  } catch (err: any) {
    return c.json(
      { status: 'error', message: err.message || 'Failed to search SongBPM' },
      502
    );
  }
});

/**
 * GET /api/v1/bpm/search?q=...
 */
bpmRouter.get('/search', async (c) => {
  const query = (c.req.query('q') || c.req.query('query') || '').trim();
  if (!query) {
    return c.json({ status: 'error', message: 'Missing query parameter ?q=' }, 400);
  }

  try {
    const results = await scrapeSongBpmSearch(query);
    c.header('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    return c.json({
      status: 'success',
      source: 'songbpm',
      query,
      count: results.length,
      results,
    });
  } catch (err: any) {
    return c.json(
      { status: 'error', message: err.message || 'Failed to search SongBPM' },
      502
    );
  }
});

/**
 * GET /api/v1/bpm/song?url=...
 */
bpmRouter.get('/song', async (c) => {
  const url = (c.req.query('url') || '').trim();
  if (!url || !url.startsWith('https://songbpm.com/')) {
    return c.json(
      { status: 'error', message: 'Provide a valid SongBPM url starting with https://songbpm.com/' },
      400
    );
  }

  try {
    const song = await scrapeSongBpmPage(url);
    c.header('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    return c.json({
      status: 'success',
      source: 'songbpm',
      data: song,
    });
  } catch (err: any) {
    return c.json(
      { status: 'error', message: err.message || 'Failed to scrape SongBPM page' },
      502
    );
  }
});
