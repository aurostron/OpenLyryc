import { LyricLine, WordToken } from './lyrics';

/**
 * OpenLyryc Tap Sync Protocol Messages
 * Ultra-low latency P2P communication between Studio (PC) and Mobile Companion.
 */
export type TapSyncMessage =
  | {
      type: 'SESSION_INIT';
      payload: {
        title: string;
        artist: string;
        duration: number;
        lines: LyricLine[];
        currentLineIndex: number;
        isPlaying: boolean;
        currentTime: number;
      };
    }
  | {
      type: 'CLOCK_UPDATE';
      payload: {
        currentTime: number;
        isPlaying: boolean;
      };
    }
  | {
      type: 'TAP_WORD';
      payload: {
        lineIndex: number;
        tokenIndex: number;
        timestamp: number;
      };
    }
  | {
      type: 'COMPLETE_LINE';
      payload: {
        lineIndex: number;
        endTime: number;
      };
    }
  | {
      type: 'UNDO_TOKEN';
      payload: {
        lineIndex: number;
        tokenIndex: number;
      };
    }
  | {
      type: 'JUMP_LINE';
      payload: {
        lineIndex: number;
      };
    }
  | {
      type: 'TOGGLE_PLAY';
      payload: {
        play: boolean;
      };
    }
  | {
      type: 'SYNCED_DOC_UPDATE';
      payload: {
        lines: LyricLine[];
        currentLineIndex: number;
      };
    };

/**
 * Generates an easy-to-type, memorable 4-character room code for quick mobile pairing.
 */
