'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LyricLine } from '@/types/lyrics';
import { getAlveSceneState } from '@/lib/alveDayNight';
import {
  buildStageFontStack,
  stageFontWeightValue,
  ensureStageFontLoaded,
} from '@/lib/stageFonts';
import type { AlveTimeMode } from '@/types/settings';

export interface AlveTownRendererProps {
  lines: LyricLine[];
  currentTime: number;
  activeLineIndex: number;
  animated?: boolean;
  dayNight?: boolean;
  dim?: number;
  timeMode?: AlveTimeMode;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  onSeek?: (time: number) => void;
}

/**
 * ALVE TOWN STAGE — original lively-alve scene layers stacked 1:1, graded by
 * the ported day-night cycle, with the active lyric line as an LED-style
 * horizontal ticker rendered NATIVELY inside the billboard's measured face.
 *
 * Ticker sync: scroll position interpolates across the ACTIVE LINE's own
 * [start,end] window at constant speed — it can never rush ahead early in the
 * song. Short lines that fit sit centered and still. No word-level fill.
 *
 * Time: 'real' follows local time (60s re-grade); 'cycle' loops a full day
 * every CYCLE_MINUTES with CSS-filter transitions keeping it butter-smooth.
 *
 * Geometry: sign face pixel-measured in art space (2316×948) as
 * x[898,1419] × y[250,379], mapped through exact cover-crop math — correct at
 * any stage aspect. Face hard-clips + edge-fades, so text never leaves it.
 *
 * Scene art: Waneella / Valve via Gabrz/lively-alve. The images are not
 * included here (see docs/ASSETS.md); missing layers fall back to a gradient.
 */

const L = '/alve';
const ART_W = 2316;
const ART_H = 948;
// Measured sign-face rect in art pixels (12px safe inset from the teal fill).
const FACE = { x: 898, y: 250, w: 521, h: 129 };
// Full day-night loop length in cycle mode (minutes of day per real minutes).
const CYCLE_MINUTES = 3;
// CSS transition that smooths every grade step (both modes).
const FILTER_TRANSITION = 'filter 0.6s linear';

/**
 * One scene layer. The Alve art is not shipped in this repository, so any
 * missing file just removes itself instead of showing a broken image.
 */
const SceneLayer: React.FC<{ src: string; style?: React.CSSProperties }> = ({ src, style }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      draggable={false}
      className="absolute inset-0 w-full h-full pointer-events-none select-none"
      style={style}
      onError={() => setFailed(true)}
    />
  );
};

function measurePixelWidth(text: string, px: number, stack: string): number | null {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.font = `${px}px ${stack}`;
    return ctx.measureText(text).width;
  } catch {
    return null;
  }
}

