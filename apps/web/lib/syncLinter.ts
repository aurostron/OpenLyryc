import { OpenLyricsDocument, WordToken, LyricLine } from '@/types/lyrics';

export type LintSeverity = 'error' | 'warn';

export interface LintIssue {
  lineIndex: number;
  type: 'overlap' | 'zero-duration' | 'long-hold' | 'token-out-of-bounds' | 'untimed';
  severity: LintSeverity;
  message: string;
}

/**
 * Pure function to audit lyrics sync health and detect timing collisions,
 * gaps, inverted boundaries, or un-synchronized lines.
 */
export function lintDocument(doc: OpenLyricsDocument): LintIssue[] {
  const issues: LintIssue[] = [];
  const lines = doc.lines;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Untimed line (default 0.00s / 0.00s when other lines have timestamps)
    if (line.start === 0 && line.end === 0 && lines.length > 1 && i > 0) {
      issues.push({
        lineIndex: i,
        type: 'untimed',
        severity: 'warn',
        message: `Line ${i + 1}: Not yet timed`,
      });
      continue;
    }

    // Zero or negative duration
    if (line.end <= line.start) {
      issues.push({
        lineIndex: i,
        type: 'zero-duration',
        severity: 'error',
        message: `Line ${i + 1}: End time must be after start time (${line.end.toFixed(2)}s ≤ ${line.start.toFixed(2)}s)`,
      });
    }

    // Overlaps with next line
    if (i < lines.length - 1 && lines[i + 1].start > 0) {
      const nextStart = lines[i + 1].start;
      if (nextStart < line.end - 0.05) {
        const overlapSec = line.end - nextStart;
        issues.push({
          lineIndex: i,
          type: 'overlap',
          severity: 'warn',
          message: `Line ${i + 1}: Overlaps line ${i + 2} by ${overlapSec.toFixed(2)}s`,
        });
      }
    }

    // Unusually long hold (>14s, without wave emphasis)
    if (line.end - line.start > 14 && !line.emphasis) {
      issues.push({
        lineIndex: i,
        type: 'long-hold',
        severity: 'warn',
        message: `Line ${i + 1}: Duration (${(line.end - line.start).toFixed(1)}s) seems unusually long`,
      });
    }

    // Token out of line bounds
    if (line.tokens && line.tokens.length > 0) {
      const lastTok = line.tokens[line.tokens.length - 1];
      if (lastTok.end > line.end + 0.15) {
        issues.push({
          lineIndex: i,
          type: 'token-out-of-bounds',
          severity: 'warn',
          message: `Line ${i + 1}: Last word token ends after line end time`,
        });
      }
    }
  }

  return issues;
}

/**
 * Rescales or clamps an array of word tokens to fit cleanly within [lineStart, lineEnd],
 * preserving relative word durations while ensuring valid contiguous order.
 */
