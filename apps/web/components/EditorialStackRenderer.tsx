'use client';

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LyricLine, WordToken } from '@/types/lyrics';
import { isComplexScript } from './LyricRenderer';
import { ColorPalette } from '@/lib/colorExtractor';
import { buildStageFontStack, stageFontWeightValue, ensureStageFontLoaded } from '@/lib/stageFonts';

export interface EditorialStackRendererProps {
  lines: LyricLine[];
  currentTime: number;
  songTitle?: string;
  artistName?: string;
  onSeek?: (time: number) => void;
  palette?: ColorPalette | null;
  maxLines?: number; // Target max lines per stanza (e.g. 1 for horizontal single row, 2, 3, 4, 5, or 99 for tower). Default: 4
  wordsPerRow?: number; // Target words per row in 1-row mode (0 = full sentence/auto, 4, 5, 6, 8 = fixed batch size). Default: 0
  cleanLyrics?: boolean; // When true, strips trailing/leading commas, periods, brackets for clean typography. Default: true
  stageFontFamily?: string;
  stageFontWeight?: string;
}

// Two-tone palette duality extracted directly from reference frames
const THEME_VIOLET = {
  bg: '#24103E',
  text: '#C5B4E3',
  activeWord: '#EDE4FF',
  star: '#C5B4E3',
};

const THEME_SLATE = {
  bg: '#B0BAC6',
  text: '#24103E',
  activeWord: '#130526',
  star: '#24103E',
};

/**
 * Fast cached measurement of text width at 100px reference size.
 */
function measureTextWidth(
  text: string,
  fontFamily: string,
  fontWeight: string | number = 700
): number {
  if (!text) return 0;
  if (typeof document !== 'undefined') {
    try {
      let canvas = (measureTextWidth as any)._canvas;
      if (!canvas) {
        canvas = document.createElement('canvas');
        (measureTextWidth as any)._canvas = canvas;
      }
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = `${fontWeight} 100px ${fontFamily}`;
        const measured = ctx.measureText(text).width;
        if (measured > 0) return measured;
      }
    } catch {
      // Fallback
    }
  }
  return text.length * 56;
}

/**
 * Strips punctuation (commas, periods, exclamation marks, outer brackets/quotes)
 * for pristine editorial typography, preserving intra-word apostrophes (e.g. j'm'en, d'un).
 */
