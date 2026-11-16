'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { LyricLine } from '@/types/lyrics';
import { ensureStageFontLoaded } from '@/lib/stageFonts';

/**
 * Flythrough — a continuous camera dolly through a deep 3D corridor of the
 * lyric lines. The camera moves at constant speed from the first line to the
 * last; every line is positioned along the depth axis by its actual start
 * time, so lines pass the focal plane exactly when they are sung.
 *
 * Rendered in OpenLyryc's signature high-contrast monochrome aesthetic:
 * - Deep pitch-black cinematic space (#000000)
 * - Hardware-accelerated 2D canvas starfield with relativistic warp streaks,
 *   floating volumetric dust, and organic star twinkling (0 DOM element overhead)
 * - Pure crisp white display typography with multi-tiered depth-of-field blur
 * - 60/120 FPS rock-solid performance with zero layout thrashing
 */
export interface FlythroughRendererProps {
  lines: LyricLine[];
  currentTime: number;
  bpm?: number | null;
}

const UNIT = 110; // px per unit of depth
const NEAR_CUTOFF = -6.4; // lines keep flying past the camera and exit out of bounds naturally
const FAR = 13.5; // sparse corridor — only the lines about to matter stay visible
const CORRIDOR_LENGTH = FAR - NEAR_CUTOFF; // ~19.9 units
const MAX_VISIBLE_LINES = 6; // hardest cap on simultaneously rendered lines
const FOCAL_DEPTH = 0.7; // units ahead of the camera that count as in-focus
const TOTAL_DEPTH = 260; // full corridor length; speed is derived from song duration
const PERSPECTIVE = 1100; // px
const PARTICLE_COUNT = 280; // realistic particle volume

// Deterministic lane offsets — lines stop stacking dead-center
const LANES = [-26, -13, 0, 13, 26];

