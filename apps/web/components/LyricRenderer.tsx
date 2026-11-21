'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LyricLine } from '@/types/lyrics';
import { SolidMusicNote } from './SolidMusicNote';
import { RendererViewMode } from '@/types/editor';
import { KineticPosterRenderer } from './KineticPosterRenderer';
import { EditorialStackRenderer } from './EditorialStackRenderer';
import { AlveTownRenderer } from './AlveTownRenderer';
import { MountainPeakRenderer } from './MountainPeakRenderer';
import { ColorsViewRenderer } from './ColorsViewRenderer';
import { FlythroughRenderer } from './FlythroughRenderer';
import type { AlveTimeMode, ColorsBeatDivision } from '@/types/settings';
import { getStageFontOption } from '@/lib/stageFonts';
import { ColorPalette } from '@/lib/colorExtractor';
import { tokenizeLineIntoWords, isJapaneseText, estimateWordPhoneticWeight } from '@/lib/tokenizer';
export { estimateWordPhoneticWeight };
import { StageFontControls } from './StageFontControls';
import {
  buildStageFontStack,
  stageFontWeightValue,
  ensureStageFontLoaded,
  COLORS_FONT_OPTIONS,
} from '@/lib/stageFonts';

interface LyricRendererProps {
  lines: LyricLine[];
  currentTime: number;
  songTitle?: string;
  artistName?: string;
  coverArt?: string;
  onSeek?: (time: number) => void;
  viewMode?: RendererViewMode;
  onViewModeChange?: (mode: RendererViewMode) => void;
  hasBackdrop?: boolean;
  palette?: ColorPalette | null;
  editorialMaxLines?: number;
  editorialCleanLyrics?: boolean;
  editorialWordsPerRow?: number;
  onUpdateEditorialSettings?: (settings: { maxLines?: number; cleanLyrics?: boolean; wordsPerRow?: number }) => void;
  onUndoEditorial?: () => void;
  canUndoEditorial?: boolean;
  stageFontFamily?: string;
  stageFontWeight?: string;
  onUpdateStageSettings?: (settings: { stageFontFamily?: string; stageFontWeight?: string }) => void;
  alveDayNight?: boolean;
  alveAnimation?: boolean;
  alveDim?: number;
  alveTimeMode?: AlveTimeMode;
  alveFontSize?: number;
  onUpdateAlveSettings?: (settings: { alveDayNight?: boolean; alveAnimation?: boolean; alveDim?: number; alveTimeMode?: AlveTimeMode; alveFontSize?: number }) => void;
  peakTextX?: number;
  peakTextY?: number;
  peakFontSize?: number;
  peakParallax?: boolean;
  onUpdatePeakSettings?: (settings: {
    peakTextX?: number;
    peakTextY?: number;
    peakFontSize?: number;
    peakParallax?: boolean;
  }) => void;
  colorsBeatDivision?: ColorsBeatDivision;
  onUpdateColorsSettings?: (settings: { colorsBeatDivision?: ColorsBeatDivision; colorsFontFamily?: string; colorsFontSize?: number }) => void;
  colorsFontFamily?: string;
  colorsFontSize?: number;
  bpm?: number | null;
  onBpmDetected?: (bpm: number) => void;
  onOpenBpmModal?: () => void;
  onActionToast?: (
    message: string,
    onUndoAction?: (() => void) | null,
    options?: { actionType?: 'undo' | 'redo' | 'info' | 'sync'; durationMs?: number }
  ) => void;
  hideControls?: boolean;
}

export interface ParsedWord {
  text: string;
  isBracketed: boolean;
  start: number;
  end: number;
  emphasis?: boolean;
  hasSpaceBefore?: boolean;
}

/**
 * Detects if text contains complex scripts (Devanagari, Bengali, Gurmukhi, Gujarati,
 * Oriya, Tamil, Telugu, Kannada, Malayalam, Sinhala, Thai, Lao, Tibetan, Myanmar,
 * Khmer, Arabic, Hebrew, CJK, etc.) requiring special font metrics, normal letter-spacing,
 * and relaxed line-height.
 */
export function isComplexScript(text: string): boolean {
  return /[\u0600-\u06FF\u0900-\u0DFF\u0E00-\u0EFF\u0F00-\u0FFF\u1000-\u109F\u1780-\u17FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(text);
}

/**
 * Universal High-Precision Uniform Animated Zig-Zag Underline
 * Uses a fixed-period userSpaceOnUse SVG pattern (14px wavelength) so every wave peak,
 * slope, and stroke width is 100% mathematically uniform across any word or line length,
 * completely eliminating non-uniform squishing or stretching.
 */
export const AnimatedZigZagUnderline: React.FC<{
  progress: number;
  isActive: boolean;
  className?: string;
}> = React.memo(({ progress, isActive, className = '' }) => {
  const drawPct = Math.min(1, Math.max(0, progress));

  return (
    <div
      className={`absolute left-0 right-0 -bottom-1 w-full h-2 pointer-events-none overflow-hidden select-none ${className}`}
    >
      {/* Base Dim Musical Wave (Subtle guide on inactive words) */}
      <div
        className="absolute inset-0 w-full h-2 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 8' width='16' height='8'%3E%3Cpath d='M 0 4 C 2.5 1.2, 5.5 1.2, 8 4 C 10.5 6.8, 13.5 6.8, 16 4' fill='none' stroke='%23a1a1aa' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'left center',
        }}
      />

      {/* Active High-Luminance Pure White Wave Sweep (Reveals in sync with vocal progression) */}
      <div
        className={`absolute inset-0 w-full h-2 transition-opacity duration-150 ${
          isActive ? 'opacity-100' : 'opacity-70'
        }`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 8' width='16' height='8'%3E%3Cpath d='M 0 4 C 2.5 1.2, 5.5 1.2, 8 4 C 10.5 6.8, 13.5 6.8, 16 4' fill='none' stroke='%23ffffff' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'left center',
          clipPath: `inset(0 ${(100 - drawPct * 100).toFixed(2)}% 0 0)`,
          WebkitClipPath: `inset(0 ${(100 - drawPct * 100).toFixed(2)}% 0 0)`,
        }}
      />
    </div>
  );
});
AnimatedZigZagUnderline.displayName = 'AnimatedZigZagUnderline';

/**
 * Parses a lyric line into chronological, discrete word tokens.
 * Correctly distinguishes main lyrics and bracketed backing vocals / ad-libs (e.g. "(stupid)", "(oh),", "(यारा)"),
 * ensuring that bracketed words highlight in true chronological order and trailing punctuation stays bound.
 */
