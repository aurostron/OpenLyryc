#!/usr/bin/env node
/**
 * OpenLyryc Dev Server
 *
 * Serves the static Next.js export from apps/web/out AND proxies
 * /api/youtube/search to YouTube's InnerTube endpoint (server-side,
 * so zero CORS issues).
 *
 * Multi-factor matching engine:
 * 1. Token/Name Similarity (e.g. "magic", "system", "air")
 * 2. Nearest Duration Proximity (e.g. 3:52 target vs 3:53 candidate)
 * 3. Negative Keyword Filtering (penalizes remixes/covers/loops)
 * 4. Official Badges and Natural Rank Tie-Breaker
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rankYouTubeCandidates } from './youtubeSearchRank.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.resolve(__dirname, '..', 'apps', 'web', 'out');
const PORT = parseInt(process.env.PORT || '3000', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json',
};

function normalizeStr(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
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

/** YouTube InnerTube search proxy with multi-factor scoring */
async function handleYouTubeSearch(req, res) {
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

const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

const CRAWLER_REGEX =
  /bot|crawler|spider|crawling|discord|whatsapp|telegram|twitter|facebook|slack|embedly|quora|skype|meta|linkedin|pinterest|applebot|googlebot|bingbot/i;

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function extractMetadataFromPayload(payloadBase64) {
  if (!payloadBase64) return null;
  try {
    const rawBytes = Uint8Array.from(Buffer.from(payloadBase64, 'base64'));
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(rawBytes);
    writer.close();

    const reader = ds.readable.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.length;
    }

    if (out.length < 5) return null;
    const flags = out[2];
    const hasYouTubeId = (flags & 1) !== 0;

    let pos = 5;
    function readStr() {
      let len = 0, shift = 0;
      while (pos < out.length) {
        const b = out[pos++];
        len |= (b & 0x7f) << shift;
        if ((b & 0x80) === 0) break;
        shift += 7;
      }
      const str = new TextDecoder().decode(out.subarray(pos, pos + len));
      pos += len;
      return str;
    }

    const docTitle = readStr();
    const docArtist = readStr();
    let ytId;
    if (hasYouTubeId && pos + 11 <= out.length) {
      ytId = new TextDecoder().decode(out.subarray(pos, pos + 11)).trim();
    }
    return { title: docTitle, artist: docArtist, ytId };
  } catch {
    return null;
  }
}

async function resolveArtwork(title, artist, ytId) {
  // 1. YouTube high-res thumbnail (matches exact video)
  if (ytId && ytId.length === 11) {
    return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  }

  const queryTerm = `${artist || ''} ${title || ''}`.trim();

  // 2. Deezer API
  try {
    const deezerUrl = `https://api.deezer.com/search?q=${encodeURIComponent(queryTerm)}&limit=1`;
    const dRes = await fetch(deezerUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (dRes.ok) {
      const data = await dRes.json();
      const hit = data?.data?.[0];
      const art = hit?.album?.cover_xl || hit?.album?.cover_big;
      if (art && typeof art === 'string') return art;
    }
  } catch {}

  // 3. iTunes API (with desktop browser User-Agent)
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(queryTerm)}&entity=song&limit=1`;
    const itunesRes = await fetch(itunesUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });
    if (itunesRes.ok) {
      const itunesData = await itunesRes.json();
      const rawArt = itunesData?.results?.[0]?.artworkUrl100;
      if (rawArt && typeof rawArt === 'string') {
        return rawArt.replace('100x100bb', '600x600bb');
      }
    }
  } catch {}

  // 4. Deezer with title alone
  if (title) {
    try {
      const deezerUrl = `https://api.deezer.com/search?q=${encodeURIComponent(title)}&limit=1`;
      const dRes = await fetch(deezerUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (dRes.ok) {
        const data = await dRes.json();
        const hit = data?.data?.[0];
        const art = hit?.album?.cover_xl || hit?.album?.cover_big;
        if (art && typeof art === 'string') return art;
      }
    } catch {}
  }

  return null;
}

