'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SolidMusicNote } from './SolidMusicNote';
import { LyricLine } from '@/types/lyrics';
import { getLineSequentialWords, ParsedWord, isComplexScript } from './LyricRenderer';
import { fetchArtworkUrl } from '@/lib/artworkFetcher';
import { buildStageFontStack, stageFontWeightValue, ensureStageFontLoaded } from '@/lib/stageFonts';

export type TransitionMode = 'pivot' | 'cube' | 'whip' | 'peak';

export interface KineticPosterRendererProps {
  lines: LyricLine[];
  currentTime: number;
  onSeek?: (time: number) => void;
  transitionMode?: TransitionMode;
  kenBurns?: boolean;
  trackTitle?: string;
  artistName?: string;
  isPlaying?: boolean;
  coverArt?: string;
  stageFontFamily?: string;
  stageFontWeight?: string;
}

/**
 * KINETIC POSTER RENDERER — dedicated full-bleed typographic stage.
 *
 * Design constraints that shaped this implementation:
 * - The previous "measure then shrink-to-fit" loop could misfire (hidden stage,
 *   zero-size layout) and park text at the floor permanently. This renderer
 *   performs ZERO DOM measurement, so that failure class cannot occur.
 * - Sizing is pure CSS: the stage declares `container-type: size`, every row
 *   sets `font-size: calc(92cqh / rowCount)`, and `text-align-last: justify`
 *   stretches each row edge-to-edge with no distortion (unlike textLength).
 * - Visibility is pure `currentTime >= word.start` state — seeks resolve
 *   correctly both directions with no remount tricks.
 */

/** Order-preserving balanced partition of words into `rowCount` rows. */
export function packWordsIntoRows(words: ParsedWord[], rowCount: number): ParsedWord[][] {
  const n = words.length;
  if (n === 0) return [];
  const k = Math.max(1, Math.min(rowCount, n));
  const lens = words.map((w) => w.text.length + 1); // +1 for the space it carries
  const total = lens.reduce((a, b) => a + b, 0);
  const rows: ParsedWord[][] = [];
  let start = 0;
  let consumed = 0;
  for (let r = 0; r < k; r++) {
    if (r === k - 1) {
      rows.push(words.slice(start));
      break;
    }
    const goal = (total * (r + 1)) / k;
    let end = start;
    // Reserve at least one word per remaining row.
    while (end < n - (k - r - 1) && consumed + lens[end] < goal) {
      consumed += lens[end];
      end++;
    }
    // Include the boundary word if it's closer to the goal (same reservation).
    if (end < n && end > start && end + 1 <= n - (k - r - 1)) {
      const before = Math.abs(consumed - goal);
      const after = Math.abs(consumed + lens[end] - goal);
      if (after < before) {
        consumed += lens[end];
        end++;
      }
    }
    if (end === start) {
      consumed += lens[start];
      end = start + 1;
    }
    rows.push(words.slice(start, end));
    start = end;
  }
  return rows;
}

/** Row budget from total characters — short lines go monumental, long lines wrap. */
export function rowCountForChars(totalChars: number): number {
  if (totalChars <= 8) return 1;
  if (totalChars <= 20) return 2;
  if (totalChars <= 38) return 3;
  return 4;
}

// Average glyph advances in em:
// - Latin condensed (League Gothic): ~0.44em in normal case + word spacing
// - Complex scripts (Gurmukhi, Devanagari, Arabic, CJK): ~0.88em
export const GLYPH_ADVANCE_EM_LATIN = 0.44;
export const GLYPH_ADVANCE_EM_COMPLEX = 0.88;
export const GLYPH_ADVANCE_EM = GLYPH_ADVANCE_EM_LATIN;

export const POSTER_FONT_LATIN = "'League Gothic', 'Arial Narrow', sans-serif";
export const POSTER_FONT_COMPLEX =
  "'Noto Sans Gurmukhi', 'Noto Sans Devanagari', 'Noto Sans Bengali', 'Noto Sans Arabic', 'Noto Sans Tamil', 'Noto Sans Telugu', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Nirmala UI', system-ui, -apple-system, sans-serif";

