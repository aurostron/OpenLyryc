import type { OpenLyricsDocument } from '@/types/lyrics';
import { exportTTML } from '../ttmlSerializer';
import { exportLRC } from '../lrcParser';

export interface UnisonValidationResult {
  ok: boolean;
  format: 'ttml' | 'lrc';
  syncType: 'richsync' | 'linesync' | 'plain';
  errors: string[];
  warnings: string[];
  stats: {
    lineCount: number;
    wordCount: number;
    wordSyncRatio: number;
    duration: number;
  };
}

const INTER_SPAN_NEWLINE_REGEX = /<\/span>\s*[\r\n]\s*<span\b/i;
const SPAN_TRAILING_WS_REGEX = /<span\b[^>]*>[^<]*?\S[ \t]+<\/span>\s*<span\b/i;
const SPAN_LEADING_WS_REGEX = /<\/span>\s*<span\b[^>]*>[ \t]+\S[^<]*<\/span>/i;
const LRC_WORD_TAG = /<\d{1,2}:\d{2}[.:]\d{2,3}>/;
const LRC_LINE_TAG = /\[\d{1,2}:\d{2}[.:]\d{2,3}\]/;

/**
 * Validates a TTML string against Unison's strict server-side validation criteria.
 */
export function validateTtmlContent(ttml: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!ttml.includes('<tt') || !ttml.includes('</tt>')) {
    issues.push('Missing <tt> root tag or closing </tt> tag.');
  }

  if (ttml.includes('```')) {
    issues.push('Content contains Markdown code fences (```).');
  }

  if (INTER_SPAN_NEWLINE_REGEX.test(ttml)) {
    issues.push(
      'TTML has line breaks between word tags (inter-span-newline), which causes timing desync in Better Lyrics.'
    );
  }

  if (SPAN_TRAILING_WS_REGEX.test(ttml)) {
    issues.push('Some words have trailing whitespace inside <span> tags.');
  }

  if (SPAN_LEADING_WS_REGEX.test(ttml)) {
    issues.push('Some words have leading whitespace inside <span> tags.');
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

/**
 * Validates an entire OpenLyricsDocument for Unison export/submission.
 */
export function validateDocumentForUnison(doc: OpenLyricsDocument): UnisonValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Metadata Checks
  if (!doc.metadata.title?.trim()) {
    errors.push('Song title is required.');
  }
  if (!doc.metadata.artist?.trim()) {
    errors.push('Artist name is required.');
  }
  if (!doc.metadata.duration || doc.metadata.duration <= 0) {
    warnings.push('Duration is not set. Unison uses duration to match lyrics to audio tracks.');
  }

  // 2. Lyrics Content Checks
  if (!doc.lines || doc.lines.length === 0) {
    errors.push('Lyric document has no lines.');
  }

  let totalWords = 0;
  let zeroDurationWords = 0;
  let linesWithTokens = 0;

  for (const line of doc.lines) {
    if (line.tokens && line.tokens.length > 0) {
      linesWithTokens++;
      for (const token of line.tokens) {
        if (token.text && /[\p{L}\p{N}]/u.test(token.text)) {
          totalWords++;
          if (token.end <= token.start) {
            zeroDurationWords++;
          }
        }
      }
    }
  }

  if (totalWords > 0 && zeroDurationWords / totalWords > 0.2) {
    errors.push(
      `Over 20% of words have zero duration (${zeroDurationWords}/${totalWords}). Words must have valid start and end times.`
    );
  }

  // 3. TTML Serialization Check
  const ttml = exportTTML(doc);
  const ttmlValidation = validateTtmlContent(ttml);
  if (!ttmlValidation.ok) {
    errors.push(...ttmlValidation.issues);
  }

  // Determine sync type
  let syncType: 'richsync' | 'linesync' | 'plain' = 'plain';
  if (totalWords > 0 && linesWithTokens > 0) {
    syncType = 'richsync';
  } else if (doc.lines.some((l) => l.start > 0 || l.end > 0)) {
    syncType = 'linesync';
  }

  return {
    ok: errors.length === 0,
    format: 'ttml',
    syncType,
    errors,
    warnings,
    stats: {
      lineCount: doc.lines.length,
      wordCount: totalWords,
      wordSyncRatio: doc.lines.length > 0 ? linesWithTokens / doc.lines.length : 0,
      duration: doc.metadata.duration || 0,
    },
  };
}