async function fetchTursoSong(code) {
  if (!code || !TURSO_URL) return null;
  try {
    const res = await fetch(TURSO_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TURSO_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            type: 'execute',
            stmt: {
              sql: 'SELECT title, artist, payload FROM preview_shares WHERE code = ? LIMIT 1',
              args: [{ type: 'text', value: code }],
            },
          },
          { type: 'close' },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const row = data?.results?.[0]?.response?.result?.rows?.[0];
    if (!row) return null;
    let title = String(row[0]?.value || '').trim();
    let artist = String(row[1]?.value || '').trim();
    const payloadVal = String(row[2]?.value || '').trim();
    let ytId;
    if (payloadVal) {
      const meta = await extractMetadataFromPayload(payloadVal);
      if (meta) {
        if (meta.ytId) ytId = meta.ytId;
        if (!title && meta.title) title = meta.title;
        if (!artist && meta.artist) artist = meta.artist;
      }
    }
    return { title, artist, ytId };
  } catch {
    return null;
  }
}

async function handleCrawlerPreview(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = (url.searchParams.get('c') || url.searchParams.get('code') || '').trim();
  const q = (url.searchParams.get('q') || url.searchParams.get('query') || '').trim();
  let title = (url.searchParams.get('title') || '').trim();
  let artist = (url.searchParams.get('artist') || '').trim();
  let cover = (url.searchParams.get('cover') || url.searchParams.get('art') || '').trim();
  let ytId;

  if (code && (!title || !artist || !cover)) {
    const song = await fetchTursoSong(code);
    if (song) {
      if (!title) title = song.title;
      if (!artist) artist = song.artist;
      if (song.ytId) ytId = song.ytId;
    }
  }

  if (!title && q) {
    if (q.includes(' - ')) {
      const parts = q.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    } else {
      title = q;
    }
  }

  if (title && !cover) {
    cover = (await resolveArtwork(title, artist, ytId)) || '';
  }

  const displayTitle = title || 'OpenLyryc — Synced Lyric Editor';
  const displaySubtitle = artist ? `${artist} · OpenLyryc` : 'OpenLyryc';
  const displayCover = cover || `http://${req.headers.host || `localhost:${PORT}`}/openlyryc.png`;
  const cleanPlayerUrl = url.href.replace(/([?&])(bot|crawler)=[^&]*/g, '');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(displayTitle)} — ${escapeHtml(displaySubtitle)}</title>
  
  <meta name="title" content="${escapeHtml(displayTitle)}" />
  <meta name="description" content="${escapeHtml(displaySubtitle)}" />
  <meta name="author" content="OpenLyryc" />
  <meta name="theme-color" content="#10b981" />
  
  <meta property="og:site_name" content="OpenLyryc" />
  <meta property="og:type" content="music.song" />
  <meta property="og:url" content="${escapeHtml(cleanPlayerUrl)}" />
  <meta property="og:title" content="${escapeHtml(displayTitle)}" />
  <meta property="og:description" content="${escapeHtml(displaySubtitle)}" />
  <meta property="og:image" content="${escapeHtml(displayCover)}" />
  <meta property="og:image:width" content="600" />
  <meta property="og:image:height" content="600" />
  <meta property="og:image:alt" content="${escapeHtml(displayTitle)}" />
  
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${escapeHtml(cleanPlayerUrl)}" />
  <meta name="twitter:title" content="${escapeHtml(displayTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(displaySubtitle)}" />
  <meta name="twitter:image" content="${escapeHtml(displayCover)}" />
</head>
<body style="background:#09090b;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;">
  <div style="max-width:420px;text-align:center;background:#121217;border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:32px 24px;">
    ${displayCover ? `<img src="${escapeHtml(displayCover)}" alt="Cover" style="width:200px;height:200px;border-radius:18px;object-fit:cover;margin-bottom:20px;" />` : ''}
    <h1 style="font-size:22px;margin:0 0 6px 0;">${escapeHtml(displayTitle)}</h1>
    <p style="font-size:14px;color:#a1a1aa;margin:0 0 22px 0;">${escapeHtml(displaySubtitle)}</p>
    <a href="${escapeHtml(cleanPlayerUrl)}" style="background:#fff;color:#09090b;font-weight:600;font-size:13px;text-decoration:none;padding:10px 24px;border-radius:12px;">Open in OpenLyryc</a>
  </div>
