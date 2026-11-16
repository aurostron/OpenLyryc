import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { securityHeaders } from './middleware/security.js';
import { rateLimit } from './middleware/rateLimit.js';
import { searchRouter } from './routes/search.js';
import { lyricsRouter } from './routes/lyrics.js';
import { revisionsRouter } from './routes/revisions.js';
import { dmcaRouter } from './routes/dmca.js';
import { youtubeRouter } from './routes/youtube.js';
import { soundcloudRouter } from './routes/soundcloud.js';
import { dedupRouter } from './routes/dedup.js';
import { openapiRouter } from './routes/openapi.js';
import { bpmRouter } from './routes/bpm.js';

import { transliterateJapaneseToRomaji } from './lib/transliteration.js';

export interface Env {
  DB?: unknown;
  RATE_LIMIT_KV?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  };
  LYRICS_BUCKET?: unknown;
  TURNSTILE_SECRET?: string;
}

const app = new Hono<{ Bindings: Env }>();

// 1. Security Headers Middleware
app.use('*', securityHeaders());

// 2. Enable CORS for Next.js frontend
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Turnstile-Token']
}));

// 3. Server-Side Rate Limiting (Strict 3 req/sec max per IP with delay queue smoothing)
app.use('/api/*', rateLimit({ requestsPerSecond: 3, burstCapacity: 4, enableQueue: true, maxQueueWaitMs: 2500 }));
app.use('/youtube*', rateLimit({ requestsPerSecond: 3, burstCapacity: 4, enableQueue: true, maxQueueWaitMs: 2500 }));
app.use('/api/v1/revisions*', rateLimit({ requestsPerSecond: 1, burstCapacity: 2, maxQueueWaitMs: 3000 }));

const API_ENDPOINTS = [
  { method: 'GET', path: '/api/v1/health', desc: 'Edge node health check and heartbeat status' },
  { method: 'GET', path: '/api/v1/lyrics?title=&artist=&format=json|lrc|ttml&transliterate=romaji', desc: 'Universal synchronized lyrics resolver with syllable timing and multi-format exports' },
  { method: 'GET', path: '/api/v1/search?q=&limit=', desc: 'Unified catalog and provider search with sync fidelity ranking' },
  { method: 'GET', path: '/api/v1/transliterate?text=', desc: 'Real-time Japanese Kanji/Kana to Latin Romaji transliteration' },
  { method: 'GET', path: '/api/v1/youtube/search?q=&duration=', desc: 'YouTube audio reference matching with duration alignment' },
  { method: 'GET', path: '/api/v1/soundcloud/search?q=', desc: 'SoundCloud audio stream matching and track resolution' },
  { method: 'GET', path: '/api/v1/soundcloud/oembed?url=', desc: 'SoundCloud oEmbed metadata and artwork proxy' },
  { method: 'GET', path: '/api/v1/bpm?q=', desc: 'SongBPM tempo, musical key, duration, and track resolver' },
  { method: 'GET', path: '/api/v1/openapi.json', desc: 'OpenAPI 3.1.0 specification for production services' },
  { method: 'GET', path: '/openapi.json', desc: 'Root alias for OpenAPI 3.1.0 specification' },
];

