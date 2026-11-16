import type { OpenLyricsDocument, LyricLine, WordToken } from '@openlyryc/schema';
import * as schema from '@openlyryc/schema';
const parseLRC = (lrc: string) => (schema.parseLRC || (schema as any).default?.parseLRC)(lrc);
import { tokenizeLineIntoWords } from './tokenizer.js';

const LRC_RED_BASE = 'https://lrc.red';
const LRCLIB_BASE = 'https://lrclib.net/api';
const BINIMUM_BASE = 'https://lyrics-api.binimum.org';

// In-flight SingleFlight request deduplication map to prevent upstream thrashing
const inFlightRequests = new Map<string, Promise<OpenLyricsDocument | null>>();

export function sanitizeSongQuery(text: string): string {
  if (!text) return '';
  return text
    .replace(/[.!?,:;]+$/, '')
    .replace(/[\(\[](feat|ft|with|prod)\.?\s+[^\)\]]+[\)\]]/gi, '')
    .replace(/[\(\[](official|lyrics?|video|audio|visualizer|remix|edit|sped\s*up|slowed)[^\)\]]*[\)\]]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseTtmlTimecode(val?: string | null): number {
  if (!val) return 0;
  const str = val.trim();

  if (str.endsWith('ms')) {
    const ms = parseFloat(str.slice(0, -2));
    return isNaN(ms) ? 0 : ms / 1000;
  }
  if (str.endsWith('s')) {
    const s = parseFloat(str.slice(0, -1));
    return isNaN(s) ? 0 : s;
  }

  const parts = str.split(':');
  if (parts.length === 3) {
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    const s = parseFloat(parts[2]) || 0;
    return h * 3600 + m * 60 + s;
  } else if (parts.length === 2) {
    const m = parseFloat(parts[0]) || 0;
    const s = parseFloat(parts[1]) || 0;
    return m * 60 + s;
  } else if (parts.length === 1) {
    return parseFloat(parts[0]) || 0;
  }

  return 0;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

export function parseHeadlessTTML(xmlString: string): OpenLyricsDocument {
  const doc: OpenLyricsDocument = {
    $schema: 'https://openlyrics.dev/schema/v1.json',
    version: 1,
    metadata: {
      title: 'Untitled Track',
      artist: 'Unknown Artist',
      album: '',
      duration: 0,
      syncedBy: 'OpenLyryc Edge TTML Resolver',
    },
    lines: [],
  };

  const titleMatch = xmlString.match(/<ttm:title[^>]*>([\s\S]*?)<\/ttm:title>/i) || xmlString.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    doc.metadata.title = decodeXmlEntities(titleMatch[1].trim());
  }

  const agentMatch = xmlString.match(/<(?:ttm:)?agent[^>]*type="person"[^>]*>([\s\S]*?)<\/(?:ttm:)?agent>/i);
  if (agentMatch && agentMatch[1]) {
    doc.metadata.artist = decodeXmlEntities(agentMatch[1].trim());
  }

  const pRegex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  let pMatch: RegExpExecArray | null;
  let lineIdx = 0;

  while ((pMatch = pRegex.exec(xmlString)) !== null) {
    const pAttrs = pMatch[1];
    const pBody = pMatch[2];

    const beginMatch = pAttrs.match(/begin=["']([^"']+)["']/i);
    const endMatch = pAttrs.match(/end=["']([^"']+)["']/i);
    const lineStart = parseTtmlTimecode(beginMatch ? beginMatch[1] : null);
    const lineEnd = parseTtmlTimecode(endMatch ? endMatch[1] : null);

    const isBackground =
      /role=["']background["']/i.test(pAttrs) ||
      /itunes:role=["']background["']/i.test(pAttrs);

    // Extract word-level spans
    const spanRegex = /<span\b([^>]*)>([\s\S]*?)<\/span>/gi;
    let spanMatch: RegExpExecArray | null;
    const tokens: WordToken[] = [];

    while ((spanMatch = spanRegex.exec(pBody)) !== null) {
      const sAttrs = spanMatch[1];
      const sText = decodeXmlEntities(spanMatch[2].replace(/<[^>]+>/g, '')).trim();

      const sBeginMatch = sAttrs.match(/begin=["']([^"']+)["']/i);
      const sEndMatch = sAttrs.match(/end=["']([^"']+)["']/i);
      const spanBegin = parseTtmlTimecode(sBeginMatch ? sBeginMatch[1] : null) || lineStart;
      const spanEnd = parseTtmlTimecode(sEndMatch ? sEndMatch[1] : null) || (lineEnd > spanBegin ? lineEnd : spanBegin + 0.5);

      if (sText.length > 0) {
        tokens.push({
          text: sText,
          start: spanBegin,
          end: spanEnd,
        });
      }
    }

    const cleanText = decodeXmlEntities(pBody.replace(/<[^>]+>/g, '')).trim();

    // Auto-generate proportional word tokens if spans are missing
    if (tokens.length === 0 && cleanText.length > 0) {
      const words = tokenizeLineIntoWords(cleanText);
      const effectiveLineEnd = lineEnd > lineStart ? lineEnd : lineStart + 3.0;
      const lineDur = Math.max(0.1, effectiveLineEnd - lineStart);
      const step = words.length > 0 ? lineDur / words.length : lineDur;

      words.forEach((w, wIdx) => {
        tokens.push({
          text: w,
          start: Math.round((lineStart + wIdx * step) * 1000) / 1000,
          end: Math.round((lineStart + (wIdx + 1) * step) * 1000) / 1000,
        });
      });
    }

    if (cleanText.length > 0 || lineStart > 0) {
      doc.lines.push({
        id: `line_${lineIdx++}`,
        start: lineStart,
        end: lineEnd > lineStart ? lineEnd : lineStart + 3.0,
        text: cleanText,
        isBackground: Boolean(isBackground || (cleanText.startsWith('(') && cleanText.endsWith(')'))),
        tokens: tokens.length > 0 ? tokens : undefined,
      });
    }
  }

  return doc;
}

export async function fetchLrcRedDirect(
  title: string,
  artist: string,
  signal?: AbortSignal
): Promise<OpenLyricsDocument | null> {
  if (!title) return null;
  try {
    const cleanT = sanitizeSongQuery(title);
    const cleanA = sanitizeSongQuery(artist);
    const url = new URL(`${LRC_RED_BASE}/match.json`);
    url.searchParams.set('title', cleanT || title);
    if (cleanA || artist) {
      url.searchParams.set('artist', cleanA || artist);
    }

    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'OpenLyryc-API/1.0.0 (https://openlyryc.pages.dev)',
        Accept: 'application/json',
      },
      signal,
    });

    if (!res.ok) return null;
    const data: any = await res.json();
    const hits: any[] = data?.hits || [];
    const normTarget = (cleanT || title).toLowerCase().replace(/[\p{P}\p{Z}\p{S}]+/gu, '');
    const hit = hits.find((h) => {
      const hTitle = (h.title || '').toLowerCase().replace(/[\p{P}\p{Z}\p{S}]+/gu, '');
      return hTitle.includes(normTarget) || normTarget.includes(hTitle);
    });

    if (!hit || !hit.isrc) return null;

    const ttmlUrl = `${LRC_RED_BASE}/s/${hit.isrc}.ttml`;
    const ttmlRes = await fetch(ttmlUrl, {
      headers: { 'User-Agent': 'OpenLyryc-API/1.0.0 (https://openlyryc.pages.dev)' },
      signal,
    });
    if (!ttmlRes.ok) return null;

    const ttmlText = await ttmlRes.text();
    if (!ttmlText || !ttmlText.trim()) return null;

    const doc = parseHeadlessTTML(ttmlText);
    if (!doc.lines || doc.lines.length === 0) return null;

    doc.metadata.title = hit.title || title;
    doc.metadata.artist = hit.artist || artist;
    doc.metadata.album = hit.album || doc.metadata.album;
    doc.metadata.duration = Math.round(hit.duration || doc.metadata.duration || 0);
    doc.metadata.isrc = hit.isrc;
    doc.metadata.coverArt = hit.cover;
    doc.metadata.syncedBy = 'Apple Music (lrc.red via OpenLyryc Edge)';

    return doc;
  } catch {
    return null;
  }
}

