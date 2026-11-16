import { Hono } from 'hono';

type Env = { DB?: unknown; LYRICS_BUCKET?: unknown };

export const youtubeRouter = new Hono<{ Bindings: Env }>();

interface YTVideoCandidate {
  videoId: string;
  title: string;
  channelTitle: string;
  durationSeconds: number;
  score: number;
}

function normalizeStr(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function calculateTokenSimilarity(query: string, candidateTitle: string, candidateChannel: string): number {
  const qTokens = normalizeStr(query).split(' ').filter((t) => t.length > 1);
  if (qTokens.length === 0) return 1;

  const targetText = normalizeStr(`${candidateTitle} ${candidateChannel}`);
  const targetTokens = new Set(targetText.split(' '));

  let matched = 0;
  for (const t of qTokens) {
    if (targetTokens.has(t) || targetText.includes(t)) {
      matched++;
    }
  }
  return matched / qTokens.length;
}

/**
 * Searches YouTube using internal InnerTube endpoint without requiring any API keys.
 * Multi-factor matching engine:
 * 1. Token/Name Similarity (e.g. "magic", "system", "air")
 * 2. Nearest Duration Proximity (e.g. 3:52 target vs 3:53 candidate)
 * 3. Negative Keyword Filtering (penalizes remixes/covers/loops)
 * 4. Official Badges and Natural Rank Tie-Breaker
 */
export async function searchYouTubeInnerTube(
  q: string,
  durationParam = 0,
  options?: { instrumentalOnly?: boolean }
): Promise<{ query: string; bestMatch: YTVideoCandidate | null; candidates: YTVideoCandidate[] }> {
  const isInstrumental = !!(options?.instrumentalOnly || /\binstrumentals?\b/i.test(q));
  const url = 'https://www.youtube.com/youtubei/v1/search';
  const payload = {
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20240315.00.00',
        hl: 'en',
        gl: 'US',
      },
    },
    query: q,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`YouTube InnerTube returned status ${res.status}`);
  }

  const data: any = await res.json();
  const sections =
    data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

  const candidates: YTVideoCandidate[] = [];
  const lq = q.toLowerCase();
  let rawIndex = 0;

  // Negative keyword patterns that strongly indicate non-original content
  const hardNegativeKeywords = [
    'remix', 'mashup', 'slowed', 'reverb', 'speed up', 'sped up', 'sped-up',
    'cover', 'karaoke', 'parody', 'reaction', 'tribute',
    'tutorial', 'synthesia', '1 hour', '10 hours', 'loop', 'bass boosted',
    'nightcore', 'fan made', 'fan-made', 'amv', 'anime mv',
  ];

  // Lyric/visualizer videos — degrade heavily because they clash with OpenLyryc's renderer
  const lyricVideoKeywords = [
    'lyric video', 'lyrics video', 'official lyric', 'official lyrics',
    'lyric clip', 'with lyrics', '(lyrics)', '[ lyrics ]',
    'visualizer', 'visualiser', 'audio visualizer',
    'animated lyric', 'kinetic lyric',
  ];

  // Standalone "lyrics" or "lyric" as separate words
  const standaloneLyricRe = /\b(lyrics?)\b/i;

  for (const section of sections) {
    const items = section?.itemSectionRenderer?.contents || [];
    for (const item of items) {
      const video = item?.videoRenderer;
      if (!video || !video.videoId) continue;

      const title = video.title?.runs?.[0]?.text || '';
      const channelTitle = video.ownerText?.runs?.[0]?.text || '';
      const lengthStr = video.lengthText?.simpleText || '0:00';

      const parts = lengthStr.split(':').map(Number);
      const durSec = parts.reduce((acc: number, curr: number) => acc * 60 + curr, 0);

      const lowerTitle = title.toLowerCase();
      const lowerChannel = channelTitle.toLowerCase();

      let score = 0;

      // ── Instrumental Mode Scoring ───────────────────────────────────────────
      if (isInstrumental) {
        const isInstTitle = /\binstrumentals?\b/i.test(title);
        if (isInstTitle) {
          score += 800;
          if (lowerTitle.includes('official instrumental')) score += 300;
          else if (lowerTitle.includes('instrumental version')) score += 200;
          else if (lowerTitle.includes('instrumental audio') || lowerTitle.includes('audio')) score += 150;
          else if (lowerTitle.includes('backing track') || lowerTitle.includes('karaoke')) score += 100;
        } else {
          score -= 1000;
        }

        for (const kw of ['tutorial', 'how to play', 'synthesia', 'lesson', 'reaction', 'parody', 'amv', 'cover', 'remix', 'slowed', 'loop']) {
          if (lowerTitle.includes(kw)) {
            score -= 500;
            break;
          }
        }

        const tokenSim = calculateTokenSimilarity(q, title, channelTitle);
        score += tokenSim * 120;
        if (tokenSim < 0.4) score -= 300;

        if (durationParam > 0 && durSec > 0) {
          const delta = Math.abs(durSec - durationParam);
          if (delta <= 2) score += 120;
          else if (delta <= 5) score += 80;
          else if (delta <= 10) score += 50;
          else if (delta <= 20) score += 20;
          else if (delta > 35) score -= Math.min(250, (delta - 35) * 4);
        }

        if (/\s-\s*topic\s*$/i.test(channelTitle)) score += 200;
        score += Math.max(0, 30 - rawIndex * 2);
        rawIndex++;

        candidates.push({
          videoId: video.videoId,
          title,
          channelTitle,
          durationSeconds: durSec,
          score: Math.round(score),
        });
        continue;
      }

      // 1. Name token matching (0 – 100 points)
      const tokenSim = calculateTokenSimilarity(q, title, channelTitle);
      score += tokenSim * 100;

      if (tokenSim < 0.5) {
        score -= 300;
      }

      // 2. Duration Proximity (0 – 100 points)
      if (durationParam > 0 && durSec > 0) {
        const delta = Math.abs(durSec - durationParam);
        if (delta <= 1) score += 100;
        else if (delta <= 3) score += 80;
        else if (delta <= 6) score += 60;
        else if (delta <= 12) score += 30;
        else if (delta <= 20) score += 10;
        else if (delta > 30) score -= Math.min(200, (delta - 30) * 3);
      }

      // 3. Hard negative keywords (non-original content)
      for (const kw of hardNegativeKeywords) {
        if (lowerTitle.includes(kw) && !lq.includes(kw)) {
          score -= 400;
          break;
        }
      }

      // 4. Lyric / visualizer video penalty
      let isLyricVideo = false;
      for (const kw of lyricVideoKeywords) {
        if (lowerTitle.includes(kw)) { isLyricVideo = true; break; }
      }
      if (!isLyricVideo && standaloneLyricRe.test(title)) isLyricVideo = true;
      if (isLyricVideo) score -= 350;

      // 5. Extreme duration sanity checks
      if (durSec > 900) score -= 400;
      if (durSec > 0 && durSec < 45) score -= 400;

      // 6. Positive boosts — Topic channel is the strongest signal for clean static art
      const isTopicChannel = /\s-\s*topic\s*$/i.test(channelTitle);
      if (isTopicChannel) score += 200;
      else if (lowerChannel.includes('vevo')) score += 80;

      // Official title signals
      if (lowerTitle.includes('official music video') || lowerTitle.includes('official mv')) score += 60;
      else if (lowerTitle.includes('official video')) score += 40;
      else if (/\bofficial audio\b/.test(lowerTitle) || /\(audio\)/.test(lowerTitle)) score += 50;
      else if (lowerTitle.includes('official') || lowerTitle.includes('clip officiel')) score += 15;

      // 7. YouTube natural rank tie-breaker (diminishing, first 15 slots)
      score += Math.max(0, 30 - rawIndex * 2);
      rawIndex++;

      candidates.push({
        videoId: video.videoId,
        title,
        channelTitle,
        durationSeconds: durSec,
        score: Math.round(score),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  if (isInstrumental) {
    const instMatches = candidates.filter((c) => /\binstrumentals?\b/i.test(c.title));
    const finalCandidates = instMatches.length > 0 ? instMatches : candidates;
    return {
      query: q,
      bestMatch: finalCandidates[0] || null,
      candidates: finalCandidates.slice(0, 10),
    };
  }

  return {
    query: q,
    bestMatch: candidates[0] || null,
    candidates: candidates.slice(0, 10),
  };
}

const handleYouTubeSearch = async (c: any) => {
  const q = (c.req.query('q') || '').trim();
  const durationParam = parseFloat(c.req.query('duration') || '0');
  const typeParam = (c.req.query('type') || c.req.query('mode') || '').toLowerCase();
  const isInstrumental = typeParam === 'instrumental' || /\binstrumentals?\b/i.test(q);

  if (!q) {
    return c.json({ error: 'Query parameter "q" is required' }, 400);
  }

  try {
    const result = await searchYouTubeInnerTube(q, durationParam, { instrumentalOnly: isInstrumental });
    c.header('Cache-Control', 'public, max-age=120, s-maxage=300, stale-while-revalidate=600');
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err?.message || 'InnerTube search failed' }, 500);
  }
};

youtubeRouter.get('/search', handleYouTubeSearch);
youtubeRouter.get('/', handleYouTubeSearch);
