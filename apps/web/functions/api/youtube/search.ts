/**
 * Cloudflare Pages Function — YouTube InnerTube Proxy
 *
 * Route: GET /api/youtube/search?q=...&duration=...
 *
 * Candidate ranking is shared with the local dev proxies and the extension's
 * YouTube Music search (`apps/web/lib/youtubeSearchRank.ts`), so a hit scores
 * the same everywhere. In order of weight: audio-track uploads (Topic/Release,
 * YouTube Music's ATV rows), official audio, duration proximity, name match;
 * against lyric videos, music videos, and unofficial remixes/covers/edits.
 */

import { rankYouTubeCandidates, type YouTubeCandidate } from '../../../lib/youtubeSearchRank';

type Env = Record<string, never>;

export const onRequestGet = async (context: any) => {
  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const durationParam = parseFloat(url.searchParams.get('duration') || '0');
  const typeParam = (url.searchParams.get('type') || url.searchParams.get('mode') || '').toLowerCase();
  const isInstrumental = typeParam === 'instrumental' || /\binstrumentals?\b/i.test(q);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  };

  if (!q) {
    return new Response(JSON.stringify({ error: 'Query parameter "q" is required' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

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

  try {
    const ytRes = await fetch('https://www.youtube.com/youtubei/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(payload),
    });

    if (!ytRes.ok) {
      return new Response(JSON.stringify({ error: `YouTube returned ${ytRes.status}` }), {
        status: 502,
        headers: corsHeaders,
      });
    }

    const data: any = await ytRes.json();
    const sections =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

    const collected: YouTubeCandidate[] = [];

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

        collected.push({
          videoId: video.videoId,
          title,
          channelTitle,
          durationSeconds: durSec,
        });
      }
    }

    const candidates = rankYouTubeCandidates(collected, q, durationParam, { instrumentalOnly: isInstrumental }).candidates;

    return new Response(
      JSON.stringify({
        query: q,
        bestMatch: candidates[0] || null,
        candidates: candidates.slice(0, 10),
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'InnerTube search failed' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};
