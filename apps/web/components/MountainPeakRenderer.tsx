'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { LyricLine } from '@/types/lyrics';
import { buildStageFontStack, stageFontWeightValue } from '@/lib/stageFonts';
import { ShootingStarCanvas } from './ShootingStarCanvas';

export interface MountainPeakRendererProps {
  lines: LyricLine[];
  currentTime: number;
  onSeek?: (time: number) => void;
  trackTitle?: string;
  artistName?: string;
  stageFontFamily?: string;
  stageFontWeight?: string;
  textXPercent?: number; // -40 to 40, default 0 (Center)
  textYPercent?: number; // 5 to 35, default 16
  fontSizeMultiplier?: number; // 0.75 to 1.6, default 1.0
  parallaxEnabled?: boolean; // default false
  shootingStarsEnabled?: boolean; // default true
}

export interface SingleLyricWord {
  id: string;
  lineIndex: number;
  wordIndex: number;
  text: string;
  start: number;
  end: number;
}

/**
 * Extracts individual single words with precision timestamps from lyric lines.
 * Uses word/syllable tokens when present, or linear duration interpolation.
 */
export function buildLyricWords(lines: LyricLine[]): SingleLyricWord[] {
  const words: SingleLyricWord[] = [];

  lines.forEach((line, lineIdx) => {
    const rawText = (line.text || '').trim();
    if (!rawText) return;

    if (line.tokens && line.tokens.length > 0) {
      line.tokens.forEach((t, tIdx) => {
        const text = t.text.trim();
        if (text) {
          words.push({
            id: `w_${lineIdx}_${tIdx}`,
            lineIndex: lineIdx,
            wordIndex: tIdx,
            text,
            start: t.start,
            end: t.end,
          });
        }
      });
    } else {
      const split = rawText.split(/\s+/).filter(Boolean);
      const total = split.length;
      const duration = Math.max(0.4, line.end - line.start);
      split.forEach((w, wIdx) => {
        const wStart = line.start + (wIdx / total) * duration;
        const wEnd = line.start + ((wIdx + 1) / total) * duration;
        words.push({
          id: `w_${lineIdx}_${wIdx}`,
          lineIndex: lineIdx,
          wordIndex: wIdx,
          text: w,
          start: wStart,
          end: wEnd,
        });
      });
    }
  });

  return words;
}

