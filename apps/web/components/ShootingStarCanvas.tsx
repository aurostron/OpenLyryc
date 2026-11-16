'use client';

import React, { useEffect, useRef } from 'react';

export interface ShootingStarCanvasProps {
  /** Master toggle to enable or disable the night sky starfield & meteors */
  enabled?: boolean;
  /** Normalized mouse offset for parallax translation (-1 to 1) */
  mouseOffset?: { x: number; y: number };
  /** Parallax shift magnitude in pixels (default: 14) */
  parallaxFactor?: number;
  /** Optional custom CSS classes */
  className?: string;
}

interface AmbientStar {
  xPct: number;
  yPct: number;
  baseRadius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  color: string;
  hasCorona?: boolean;
}

interface IonizationParticle {
  x: number;
  y: number;
  alpha: number;
  maxAlpha: number;
  birth: number;
  lifetime: number; // in ms
  radius: number;
  colorRgb: string;
}

interface ActiveMeteor {
  id: number;
  startX: number;
  startY: number;
  angle: number; // in radians
  speed: number; // px per second
  length: number; // px
  coreRadius: number; // px
  startTime: number; // performance.now()
  duration: number; // ms
  colorRgb: string; // e.g. '210, 235, 255'
  hasFlare: boolean;
  flarePoint: number; // 0.4 to 0.7
  train: IonizationParticle[];
}

// Generate realistic ambient background stars
function createStarfield(count: number): AmbientStar[] {
  const stars: AmbientStar[] = [];
  const colorPalette = [
    '255, 255, 255', // Pure incandescent white (65%)
    '255, 255, 255',
    '255, 255, 255',
    '255, 255, 255',
    '210, 235, 255', // Electric cyan-blue (20%)
    '210, 235, 255',
    '255, 240, 215', // Warm golden dwarf (15%)
  ];

  for (let i = 0; i < count; i++) {
    // Concentrate stars primarily in the upper night sky (top 50% of viewport)
    // with a gentle atmospheric falloff towards the mountain horizon
    const yPct = Math.pow(Math.random(), 1.35) * 0.52;
    const xPct = Math.random();

    const isBrightAnchor = Math.random() < 0.08;
    const isMediumStar = Math.random() < 0.25;

    const baseRadius = isBrightAnchor
      ? 1.3 + Math.random() * 0.7
      : isMediumStar
      ? 0.9 + Math.random() * 0.4
      : 0.5 + Math.random() * 0.35;

    const baseAlpha = isBrightAnchor
      ? 0.75 + Math.random() * 0.25
      : isMediumStar
      ? 0.45 + Math.random() * 0.35
      : 0.2 + Math.random() * 0.3;

    const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];

    stars.push({
      xPct,
      yPct,
      baseRadius,
      baseAlpha,
      twinkleSpeed: 0.8 + Math.random() * 2.2,
      twinklePhase: Math.random() * Math.PI * 2,
      color,
      hasCorona: isBrightAnchor,
    });
  }

  return stars;
}