export function fitTokensInLine(
  tokens: WordToken[],
  lineStart: number,
  lineEnd: number
): WordToken[] {
  if (!tokens || tokens.length === 0) return [];
  if (lineEnd <= lineStart) {
    lineEnd = lineStart + 0.5;
  }

  const roundedStart = Number(lineStart.toFixed(3));
  const roundedEnd = Number(lineEnd.toFixed(3));
  const targetDuration = Math.max(0.1, roundedEnd - roundedStart);

  // Measure original tokens span
  const origFirstStart = tokens[0].start;
  const origLastEnd = tokens[tokens.length - 1].end;
  const origSpan = Math.max(0.05, origLastEnd - origFirstStart);

  // If already completely contained within [roundedStart, roundedEnd], do minor sequential clamp
  if (origFirstStart >= roundedStart && origLastEnd <= roundedEnd) {
    return tokens.map((t) => {
      const s = Math.max(roundedStart, Number(t.start.toFixed(3)));
      const e = Math.min(roundedEnd, Number(t.end.toFixed(3)));
      return {
        ...t,
        start: s,
        end: Math.max(s + 0.05, e),
      };
    });
  }

  // Proportionally scale tokens into the target line window
  const ratio = targetDuration / origSpan;
  const newTokens: WordToken[] = tokens.map((t) => {
    const s = Number((roundedStart + (t.start - origFirstStart) * ratio).toFixed(3));
    const e = Number((roundedStart + (t.end - origFirstStart) * ratio).toFixed(3));
    return {
      ...t,
      start: Math.max(roundedStart, s),
      end: Math.min(roundedEnd, Math.max(s + 0.05, e)),
    };
  });

  // Guarantee first token starts at line start and last token ends at line end
  if (newTokens.length > 0) {
    newTokens[0].start = roundedStart;
    newTokens[newTokens.length - 1].end = roundedEnd;

    // Fix any overlap between adjacent tokens
    for (let t = 0; t < newTokens.length - 1; t++) {
      if (newTokens[t].end > newTokens[t + 1].start) {
        newTokens[t].end = newTokens[t + 1].start;
      }
      if (newTokens[t].end <= newTokens[t].start) {
        newTokens[t].end = Number((newTokens[t].start + 0.05).toFixed(3));
      }
    }
  }

  return newTokens;
}

/**
 * Resolves a single LintIssue cleanly on a specific line.
 */
export function autoFixSingleIssue(
  doc: OpenLyricsDocument,
  issue: LintIssue
): OpenLyricsDocument {
  const newLines: LyricLine[] = doc.lines.map((l) => ({
    ...l,
    tokens: l.tokens ? l.tokens.map((t) => ({ ...t })) : undefined,
  }));

  const idx = issue.lineIndex;
  if (idx < 0 || idx >= newLines.length) return doc;

  const cur = newLines[idx];
  const next = idx < newLines.length - 1 ? newLines[idx + 1] : null;
  const prev = idx > 0 ? newLines[idx - 1] : null;

  switch (issue.type) {
    case 'overlap': {
      if (next && next.start > 0) {
        if (cur.start + 0.1 <= next.start) {
          cur.end = Number(next.start.toFixed(3));
        } else {
          // Inverted or identical timing: shift next line start
          cur.end = Number((cur.start + 1.5).toFixed(3));
          next.start = Number((cur.end + 0.05).toFixed(3));
          if (next.end <= next.start) {
            next.end = Number((next.start + 2.0).toFixed(3));
          }
          if (next.tokens && next.tokens.length > 0) {
            next.tokens = fitTokensInLine(next.tokens, next.start, next.end);
          }
        }
        if (cur.tokens && cur.tokens.length > 0) {
          cur.tokens = fitTokensInLine(cur.tokens, cur.start, cur.end);
        }
      }
      break;
    }

    case 'token-out-of-bounds': {
      if (cur.tokens && cur.tokens.length > 0) {
        const lastTok = cur.tokens[cur.tokens.length - 1];
        // If room before next line, extend line end to fit the token
        if (!next || next.start <= 0 || lastTok.end <= next.start) {
          cur.end = Number(lastTok.end.toFixed(3));
        } else {
          // Otherwise clamp line end to next start and compress tokens
          cur.end = Number(next.start.toFixed(3));
          cur.tokens = fitTokensInLine(cur.tokens, cur.start, cur.end);
        }
        // Also ensure first token doesn't precede line start
        const firstTok = cur.tokens[0];
        if (firstTok.start < cur.start) {
          if (!prev || prev.end <= firstTok.start) {
            cur.start = Number(firstTok.start.toFixed(3));
          } else {
            cur.tokens = fitTokensInLine(cur.tokens, cur.start, cur.end);
          }
        }
      }
      break;
    }

    case 'zero-duration': {
      const maxEnd = next && next.start > cur.start ? next.start : cur.start + 2.0;
      cur.end = Number(Math.max(cur.start + 0.2, maxEnd).toFixed(3));
      if (cur.tokens && cur.tokens.length > 0) {
        cur.tokens = fitTokensInLine(cur.tokens, cur.start, cur.end);
      }
      break;
    }

    case 'untimed': {
      if (prev && prev.end > 0) {
        cur.start = Number((prev.end + 0.1).toFixed(3));
        cur.end = Number((cur.start + 2.0).toFixed(3));
      } else {
        cur.start = Number((idx * 2.5).toFixed(3));
        cur.end = Number((cur.start + 2.0).toFixed(3));
      }
      break;
    }

    case 'long-hold': {
      cur.emphasis = true;
      break;
    }
  }

  return {
    ...doc,
    lines: newLines,
  };
}

