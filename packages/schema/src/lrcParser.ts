import { LyricLine, LyricMetadata, OpenLyricsDocument, WordToken } from './lyrics';

export type LrcExportFormat =
  | 'standard'          // Traditional [mm:ss.xx] line-level LRC (universal compatibility)
  | 'enhanced_compact'  // Naturally space-optimized delta tags <offset:dur>, elided first word (~65% smaller)
  | 'enhanced_standard' // Traditional <mm:ss.xx> word timestamps
  | 'olrc';             // Full OpenLyryc extended format (vocalists, sections, ad-libs, compact delta)

export interface LrcExportOptions {
  format?: LrcExportFormat;
  precisionMode?: boolean;
  multiplexChoruses?: boolean;
  includeMetadata?: boolean;
}

export interface LrcSpaceSavingsReport {
  standardLrcBytes: number;
  traditionalEnhancedLrcBytes: number;
  compactEnhancedLrcBytes: number;
  olrcBytes: number;
  savedBytes: number;
  percentageSaved: number;
}

/**
 * Formats time in seconds to standard LRC timecode string: mm:ss.xx (or mm:ss.xxx in precision mode)
 */
export function formatLrcTimecode(seconds: number, precisionMode = false): string {
  if (isNaN(seconds) || seconds < 0) return precisionMode ? '00:00.000' : '00:00.00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');

  if (precisionMode) {
    const mmm = String(Math.floor((seconds % 1) * 1000)).padStart(3, '0');
    return `${mm}:${ss}.${mmm}`;
  }

  const xx = String(Math.floor((seconds % 1) * 100)).padStart(2, '0');
  return `${mm}:${ss}.${xx}`;
}

/**
 * Parses timecode string (mm:ss.xx or mm:ss.xxx or m:ss or float seconds) into floating point seconds
 */
export function parseLrcTimecode(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.replace(/[\[\]]/g, '').trim();
  const parts = clean.split(':');
  if (parts.length < 2) {
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : Math.max(0, val);
  }
  const mins = parseFloat(parts[0]);
  const secs = parseFloat(parts[1]);
  if (isNaN(mins) || isNaN(secs)) return 0;
  return Math.max(0, mins * 60 + secs);
}

/**
 * Helper to parse a single word tag string like "01:23.45", "350", "350:280", "350:280*", "01:23.45,450"
 */
function parseWordTag(tagStr: string, lineStartTime: number): {
  startTime: number;
  durMs?: number;
  emphasis?: boolean;
} {
  let clean = tagStr.trim();
  let emphasis = false;

  if (clean.endsWith('*') || clean.endsWith('~')) {
    emphasis = true;
    clean = clean.slice(0, -1).trim();
  }

  // Absolute timecode check: matches "mm:ss.xx" or "m:ss.xx" (e.g. "01:23.45", "00:27.93")
  const isAbsolute = /^\d{1,2}:[0-5]\d(?:\.\d{1,3})?(?:$|[,:])/.test(clean);

  if (isAbsolute) {
    let timePart = clean;
    let durPart: string | undefined;

    if (clean.includes(',')) {
      const split = clean.split(',');
      timePart = split[0];
      durPart = split[1];
    } else {
      const parts = clean.split(':');
      if (parts.length === 3) {
        // mm:ss.xx:dur
        timePart = `${parts[0]}:${parts[1]}`;
        durPart = parts[2];
      }
    }

    const startTime = parseLrcTimecode(timePart);
    const durMs = durPart ? parseInt(durPart, 10) : undefined;
    return {
      startTime,
      durMs: durMs && !isNaN(durMs) ? durMs : undefined,
      emphasis: emphasis || undefined,
    };
  }

  // Relative millisecond delta format: "350" or "+350" or "350:280" or "0:470"
  let offsetStr = clean;
  let durMs: number | undefined;

  if (clean.startsWith('+')) {
    offsetStr = clean.slice(1);
  }

  if (offsetStr.includes(':')) {
    const parts = offsetStr.split(':');
    offsetStr = parts[0];
    durMs = parseInt(parts[1], 10);
  } else if (offsetStr.includes(',')) {
    const parts = offsetStr.split(',');
    offsetStr = parts[0];
    durMs = parseInt(parts[1], 10);
  }

  const offsetMs = parseFloat(offsetStr);
  const startTime = isNaN(offsetMs) ? lineStartTime : lineStartTime + offsetMs / 1000;

  return {
    startTime: Math.max(lineStartTime, startTime),
    durMs: durMs && !isNaN(durMs) ? durMs : undefined,
    emphasis: emphasis || undefined,
  };
}

/**
 * Parses standard .lrc, Enhanced .lrc, Compact Delta .lrc, Extended .olrc, or Plain Text lyrics
 */