export const ShootingStarCanvas: React.FC<ShootingStarCanvasProps> = ({
  enabled = true,
  mouseOffset = { x: 0, y: 0 },
  parallaxFactor = 14,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const starsRef = useRef<AmbientStar[]>([]);
  const activeMeteorsRef = useRef<ActiveMeteor[]>([]);
  const nextSpawnTimeRef = useRef<number>(0);
  const meteorIdCounterRef = useRef<number>(0);
  const mouseOffsetRef = useRef(mouseOffset);
  mouseOffsetRef.current = mouseOffset;

  useEffect(() => {
    // Generate initial 95 celestial stars
    starsRef.current = createStarfield(95);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;
    let isTabVisible = !document.hidden;

    // Handle tab visibility to save device battery
    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) {
        nextSpawnTimeRef.current = performance.now() + 1200;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // DPI Scaling and Canvas Size synchronization
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for optimal GPU fill-rate
      width = rect.width;
      height = rect.height;

      if (width > 0 && height > 0) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }
    };

    resize();
    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);

    // Initial meteor schedule: first meteor arrives 1.8s after mount
    nextSpawnTimeRef.current = performance.now() + 1800;

    // Meteor color spectrum
    const meteorColors = [
      '225, 242, 255', // 70% Icy atmospheric cyan-white
      '225, 242, 255',
      '225, 242, 255',
      '255, 255, 255', // 15% Blinding magnesium white
      '180, 255, 220', // 10% High-altitude auroral green/nickel
      '255, 225, 175', // 5% Rare warm golden fireball
    ];

    const spawnMeteor = (now: number, isSecondaryTwin = false) => {
      if (width <= 0 || height <= 0) return;

      // Realistic meteor shower radiant geometry:
      // Angles vary subtly around 33° to 41° downward (0.57 to 0.72 rad)
      const baseAngle = 0.62; // ~35.5 degrees
      const angle = baseAngle + (Math.random() - 0.5) * 0.16;

      // Starting positions across the upper sky
      // Ensure flight crosses visible sky area
      const startX = isSecondaryTwin
        ? Math.random() * width * 0.7
        : (Math.random() * 1.1 - 0.1) * width;
      const startY = (Math.random() * 0.28 - 0.05) * height;

      // Speed in CSS pixels/second: swift atmospheric streak (~0.35s to 0.65s flight)
      const speed = 1950 + Math.random() * 1150;
      const duration = (380 + Math.random() * 280); // in ms
      const length = 130 + Math.random() * 150;
      const coreRadius = 1.3 + Math.random() * 0.9;
      const colorRgb = meteorColors[Math.floor(Math.random() * meteorColors.length)];

      const hasFlare = Math.random() < 0.32; // 32% chance of mid-flight fragmentation pop
      const flarePoint = 0.42 + Math.random() * 0.26;

      const meteor: ActiveMeteor = {
        id: ++meteorIdCounterRef.current,
        startX,
        startY,
        angle,
        speed,
        length,
        coreRadius,
        startTime: now,
        duration,
        colorRgb,
        hasFlare,
        flarePoint,
        train: [],
      };

      activeMeteorsRef.current.push(meteor);

      // 14% chance of spawning a quick twin meteor right behind it
      if (!isSecondaryTwin && Math.random() < 0.14) {
        setTimeout(() => {
          if (isTabVisible) {
            spawnMeteor(performance.now(), true);
          }
        }, 220 + Math.random() * 320);
      }
    };

    // Main 60-120fps Rendering Loop
    const render = (now: number) => {
      if (!isTabVisible) {
        animId = requestAnimationFrame(render);
        return;
      }

      if (width <= 0 || height <= 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      // 1. Check meteor spawn timer (authentic randomized interval between 2.8s and 5.8s)
      if (now >= nextSpawnTimeRef.current) {
        spawnMeteor(now);
        nextSpawnTimeRef.current = now + (2800 + Math.random() * 3000);
      }

      // 2. Clear canvas with crisp transparent clear
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Use additive blend mode for hyper-realistic luminous incandescence
      ctx.globalCompositeOperation = 'lighter';

      // 3. Render Distant Ambient Stars with Organic Scintillation (Twinkle)
      const stars = starsRef.current;
      const starCount = stars.length;
      const timeSeconds = now * 0.001;

      for (let i = 0; i < starCount; i++) {
        const star = stars[i];
        const sx = star.xPct * width;
        const sy = star.yPct * height;

        // Realistic atmospheric twinkle: non-linear sine pulsation
        const twinkle = Math.sin(timeSeconds * star.twinkleSpeed + star.twinklePhase);
        const alpha = Math.max(0.08, Math.min(1, star.baseAlpha * (0.7 + 0.3 * twinkle)));

        // Core star point
        ctx.fillStyle = `rgba(${star.color}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, star.baseRadius, 0, Math.PI * 2);
        ctx.fill();

        // Soft halo on brighter anchor stars
        if (star.hasCorona && alpha > 0.6) {
          const coronaGrad = ctx.createRadialGradient(
            sx,
            sy,
            0,
            sx,
            sy,
            star.baseRadius * 3.5
          );
          coronaGrad.addColorStop(0, `rgba(${star.color}, ${alpha * 0.35})`);
          coronaGrad.addColorStop(1, `rgba(${star.color}, 0)`);
          ctx.fillStyle = coronaGrad;
          ctx.beginPath();
          ctx.arc(sx, sy, star.baseRadius * 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4. Update and Render Active Shooting Stars & Ionization Trains
      const meteors = activeMeteorsRef.current;
      const survivingMeteors: ActiveMeteor[] = [];

      for (let m = 0; m < meteors.length; m++) {
        const meteor = meteors[m];
        const elapsed = now - meteor.startTime;
        const progress = Math.min(1, Math.max(0, elapsed / meteor.duration));

        // Atmospheric luminosity curve:
        // - Entry (0.0 -> 0.22): rapid heating incandescence ramp
        // - Cruise (0.22 -> 0.72): peak luminosity with optional fragmentation flare
        // - Burn-out (0.72 -> 1.0): rapid ablation decay
        let intensity = 0;
        if (progress < 0.22) {
          intensity = Math.sin((progress / 0.22) * (Math.PI / 2));
        } else if (progress < 0.72) {
          intensity = 1.0;
          if (meteor.hasFlare) {
            const flareDelta = Math.abs(progress - meteor.flarePoint);
            if (flareDelta < 0.06) {
              const flareBoost = Math.cos((flareDelta / 0.06) * (Math.PI / 2));
              intensity += flareBoost * 0.45;
            }
          }
        } else {
          const decayT = (progress - 0.72) / 0.28;
          intensity = Math.max(0, Math.pow(1 - decayT, 1.8));
        }

        // Current head position
        const traveledDistance = (meteor.speed * elapsed) / 1000;
        const headX = meteor.startX + Math.cos(meteor.angle) * traveledDistance;
        const headY = meteor.startY + Math.sin(meteor.angle) * traveledDistance;

        // Dynamic tail length (grows smoothly on entry, shrinks on burnout)
        const currentLength = meteor.length * Math.min(1, progress / 0.25) * Math.max(0.2, intensity);
        const tailX = headX - Math.cos(meteor.angle) * currentLength;
        const tailY = headY - Math.sin(meteor.angle) * currentLength;

        // Emit ionization particles into the persistent wake train (every 14ms)
        if (progress < 0.88 && intensity > 0.15) {
          meteor.train.push({
            x: headX,
            y: headY,
            alpha: intensity * 0.4,
            maxAlpha: intensity * 0.4,
            birth: now,
            lifetime: 450 + Math.random() * 350, // in ms
            radius: meteor.coreRadius * (1.1 + Math.random() * 0.8),
            colorRgb: meteor.colorRgb,
          });
        }

        // A. Render Persistent Ionization Train (Smoke / Plasma remnant)
        const train = meteor.train;
        const survivingTrain: IonizationParticle[] = [];

        for (let t = 0; t < train.length; t++) {
          const p = train[t];
          const pAge = (now - p.birth) / p.lifetime;
          if (pAge < 1) {
            const trainAlpha = p.maxAlpha * Math.pow(1 - pAge, 1.4);
            const trainRadius = p.radius * (1 + pAge * 1.8); // Gently expands as plasma diffuses

            ctx.fillStyle = `rgba(${p.colorRgb}, ${trainAlpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, trainRadius, 0, Math.PI * 2);
            ctx.fill();

            survivingTrain.push(p);
          }
        }
        meteor.train = survivingTrain;

        // B. Render Active Meteor Streak and Head (if still active)
        if (progress < 1 && intensity > 0.01) {
          // 1. Soft atmospheric light scattering aura (outer soft streak)
          const auraGrad = ctx.createLinearGradient(headX, headY, tailX, tailY);
          auraGrad.addColorStop(0, `rgba(255, 255, 255, ${intensity * 0.5})`);
          auraGrad.addColorStop(0.25, `rgba(${meteor.colorRgb}, ${intensity * 0.35})`);
          auraGrad.addColorStop(0.7, `rgba(${meteor.colorRgb}, ${intensity * 0.12})`);
          auraGrad.addColorStop(1, `rgba(${meteor.colorRgb}, 0)`);

          ctx.strokeStyle = auraGrad;
          ctx.lineWidth = meteor.coreRadius * 4.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(headX, headY);
          ctx.lineTo(tailX, tailY);
          ctx.stroke();

          // 2. High-intensity incandescent ionization core trail
          const coreGrad = ctx.createLinearGradient(headX, headY, tailX, tailY);
          coreGrad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, intensity * 1.2)})`);
          coreGrad.addColorStop(0.18, `rgba(255, 255, 255, ${intensity * 0.9})`);
          coreGrad.addColorStop(0.45, `rgba(${meteor.colorRgb}, ${intensity * 0.6})`);
          coreGrad.addColorStop(0.85, `rgba(${meteor.colorRgb}, ${intensity * 0.2})`);
          coreGrad.addColorStop(1, `rgba(${meteor.colorRgb}, 0)`);

          ctx.strokeStyle = coreGrad;
          ctx.lineWidth = meteor.coreRadius * 1.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(headX, headY);
          ctx.lineTo(tailX, tailY);
          ctx.stroke();

          // 3. Blinding White Pinpoint Head & Radial Ionization Corona
          const headGlow = ctx.createRadialGradient(
            headX,
            headY,
            0,
            headX,
            headY,
            meteor.coreRadius * 3.8
          );
          headGlow.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, intensity * 1.3)})`);
          headGlow.addColorStop(0.3, `rgba(${meteor.colorRgb}, ${intensity * 0.75})`);
          headGlow.addColorStop(1, `rgba(${meteor.colorRgb}, 0)`);

          ctx.fillStyle = headGlow;
          ctx.beginPath();
          ctx.arc(headX, headY, meteor.coreRadius * 3.8, 0, Math.PI * 2);
          ctx.fill();

          // Keep meteor alive while progress < 1
          survivingMeteors.push(meteor);
        } else if (meteor.train.length > 0) {
          // Even after meteor head burns out, keep object alive until its lingering smoke train fades!
          survivingMeteors.push(meteor);
        }
      }

      activeMeteorsRef.current = survivingMeteors;
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      resizeObserver.disconnect();
    };
  }, [enabled]);

  // Compute optical depth parallax shift
  const px = mouseOffset.x * -parallaxFactor;
  const py = mouseOffset.y * -(parallaxFactor * 0.72);

  return (
    <div
      className={`absolute inset-[-40px] pointer-events-none overflow-hidden select-none transition-transform duration-75 ease-out ${className}`}
      style={{
        transform: `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, 0)`,
      }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full pointer-events-none block"
      />
    </div>
  );
};

ShootingStarCanvas.displayName = 'ShootingStarCanvas';
