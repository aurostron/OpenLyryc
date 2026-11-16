import { Hono } from 'hono';
import type { OpenLyricsDocument } from '@openlyryc/schema';
import * as schema from '@openlyryc/schema';
const exportLRC = (doc: any, opts?: any) => (schema.exportLRC || (schema as any).default?.exportLRC)(doc, opts);
const compressDocumentToDelta = (doc: any) => (schema.compressDocumentToDelta || (schema as any).default?.compressDocumentToDelta)(doc);
import { resolveLyricsMultiProvider, sanitizeSongQuery } from '../lib/lyricsResolver.js';
import { convertDocumentToRomaji } from '../lib/transliteration.js';

type Env = { DB?: unknown; LYRICS_BUCKET?: unknown };

export const lyricsRouter = new Hono<{ Bindings: Env }>();

const MOCK_DOCUMENTS: Record<string, OpenLyricsDocument> = {
  's_m83_midnight': {
    $schema: 'https://openlyrics.dev/schema/v1.json',
    version: 1,
    metadata: {
      title: 'Midnight City',
      artist: 'M83',
      album: "Hurry Up, We're Dreaming",
      duration: 243,
      syncedBy: '0xVaporWave',
      precisionMode: true,
    },
    lines: [
      {
        id: 'line_1',
        text: 'Waiting in a car',
        start: 12.45,
        end: 15.2,
        tokens: [
          { text: 'Waiting', start: 12.45, end: 13.1 },
          { text: 'in', start: 13.1, end: 13.5 },
          { text: 'a', start: 13.5, end: 13.8 },
          { text: 'car', start: 13.8, end: 15.2 },
        ],
      },
      {
        id: 'line_2',
        text: 'Waiting for a ride in the dark',
        start: 15.5,
        end: 19.8,
        tokens: [
          { text: 'Waiting', start: 15.5, end: 16.2 },
          { text: 'for', start: 16.2, end: 16.6 },
          { text: 'a', start: 16.6, end: 16.9 },
          { text: 'ride', start: 16.9, end: 17.8 },
          { text: 'in', start: 17.8, end: 18.2 },
          { text: 'the', start: 18.2, end: 18.6 },
          { text: 'dark', start: 18.6, end: 19.8 },
        ],
      },
      {
        id: 'line_3',
        text: 'The night city grows',
        start: 20.1,
        end: 24.3,
        tokens: [
          { text: 'The', start: 20.1, end: 20.6 },
          { text: 'night', start: 20.6, end: 21.4 },
          { text: 'city', start: 21.4, end: 22.8 },
          { text: 'grows', start: 22.8, end: 24.3 },
        ],
      },
      {
        id: 'line_4',
        text: 'Look and see her eyes, they glow',
        start: 24.6,
        end: 29.5,
        tokens: [
          { text: 'Look', start: 24.6, end: 25.2 },
          { text: 'and', start: 25.2, end: 25.6 },
          { text: 'see', start: 25.6, end: 26.3 },
          { text: 'her', start: 26.3, end: 26.8 },
          { text: 'eyes,', start: 26.8, end: 27.6 },
          { text: 'they', start: 27.6, end: 28.1 },
          { text: 'glow', start: 28.1, end: 29.5 },
        ],
      },
    ],
  },
};

export const DOCUMENT_STORE: Record<string, OpenLyricsDocument> = { ...MOCK_DOCUMENTS };

export function saveDocumentToStore(id: string, doc: OpenLyricsDocument) {
  DOCUMENT_STORE[id] = doc;
  if (doc.metadata.canonicalKey) {
    DOCUMENT_STORE[doc.metadata.canonicalKey] = doc;
    DOCUMENT_STORE[doc.metadata.canonicalKey.replace(/:/g, '_')] = doc;
  }
}

function deriveCanonicalKey(artist: string, title: string): string {
  const a = (artist || 'unknown').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const t = (title || 'untitled').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  return `lrc_${a}_${t}`;
}

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatClockTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  const mmm = String(ms).padStart(3, '0');
  return `00:${mm}:${ss}.${mmm}`;
}

function exportTTML(doc: OpenLyricsDocument): string {
  const meta = doc.metadata;
  let xml = `<?xml version="1.0" encoding="utf-8"?>\n<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml">\n`;
  xml += `  <head>\n    <metadata>\n      <ttm:title>${escapeXml(meta.title)}</ttm:title>\n      <ttm:agent type="person">${escapeXml(meta.artist)}</ttm:agent>\n    </metadata>\n  </head>\n`;
  xml += `  <body>\n    <div>\n`;
  for (const line of doc.lines) {
    const begin = formatClockTime(line.start);
    const end = formatClockTime(line.end);
    const bgAttr = line.isBackground ? ` itunes:role="background"` : '';
    xml += `      <p begin="${begin}" end="${end}"${bgAttr}>`;
    if (line.tokens && line.tokens.length > 0) {
      for (const tok of line.tokens) {
        const tBegin = formatClockTime(tok.start);
        const tEnd = formatClockTime(tok.end);
        xml += `<span begin="${tBegin}" end="${tEnd}">${escapeXml(tok.text)}</span>`;
      }
    } else {
      xml += escapeXml(line.text);
    }
    xml += `</p>\n`;
  }
  xml += `    </div>\n  </body>\n</tt>\n`;
  return xml;
}

