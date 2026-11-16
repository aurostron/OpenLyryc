/**
 * Chord Sync Engine — Real-Timestamp Edition
 *
 * Builds a chord timeline from real LyricLine timestamps (fetched from
 * lrc.red / binimum / musixmatch / lrclib) + manual ChordAnnotation[] from chordsData.
 *
 * No estimation. No BPM-derived line durations. The Apple Music sync timestamps
 * from the resolver ARE the ground truth — intro offset, line length, everything.
 *
 * Fallback: if no live lyrics are available, uses BPM-derived estimation with
 * configurable introOffset (legacy path, only used when resolver returns null).
 */

import { LyricLine } from '@/types/lyrics';
import { ChordAnnotation } from '@/lib/data/chordsData';

// ─── Shared Output Type ────────────────────────────────────────────────────────

export interface SyncedChordFrame {
  startTime: number;
  endTime: number;
  chord: string;
  nextChord: string | null;
  prevChord: string | null;
  lineIndex: number;
}

// ─── Primary Path: Real LyricLine Timestamps ─────────────────────────────────

/**
 * Builds a beat-accurate chord timeline from real resolved LyricLine timestamps.
 *
 * Each ChordAnnotation maps to a resolved line. The chord plays from
 * `line.start + beatOffset * lineDuration` to the next annotation's start time.
 * Minimum hold: 1 full bar (barDuration = beatsPerBar * secondsPerBeat).
 */
export function buildChordTimelineFromLyricLines(
  resolvedLines: LyricLine[],
  annotations: ChordAnnotation[],
  bpm: number,
  timeSignature: [number, number]
): SyncedChordFrame[] {
  if (!resolvedLines || resolvedLines.length === 0) return [];
  if (!annotations || annotations.length === 0) return [];

  const secondsPerBeat = 60 / bpm;
  const barDuration = secondsPerBeat * timeSignature[0];

  const normalize = (s: string) => (s || '').toLowerCase().replace(/[\p{P}\p{Z}\p{S}]+/gu, '');

  // Pre-compute the precise start time and matched line index for every annotation
  const resolvedAnnotations = annotations.map((ann) => {
    let lineIdx = ann.lineIndex;
    const offset = ann.beatOffset ?? 0;

    // If a lyric cue is specified, find the line matching the cue text
    if (ann.lyricCue) {
      const cueNorm = normalize(ann.lyricCue);
      const matchIdx = resolvedLines.findIndex((l) => normalize(l.text).includes(cueNorm));
      if (matchIdx !== -1) {
        lineIdx = matchIdx;
      }
    }

    const line = resolvedLines[lineIdx];
    if (!line) return { time: -1, lineIdx };
    const lineDuration = Math.max(0, (line.end ?? 0) - line.start);

    // If this line has word-level tokens, anchor to the actual word timestamp
    if (line.tokens && line.tokens.length > 0) {
      if (ann.lyricCue) {
        const cueNorm = normalize(ann.lyricCue);
        const tIdx = line.tokens.findIndex((t) => {
          const tNorm = normalize(t.text);
          return tNorm.includes(cueNorm) || cueNorm.includes(tNorm);
        });
        if (tIdx !== -1 && line.tokens[tIdx]?.start !== undefined) {
          return { time: line.tokens[tIdx].start, lineIdx };
        }
      }

      if (offset > 0) {
        const tokenIdx = Math.round(offset * (line.tokens.length - 1));
        const token = line.tokens[Math.min(tokenIdx, line.tokens.length - 1)];
        if (token?.start !== undefined) {
          return { time: token.start, lineIdx };
        }
      }
    }

    return { time: line.start + offset * lineDuration, lineIdx };
  });

  const frames: SyncedChordFrame[] = [];

  for (let i = 0; i < annotations.length; i++) {
    const ann = annotations[i];
    const item = resolvedAnnotations[i];
    const startTime = item.time;

    if (startTime < 0) continue; // Line index out of range, skip

    // End time: the next valid annotation's start, or the line's own end
    let endTime: number;
    const nextValidIdx = annotations.slice(i + 1).findIndex((_, j) => resolvedAnnotations[i + 1 + j].time >= 0);
    if (nextValidIdx !== -1) {
      endTime = resolvedAnnotations[i + 1 + nextValidIdx].time;
    } else {
      // Last annotation: hold to end of its line (or 4s past start)
      const line = resolvedLines[item.lineIdx];
      endTime = line?.end ?? startTime + 4;
    }

    // Enforce minimum 1-bar hold
    endTime = Math.max(endTime, startTime + barDuration);

    const prevChord = frames.length > 0 ? frames[frames.length - 1].chord : null;
    const nextAnn = annotations.slice(i + 1).find((_, j) => resolvedAnnotations[i + 1 + j].time >= 0);

    frames.push({
      startTime: Math.round(startTime * 1000) / 1000,
      endTime: Math.round(endTime * 1000) / 1000,
      chord: ann.chord,
      nextChord: nextAnn?.chord ?? null,
      prevChord,
      lineIndex: item.lineIdx,
    });
  }

  return frames;
}

