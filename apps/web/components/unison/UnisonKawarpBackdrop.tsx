'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Kawarp as KawarpCore } from '@kawarp/core';

export interface KawarpPreset {
  id: string;
  name: string;
  url: string;
  gradient: string[];
}

export const KAWARP_PRESETS: readonly KawarpPreset[] = [
  {
    id: 'aurora',
    name: 'Aurora',
    url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1600&q=80',
    gradient: ['#031826', '#0d4a4d', '#1e3a5f', '#2d1b4e'],
  },
  {
    id: 'forest',
    name: 'Forest',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80',
    gradient: ['#042318', '#0b452e', '#196f4c', '#03140d'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    url: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=800&q=80',
    gradient: ['#2e0c15', '#6b1828', '#9e3a24', '#1a050b'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    url: 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&q=80',
    gradient: ['#031a2f', '#093c66', '#0284c7', '#020e1a'],
  },
  {
    id: 'mountains',
    name: 'Mountains',
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    gradient: ['#0e0c24', '#2a2254', '#4b3f8a', '#080614'],
  },
] as const;

export interface UnisonKawarpBackdropProps {
  presetIndex?: number;
  src?: string;
  opacity?: number;
  className?: string;
}

export const UnisonKawarpBackdrop: React.FC<UnisonKawarpBackdropProps> = ({
  presetIndex = 0,
  src,
  opacity = 0.85,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const kawarpRef = useRef<KawarpCore | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine current active preset
  const activePreset = KAWARP_PRESETS[Math.abs(presetIndex) % KAWARP_PRESETS.length];
  const activeSrc = src || activePreset.url;

  // Initialize Kawarp instance on canvas mount
  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Set initial canvas pixel resolution
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width || window.innerWidth));
    const h = Math.max(1, Math.round(rect.height || window.innerHeight));
    canvas.width = w;
    canvas.height = h;

    let kawarp: KawarpCore;
    try {
      kawarp = new KawarpCore(canvas, {
        warpIntensity: 1.0,
        blurPasses: 5,
        animationSpeed: 1.0,
        transitionDuration: 3000,
        saturation: 0.0,
        tintColor: [0.157, 0.157, 0.235],
        tintIntensity: 0.15,
        dithering: 0.008,
        scale: 1.0,
      });
      kawarpRef.current = kawarp;
    } catch (err) {
      console.warn('[UnisonKawarp] WebGL context initialization error:', err);
      return;
    }

    // 1. Immediately render procedural gradient: 0 latency, guaranteed visual output
    try {
      kawarp.loadGradient(activePreset.gradient);
      kawarp.start();
    } catch (e) {
      console.warn('[UnisonKawarp] Gradient render error:', e);
    }

    // 2. Crossfade to high-res image if available
    if (activeSrc) {
      kawarp.loadImage(activeSrc).catch((err) => {
        console.debug('[UnisonKawarp] Note: using procedural gradient fallback:', err?.message || err);
      });
    }

    // Handle container resize
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (!container || !canvas || !kawarpRef.current) return;
      const r = container.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        canvas.width = Math.round(r.width);
        canvas.height = Math.round(r.height);
        kawarpRef.current.resize();
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(handleResize, 100);
    });
    resizeObserver.observe(container);

    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      if (resizeTimer) clearTimeout(resizeTimer);
      try {
        kawarp.stop();
        kawarp.dispose();
      } catch {
        // no-op on dispose
      }
      kawarpRef.current = null;
    };
  }, [mounted]);

  const lastLoadedSrcRef = useRef<string | null>(null);

  // Update image when activeSrc or preset changes with smooth 3s crossfade
  useEffect(() => {
    const kawarp = kawarpRef.current;
    if (!kawarp) return;

    const targetSrc = activeSrc || activePreset.url;
    if (targetSrc === lastLoadedSrcRef.current) return;
    lastLoadedSrcRef.current = targetSrc;

    if (targetSrc) {
      kawarp.loadImage(targetSrc).catch((err) => {
        console.debug('[UnisonKawarp] Image update fallback to gradient:', err?.message || err);
      });
    }
  }, [activePreset, activeSrc]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none overflow-hidden select-none z-0 transition-opacity duration-[3000ms] ease-out ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
      />
      {/* Light contrast vignette ensuring high contrast text readability while letting fluid colors shine */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/45 pointer-events-none" />
    </div>
  );
};

export default UnisonKawarpBackdrop;
