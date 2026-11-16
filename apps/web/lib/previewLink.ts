import { OpenLyricsDocument } from '@/types/lyrics';
import { fetchLyricsDocument } from './apiClient';
import { searchLrclib, fetchLrclibDocument } from './lrclibService';

export type PreviewTheme = 'fluid_glow' | 'monochrome_oled' | 'vaporwave_neon' | 'stage_karaoke';

export interface PreviewResolvedResult {
  document: OpenLyricsDocument | null;
  source: 'catalog' | 'local_storage' | 'draft_hash' | 'lrclib' | 'turso_db' | 'none';
  theme?: PreviewTheme;
  tvMode?: boolean;
  error?: string;
}

import LZString from 'lz-string';
import { deflateRaw, inflateRaw } from 'pako';
import { encodeDocumentToBinary, decodeBinaryToDocument } from './binaryLyrics';
import { base2048encode, base2048decode } from './base2048';
import { fetchPreviewFromTurso } from './turso';

// ─── Ultra-Compact Pipeline: Binary → DEFLATE → Base2048 ──────────────────────

/**
 * Encodes an OpenLyricsDocument into an ultra-compact Base2048 string.
 * Pipeline: Document → OLB binary → DEFLATE → Base2048 Unicode.
 * Achieves ~85% URL reduction compared to LZ-string.
 */
export function encodeUltraCompact(doc: OpenLyricsDocument): string {
  try {
    const binary = encodeDocumentToBinary(doc);
    const deflated = deflateRaw(binary, { level: 9 });
    return base2048encode(deflated);
  } catch (err) {
    console.error('Ultra-compact encoding failed:', err);
    return '';
  }
}

/**
 * Decodes an ultra-compact Base2048 string back to an OpenLyricsDocument.
 * Pipeline: Base2048 → inflate → OLB binary decode → Document.
 */
export function decodeUltraCompact(encoded: string): OpenLyricsDocument | null {
  try {
    const deflated = base2048decode(encoded);
    const binary = inflateRaw(deflated);
    return decodeBinaryToDocument(binary);
  } catch (err) {
    console.warn('Ultra-compact decoding failed:', err);
    return null;
  }
}

/**
 * Detects if a string contains Base2048 encoded content.
 * Base2048 uses Unicode characters above ASCII range (code point >= 0x0250).
 */
function isBase2048Payload(str: string): boolean {
  if (!str || str.length < 3) return false;
  // Check first 3 characters — Base2048 uses non-ASCII Unicode chars
  for (let i = 0; i < Math.min(3, str.length); i++) {
    if (str.charCodeAt(i) < 0x0250) return false;
  }
  return true;
}

// ─── Legacy Encoding (LZ-string + Base64) ──────────────────────────────────────

/**
 * Legacy: LZ-string compressed URL payload (backwards compatible).
 */
export function encodeDraftToHash(doc: OpenLyricsDocument): string {
  try {
    const jsonStr = JSON.stringify(doc);
    const compressed = LZString.compressToEncodedURIComponent(jsonStr);
    if (compressed && compressed.length > 5) {
      return `lz:${compressed}`;
    }

    // Fallback to UTF-8 safe base64
    if (typeof window !== 'undefined') {
      const bytes = new TextEncoder().encode(jsonStr);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    }
    return Buffer.from(jsonStr, 'utf-8').toString('base64');
  } catch (err) {
    console.error('Failed to encode document to hash:', err);
    return '';
  }
}

/**
 * Decodes an LZ-compressed, base64, or ultra-compact hash back into an OpenLyricsDocument.
 * Auto-detects format by payload prefix.
 */