// ─── Active Frame Lookup ───────────────────────────────────────────────────────

/**
 * Given currentTime during playback, returns the active SyncedChordFrame.
 * Includes 1-bar lookahead in nextChord so guitarists see the upcoming chord early.
 */
export function getActiveChordFrame(
  frames: SyncedChordFrame[],
  currentTime: number
): SyncedChordFrame | null {
  if (!frames || frames.length === 0) return null;

  // Before anything starts — return first frame
  if (currentTime < frames[0].startTime) return frames[0];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const isLast = i === frames.length - 1;

    if (currentTime >= frame.startTime && (isLast || currentTime < frames[i + 1].startTime)) {
      return frame;
    }
  }

  return frames[frames.length - 1];
}

// ─── Active Lyric Line Lookup ─────────────────────────────────────────────────

/**
 * Returns the index of the currently active LyricLine for a given currentTime.
 * Uses line.start / line.end from resolved lyrics (real timestamps).
 */
export function getActiveLineIndex(
  resolvedLines: LyricLine[],
  currentTime: number
): number {
  if (!resolvedLines || resolvedLines.length === 0) return 0;

  // Before first line
  if (currentTime < resolvedLines[0].start) return 0;

  for (let i = 0; i < resolvedLines.length; i++) {
    const line = resolvedLines[i];
    const next = resolvedLines[i + 1];
    const lineEnd = next ? next.start : (line.end ?? line.start + 5);
    if (currentTime >= line.start && currentTime < lineEnd) {
      return i;
    }
  }

  return resolvedLines.length - 1;
}

// ─── Fallback Path: BPM-Estimated Timeline ────────────────────────────────────
// Used only when no live lyrics are found.

export interface SongBpmConfig {
  bpm: number;
  timeSignature: [number, number];
  introOffset?: number;
}

/**
 * Fallback BPM-estimation path.
 * Each non-empty annotation line gets 2 bars of time from introOffset.
 * This is only used when resolveTrackLyrics() returns null.
 */
export function buildFallbackChordTimeline(
  annotations: ChordAnnotation[],
  bpmConfig: SongBpmConfig,
  totalLines: number
): SyncedChordFrame[] {
  if (!annotations || annotations.length === 0) return [];

  const secondsPerBeat = 60 / bpmConfig.bpm;
  const barDuration = secondsPerBeat * bpmConfig.timeSignature[0];
  const barsPerLine = 2;
  const lineDuration = barDuration * barsPerLine;
  const introOffset = bpmConfig.introOffset ?? 0;

  // Build a map of lineIndex → absolute startTime
  const lineStartTimes: Map<number, number> = new Map();
  let t = introOffset;
  for (let i = 0; i < totalLines; i++) {
    lineStartTimes.set(i, t);
    t += lineDuration;
  }

  const annotationTimes = annotations.map((ann) => {
    const lineStart = lineStartTimes.get(ann.lineIndex) ?? 0;
    const offset = ann.beatOffset ?? 0;
    return lineStart + offset * lineDuration;
  });

  const frames: SyncedChordFrame[] = [];

  for (let i = 0; i < annotations.length; i++) {
    const ann = annotations[i];
    const startTime = annotationTimes[i];
    const nextStart = i < annotations.length - 1 ? annotationTimes[i + 1] : startTime + lineDuration;
    const endTime = Math.max(nextStart, startTime + barDuration);

    frames.push({
      startTime: Math.round(startTime * 1000) / 1000,
      endTime: Math.round(endTime * 1000) / 1000,
      chord: ann.chord,
      nextChord: annotations[i + 1]?.chord ?? null,
      prevChord: i > 0 ? annotations[i - 1].chord : null,
      lineIndex: ann.lineIndex,
    });
  }

  return frames;
}
