import { OpenLyricsDocument } from '@/types/lyrics';

/**
 * Format float seconds to TTML timestamp string: '00:01:23.456'
 */
export function formatTtmlTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  const minStr = mins.toString().padStart(2, '0');
  const secStr = parseFloat(secs) < 10 ? `0${secs}` : secs;
  return `00:${minStr}:${secStr}`;
}

/**
 * Serializes an OpenLyricsDocument into a standard Apple Music / W3C TTML XML string
 */
export function exportTTML(doc: OpenLyricsDocument): string {
  const { metadata, lines } = doc;
  const title = metadata.title || 'Untitled';
  const artist = metadata.artist || 'Unknown Artist';

  let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
  xml += `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/metadata">\n`;
  xml += `  <head>\n`;
  xml += `    <metadata>\n`;
  xml += `      <ttm:title>${escapeXml(title)}</ttm:title>\n`;
  xml += `      <ttm:agent type="person">${escapeXml(artist)}</ttm:agent>\n`;
  if (metadata.spotifyId) {
    xml += `      <itunes:songId>${escapeXml(metadata.spotifyId)}</itunes:songId>\n`;
  }
  xml += `    </metadata>\n`;
  xml += `  </head>\n`;
  xml += `  <body>\n`;
  xml += `    <div>\n`;

  lines.forEach((line) => {
    const begin = formatTtmlTime(line.start);
    const end = formatTtmlTime(line.end);
    const bgAttr = line.isBackground ? ' itunes:role="background"' : '';
    const lineEmphasisAttr = line.emphasis ? ' itunes:emphasis="true" emphasis="true"' : '';

    if (line.tokens && line.tokens.length > 0) {
      // Clean word spans compliant with Unison / Apple Music validation:
      // 1. Spans must not have line breaks between them (inter-span-newline ban)
      // 2. No trailing or leading whitespace inside the <span> tags
      // 3. Inter-word spacing placed cleanly between span tags
      // 4. Word durations must be non-zero (end > start)
      const spans = line.tokens
        .map((token) => {
          const cleanText = (token.text || '').trim();
          if (!cleanText) return '';
          const tokenBegin = formatTtmlTime(token.start);
          const safeEndSeconds = Math.max(token.start + 0.04, token.end);
          const tokenEnd = formatTtmlTime(safeEndSeconds);
          const tokenEmphasisAttr = token.emphasis ? ' emphasis="true"' : '';
          return `<span begin="${tokenBegin}" end="${tokenEnd}"${tokenEmphasisAttr}>${escapeXml(cleanText)}</span>`;
        })
        .filter(Boolean);

      if (spans.length > 0) {
        xml += `      <p begin="${begin}" end="${end}"${bgAttr}${lineEmphasisAttr}>${spans.join(' ')}</p>\n`;
      } else {
        xml += `      <p begin="${begin}" end="${end}"${bgAttr}${lineEmphasisAttr}>${escapeXml(line.text.trim())}</p>\n`;
      }
    } else {
      xml += `      <p begin="${begin}" end="${end}"${bgAttr}${lineEmphasisAttr}>${escapeXml(line.text.trim())}</p>\n`;
    }
  });

  xml += `    </div>\n`;
  xml += `  </body>\n`;
  xml += `</tt>\n`;

  return xml;
}

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
