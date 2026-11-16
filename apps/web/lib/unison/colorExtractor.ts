'use client';

import { useState, useEffect } from 'react';

const colorCache = new Map<string, string>();

/**
 * Extracts a rich, vibrant dominant color from an image URL using a fast 16x16 offscreen canvas.
 * Falls back safely if CORS blocks reading pixel data.
 */
export async function getDominantColorFromImage(
  url: string | null | undefined,
  fallback = '#c88232'
): Promise<string> {
  if (!url || typeof window === 'undefined') return fallback;

  if (colorCache.has(url)) {
    return colorCache.get(url)!;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => {
      resolve(fallback);
    }, 1500);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          colorCache.set(url, fallback);
          return resolve(fallback);
        }

        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;

        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let counted = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Skip transparent or near-black/near-white pixels to get true saturated pigment
          if (a > 128) {
            const brightness = (r + g + b) / 3;
            const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r));
            // Prioritize colorful pixels
            if (brightness > 25 && brightness < 235) {
              const weight = maxDiff > 15 ? 2 : 1;
              rSum += r * weight;
              gSum += g * weight;
              bSum += b * weight;
              counted += weight;
            }
          }
        }

        if (counted > 0) {
          const avgR = Math.round(rSum / counted);
          const avgG = Math.round(gSum / counted);
          const avgB = Math.round(bSum / counted);
          const rgb = `rgb(${avgR}, ${avgG}, ${avgB})`;
          colorCache.set(url, rgb);
          resolve(rgb);
        } else {
          colorCache.set(url, fallback);
          resolve(fallback);
        }
      } catch {
        // CORS tainted canvas fallback
        colorCache.set(url, fallback);
        resolve(fallback);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      colorCache.set(url, fallback);
      resolve(fallback);
    };

    img.src = url;
  });
}

/**
 * React hook to reactively retrieve the dominant color of an image URL.
 */
export function useDominantColor(url: string | null | undefined, fallback = '#c88232'): string {
  const [color, setColor] = useState<string>(() => {
    if (url && colorCache.has(url)) return colorCache.get(url)!;
    return fallback;
  });

  useEffect(() => {
    if (!url) {
      setColor(fallback);
      return;
    }

    let active = true;
    getDominantColorFromImage(url, fallback).then((extracted) => {
      if (active) setColor(extracted);
    });

    return () => {
      active = false;
    };
  }, [url, fallback]);

  return color;
}
