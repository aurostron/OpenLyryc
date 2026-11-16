import { Hono } from 'hono';

type Env = { DB?: unknown; LYRICS_BUCKET?: unknown };

export const soundcloudRouter = new Hono<{ Bindings: Env }>();

export interface SoundCloudCandidate {
  url: string;
  title: string;
  author: string;
  score: number;
}

function normalizeStr(s: string): string {
  return (s || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(str: string): string {
  return (str || '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function calculateTokenSimilarity(query: string, candidateTitle: string, candidateAuthor: string): number {
  const qTokens = normalizeStr(query).split(' ').filter((t) => t.length > 1);
  if (qTokens.length === 0) return 1;

  const targetText = normalizeStr(`${candidateTitle} ${candidateAuthor}`);
  const targetTokens = new Set(targetText.split(' '));

  let matched = 0;
  for (const t of qTokens) {
    if (targetTokens.has(t) || targetText.includes(t)) {
      matched++;
    }
  }
  return matched / qTokens.length;
}

const MAJOR_NEGATIVE_KEYWORDS = [
  'acapella', 'a capella', 'acappella',
  'karaoke', 'instrumental', 'backing track',
  'cover', 'tribute', 'parody', 'reaction', 'tutorial', 'lesson',
  'marathi', 'bhojpuri', 'bengali', 'tamil', 'telugu', 'gujarati', 'kannada', 'malayalam',
  '10 hours', '1 hour', 'loop', 'extended loop',
];

const MODERATE_NEGATIVE_KEYWORDS = [
  'slowed', 'reverb', 'remix', 'bass boosted', 'mashup', 'nightcore',
  'sped up', 'speed up', 'lofi', 'lo-fi', 'flip', 'freestyle',
];

async function scrapeSoundCloudTracks(searchTerm: string): Promise<Array<{ rawPath: string; rawTitle: string }>> {
  if (!searchTerm || searchTerm.trim().length < 2) return [];
  const searchUrl = `https://soundcloud.com/search/sounds?q=${encodeURIComponent(searchTerm.trim())}`;
  try {
    const upstreamRes = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!upstreamRes.ok) return [];

    const html = await upstreamRes.text();
    const noscriptMatch = html.match(/<noscript>([\s\S]*?)<\/noscript>/i);
    const markup = noscriptMatch ? noscriptMatch[1] : html;

    const regex = /<a href="(\/[^"?#]+\/[^"?#]+)">([^<]+)<\/a>/g;
    const items: Array<{ rawPath: string; rawTitle: string }> = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(markup)) !== null) {
      const rawPath = match[1];
      const rawTitle = decodeHtmlEntities(match[2]);

      if (
        rawPath.startsWith('/search') ||
        rawPath.startsWith('/pages') ||
        rawPath.startsWith('/terms') ||
        rawPath.startsWith('/privacy') ||
        rawPath.startsWith('/charts') ||
        rawPath.startsWith('/mobile') ||
        rawPath.startsWith('/tags/') ||
        rawPath.startsWith('/popular/') ||
        rawPath.startsWith('/discover')
      ) {
        continue;
      }

      items.push({ rawPath, rawTitle });
    }
    return items;
  } catch {
    return [];
  }
}

/**
 * Searches SoundCloud using direct server-side HTML scraping without requiring any private API keys.
 */
export async function searchSoundCloudDirect(
  q: string
): Promise<{ query: string; bestMatch: SoundCloudCandidate | null; candidates: SoundCloudCandidate[] }> {
  const query = (q || '').trim();
  if (!query || query.length < 2) {
    return { query, bestMatch: null, candidates: [] };
  }

  const primaryItems = await scrapeSoundCloudTracks(query);
  const allRawItems = [...primaryItems];

  const cleanTitle = query.replace(/^.+?[-–—]\s*/, '').trim();
  if (cleanTitle && cleanTitle.length >= 3 && cleanTitle.toLowerCase() !== query.toLowerCase()) {
    const secondaryItems = await scrapeSoundCloudTracks(cleanTitle);
    allRawItems.push(...secondaryItems);
  }

  const seenUrls = new Set<string>();
  const candidates: SoundCloudCandidate[] = [];
  const lowerQuery = normalizeStr(query);

  for (const item of allRawItems) {
    const fullUrl = `https://soundcloud.com${item.rawPath}`;
    if (seenUrls.has(fullUrl)) continue;
    seenUrls.add(fullUrl);

    const segments = item.rawPath.split('/').filter(Boolean);
    const authorSlug = segments[0] ? segments[0].replace(/-/g, ' ') : '';

    let score = 50;
    const sim = calculateTokenSimilarity(query, item.rawTitle, authorSlug);
    score += Math.round(sim * 50);

    const combinedText = normalizeStr(`${item.rawTitle} ${authorSlug}`);

    for (const kw of MAJOR_NEGATIVE_KEYWORDS) {
      if (combinedText.includes(kw) && !lowerQuery.includes(kw)) {
        score -= 45;
      }
    }

    for (const kw of MODERATE_NEGATIVE_KEYWORDS) {
      if (combinedText.includes(kw) && !lowerQuery.includes(kw)) {
        score -= 25;
      }
    }

    if (
      combinedText.includes('official') ||
      combinedText.includes('original') ||
      combinedText.includes('radio edit') ||
      combinedText.includes('studio master')
    ) {
      score += 15;
    }

    candidates.push({
      url: fullUrl,
      title: item.rawTitle,
      author: authorSlug,
      score: Math.max(0, score),
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  return {
    query,
    bestMatch: candidates[0] || null,
    candidates: candidates.slice(0, 15),
  };
}

soundcloudRouter.get('/search', async (c) => {
  const q = c.req.query('q') || '';
  if (!q.trim()) {
    return c.json({ error: 'Query parameter q is required' }, 400);
  }

  try {
    const result = await searchSoundCloudDirect(q);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message || 'SoundCloud search failed' }, 500);
  }
});

soundcloudRouter.get('/oembed', async (c) => {
  const trackUrl = c.req.query('url');
  if (!trackUrl) {
    return c.json({ error: 'Query parameter url is required' }, 400);
  }

  try {
    const oembedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(trackUrl)}`;
    const res = await fetch(oembedUrl);
    if (!res.ok) {
      return c.json({ error: 'Failed to resolve SoundCloud oEmbed' }, res.status as any);
    }
    const data = await res.json();
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message || 'oEmbed resolution failed' }, 500);
  }
});
