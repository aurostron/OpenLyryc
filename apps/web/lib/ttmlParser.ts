import { OpenLyricsDocument, LyricLine, WordToken, LyricMetadata } from '@/types/lyrics';
import { tokenizeLineIntoWords } from './tokenizer';

/**
 * Parses time format from TTML (e.g. '00:01:23.456', '01:23.456', '83.45s', '83450ms') to seconds
 */
export function parseTtmlTimecode(val?: string | null): number {
  if (!val) return 0;
  const str = val.trim();

  // Offset format: 12.5s or 12500ms
  if (str.endsWith('ms')) {
    const ms = parseFloat(str.slice(0, -2));
    return isNaN(ms) ? 0 : ms / 1000;
  }
  if (str.endsWith('s')) {
    const s = parseFloat(str.slice(0, -1));
    return isNaN(s) ? 0 : s;
  }

  // Clock format: hh:mm:ss.mmm or mm:ss.mmm or ss.mmm
  const parts = str.split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  } else if (parts.length === 1) {
    return parseFloat(parts[0]) || 0;
  }

  return 0;
}

/**
 * Parses a Timed Text Markup Language (TTML / XML) string into an OpenLyricsDocument
 */
export function parseTTML(xmlString: string): OpenLyricsDocument {
  const metadata: LyricMetadata = {
    title: 'Untitled Track',
    artist: 'Unknown Artist',
    album: '',
    duration: 0,
    syncedBy: 'OpenLyryc TTML Importer',
  };

  const lines: LyricLine[] = [];

  if (typeof DOMParser === 'undefined') {
    // Regex-based robust fallback for SSR / headless runtimes
    const pRegex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
    let match: RegExpExecArray | null;
    let lineIdx = 0;
    while ((match = pRegex.exec(xmlString)) !== null) {
      const attrs = match[1];
      const body = match[2];
      const beginMatch = attrs.match(/begin=["']([^"']+)["']/i);
      const endMatch = attrs.match(/end=["']([^"']+)["']/i);
      const lineStart = parseTtmlTimecode(beginMatch ? beginMatch[1] : null);
      const lineEnd = parseTtmlTimecode(endMatch ? endMatch[1] : null);
      const cleanText = body.replace(/<[^>]+>/g, '').trim();
      if (cleanText.length > 0 || lineStart > 0) {
        const words = tokenizeLineIntoWords(cleanText);
        const lineDur = Math.max(0.1, (lineEnd > lineStart ? lineEnd : lineStart + 3.0) - lineStart);
        const step = words.length > 0 ? lineDur / words.length : lineDur;
        const tokens: WordToken[] = words.map((w, wIdx) => ({
          text: w,
          start: Math.round((lineStart + wIdx * step) * 1000) / 1000,
          end: Math.round((lineStart + (wIdx + 1) * step) * 1000) / 1000,
        }));
        lines.push({
          id: `ttml-${lineIdx++}-${Date.now()}`,
          start: lineStart,
          end: lineEnd > lineStart ? lineEnd : lineStart + 3.0,
          text: cleanText,
          tokens: tokens.length > 0 ? tokens : undefined,
        });
      }
    }
    return {
      $schema: 'https://openlyrics.dev/schema/v1.json',
      version: 1,
      metadata,
      lines,
    };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');

    // Extract metadata from <head><metadata>
    const titleEl = doc.querySelector('title, ttm\\:title, metadata title');
    if (titleEl && titleEl.textContent) {
      metadata.title = titleEl.textContent.trim();
    }

    const artistEl = doc.querySelector('agent[type="person"], ttm\\:agent, metadata agent');
    if (artistEl && artistEl.textContent) {
      metadata.artist = artistEl.textContent.trim();
    }

    // Extract paragraph elements <p>
    const pElements = doc.querySelectorAll('p, div > p');

    pElements.forEach((p, lineIdx) => {
      const beginAttr = p.getAttribute('begin');
      const endAttr = p.getAttribute('end');
      const lineStart = parseTtmlTimecode(beginAttr);
      const lineEnd = parseTtmlTimecode(endAttr);

      const isBackground =
        p.getAttribute('itunes:role') === 'background' ||
        p.getAttribute('ttm:role') === 'background' ||
        p.getAttribute('role') === 'background' ||
        (p.textContent?.trim().startsWith('(') && p.textContent?.trim().endsWith(')'));

      const isLineEmphasis =
        p.getAttribute('itunes:emphasis') === 'true' ||
        p.getAttribute('emphasis') === 'true' ||
        p.getAttribute('ttm:role') === 'emphasis' ||
        p.getAttribute('role') === 'emphasis' ||
        p.getAttribute('tts:textEmphasis') != null;

      const spans = p.querySelectorAll('span');
      const tokens: WordToken[] = [];

      if (spans.length > 0) {
        spans.forEach((span) => {
          const spanBegin = parseTtmlTimecode(span.getAttribute('begin') || beginAttr);
          const spanEnd = parseTtmlTimecode(span.getAttribute('end') || endAttr);
          const text = span.textContent || '';
          const isSpanEmphasis =
            span.getAttribute('itunes:emphasis') === 'true' ||
            span.getAttribute('emphasis') === 'true' ||
            span.getAttribute('ttm:role') === 'emphasis' ||
            span.getAttribute('role') === 'emphasis' ||
            span.getAttribute('tts:textEmphasis') != null ||
            isLineEmphasis;

          if (text.trim().length > 0) {
            tokens.push({
              text,
              start: spanBegin,
              end: spanEnd,
              emphasis: isSpanEmphasis || undefined,
            });
          }
        });
      }

      const fullText = p.textContent?.trim() || '';

      // If no syllable spans are embedded, auto-generate proportional word tokens for kinetic reveal
      if (tokens.length === 0 && fullText.length > 0) {
        const words = tokenizeLineIntoWords(fullText);
        const lineDur = Math.max(0.1, (lineEnd > lineStart ? lineEnd : lineStart + 3.0) - lineStart);
        const step = words.length > 0 ? lineDur / words.length : lineDur;
        words.forEach((w, wIdx) => {
          tokens.push({
            text: w,
            start: Math.round((lineStart + wIdx * step) * 1000) / 1000,
            end: Math.round((lineStart + (wIdx + 1) * step) * 1000) / 1000,
          });
        });
      }

      if (fullText.length > 0 || lineStart > 0) {
        lines.push({
          id: `ttml-${lineIdx}-${Date.now()}`,
          start: lineStart,
          end: lineEnd > lineStart ? lineEnd : lineStart + 3,
          text: fullText,
          isBackground: Boolean(isBackground),
          emphasis: isLineEmphasis || tokens.some((t) => Boolean(t.emphasis)) || undefined,
          tokens: tokens.length > 0 ? tokens : undefined,
        });
      }
    });

    // Auto-calculate end times if missing
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].end <= lines[i].start) {
        if (i < lines.length - 1 && lines[i + 1].start > lines[i].start) {
          lines[i].end = lines[i + 1].start;
        } else {
          lines[i].end = lines[i].start + 3.5;
        }
      }
    }
  } catch (err) {
    console.error('[TTML Parser] Failed to parse TTML XML:', err);
  }

  return {
    $schema: 'https://openlyrics.dev/schema/v1.json',
    version: 1,
    metadata,
    lines,
  };
}