export const MountainPeakRenderer: React.FC<MountainPeakRendererProps> = ({
  lines,
  currentTime,
  onSeek,
  trackTitle = 'Untitled Track',
  artistName = 'Unknown Artist',
  stageFontFamily = 'geist',
  stageFontWeight = '500',
  textXPercent = 0,
  textYPercent = 16,
  fontSizeMultiplier = 1.0,
  parallaxEnabled = false,
  shootingStarsEnabled = true,
}) => {
  // ── Multi-Tier 3D Celestial Parallax Engine ────────────────────────────────
  const [mouseOffset, setMouseOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const targetOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (!parallaxEnabled) {
      setMouseOffset({ x: 0, y: 0 });
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let animId: number;
    let hasUserInteracted = false;

    const handleMouseMove = (e: MouseEvent) => {
      hasUserInteracted = true;
      const w = window.innerWidth || 1920;
      const h = window.innerHeight || 1080;
      const nx = (e.clientX / w) * 2 - 1; // -1 to 1
      const ny = (e.clientY / h) * 2 - 1; // -1 to 1
      targetOffsetRef.current = {
        x: Math.max(-1, Math.min(1, nx)),
        y: Math.max(-1, Math.min(1, ny)),
      };
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        hasUserInteracted = true;
        const t = e.touches[0];
        const w = window.innerWidth || 1920;
        const h = window.innerHeight || 1080;
        const nx = (t.clientX / w) * 2 - 1;
        const ny = (t.clientY / h) * 2 - 1;
        targetOffsetRef.current = {
          x: Math.max(-1, Math.min(1, nx)),
          y: Math.max(-1, Math.min(1, ny)),
        };
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    // Smooth 60fps damped harmonic interpolation with gentle cosmic drift
    const tick = () => {
      const now = performance.now();
      const cur = currentOffsetRef.current;
      const target = targetOffsetRef.current;

      // Subtle celestial drift (e.g. slow atmospheric movement when idle)
      const driftX = Math.sin(now * 0.00045) * 0.08;
      const driftY = Math.cos(now * 0.00035) * 0.05;

      const effectiveTargetX = target.x + (hasUserInteracted ? driftX * 0.4 : driftX);
      const effectiveTargetY = target.y + (hasUserInteracted ? driftY * 0.4 : driftY);

      cur.x += (effectiveTargetX - cur.x) * 0.045;
      cur.y += (effectiveTargetY - cur.y) * 0.045;

      setMouseOffset({ x: cur.x, y: cur.y });
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      cancelAnimationFrame(animId);
    };
  }, [parallaxEnabled]);

  // Extract all single words
  const words = useMemo(() => {
    return buildLyricWords(lines);
  }, [lines]);

  // Binary search for the exact active single word at currentTime
  const activeWord = useMemo(() => {
    const len = words.length;
    if (len === 0) return null;

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

    if (best >= 0) {
      const w = words[best];
      // Display precisely while currentTime is within the word's time bounds
      // Add a slight hold padding (up to next word start, or max +0.2s) to prevent jitter in micro-gaps
      const nextWord = words[best + 1];
      const maxHold = nextWord ? Math.min(w.end + 0.2, nextWord.start) : w.end + 0.2;
      if (currentTime <= maxHold) {
        return w;
      }
    }

    return null;
  }, [words, currentTime]);

  // Typography styles: Geist Medium 500 default
  const resolvedFontFamily = stageFontFamily === 'default' || !stageFontFamily ? 'geist' : stageFontFamily;
  const stageFontStack = buildStageFontStack(resolvedFontFamily);
  const stageWeight = stageFontWeightValue(stageFontWeight);

  const textStyle: React.CSSProperties = {
    fontFamily: stageFontStack || "var(--font-geist), 'Geist', -apple-system, sans-serif",
    fontWeight: stageWeight || 500,
    letterSpacing: '-0.025em',
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#09090b] flex items-center justify-center">
      {/* LAYER 0: Background Photo (Full Mountain + Dark Sky) — Shifts into distant background */}
      <div
        className="absolute inset-[-24px] pointer-events-none transition-transform duration-75 ease-out"
        style={{
          transform: `translate3d(${(mouseOffset.x * -4).toFixed(2)}px, ${(mouseOffset.y * -3).toFixed(2)}px, 0) scale(1.025)`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/photos/mountain-bg.webp"
          alt="Himalayan Mountain Background"
          className="w-full h-full object-cover object-center filter brightness-[0.9] contrast-[1.05]"
          loading="eager"
          decoding="async"
        />
        {/* Atmospheric sky gradient tint for depth & contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/50 pointer-events-none" />
      </div>

      {/* LAYER 1: Ambient Peak Backlight Glow */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          background:
            'radial-gradient(ellipse 70% 35% at 50% 20%, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.02) 40%, transparent 70%)',
          opacity: activeWord ? 1 : 0.2,
        }}
      />

      {/* LAYER 1.5: Deep Celestial Shooting Stars & Twinkling Starfield (Layer Behind Typography & Ridge) */}
      <div className="absolute inset-0 pointer-events-none z-[5] overflow-hidden">
        <ShootingStarCanvas
          enabled={shootingStarsEnabled}
          mouseOffset={mouseOffset}
          parallaxFactor={15}
        />
      </div>

      {/* LAYER 2: Typography behind the Mountains (Single Word, Super Large, Pure White, Instant Sync) */}
      <div
        className="absolute inset-x-0 w-full flex items-center justify-center pointer-events-none z-10 transition-transform duration-75 ease-out"
        style={{
          top: `${textYPercent}%`,
          transform: `translate3d(${textXPercent}%, 0, 0) translate3d(${(mouseOffset.x * 5).toFixed(2)}px, ${(mouseOffset.y * 3.5).toFixed(2)}px, 0)`,
        }}
      >
        {activeWord && (
          <div
            onClick={() => onSeek?.(activeWord.start)}
            className="pointer-events-auto cursor-pointer select-none text-center px-4 max-w-[96vw] truncate"
            style={{
              ...textStyle,
              fontSize: `clamp(4.5rem, ${13 * fontSizeMultiplier}vw, ${16 * fontSizeMultiplier}rem)`,
              lineHeight: 1,
              color: '#ffffff',
              filter: 'drop-shadow(0 4px 28px rgba(0,0,0,0.95)) drop-shadow(0 0 45px rgba(255,255,255,0.25))',
            }}
          >
            {activeWord.text}
          </div>
        )}
      </div>

      {/* LAYER 3: Foreground Cutout Mountain Layer (Transparent Sky) — Moves closest to camera */}
      <div
        className="absolute inset-[-24px] pointer-events-none z-20 transition-transform duration-75 ease-out"
        style={{
          transform: `translate3d(${(mouseOffset.x * 12).toFixed(2)}px, ${(mouseOffset.y * 9).toFixed(2)}px, 0) scale(1.035)`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/photos/mountain-foreground.webp"
          alt="Himalayan Mountain Foreground Cutout"
          className="w-full h-full object-cover object-center filter contrast-[1.05]"
          loading="eager"
          decoding="async"
        />
      </div>
    </div>
  );
};

MountainPeakRenderer.displayName = 'MountainPeakRenderer';