export async function fetchBinimumDirect(
  title: string,
  artist: string,
  signal?: AbortSignal
): Promise<OpenLyricsDocument | null> {
  if (!title) return null;
  try {
    const cleanT = sanitizeSongQuery(title);
    const cleanA = sanitizeSongQuery(artist);
    const url = new URL(BINIMUM_BASE);
    url.searchParams.set('track', cleanT || title);
    if (cleanA || artist) {
      url.searchParams.set('artist', cleanA || artist);
    }

    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'OpenLyryc-API/1.0.0 (https://openlyryc.pages.dev)',
        Accept: 'application/json',
      },
      signal,
    });

    if (!res.ok) return null;
    const data: any = await res.json();
    const results: any[] = data?.results || [];
    const normTarget = (cleanT || title).toLowerCase().replace(/[\p{P}\p{Z}\p{S}]+/gu, '');
    const candidate = results.find((r) => {
      const rTitle = (r.track_name || '').toLowerCase().replace(/[\p{P}\p{Z}\p{S}]+/gu, '');
      return rTitle.includes(normTarget) || normTarget.includes(rTitle);
    });

    if (!candidate || !candidate.lyricsUrl) return null;

    const ttmlRes = await fetch(candidate.lyricsUrl, {
      headers: { 'User-Agent': 'OpenLyryc-API/1.0.0 (https://openlyryc.pages.dev)' },
      signal,
    });
    if (!ttmlRes.ok) return null;

    const ttmlText = await ttmlRes.text();
    if (!ttmlText || !ttmlText.trim()) return null;

    const doc = parseHeadlessTTML(ttmlText);
    if (!doc.lines || doc.lines.length === 0) return null;

    doc.metadata.title = candidate.track_name || title;
    doc.metadata.artist = candidate.artist_name || artist;
    doc.metadata.album = candidate.album_name || doc.metadata.album;
    doc.metadata.duration = Math.round(candidate.duration || doc.metadata.duration || 0);
    doc.metadata.syncedBy = 'Apple Music (Binimum via OpenLyryc Edge)';

    return doc;
  } catch {
    return null;
  }
}

