'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { LyricLine } from '@/types/lyrics';
import { ColorsBeatDivision } from '@/types/settings';
import { SingleLyricWord } from './MountainPeakRenderer';
import { buildStageFontStack, ensureStageFontLoaded } from '@/lib/stageFonts';

export interface ColorsViewRendererProps {
  lines: LyricLine[];
  currentTime: number;
  trackTitle?: string;
  artistName?: string;
  bpm?: number | null;
  beatDivision?: ColorsBeatDivision;
  onSeek?: (time: number) => void;
  onBpmDetected?: (bpm: number) => void;
  /** Stage font option id for the Colors lyric text. Default: 'anton' (Colors designed display font). */
  fontFamilyId?: string;
  /** Scale multiplier on the dynamic font fit (0.6..1.6). Default: 1 (auto-fit). */
  fontSize?: number;
}

/**
 * Vibrant pop-art poster color palette directly modeled on reference visuals.
 * Line 0: Coral Red (#ff5757)
 * Line 1: Electric Lime (#7ed957)
 * Line 2: Orchid Purple (#cb6ce6)
 * Line 3+: High-contrast vivid primaries.
 */
export const COLORS_PALETTE = [
  '#ff5757', // Coral Red
  '#7ed957', // Electric Lime
  '#cb6ce6', // Orchid Purple
  '#ff914d', // Vibrant Tangerine
  '#00c2cb', // Cyan Aqua
  '#ffde59', // Canary Yellow
  '#5271ff', // Electric Cobalt Blue
  '#ff5e7e', // Neon Watermelon
  '#00e676', // Mint Green
  '#b388ff', // Vivid Lavender
];

// Pre-computed RGB triples for 120 FPS drum beat color dimming
const COLORS_RGB: [number, number, number][] = COLORS_PALETTE.map((hex) => {
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
});

// Global in-memory BPM cache across component mounts
const bpmMemoryCache = new Map<string, number>();

/**
 * Strips secondary / background vocal lyrics inside parentheses `(...)` or brackets `[...]`.
 * Builds single words for the lead singer only.
 */
export function buildColorsLyricWords(lines: LyricLine[]): SingleLyricWord[] {
  const words: SingleLyricWord[] = [];

  lines.forEach((line, lineIdx) => {
    const rawText = (line.text || '').trim();
    if (!rawText) return;

    // Skip entire line if it is fully enclosed in brackets/parentheses (pure background vocals/ad-libs)
    if (/^\s*[\(\[][^()\[\]]*[\)\]]\s*$/.test(rawText)) {
      return;
    }

    if (line.tokens && line.tokens.length > 0) {
      let insideParen = false;
      line.tokens.forEach((t, tIdx) => {
        const text = t.text.trim();
        if (!text) return;

        if (text.startsWith('(') || text.startsWith('[')) {
          insideParen = true;
        }

        const isBacking =
          insideParen ||
          text.startsWith('(') ||
          text.endsWith(')') ||
          text.startsWith('[') ||
          text.endsWith(']');

        if (text.endsWith(')') || text.endsWith(']')) {
          insideParen = false;
        }

        if (!isBacking) {
          const clean = text.replace(/[\(\)\[\]]/g, '').trim();
          if (clean) {
            words.push({
              id: `cw_${lineIdx}_${tIdx}`,
              lineIndex: lineIdx,
              wordIndex: tIdx,
              text: clean,
              start: t.start,
              end: t.end,
            });
          }
        }
      });
    } else {
      // Untokenized line: strip parentheses content first
      const cleanLine = rawText.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
      if (!cleanLine) return;

      const split = cleanLine.split(/\s+/).filter(Boolean);
      const total = split.length;
      const duration = Math.max(0.4, line.end - line.start);
      split.forEach((w, wIdx) => {
        const clean = w.replace(/[\(\)\[\]]/g, '').trim();
        if (clean) {
          const wStart = line.start + (wIdx / total) * duration;
          const wEnd = line.start + ((wIdx + 1) / total) * duration;
          words.push({
            id: `cw_${lineIdx}_${wIdx}`,
            lineIndex: lineIdx,
            wordIndex: wIdx,
            text: clean,
            start: wStart,
            end: wEnd,
          });
        }
      });
    }
  });

  return words;
}