export function parseLRC(lrcText: string): OpenLyricsDocument {
  if (!lrcText) {
    return {
      $schema: 'https://openlyrics.dev/schema/v1.json',
      version: 1,
      metadata: {
        title: 'Untitled Track',
        artist: 'Unknown Artist',
        album: '',
        duration: 0,
        syncedBy: 'OpenLyryc Creator',
      },
      lines: [{ id: 0, text: 'Enter lyric line...', start: 0, end: 3.0 }],
    };
  }

  const rawLines = lrcText.split(/\r?\n/);
  const metadata: LyricMetadata = {
    title: 'Untitled Track',
    artist: 'Unknown Artist',
    album: '',
    duration: 0,
    syncedBy: 'OpenLyryc Creator',
    vocalists: {},
  };

  const parsedLines: LyricLine[] = [];
  const multiTimestampRegex = /^((?:\[\d{1,2}:\d{2}(?:\.\d{1,3})?\])+)(.*)/;
  const singleTimestampExtractRegex = /\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]/g;
  const metaRegex = /^\[([a-z0-9_\-]+):(.*)\]$/i;

  let lineId = 0;
  let currentSection: string | undefined;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Check for standalone section header e.g. [section:Verse 1] or [Chorus]
    const sectionMatch = trimmed.match(/^\[(?:section:)?(intro|verse\s*\d*|chorus\s*\d*|bridge|outro|solo|hook|pre-chorus|instrumental)\]$/i);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    // Check metadata tags
    const metaMatch = trimmed.match(metaRegex);
    if (metaMatch && !trimmed.match(multiTimestampRegex)) {
      const key = metaMatch[1].toLowerCase();
      const value = metaMatch[2].trim();

      if (key === 'ti' || key === 'title') metadata.title = value;
      else if (key === 'ar' || key === 'artist') metadata.artist = value;
      else if (key === 'al' || key === 'album') metadata.album = value;
      else if (key === 'by' || key === 'author') metadata.syncedBy = value;
      else if (key === 'offset') metadata.offset = parseInt(value, 10) || 0;
      else if (key === 'length') metadata.duration = parseLrcTimecode(value);
      else if (key === 'isrc') metadata.isrc = value;
      else if (key === 'spotify') metadata.spotifyId = value;
      else if (key === 'youtube') metadata.youtubeId = value;
      else if (key === 'apple' || key === 'applemusic') metadata.appleMusicId = value;
      else if (key === 'audiohash') metadata.audioHash = value;
      else if (key === 'lang' || key === 'language') metadata.language = value;
      else if (key.startsWith('v') && /^\d+$/.test(key.slice(1))) {
        // Vocalist definition e.g. [v1:Freddie Mercury]
        if (!metadata.vocalists) metadata.vocalists = {};
        metadata.vocalists[key] = value;
      } else if (key.startsWith('singer')) {
        if (!metadata.vocalists) metadata.vocalists = {};
        metadata.vocalists[key] = value;
      }
      continue;
    }

    // Check timestamp line (single or multi-timestamp)
    const lineMatch = trimmed.match(multiTimestampRegex);
    if (lineMatch) {
      const timecodeGroup = lineMatch[1];
      let content = lineMatch[2].trim();

      // Extract all timestamps for repeated lines/choruses
      const startTimes: number[] = [];
      let match: RegExpExecArray | null;
      while ((match = singleTimestampExtractRegex.exec(timecodeGroup)) !== null) {
        startTimes.push(parseLrcTimecode(match[1]));
      }

      if (startTimes.length === 0) continue;

      // Extract line-level modifiers [section:Chorus], [v1], [bg], [lang:en]
      let lineSection = currentSection;
      let lineVocalist: string | undefined;
      let isBackground = false;
      let lineLang: string | undefined;

      // Match [section:...] inside content
      content = content.replace(/\[section:([^\]]+)\]/i, (_, sec) => {
        lineSection = sec.trim();
        return '';
      });

      // Match [v1] or [v2] vocalist modifier
      content = content.replace(/\[(v\d+)\]/i, (_, v) => {
        lineVocalist = v.toLowerCase();
        return '';
      });

      // Match [bg] or [background]
      content = content.replace(/\[(bg|background)\]/i, () => {
        isBackground = true;
        return '';
      });

      // Match [lang:en] translation tag
      content = content.replace(/\[lang:([a-z0-9_\-]+)\]/i, (_, l) => {
        lineLang = l.toLowerCase();
        return '';
      });

      content = content.trim();

      // For each timestamp instance (multiplexed lines)
      for (const startTime of startTimes) {
        const tokens: WordToken[] = [];
        let plainText = '';

        // Check if line contains word tags <...>
        if (content.includes('<') && content.includes('>')) {
          // Tokenize string with word tags: e.g. "Never <350:280>gonna <650:280>give" or "<00:10.00>Never <00:10.35>gonna"
          const tagSplitRegex = /<([^>]+)>([^<]*)/g;
          let firstPartMatch = content.match(/^([^<]+)/);

          // Handle elided first word if text appears before the first <tag>
          if (firstPartMatch && firstPartMatch[1].trim()) {
            const firstWordText = firstPartMatch[1];
            tokens.push({
              text: firstWordText,
              start: startTime,
              end: startTime + 0.5,
            });
            plainText += firstWordText;
          }

          let tagMatch: RegExpExecArray | null;
          while ((tagMatch = tagSplitRegex.exec(content)) !== null) {
            const tagStr = tagMatch[1];
            const wordText = tagMatch[2];

            const parsedTag = parseWordTag(tagStr, startTime);

            // Update previous token's end time to current token start if not explicitly set
            if (tokens.length > 0 && !tokens[tokens.length - 1].durMs) {
              tokens[tokens.length - 1].end = Math.max(tokens[tokens.length - 1].start + 0.05, parsedTag.startTime);
            }

            const tokenEnd = parsedTag.durMs
              ? parsedTag.startTime + parsedTag.durMs / 1000
              : parsedTag.startTime + 0.5;

            tokens.push({
              text: wordText,
              start: parsedTag.startTime,
              end: tokenEnd,
              durMs: parsedTag.durMs,
              emphasis: parsedTag.emphasis,
            });

            plainText += wordText;
          }

          // Adjust last token's end
          if (tokens.length > 0 && !tokens[tokens.length - 1].durMs) {
            tokens[tokens.length - 1].end = tokens[tokens.length - 1].start + 0.5;
          }
        } else {
          plainText = content;
        }

        // Calculate line end time
        let lineEnd = startTime + 3.0;
        if (tokens.length > 0) {
          const lastToken = tokens[tokens.length - 1];
          lineEnd = Math.max(lineEnd, lastToken.end);
        }

        parsedLines.push({
          id: lineId++,
          text: plainText,
          start: startTime,
          end: lineEnd,
          tokens: tokens.length > 0 ? tokens : undefined,
          vocalist: lineVocalist,
          section: lineSection,
          isBackground: isBackground || undefined,
          translations: lineLang ? { [lineLang]: plainText } : undefined,
        });
      }
    }
  }

  // Fallback for plain text lyrics without timestamp tags
  if (parsedLines.length === 0) {
    let currentTime = 0;
    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim();
      if (!trimmed || trimmed.startsWith('[')) continue;

      parsedLines.push({
        id: lineId++,
        text: trimmed,
        start: currentTime,
        end: currentTime + 3.0,
      });
      currentTime += 3.5;
    }
  }

  // Sort chronologically by start time
  parsedLines.sort((a, b) => a.start - b.start);

  // Adjust line end times to next line start if available and within reasonable window (< 8s)
  for (let i = 0; i < parsedLines.length; i++) {
    if (i < parsedLines.length - 1) {
      const nextStart = parsedLines[i + 1].start;
      if (nextStart > parsedLines[i].start && (nextStart - parsedLines[i].start) <= 8.0) {
        // If line has word tokens with explicit duration, keep tokens intact but clamp line end
        if (!parsedLines[i].tokens || parsedLines[i].tokens!.length === 0) {
          parsedLines[i].end = nextStart;
        }
      }
    }
  }

  return {
    $schema: 'https://openlyrics.dev/schema/v1.json',
    version: 1,
    metadata,
    lines:
      parsedLines.length > 0
        ? parsedLines
        : [{ id: 0, text: 'Enter lyric content...', start: 0, end: 3.0 }],
  };
}