lyricsRouter.get('/', async (c) => {
  const title = (c.req.query('title') || c.req.query('t') || '').trim();
  const artist = (c.req.query('artist') || c.req.query('a') || '').trim();
  const rawQ = (c.req.query('q') || '').trim();
  const format = (c.req.query('format') || 'json').toLowerCase();
  const transliterate = (c.req.query('transliterate') || '').toLowerCase();
  const duration = parseFloat(c.req.query('duration') || c.req.query('d') || '0');

  let searchArtist = artist;
  let searchTitle = title;

  if (!searchArtist && !searchTitle && rawQ) {
    if (rawQ.includes(' - ')) {
      const parts = rawQ.split(' - ');
      searchArtist = parts[0].trim();
      searchTitle = parts.slice(1).join(' - ').trim();
    } else if (rawQ.includes(' – ')) {
      const parts = rawQ.split(' – ');
      searchArtist = parts[0].trim();
      searchTitle = parts.slice(1).join(' – ').trim();
    } else {
      searchTitle = rawQ;
    }
  }

  if (!searchTitle && !searchArtist) {
    return c.json({ error: 'BAD_REQUEST', message: 'Provide title and/or artist, or q parameter.' }, 400);
  }

  const canonicalKey = deriveCanonicalKey(searchArtist, searchTitle);

  // 1. Check in-memory / cache store
  let doc: OpenLyricsDocument | null =
    DOCUMENT_STORE[canonicalKey] ||
    DOCUMENT_STORE[`cl_${canonicalKey}`] ||
    null;

  if (!doc && searchTitle) {
    const lowerTitle = searchTitle.toLowerCase();
    for (const d of Object.values(DOCUMENT_STORE)) {
      if (d.metadata.title.toLowerCase() === lowerTitle) {
        if (!searchArtist || d.metadata.artist.toLowerCase().includes(searchArtist.toLowerCase())) {
          doc = d;
          break;
        }
      }
    }
  }

  // 2. Piggyback across lrc.red, Binimum, and LRCLIB with SingleFlight deduplication
  if (!doc) {
    try {
      doc = await resolveLyricsMultiProvider(searchTitle, searchArtist, duration);
      if (doc) {
        doc.metadata.canonicalKey = canonicalKey;
        saveDocumentToStore(canonicalKey, doc);
      }
    } catch (err) {
      console.error('Multi-provider lyrics lookup error:', err);
    }
  }

  if (!doc) {
    return c.json(
      {
        error: 'NOT_FOUND',
        message: `Lyrics for "${searchTitle}" by "${searchArtist}" not found.`,
      },
      404
    );
  }

  // 3. Optional transliteration (e.g. ?transliterate=romaji)
  let responseDoc = doc;
  if (transliterate === 'romaji' || transliterate === 'true') {
    responseDoc = convertDocumentToRomaji(doc);
  }

  // Edge cacheable
  c.header('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');

  // 4. Multiple output formats
  if (format === 'lrc') {
    const lrcText = exportLRC(responseDoc, { format: 'enhanced_standard' });
    return c.text(lrcText, 200, { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  if (format === 'ttml') {
    const ttmlXml = exportTTML(responseDoc);
    return c.text(ttmlXml, 200, { 'Content-Type': 'application/xml; charset=utf-8' });
  }

  if (format === 'compact') {
    return c.json(compressDocumentToDelta(responseDoc));
  }

  return c.json(responseDoc);
});

lyricsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const format = (c.req.query('format') || 'json').toLowerCase();
  const transliterate = (c.req.query('transliterate') || '').toLowerCase();

  const normalizedId = id.trim();
  const altKey = normalizedId.replace(/_/g, ':');

  let doc = DOCUMENT_STORE[normalizedId] || DOCUMENT_STORE[altKey] || MOCK_DOCUMENTS[normalizedId];

  if (!doc) {
    return c.json({ error: 'NOT_FOUND', message: `Lyrics document for '${id}' not found.` }, 404);
  }

  if (transliterate === 'romaji' || transliterate === 'true') {
    doc = convertDocumentToRomaji(doc);
  }

  c.header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');

  if (format === 'lrc') {
    const lrcText = exportLRC(doc, { format: 'enhanced_standard' });
    return c.text(lrcText, 200, { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  if (format === 'ttml') {
    const ttmlXml = exportTTML(doc);
    return c.text(ttmlXml, 200, { 'Content-Type': 'application/xml; charset=utf-8' });
  }

  if (format === 'compact') {
    return c.json(compressDocumentToDelta(doc));
  }

  return c.json(doc);
});

lyricsRouter.get('/:id/lrc', async (c) => {
  const id = c.req.param('id');
  const transliterate = (c.req.query('transliterate') || '').toLowerCase();
  let doc = DOCUMENT_STORE[id] || MOCK_DOCUMENTS[id];

  if (!doc) {
    return c.json({ error: 'NOT_FOUND', message: `Lyrics document for '${id}' not found.` }, 404);
  }

  if (transliterate === 'romaji' || transliterate === 'true') {
    doc = convertDocumentToRomaji(doc);
  }

  c.header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  const lrcText = exportLRC(doc, { format: 'enhanced_standard' });
  return c.text(lrcText, 200, { 'Content-Type': 'text/plain; charset=utf-8' });
});

lyricsRouter.get('/:id/ttml', async (c) => {
  const id = c.req.param('id');
  const transliterate = (c.req.query('transliterate') || '').toLowerCase();
  let doc = DOCUMENT_STORE[id] || MOCK_DOCUMENTS[id];

  if (!doc) {
    return c.json({ error: 'NOT_FOUND', message: `Lyrics document for '${id}' not found.` }, 404);
  }

  if (transliterate === 'romaji' || transliterate === 'true') {
    doc = convertDocumentToRomaji(doc);
  }

  c.header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  const ttmlXml = exportTTML(doc);
  return c.text(ttmlXml, 200, { 'Content-Type': 'application/xml; charset=utf-8' });
});
