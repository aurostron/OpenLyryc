'use client';

import React, { useEffect, useRef, useState } from 'react';
import { KawarpCore, KawarpOptions } from '@/lib/kawarp/KawarpCore';

export interface KawarpBackgroundProps {
  /** Source image URL (album cover art) */
  src?: string;
  /** Audio playback state to couple fluid movement with music */
  isPlaying?: boolean;
  /** Warp distortion intensity (0.0 to 1.0, default: 0.85) */
  warpIntensity?: number;
  /** Blur pass count (default: 8) */
  blurPasses?: number;
  /** Ambient darkness dim overlay (0.0 to 1.0, default: 0.55) */
  dim?: number;
  /** Color saturation (default: 1.45) */
  saturation?: number;
  /** Custom CSS classes */
  className?: string;
  /** Custom inline styles */
  style?: React.CSSProperties;
}

export const KawarpBackground: React.FC<KawarpBackgroundProps> = ({
  src,
  isPlaying = true,
  warpIntensity = 0.85,
  blurPasses = 8,
  dim = 0.55,
  saturation = 1.45,
  className = '',
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kawarpRef = useRef<KawarpCore | null>(null);
  const [webglSupported, setWebglSupported] = useState<boolean>(true);
  const lastLoadedSrcRef = useRef<string | undefined>(undefined);

  // Initialize Kawarp engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const kawarp = new KawarpCore(canvas, {
        warpIntensity,
        blurPasses,
        saturation,
        animationSpeed: isPlaying ? 0.8 : 0.22,
        transitionDuration: 1100,
        dithering: 0.008,
      });

      kawarpRef.current = kawarp;
      setWebglSupported(true);

      // Load initial artwork if provided
      if (src) {
        lastLoadedSrcRef.current = src;
        kawarp.loadImage(src).then(() => {
          kawarp.start();
        }).catch(() => {
          // Fallback to warm ambient gradient
          kawarp.loadGradient(['#1c1c24', '#2a2236', '#141418']);
          kawarp.start();
        });
      } else {
        kawarp.loadGradient(['#141419', '#221e2e', '#101014']);
        kawarp.start();
      }
    } catch (err) {
      console.warn('[KawarpBackground] WebGL initialization failed, using CSS fallback:', err);
      setWebglSupported(false);
    }

    return () => {
      kawarpRef.current?.dispose();
      kawarpRef.current = null;
    };
  }, []);

  // Update image source when song changes with smooth crossfade
  useEffect(() => {
    const kawarp = kawarpRef.current;
    if (!kawarp || !src || src === lastLoadedSrcRef.current) return;

    lastLoadedSrcRef.current = src;
    kawarp.loadImage(src).catch((err) => {
      console.warn('[KawarpBackground] Failed to load image source:', err);
    });
  }, [src]);

  // Adjust animation speed based on audio playback state & reduced motion
  useEffect(() => {
    const kawarp = kawarpRef.current;
    if (!kawarp) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      kawarp.animationSpeed = 0.05;
    } else {
      // Dynamic coupling: active fluid motion during play, serene resting drift when paused
      kawarp.animationSpeed = isPlaying ? 0.8 : 0.22;
    }
  }, [isPlaying]);

  // Update shader options when props change
  useEffect(() => {
    kawarpRef.current?.setOptions({
      warpIntensity,
      blurPasses,
      saturation,
    });
  }, [warpIntensity, blurPasses, saturation]);

  // Viewport-aware downsampling & resize observer
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      // Smart resolution clamp: Cap rendering bounds to max 1280x720 (0.65x viewport scaling).
      // Because domain warp is heavily blurred, this delivers flawless visual fidelity while
      // cutting GPU fill rate and thermal/battery usage by ~75% compared to native 4K/Retina.
      const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.25);
      const MAX_WIDTH = 1280;
      const MAX_HEIGHT = 720;
      const targetWidth = Math.max(320, Math.min(MAX_WIDTH, Math.round(rect.width * 0.65 * dpr)));
      const targetHeight = Math.max(180, Math.min(MAX_HEIGHT, Math.round(rect.height * 0.65 * dpr)));

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        kawarpRef.current?.resize();
      }
    };

    const debouncedResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateDimensions, 100);
    };

    const observer = new ResizeObserver(debouncedResize);
    observer.observe(container);
    updateDimensions();

    return () => {
      observer.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, []);

  // Battery saver: Pause render loop when browser tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        kawarpRef.current?.stop();
      } else {
        kawarpRef.current?.start();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden ${className}`}
      style={style}
      aria-hidden="true"
    >
      {webglSupported ? (
        <canvas
          ref={canvasRef}
          className="w-full h-full object-cover transition-opacity duration-1000"
          style={{
            filter: 'contrast(1.05) brightness(0.95)',
          }}
        />
      ) : (
        /* Graceful CSS Blur Fallback if WebGL is unavailable */
        src && (
          <div
            className="w-full h-full bg-cover bg-center scale-125 transition-all duration-700"
            style={{
              backgroundImage: `url(${src})`,
              filter: 'blur(40px)',
            }}
          />
        )
      )}

      {/* Ambient Dimming Overlay to ensure pristine lyric readability */}
      <div
        className="absolute inset-0 bg-black transition-opacity duration-500"
        style={{ opacity: Math.max(0, Math.min(0.95, dim)) }}
      />

      {/* Subtle Bottom & Radial Gradient to anchor the player controls */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
    </div>
  );
};

export default KawarpBackground;