/**
 * Comprehensively auto-fixes all issues in the document:
 * 1. Sequential untimed & zero-duration fixes
 * 2. Overlap removals & micro-gap snapping
 * 3. Word token boundary containment & scaling
 */
export function autoFixAllIssues(doc: OpenLyricsDocument): OpenLyricsDocument {
  if (!doc.lines || doc.lines.length === 0) return doc;

  const newLines: LyricLine[] = doc.lines.map((l) => ({
    ...l,
    tokens: l.tokens ? l.tokens.map((t) => ({ ...t })) : undefined,
  }));

  for (let pass = 0; pass < 2; pass++) {
    // Pass 1: Untimed & zero-duration
    for (let i = 0; i < newLines.length; i++) {
      const cur = newLines[i];
      const prev = i > 0 ? newLines[i - 1] : null;

      if (cur.start === 0 && cur.end === 0 && newLines.length > 1 && i > 0) {
        cur.start = prev && prev.end > 0 ? Number((prev.end + 0.1).toFixed(3)) : Number((i * 2.5).toFixed(3));
        cur.end = Number((cur.start + 2.0).toFixed(3));
      }

      if (cur.end <= cur.start) {
        cur.end = Number((cur.start + 2.0).toFixed(3));
      }
    }

    // Pass 2: Overlaps and micro-gaps
    for (let i = 0; i < newLines.length - 1; i++) {
      const cur = newLines[i];
      const next = newLines[i + 1];

      if (next.start <= 0) continue;

      const gap = next.start - cur.end;

      // Fix small micro-gaps (0 to 200ms)
      if (gap > 0 && gap < 0.2) {
        cur.end = Number(next.start.toFixed(3));
      }

      // Fix overlap
      if (cur.end > next.start) {
        if (cur.start + 0.1 <= next.start) {
          cur.end = Number(next.start.toFixed(3));
        } else {
          cur.end = Number((cur.start + 1.5).toFixed(3));
          next.start = Number((cur.end + 0.05).toFixed(3));
          if (next.end <= next.start) {
            next.end = Number((next.start + 2.0).toFixed(3));
          }
        }
      }
    }

    // Pass 3: Token containment within line boundaries
    for (let i = 0; i < newLines.length; i++) {
      const line = newLines[i];
      const next = i < newLines.length - 1 ? newLines[i + 1] : null;

      if (line.tokens && line.tokens.length > 0) {
        const lastTok = line.tokens[line.tokens.length - 1];
        if (lastTok.end > line.end) {
          // Can we extend line.end?
          if (!next || next.start <= 0 || lastTok.end <= next.start) {
            line.end = Number(lastTok.end.toFixed(3));
          } else {
            line.tokens = fitTokensInLine(line.tokens, line.start, line.end);
          }
        }

        const firstTok = line.tokens[0];
        if (firstTok.start < line.start) {
          line.tokens = fitTokensInLine(line.tokens, line.start, line.end);
        }

        // Always ensure internal contiguous consistency
        line.tokens = fitTokensInLine(line.tokens, line.start, line.end);
      }
    }

    // Check if issues remain
    const remaining = lintDocument({ ...doc, lines: newLines });
    if (remaining.length === 0) break;
  }

  return {
    ...doc,
    lines: newLines,
  };
}

/**
 * Backward compatibility alias for autoFixAllIssues.
 */
export const autoFixGaps = autoFixAllIssues;