export async function fetchLrclibDirect(
  title: string,
  artist: string,
  duration?: number,
  signal?: AbortSignal
): Promise<OpenLyricsDocument | null> {
  if (!title) return null;
  try {
    const cleanT = sanitizeSongQuery(title);
    const cleanA = sanitizeSongQuery(artist);
    const headers = {
      'User-Agent': 'OpenLyryc-API/1.0.0 (https://openlyryc.pages.dev)',
      'Lrclib-Client': 'OpenLyryc-API/1.0.0 (https://openlyryc.pages.dev)',
      Accept: 'application/json',
    };

    let syncedLyrics: string | null = null;
    let metaArtist = artist;
    let metaTitle = title;
    let metaAlbum = '';
    let metaDuration = duration || 0;

    // 1. Exact lookup
    if (cleanT && cleanA) {
      const getUrl = new URL(`${LRCLIB_BASE}/get`);
      getUrl.searchParams.set('track_name', cleanT);
      getUrl.searchParams.set('artist_name', cleanA);
      if (duration && duration > 0) getUrl.searchParams.set('duration', String(Math.round(duration)));

      const res = await fetch(getUrl.toString(), { headers, signal });
      if (res.ok) {
        const data: any = await res.json();
        if (data && (data.syncedLyrics || data.plainLyrics)) {
          syncedLyrics = data.syncedLyrics || data.plainLyrics;
          metaArtist = data.artistName || metaArtist;
          metaTitle = data.trackName || metaTitle;
          metaAlbum = data.albumName || '';
          metaDuration = data.duration || metaDuration;
        }
      }
    }

    // 2. Fuzzy search fallback
    if (!syncedLyrics) {
      const q = `${cleanA ? cleanA + ' ' : ''}${cleanT}`.trim();
      const searchUrl = `${LRCLIB_BASE}/search?q=${encodeURIComponent(q)}`;
      const sRes = await fetch(searchUrl, { headers, signal });
      if (sRes.ok) {
        const list: any[] = await sRes.json();
        if (Array.isArray(list) && list.length > 0) {
          const best = list.find((item) => item.syncedLyrics) || list[0];
          if (best && (best.syncedLyrics || best.plainLyrics)) {
            syncedLyrics = best.syncedLyrics || best.plainLyrics;
            metaArtist = best.artistName || metaArtist;
            metaTitle = best.trackName || metaTitle;
            metaAlbum = best.albumName || '';
            metaDuration = best.duration || metaDuration;
          }
        }
      }
    }

    if (!syncedLyrics) return null;

    const parsed = parseLRC(syncedLyrics);
    parsed.metadata = {
      ...parsed.metadata,
      title: metaTitle || parsed.metadata.title,
      artist: metaArtist || parsed.metadata.artist,
      album: metaAlbum || parsed.metadata.album,
      duration: metaDuration || parsed.metadata.duration,
      syncedBy: 'LRCLIB (via OpenLyryc Edge)',
    };

    return parsed.lines && parsed.lines.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function rankLyricsDocuments(docs: OpenLyricsDocument[]): OpenLyricsDocument[] {
  if (!docs || docs.length === 0) return [];

  const scoreDoc = (doc: OpenLyricsDocument): number => {
    const hasWordSync = doc.lines?.some((l) => l.tokens && l.tokens.length > 0);
    const hasLineSync = doc.lines?.some((l) => l.start > 0 || l.end > 0);
    const syncedBy = (doc.metadata.syncedBy || '').toLowerCase();

    let score = 0;
    if (hasWordSync) score += 50;
    else if (hasLineSync) score += 30;

    if (syncedBy.includes('lrc.red')) score += 20;
    else if (syncedBy.includes('binimum')) score += 18;
    else if (syncedBy.includes('lrclib')) score += 12;

    score += Math.min(10, (doc.lines?.length || 0) / 10);
    return score;
  };

  return [...docs].sort((a, b) => scoreDoc(b) - scoreDoc(a));
}

/**
 * Resolves lyrics across all providers using SingleFlight deduplication.
 */
export async function resolveLyricsMultiProvider(
  title: string,
  artist: string,
  duration?: number
): Promise<OpenLyricsDocument | null> {
  const normKey = `${(artist || '').toLowerCase().trim()}:${(title || '').toLowerCase().trim()}:${Math.round(duration || 0)}`;

  // SingleFlight: reuse existing in-flight promise for concurrent identical requests
  if (inFlightRequests.has(normKey)) {
    return inFlightRequests.get(normKey)!;
  }

  const promise = (async () => {
    // Phase 1: Parallel direct race across lrc.red, binimum, and lrclib
    const directPromises = [
      fetchLrcRedDirect(title, artist),
      fetchBinimumDirect(title, artist),
      fetchLrclibDirect(title, artist, duration),
    ];

    const p1Results = await Promise.allSettled(directPromises);
    const p1Docs = p1Results
      .filter((r): r is PromiseFulfilledResult<OpenLyricsDocument | null> => r.status === 'fulfilled' && r.value !== null)
      .map((r) => r.value!);

    const rankedP1 = rankLyricsDocuments(p1Docs);
    if (rankedP1.length > 0) return rankedP1[0];

    // Phase 2: Cleaned query sanitization race
    const cleanTitle = sanitizeSongQuery(title);
    const cleanArtist = sanitizeSongQuery(artist);
    if (cleanTitle !== title || cleanArtist !== artist) {
      const p2Results = await Promise.allSettled([
        fetchLrcRedDirect(cleanTitle, cleanArtist),
        fetchBinimumDirect(cleanTitle, cleanArtist),
        fetchLrclibDirect(cleanTitle, cleanArtist, duration),
      ]);

      const p2Docs = p2Results
        .filter((r): r is PromiseFulfilledResult<OpenLyricsDocument | null> => r.status === 'fulfilled' && r.value !== null)
        .map((r) => r.value!);

      const rankedP2 = rankLyricsDocuments(p2Docs);
      if (rankedP2.length > 0) return rankedP2[0];
    }

    return null;
  })();

  inFlightRequests.set(normKey, promise);

  try {
    return await promise;
  } finally {
    inFlightRequests.delete(normKey);
  }
}