/**
 * Exports an OpenLyricsDocument to standard, enhanced, or compact optimized LRC / OLRC format string
 */
export function exportLRC(
  doc: OpenLyricsDocument,
  optionsOrEnhanced: LrcExportOptions | boolean = false
): string {
  const options: LrcExportOptions =
    typeof optionsOrEnhanced === 'boolean'
      ? { format: optionsOrEnhanced ? 'enhanced_standard' : 'standard' }
      : optionsOrEnhanced;

  const format = options.format ?? 'standard';
  const precisionMode = options.precisionMode ?? (doc.metadata.precisionMode || false);
  const includeMetadata = options.includeMetadata ?? true;

  const result: string[] = [];
  const meta = doc.metadata;

  if (includeMetadata) {
    if (meta.title) result.push(`[ti:${meta.title}]`);
    if (meta.artist) result.push(`[ar:${meta.artist}]`);
    if (meta.album) result.push(`[al:${meta.album}]`);
    if (meta.duration > 0) result.push(`[length:${formatLrcTimecode(meta.duration, precisionMode)}]`);
    if (meta.syncedBy) result.push(`[by:${meta.syncedBy}]`);
    if (meta.offset) result.push(`[offset:${meta.offset}]`);
    if (meta.language) result.push(`[lang:${meta.language}]`);

    // Extended OLRC metadata
    if (format === 'olrc') {
      if (meta.isrc) result.push(`[isrc:${meta.isrc}]`);
      if (meta.spotifyId) result.push(`[spotify:${meta.spotifyId}]`);
      if (meta.youtubeId) result.push(`[youtube:${meta.youtubeId}]`);
      if (meta.appleMusicId) result.push(`[apple:${meta.appleMusicId}]`);
      if (meta.audioHash) result.push(`[audiohash:${meta.audioHash}]`);
      if (meta.vocalists) {
        for (const [vKey, vName] of Object.entries(meta.vocalists)) {
          result.push(`[${vKey}:${vName}]`);
        }
      }
    }
  }

  let lastSection: string | undefined;

  for (const line of doc.lines) {
    // Emit section header if changed in OLRC mode
    if (format === 'olrc' && line.section && line.section !== lastSection) {
      result.push(`[section:${line.section}]`);
      lastSection = line.section;
    }

    const lineTag = `[${formatLrcTimecode(line.start, precisionMode)}]`;
    const linePrefix: string[] = [];

    if (format === 'olrc') {
      if (line.vocalist) linePrefix.push(`[${line.vocalist}]`);
      if (line.isBackground) linePrefix.push(`[bg]`);
    }

    const prefixStr = linePrefix.join('');

    if ((format === 'enhanced_standard') && line.tokens && line.tokens.length > 0) {
      // Traditional Enhanced LRC: <01:23.45>word
      const words = line.tokens
        .map((t) => `<${formatLrcTimecode(t.start, precisionMode)}>${t.text}`)
        .join('');
      result.push(`${lineTag}${prefixStr}${words}`);
    } else if ((format === 'enhanced_compact' || format === 'olrc') && line.tokens && line.tokens.length > 0) {
      // Naturally space-optimized relative delta timestamps:
      // First word elided if starts at line start (0ms), subsequent words use <offsetMs:durMs>
      const wordStrings: string[] = [];

      for (let i = 0; i < line.tokens.length; i++) {
        const token = line.tokens[i];
        const offsetMs = Math.max(0, Math.round((token.start - line.start) * 1000));
        const durMs = token.durMs || Math.max(50, Math.round((token.end - token.start) * 1000));
        const emphasisTag = token.emphasis ? '*' : '';
        const isLast = i === line.tokens.length - 1;
        const nextToken = !isLast ? line.tokens[i + 1] : null;
        const isContiguous = nextToken ? Math.abs(token.end - nextToken.start) < 0.08 : false;

        if (i === 0 && offsetMs === 0 && !token.emphasis && (isContiguous || !token.durMs)) {
          // Elide first word tag completely when it starts at line start (0ms)
          wordStrings.push(token.text);
        } else if (!token.durMs && isContiguous) {
          // Contiguous word timing: only need offsetMs, cutting byte size in half
          wordStrings.push(`<${offsetMs}${emphasisTag}>${token.text}`);
        } else {
          // Explicit duration or final word hold
          wordStrings.push(`<${offsetMs}:${durMs}${emphasisTag}>${token.text}`);
        }
      }

      result.push(`${lineTag}${prefixStr}${wordStrings.join('')}`);
    } else {
      // Standard line-level LRC
      result.push(`${lineTag}${prefixStr}${line.text}`);
    }
  }

  return result.join('\n');
}

