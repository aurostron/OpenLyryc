/**
 * OpenLyryc Diff Engine
 * Computes a structured, git-diff-style diff between two OpenLyricsDocument snapshots.
 */

import { OpenLyricsDocument, LyricLine, WordToken } from '@/types/lyrics';

export type DiffChangeType = 'added' | 'removed' | 'modified';
export type DiffCategory = 'metadata' | 'line';

export interface DiffHunk {
  /** Whether this diff affects metadata or a lyric line */
  category: DiffCategory;
  /** For metadata: the field name (e.g. "title", "duration") */
  field?: string;
  /** For line diffs: 0-based index of the line in the after-document */
  lineIndex?: number;
  /** What changed about the line (e.g. "text", "start", "end", "tokens") */
  lineField?: string;
  changeType: DiffChangeType;
  /** Stringified value before the change (undefined for "added") */
  before?: string;
  /** Stringified value after the change (undefined for "removed") */
  after?: string;
}

/** Metadata fields we want to diff */
const METADATA_FIELDS: (keyof import('@/types/lyrics').LyricMetadata)[] = [
  'title',
  'artist',
  'album',
  'duration',
  'language',
  'isrc',
  'spotifyId',
  'youtubeId',
  'audioHash',
  'offset',
];

function fmt(v: unknown): string {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'number') {
    // Format durations as time strings
    return String(v);
  }
  return String(v);
}

function fmtTime(secs: number | undefined): string {
  if (secs === undefined || secs === null) return '—';
  const m = Math.floor(secs / 60);
  const s = (secs % 60).toFixed(3).padStart(6, '0');
  return `${String(m).padStart(2, '0')}:${s}`;
}

function tokensSignature(tokens?: WordToken[]): string {
  if (!tokens || tokens.length === 0) return '';
  return tokens.map((t) => `${t.text}@${t.start.toFixed(2)}-${t.end.toFixed(2)}`).join('|');
}

function diffLines(
  beforeLines: LyricLine[],
  afterLines: LyricLine[]
): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const maxLen = Math.max(beforeLines.length, afterLines.length);

  for (let i = 0; i < maxLen; i++) {
    const b = beforeLines[i];
    const a = afterLines[i];

    if (!b && a) {
      // Line was added
      hunks.push({
        category: 'line',
        lineIndex: i,
        lineField: 'text',
        changeType: 'added',
        before: undefined,
        after: a.text,
      });
      continue;
    }

    if (b && !a) {
      // Line was removed
      hunks.push({
        category: 'line',
        lineIndex: i,
        lineField: 'text',
        changeType: 'removed',
        before: b.text,
        after: undefined,
      });
      continue;
    }

    if (!b || !a) continue;

    // Text changed
    if (b.text !== a.text) {
      hunks.push({
        category: 'line',
        lineIndex: i,
        lineField: 'text',
        changeType: 'modified',
        before: b.text,
        after: a.text,
      });
    }

    // Start timestamp changed
    if (Math.abs((b.start ?? 0) - (a.start ?? 0)) > 0.001) {
      hunks.push({
        category: 'line',
        lineIndex: i,
        lineField: 'start',
        changeType: 'modified',
        before: fmtTime(b.start),
        after: fmtTime(a.start),
      });
    }

    // End timestamp changed
    if (Math.abs((b.end ?? 0) - (a.end ?? 0)) > 0.001) {
      hunks.push({
        category: 'line',
        lineIndex: i,
        lineField: 'end',
        changeType: 'modified',
        before: fmtTime(b.end),
        after: fmtTime(a.end),
      });
    }

    // Word token sync changed
    const beforeTokenSig = tokensSignature(b.tokens);
    const afterTokenSig = tokensSignature(a.tokens);
    if (beforeTokenSig !== afterTokenSig) {
      const beforeCount = b.tokens?.length ?? 0;
      const afterCount = a.tokens?.length ?? 0;
      if (beforeCount === 0 && afterCount > 0) {
        hunks.push({
          category: 'line',
          lineIndex: i,
          lineField: 'tokens',
          changeType: 'added',
          before: undefined,
          after: `${afterCount} word token${afterCount !== 1 ? 's' : ''} synced`,
        });
      } else if (beforeCount > 0 && afterCount === 0) {
        hunks.push({
          category: 'line',
          lineIndex: i,
          lineField: 'tokens',
          changeType: 'removed',
          before: `${beforeCount} word token${beforeCount !== 1 ? 's' : ''} synced`,
          after: undefined,
        });
      } else {
        hunks.push({
          category: 'line',
          lineIndex: i,
          lineField: 'tokens',
          changeType: 'modified',
          before: `${beforeCount} word tokens`,
          after: `${afterCount} word tokens`,
        });
      }
    }
  }

  return hunks;
}