/**
 * Vertical-priority row optimizer: picks the row count (1..4) that MAXIMIZES
 * rendered size by balancing the height budget (76cqh/r) against the width
 * budget (82cqw/(glyphEm*longestRow)) at the real stage aspect.
 * Pure arithmetic on word packs — zero DOM measurement.
 */
export function rowCountForBalance(
  words: ParsedWord[],
  aspect: number,
  glyphEm: number
): number {
  const n = Math.max(1, Math.min(4, words.length));
  let best = 1;
  let bestSize = -1;
  for (let r = 1; r <= n; r++) {
    const candidateRows = packWordsIntoRows(words, r);
    const longest = Math.max(
      3,
      candidateRows.reduce(
        (m, row) => Math.max(m, row.reduce((a, w) => a + w.text.length + 1, 0)),
        1
      )
    );
    const size = Math.min(76 / r, (82 * aspect) / (glyphEm * longest));
    if (size > bestSize + 1e-3) {
      bestSize = size;
      best = r;
    }
  }
  return best;
}

/**
 * Live stage aspect (w/h) via ResizeObserver. SSR-safe (16/9 until mount),
 * converges (0.02 hysteresis), and only tracks box geometry — never text —
 * so it cannot misfire the way text measurement did.
 */
export function useStageAspect(ref: React.RefObject<HTMLDivElement | null>): number {
  const [aspect, setAspect] = useState(16 / 9);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 50 || h < 50) return;
      setAspect((prev) => {
        const next = w / h;
        return Math.abs(next - prev) < 0.02 ? prev : next;
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return aspect;
}

/**
 * Justify only rows that read as a line: 3+ words, no tiny words, AND enough
 * natural fill that stretching looks intentional. Sparse rows (e.g. "THEN YOU
 * MAY" at 64% fill) center as a cluster instead of stranding words at the
 * rails with giant gutters. Fill is pure arithmetic (counts + live aspect).
 */
export function rowFillRatio(
  rowChars: number,
  sizeCqh: number,
  aspect: number,
  glyphEm: number
): number {
  if (aspect <= 0) return 1;
  return (glyphEm * rowChars * sizeCqh) / (100 * aspect);
}

export function rowCharCount(row: ParsedWord[]): number {
  return row.reduce((a, w) => a + w.text.length + 1, 0);
}

export function shouldJustifyRow(row: ParsedWord[], fillRatio: number, isComplex = false): boolean {
  if (isComplex) return false;
  if (row.length < 3) return false;
  if (!row.every((w) => w.text.replace(/[^A-Za-z0-9]/g, '').length > 2)) return false;
  return fillRatio >= 0.78;
}


function scoreSplitPoint(words: ParsedWord[], i: number, ideal: number): number {
  let score = Math.abs(i - ideal) * 1.5;
  const prevWord = words[i - 1].text.trim();
  const nextWord = words[i].text.trim().toLowerCase();

  // Punctuation on previous word (comma, semicolon, period, dash, question mark, nakaguro, etc.)
  if (/[,;:.!?—–、。！？・…]$/.test(prevWord)) {
    score -= 4.0;
  }
  // Bracketed token boundary (e.g. ad-lib end)
  if (words[i - 1].isBracketed !== words[i].isBracketed) {
    score -= 2.0;
  }
  // Natural conjunctions or prepositions at start of next chunk (English & Japanese)
  if (/^(when|and|but|so|that|because|if|or|while|where|as|with|for|in|on|at|to|from|then|の|に|を|は|が|と|で|から|まで|けど|でも|そして)$/.test(nextWord)) {
    score -= 2.5;
  }

  return score;
}

export function partitionWordsIntoScreens(words: ParsedWord[], k: number): ParsedWord[][] {
  const n = words.length;
  if (k <= 1 || n <= 3) return [words];

  if (k === 2) {
    const ideal = n / 2;
    let bestIdx = Math.floor(ideal);
    let bestScore = Infinity;
    const minWords = Math.min(2, Math.floor(n / 2));
    for (let i = minWords; i <= n - minWords; i++) {
      const s = scoreSplitPoint(words, i, ideal);
      if (s < bestScore) {
        bestScore = s;
        bestIdx = i;
      }
    }
    return [words.slice(0, bestIdx), words.slice(bestIdx)];
  }

  const idealFirst = n / k;
  let bestIdx = Math.floor(idealFirst);
  let bestScore = Infinity;
  const minWords = 2;
  const maxWords = n - 2 * (k - 1);
  for (let i = minWords; i <= Math.max(minWords, maxWords); i++) {
    const s = scoreSplitPoint(words, i, idealFirst);
    if (s < bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }

  const firstChunk = words.slice(0, bestIdx);
  const remainingChunks = partitionWordsIntoScreens(words.slice(bestIdx), k - 1);
  return [firstChunk, ...remainingChunks];
}

export interface PosterScreen {
  id: string;
  lineIndex: number;
  words: ParsedWord[];
  start: number;
  end: number;
  text: string;
}

/**
 * Splits long lyric sentences into punchy, bite-sized kinetic screens.
 * Words <= 6 and characters <= 36 remain as 1 screen.
 * Longer sentences partition into 2-4 chunks of ~4-5 words each so words
 * render monumental and full-bleed instead of cluttering into multi-line paragraphs.
 */
export function buildPosterScreens(lines: LyricLine[]): PosterScreen[] {
  const screens: PosterScreen[] = [];

  lines.forEach((line, lIdx) => {
    const words = getLineSequentialWords(line);
    if (words.length === 0) return;

    const isComplex = isComplexScript(line.text);
    const totalChars = words.reduce((acc: number, w: ParsedWord) => acc + w.text.length + 1, 0);
    const lineDuration = Math.max(0.1, line.end - line.start);

    // High semantic density for CJK scripts: target max 5 words or 22 chars per screen
    const maxWordsPerScreen = isComplex ? 5 : 7;
    const maxCharsPerScreen = isComplex ? 22 : 38;

    // If line is short and punchy, 1 screen is already optimal
    if (words.length <= maxWordsPerScreen && totalChars <= maxCharsPerScreen) {
      screens.push({
        id: `${line.id ?? lIdx}-screen-0`,
        lineIndex: lIdx,
        words,
        start: line.start,
        end: line.end,
        text: words.map((w: ParsedWord) => w.text).join(isComplex ? '' : ' '),
      });
      return;
    }

    // Target max words per chunk for huge, monumental kinetic typography
    let k = Math.ceil(words.length / maxWordsPerScreen);
    k = Math.max(k, Math.ceil(totalChars / (maxCharsPerScreen + 4)));
    // Don't make chunks shorter than 1.2s unless the whole line is that short
    while (k > 1 && lineDuration / k < 1.2) {
      k--;
    }
    k = Math.max(1, Math.min(k, Math.floor(words.length / 2)));

    if (k <= 1) {
      screens.push({
        id: `${line.id ?? lIdx}-screen-0`,
        lineIndex: lIdx,
        words,
        start: line.start,
        end: line.end,
        text: words.map((w: ParsedWord) => w.text).join(isComplex ? '' : ' '),
      });
      return;
    }

    const chunks = partitionWordsIntoScreens(words, k);
    chunks.forEach((chunkWords, cIdx) => {
      if (chunkWords.length === 0) return;
      const isFirst = cIdx === 0;
      const isLast = cIdx === chunks.length - 1;
      const chunkStart = isFirst ? line.start : chunkWords[0].start;
      const chunkEnd = isLast ? line.end : chunks[cIdx + 1][0].start;

      screens.push({
        id: `${line.id ?? lIdx}-screen-${cIdx}`,
        lineIndex: lIdx,
        words: chunkWords,
        start: chunkStart,
        end: chunkEnd,
        text: chunkWords.map((w) => w.text).join(isComplex ? '' : ' '),
      });
    });
  });

  return screens;
}

export interface BalancedScreenData {
  screen: PosterScreen;
  rows: ParsedWord[][];
  maxRowChars: number;
  rowCount: number;
  isComplex: boolean;
  glyphEm: number;
  rowFontSize: string;
  fontStack: string;
  lineHeight: number;
  exitKey?: string;
}

export const KineticPosterRenderer: React.FC<KineticPosterRendererProps> = ({
  lines,
  currentTime,
  onSeek,
  transitionMode = 'pivot',
  kenBurns = true,
  trackTitle,
  artistName,
  isPlaying = false,
  coverArt,
  stageFontFamily = 'poppins',
  stageFontWeight = '500',
}) => {
  const screens = useMemo(() => buildPosterScreens(lines), [lines]);
  const hintRef = useRef<number>(-1);

  const [dynamicCoverArt, setDynamicCoverArt] = useState<string | null>(null);

  useEffect(() => {
    ensureStageFontLoaded(stageFontFamily);
  }, [stageFontFamily]);

  useEffect(() => {
    if (coverArt) {
      setDynamicCoverArt(coverArt);
      return;
    }
    if (!trackTitle && !artistName) return;

    let isSubscribed = true;
    fetchArtworkUrl(artistName, trackTitle).then((url) => {
      if (isSubscribed && url) {
        setDynamicCoverArt(url);
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, [coverArt, trackTitle, artistName]);

  // Lead-time for smooth kinetic screen transitions (0.20s pre-roll so 3D flip lands right as the vocal begins)
  const SCREEN_LEAD_TIME = 0.20;
  const effectiveScreenTime = currentTime + SCREEN_LEAD_TIME;

  // O(1) temporal-locality + O(log N) binary-search active screen locator
  const activeScreenIndex = useMemo(() => {
    const len = screens.length;
    if (len === 0) return -1;
    const hint = hintRef.current;
    if (hint >= 0 && hint < len) {
      if (effectiveScreenTime >= screens[hint].start && (hint === len - 1 || effectiveScreenTime < screens[hint + 1].start)) {
        return hint;
      }
      const next = hint + 1;
      if (next < len && effectiveScreenTime >= screens[next].start && (next === len - 1 || effectiveScreenTime < screens[next + 1].start)) {
        hintRef.current = next;
        return next;
      }
    }
    let low = 0;
    let high = len - 1;
    let best = -1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (screens[mid].start <= effectiveScreenTime) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    hintRef.current = best;
    return best;
  }, [screens, effectiveScreenTime]);

  const activeScreen = activeScreenIndex >= 0 ? screens[activeScreenIndex] : null;
  // If there is an extended instrumental break (> 4.5s after screen.end before next screen starts):
  const isStandby =
    !activeScreen ||
    (currentTime > activeScreen.end + 4.5 &&
      activeScreenIndex < screens.length - 1 &&
      effectiveScreenTime < screens[activeScreenIndex + 1].start);

  const stageRef = useRef<HTMLDivElement>(null);
  const stageAspect = useStageAspect(stageRef);

  const balanced = useMemo<BalancedScreenData | null>(() => {
    if (!activeScreen) return null;
    const isComplex = isComplexScript(activeScreen.text);
    const customStack = !isComplex ? buildStageFontStack(stageFontFamily) : null;
    // Custom fonts are wider than League Gothic: budget more advance per glyph
    // so rows fit instead of overflowing the stage.
    const glyphEm = isComplex ? GLYPH_ADVANCE_EM_COMPLEX : customStack ? 0.6 : GLYPH_ADVANCE_EM_LATIN;
    const rowCount = rowCountForBalance(activeScreen.words, stageAspect, glyphEm);
    const rows = packWordsIntoRows(activeScreen.words, rowCount);
    const maxRowChars = rows.reduce(
      (m, row) => Math.max(m, row.reduce((a, w) => a + w.text.length + 1, 0)),
      1
    );
    const rowFontSize = `min(calc(66cqh / ${rowCount}), calc(82cqw / ${(glyphEm * maxRowChars).toFixed(2)}), 24cqh)`;
    const fontStack = isComplex ? POSTER_FONT_COMPLEX : (customStack ?? POSTER_FONT_LATIN);
    const lineHeight = isComplex ? 1.24 : 1.06;

    return {
      screen: activeScreen,
      rows,
      maxRowChars,
      rowCount,
      isComplex,
      glyphEm,
      rowFontSize,
      fontStack,
      lineHeight,
    };
  }, [activeScreen, stageAspect, stageFontFamily]);

  // Dual-layer screen exit & enter animation lifecycle
  const balancedRef = useRef<BalancedScreenData | null>(null);
  const prevScreenIdRef = useRef<string | null>(null);
  const prevTimeRef = useRef<number>(currentTime);
  const [exitingData, setExitingData] = useState<BalancedScreenData | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const currentId = activeScreen?.id ?? null;
    const prevId = prevScreenIdRef.current;
    const prevTime = prevTimeRef.current;
    prevTimeRef.current = currentTime;

    if (currentId && prevId && currentId !== prevId) {
      // Screen changed! Check if it's natural continuous playback forward
      const timeDelta = currentTime - prevTime;
      const isNaturalPlayback = timeDelta >= 0 && timeDelta < 2.0;

      if (isNaturalPlayback && balancedRef.current) {
        if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
        setExitingData({
          ...balancedRef.current,
          exitKey: `exit-${prevId}-${Date.now()}`,
        });

        const cleanupDuration = transitionMode === 'cube' ? 560 : transitionMode === 'whip' ? 500 : 540;
        exitTimerRef.current = setTimeout(() => {
          setExitingData(null);
        }, cleanupDuration);
      } else {
        if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
        setExitingData(null);
      }
    }

    prevScreenIdRef.current = currentId;
    if (balanced) {
      balancedRef.current = balanced;
    }
  }, [activeScreen?.id, currentTime, balanced, transitionMode]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  // Before the first line or during long instrumental breaks: dynamic standby stage
  if (isStandby || !activeScreen || !balanced) {
    const isIntro = screens.length > 0 && currentTime < screens[0].start;
    const introRemaining = isIntro ? Math.max(0, Math.ceil(screens[0].start - currentTime)) : 0;
    const nextLineText = isIntro ? screens[0].text : null;

    // During mid-song instrumental breaks: subtle solid music note icon only, nothing else
    if (!isIntro) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center select-none animate-in fade-in duration-300">
          <SolidMusicNote className="w-8 h-8 sm:w-10 sm:h-10 text-white/40 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] animate-pulse" />
        </div>
      );
    }

    const activeCover = coverArt || dynamicCoverArt;

    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 text-center select-none max-w-md mx-auto animate-in fade-in duration-500 font-sans">
        {/* Album Artwork Display with Dynamic Glow & Pulse */}
        <div className="relative flex items-center justify-center group">
          {isPlaying && activeCover && (
            <div className="absolute -inset-2 rounded-3xl bg-white/10 animate-pulse duration-1000 -z-10 blur-xl opacity-60" />
          )}
          {activeCover ? (
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden border border-white/20 shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-all duration-500 group-hover:scale-105">
              <img
                src={activeCover}
                alt={trackTitle ? `${trackTitle} album cover` : 'Album artwork'}
                className="w-full h-full object-cover rounded-2xl select-none"
              />
              {/* Subtle ambient glow behind artwork */}
              <div
                className="absolute -inset-3 rounded-3xl bg-cover bg-center blur-2xl opacity-40 -z-10 scale-110 pointer-events-none transition-opacity duration-700"
                style={{ backgroundImage: `url(${activeCover})` }}
              />
            </div>
          ) : (
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-white/[0.06] border border-white/15 backdrop-blur-xl flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-500">
              <SolidMusicNote className="w-8 h-8 sm:w-10 sm:h-10 text-white/50 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]" />
            </div>
          )}
        </div>

        {/* Clean Sans-Serif Track Metadata */}
        {(trackTitle || artistName) && (
          <div className="flex flex-col items-center gap-1.5 font-sans">
            {trackTitle && (
              <h3 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-lg line-clamp-1 font-sans">
                {trackTitle}
              </h3>
            )}
            {artistName && (
              <p className="text-xs sm:text-sm font-bold tracking-[0.18em] uppercase text-white/70 font-sans">
                {artistName}
              </p>
            )}
          </div>
        )}

        {/* Clean Modern Badge - NO GREEN DOT */}
        {introRemaining > 0 ? (
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.08] border border-white/15 text-xs font-sans font-semibold text-white/90 backdrop-blur-md shadow-sm">
            <span>Vocals in {introRemaining}s</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.08] border border-white/15 text-xs font-sans font-semibold text-white/90 backdrop-blur-md shadow-sm">
            <span>Starting…</span>
          </div>
        )}

        {/* High-contrast Sans-Serif Next Line Preview */}
        {nextLineText && (
          <p className="text-xs sm:text-sm font-sans font-medium text-white/60 tracking-normal max-w-sm line-clamp-2 leading-relaxed">
            {nextLineText}
          </p>
        )}
      </div>
    );
  }

  const { screen, rows, rowFontSize, fontStack, lineHeight, isComplex } = balanced;

  // Inline weight beats the font-black row classes; null keeps mode default.
  const posterWeight = stageFontWeightValue(stageFontWeight);

  const exitClass =
    transitionMode === 'cube'
      ? 'kinetic-exit-cube'
      : transitionMode === 'whip'
      ? 'kinetic-exit-whip'
      : 'kinetic-exit-pivot';

  const enterClass =
    transitionMode === 'cube'
      ? 'kinetic-enter-cube'
      : transitionMode === 'whip'
      ? 'kinetic-enter-whip'
      : 'kinetic-enter-slide';

  return (
    <div
      ref={stageRef}
      className="flex-1 relative flex flex-col items-center justify-center w-full h-full min-h-0 px-[6cqw] py-[4cqh] overflow-hidden [perspective:1200px]"
    >
      {/* ── 1. Exiting Screen Layer ── */}
      {exitingData && (
        <div
          key={exitingData.exitKey}
          className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none ${exitClass} z-0`}
        >
          <div className="flex flex-col items-start justify-center w-fit max-w-[82cqw] gap-[1.2cqh]">
            {exitingData.rows.map((row, rIdx) => (
              <div
                key={`exit-row-${rIdx}`}
                style={{
                  fontSize: exitingData.rowFontSize,
                  fontFamily: exitingData.fontStack,
                  lineHeight: exitingData.lineHeight,
                  wordSpacing: exitingData.isComplex ? 'normal' : '0.22em',
                  fontWeight: posterWeight ?? undefined,
                }}
                className="font-black text-white/90 whitespace-nowrap text-left tracking-[0.01em]"
              >
                {row.map((word, wIdx) => {
                  const needsSpace = wIdx > 0 && (word.hasSpaceBefore ?? !exitingData.isComplex);
                  return (
                    <React.Fragment key={wIdx}>
                      {needsSpace ? ' ' : null}
                      <span
                        className={`inline-block ${
                          word.isBracketed
                            ? 'italic font-bold text-zinc-200 text-[0.42em]'
                            : ''
                        }`}
                      >
                        {word.text}
                      </span>
                    </React.Fragment>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 2. Active Screen Layer ── */}
      <div
        key={screen.id}
        className={`flex flex-col items-center justify-center w-full ${enterClass} z-10`}
      >
        <div
          className={`flex flex-col items-start justify-center w-fit max-w-[82cqw] gap-[1.2cqh] ${
            kenBurns ? 'kinetic-ken-burns' : ''
          }`}
        >
          {rows.map((row, rIdx) => (
            <div
              key={`${screen.id}-row-${rIdx}`}
              onClick={() => onSeek && onSeek(row[0].start)}
              style={{
                fontSize: rowFontSize,
                fontFamily: fontStack,
                lineHeight,
                wordSpacing: isComplex ? 'normal' : '0.22em',
                fontWeight: posterWeight ?? undefined,
              }}
              className="font-black text-white overflow-visible cursor-pointer whitespace-nowrap text-left tracking-[0.01em]"
            >
              {row.map((word, wIdx) => {
                const shown = currentTime >= word.start;
                const needsSpace = wIdx > 0 && (word.hasSpaceBefore ?? !isComplex);
                return (
                  <React.Fragment key={wIdx}>
                    {needsSpace ? ' ' : null}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSeek) onSeek(word.start);
                      }}
                      className={`inline-block transition-all duration-100 ease-out cursor-pointer select-none motion-reduce:!transform-none motion-reduce:!transition-none ${
                        shown
                          ? 'opacity-100 text-white translate-y-0 scale-100 drop-shadow-[0_0_16px_rgba(255,255,255,0.35)]'
                          : 'opacity-35 text-white/40 translate-y-0 scale-[0.98]'
                      } ${
                        word.isBracketed
                          ? 'italic font-bold text-zinc-300 text-[0.45em]'
                          : ''
                      }`}
                    >
                      {word.text}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

KineticPosterRenderer.displayName = 'KineticPosterRenderer';
