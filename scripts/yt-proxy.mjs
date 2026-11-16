#!/usr/bin/env node
/**
 * YouTube InnerTube Proxy — Lightweight companion server
 *
 * Runs on port 3099 during development to proxy /api/youtube/search
 * requests to YouTube's InnerTube endpoint server-side (zero CORS).
 *
 * Employs a multi-factor matching engine:
 * 1. Token/Name Similarity — Verifies keyword presence (e.g. "magic", "system", "air")
 * 2. Duration Proximity — Strong bonus for nearest duration (e.g. 3:52 target vs 3:53 candidate)
 * 3. Negative Keyword Filtering — Penalizes remixes/covers/slowed/loops unless requested
 * 4. Official/Channel Boosts + Natural Rank Tie-Breaker
 */

import http from 'node:http';
import { rankYouTubeCandidates } from './youtubeSearchRank.mjs';

const PORT = parseInt(process.env.YT_PROXY_PORT || '3099', 10);

function normalizeStr(s) {
  return (s || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateTokenSimilarity(query, candidateTitle, candidateChannel) {
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

async function handleSearch(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const q = (url.searchParams.get('q') || '').trim();
  const durationParam = parseFloat(url.searchParams.get('duration') || '0');
  const typeParam = (url.searchParams.get('type') || url.searchParams.get('mode') || '').toLowerCase();
  const isInstrumental = typeParam === 'instrumental' || /\binstrumentals?\b/i.test(q);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (!q) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Query parameter "q" is required' }));
    return;
  }

  const payload = JSON.stringify({
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20240315.00.00',
        hl: 'en',
        gl: 'US',
      },
    },
    query: q,
  });

  try {
    const ytRes = await fetch('https://www.youtube.com/youtubei/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: payload,
    });

    if (!ytRes.ok) {
      res.writeHead(502);
      res.end(JSON.stringify({ error: `YouTube returned ${ytRes.status}` }));
      return;
    }

    const data = await ytRes.json();
    const sections =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents || [];

    const collected = [];

    for (const section of sections) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const video = item?.videoRenderer;
        if (!video || !video.videoId) continue;

        const title = video.title?.runs?.[0]?.text || '';
        const channelTitle = video.ownerText?.runs?.[0]?.text || '';
        const lengthStr = video.lengthText?.simpleText || '0:00';

        const parts = lengthStr.split(':').map(Number);
        const durSec = parts.reduce((acc, curr) => acc * 60 + curr, 0);

        collected.push({
          videoId: video.videoId,
          title,
          channelTitle,
          durationSeconds: durSec,
        });
      }
    }

    const candidates = rankYouTubeCandidates(collected, q, durationParam, { instrumentalOnly: isInstrumental }).candidates;

    res.writeHead(200);
    res.end(JSON.stringify({
      query: q,
      bestMatch: candidates[0] || null,
      candidates: candidates.slice(0, 10),
    }));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err?.message || 'InnerTube search failed' }));
  }
}

function decodeHtmlEntities(str) {
  return (str || '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
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

async function scrapeSoundCloudTracks(searchTerm) {
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
    const items = [];
    let match;

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

async function handleSoundCloudSearch(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const q = (url.searchParams.get('q') || '').trim();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (!q) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Query parameter "q" is required' }));
    return;
  }

  try {
    const primaryItems = await scrapeSoundCloudTracks(q);
    const allRawItems = [...primaryItems];

    // If query has artist - title or multiple terms, try title-only fallback query if needed
    const cleanTitle = q.replace(/^.+?[-–—]\s*/, '').trim();
    if (cleanTitle && cleanTitle.length >= 3 && cleanTitle.toLowerCase() !== q.toLowerCase()) {
      const secondaryItems = await scrapeSoundCloudTracks(cleanTitle);
      allRawItems.push(...secondaryItems);
    }

    const seenUrls = new Set();
    const candidates = [];
    const lowerQuery = normalizeStr(q);

    for (const item of allRawItems) {
      const fullUrl = `https://soundcloud.com${item.rawPath}`;
      if (seenUrls.has(fullUrl)) continue;
      seenUrls.add(fullUrl);

      const segments = item.rawPath.split('/').filter(Boolean);
      const authorSlug = segments[0] ? segments[0].replace(/-/g, ' ') : '';

      let score = 50;
      const sim = calculateTokenSimilarity(q, item.rawTitle, authorSlug);
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

    res.writeHead(200);
    res.end(
      JSON.stringify({
        query: q,
        bestMatch: candidates[0] || null,
        candidates: candidates.slice(0, 15),
      })
    );
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err?.message || 'SoundCloud search failed' }));
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const pathname = new URL(req.url, `http://localhost:${PORT}`).pathname;

  if ((pathname === '/api/youtube/search' || pathname === '/api/v1/youtube/search') && req.method === 'GET') {
    await handleSearch(req, res);
    return;
  }

  if ((pathname === '/api/soundcloud/search' || pathname === '/api/v1/soundcloud/search') && req.method === 'GET') {
    await handleSoundCloudSearch(req, res);
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`  ▲ Media Proxy ready on http://localhost:${PORT} (/api/youtube/search, /api/soundcloud/search)`);
});