</body>
</html>`;

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  });
  res.end(html);
}

const DEV_LOGO_DATA_URI =
  'data:image/png;base64,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';

async function handleOgImage(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = (url.searchParams.get('c') || url.searchParams.get('code') || '').trim();
  let title = (url.searchParams.get('title') || '').trim();
  let artist = (url.searchParams.get('artist') || '').trim();
  let cover = (url.searchParams.get('cover') || url.searchParams.get('art') || '').trim();
  let ytId;

  if (code && (!title || !artist || !cover)) {
    const song = await fetchTursoSong(code);
    if (song) {
      if (!title) title = song.title;
      if (!artist) artist = song.artist;
      if (song.ytId) ytId = song.ytId;
    }
  }

  if (title && !cover) {
    cover = (await resolveArtwork(title, artist, ytId)) || '';
  }

  const safeTitle = escapeHtml(title || 'OpenLyryc Workstation');
  const safeArtist = escapeHtml(artist || 'High-Precision Synced Lyrics');
  const safeCover = escapeHtml(cover || `http://${req.headers.host || `localhost:${PORT}`}/openlyryc.png`);

  let titleFontSize = 52;
  if (safeTitle.length > 32) {
    titleFontSize = 38;
  } else if (safeTitle.length > 22) {
    titleFontSize = 44;
  }

  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="coverClip"><rect x="90" y="115" width="400" height="400" rx="32" /></clipPath>
  </defs>
  <rect width="1200" height="630" fill="#08080a" />
  <g>
    <image href="${safeCover}" x="90" y="115" width="400" height="400" clip-path="url(#coverClip)" preserveAspectRatio="xMidYMid slice" />
    <rect x="90" y="115" width="400" height="400" rx="32" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" />
  </g>
  <g transform="translate(550, 0)">
    <image href="${DEV_LOGO_DATA_URI}" x="0" y="175" width="138" height="46" preserveAspectRatio="xMidYMid meet" />
    <text x="0" y="295" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="${titleFontSize}" font-weight="700" letter-spacing="-0.03em">${safeTitle}</text>
    <text x="0" y="352" fill="#888891" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="28" font-weight="500">${safeArtist}</text>
  </g>
</svg>`;

  res.writeHead(200, {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'public, max-age=86400',
  });
  res.end(svg);
}

/** Serve a static file from STATIC_DIR */
function serveStaticFile(req, res) {
  let filePath = path.join(STATIC_DIR, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath) && !path.extname(filePath)) {
    filePath += '.html';
  }

  if (!fs.existsSync(filePath)) {
    filePath = path.join(STATIC_DIR, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  const stream = fs.createReadStream(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  stream.pipe(res);
  stream.on('error', () => {
    res.writeHead(500);
    res.end('Internal Server Error');
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (pathname === '/api/youtube/search' && req.method === 'GET') {
    await handleYouTubeSearch(req, res);
    return;
  }

  if (pathname === '/api/og' && req.method === 'GET') {
    await handleOgImage(req, res);
    return;
  }

  const isPreviewRoute =
    pathname === '/p' ||
    pathname === '/preview' ||
    pathname === '/p.html' ||
    pathname === '/preview.html' ||
    pathname.startsWith('/p/') ||
    pathname.startsWith('/preview/');

  const userAgent = req.headers['user-agent'] || '';
  const isCrawler =
    CRAWLER_REGEX.test(userAgent) ||
    url.searchParams.has('bot') ||
    url.searchParams.has('crawler');

  if (isPreviewRoute && isCrawler && req.method === 'GET') {
    await handleCrawlerPreview(req, res);
    return;
  }

  serveStaticFile(req, res);
});

server.listen(PORT, () => {
  console.log(`\n  ▲ OpenLyryc Dev Server`);
  console.log(`  - Local:    http://localhost:${PORT}`);
  console.log(`  - YouTube:  http://localhost:${PORT}/api/youtube/search?q=test`);
  console.log(`  - Static:   ${STATIC_DIR}\n`);
});