function getHtmlDashboard(hostUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OpenLyryc Core Edge API</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #09090b;
      color: #e4e4e7;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.5;
      padding: 2.5rem 1.5rem;
      display: flex;
      justify-content: center;
    }
    .container { max-width: 860px; width: 100%; }
    .badge-status {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
      background: rgba(34, 197, 94, 0.1);
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.2);
      margin-bottom: 1.25rem;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 10px #22c55e;
    }
    h1 {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: #fafafa;
      margin-bottom: 0.5rem;
    }
    .subtitle {
      color: #a1a1aa;
      font-size: 0.95rem;
      margin-bottom: 2rem;
    }
    .section-title {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #71717a;
      font-weight: 600;
      margin-bottom: 0.75rem;
    }
    .quick-links {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 0.75rem;
      margin-bottom: 2.5rem;
    }
    .quick-link-card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 1rem;
      text-decoration: none;
      color: inherit;
      transition: all 0.15s ease;
      display: block;
    }
    .quick-link-card:hover {
      border-color: #3f3f46;
      background: #202024;
      transform: translateY(-1px);
    }
    .quick-link-label {
      font-size: 0.75rem;
      color: #a1a1aa;
      margin-bottom: 0.25rem;
      display: block;
    }
    .quick-link-path {
      font-family: monospace;
      font-size: 0.825rem;
      color: #38bdf8;
      word-break: break-all;
    }
    .endpoints-table {
      width: 100%;
      border-collapse: collapse;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 2.5rem;
    }
    .endpoints-table th, .endpoints-table td {
      padding: 0.85rem 1rem;
      text-align: left;
      border-bottom: 1px solid #27272a;
      font-size: 0.875rem;
    }
    .endpoints-table th {
      background: #121215;
      color: #71717a;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .endpoints-table tr:last-child td { border-bottom: none; }
    .method-badge {
      display: inline-block;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.7rem;
      font-weight: 700;
    }
    .method-get { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
    .method-post { background: rgba(168, 85, 247, 0.15); color: #c084fc; }
    .route-code {
      font-family: monospace;
      font-size: 0.825rem;
      color: #e4e4e7;
    }
    .footer {
      text-align: center;
      color: #52525b;
      font-size: 0.8rem;
      border-top: 1px solid #1f1f23;
      padding-top: 1.5rem;
    }
    .footer a { color: #71717a; text-decoration: none; }
    .footer a:hover { color: #a1a1aa; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge-status">
      <span class="pulse-dot"></span>
      Cloudflare Edge Worker • Operational
    </div>
    <h1>OpenLyryc Core Edge API</h1>
    <p class="subtitle">Distributed high-performance lyrics synchronization, YouTube search proxy, and revision engine.</p>

    <div class="section-title">Quick Interactive Tests</div>
    <div class="quick-links">
      <a class="quick-link-card" href="/api/v1/youtube/search?q=sigma" target="_blank">
        <span class="quick-link-label">YouTube Search Helper</span>
        <span class="quick-link-path">/api/v1/youtube/search?q=sigma</span>
      </a>
      <a class="quick-link-card" href="/api/v1/youtube/search?q=Ed+Sheeran+Sapphire&duration=184" target="_blank">
        <span class="quick-link-label">YouTube Duration Match</span>
        <span class="quick-link-path">.../youtube/search?q=Ed+Sheeran...</span>
      </a>
      <a class="quick-link-card" href="/api/v1/search?q=midnight" target="_blank">
        <span class="quick-link-label">Catalog Song Search</span>
        <span class="quick-link-path">/api/v1/search?q=midnight</span>
      </a>
      <a class="quick-link-card" href="/api/v1/search?q=sigma&source=youtube" target="_blank">
        <span class="quick-link-label">Search with &source=youtube</span>
        <span class="quick-link-path">/api/v1/search?q=sigma&source=youtube</span>
      </a>
      <a class="quick-link-card" href="/api/v1/lyrics/s_m83_midnight" target="_blank">
        <span class="quick-link-label">Lyrics Document Fetch</span>
        <span class="quick-link-path">/api/v1/lyrics/s_m83_midnight</span>
      </a>
      <a class="quick-link-card" href="/api/v1/bpm?q=Modjo+Lady+Hear+Me+Tonight" target="_blank">
        <span class="quick-link-label">SongBPM Helper</span>
        <span class="quick-link-path">/api/v1/bpm?q=Modjo+Lady...</span>
      </a>
      <a class="quick-link-card" href="/api/v1/health" target="_blank">
        <span class="quick-link-label">System Health</span>
        <span class="quick-link-path">/api/v1/health</span>
      </a>
    </div>

    <div class="section-title">Public Endpoints Reference</div>
    <table class="endpoints-table">
      <thead>
        <tr>
          <th style="width: 75px;">Method</th>
          <th>Endpoint</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        ${API_ENDPOINTS.map(ep => `
          <tr>
            <td><span class="method-badge method-${ep.method.toLowerCase()}">${ep.method}</span></td>
            <td><span class="route-code">${ep.path}</span></td>
            <td style="color: #a1a1aa;">${ep.desc}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="footer">
      <p>OpenLyryc Edge Engine • <a href="https://openlyryc.pages.dev" target="_blank">Open Web Studio</a> • <a href="https://github.com/aurostron/openlyryc" target="_blank">GitHub</a></p>
    </div>
  </div>
</body>
</html>`;
}

// Root landing & docs
app.get('/', (c) => {
  const accept = c.req.header('Accept') || '';
  if (accept.includes('text/html')) {
    return c.html(getHtmlDashboard(c.req.url));
  }

  return c.json({
    name: 'OpenLyryc Edge API',
    version: '1.2.0',
    status: 'operational',
    docs: '/api/v1/health',
    endpoints: API_ENDPOINTS.map(e => `${e.method.padEnd(5)} ${e.path}`)
  });
});

app.get('/api/v1', (c) => {
  const accept = c.req.header('Accept') || '';
  if (accept.includes('text/html')) {
    return c.html(getHtmlDashboard(c.req.url));
  }
  return c.json({
    name: 'OpenLyryc Edge API v1',
    status: 'operational',
    endpoints: API_ENDPOINTS
  });
});

// Health check
app.get('/api/v1/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'OpenLyrics Cloudflare Edge Worker API',
    timestamp: new Date().toISOString()
  });
});

// Transliteration endpoints (Kuromoji-Lite Hepburn Romaji)
app.get('/api/v1/transliterate', (c) => {
  const text = (c.req.query('text') || c.req.query('q') || '').trim();
  if (!text) {
    return c.json({ error: 'BAD_REQUEST', message: 'Provide text or q query parameter.' }, 400);
  }
  const romaji = transliterateJapaneseToRomaji(text);
  c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return c.json({ text, romaji, language: 'ja-Latn' });
});

app.post('/api/v1/transliterate', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as any;
  const text = (body.text || body.q || '').trim();
  if (!text) {
    return c.json({ error: 'BAD_REQUEST', message: 'Provide text in JSON body.' }, 400);
  }
  const romaji = transliterateJapaneseToRomaji(text);
  c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return c.json({ text, romaji, language: 'ja-Latn' });
});

// Mount Route Handlers — Canonical v1
app.route('/api/v1/search', searchRouter);
app.route('/api/v1/lyrics', lyricsRouter);
app.route('/api/v1/revisions', revisionsRouter);
app.route('/api/v1/dedup', dedupRouter);
app.route('/api/v1/youtube', youtubeRouter);
app.route('/api/v1/soundcloud', soundcloudRouter);
app.route('/api/v1/dmca', dmcaRouter);
app.route('/api/v1/bpm', bpmRouter);
app.route('/api/v1/openapi.json', openapiRouter);
app.route('/openapi.json', openapiRouter);

// Convenient route aliases for client resilience and direct testing
app.route('/api/youtube', youtubeRouter);
app.route('/youtube', youtubeRouter);
app.route('/api/soundcloud', soundcloudRouter);
app.route('/soundcloud', soundcloudRouter);
app.route('/api/search', searchRouter);
app.route('/api/lyrics', lyricsRouter);
app.route('/api/bpm', bpmRouter);
app.route('/bpm', bpmRouter);

export default app;