/**
 * Computes a structured diff between two document snapshots.
 * Pass `null` as `before` for a brand-new (first-publish) document —
 * all content will be shown as additions.
 *
 * Returns an empty array if nothing changed.
 */
export function computeDocumentDiff(
  before: OpenLyricsDocument | null,
  after: OpenLyricsDocument
): DiffHunk[] {
  const hunks: DiffHunk[] = [];

  if (!before) {
    // First publish — show every line as an addition
    hunks.push({
      category: 'metadata',
      field: '__new__',
      changeType: 'added',
      before: undefined,
      after: `${after.metadata.title} — ${after.metadata.artist}`,
    });

    after.lines.forEach((line, i) => {
      hunks.push({
        category: 'line',
        lineIndex: i,
        lineField: 'text',
        changeType: 'added',
        before: undefined,
        after: line.text,
      });
    });

    return hunks;
  }

  // --- Metadata diff ---
  for (const field of METADATA_FIELDS) {
    const bv = before.metadata[field];
    const av = after.metadata[field];
    const bStr = fmt(bv);
    const aStr = fmt(av);

    if (bStr !== aStr) {
      // Treat duration field specially with time formatting
      const isDuration = field === 'duration';
      hunks.push({
        category: 'metadata',
        field: field as string,
        changeType: 'modified',
        before: isDuration ? fmtTime(bv as number) : bStr,
        after: isDuration ? fmtTime(av as number) : aStr,
      });
    }
  }

  // --- Lines diff ---
  const lineHunks = diffLines(before.lines ?? [], after.lines ?? []);
  hunks.push(...lineHunks);

  return hunks;
}

/** Human-readable label for a metadata field key */
export function metadataFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    title: 'Title',
    artist: 'Artist',
    album: 'Album',
    duration: 'Duration',
    language: 'Language',
    isrc: 'ISRC',
    spotifyId: 'Spotify ID',
    youtubeId: 'YouTube ID',
    audioHash: 'Audio Hash',
    offset: 'Global Offset',
    __new__: 'New Entry',
  };
  return labels[field] ?? field;
}

/**
 * Returns true if the diff represents a meaningful change worth committing.
 * Blocks trivial false commits like "changed one timestamp by 0.001s".
 *
 * Rules (any one is sufficient):
 *  - At least 1 lyric line TEXT change
 *  - At least 3 timestamp (start/end) changes (a genuine timing pass)
 *  - At least 1 metadata field change that isn't just `offset`
 *  - At least 1 token (word sync) change
 *  - New entry (first publish always passes)
 */
export function isMeaningfulChange(diff: DiffHunk[]): boolean {
  if (diff.length === 0) return false;

  // First publish — all additions, always meaningful
  if (diff.some((h) => h.field === '__new__')) return true;

  // Line text changes
  const textChanges = diff.filter(
    (h) => h.category === 'line' && h.lineField === 'text'
  ).length;
  if (textChanges >= 1) return true;

  // Token (word sync) changes
  const tokenChanges = diff.filter(
    (h) => h.category === 'line' && h.lineField === 'tokens'
  ).length;
  if (tokenChanges >= 1) return true;

  // Metadata changes (excluding offset-only tweaks)
  const meaningfulMetaChanges = diff.filter(
    (h) => h.category === 'metadata' && h.field !== 'offset' && h.field !== '__new__'
  ).length;
  if (meaningfulMetaChanges >= 1) return true;

  // Timestamp changes — require at least 3 (a genuine timing pass)
  const timestampChanges = diff.filter(
    (h) => h.category === 'line' && (h.lineField === 'start' || h.lineField === 'end')
  ).length;
  if (timestampChanges >= 3) return true;

  return false;
}

