/**
 * Client-Side Color Palette Extractor & Procedural Harmonic Generator
 * Extracts dominant colors from album artwork or generates harmonic ambient themes
 */

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  ambientGlow: string;
}

const PRESET_PALETTES: ColorPalette[] = [
  {
    primary: '#6366f1', // Indigo
    secondary: '#a855f7', // Purple
    accent: '#ec4899', // Pink
    ambientGlow: 'rgba(99, 102, 241, 0.25)',
  },
  {
    primary: '#06b6d4', // Cyan
    secondary: '#3b82f6', // Blue
    accent: '#8b5cf6', // Violet
    ambientGlow: 'rgba(6, 182, 212, 0.25)',
  },
  {
    primary: '#f59e0b', // Amber
    secondary: '#ef4444', // Red
    accent: '#ec4899', // Pink
    ambientGlow: 'rgba(245, 158, 11, 0.25)',
  },
  {
    primary: '#10b981', // Emerald
    secondary: '#06b6d4', // Cyan
    accent: '#3b82f6', // Blue
    ambientGlow: 'rgba(16, 185, 129, 0.25)',
  },
  {
    primary: '#8b5cf6', // Violet
    secondary: '#ec4899', // Pink
    accent: '#f43f5e', // Rose
    ambientGlow: 'rgba(139, 92, 246, 0.25)',
  },
];

/**
 * Deterministically generates harmonic palette based on string hash
 */
export function generateHarmonicPalette(seed: string): ColorPalette {
  if (!seed || seed.trim() === '') {
    return PRESET_PALETTES[0];
  }

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  const index = Math.abs(hash) % PRESET_PALETTES.length;
  return PRESET_PALETTES[index];
}

/**
 * Extracts dominant RGB palette from image source using offscreen HTML5 Canvas
 */
export async function extractColorsFromImage(imageSrc: string): Promise<ColorPalette> {
  if (typeof window === 'undefined') {
    return PRESET_PALETTES[0];
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
          resolve(PRESET_PALETTES[0]);
          return;
        }

        const sampleSize = 64;
        canvas.width = sampleSize;
        canvas.height = sampleSize;

        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;

        let rTotal = 0;
        let gTotal = 0;
        let bTotal = 0;
        let count = 0;

        const colorBuckets: { [key: string]: number } = {};

        for (let i = 0; i < imageData.length; i += 16) {
          const r = imageData[i];
          const g = imageData[i + 1];
          const b = imageData[i + 2];
          const a = imageData[i + 3];

          // Ignore transparent or near-black / near-white pixels
          if (a < 128 || (r < 25 && g < 25 && b < 25) || (r > 240 && g > 240 && b > 240)) {
            continue;
          }

          rTotal += r;
          gTotal += g;
          bTotal += b;
          count++;

          const quantR = Math.round(r / 32) * 32;
          const quantG = Math.round(g / 32) * 32;
          const quantB = Math.round(b / 32) * 32;
          const key = `${quantR},${quantG},${quantB}`;
          colorBuckets[key] = (colorBuckets[key] || 0) + 1;
        }

        if (count === 0) {
          resolve(PRESET_PALETTES[0]);
          return;
        }

        const sortedColors = Object.entries(colorBuckets)
          .sort((a, b) => b[1] - a[1])
          .map(([key]) => key.split(',').map(Number));

        const c1 = sortedColors[0] || [Math.round(rTotal / count), Math.round(gTotal / count), Math.round(bTotal / count)];
        const c2 = sortedColors[1] || [Math.min(255, c1[0] + 40), Math.min(255, c1[1] + 20), Math.min(255, c1[2] + 60)];
        const c3 = sortedColors[2] || [Math.max(0, c1[0] - 30), Math.min(255, c1[1] + 50), Math.max(0, c1[2] - 20)];

        const rgbToHex = (r: number, g: number, b: number) =>
          `#${[r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('')}`;

        const primary = rgbToHex(c1[0], c1[1], c1[2]);
        const secondary = rgbToHex(c2[0], c2[1], c2[2]);
        const accent = rgbToHex(c3[0], c3[1], c3[2]);

        resolve({
          primary,
          secondary,
          accent,
          ambientGlow: `rgba(${c1[0]}, ${c1[1]}, ${c1[2]}, 0.22)`,
        });
      } catch {
        resolve(PRESET_PALETTES[0]);
      }
    };

    img.onerror = () => {
      resolve(PRESET_PALETTES[0]);
    };

    img.src = imageSrc;
  });
}