/**
 * Calculates byte size savings achieved by Natural Delta Optimization vs Traditional Enhanced LRC
 */
export function calculateLrcSpaceSavings(doc: OpenLyricsDocument): LrcSpaceSavingsReport {
  const encoder = new TextEncoder();
  const standardLrc = exportLRC(doc, { format: 'standard' });
  const traditionalEnhancedLrc = exportLRC(doc, { format: 'enhanced_standard' });
  const compactEnhancedLrc = exportLRC(doc, { format: 'enhanced_compact' });
  const olrc = exportLRC(doc, { format: 'olrc' });

  const standardBytes = encoder.encode(standardLrc).length;
  const tradBytes = encoder.encode(traditionalEnhancedLrc).length;
  const compactBytes = encoder.encode(compactEnhancedLrc).length;
  const olrcBytes = encoder.encode(olrc).length;

  const savedBytes = Math.max(0, tradBytes - compactBytes);
  const percentageSaved = tradBytes > 0 ? Math.round((savedBytes / tradBytes) * 100) : 0;

  return {
    standardLrcBytes: standardBytes,
    traditionalEnhancedLrcBytes: tradBytes,
    compactEnhancedLrcBytes: compactBytes,
    olrcBytes,
    savedBytes,
    percentageSaved,
  };
}