export const AlveTownRenderer: React.FC<AlveTownRendererProps> = ({
  lines,
  currentTime,
  activeLineIndex,
  animated = true,
  dayNight = true,
  dim = 0.25,
  timeMode = 'cycle',
  fontFamily = 'native',
  fontSize = 1,
  fontWeight = 'auto',
  onSeek,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [sceneTick, setSceneTick] = useState(() => Date.now());
  const [fontsReady, setFontsReady] = useState(false);

  // Scene clock: slow 60s steps in real mode, fast 500ms steps in cycle mode.
  // The CSS filter transition interpolates between steps — always smooth.
  // (Initial state already holds Date.now(); no sync setState needed.)
  useEffect(() => {
    if (!dayNight) return;
    const timer = setInterval(
      () => setSceneTick(Date.now()),
      timeMode === 'cycle' ? 500 : 60 * 1000
    );
    return () => clearInterval(timer);
  }, [dayNight, timeMode]);

  // Measure stage box: drives the cover-crop mapping below.
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 0 && r.height > 0) setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Re-fit once Pixeloid arrives (measureText needs the real font).
  useEffect(() => {
    let live = true;
    try {
      document.fonts?.ready.then(() => {
        if (live) setFontsReady(true);
      });
    } catch {
      /* older browsers: estimate fallback below */
    }
    return () => {
      live = false;
    };
  }, []);

  const scene = useMemo(() => {
    if (!dayNight) return null;
    if (timeMode === 'cycle') {
      // Deterministic virtual clock: full day every CYCLE_MINUTES, no anchor
      // state needed; the filter transition masks the one-time mode-switch jump.
      const vMin = ((sceneTick / 60000) * (1440 / CYCLE_MINUTES)) % 1440;
      const d = new Date(2026, 0, 1, Math.floor(vMin / 60), Math.floor(vMin % 60));
      return getAlveSceneState(d);
    }
    return getAlveSceneState(new Date(sceneTick));
  }, [dayNight, timeMode, sceneTick]);

  const activeLine = activeLineIndex >= 0 && activeLineIndex < lines.length ? lines[activeLineIndex] : null;
  const lineText = activeLine?.text ?? '';

  // Billboard type: native Pixeloid by default, overridable with any stage
  // font (Google fonts lazy-load on selection). Size scales off the mapped
  // face height — strictly uniform per scale setting, never per line.
  const stack = buildStageFontStack(fontFamily) ?? "'Pixeloid', system-ui, sans-serif";
  const weight = stageFontWeightValue(fontWeight);

  useEffect(() => {
    ensureStageFontLoaded(fontFamily);
  }, [fontFamily]);

  // ── Exact cover-crop mapping: art rect → CSS px ──
  // Layers render object-fit:cover + center, so:
  //   scale = max(W/ART_W, H/ART_H); crop offsets ox/oy split evenly.
  const faceBox = useMemo(() => {
    if (box.w <= 0 || box.h <= 0) return null;
    const s = Math.max(box.w / ART_W, box.h / ART_H);
    const ox = (ART_W * s - box.w) / 2;
    const oy = (ART_H * s - box.h) / 2;
    return {
      left: FACE.x * s - ox,
      top: FACE.y * s - oy,
      width: FACE.w * s,
      height: FACE.h * s,
    };
  }, [box]);

  // Strictly uniform type: fixed fraction of face height (× user scale),
  // identical every line.
  const wordSize = faceBox ? Math.max(10, faceBox.height * 0.26 * fontSize) : 24;

  const textW = useMemo(() => {
    if (!lineText) return 0;
    const measured = measurePixelWidth(lineText, 100, stack);
    if (measured && measured > 0) return (measured * wordSize) / 100;
    return lineText.length * 0.62 * wordSize; // fallback advance estimate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineText, wordSize, fontsReady, faceBox, stack]);

  // ── Ticker position: constant-speed sweep across the line's own window ──
  // p=0 → leading edge just offscreen right; p=1 → fully out left. Gaps after
  // line end clamp to empty (real billboard between messages). Short lines sit centered.
  let tickerX = 0;
  let scrolling = false;
  if (faceBox && activeLine && textW > faceBox.width * 0.96) {
    scrolling = true;
    const dur = Math.max(0.5, activeLine.end - activeLine.start);
    const p = Math.min(1, Math.max(0, (currentTime - activeLine.start) / dur));
    tickerX = faceBox.width - (faceBox.width + textW + faceBox.width * 0.12) * p;
  }

  const ext = animated ? 'gif' : 'png';
  const cover: React.CSSProperties = {
    objectFit: 'cover',
    objectPosition: 'center',
    transition: FILTER_TRANSITION,
  };

  return (
    <div ref={boxRef} className="relative flex-1 w-full h-full min-h-0 overflow-hidden bg-black select-none">
      {/* Fallback backdrop, visible when the optional scene art is absent */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, #0c1424 0%, #16233a 42%, #0b0d12 72%, #07070a 100%)' }}
      />

      {/* ── Lively layer stack (index.html order) ── */}
      <SceneLayer src={`${L}/scene_sky_0.png`} style={{ ...cover, filter: scene?.filters.sky0 }} />
      <SceneLayer src={`${L}/scene_sky_3.png`} style={{ ...cover, filter: scene?.filters.sky3, opacity: scene ? scene.starsOpacity : 0, transition: `${FILTER_TRANSITION}, opacity 0.6s linear` }} />
      <SceneLayer src={`${L}/scene_sky_1.png`} style={{ ...cover, filter: scene?.filters.sky1 }} />
      <SceneLayer src={`${L}/scene_sky_2.png`} style={{ ...cover, filter: scene?.filters.sky2 }} />
      <SceneLayer src={`${L}/scene_sign.${ext}`} style={{ ...cover, filter: scene?.filters.sign }} />

      {/* ── Foreground city + lights (in front of the sign, like lively) ── */}
      <SceneLayer src={`${L}/scene_city_1.${ext}`} style={{ ...cover, filter: scene?.filters.city1 }} />
      {(!scene || scene.lightsSign) && (
        <SceneLayer src={`${L}/scene_lights_0.png`} style={cover} />
      )}
      <SceneLayer src={`${L}/scene_city_2.${ext}`} style={{ ...cover, filter: scene?.filters.city2 }} />
      {(!scene || scene.lightsCity) && (
        <SceneLayer src={`${L}/scene_lights_1.png`} style={cover} />
      )}

      {/* Dim veil over the whole scene; billboard text stays crisp on top */}
      {dim > 0 && (
        <div className="absolute inset-0 bg-black pointer-events-none" style={{ opacity: dim }} />
      )}

      {/* ── Native billboard ticker: exact mapped face, hard-clipped + edge-faded ── */}
      {faceBox && activeLine && (
        <div
          className="absolute overflow-hidden"
          style={{
            left: faceBox.left,
            top: faceBox.top,
            width: faceBox.width,
            height: faceBox.height,
            // Soft lateral fade so the ticker dissolves in/out at the face edges.
            WebkitMaskImage: 'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)',
            maskImage: 'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)',
          }}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Soft center focus glow behind the active line */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.10), transparent 65%)' }}
            />
            <div
              key={`${activeLine.id ?? activeLine.start}-${activeLine.start}`}
              onClick={() => onSeek && onSeek(activeLine.start)}
              className="alve-flicker pointer-events-auto cursor-pointer text-[#F7F9F4] leading-[1.2] whitespace-nowrap"
              style={{
                fontFamily: stack,
                fontSize: wordSize,
                fontWeight: weight ?? undefined,
                textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                transform: scrolling ? `translateX(${tickerX.toFixed(1)}px)` : undefined,
                willChange: scrolling ? 'transform' : undefined,
                // Smart blend: grade the text with the SIGN's own day-night
                // filter, so it dims/warms with the billboard instead of
                // floating full-white over a darkened sign. Plus a whisper of
                // screen blend to seat the glyphs into the sign's glow.
                filter: scene?.filters.sign,
                mixBlendMode: 'screen',
                opacity: 0.96,
              }}
            >
              {lineText}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