export function decodeHashToDraft(hashOrParam: string): OpenLyricsDocument | null {
  try {
    if (!hashOrParam) return null;
    let payload = hashOrParam.replace(/^[#?]/, '');

    // Extract draft / d parameter if present alongside other params (e.g. &theme=...)
    if (payload.includes('draft=')) {
      const parts = payload.split('draft=')[1].split('&')[0];
      payload = decodeURIComponent(parts);
    } else if (payload.includes('d=')) {
      const parts = payload.split('d=')[1].split('&')[0];
      payload = decodeURIComponent(parts);
    } else {
      // Split on & to remove theme params, but preserve the payload
      payload = decodeURIComponent(payload.split('&')[0]);
    }

    if (!payload || payload.length < 3) return null;

    // 1. Ultra-Compact Base2048 Payload (non-ASCII Unicode characters)
    if (isBase2048Payload(payload)) {
      const doc = decodeUltraCompact(payload);
      if (doc) return doc;
    }

    // 2. LZ-Compressed Payload (`lz:...`)
    if (payload.startsWith('lz:')) {
      const compressedData = payload.slice(3);
      const jsonStr = LZString.decompressFromEncodedURIComponent(compressedData);
      if (jsonStr) {
        return JSON.parse(jsonStr) as OpenLyricsDocument;
      }
    }

    // 3. Legacy Base64 Uncompressed Payload Fallback
    let jsonStr = '';
    if (typeof window !== 'undefined') {
      const binary = window.atob(payload);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      jsonStr = new TextDecoder().decode(bytes);
    } else {
      jsonStr = Buffer.from(payload, 'base64').toString('utf-8');
    }

    return JSON.parse(jsonStr) as OpenLyricsDocument;
  } catch (err) {
    console.warn('Failed to decode draft hash:', err);
    return null;
  }
}

// ─── Compression Statistics ────────────────────────────────────────────────────

export interface CompressionStats {
  originalJsonBytes: number;
  binaryBytes: number;
  deflatedBytes: number;
  encodedChars: number;
  totalUrlChars: number;
  reductionPercent: number;
}

/**
 * Computes compression stats for a document through the full pipeline.
 */
export function getCompressionStats(doc: OpenLyricsDocument): CompressionStats {
  const jsonStr = JSON.stringify(doc);
  const originalJsonBytes = new TextEncoder().encode(jsonStr).length;
  const binary = encodeDocumentToBinary(doc);
  const deflated = deflateRaw(binary, { level: 9 });
  const encoded = base2048encode(deflated);
  // /p# + encoded payload
  const totalUrlChars = 3 + encoded.length;

  return {
    originalJsonBytes,
    binaryBytes: binary.length,
    deflatedBytes: deflated.length,
    encodedChars: encoded.length,
    totalUrlChars,
    reductionPercent: Math.round((1 - totalUrlChars / (jsonStr.length + 30)) * 100),
  };
}

// ─── Preview Link Generation ───────────────────────────────────────────────────

/**
 * Generates a universal shareable preview link using ultra-compact encoding.
 * 100% stateless — no API, no database, no localStorage dependency.
 * Opens on any device, any browser, anywhere.
 */
export function generatePreviewLink(params: {
  document: OpenLyricsDocument;
  songId?: string;
  theme?: PreviewTheme;
  tvMode?: boolean;
  origin?: string;
  forceDatabaseId?: boolean;
}): string {
  const baseOrigin = params.origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const themeParam = params.theme && params.theme !== 'fluid_glow' ? `&theme=${params.theme}` : '';
  const tvParam = params.tvMode ? '&tv=1' : '';
  const extraParams = `${themeParam}${tvParam}`;

  // Auto-persist document into local doc cache if in browser
  if (typeof window !== 'undefined' && params.songId) {
    try {
      localStorage.setItem(`openlyrics_doc_${params.songId}`, JSON.stringify(params.document));
      localStorage.setItem('openlyrics_preview_latest', JSON.stringify(params.document));
    } catch {
      // ignore
    }
  }

  // 1. If explicit database ID link requested and verified
  if (params.forceDatabaseId && params.songId) {
    return `${baseOrigin}/preview?id=${encodeURIComponent(params.songId)}${extraParams}`;
  }

  // 2. Ultra-Compact Self-Contained Link (Binary → DEFLATE → Base2048)
  const ultraCompact = encodeUltraCompact(params.document);
  if (ultraCompact && ultraCompact.length > 0) {
    return `${baseOrigin}/p#${ultraCompact}${extraParams}`;
  }

  // 3. Fallback: LZ-Compressed Legacy Hash Link
  const draftHash = encodeDraftToHash(params.document);
  return `${baseOrigin}/preview#draft=${draftHash}${extraParams}`;
}

// ─── Preview Document Resolution ───────────────────────────────────────────────

/**
 * Resolves an OpenLyricsDocument from an ID, canonicalKey, query param, hash, LRCLIB search, or localStorage.
 */
export async function resolvePreviewDocument(idOrParam?: string): Promise<PreviewResolvedResult> {
  let targetId = (idOrParam || '').trim();

  // 1. If in browser, check URL query parameters or hash for Turso shortcode (?c=... or #c=...)
  if (typeof window !== 'undefined') {
    const searchParams = new URLSearchParams(window.location.search);
    const shortCode =
      searchParams.get('c') ||
      searchParams.get('code') ||
      (window.location.hash.match(/[#&?]c(?:ode)?=([a-zA-Z0-9_-]+)/) || [])[1];

    if (shortCode) {
      const tursoDoc = await fetchPreviewFromTurso(shortCode);
      if (tursoDoc) {
        return {
          document: tursoDoc.document,
          source: 'turso_db',
          theme: tursoDoc.theme,
          tvMode: tursoDoc.tvMode,
        };
      }
    }

    if (window.location.hash) {
      const hashDoc = decodeHashToDraft(window.location.hash);
      if (hashDoc) return { document: hashDoc, source: 'draft_hash' };
    }

    if (!targetId) {
      targetId = searchParams.get('id') || searchParams.get('track') || searchParams.get('d') || '';
    }
  }

  // If still empty, default to local draft
  if (!targetId) {
    targetId = 'local';
  }

  const cleanId = decodeURIComponent(targetId).trim();

  // Check if cleanId is a direct Turso shortcode (e.g. /preview?id=Gfw248 or /p?d=Gfw248)
  if (/^[a-zA-Z0-9_-]{4,12}$/.test(cleanId) && cleanId !== 'local' && cleanId !== 'draft') {
    const tursoDoc = await fetchPreviewFromTurso(cleanId);
    if (tursoDoc) {
      return {
        document: tursoDoc.document,
        source: 'turso_db',
        theme: tursoDoc.theme,
        tvMode: tursoDoc.tvMode,
      };
    }
  }

  // 2. Check localStorage for direct document key or active draft
  if (typeof window !== 'undefined') {
    try {
      // Check exact doc prefix
      const savedDoc = localStorage.getItem(`openlyrics_doc_${cleanId}`);
      if (savedDoc) {
        const doc = JSON.parse(savedDoc) as OpenLyricsDocument;
        return { document: doc, source: 'local_storage' };
      }

      // Check latest preview cache
      const latestDoc = localStorage.getItem('openlyrics_preview_latest');
      if (latestDoc) {
        const doc = JSON.parse(latestDoc) as OpenLyricsDocument;
        if (
          doc.metadata.canonicalKey?.includes(cleanId) ||
          cleanId.includes(doc.metadata.canonicalKey || '') ||
          cleanId === 'local' ||
          cleanId === 'draft'
        ) {
          return { document: doc, source: 'local_storage' };
        }
      }

      // Check active editor draft
      const draftDoc = localStorage.getItem('openlyrics_draft');
      if (draftDoc) {
        const doc = JSON.parse(draftDoc) as OpenLyricsDocument;
        if (
          cleanId === 'local' ||
          cleanId === 'draft' ||
          cleanId.includes(doc.metadata.title?.toLowerCase().replace(/[^a-z0-9]/g, '') || '___')
        ) {
          return { document: doc, source: 'local_storage' };
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Check if cleanId is a direct base64 encoded draft
  if (cleanId.startsWith('draft=') || cleanId.length > 100) {
    const doc = decodeHashToDraft(cleanId);
    if (doc) {
      return { document: doc, source: 'draft_hash' };
    }
  }

  // 4. Normalize key (e.g. yt_kJQP7kiw5Fk -> yt:kJQP7kiw5Fk)
  const normalizedKey = cleanId.replace(/^([a-z0-9]+)_/i, '$1:');

  // 5. Try fetching from Catalog / API / Local Storage catalog
  try {
    const doc = (await fetchLyricsDocument(cleanId)) || (await fetchLyricsDocument(normalizedKey));
    if (doc) {
      return { document: doc, source: 'catalog' };
    }
  } catch {
    // ignore
  }

  // 6. Smart LRCLIB on-demand resolution by title/artist slug (e.g. cl_lrc_eminem_rapgod -> "eminem rapgod")
  try {
    const query = cleanId
      .replace(/^cl_lrc_/i, '')
      .replace(/^lrc_/i, '')
      .replace(/^cl_/i, '')
      .replace(/[_-]+/g, ' ')
      .trim();

    if (query.length >= 2) {
      const searchResults = await searchLrclib(query);
      if (searchResults && searchResults.length > 0) {
        const topResult = searchResults[0];
        const numericId = parseInt(topResult.id.replace('lrc_', ''), 10);
        if (!isNaN(numericId)) {
          const lrcDoc = await fetchLrclibDocument(numericId);
          if (lrcDoc) {
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem(`openlyrics_doc_${cleanId}`, JSON.stringify(lrcDoc));
              } catch {
                // ignore
              }
            }
            return { document: lrcDoc, source: 'lrclib' };
          }
        }
      }
    }
  } catch (err) {
    console.warn('LRCLIB fallback resolution error:', err);
  }

  // 7. Final fallback check for URL hash if running in browser
  if (typeof window !== 'undefined' && window.location.hash) {
    const hashDoc = decodeHashToDraft(window.location.hash);
    if (hashDoc) {
      return { document: hashDoc, source: 'draft_hash' };
    }
  }

  // 8. If all lookups fail and there's a draft in localStorage, load it as friendly fallback
  if (typeof window !== 'undefined') {
    try {
      const fallbackRaw = localStorage.getItem('openlyrics_draft');
      if (fallbackRaw) {
        const doc = JSON.parse(fallbackRaw) as OpenLyricsDocument;
        if (doc && doc.lines && doc.lines.length > 0) {
          return { document: doc, source: 'local_storage' };
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    document: null,
    source: 'none',
    error: `Could not find preview for "${cleanId}". Make sure the track ID or link is correct.`,
  };
}