export function getLineSequentialWords(line: LyricLine): ParsedWord[] {
  const lineText = line.text || '';
  const isJp = isJapaneseText(lineText);

  if (line.tokens && line.tokens.length > 0) {
    let searchPos = 0;
    return line.tokens.map((tok, idx) => {
      const trimmed = tok.text.trim();
      const isBracketed =
        /^[(\[（【「『"']/.test(trimmed) ||
        /[)\]）】」』][.,!?;:।॥،؟、。，！？"']*$/.test(trimmed) ||
        Boolean(line.isBackground);

      let hasSpaceBefore = false;
      const foundIdx = lineText.indexOf(trimmed, searchPos);
      if (foundIdx >= 0) {
        hasSpaceBefore = foundIdx > 0 ? /\s/.test(lineText.slice(searchPos, foundIdx)) : false;
        searchPos = foundIdx + trimmed.length;
      } else if (idx > 0 && !isJp) {
        hasSpaceBefore = true;
      }

      return {
        text: tok.text,
        isBracketed,
        start: tok.start,
        end: tok.end,
        emphasis: Boolean(tok.emphasis ?? line.emphasis),
        hasSpaceBefore,
      };
    });
  }

  // If line has no explicit tokens, use intelligent multilingual tokenization
  const words = tokenizeLineIntoWords(line.text);
  if (words.length === 0) return [];

  const duration = Math.max(0.05, line.end - line.start);
  const weights = words.map((w) => estimateWordPhoneticWeight(w));
  const totalWeight = weights.reduce((acc, val) => acc + val, 0) || 1;

  let currentStart = line.start;
  let searchPos = 0;

  return words.map((word, idx) => {
    const trimmed = word.trim();
    const isBracketed =
      /^[(\[（【「『"']/.test(trimmed) ||
      /[)\]）】」』][.,!?;:।॥،؟、。，！？"']*$/.test(trimmed) ||
      Boolean(line.isBackground);

    let hasSpaceBefore = false;
    const foundIdx = lineText.indexOf(trimmed, searchPos);
    if (foundIdx >= 0) {
      hasSpaceBefore = foundIdx > 0 ? /\s/.test(lineText.slice(searchPos, foundIdx)) : false;
      searchPos = foundIdx + trimmed.length;
    } else if (idx > 0 && !isJp) {
      hasSpaceBefore = true;
    }

    const wordDuration = (weights[idx] / totalWeight) * duration;
    const start = currentStart;
    const end = idx === words.length - 1 ? line.end : currentStart + wordDuration;
    currentStart = end;

    return {
      text: word,
      isBracketed,
      start,
      end,
      emphasis: Boolean(line.emphasis),
      hasSpaceBefore,
    };
  });
}

/**
 * Universal Zero-Clipping Word Fill Component (Kinetic Engine)
 * Renders crystal-clear typography with pure `#FFFFFF` active fill and zero muddy neon halos.
 * The active word smoothly reveals solid white text over the dim base layer.
 */
interface LyricWordFillProps {
  word: ParsedWord;
  wordProgress: number; // 0 to 1
  isActive: boolean;
  isPast: boolean;
  textSizeClass?: string;
  onSeek?: (time: number) => void;
  /** Inline text style (custom stage font/weight). Spread onto word spans so it
   *  beats their font-extrabold classes; skips family for complex scripts. */
  stageStyle?: React.CSSProperties;
}

export const LyricWordFill: React.FC<LyricWordFillProps> = React.memo(({
  word,
  wordProgress,
  isActive,
  isPast,
  textSizeClass = '',
  onSeek,
  stageStyle,
}) => {
  const isFullyPlayed = wordProgress >= 1;
  const isPlaying = isActive && wordProgress > 0 && wordProgress < 1;
  const fillPct = Math.max(0, Math.min(100, wordProgress * 100));
  // Complex scripts keep Noto fallback stacks: drop custom family, keep weight.
  const wordStyle: React.CSSProperties | undefined = stageStyle
    ? (isComplexScript(word.text)
        ? (stageStyle.fontWeight !== undefined ? { fontWeight: stageStyle.fontWeight } : undefined)
        : stageStyle)
    : undefined;

  // Question mark slide-glide animation: emerge from behind the word synced with word progress
  const punctMatch = word.text.match(/^([\s\S]*?)(\?+|؟+|！？+|!\?+|\?!+)$/);
  const coreText = punctMatch ? punctMatch[1] : word.text;
  const punct = punctMatch ? punctMatch[2] : '';

  const punctProgress = Math.min(1, Math.max(0, (wordProgress - 0.2) / 0.8));
  const punctEased = isFullyPlayed || isPast ? 1 : isPlaying ? (1 - Math.pow(1 - punctProgress, 2.5)) : 0;
  const punctTransform = `translate3d(${-100 * (1 - punctEased)}%, 0.06em, 0)`;
  const punctOpacity = punctEased;

  return (
    <>
      {word.hasSpaceBefore && (
        <span aria-hidden="true" className="inline-block w-[0.24em] select-none pointer-events-none" />
      )}
      <span
        onClick={(e) => {
          e.stopPropagation();
          if (onSeek) onSeek(word.start);
        }}
      className={`relative inline-block overflow-visible my-1 px-0 py-[0.02em] cursor-pointer hover:brightness-125 transition-all select-none whitespace-nowrap ${
        word.isBracketed
          ? 'italic font-normal tracking-normal text-zinc-400 opacity-80'
          : ''
      } ${textSizeClass}`}
    >
      {/* 1. Fully Played State: Razor-Sharp Pure Solid White Typography */}
      {isFullyPlayed ? (
        <span
          className={`inline-block overflow-visible transition-colors font-extrabold ${
            isActive && !word.isBracketed
              ? 'text-white'
              : 'text-zinc-200'
          }`}
          style={wordStyle}
        >
          {coreText}
          {punct ? (
            <span
              className="relative inline-block overflow-visible align-baseline ml-[0.02em]"
              style={{ clipPath: 'inset(-30% 0 -30% 0)' }}
            >
              <span
                className="inline-block"
                style={{ transform: 'translate3d(0, 0.06em, 0)', opacity: 1 }}
              >
                {punct}
              </span>
            </span>
          ) : null}
        </span>
      ) : isPlaying ? (
        /* 2. Actively Singing State: GPU-clipped text sweep with zero shifting or duplication */
        <span className="relative inline-block overflow-visible whitespace-nowrap">
          {/* Base Layer: Crisp zinc unplayed text */}
          <span className="text-zinc-400/90 inline-block font-extrabold" style={wordStyle}>
            {coreText}
            {punct ? (
              <span
                className="relative inline-block overflow-visible align-baseline ml-[0.02em]"
                style={{ clipPath: 'inset(-30% 0 -30% 0)' }}
              >
                <span
                  className="inline-block will-change-transform"
                  style={{
                    transform: punctTransform,
                    opacity: punctOpacity,
                  }}
                >
                  {punct}
                </span>
              </span>
            ) : null}
          </span>
          {/* Highlight Sweep: Exactly superimposed white text, clipped cleanly from right to left */}
          <span
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none select-none font-extrabold text-white overflow-visible"
            style={{
              clipPath: `inset(0 ${(100 - fillPct).toFixed(2)}% 0 0)`,
              WebkitClipPath: `inset(0 ${(100 - fillPct).toFixed(2)}% 0 0)`,
              ...wordStyle,
            }}
          >
            {coreText}
            {punct ? (
              <span
                className="relative inline-block overflow-visible align-baseline ml-[0.02em]"
                style={{ clipPath: 'inset(-30% 0 -30% 0)' }}
              >
                <span
                  className="inline-block will-change-transform"
                  style={{
                    transform: punctTransform,
                    opacity: punctOpacity,
                  }}
                >
                  {punct}
                </span>
              </span>
            ) : null}
          </span>
        </span>
      ) : (
        /* 3. Inactive / Upcoming State: Clean legible tone */
        <span
          className={`inline-block overflow-visible transition-colors font-extrabold ${
            isPast
              ? word.isBracketed
                ? 'text-[#52525b]'
                : 'text-[#71717a]'
              : word.isBracketed
              ? 'text-[#71717a]'
              : isActive
              ? 'text-zinc-400'
              : 'text-[#8e8e96]'
          }`}
          style={wordStyle}
        >
          {coreText}
          {punct ? (
            <span
              className="relative inline-block overflow-visible align-baseline ml-[0.02em]"
              style={{ clipPath: 'inset(-30% 0 -30% 0)' }}
            >
              <span
                className="inline-block"
                style={{
                  transform: isPast ? 'translate3d(0, 0.06em, 0)' : 'translate3d(-100%, 0.06em, 0)',
                  opacity: isPast ? 1 : 0,
                }}
              >
                {punct}
              </span>
            </span>
          ) : null}
        </span>
      )}

      {/* Smooth Animated Vector Zig-Zag Underline for Emphasized Words */}
      {word.emphasis && (
        <AnimatedZigZagUnderline progress={wordProgress} isActive={isActive} />
      )}
    </span>
    </>
  );
});
LyricWordFill.displayName = 'LyricWordFill';

/**
 * Mountain Peak scene settings popover body.
 */
const PeakSettingsContent: React.FC<{
  textX?: number;
  textY: number;
  fontSize: number;
  parallax?: boolean;
  onUpdate?: (settings: {
    peakTextX?: number;
    peakTextY?: number;
    peakFontSize?: number;
    peakParallax?: boolean;
  }) => void;
}> = ({ textX = 0, textY, fontSize, parallax = false, onUpdate }) => {
  return (
    <div className="space-y-3 select-none">
      <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.08]">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[15px] text-zinc-300">terrain</span>
          <span className="text-xs font-bold text-white tracking-wide">Mountain Peak</span>
        </div>
        <span className="text-[10px] font-sans text-emerald-400 font-semibold">Single Word</span>
      </div>

      {/* Horizontal Alignment (Text X %) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400 font-medium">Position X (Horizontal)</span>
          <span className="font-sans text-white text-[10px]">
            {textX === 0 ? 'Center (0%)' : textX > 0 ? `+${textX}%` : `${textX}%`}
          </span>
        </div>
        <input
          type="range"
          min={-40}
          max={40}
          step={1}
          value={textX}
          onChange={(e) => onUpdate?.({ peakTextX: Number(e.target.value) })}
          className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
        />
        <div className="flex justify-between text-[9px] font-sans text-zinc-500">
          <span>Left</span>
          <span>Center</span>
          <span>Right</span>
        </div>
      </div>

      {/* Ridge Vertical Alignment (Text Y %) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400 font-medium">Position Y (Ridge Height)</span>
          <span className="font-sans text-white text-[10px]">{textY}%</span>
        </div>
        <input
          type="range"
          min={5}
          max={35}
          step={1}
          value={textY}
          onChange={(e) => onUpdate?.({ peakTextY: Number(e.target.value) })}
          className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
        />
        <div className="flex justify-between text-[9px] font-sans text-zinc-500">
          <span>Higher (5%)</span>
          <span>Ridge (16%)</span>
          <span>Lower (35%)</span>
        </div>
      </div>

      {/* Font Size Multiplier */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400 font-medium">Typography Scale</span>
          <span className="font-sans text-white text-[10px]">{fontSize.toFixed(2)}x</span>
        </div>
        <input
          type="range"
          min={0.7}
          max={1.6}
          step={0.05}
          value={fontSize}
          onChange={(e) => onUpdate?.({ peakFontSize: Number(e.target.value) })}
          className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
        />
      </div>

      {/* 3D Motion Parallax Toggle */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
        <div>
          <div className="text-[11px] font-medium text-zinc-300">3D Motion Parallax</div>
          <div className="text-[10px] text-zinc-500">Subtle depth tilting on cursor movement</div>
        </div>
        <button
          type="button"
          onClick={() => onUpdate?.({ peakParallax: !parallax })}
          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
            parallax
              ? 'bg-white text-zinc-950 shadow-sm'
              : 'bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/10'
          }`}
        >
          {parallax ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  );
};

/**
 * Alve Town scene settings popover body. Mounted fresh on every open so the
 * URL draft seeds from props via useState initializer (no sync effect).
 */
const AlveSettingsContent: React.FC<{
  dayNight: boolean;
  animated: boolean;
  dim: number;
  timeMode: AlveTimeMode;
  fontSize: number;
  stageFontLabel: string;
  onUpdate?: (settings: { alveDayNight?: boolean; alveAnimation?: boolean; alveDim?: number; alveTimeMode?: AlveTimeMode; alveFontSize?: number }) => void;
}> = ({ dayNight, animated, dim, timeMode, fontSize, stageFontLabel, onUpdate }) => {
  return (
    <>
      <div className="flex items-center gap-1.5 pb-2 border-b border-white/[0.08]">
        <span className="material-symbols-outlined text-sm text-cyan-400">image</span>
        <span className="text-xs font-bold text-white font-sans tracking-tight">Alve Town Scene</span>
      </div>

      <div>
        <span className="text-[11px] font-medium text-zinc-400 block mb-1.5">Time flow</span>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            { value: 'cycle', label: 'Cycle day' },
            { value: 'real', label: 'Real time' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onUpdate?.({ alveTimeMode: opt.value })}
              className={`py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                timeMode === opt.value
                  ? 'bg-white text-zinc-950 font-bold shadow-sm'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-zinc-500 font-sans mt-1">
          Cycle loops a full day smoothly; real follows your clock.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-zinc-400">Day-night sync</span>
        <button
          type="button"
          role="switch"
          aria-checked={dayNight}
          onClick={() => onUpdate?.({ alveDayNight: !dayNight })}
          className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer border ${dayNight ? 'bg-white border-white' : 'bg-white/[0.06] border-white/10'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${dayNight ? 'left-5 bg-zinc-950' : 'left-0.5 bg-zinc-400'}`} />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-medium text-zinc-400 block">Animation (GIF)</span>
          <span className="text-[10px] text-zinc-500 font-sans">CPU heavy, like lively</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={animated}
          onClick={() => onUpdate?.({ alveAnimation: !animated })}
          className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer border shrink-0 ${animated ? 'bg-white border-white' : 'bg-white/[0.06] border-white/10'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${animated ? 'left-5 bg-zinc-950' : 'left-0.5 bg-zinc-400'}`} />
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-zinc-400">Dim veil</span>
          <span className="text-[11px] font-sans text-white">{Math.round(dim * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={0.8}
          step={0.05}
          value={dim}
          onChange={(e) => onUpdate?.({ alveDim: Number(e.target.value) })}
          className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
        />
      </div>

      <div className="pt-3 border-t border-white/[0.08] space-y-3">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm text-cyan-400">text_fields</span>
          <span className="text-xs font-bold text-white font-sans tracking-tight">Billboard Type</span>
        </div>
        <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
          Font follows the Stage <span className="text-zinc-200 font-semibold">Font</span> picker
          (currently <span className="text-cyan-300">{stageFontLabel}</span>).
        </p>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-zinc-400">Size</span>
            <span className="text-[11px] font-sans text-white">{Math.round(fontSize * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.6}
            max={1.6}
            step={0.05}
            value={fontSize}
            onChange={(e) => onUpdate?.({ alveFontSize: Number(e.target.value) })}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
          />
        </div>
      </div>
    </>
  );
};

export const FlowLineRow: React.FC<{
  line: LyricLine;
  words: ParsedWord[];
  idx: number;
  isActive: boolean;
  isPast: boolean;
  currentTime: number;
  onSeek?: (time: number) => void;
  innerRef?: React.Ref<HTMLDivElement>;
  align?: 'center' | 'left';
  textSizeClass?: string;
  stageStyle?: React.CSSProperties;
}> = React.memo(
  ({
    line,
    words,
    idx,
    isActive,
    isPast,
    currentTime,
    onSeek,
    innerRef,
    align = 'center',
    textSizeClass,
    stageStyle,
  }) => {
    const isComplex = useMemo(() => isComplexScript(line.text), [line.text]);
    // Container-level family (beats the font-sans class); complex lines keep Noto.
    // Weight flows per-word via LyricWordFill (their font-extrabold classes
    // would otherwise beat inheritance).
    const containerStyle: React.CSSProperties | undefined =
      stageStyle && stageStyle.fontFamily && !isComplex
        ? { fontFamily: stageStyle.fontFamily }
        : undefined;

    return (
      <div
        ref={innerRef}
        onClick={() => onSeek && onSeek(line.start)}
        className={`relative transition-all duration-300 transform-gpu cursor-pointer max-w-4xl px-8 py-4 rounded-2xl overflow-visible ${
          align === 'left' ? 'text-left' : 'text-center'
        } ${
          isActive
            ? 'scale-[1.04] opacity-100 filter-none [transform:translateZ(0px)]'
            : isPast
            ? 'scale-[0.96] opacity-35 filter blur-[0.8px] hover:opacity-75 hover:blur-none [transform:perspective(800px)_rotateX(4deg)]'
            : 'scale-[0.96] opacity-40 filter blur-[0.6px] hover:opacity-75 hover:blur-none [transform:perspective(800px)_rotateX(-4deg)]'
        }`}
      >
        {/* Ambient Volumetric Stage Glow behind Active Line (Ultra-Soft Cinematic Light) */}
        {isActive && (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 -inset-y-4 rounded-3xl bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.02)_45%,transparent_75%)] pointer-events-none filter blur-xl -z-10 animate-in fade-in duration-300"
          />
        )}

        {/* Section Sub-header */}
        {line.section && (
          <div
            className={`flex items-center gap-2 mb-2 select-none ${
              align === 'left' ? 'justify-start' : 'justify-center'
            }`}
          >
            <span className="px-2 py-0.5 rounded text-[11px] font-sans font-semibold uppercase tracking-wider bg-white/[0.06] text-zinc-400 border border-white/[0.08]">
              {line.section}
            </span>
          </div>
        )}

        {/* Chronological Word Unrolling Container */}
        <div
          style={containerStyle}
          className={`flex flex-wrap items-baseline ${
            isComplex ? 'gap-x-0 gap-y-2' : 'gap-x-1.5 gap-y-2'
          } font-extrabold font-sans overflow-visible leading-[1.3] transition-transform duration-300 ${
            isComplex ? 'tracking-normal' : 'tracking-[-0.045em]'
          } ${
            line.vocalist === 'Partner'
              ? 'justify-end text-right text-2xl sm:text-3xl md:text-4xl translate-x-4 sm:translate-x-12'
              : line.vocalist === 'Backing'
              ? `${
                  align === 'left' ? 'justify-start text-left' : 'justify-center text-center'
                } text-2xl sm:text-3xl md:text-4xl opacity-80 italic`
              : textSizeClass
              ? `${
                  align === 'left' ? 'justify-start text-left' : 'justify-center text-center'
                } ${textSizeClass}`
              : align === 'left'
              ? 'justify-start text-left text-2xl sm:text-3xl md:text-4xl lg:text-5xl'
              : 'justify-center text-center text-3xl sm:text-4xl md:text-5xl'
          }`}
        >
          {words.map((word, wIdx) => {
            let wordProgress = 0;
            if (isActive) {
              if (currentTime >= word.end) {
                wordProgress = 1;
              } else if (currentTime > word.start && currentTime < word.end) {
                wordProgress =
                  (currentTime - word.start) / Math.max(0.01, word.end - word.start);
              }
            } else if (isPast) {
              wordProgress = 1;
            }

            return (
              <LyricWordFill
                key={wIdx}
                word={word}
                wordProgress={wordProgress}
                isActive={isActive}
                isPast={isPast}
                textSizeClass={
                  word.isBracketed
                    ? line.vocalist === 'Partner' || line.vocalist === 'Backing'
                      ? 'text-xl sm:text-2xl md:text-3xl'
                      : 'text-2xl sm:text-3xl md:text-4xl'
                    : ''
                }
                onSeek={onSeek}
                stageStyle={stageStyle}
              />
            );
          })}
        </div>
      </div>
    );
  },
  (prev, next) => {
    // If this line is active, it must re-render to update word-level fill
    if (next.isActive) return false;
    // If active transition happened, re-render
    if (prev.isActive !== next.isActive) return false;
    // If past status changed, re-render
    if (prev.isPast !== next.isPast) return false;
    // If line object changed, re-render
    if (prev.line !== next.line) return false;
    // If words changed, re-render
    if (prev.words !== next.words) return false;
    // If align changed, re-render
    if (prev.align !== next.align) return false;
    if (prev.textSizeClass !== next.textSizeClass) return false;
    if (prev.stageStyle !== next.stageStyle) return false;
    // Inactive lines do NOT need to re-render on continuous currentTime audio ticks!
    return true;
  }
);
FlowLineRow.displayName = 'FlowLineRow';

/**
 * Elegant White Musical Rhythm Indicator for Instrumental Breaks / Solos (Kinetic Stage)
 * Automatically detects gaps between sung lyrics and displays a pulsing white musical note
 * with 3 dancing soundwave equalizer pills and volumetric stage backlight.
 */
export interface InstrumentalGap {
  id: string;
  start: number;
  end: number;
}

export const InstrumentalGapIndicator: React.FC<{
  isActive: boolean;
  isPast: boolean;
  start: number;
  end: number;
  onSeek?: (time: number) => void;
  innerRef?: React.Ref<HTMLDivElement>;
}> = React.memo(({ isActive, isPast, start, end, onSeek, innerRef }) => {
  return (
    <div
      ref={innerRef}
      onClick={() => onSeek && onSeek(start)}
      className={`relative my-8 py-2 flex items-center justify-center transition-all duration-500 transform-gpu cursor-pointer select-none ${
        isActive
          ? 'scale-110 opacity-100 filter-none [transform:translateZ(0px)]'
          : isPast
          ? 'scale-90 opacity-20 filter blur-[0.6px] hover:opacity-60 hover:blur-none'
          : 'scale-90 opacity-25 filter blur-[0.6px] hover:opacity-60 hover:blur-none'
      }`}
    >
      {/* Soft Volumetric Radial Light Bloom when active */}
      {isActive && (
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.09)_0%,transparent_70%)] pointer-events-none filter blur-2xl -z-10 animate-in fade-in duration-300"
        />
      )}

      {/* Compact Solid White Music Note Icon */}
      <SolidMusicNote
        className={`transition-all duration-300 ${
          isActive
            ? 'text-white w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_0_16px_rgba(255,255,255,0.45)]'
            : 'text-zinc-500 w-5 h-5'
        }`}
      />
    </div>
  );
});
InstrumentalGapIndicator.displayName = 'InstrumentalGapIndicator';

export type DynamicFlowItem =
  | { type: 'line'; line: LyricLine; words: ParsedWord[]; isComplex: boolean; idx: number }
  | { type: 'gap'; gap: InstrumentalGap };

export function buildDynamicFlowItems(lines: LyricLine[]): DynamicFlowItem[] {
  if (!lines || lines.length === 0) return [];

  const items: DynamicFlowItem[] = [];

  // 1. Intro Gap (If first line begins >= 3.0s into track)
  if (lines[0].start >= 3.0) {
    items.push({
      type: 'gap',
      gap: {
        id: 'gap-intro',
        start: 0,
        end: lines[0].start,
      },
    });
  }

  // 2. Lines & Inter-Line Gaps (When distance between line[i].end and line[i+1].start >= 2.5s)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    items.push({
      type: 'line',
      line,
      words: getLineSequentialWords(line),
      isComplex: isComplexScript(line.text),
      idx: i,
    });

    if (i < lines.length - 1) {
      const nextLine = lines[i + 1];
      const gapDuration = nextLine.start - line.end;
      if (gapDuration >= 2.5) {
        items.push({
          type: 'gap',
          gap: {
            id: `gap-${i}-${i + 1}`,
            start: line.end,
            end: nextLine.start,
          },
        });
      }
    }
  }

  return items;
}