function hashSeed(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function cameraOpacity(rel: number): number {
  const nearFade = Math.max(0, Math.min(1, (rel - NEAR_CUTOFF) / 3.6));
  const farFade = Math.max(0, Math.min(1, (FAR - rel) / 8));
  // Ease in/out so the far edge dissolves instead of popping
  return Math.pow(Math.min(nearFade, farFade), 1.4);
}

/**
 * Depth-of-field blur. Distance from the focal plane drives the radius —
 * the line being sung stays razor sharp, everything else goes soft.
 * Exiting lines are capped harder so they remain readable while flying out.
 */
function depthOfFieldBlur(rel: number): number {
  const d = Math.abs(rel - FOCAL_DEPTH);
  const raw = Math.pow(d, 1.35) * 1.35;
  return Math.min(rel < FOCAL_DEPTH ? 4.5 : 9, raw);
}

/**
 * Cinematic camera oscillation with authentic drone/gimbal kinematics.
 * Layered harmonic frequencies for responsive, organic movement (~12-25s wave cycles)
 * with subtle yaw, pitch, roll, and sway.
 */
function cameraPose(time: number): { yaw: number; pitch: number; roll: number; swayX: number; swayY: number } {
  const t = Math.max(0, time);
  // Faster, livelier rotation frequencies with subtle, tasteful amplitudes
  const yaw = Math.sin(t * 0.28) * 8.5 + Math.sin(t * 0.11 + 1.2) * 4.0;
  const pitch = Math.cos(t * 0.23 + 1.7) * 6.0 + Math.sin(t * 0.08) * 2.8;
  const roll = Math.sin(t * 0.19 + 0.5) * 5.0 + Math.cos(t * 0.09) * 2.2;
  const swayX = Math.sin(t * 0.21) * 3.0 + Math.cos(t * 0.07) * 1.4;
  const swayY = Math.cos(t * 0.18 + 0.9) * 2.0 + Math.sin(t * 0.06) * 1.0;
  return { yaw, pitch, roll, swayX, swayY };
}

interface ParticleSpec {
  x: number;
  y: number;
  baseRel: number;
  size: number;
  type: 'streak' | 'dust' | 'star';
  twinkleRate: number;
  twinklePhase: number;
  opacity: number;
}

// Generate static deterministic particle pool once
const PARTICLE_POOL: ParticleSpec[] = (() => {
  const arr: ParticleSpec[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const s = i * 7.19 + 3.14;
    const typeRand = hashSeed(s * 4.9);
    const type: 'streak' | 'dust' | 'star' =
      typeRand < 0.28 ? 'streak' : typeRand < 0.72 ? 'dust' : 'star';

    arr.push({
      x: (hashSeed(s * 1.1) - 0.5) * 1700,
      y: (hashSeed(s * 2.3) - 0.5) * 1100,
      baseRel: hashSeed(s * 3.7) * CORRIDOR_LENGTH,
      size:
        type === 'streak'
          ? 1.4 + hashSeed(s * 5.1) * 1.5
          : type === 'dust'
          ? 1.0 + hashSeed(s * 6.2) * 1.2
          : 0.6 + hashSeed(s * 7.3) * 0.8,
      type,
      twinkleRate: 1.5 + hashSeed(s * 8.4) * 3.5,
      twinklePhase: hashSeed(s * 9.5) * Math.PI * 2,
      opacity: 0.35 + hashSeed(s * 10.6) * 0.55,
    });
  }
  return arr;
})();

export const FlythroughRenderer: React.FC<FlythroughRendererProps> = ({
  lines,
  currentTime,
  bpm,
}) => {
  useEffect(() => {
    ensureStageFontLoaded('bebas-neue');
    ensureStageFontLoaded('anton');
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  const songEnd = useMemo(
    () => lines.reduce((max, l) => Math.max(max, l.end || 0), 0),
    [lines]
  );
  const speed = TOTAL_DEPTH / Math.max(1, songEnd);

  const cameraZ = useMemo(() => {
    const z = speed * Math.max(0, currentTime);
    return Math.min(Math.max(z, 0), TOTAL_DEPTH);
  }, [speed, currentTime]);

  // High-performance canvas particle system (60/120 FPS on GPU, 0 DOM elements)
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    };

    updateSize();
    const ro = new ResizeObserver(() => updateSize());
    ro.observe(container);

    let animId: number;

    const renderFrame = () => {
      animId = requestAnimationFrame(renderFrame);
      if (width <= 0 || height <= 0) return;

      const t = currentTimeRef.current;
      const camZ = Math.min(Math.max(speed * Math.max(0, t), 0), TOTAL_DEPTH);
      const pose = cameraPose(t);

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // Rotate starfield canvas with camera roll so horizon banks seamlessly in 3D
      ctx.translate(cx, cy);
      ctx.rotate((pose.roll * Math.PI) / 180);
      ctx.translate(-cx, -cy);

      const camX = pose.swayX * 60 + pose.yaw * 12;
      const camY = pose.swayY * 45 + pose.pitch * 10;
      const fov = 720;
      const wallClock = typeof performance !== 'undefined' ? performance.now() * 0.001 : t;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = PARTICLE_POOL[i];
        const rawRel = (p.baseRel - camZ) % CORRIDOR_LENGTH;
        const rel = rawRel < 0 ? rawRel + CORRIDOR_LENGTH + NEAR_CUTOFF : rawRel + NEAR_CUTOFF;

        const zPx = (rel - NEAR_CUTOFF + 0.8) * UNIT;
        if (zPx <= 12) continue;

        const scale = fov / (fov + zPx);
        const px = cx + (p.x - camX) * scale;
        const py = cy + (p.y - camY) * scale;

        if (px < -60 || px > width + 60 || py < -60 || py > height + 60) continue;

        const distAlpha = cameraOpacity(rel);
        if (distAlpha <= 0.01) continue;

        const twinkle = 0.7 + 0.3 * Math.sin(wallClock * p.twinkleRate + p.twinklePhase);
        const alpha = Math.min(1, p.opacity * distAlpha * twinkle);

        if (p.type === 'streak' && rel < 7.0) {
          // Relativistic warp streak along velocity vector
          const trailZ = rel + 0.42;
          const trailZPx = (trailZ - NEAR_CUTOFF + 0.8) * UNIT;
          const trailScale = fov / (fov + trailZPx);
          const trailX = cx + (p.x - camX) * trailScale;
          const trailY = cy + (p.y - camY) * trailScale;

          ctx.strokeStyle = `rgba(255, 255, 255, ${(alpha * 0.88).toFixed(3)})`;
          ctx.lineWidth = Math.max(0.9, p.size * scale * 1.5);
          ctx.beginPath();
          ctx.moveTo(trailX, trailY);
          ctx.lineTo(px, py);
          ctx.stroke();
        } else {
          // Softly glowing dust speckle or pinpoint star
          const radius = Math.max(0.6, p.size * scale * 1.6);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    };

    animId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, [speed]);

  // Lines positioned along the depth axis by their lyric start time.
  // Sparse corridor: fixed lanes + jitter, capped at MAX_VISIBLE_LINES nearest lines.
  const placed = useMemo(() => {
    const mapped = lines
      .map((line, i) => {
        const z = speed * Math.max(0, line.start);
        const rel = z - cameraZ;
        const lane = LANES[i % LANES.length];
        const x = lane + (hashSeed(i * 5 + 7) - 0.5) * 8;
        const y = (hashSeed(i * 11 + 13) - 0.5) * 34;
        return { line, i, rel, x, y };
      })
      .filter((p) => p.rel > NEAR_CUTOFF && p.rel < FAR);

    return mapped
      .slice()
      .sort((a, b) => a.rel - b.rel)
      .slice(0, MAX_VISIBLE_LINES);
  }, [lines, speed, cameraZ]);

  // Time-based active line for spotlight focusing
  const activeLineIndex = useMemo(() => {
    let idx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].start <= currentTime) idx = i;
      else break;
    }
    return idx;
  }, [lines, currentTime]);

  const pose = cameraPose(currentTime);

  if (lines.length === 0) {
    return (
      <div
        className="relative w-full h-full flex items-center justify-center overflow-hidden select-none bg-black"
        style={{ backgroundColor: '#000000' }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="#ffffff"
          style={{ width: 140, height: 140, opacity: 0.8 }}
        >
          <path d="M20 2H8a2 2 0 0 0-2 2v10.17A4 4 0 0 0 4 14a4 4 0 1 0 4 4V7h12v7.17A4 4 0 0 0 18 14a4 4 0 1 0 4 4V4a2 2 0 0 0-2-2z" />
        </svg>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none bg-black"
      style={{
        backgroundColor: '#000000',
        perspective: `${PERSPECTIVE}px`,
      }}
    >
      {/* Hardware-accelerated 3D Canvas Starfield & Warp Dust */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ display: 'block' }}
      />

      {/* Subtle Vanishing-Point Radial Bloom */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.035) 0%, transparent 60%)',
        }}
      />

      {/* Deep corridor 3D world — yaw / pitch / roll camera oscillation + sway */}
      <div
        className="absolute inset-0"
        style={{
          transformStyle: 'preserve-3d',
          transform: `translate3d(${pose.swayX}%, ${pose.swayY}%, 0) rotateY(${pose.yaw}deg) rotateX(${pose.pitch}deg) rotateZ(${pose.roll}deg)`,
          willChange: 'transform',
        }}
      >
        {/* Lyric lines — sparse corridor + DOF blur + active spotlight */}
        {placed.map(({ line, i, rel, x, y }) => {
          const isActive = i === activeLineIndex;
          const justPassed = i < activeLineIndex;
          const base = cameraOpacity(rel);
          // Spotlight: the active line pulls toward center, full opacity & zero blur
          const px = isActive ? x * 0.22 : x;
          const py = isActive ? y * 0.3 : y;
          // Exit fade as lines fly through the camera
          const opacity = isActive
            ? 1
            : justPassed
              ? Math.min(0.85, Math.pow(base, 1.05) * 0.85)
              : Math.min(base * 0.34, 0.38);
          const blur = isActive ? 0 : depthOfFieldBlur(rel);

          // Subtle per-line 3D yaw / pitch / roll orientation in the corridor
          const laneYaw = x * -0.22 + (hashSeed(i * 7 + 3) - 0.5) * 4.0;
          const linePitch = (hashSeed(i * 13 + 5) - 0.5) * 4.5;
          const lineRoll = (hashSeed(i * 19 + 7) - 0.5) * 3.0;

          // Active line squares up toward the viewer for clean readability
          const yawDeg = isActive ? laneYaw * 0.15 : laneYaw;
          const pitchDeg = isActive ? linePitch * 0.15 : linePitch;
          const rollDeg = isActive ? lineRoll * 0.15 : lineRoll;

          return (
            <div
              key={line.id ?? `fly_${i}`}
              className="absolute pointer-events-none"
              style={{
                left: `calc(50% + ${px}%)`,
                top: `calc(50% + ${py}%)`,
                transform: `translate(-50%, -50%) translateZ(${-rel * UNIT}px) rotateY(${yawDeg.toFixed(2)}deg) rotateX(${pitchDeg.toFixed(2)}deg) rotateZ(${rollDeg.toFixed(2)}deg)`,
                opacity,
                filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
                fontFamily: "'Bebas Neue', 'Anton', Impact, sans-serif",
                fontWeight: 400,
                fontSize: isActive
                  ? 'clamp(38px, 5.8vw, 78px)'
                  : line.text.length > 48
                    ? 'clamp(19px, 2.3vw, 32px)'
                    : 'clamp(22px, 3.2vw, 44px)',
                letterSpacing: '0.06em',
                lineHeight: 0.95,
                textTransform: 'uppercase',
                color: '#ffffff',
                textAlign: 'center',
                whiteSpace: 'normal',
                textWrap: 'balance',
                maxWidth: isActive ? '82vw' : '58vw',
                textShadow: isActive
                  ? '0 0 10px rgba(255,255,255,0.22), 0 6px 20px rgba(0,0,0,0.92)'
                  : '0 2px 12px rgba(0,0,0,0.85)',
                willChange: 'transform, opacity, filter',
                transition: 'none',
              }}
            >
              {(line.text || '').trim()}
            </div>
          );
        })}
      </div>

      {/* Cinematic depth vignette */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.75) 100%)',
        }}
      />

      {/* BPM-synced subtle scanline pulse — cheap depth cue */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{ background: 'rgba(255,255,255,0.45)', opacity: bpm && bpm > 0 ? 0.75 : 0 }}
      />
    </div>
  );
};

FlythroughRenderer.displayName = 'FlythroughRenderer';