export function cleanEditorialWord(raw: string): string {
  if (!raw) return '';
  const cleaned = raw
    .replace(/^["'“”‘’([{\s]+/, '')
    .replace(/[,\.!?;:।॥،؟、。，！？"'“”‘’)}\]\s]+$/, '')
    .trim();
  return cleaned || raw;
}

export interface EditorialLineGroup {
  lineIndex: number;
  words: Array<{
    token: WordToken;
    globalIndex: number;
    displayText: string;
  }>;
}

export interface EditorialRowBatch {
  batchIndex: number;
  globalBatchIndex: number;
  start: number;
  end: number;
  words: Array<{
    token: WordToken;
    globalIndex: number;
    displayText: string;
  }>;
}

/**
 * Option A — Smart Balanced Stanza Wrap
 *
 * Dynamically partitions N words into K lines (where K <= maxLines)
 * using a balanced penalty algorithm that:
 * 1. Caps the stack at maxLines (e.g. 3 or 4 lines max, eliminating the 10-story tower)
 * 2. Balances word counts and visual character lengths across lines
 * 3. Respects natural punctuation breaks (commas, semicolons, pauses)
 * 4. Prevents awkward 1-word orphan lines
 */
export function partitionWordsIntoEditorialLines(
  words: WordToken[],
  maxLines: number = 4,
  cleanLyrics: boolean = true
): EditorialLineGroup[] {
  const n = words.length;
  if (n === 0) return [];

  // Tower Mode: 1 word per line
  if (maxLines >= 99) {
    return words.map((w, idx) => ({
      lineIndex: idx,
      words: [
        {
          token: w,
          globalIndex: idx,
          displayText: cleanLyrics ? cleanEditorialWord(w.text) : w.text,
        },
      ],
    }));
  }

  // If words are fewer than maxLines, each word gets its own line (pure cascade)
  const targetK = Math.min(n, Math.max(1, maxLines));
  if (n <= targetK) {
    return words.map((w, idx) => ({
      lineIndex: idx,
      words: [
        {
          token: w,
          globalIndex: idx,
          displayText: cleanLyrics ? cleanEditorialWord(w.text) : w.text,
        },
      ],
    }));
  }

  // Search optimal partition points
  const targetWords = n / targetK;
  const totalChars = words.reduce((acc, w) => acc + w.text.length, 0);
  const targetChars = totalChars / targetK;

  let bestCost = Infinity;
  let bestSplits: number[] = [];

  function search(splitIdx: number, lastPos: number, currentSplits: number[]) {
    if (splitIdx === targetK - 1) {
      const cuts = [0, ...currentSplits, n];
      let cost = 0;
      for (let i = 0; i < targetK; i++) {
        const start = cuts[i];
        const end = cuts[i + 1];
        const count = end - start;
        cost += Math.pow(count - targetWords, 2) * 14;

        let charLen = 0;
        for (let j = start; j < end; j++) {
          charLen += words[j].text.length;
        }
        cost += Math.pow(charLen - targetChars, 2) * 0.25;

        // Punctuation cadence bonus if word before split has punctuation
        if (i < targetK - 1) {
          const lastWord = words[end - 1].text;
          if (/[,\.!?;:।॥،؟、。，！？—-]/.test(lastWord)) {
            cost -= 14;
          }
        }

        // Penalty for 1-word orphan line if sentence is substantial
        if (count === 1 && n >= 5) {
          cost += 18;
        }
      }

      if (cost < bestCost) {
        bestCost = cost;
        bestSplits = [...currentSplits];
      }
      return;
    }

    const remaining = (targetK - 1) - splitIdx;
    const minPos = lastPos + 1;
    const maxPos = n - remaining;

    for (let pos = minPos; pos <= maxPos; pos++) {
      currentSplits.push(pos);
      search(splitIdx + 1, pos, currentSplits);
      currentSplits.pop();
    }
  }

  search(0, 0, []);

  const cuts = [0, ...bestSplits, n];
  const groups: EditorialLineGroup[] = [];
  for (let i = 0; i < targetK; i++) {
    const start = cuts[i];
    const end = cuts[i + 1];
    const lineWords: EditorialLineGroup['words'] = [];
    for (let j = start; j < end; j++) {
      const tok = words[j];
      lineWords.push({
        token: tok,
        globalIndex: j,
        displayText: cleanLyrics ? cleanEditorialWord(tok.text) : tok.text,
      });
    }
    groups.push({
      lineIndex: i,
      words: lineWords,
    });
  }

  return groups;
}

/**
 * EditorialStackRenderer
 *
 * Implements the iconic high-contrast editorial serif lyric aesthetic:
 * - High-contrast Fraunces variable display serif typography with soft fluid terminals
 * - Option A: Smart Balanced Stanza Wrap capping lines at 3-4 per screen
 * - Real-time word-level reveal with spring damping layout animations
 * - Alternating two-tone color duality between phrases (Midnight Violet ↔ Powder Slate)
 * - Grounded bottom anchor star motif (★) with centered breathing instrumental state
 */
export const EditorialStackRenderer: React.FC<EditorialStackRendererProps> = React.memo(({
  lines,
  currentTime,
  songTitle,
  artistName,
  onSeek,
  palette,
  maxLines = 4,
  wordsPerRow = 4,
  cleanLyrics = true,
  stageFontFamily = 'poppins',
  stageFontWeight = '500',
}) => {
  useEffect(() => {
    ensureStageFontLoaded(stageFontFamily);
  }, [stageFontFamily]);

  // Custom stage font overrides the Fraunces default for Latin text only;
  // complex scripts keep Noto. Weight falls back to the designed 500.
  const customStack = buildStageFontStack(stageFontFamily);
  const customWeight = stageFontWeightValue(stageFontWeight);
  const lastLineIndexRef = useRef<number>(-1);

  // Measure container dimensions for responsive zero-overflow typography
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fast binary/temporal search for active lyric line
  const activeLineIndex = useMemo(() => {
    const len = lines.length;
    if (len === 0) return -1;

    const lastIdx = lastLineIndexRef.current;
    if (lastIdx >= 0 && lastIdx < len) {
      if (
        currentTime >= lines[lastIdx].start &&
        (lastIdx === len - 1 || currentTime < lines[lastIdx + 1].start)
      ) {
        return lastIdx;
      }
      const nextIdx = lastIdx + 1;
      if (nextIdx < len && currentTime >= lines[nextIdx].start && (nextIdx === len - 1 || currentTime < lines[nextIdx + 1].start)) {
        lastLineIndexRef.current = nextIdx;
        return nextIdx;
      }
    }

    let low = 0;
    let high = len - 1;
    let best = -1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (lines[mid].start <= currentTime) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    lastLineIndexRef.current = best;
    return best;
  }, [lines, currentTime]);

  const activeLine = activeLineIndex >= 0 ? lines[activeLineIndex] : null;

  // Instrumental gap detection (silence > 2.5s before or between lines)
  const isInstrumental = useMemo(() => {
    if (lines.length === 0) return true;
    if (currentTime < lines[0].start && lines[0].start >= 2.0) return true;
    if (!activeLine) return false;
    if (activeLineIndex < lines.length - 1) {
      const nextLine = lines[activeLineIndex + 1];
      if (currentTime >= activeLine.end && currentTime < nextLine.start && (nextLine.start - activeLine.end >= 2.5)) {
        return true;
      }
    }
    return false;
  }, [lines, currentTime, activeLine, activeLineIndex]);

  // Extract or synthesize word tokens for the active line
  const lineWords: WordToken[] = useMemo(() => {
    if (!activeLine) return [];

    if (activeLine.tokens && activeLine.tokens.length > 0) {
      return activeLine.tokens;
    }

    // Fallback: auto-split on whitespace and distribute timings evenly
    const rawTokens = activeLine.text.trim().split(/\s+/).filter(Boolean);
    if (rawTokens.length === 0) return [];

    const lineDuration = Math.max(0.6, activeLine.end - activeLine.start);
    const tokenDuration = lineDuration / rawTokens.length;

    return rawTokens.map((txt, idx) => ({
      text: txt,
      start: activeLine.start + idx * tokenDuration,
      end: activeLine.start + (idx + 1) * tokenDuration,
    }));
  }, [activeLine]);

  // Partition words into balanced editorial lines (Option A)
  const editorialLines = useMemo(() => {
    return partitionWordsIntoEditorialLines(lineWords, maxLines, cleanLyrics);
  }, [lineWords, maxLines, cleanLyrics]);

  // 1-Row Horizontal Stream Mode batch computation
  const isRowMode = maxLines === 1;

  // Precompute cumulative batch offsets across all lines so color themes alternate strictly per batch
  const allBatchesInfo = useMemo(() => {
    if (!isRowMode) return null;
    let cumulativeBatches = 0;
    const lineBatchOffsets: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      lineBatchOffsets.push(cumulativeBatches);
      const lWords = lines[i].tokens && lines[i].tokens!.length > 0
        ? lines[i].tokens!
        : lines[i].text.trim().split(/\s+/).filter(Boolean);
      const count = lWords.length;
      const bSize = (wordsPerRow && wordsPerRow > 0)
        ? wordsPerRow
        : (count <= 8 ? count : Math.ceil(count / Math.ceil(count / 6)));
      const numBatches = bSize > 0 ? Math.ceil(count / bSize) : 1;
      cumulativeBatches += Math.max(1, numBatches);
    }
    return { lineBatchOffsets, totalBatches: cumulativeBatches };
  }, [lines, isRowMode, wordsPerRow]);

  const batchSize = useMemo(() => {
    const n = lineWords.length;
    if (n === 0) return 4;
    if (wordsPerRow && wordsPerRow > 0) return wordsPerRow;
    if (wordsPerRow === 0) return n; // Explicit 0 = full sentence
    return 4; // Default fixed batch: 4 words per row
  }, [lineWords.length, wordsPerRow]);

  const rowBatches = useMemo(() => {
    if (!isRowMode || lineWords.length === 0) return [];
    const batches: EditorialRowBatch[] = [];
    const totalWords = lineWords.length;
    const bSize = Math.max(1, batchSize);
    const numBatches = Math.ceil(totalWords / bSize);

    for (let b = 0; b < numBatches; b++) {
      const startIdx = b * bSize;
      const endIdx = Math.min(totalWords, (b + 1) * bSize);
      const slice = lineWords.slice(startIdx, endIdx);
      if (slice.length === 0) continue;

      const bWords = slice.map((tok, idxInBatch) => ({
        token: tok,
        globalIndex: startIdx + idxInBatch,
        displayText: cleanLyrics ? cleanEditorialWord(tok.text) : tok.text,
      }));

      const bStart = slice[0].start;
      const bEnd = slice[slice.length - 1].end;

      batches.push({
        batchIndex: b,
        globalBatchIndex: (allBatchesInfo?.lineBatchOffsets[activeLineIndex] ?? 0) + b,
        start: bStart,
        end: bEnd,
        words: bWords,
      });
    }
    return batches;
  }, [isRowMode, lineWords, batchSize, cleanLyrics, allBatchesInfo, activeLineIndex]);

  const activeBatchIndex = useMemo(() => {
    if (rowBatches.length === 0) return 0;
    for (let i = 0; i < rowBatches.length; i++) {
      const nextBatch = rowBatches[i + 1];
      if (currentTime >= rowBatches[i].start && (!nextBatch || currentTime < nextBatch.start)) {
        return i;
      }
    }
    if (currentTime < rowBatches[0].start) return 0;
    return rowBatches.length - 1;
  }, [rowBatches, currentTime]);

  const activeBatch = isRowMode ? (rowBatches[activeBatchIndex] || null) : null;
  const globalBatchIndex = (allBatchesInfo?.lineBatchOffsets[activeLineIndex] ?? 0) + activeBatchIndex;

  // Total words revealed so far in this phrase / batch
  const totalRevealedCount = useMemo(() => {
    if (!activeLine || isInstrumental) return 0;
    if (currentTime < activeLine.start) return 0;
    if (isRowMode) {
      if (!activeBatch) return 0;
      return activeBatch.words.filter((w) => currentTime >= w.token.start).length;
    }
    return lineWords.filter((w) => currentTime >= w.start).length;
  }, [activeLine, isInstrumental, currentTime, isRowMode, activeBatch, lineWords]);

  // Alternating palette:
  // In 1-Row mode: strictly alternates between Powder Slate and Midnight Violet per batch!
  // In Multi-Line mode: alternates per phrase (Line 0 Slate, Line 1 Violet...)
  const currentTheme = useMemo(() => {
    if (activeLineIndex < 0) {
      return THEME_VIOLET;
    }
    if (isRowMode) {
      return (globalBatchIndex % 2 === 0) ? THEME_SLATE : THEME_VIOLET;
    }
    const isEven = (activeLineIndex % 2) === 0;
    return isEven ? THEME_SLATE : THEME_VIOLET;
  }, [activeLineIndex, isRowMode, globalBatchIndex]);

  const isComplex = activeLine ? isComplexScript(activeLine.text) : false;
  const resolvedFontFamily = isComplex
    ? "'Noto Sans', system-ui, sans-serif"
    : (customStack ?? "'Fraunces', Georgia, serif");
  const resolvedFontWeight = customWeight ?? 700;

  // Responsive fluid typography for horizontal 1-row mode
  // Calculates optimal billboard font size that is guaranteed to fit within screen bounds without overflowing
  const rowFontSizePx = useMemo(() => {
    if (!activeBatch || activeBatch.words.length === 0) {
      return 80;
    }
    const words = activeBatch.words;
    const fullText = words.map((w) => w.displayText).join(' ');
    if (!fullText) return 80;

    const availW = Math.max(260, (dimensions.width || 1200) - 140);
    const availH = Math.max(160, (dimensions.height || 800) * 0.72);

    const widthAt100 = measureTextWidth(fullText, resolvedFontFamily, resolvedFontWeight);
    const gapAllowanceAt100 = Math.max(0, words.length - 1) * 16;
    const totalWidthAt100 = Math.max(40, widthAt100 + gapAllowanceAt100);

    const fitW = (availW / totalWidthAt100) * 100;
    const fitH = (availH / 95) * 100;

    const ideal = Math.min(fitW, fitH);
    const maxCap = words.length <= 2 ? 160 : words.length <= 4 ? 135 : words.length <= 6 ? 110 : 90;

    return Math.max(22, Math.min(maxCap, Math.floor(ideal)));
  }, [activeBatch, dimensions.width, dimensions.height, resolvedFontFamily, resolvedFontWeight]);

  // Initial Intro Timeline & Cinematic Star Zoom Detection
  const firstLineStart = lines.length > 0 ? lines[0].start : 4.0;
  const isInitialIntro = lines.length > 0 && currentTime < firstLineStart;
  const zoomDuration = Math.min(2.4, Math.max(0.8, firstLineStart * 0.45));
  const zoomStartTime = Math.max(0, firstLineStart - zoomDuration);

  const zoomProgress = useMemo(() => {
    if (!isInitialIntro) return 0;
    if (currentTime < zoomStartTime) return 0;
    return Math.min(
      1,
      Math.max(0, (currentTime - zoomStartTime) / Math.max(0.001, firstLineStart - zoomStartTime))
    );
  }, [isInitialIntro, currentTime, zoomStartTime, firstLineStart]);

  // Title & Artist fade out and scale down as zoom starts
  const titleOpacity = isInitialIntro
    ? zoomProgress > 0
      ? Math.max(0, 1 - zoomProgress * 3.2)
      : 0.85
    : 0;
  const titleScale = isInitialIntro ? Math.max(0.85, 1 - zoomProgress * 0.15) : 1;

  // Star scale: begins smoothly at scale 1, accelerates exponentially (cubic) to scale 180 to completely fill screen
  const starScale = isInitialIntro
    ? zoomProgress > 0
      ? 1 + Math.pow(zoomProgress, 3.0) * 175
      : 1
    : 1;

  // Star rotation: smooth idle rotation at 10 deg/sec + accelerating 72° symmetry sweep during zoom
  const starRotation = isInitialIntro
    ? (currentTime * 10) + Math.pow(zoomProgress, 1.5) * 72
    : 0;

  // Container background during intro:
  // Starts as THEME_VIOLET.bg (#24103E); once star covers 94%+ of screen, transitions to THEME_SLATE.bg (#B0BAC6)
  const containerBg = useMemo(() => {
    if (isInitialIntro) {
      return zoomProgress >= 0.94 ? THEME_SLATE.bg : THEME_VIOLET.bg;
    }
    return currentTheme.bg;
  }, [isInitialIntro, zoomProgress, currentTheme.bg]);

  // Responsive fluid typography for multi-line stack mode (2 lines, 3 lines, 4 lines, tower)
  // Evaluates width of EVERY line in the stack so no line ever wraps into an unexpected extra row
  const totalLinesInStack = Math.max(1, editorialLines.length);
  const stackFontSizePx = useMemo(() => {
    if (editorialLines.length === 0) {
      return 64;
    }

    const availW = Math.max(260, (dimensions.width || 1200) * 0.90 - 40);
    const availH = Math.max(160, (dimensions.height || 800) * 0.74);

    let maxLineWidthAt100 = 0;
    for (const group of editorialLines) {
      const lineText = group.words.map((w) => w.displayText).join(' ');
      const gapAllowance = Math.max(0, group.words.length - 1) * 14;
      const wAt100 = measureTextWidth(lineText, resolvedFontFamily, resolvedFontWeight) + gapAllowance;
      if (wAt100 > maxLineWidthAt100) {
        maxLineWidthAt100 = wAt100;
      }
    }

    const fitW = (availW / Math.max(40, maxLineWidthAt100)) * 100;
    const stackHeightAt100 = totalLinesInStack * 95 + Math.max(0, totalLinesInStack - 1) * 12;
    const fitH = (availH / Math.max(40, stackHeightAt100)) * 100;

    const ideal = Math.min(fitW, fitH);
    const maxCap =
      totalLinesInStack === 1
        ? 140
        : totalLinesInStack === 2
        ? 125
        : totalLinesInStack === 3
        ? 95
        : totalLinesInStack === 4
        ? 78
        : 58;

    return Math.max(20, Math.min(maxCap, Math.floor(ideal)));
  }, [editorialLines, totalLinesInStack, dimensions.width, dimensions.height, resolvedFontFamily, resolvedFontWeight]);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col w-full h-full min-h-0 relative overflow-hidden select-none items-center justify-center [container-type:size] transition-colors duration-500 ease-out"
      style={{
        backgroundColor: containerBg,
        color: currentTheme.text,
      }}
    >
      {/* Background Subtle Ambient Bloom */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20 transition-opacity duration-700"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${currentTheme.text}15 0%, transparent 75%)`,
        }}
      />

      {/* Main Center Stage */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center px-4 sm:px-8">
        <AnimatePresence mode="wait">
          {isInitialIntro ? (
            /* ✦ Initial Cinematic Intro: Title Card -> Star Zoom Transition */
            <div
              key="initial-intro-state"
              className="relative w-full h-full flex items-center justify-center pointer-events-none"
            >
              {/* Centered Pure Vector Zooming Star - Native SVG Geometry (Crisp and razor sharp at any scale) */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                viewBox="-500 -500 1000 1000"
                preserveAspectRatio="xMidYMid slice"
                shapeRendering="geometricPrecision"
              >
                <g transform={`rotate(${starRotation.toFixed(2)}) scale(${starScale.toFixed(3)})`}>
                  <path
                    d="M 0 -24 L 6.96 -8.98 L 24 -6.55 L 12 5.14 L 14.83 21.65 L 0 13.85 L -14.83 21.65 L -12 5.14 L -24 -6.55 L -6.96 -8.98 Z"
                    fill={THEME_SLATE.bg}
                  />
                </g>
              </svg>

              {/* Title & Artist below the star */}
              {(songTitle || artistName) && (
                <div
                  style={{
                    opacity: titleOpacity,
                    transform: `scale(${titleScale})`,
                    color: THEME_VIOLET.text,
                  }}
                  className="absolute top-[calc(50%+38px)] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-center select-none pointer-events-none transition-opacity duration-150"
                >
                  {songTitle && (
                    <span className="text-xs sm:text-sm font-sans uppercase tracking-[0.25em] font-semibold">
                      {songTitle}
                    </span>
                  )}
                  {artistName && (
                    <span className="text-[11px] font-sans tracking-widest opacity-75">
                      {artistName}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : isInstrumental || (currentTime < (activeLine?.start ?? 0) && totalRevealedCount === 0) ? (
            /* ✦ Mid-Song Instrumental Break State */
            <motion.div
              key="mid-instrumental-state"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="flex flex-col items-center justify-center gap-5 text-center select-none"
            >
              <motion.div
                animate={{
                  rotate: 360,
                }}
                transition={{
                  repeat: Infinity,
                  duration: 24,
                  ease: 'linear',
                }}
                className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-current opacity-85"
              >
                <svg
                  className="w-10 h-10 sm:w-12 sm:h-12 fill-current"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z" />
                </svg>
              </motion.div>
            </motion.div>
          ) : isRowMode ? (
            /* ✦ Single-Row Horizontal Centered Mode */
            <div className="w-full flex items-center justify-center px-4 sm:px-8 md:px-14 max-w-full z-10 overflow-hidden text-center">
              <AnimatePresence mode="popLayout">
                {activeBatch && (
                  <motion.div
                    key={`batch-${activeLineIndex}-${activeBatch.batchIndex}-${batchSize}`}
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -16, scale: 0.97 }}
                    transition={{
                      duration: 0.22,
                      ease: 'easeOut',
                      layout: { type: 'spring', damping: 28, stiffness: 350 },
                    }}
                    className="flex flex-row flex-nowrap items-baseline justify-center w-full overflow-hidden whitespace-nowrap gap-x-2.5 sm:gap-x-3.5 md:gap-x-5 text-center"
                    style={{
                      fontFamily: resolvedFontFamily,
                      fontVariationSettings: isComplex
                        ? undefined
                        : customStack
                          ? undefined
                          : "'opsz' 144, 'SOFT' 40, 'WONK' 0",
                      fontWeight: resolvedFontWeight,
                    }}
                  >
                    {activeBatch.words.map(({ token: word, globalIndex, displayText }) => {
                      const isWordRevealed = currentTime >= word.start;
                      if (!isWordRevealed) return null;

                      const isCurrentWord =
                        currentTime >= word.start && (word.end === undefined || currentTime <= word.end);

                      return (
                        <motion.span
                          key={`word-${activeLineIndex}-${globalIndex}`}
                          layout
                          initial={{ opacity: 0, y: 12, scale: 0.94 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{
                            layout: { type: 'spring', damping: 28, stiffness: 350 },
                            opacity: { duration: 0.15, ease: 'easeOut' },
                            y: { type: 'spring', damping: 22, stiffness: 340, mass: 0.6 },
                          }}
                          onClick={() => onSeek?.(word.start)}
                          style={{
                            fontSize: `${rowFontSizePx}px`,
                            color: isCurrentWord ? currentTheme.activeWord : currentTheme.text,
                            fontWeight: customWeight ?? undefined,
                          }}
                          className={`inline-block font-bold tracking-[-0.04em] leading-[0.88] cursor-pointer select-none shrink-0 ${
                            !isComplex ? 'lowercase' : ''
                          }`}
                          title={`${word.text} (${word.start.toFixed(2)}s - ${word.end.toFixed(2)}s)`}
                        >
                          {displayText}
                        </motion.span>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            /* ✦ Option A: Smart Balanced Stanza Stack (Ref Frames 018 - 080) */
            <motion.div
              key={`phrase-${activeLineIndex}-${maxLines}-${cleanLyrics ? 'clean' : 'raw'}`}
              layout
              transition={{
                layout: { type: 'spring', damping: 28, stiffness: 350 },
              }}
              className="flex flex-col items-center justify-center w-full max-w-[94vw] text-center z-10 gap-y-1 sm:gap-y-2"
              style={{
                fontFamily: resolvedFontFamily,
                fontVariationSettings: isComplex
                  ? undefined
                  : customStack
                    ? undefined
                    : "'opsz' 144, 'SOFT' 40, 'WONK' 0",
                fontWeight: resolvedFontWeight,
              }}
            >
              <AnimatePresence mode="popLayout">
                {editorialLines.map((group) => {
                  // A line is revealed if at least its first word timestamp has been reached
                  const isLineStarted =
                    group.words.length > 0 && currentTime >= group.words[0].token.start;

                  if (!isLineStarted) return null;

                  return (
                    <motion.div
                      key={`line-${activeLineIndex}-${group.lineIndex}`}
                      layout
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -16, scale: 0.95 }}
                      transition={{
                        layout: { type: 'spring', damping: 28, stiffness: 350 },
                        opacity: { duration: 0.18, ease: 'easeOut' },
                        y: { type: 'spring', damping: 22, stiffness: 320, mass: 0.7 },
                      }}
                      className="flex flex-nowrap whitespace-nowrap items-baseline justify-center gap-x-2 sm:gap-x-3.5 md:gap-x-4 max-w-full"
                    >
                      {group.words.map(({ token: word, globalIndex, displayText }) => {
                        const isWordRevealed = currentTime >= word.start;
                        if (!isWordRevealed) return null;

                        return (
                          <motion.span
                            key={`word-${activeLineIndex}-${globalIndex}`}
                            layout
                            initial={{ opacity: 0, y: 16, scale: 0.94 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{
                              layout: { type: 'spring', damping: 28, stiffness: 350 },
                              opacity: { duration: 0.16, ease: 'easeOut' },
                              y: { type: 'spring', damping: 22, stiffness: 340, mass: 0.6 },
                            }}
                            onClick={() => onSeek?.(word.start)}
                            style={{
                              fontSize: `${stackFontSizePx}px`,
                              color: currentTheme.text,
                              fontWeight: customWeight ?? undefined,
                            }}
                            className={`inline-block font-bold tracking-[-0.035em] leading-[0.93] cursor-pointer select-none shrink-0 ${
                              !isComplex ? 'lowercase' : ''
                            }`}
                            title={`${word.text} (${word.start.toFixed(2)}s - ${word.end.toFixed(2)}s)`}
                          >
                            {displayText}
                          </motion.span>
                        );
                      })}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ✦ Bottom Anchor Star Motif (★) */}
      {!isInstrumental && !isInitialIntro && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 0.9, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25 }}
          className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none z-20"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              repeat: Infinity,
              duration: 24,
              ease: 'linear',
            }}
            className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center"
          >
            <svg
              className="w-full h-full fill-current transition-colors duration-500"
              viewBox="0 0 24 24"
            >
              <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z" />
            </svg>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
});

EditorialStackRenderer.displayName = 'EditorialStackRenderer';