export const LyricRenderer: React.FC<LyricRendererProps> = React.memo(({
  lines,
  currentTime,
  songTitle = 'Untitled Track',
  artistName = 'Unknown Artist',
  coverArt,
  onSeek,
  viewMode: controlledMode,
  onViewModeChange,
  hasBackdrop = false,
  palette,
  hideControls = false,
  editorialMaxLines = 4,
  editorialCleanLyrics = true,
  editorialWordsPerRow = 0,
  onUpdateEditorialSettings,
  onUndoEditorial,
  canUndoEditorial = false,
  stageFontFamily = 'poppins',
  stageFontWeight = '500',
  onUpdateStageSettings,
  alveDayNight = true,
  alveAnimation = true,
  alveDim = 0.25,
  alveTimeMode = 'cycle',
  alveFontSize = 1,
  onUpdateAlveSettings,
  peakTextX = 0,
  peakTextY = 16,
  peakFontSize = 1,
  peakParallax = false,
  onUpdatePeakSettings,
  colorsBeatDivision = '4',
  onUpdateColorsSettings,
  colorsFontFamily = 'anton',
  colorsFontSize = 1,
  bpm,
  onBpmDetected,
  onOpenBpmModal,
  onActionToast,
}) => {
  const [internalMode, setInternalMode] = useState<RendererViewMode>('flow');
  const activeMode = controlledMode || internalMode;

  const handleModeChange = (mode: RendererViewMode) => {
    setInternalMode(mode);
    if (onViewModeChange) onViewModeChange(mode);
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeLineElemRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [isEditorialSettingsOpen, setIsEditorialSettingsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isFontSettingsOpen, setIsFontSettingsOpen] = useState(false);
  const fontPopoverRef = useRef<HTMLDivElement>(null);
  const [isAlveSettingsOpen, setIsAlveSettingsOpen] = useState(false);
  const alvePopoverRef = useRef<HTMLDivElement>(null);
  const [isPeakSettingsOpen, setIsPeakSettingsOpen] = useState(false);
  const peakPopoverRef = useRef<HTMLDivElement>(null);
  const [isColorsSettingsOpen, setIsColorsSettingsOpen] = useState(false);
  const colorsPopoverRef = useRef<HTMLDivElement>(null);
  const [isColorsFontSettingsOpen, setIsColorsFontSettingsOpen] = useState(false);
  const colorsFontPopoverRef = useRef<HTMLDivElement>(null);

  // Resolved stage typography: null = keep each mode's designed font/weight.
  // Applied as INLINE styles so they beat Tailwind font-black/extrabold/sans classes.
  const stageFontStack = buildStageFontStack(stageFontFamily);
  const stageWeight = stageFontWeightValue(stageFontWeight);

  // Lazily fetch the Google Font when selected (offline → fallback stack).
  useEffect(() => {
    ensureStageFontLoaded(stageFontFamily);
  }, [stageFontFamily]);

  // Disable the generic Stage Typography controls in Colors mode — Colors
  // has its own dedicated Font & Size controls.
  useEffect(() => {
    if (activeMode === 'colors' || activeMode === 'flythrough') {
      setIsFontSettingsOpen(false);
    }
  }, [activeMode]);

  const pokeHeader = () => {
    setHeaderVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setHeaderVisible(false), 2500);
  };

  // Keep header visible while any tuning popover is open
  useEffect(() => {
    if (isEditorialSettingsOpen || isFontSettingsOpen || isAlveSettingsOpen || isPeakSettingsOpen || isColorsSettingsOpen || isColorsFontSettingsOpen) {
      setHeaderVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }
  }, [isEditorialSettingsOpen, isFontSettingsOpen, isAlveSettingsOpen, isPeakSettingsOpen, isColorsSettingsOpen, isColorsFontSettingsOpen]);

  // Click outside to close editorial settings popover
  useEffect(() => {
    if (!isEditorialSettingsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsEditorialSettingsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isEditorialSettingsOpen]);

  // Click outside to close font settings popover
  useEffect(() => {
    if (!isFontSettingsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (fontPopoverRef.current && !fontPopoverRef.current.contains(e.target as Node)) {
        setIsFontSettingsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isFontSettingsOpen]);

  // Click outside to close alve settings popover
  useEffect(() => {
    if (!isAlveSettingsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (alvePopoverRef.current && !alvePopoverRef.current.contains(e.target as Node)) {
        setIsAlveSettingsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isAlveSettingsOpen]);

  // Click outside to close peak settings popover
  useEffect(() => {
    if (!isPeakSettingsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (peakPopoverRef.current && !peakPopoverRef.current.contains(e.target as Node)) {
        setIsPeakSettingsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isPeakSettingsOpen]);

  // Click outside to close colors settings popover
  useEffect(() => {
    if (!isColorsSettingsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (colorsPopoverRef.current && !colorsPopoverRef.current.contains(e.target as Node)) {
        setIsColorsSettingsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isColorsSettingsOpen]);

  // Click outside to close colors font settings popover
  useEffect(() => {
    if (!isColorsFontSettingsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (colorsFontPopoverRef.current && !colorsFontPopoverRef.current.contains(e.target as Node)) {
        setIsColorsFontSettingsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isColorsFontSettingsOpen]);

  // Initial auto-hide: show for 2.5s then hide
  useEffect(() => {
    hideTimerRef.current = setTimeout(() => setHeaderVisible(false), 2500);
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, []);

  const flowItems = useMemo(() => buildDynamicFlowItems(lines), [lines]);

  // Pre-parse sequential words for all lines to optimize 240 FPS renders
  const parsedLines = useMemo(() => {
    return lines.map((line) => ({
      line,
      words: getLineSequentialWords(line),
      isComplex: isComplexScript(line.text),
    }));
  }, [lines]);

  // Shared inline text style for custom stage typography. Inline declarations
  // beat the Tailwind font-black/extrabold/sans classes on lyric text while
  // leaving chrome (headers, labels) untouched. Memoized for stable identity
  // so FlowLineRow's custom comparator isn't defeated.
  const stageTextStyle: React.CSSProperties | undefined = useMemo(() => {
    const style: React.CSSProperties = {};
    if (stageFontStack) style.fontFamily = stageFontStack;
    if (stageWeight !== null) style.fontWeight = stageWeight;
    return Object.keys(style).length > 0 ? style : undefined;
  }, [stageFontStack, stageWeight]);

  const lastFlowIndexRef = useRef<number>(-1);
  const lastLineIndexRef = useRef<number>(-1);

  // High-performance O(1) temporal / O(log N) binary search active flow locator
  const activeFlowItemIndex = useMemo(() => {
    const len = flowItems.length;
    if (len === 0) return -1;

    const lastIdx = lastFlowIndexRef.current;
    if (lastIdx >= 0 && lastIdx < len) {
      const cur = flowItems[lastIdx];
      const curStart = cur.type === 'line' ? cur.line.start : cur.gap.start;
      const curEnd = cur.type === 'line' ? cur.line.end : cur.gap.end;
      if (currentTime >= curStart && currentTime <= curEnd) {
        return lastIdx;
      }
      const nextIdx = lastIdx + 1;
      if (nextIdx < len) {
        const next = flowItems[nextIdx];
        const nextStart = next.type === 'line' ? next.line.start : next.gap.start;
        const nextEnd = next.type === 'line' ? next.line.end : next.gap.end;
        if (currentTime >= nextStart && currentTime <= nextEnd) {
          lastFlowIndexRef.current = nextIdx;
          return nextIdx;
        }
      }
    }

    // Binary search on jumps / seeks
    let low = 0;
    let high = len - 1;
    let best = -1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const item = flowItems[mid];
      const itemStart = item.type === 'line' ? item.line.start : item.gap.start;
      if (itemStart <= currentTime) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    lastFlowIndexRef.current = best;
    return best;
  }, [flowItems, currentTime]);

  // High-performance O(1) temporal / O(log N) binary search active line locator
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
      if (
        nextIdx < len &&
        currentTime >= lines[nextIdx].start &&
        (nextIdx === len - 1 || currentTime < lines[nextIdx + 1].start)
      ) {
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

  const activeLineItem = activeLineIndex >= 0 ? parsedLines[activeLineIndex] : undefined;

  // Active instrumental gap detector for Stage Focus & Karaoke Lead
  const activeGap = useMemo(() => {
    if (lines.length === 0) return null;
    if (currentTime < lines[0].start && lines[0].start >= 2.5) {
      return { start: 0, end: lines[0].start };
    }
    if (activeLineIndex >= 0 && activeLineIndex < lines.length - 1) {
      const curLine = lines[activeLineIndex];
      const nextLine = lines[activeLineIndex + 1];
      if (
        currentTime >= curLine.end &&
        currentTime < nextLine.start &&
        nextLine.start - curLine.end >= 2.5
      ) {
        return {
          start: curLine.end,
          end: nextLine.start,
        };
      }
    }
    return null;
  }, [lines, currentTime, activeLineIndex]);

  // P1 perf: sequential line advances use instant ('auto') scrolling — 'smooth'
  // on every line change queues competing animations during continuous playback.
  // Seeks/jumps (non-consecutive) keep 'smooth' for orientation.
  const lastScrolledFlowIndexRef = useRef<number>(-1);
  useEffect(() => {
    if (activeMode === 'flow' && activeLineElemRef.current) {
      const sequential = activeFlowItemIndex === lastScrolledFlowIndexRef.current + 1;
      lastScrolledFlowIndexRef.current = activeFlowItemIndex;
      activeLineElemRef.current.scrollIntoView({
        behavior: sequential ? 'auto' : 'smooth',
        block: 'center',
      });
    }
  }, [activeFlowItemIndex, activeMode]);

  return (
    <div
      onMouseMove={pokeHeader}
      className={`flex-1 relative w-full h-full overflow-hidden select-none ${hideControls ? '' : 'border-l border-white/[0.08]'} z-10 ${
        hasBackdrop || activeMode === 'editorial' || activeMode === 'peak' || activeMode === 'colors' || activeMode === 'flythrough' ? 'bg-transparent' : 'bg-[#0b0b0e]'
      }`}
    >
      {/* Sleek Minimalist Performance Header — auto-hides after 2.5s of inactivity, overlays top edge */}
      {!hideControls && (
        <div
          className={`absolute top-0 left-0 right-0 h-11 sm:h-12 bg-black/40 backdrop-blur-md border-b border-white/[0.08] px-3 sm:px-6 flex items-center justify-between z-30 ${
            isEditorialSettingsOpen || isFontSettingsOpen || isAlveSettingsOpen || isPeakSettingsOpen || isColorsSettingsOpen || isColorsFontSettingsOpen
              ? 'overflow-visible'
              : 'overflow-x-auto no-scrollbar'
          } gap-2 transition-all duration-500 ${
            headerVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Minimal Pill Segmented Mode Switcher */}
          <div data-tutorial="stage-presets" className="flex items-center rounded-lg bg-white/[0.04] border border-white/[0.07] p-0.5 shrink-0">
            <button
              onClick={() => handleModeChange('flow')}
              className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activeMode === 'flow' ? 'bg-white text-zinc-950 shadow-sm font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Flowy
            </button>
            <button
              onClick={() => handleModeChange('stage')}
              className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activeMode === 'stage' ? 'bg-white text-zinc-950 shadow-sm font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Karaoke
            </button>
            <button
              onClick={() => handleModeChange('kinetic')}
              className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activeMode === 'kinetic' ? 'bg-white text-zinc-950 shadow-sm font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Kinetic
            </button>
            <button
              onClick={() => handleModeChange('editorial')}
              className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activeMode === 'editorial' ? 'bg-white text-zinc-950 shadow-sm font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Elegant
            </button>
            <button
              onClick={() => handleModeChange('alve')}
              className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activeMode === 'alve' ? 'bg-white text-zinc-950 shadow-sm font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span className="sm:hidden">Alve</span>
              <span className="hidden sm:inline">Alve Town</span>
            </button>
            <button
              onClick={() => handleModeChange('peak')}
              className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activeMode === 'peak' ? 'bg-white text-zinc-950 shadow-sm font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span className="sm:hidden">Peak</span>
              <span className="hidden sm:inline">Mountain Peak</span>
            </button>
            <button
              onClick={() => handleModeChange('flythrough')}
              className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activeMode === 'flythrough' ? 'bg-white text-zinc-950 shadow-sm font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span className="sm:hidden">Fly</span>
              <span className="hidden sm:inline">Flythrough</span>
            </button>
            <button
              onClick={() => handleModeChange('colors')}
              className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                activeMode === 'colors' ? 'bg-white text-zinc-950 shadow-sm font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Colors
            </button>
          </div>

          {/* Stage Font picker — hidden in Colors mode */}
          {activeMode !== 'colors' && activeMode !== 'flythrough' && (
          <div className="relative shrink-0" ref={fontPopoverRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsFontSettingsOpen((prev) => !prev);
                pokeHeader();
              }}
              title="Stage Font: Google Font family & weight"
              className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer select-none ${
                isFontSettingsOpen
                  ? 'bg-white text-zinc-950 border-white shadow-md font-bold'
                  : 'bg-white/[0.05] text-zinc-300 hover:text-white border-white/[0.08] hover:bg-white/10'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">text_fields</span>
              <span className="hidden sm:inline text-[11px] font-semibold">Font</span>
            </button>

            <AnimatePresence>
              {isFontSettingsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.96 }}
                  transition={{ duration: 0.14 }}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  className="absolute top-9 left-0 sm:left-auto sm:right-0 z-50 w-72 bg-[#121216]/98 border border-white/[0.14] rounded-xl shadow-2xl backdrop-blur-2xl p-3 text-zinc-200 select-none"
                >
                  <div className="flex items-center gap-1.5 pb-2 mb-2.5 border-b border-white/[0.08]">
                    <span className="material-symbols-outlined text-sm text-cyan-400">text_fields</span>
                    <span className="text-xs font-bold text-white font-sans tracking-tight">Stage Typography</span>
                  </div>
                  <StageFontControls
                    fontFamily={stageFontFamily}
                    fontWeight={stageFontWeight}
                    showPositionControls={activeMode === 'peak'}
                    fontSize={peakFontSize}
                    textX={peakTextX}
                    textY={peakTextY}
                    onChange={(patch) => {
                      onUpdateStageSettings?.(patch);
                      if (activeMode === 'peak') onUpdatePeakSettings?.(patch);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          )}

          {/* Alve Town scene settings — only in Alve mode */}
          {activeMode === 'alve' && (
            <div className="relative shrink-0" ref={alvePopoverRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAlveSettingsOpen((prev) => !prev);
                  pokeHeader();
                }}
                title="Alve Town: scene image, day-night sync, lyric position"
                className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer select-none ${
                  isAlveSettingsOpen
                    ? 'bg-white text-zinc-950 border-white shadow-md font-bold'
                    : 'bg-white/[0.05] text-zinc-300 hover:text-white border-white/[0.08] hover:bg-white/10'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">image</span>
                <span className="hidden sm:inline text-[11px] font-semibold">Scene</span>
              </button>

              <AnimatePresence>
                {isAlveSettingsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.14 }}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    className="absolute top-9 left-0 sm:left-auto sm:right-0 z-50 w-72 bg-[#121216]/98 border border-white/[0.14] rounded-xl shadow-2xl backdrop-blur-2xl p-3 text-zinc-200 select-none space-y-3"
                  >
                    {/* Remounts every open: no sync effect needed */}
                    <AlveSettingsContent
                      key="alve-settings"
                      dayNight={alveDayNight}
                      animated={alveAnimation}
                      dim={alveDim}
                      timeMode={alveTimeMode}
                      fontSize={alveFontSize}
                      stageFontLabel={getStageFontOption(stageFontFamily).label}
                      onUpdate={onUpdateAlveSettings}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Mountain Peak scene settings — only in Peak mode */}
          {activeMode === 'peak' && (
            <div className="relative shrink-0" ref={peakPopoverRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPeakSettingsOpen((prev) => !prev);
                  pokeHeader();
                }}
                title="Mountain Peak: Ridge alignment, scale, words per view, parallax"
                className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer select-none ${
                  isPeakSettingsOpen
                    ? 'bg-white text-zinc-950 border-white shadow-md font-bold'
                    : 'bg-white/[0.05] text-zinc-300 hover:text-white border-white/[0.08] hover:bg-white/10'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">terrain</span>
                <span className="hidden sm:inline text-[11px] font-semibold">Ridge</span>
              </button>

              <AnimatePresence>
                {isPeakSettingsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.14 }}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    className="absolute top-9 left-0 sm:left-auto sm:right-0 z-50 w-72 bg-[#121216]/98 border border-white/[0.14] rounded-xl shadow-2xl backdrop-blur-2xl p-3 text-zinc-200 select-none space-y-3"
                  >
                    <PeakSettingsContent
                      textX={peakTextX}
                      textY={peakTextY}
                      fontSize={peakFontSize}
                      parallax={peakParallax}
                      onUpdate={onUpdatePeakSettings}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Clean Settings Icon for Editorial Mode */}
          {activeMode === 'editorial' && (
            <div className="relative shrink-0" ref={popoverRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditorialSettingsOpen((prev) => !prev);
                  pokeHeader();
                }}
                title="Elegant Settings: Max Lines & Clean Lyrics"
                className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer select-none ${
                  isEditorialSettingsOpen
                    ? 'bg-white text-zinc-950 border-white shadow-md font-bold'
                    : 'bg-white/[0.05] text-zinc-300 hover:text-white border-white/[0.08] hover:bg-white/10'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">tune</span>
                <span className="hidden sm:inline text-[11px] font-semibold">Layout</span>
              </button>

              <AnimatePresence>
                {isEditorialSettingsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.14 }}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    className="absolute top-9 left-0 sm:left-auto sm:right-0 z-50 w-72 bg-[#121216]/98 border border-white/[0.14] rounded-xl shadow-2xl backdrop-blur-2xl p-3 text-zinc-200 select-none"
                  >
                    {/* Popover Header */}
                    <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/[0.08]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white font-sans tracking-tight">Elegant Layout</span>
                      </div>
                      {canUndoEditorial && (
                        <button
                          type="button"
                          onClick={() => {
                            onUndoEditorial?.();
                          }}
                          title="Undo last layout change"
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.08] hover:bg-white/[0.16] text-[10px] font-semibold text-zinc-200 hover:text-white transition-all cursor-pointer active:scale-95"
                        >
                          <span className="material-symbols-outlined text-xs">undo</span>
                          <span>Undo</span>
                        </button>
                      )}
                    </div>

                    {/* 1. Layout Mode & Lines Segmented Picker */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-medium text-zinc-400">Layout Sub-Mode</span>
                        <span className="text-[11px] font-bold text-cyan-300">
                          {editorialMaxLines === 1
                            ? '1 Row (Horizontal)'
                            : editorialMaxLines === 99
                            ? 'Tower (1/line)'
                            : `${editorialMaxLines} lines`}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                        {[1, 2, 3, 4, 99].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => onUpdateEditorialSettings?.({ maxLines: num })}
                            className={`py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                              editorialMaxLines === num
                                ? 'bg-white text-zinc-950 font-bold shadow-sm'
                                : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                            }`}
                          >
                            {num === 1 ? '1 Row' : num === 99 ? 'Tower' : `${num}`}
                          </button>
                        ))}
                      </div>

                      {/* Words per Row (in 1 Row Horizontal Flow mode) */}
                      {editorialMaxLines === 1 && (
                        <div className="mt-2.5 pt-2 border-t border-white/[0.08] flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-zinc-400">Words per Row</span>
                            <span className="text-[11px] font-bold text-cyan-300">
                              {(editorialWordsPerRow ?? 0) === 0 ? 'Sentence' : `${editorialWordsPerRow} words`}
                            </span>
                          </div>
                          <div className="grid grid-cols-5 gap-1 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                            {[
                              { label: 'Sentence', val: 0 },
                              { label: '4', val: 4 },
                              { label: '5', val: 5 },
                              { label: '6', val: 6 },
                              { label: '8', val: 8 },
                            ].map(({ label, val }) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => onUpdateEditorialSettings?.({ wordsPerRow: val })}
                                className={`py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                                  (editorialWordsPerRow ?? 0) === val
                                    ? 'bg-cyan-500 text-black font-bold shadow-sm'
                                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. Format: Clean Lyrics Toggle */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
                      <div className="flex flex-col pr-2">
                        <span className="text-[11px] font-semibold text-zinc-200">Format: Clean Lyrics</span>
                        <span className="text-[10px] text-zinc-500 leading-tight">
                          Strips commas, periods & brackets for pure editorial typography
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onUpdateEditorialSettings?.({ cleanLyrics: !editorialCleanLyrics })}
                        title={editorialCleanLyrics ? 'Disable Clean Lyrics' : 'Enable Clean Lyrics'}
                        className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                          editorialCleanLyrics ? 'bg-cyan-500' : 'bg-white/[0.15]'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-[3px] ${
                            editorialCleanLyrics ? 'left-[18px]' : 'left-[3px]'
                          }`}
                        />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Colors mode: Beat sync rhythm selector (1/4, 2/4, 4/4, line) */}
          {activeMode === 'colors' && (
            <div className="flex items-center gap-1.5 shrink-0">
              {/* 1. Rhythm Division Popover */}
              <div className="relative shrink-0" ref={colorsPopoverRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsColorsSettingsOpen((prev) => !prev);
                    pokeHeader();
                  }}
                  title="Colors Rhythm: 4/4 Measure, 2/4 Beat, 1/4 Strobe, or Per Line"
                  className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer select-none ${
                    isColorsSettingsOpen
                      ? 'bg-white text-zinc-950 border-white shadow-md font-bold'
                      : 'bg-white/[0.05] text-zinc-300 hover:text-white border-white/[0.08] hover:bg-white/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">timer</span>
                  <span className="text-[11px] font-semibold">
                    {colorsBeatDivision === '1'
                      ? '1/4 Beat'
                      : colorsBeatDivision === '2'
                      ? '2/4 Beat'
                      : colorsBeatDivision === 'drums'
                      ? 'Drum Beats'
                      : colorsBeatDivision === 'line'
                      ? 'Line'
                      : colorsBeatDivision === 'alternate'
                      ? 'Alternate'
                      : '4/4 Beat'}
                  </span>
                </button>

                <AnimatePresence>
                  {isColorsSettingsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.14 }}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      className="absolute top-9 left-0 sm:left-auto sm:right-0 z-50 w-76 bg-[#121216]/98 border border-white/[0.14] rounded-xl shadow-2xl backdrop-blur-2xl p-3 text-zinc-200 select-none space-y-2.5"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-zinc-400">palette</span>
                          <span className="text-xs font-bold text-white font-sans tracking-tight">Colors Rhythm & Sync</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsColorsSettingsOpen(false);
                            onOpenBpmModal?.();
                          }}
                          title="Search or set track tempo"
                          className="flex items-center gap-1 text-[10px] font-sans px-2 py-0.5 rounded bg-white/[0.08] hover:bg-white/15 text-zinc-300 hover:text-white border border-white/10 transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[12px]">search</span>
                          <span>{bpm ? `${bpm} BPM` : 'Tempo'}</span>
                        </button>
                      </div>

                      <div className="text-[11px] text-zinc-400 font-medium">
                        Select how frequently full-screen colors change:
                      </div>

                      <div className="space-y-1.5">
                        {[
                          {
                            id: '4' as const,
                            label: '4/4 Measure (Default)',
                            badge: 'Recommended',
                            desc: 'Changes every 4 beats on the downbeat (~1.7s). Musical, smooth, no eye strain.',
                          },
                          {
                            id: 'drums' as const,
                            label: 'Sync to Drum Beats',
                            badge: 'Kick & Snare',
                            desc: 'Flashes color on each kick and snare beat, then dims to black in sync with tempo.',
                          },
                          {
                            id: '2' as const,
                            label: '2/4 Half-Measure',
                            badge: 'Bouncy',
                            desc: 'Changes every 2 beats (~0.8s). Energetic backbeat pace.',
                          },
                          {
                            id: '1' as const,
                            label: '1/4 Strobe (Every Beat)',
                            badge: 'Strobe',
                            desc: 'Changes on every single beat (~0.4s). Fast club strobe effect.',
                          },
                          {
                            id: 'line' as const,
                            label: 'Lyric Line',
                            badge: 'Vocal',
                            desc: 'Changes color whenever the singing line advances.',
                          },
                          {
                            id: 'alternate' as const,
                            label: 'Alternate',
                            badge: 'Swap',
                            desc: 'Colors background with white text, then white background with color text on the next cycle.',
                          },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              onUpdateColorsSettings?.({ colorsBeatDivision: opt.id });
                              onActionToast?.(`Colors mode: ${opt.label}`, null, {
                                actionType: 'info',
                                durationMs: 3000,
                              });
                              setIsColorsSettingsOpen(false);
                            }}
                            className={`w-full text-left p-2 rounded-lg border transition-all cursor-pointer ${
                              (colorsBeatDivision || '4') === opt.id
                                ? 'bg-white/10 border-white/30 text-white shadow-sm'
                                : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.06] text-zinc-300 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold">{opt.label}</span>
                              <span className="text-[9.5px] font-sans px-1 py-0.2 rounded bg-white/[0.08] text-zinc-400">
                                {opt.badge}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-400 mt-0.5 leading-snug">
                              {opt.desc}
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Dedicated Tempo Finder Button */}
                      <div className="pt-2 border-t border-white/[0.08]">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsColorsSettingsOpen(false);
                            onOpenBpmModal?.();
                          }}
                          className="w-full py-2 px-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 hover:border-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                        >
                          <span className="material-symbols-outlined text-sm">speed</span>
                          <span>Find Tempo</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 2. Colors Font & Size Popover */}
              <div className="relative shrink-0" ref={colorsFontPopoverRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsColorsFontSettingsOpen((prev) => !prev);
                    pokeHeader();
                  }}
                  title="Colors Font & Size"
                  className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer select-none ${
                    isColorsFontSettingsOpen
                      ? 'bg-white text-zinc-950 border-white shadow-md font-bold'
                      : 'bg-white/[0.05] text-zinc-300 hover:text-white border-white/[0.08] hover:bg-white/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">text_fields</span>
                  <span className="text-[11px] font-semibold whitespace-nowrap">
                    {COLORS_FONT_OPTIONS.find((opt) => opt.id === (colorsFontFamily || 'anton'))?.label ?? 'Anton'} · {Math.round((colorsFontSize ?? 1) * 100)}%
                  </span>
                </button>

                <AnimatePresence>
                  {isColorsFontSettingsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.14 }}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      className="absolute top-9 left-0 sm:left-auto sm:right-0 z-50 w-64 max-h-[calc(100vh-4rem)] overflow-y-auto bg-[#121216]/98 border border-white/[0.14] rounded-xl shadow-2xl backdrop-blur-2xl p-3 text-zinc-200 select-none space-y-2.5"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-zinc-400">format_size</span>
                          <span className="text-xs font-bold text-white font-sans tracking-tight">Colors Font & Size</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateColorsSettings?.({ colorsFontFamily: 'anton', colorsFontSize: 1 });
                            onActionToast?.('Colors font reset', null, {
                              actionType: 'info',
                              durationMs: 3000,
                            });
                          }}
                          title="Reset Colors font and size"
                          className="flex items-center gap-1 text-[10px] font-sans px-2 py-0.5 rounded bg-white/[0.08] hover:bg-white/15 text-zinc-300 hover:text-white border border-white/10 transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[12px]">restart_alt</span>
                          Reset
                        </button>
                      </div>

                      <div className="text-[11px] text-zinc-400 font-medium">Lyrics Font</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {COLORS_FONT_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateColorsSettings?.({ colorsFontFamily: opt.id });
                              onActionToast?.(`Colors font: ${opt.label}`, null, {
                                actionType: 'info',
                                durationMs: 3000,
                              });
                              setIsColorsFontSettingsOpen(false);
                            }}
                            className={`px-2 py-1.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                              (colorsFontFamily || 'anton') === opt.id
                                ? 'bg-white text-zinc-950 border-white font-bold'
                                : 'bg-white/[0.03] border-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/[0.06]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-white/[0.08] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] text-zinc-400 font-medium">Text Size</div>
                          <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-white/[0.08] text-zinc-200 border border-white/10">
                            {Math.round((colorsFontSize ?? 1) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.6}
                          max={1.6}
                          step={0.05}
                          value={colorsFontSize ?? 1}
                          onChange={(e) => {
                            onUpdateColorsSettings?.({ colorsFontSize: Number(e.target.value) });
                          }}
                          className="w-full h-1.5 accent-white cursor-pointer"
                        />
                        <div className="text-[9.5px] text-zinc-500 leading-snug">
                          Scale on the auto-fit lyric font size (0.6x–1.6x).
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 3. Quick AutoBPM Modal Trigger Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenBpmModal?.();
                  pokeHeader();
                }}
                title="Track tempo: search, tap beat, or enter custom BPM"
                className="flex items-center gap-1 h-7 px-2 rounded-lg border text-xs font-medium bg-white/[0.05] text-zinc-300 hover:text-white border-white/[0.08] hover:bg-white/10 transition-all cursor-pointer select-none"
              >
                <span className="material-symbols-outlined text-[15px] text-zinc-400">speed</span>
                <span className="text-[11px] font-semibold">{bpm ? `${bpm} BPM` : 'Tempo'}</span>
              </button>
            </div>
          )}
        </div>

        <div className="text-xs font-sans text-zinc-300 font-medium truncate max-w-[140px] sm:max-w-[280px]">
          {songTitle || 'Untitled Track'} {artistName && artistName !== 'Untitled Artist' && artistName !== 'Sample Artist' ? `· ${artistName}` : ''}
        </div>
      </div>
      )}

      {/* 🛑 Empty State When No Lyrics Loaded */}
      {lines.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center select-none">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-zinc-500 mb-3 shadow-xl">
            <span className="material-symbols-outlined text-3xl">lyrics</span>
          </div>
          <h3 className="text-sm font-bold text-zinc-300 mb-1">No Lyrics Loaded</h3>
          <p className="text-xs text-zinc-500 max-w-sm leading-relaxed">
            Import an .LRC file, paste lyrics in the Editor, or load from Cloud Catalog to preview live playback.
          </p>
        </div>
      )}

      {/* 🌊 1. DYNAMIC FLOW MODE: 60/240 FPS Chronological Kinetic Scrolling View with 3D Depth & Instrumental Gaps */}
      {lines.length > 0 && activeMode === 'flow' && (
        <div
          ref={scrollContainerRef}
          className="absolute inset-0 overflow-y-auto px-8 pt-16 sm:pt-20 pb-36 flex flex-col gap-8 items-center custom-scrollbar scroll-smooth [perspective:1000px]"
        >
          {flowItems.map((item, idx) => {
            const isActive = idx === activeFlowItemIndex;
            const isPast = idx < activeFlowItemIndex;

            if (item.type === 'gap') {
              return (
                <InstrumentalGapIndicator
                  key={item.gap.id}
                  isActive={isActive}
                  isPast={isPast}
                  start={item.gap.start}
                  end={item.gap.end}
                  onSeek={onSeek}
                  innerRef={isActive ? activeLineElemRef : undefined}
                />
              );
            }

            return (
              <FlowLineRow
                key={item.line.id ? `${item.line.id}_${item.idx}` : `flow-${item.idx}`}
                line={item.line}
                words={item.words}
                idx={item.idx}
                isActive={isActive}
                isPast={isPast}
                currentTime={currentTime}
                onSeek={onSeek}
                innerRef={isActive ? activeLineElemRef : undefined}
                stageStyle={stageTextStyle}
              />
            );
          })}
        </div>
      )}

      {/* 🌟 2. STAGE FOCUS MODE: Single Centered Active Line or Animated Musical Note during Gaps */}
      {lines.length > 0 && activeMode === 'stage' && (
        <div className="absolute inset-0 flex items-center justify-center p-8 overflow-hidden text-center w-full">
          {/* Ambient Stage Focus Radial Backlight */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.015)_50%,transparent_80%)] pointer-events-none filter blur-2xl -z-10"
          />
          {activeLineItem && !activeGap ? (
            <div className="w-full flex items-center justify-center px-4 overflow-visible">
              <div
                onClick={() => onSeek && onSeek(activeLineItem.line.start)}
                style={
                  stageTextStyle && !activeLineItem.isComplex
                    ? stageTextStyle
                    : stageTextStyle?.fontWeight !== undefined
                      ? { fontWeight: stageTextStyle.fontWeight }
                      : undefined
                }
                className={`flex flex-wrap items-baseline ${
                  activeLineItem.isComplex ? 'gap-x-0 gap-y-3' : 'gap-x-2 gap-y-3'
                } font-black text-white leading-[1.3] font-sans max-w-5xl overflow-visible cursor-pointer transition-transform duration-300 ${
                  activeLineItem.isComplex ? 'tracking-normal' : 'tracking-[-0.045em]'
                } ${
                  activeLineItem.line.vocalist === 'Partner'
                    ? 'justify-end text-right translate-x-4 sm:translate-x-12 text-4xl sm:text-5xl md:text-6xl lg:text-7xl'
                    : activeLineItem.line.vocalist === 'Backing'
                    ? 'justify-center text-center text-4xl sm:text-5xl md:text-6xl lg:text-7xl opacity-80 italic'
                    : 'justify-center text-center text-5xl sm:text-6xl md:text-7xl lg:text-8xl'
                }`}
              >
                {activeLineItem.words.map((word, wIdx) => {
                  let wordProgress = 0;
                  if (currentTime >= word.end) {
                    wordProgress = 1;
                  } else if (currentTime > word.start && currentTime < word.end) {
                    wordProgress = (currentTime - word.start) / Math.max(0.01, word.end - word.start);
                  }

                  return (
                    <LyricWordFill
                      key={wIdx}
                      word={word}
                      wordProgress={wordProgress}
                      isActive={true}
                      isPast={false}
                      textSizeClass={
                        word.isBracketed
                          ? 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl'
                          : ''
                      }
                      onSeek={onSeek}
                      stageStyle={stageTextStyle}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center select-none animate-in fade-in zoom-in-95 duration-300">
              <SolidMusicNote className="w-9 h-9 sm:w-10 sm:h-10 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.35)]" />
            </div>
          )}
        </div>
      )}

      {/* ✳ KINETIC TYPE MODE: Poster (uniform justified rows) */}
      {lines.length > 0 && activeMode === 'kinetic' && (
        <div className="absolute inset-0 flex flex-col w-full h-full min-h-0 overflow-hidden text-center [container-type:size]">
          <KineticPosterRenderer
            lines={lines}
            currentTime={currentTime}
            onSeek={onSeek}
            trackTitle={songTitle}
            artistName={artistName}
            coverArt={coverArt}
            stageFontFamily={stageFontFamily}
            stageFontWeight={stageFontWeight}
          />
        </div>
      )}

      {/* ✳ EDITORIAL STACK MODE: Vertical Cascading Fraunces Serif Typography */}
      {lines.length > 0 && activeMode === 'editorial' && (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <EditorialStackRenderer
            lines={lines}
            currentTime={currentTime}
            songTitle={songTitle}
            artistName={artistName}
            onSeek={onSeek}
            palette={palette}
            maxLines={editorialMaxLines}
            cleanLyrics={editorialCleanLyrics}
            wordsPerRow={editorialWordsPerRow}
            stageFontFamily={stageFontFamily}
            stageFontWeight={stageFontWeight}
          />
        </div>
      )}

      {/* ✳ ALVE TOWN MODE: time-synced pixel town with billboard ticker */}
      {activeMode === 'alve' && (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <AlveTownRenderer
            lines={lines}
            currentTime={currentTime}
            activeLineIndex={activeLineIndex}
            animated={alveAnimation}
            dayNight={alveDayNight}
            dim={alveDim}
            timeMode={alveTimeMode}
            fontFamily={stageFontFamily}
            fontSize={alveFontSize}
            fontWeight={stageFontWeight}
            onSeek={onSeek}
          />
        </div>
      )}

      {/* ⛰ MOUNTAIN PEAK MODE: Single word precisely timed, super large size behind mountain ridge */}
      {lines.length > 0 && activeMode === 'peak' && (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <MountainPeakRenderer
            lines={lines}
            currentTime={currentTime}
            onSeek={onSeek}
            trackTitle={songTitle}
            artistName={artistName}
            stageFontFamily={stageFontFamily}
            stageFontWeight={stageFontWeight}
            textXPercent={peakTextX}
            textYPercent={peakTextY}
            fontSizeMultiplier={peakFontSize}
            parallaxEnabled={peakParallax ?? false}
          />
        </div>
      )}

      {/* 🎬 FLYTHROUGH MODE: continuous 3D corridor, camera dollies through timed lyric lines */}
      {lines.length > 0 && activeMode === 'flythrough' && (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <FlythroughRenderer
            lines={lines}
            currentTime={currentTime}
            bpm={bpm}
          />
        </div>
      )}

      {/* 🎨 COLORS MODE: Full-bleed pop-art poster with dynamic Anton sizing & beat-synced rhythm */}
      {lines.length > 0 && activeMode === 'colors' && (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <ColorsViewRenderer
            lines={lines}
            currentTime={currentTime}
            onSeek={onSeek}
            trackTitle={songTitle}
            artistName={artistName}
            bpm={bpm}
            beatDivision={colorsBeatDivision || '4'}
            fontFamilyId={colorsFontFamily}
            fontSize={colorsFontSize}
            onBpmDetected={onBpmDetected}
          />
        </div>
      )}
    </div>
  );
});
LyricRenderer.displayName = 'LyricRenderer';