/**
 * Computes the maximum Anton font size (up to 750px) that allows the text
 * to fit within the available bounds with almost zero gap at the edges.
 */
function computeAntonFontSize(
  text: string,
  availWidth: number,
  availHeight: number,
  maxFontSize = 750,
  fontFamily: string = 'Anton'
): number {
  if (!text || availWidth <= 0 || availHeight <= 0) return 100;

  let textWidth100 = 0;
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = `100px ${fontFamily}, sans-serif`;
        textWidth100 = ctx.measureText(text).width;
      }
    } catch {
      // Fallback
    }
  }

  // Fallback approximation if canvas measurement unavailable
  if (!textWidth100 || textWidth100 <= 0) {
    textWidth100 = text.length * 55;
  }

  // Anton cap-height at 100px is approximately 78px
  const textHeight100 = 78;

  const scaleW = availWidth / textWidth100;
  const scaleH = availHeight / textHeight100;
  const scale = Math.min(scaleW, scaleH);

  return Math.min(maxFontSize, Math.max(28, Math.floor(100 * scale)));
}

export const ColorsViewRenderer: React.FC<ColorsViewRendererProps> = ({
  lines,
  currentTime,
  trackTitle,
  artistName,
  bpm: propBpm,
  beatDivision = '4',
  onSeek,
  onBpmDetected,
  fontFamilyId = 'anton',
  fontSize = 1,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [activeBpm, setActiveBpm] = useState<number | null>(propBpm || null);

  const onBpmDetectedRef = useRef(onBpmDetected);
  onBpmDetectedRef.current = onBpmDetected;
  const notifiedBpmRef = useRef<string | null>(null);

  // 1. Ensure the selected Colors font is loaded
  useEffect(() => {
    ensureStageFontLoaded(fontFamilyId);
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => setFontsLoaded(true));
    }
  }, [fontFamilyId]);

  // 2. Auto-fetch song BPM from our backend API
  useEffect(() => {
    if (propBpm && propBpm > 0) {
      setActiveBpm(propBpm);
      const key = `prop:::${propBpm}`;
      if (notifiedBpmRef.current !== key) {
        notifiedBpmRef.current = key;
        onBpmDetectedRef.current?.(propBpm);
      }
      return;
    }

    const title = (trackTitle || '').trim();
    const artist = (artistName || '').trim();
    if (!title && !artist) return;

    // 1. Sanitize title and artist: strip hyphens, em-dashes, brackets, and parentheticals
    const cleanT = title
      .replace(/[\u2010-\u2015\u2212\-–—_]/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\b(feat\.?|ft\.?)\b.*$/i, '')
      .replace(/\b(official|music|audio|video|lyrics?|remaster(?:ed)?|hd|4k)\b/gi, ' ')
      .replace(/['"“”‘’]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const cleanA = artist
      .replace(/[\u2010-\u2015\u2212\-–—_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 2. Prevent duplicate tokens if title already contains artist (e.g. "Just The Way You Are · Milky" + "Milky")
    let finalT = cleanT;
    if (cleanA && cleanT.toLowerCase().includes(cleanA.toLowerCase())) {
      finalT = cleanT.replace(new RegExp(`\\b${cleanA.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\$&')}\\b`, 'gi'), '').trim();
    }

    let query = '';
    if (cleanA && finalT) {
      query = `${cleanA} ${finalT}`.trim();
    } else {
      query = cleanA || cleanT;
    }

    if (!query) return;

    const cacheKey = `${cleanA}:::${cleanT}`.toLowerCase();
    if (bpmMemoryCache.has(cacheKey)) {
      const cachedBpm = bpmMemoryCache.get(cacheKey)!;
      setActiveBpm(cachedBpm);
      if (notifiedBpmRef.current !== cacheKey) {
        notifiedBpmRef.current = cacheKey;
        onBpmDetectedRef.current?.(cachedBpm);
      }
      return;
    }

    let isMounted = true;
    const endpoint = `https://openlyryc-core.aurostronyee1.workers.dev/api/v1/bpm?q=${encodeURIComponent(query)}`;

    fetch(endpoint)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        const foundBpm = data.results?.[0]?.bpm;
        if (typeof foundBpm === 'number' && foundBpm > 30 && foundBpm < 300) {
          bpmMemoryCache.set(cacheKey, foundBpm);
          setActiveBpm(foundBpm);
          if (notifiedBpmRef.current !== cacheKey) {
            notifiedBpmRef.current = cacheKey;
            onBpmDetectedRef.current?.(foundBpm);
          }
        }
      })
      .catch(() => {
        // Fallback smoothly to line-based color if network or track not in database
      });

    return () => {
      isMounted = false;
    };
  }, [trackTitle, artistName, propBpm]);

  // 3. Measure container dimensions with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
    };

    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 4. Extract words for the primary singer (stripping background/bracketed vocals)
  const words = useMemo(() => {
    return buildColorsLyricWords(lines);
  }, [lines]);

  // 5. Resolve active word and silence
  const { activeWord, activeLineIndex, isSilence } = useMemo(() => {
    const len = words.length;
    if (len === 0) {
      return { activeWord: null, activeLineIndex: 0, isSilence: true };
    }

    if (currentTime < words[0].start - 0.2) {
      return { activeWord: null, activeLineIndex: 0, isSilence: true };
    }

    let low = 0;
    let high = len - 1;
    let best = -1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (words[mid].start <= currentTime) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (best === -1) {
      return { activeWord: null, activeLineIndex: 0, isSilence: true };
    }

    const current = words[best];
    const isWithinWord = currentTime >= current.start && currentTime <= current.end;

    if (isWithinWord) {
      return { activeWord: current, activeLineIndex: current.lineIndex, isSilence: false };
    }

    // Between words: check distance to next word
    const next = best + 1 < len ? words[best + 1] : null;
    if (next) {
      const gap = next.start - current.end;
      // Normal brief pause between syllables/words within a sentence: hold previous word
      if (currentTime < next.start && gap <= 0.6) {
        return { activeWord: current, activeLineIndex: current.lineIndex, isSilence: false };
      }
      // Instrumental break / pause before next line
      if (currentTime > current.end + 0.6 && currentTime < next.start) {
        const useNextColor = next.start - currentTime <= 2.0;
        return {
          activeWord: null,
          activeLineIndex: useNextColor ? next.lineIndex : current.lineIndex,
          isSilence: true,
        };
      }
    } else {
      // Past end of song
      if (currentTime > current.end + 0.6) {
        return { activeWord: null, activeLineIndex: current.lineIndex, isSilence: true };
      }
    }

    return { activeWord: current, activeLineIndex: current.lineIndex, isSilence: false };
  }, [words, currentTime]);

  // 6. Beat-Synced Dynamic Background Color
  // '4' (Default): Changes every 4 beats (1 full measure in 4/4) — smooth, musical, zero eye strain.
  // 'drums': Synced to kick & snare drum beats. Background flashes vibrant color and smoothly dims to black on each beat.
  // '2': Changes every 2 beats (half measure) — energetic backbeat.
  // '1': Changes on every 1 beat (quarter note) — club strobe.
  // 'line': Fallback per lyric line.
  // 'alternate': Two-phase swap on the same 4-beat cycle — phase A: color bg + white text;
  //   phase B: white bg + color text; next cycle moves to the next palette color.
  const drumPulse = useMemo(() => {
    if (beatDivision !== 'drums') {
      return { isKick: false, isSnare: false, snareFlashOpacity: 0, dimmedColor: null as string | null };
    }
    const bpm = activeBpm && activeBpm > 0 ? activeBpm : 120;
    const beatDuration = 60 / bpm;
    // Kick on beat 1 (index 0), Snare on beat 3 (index 2) of a 4/4 bar (2 beats per drum hit)
    const stepDuration = beatDuration * 2;
    const timeInStep = Math.max(0, currentTime) % stepDuration;
    const progress = timeInStep / stepDuration;
    const stepIndex = Math.floor(Math.max(0, currentTime) / stepDuration);

    const isKick = stepIndex % 2 === 0;
    const isSnare = stepIndex % 2 === 1;

    // Dim to black curve: flashes color at impact, then dims smoothly down to pure black (#000000)
    const decayWindow = 0.68;
    const decay = Math.max(0, 1 - progress / decayWindow);
    const brightness = Math.pow(decay, 1.85);

    const [r, g, b] = COLORS_RGB[stepIndex % COLORS_RGB.length];
    const dimmedColor = `rgb(${Math.round(r * brightness)}, ${Math.round(g * brightness)}, ${Math.round(b * brightness)})`;

    // Snare: Crisp luminous white flash crack on impact decaying rapidly within first ~12% of the step
    const snareFlashOpacity = isSnare
      ? Math.max(0, (1 - progress * 8.0) * 0.45)
      : 0;

    return { isKick, isSnare, snareFlashOpacity, dimmedColor };
  }, [beatDivision, activeBpm, currentTime]);

  // 'alternate' two-phase swap: phase 0 = color bg + white text, phase 1 = white bg + color text
  const alternateState = useMemo(() => {
    if (beatDivision !== 'alternate') {
      return { phase: 0 as 0 | 1, color: COLORS_PALETTE[0] as string };
    }
    const bpm = activeBpm && activeBpm > 0 ? activeBpm : 120;
    const stepDuration = (60 / bpm) * 4;
    const cycle = Math.floor(Math.max(0, currentTime) / stepDuration);
    const phase = (cycle % 2) as 0 | 1;
    const color = COLORS_PALETTE[Math.floor(cycle / 2) % COLORS_PALETTE.length];
    return { phase, color };
  }, [beatDivision, activeBpm, currentTime]);

  const currentColor = useMemo(() => {
    if (beatDivision === 'alternate') {
      return alternateState.phase === 0 ? alternateState.color : '#ffffff';
    }

    if (beatDivision === 'drums' && drumPulse.dimmedColor) {
      return drumPulse.dimmedColor;
    }

    if (activeBpm && activeBpm > 0) {
      const beatDuration = 60 / activeBpm;
      const multiplier = beatDivision === '1' ? 1 : beatDivision === '2' ? 2 : 4;
      const stepDuration = beatDuration * multiplier;
      const currentStep = Math.floor(Math.max(0, currentTime) / stepDuration);
      return COLORS_PALETTE[currentStep % COLORS_PALETTE.length];
    }
    const idx = Math.max(0, activeLineIndex);
    return COLORS_PALETTE[idx % COLORS_PALETTE.length];
  }, [activeBpm, currentTime, activeLineIndex, beatDivision, drumPulse.dimmedColor, alternateState]);

  const foregroundColor =
    beatDivision === 'alternate' && alternateState.phase === 1 ? alternateState.color : '#ffffff';

  // Resolved stage font stack for the Colors lyric text (default: Anton)
  const resolvedFontFamily = useMemo(() => buildStageFontStack(fontFamilyId), [fontFamilyId]);

  // Viewport sizing: 96% width and 94% height gives almost zero gap at screen edges
  const availW = Math.max(100, (dimensions.width || 800) * 0.96);
  const availH = Math.max(100, (dimensions.height || 600) * 0.94);

  const wordText = activeWord ? activeWord.text.toUpperCase().trim() : '';

  // 7. Line Boundaries & Musical Inter-Line Transition Detection
  const lineBoundaries = useMemo(() => {
    return lines
      .map((line, idx) => {
        const rawText = (line.text || '').trim();
        if (!rawText || /^\s*[\(\[][^()\[\]]*[\)\]]\s*$/.test(rawText)) return null;
        const start = line.tokens && line.tokens.length > 0 ? line.tokens[0].start : line.start;
        const end = line.tokens && line.tokens.length > 0 ? line.tokens[line.tokens.length - 1].end : line.end;
        return {
          lineIndex: idx,
          start,
          end,
          text: rawText.replace(/[\(\)\[\]]/g, '').trim(),
        };
      })
      .filter((l): l is { lineIndex: number; start: number; end: number; text: string } => l !== null && l.end > l.start);
  }, [lines]);

  // Inter-line break transition (only triggers on genuine musical gaps, e.g. gap >= 2.0s)
  // Grace window: kicks in 0.6s after vocal line finishes and hands off 0.35s before next line starts.
  const interLineTransition = useMemo(() => {
    if (lineBoundaries.length < 2) return null;
    const MIN_GAP = 2.0; // Avoid flickering on fast consecutive lyric lines
    const POST_VOCAL_REST = 0.6; // Let the singer's line breathe for 600ms before transition
    const PRE_VOCAL_LEAD = 0.35; // Settle into incoming line's color 350ms before vocal drops

    for (let i = 0; i < lineBoundaries.length - 1; i++) {
      const cur = lineBoundaries[i];
      const next = lineBoundaries[i + 1];
      const gap = next.start - cur.end;

      if (gap >= MIN_GAP) {
        const effectStart = cur.end + POST_VOCAL_REST;
        const effectEnd = next.start - PRE_VOCAL_LEAD;

        if (currentTime >= effectStart && currentTime < effectEnd) {
          return {
            prevLine: cur,
            nextLine: next,
            gap,
            remainingTime: next.start - currentTime,
            progress: (currentTime - effectStart) / (effectEnd - effectStart),
          };
        }
      }
    }
    return null;
  }, [lineBoundaries, currentTime]);

  // 8. Rhythmic Measure Timing & Beat Alternation
  const bpm = activeBpm && activeBpm > 0 ? activeBpm : 120;
  const beatDuration = 60 / bpm;
  const measureDuration = beatDuration * 4;
  const beatIndex = Math.floor(Math.max(0, currentTime) / beatDuration);
  const timeInMeasure = Math.max(0, currentTime) % measureDuration;
  const beatInMeasure = Math.min(3, Math.floor(timeInMeasure / beatDuration));
  const timeInBeat = Math.max(0, currentTime) % beatDuration;
  const beatProgress = timeInBeat / beatDuration;

  // Alternates split-screen colors per beat (Kick on even beats, Snare on odd beats)
  const isBeatSwapped = beatIndex % 2 === 1;

  // 9. Split Colors with Per-Beat Alternation (Red/Green <-> Green/Red synced to Kick & Snare)
  const splitColors = useMemo(() => {
    if (!interLineTransition) {
      return { colorA: currentColor, colorB: currentColor };
    }

    let baseA: string;
    let baseB: string;

    if (beatDivision === 'alternate') {
      const isPhase0 = alternateState.phase === 0;
      const col = alternateState.color;
      baseA = isPhase0 ? col : '#ffffff';
      baseB = isPhase0 ? '#ffffff' : col;
    } else {
      const prevIdx = interLineTransition.prevLine.lineIndex;
      const nextIdx = interLineTransition.nextLine.lineIndex;
      baseA = COLORS_PALETTE[prevIdx % COLORS_PALETTE.length];
      baseB = COLORS_PALETTE[nextIdx % COLORS_PALETTE.length];
      if (baseB === baseA) {
        baseB = COLORS_PALETTE[(nextIdx + 1) % COLORS_PALETTE.length];
      }
    }

    // Alternate per beat: on kick baseA/baseB, on snare baseB/baseA
    const colorA = isBeatSwapped ? baseB : baseA;
    const colorB = isBeatSwapped ? baseA : baseB;

    return {
      colorA,
      colorB,
    };
  }, [interLineTransition, beatDivision, alternateState, currentColor, isBeatSwapped]);

  // Dynamic font size capped at 750px, scaled by the Colors font-size multiplier
  const dynamicFontSize = useMemo(() => {
    if (!wordText) return 100;
    const fit = computeAntonFontSize(wordText, availW, availH, 750, resolvedFontFamily);
    const scale = fontSize > 0 ? fontSize : 1;
    return Math.round(fit * scale);
  }, [wordText, availW, availH, fontsLoaded, fontSize, resolvedFontFamily]);

  // Smooth color ease curve for natural, organic transitions
  const COLOR_EASE = 'background-color 200ms cubic-bezier(0.4, 0, 0.2, 1)';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none flex items-center justify-center overflow-hidden"
      style={{
        backgroundColor: interLineTransition ? undefined : currentColor,
        transition: interLineTransition ? undefined : COLOR_EASE,
      }}
    >
      {/* ── 1. Inter-Line Transition: Half-Screen Split (Clean Duotone Cut, Swapped Per Beat) ── */}
      {interLineTransition && (
        <div className="absolute inset-0 w-full h-full flex flex-col">
          {/* Top Half */}
          <div
            className="w-full h-1/2 relative overflow-hidden"
            style={{ backgroundColor: splitColors.colorA, transition: COLOR_EASE }}
          />

          {/* Bottom Half */}
          <div
            className="w-full h-1/2 relative overflow-hidden"
            style={{ backgroundColor: splitColors.colorB, transition: COLOR_EASE }}
          />

          {/* Pure, Minimalist 4-Beat Seam Indicator (Centered) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="flex items-center gap-3.5 sm:gap-5 select-none">
              {[0, 1, 2, 3].map((bIdx) => {
                const isActive = beatInMeasure === bIdx;
                return (
                  <span
                    key={bIdx}
                    className={`block rounded-full ${
                      isActive
                        ? 'w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 bg-white scale-125 shadow-md'
                        : 'w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white/40'
                    }`}
                    style={{
                      transition: 'transform 140ms ease, opacity 140ms ease, background-color 200ms ease',
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Active Vocal Delivery: Super-sized Full-Bleed Word View ── */}
      {!interLineTransition && !isSilence && wordText && (
        <span
          className="font-normal uppercase text-center tracking-tight leading-[0.84] select-none pointer-events-none relative z-20"
          style={{
            color: foregroundColor,
            fontFamily: resolvedFontFamily,
            fontSize: `${dynamicFontSize}px`,
            maxWidth: '96vw',
            maxHeight: '94vh',
            display: 'inline-block',
            transition: 'color 200ms ease',
          }}
        >
          {wordText}
        </span>
      )}

      {/* ── 3. Extended Instrumental Break / Silence State (Clean Centered Rhythm Dots) ── */}
      {!interLineTransition && (isSilence || !wordText) && (
        <div className="absolute inset-0 flex items-center justify-center relative z-20 select-none pointer-events-none">
          <div className="flex items-center gap-3.5 sm:gap-5 select-none">
            {[0, 1, 2, 3].map((bIdx) => {
              const isActive = beatInMeasure === bIdx;
              return (
                <span
                  key={bIdx}
                  className={`block rounded-full ${
                    isActive
                      ? 'w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 scale-125 shadow-sm'
                      : 'w-2.5 h-2.5 sm:w-3 sm:h-3 opacity-35'
                  }`}
                  style={{
                    backgroundColor: foregroundColor,
                    transition: 'transform 140ms ease, opacity 140ms ease, background-color 200ms ease',
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

ColorsViewRenderer.displayName = 'ColorsViewRenderer';