export function generateTapSyncRoomId(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous chars like 0, 1, I, O
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Splits raw plain text lyrics into structured sentence lines and word tokens.
 * Automatically handles section headings, multiple line breaks, and punctuation.
 */
export function splitPlainTextToTapLines(rawText: string): LyricLine[] {
  if (!rawText || !rawText.trim()) return [];

  const rawLines = rawText.split(/\r?\n/);
  const result: LyricLine[] = [];
  let currentSection: string | undefined = undefined;
  let lineCounter = 0;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Check for structural section tag: e.g. [Chorus], [Verse 1], [Bridge], [Intro]
    const sectionMatch = trimmed.match(/^\[([a-zA-Z0-9_\-\s]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    // Tokenize sentence into individual words/syllables
    // Supports hyphens as explicit syllable separators if user provided them (e.g. "hel-lo")
    const words = trimmed.split(/\s+/).filter(Boolean);
    const tokens: WordToken[] = [];

    for (const w of words) {
      if (w.includes('-') && w.length > 2) {
        // Hyphenated word split into syllables while keeping trailing hyphen for context
        const subParts = w.split('-');
        for (let i = 0; i < subParts.length; i++) {
          const part = subParts[i];
          if (!part) continue;
          tokens.push({
            text: i < subParts.length - 1 ? `${part}-` : part,
            start: 0,
            end: 0,
          });
        }
      } else {
        tokens.push({
          text: w,
          start: 0,
          end: 0,
        });
      }
    }

    result.push({
      id: lineCounter++,
      text: trimmed,
      section: currentSection,
      start: 0,
      end: 0,
      tokens: tokens.length > 0 ? tokens : undefined,
    });
  }

  return result;
}

/**
 * Intelligent Syllable & Word Duration Interpolation Engine
 * 
 * Takes recorded tap timestamps and calculates smooth, natural vocal release curves.
 * Prevents mechanical "brick-wall" jumping and blends transitions so karaoke wipes
 * glide like liquid light without jarring steps.
 */
/**
 * Enforces monotonic, non-overlapping word boundaries after a tap or manual stamp.
 * Stamped tokens (start > 0) cascade forward so a fast burst of taps (or tapping
 * a word out of order, or re-stamping) can never leave overlapping timestamps.
 * Unsynced tokens (0/0) are left untouched; stamped tokens clamp into the
 * [lineStart, lineEnd] bounds when provided.
 */
export function normalizeTapTokens(
  tokens: WordToken[],
  lineStart?: number,
  lineEnd?: number
): WordToken[] {
  if (!tokens || tokens.length === 0) return tokens ? [...tokens] : [];
  const result = tokens.map((t) => ({ ...t }));
  const EPS = 0.001;

  // Forward cascade: every stamped token starts strictly after the previous one
  for (let i = 1; i < result.length; i++) {
    const prev = result[i - 1];
    const cur = result[i];
    if (cur.start > 0 && prev.start > 0 && cur.start < prev.start + EPS) {
      cur.start = Number((prev.start + EPS).toFixed(3));
    }
  }

  // Clamp stamped tokens into the line bounds (never before the line starts or after it ends)
  const lo = typeof lineStart === 'number' && lineStart > 0 ? lineStart : 0;
  const hi = typeof lineEnd === 'number' && lineEnd > 0 ? lineEnd : Number.POSITIVE_INFINITY;
  for (const t of result) {
    if (t.start > 0) {
      t.start = Number(Math.min(Math.max(t.start, lo), hi).toFixed(3));
    }
  }

  // Tighten ends so they never overlap the next stamped word and never precede their own start
  for (let i = 0; i < result.length; i++) {
    const cur = result[i];
    if (cur.start <= 0) continue;
    const next = i < result.length - 1 ? result[i + 1] : null;
    const ceiling = next && next.start > 0
      ? next.start
      : hi !== Number.POSITIVE_INFINITY
        ? hi
        : cur.start + 1.2;
    let end = cur.end;
    if (!(end > cur.start)) end = cur.start + 0.05;
    if (end > ceiling) end = ceiling;
    if (end <= cur.start) end = cur.start + 0.05;
    cur.end = Number(end.toFixed(3));
  }

  return result;
}

export function interpolateWordTokens(
  tokens: WordToken[],
  lineStart: number,
  lineEnd: number
): WordToken[] {
  if (!tokens || tokens.length === 0) return [];
  const result: WordToken[] = tokens.map((t) => ({ ...t }));

  for (let i = 0; i < result.length; i++) {
    const cur = result[i];
    const next = i < result.length - 1 ? result[i + 1] : null;

    if (cur.start > 0) {
      if (next && next.start > cur.start) {
        const rawDelta = next.start - cur.start;
        // Acoustic breath cushion & decay curve:
        // Fast syllables (<0.32s): tight 95% hold
        // Medium words (0.32s - 1.1s): natural release cushion (rawDelta - 0.05s)
        // Long pauses (>1.2s): ease off naturally so vocal doesn't awkwardly hold across instrumental gap
        let holdDuration: number;
        if (rawDelta <= 0.32) {
          holdDuration = rawDelta * 0.95;
        } else if (rawDelta <= 1.1) {
          holdDuration = Math.max(0.12, rawDelta - 0.05);
        } else {
          // Natural singing decay curve for held words before a break
          holdDuration = Math.min(rawDelta * 0.72, 1.25);
        }

        cur.end = Number((cur.start + holdDuration).toFixed(3));
      } else if (!next) {
        // Final word in the sentence
        const targetEnd = lineEnd > cur.start ? lineEnd : cur.start + 0.65;
        const rawDelta = Math.max(0.2, targetEnd - cur.start);
        const holdDuration = Math.min(rawDelta * 0.88, 1.4);
        cur.end = Number((cur.start + holdDuration).toFixed(3));
      }
    }
  }

  return result;
}

/**
 * Smoothstep / Cubic-Bezier progress interpolation helper for renderers
 * Provides silky Apple-Music style liquid light wipe between words.
 */
export function calculateLiquidProgress(
  currentTime: number,
  start: number,
  end: number
): number {
  if (currentTime <= start) return 0;
  if (currentTime >= end) return 1;
  const rawProgress = (currentTime - start) / Math.max(0.01, end - start);
  // Cubic ease-out curve: 1 - (1 - x)^3
  const t = 1 - rawProgress;
  return 1 - t * t * t;
}
