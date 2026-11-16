'use client';

/**
 * Stage typography catalog — Google Fonts for the lyric Stage renderers.
 *
 * Design rules:
 * - `default` keeps each renderer's designed font (zero visual change).
 * - Any other pick overrides flow / stage-focus / kinetic poster / editorial
 *   Latin text; complex scripts (CJK, Arabic, Indic, Thai…) always keep the
 *   Noto fallback stacks so shaping never breaks.
 * - Fonts load lazily at runtime via Google Fonts CSS (offline → system
 *   fallback stack, never a blank stage).
 */

export interface StageFontOption {
  id: string;
  label: string;
  /** CSS family name. Null = keep each renderer's designed font. */
  family: string | null;
  /** Google Fonts css2 family slug. Null = bundled/system (no download). */
  googleFamily: string | null;
  /** Weights to request from Google Fonts. */
  weights: number[];
  category: string;
}

export const STAGE_DEFAULT_FONT = 'poppins';
export const STAGE_AUTO_WEIGHT = '500';

export const STAGE_FONT_OPTIONS: StageFontOption[] = [
  { id: 'poppins', label: 'Poppins', family: 'Poppins', googleFamily: 'Poppins', weights: [400, 500, 600, 700, 800, 900], category: 'Sans' },
  { id: 'default', label: 'Mode default (Poppins)', family: 'Poppins', googleFamily: 'Poppins', weights: [400, 500, 600, 700, 800, 900], category: 'Sans' },
  { id: 'native', label: 'Billboard native (Pixeloid)', family: "'Pixeloid'", googleFamily: null, weights: [], category: 'Billboard' },
  { id: 'geist', label: 'Geist (App)', family: 'Geist', googleFamily: null, weights: [], category: 'System' },
  { id: 'inter', label: 'Inter', family: 'Inter', googleFamily: 'Inter', weights: [400, 500, 600, 700, 800, 900], category: 'Sans' },
  { id: 'manrope', label: 'Manrope', family: 'Manrope', googleFamily: 'Manrope', weights: [400, 500, 600, 700, 800], category: 'Sans' },
  { id: 'outfit', label: 'Outfit', family: 'Outfit', googleFamily: 'Outfit', weights: [400, 500, 600, 700, 800, 900], category: 'Sans' },
  { id: 'sora', label: 'Sora', family: 'Sora', googleFamily: 'Sora', weights: [400, 600, 700, 800], category: 'Sans' },
  { id: 'space-grotesk', label: 'Space Grotesk', family: "'Space Grotesk'", googleFamily: 'Space+Grotesk', weights: [400, 500, 600, 700], category: 'Sans' },
  { id: 'montserrat', label: 'Montserrat', family: 'Montserrat', googleFamily: 'Montserrat', weights: [400, 500, 600, 700, 800, 900], category: 'Sans' },
  { id: 'oswald', label: 'Oswald', family: 'Oswald', googleFamily: 'Oswald', weights: [400, 500, 600, 700], category: 'Condensed' },
  { id: 'archivo', label: 'Archivo', family: 'Archivo', googleFamily: 'Archivo', weights: [400, 500, 600, 700, 800, 900], category: 'Sans' },
  { id: 'roboto-condensed', label: 'Roboto Condensed', family: "'Roboto Condensed'", googleFamily: 'Roboto+Condensed', weights: [400, 600, 700], category: 'Condensed' },
  { id: 'bebas-neue', label: 'Bebas Neue', family: "'Bebas Neue'", googleFamily: 'Bebas+Neue', weights: [400], category: 'Display' },
  { id: 'anton', label: 'Anton', family: 'Anton', googleFamily: 'Anton', weights: [400], category: 'Display' },
  { id: 'league-gothic', label: 'League Gothic', family: "'League Gothic'", googleFamily: 'League+Gothic', weights: [400, 500, 600, 700, 800, 900], category: 'Condensed' },
  { id: 'playfair-display', label: 'Playfair Display', family: "'Playfair Display'", googleFamily: 'Playfair+Display', weights: [400, 500, 600, 700, 800, 900], category: 'Serif' },
  { id: 'fraunces', label: 'Fraunces', family: 'Fraunces', googleFamily: 'Fraunces', weights: [400, 500, 600, 700, 900], category: 'Serif' },
];

/**
 * Fonts selectable for the Colors mode lyric overlay. Excludes `default`
 * (per-mode designed font) and `native` (Billboard only) — Colors keeps a
 * display-font-first catalog so big high-contrast text stays legible.
 */
export const COLORS_FONT_OPTIONS: StageFontOption[] = STAGE_FONT_OPTIONS.filter(
  (o) => o.id !== 'default' && o.id !== 'native'
);

export const STAGE_WEIGHT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '500', label: 'Medium 500' },
  { value: 'auto', label: 'Auto (Medium 500)' },
  { value: '100', label: 'Thin 100' },
  { value: '200', label: 'ExtraLight 200' },
  { value: '300', label: 'Light 300' },
  { value: '400', label: 'Regular 400' },
  { value: '600', label: 'SemiBold 600' },
  { value: '700', label: 'Bold 700' },
  { value: '800', label: 'ExtraBold 800' },
  { value: '900', label: 'Black 900' },
];

/** Complex-script-safe fallback tail (mirrors --font-sans Noto coverage). */
const FALLBACK_TAIL =
  "'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Bengali', 'Noto Sans Arabic', 'Noto Sans Tamil', 'Noto Sans Telugu', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', system-ui, sans-serif";

export function getStageFontOption(id?: string): StageFontOption {
  const targetId = !id || id === 'default' ? STAGE_DEFAULT_FONT : id;
  return STAGE_FONT_OPTIONS.find((o) => o.id === targetId) ?? STAGE_FONT_OPTIONS[0];
}

/**
 * Builds the CSS font-family stack for stage lyric text.
 * Returns Poppins by default with universal complex script fallbacks.
 */
export function buildStageFontStack(familyId?: string): string {
  const opt = getStageFontOption(familyId);
  if (!opt.family) {
    return `'Poppins', ${FALLBACK_TAIL}`;
  }
  if (opt.id === 'geist') {
    return `var(--font-geist), ${FALLBACK_TAIL}`;
  }
  return `${opt.family}, ${FALLBACK_TAIL}`;
}

/** Numeric CSS font-weight, defaulting to 500 (Medium). */
export function stageFontWeightValue(weight?: string): number {
  if (!weight || weight === 'auto') return 500;
  const n = Number(weight);
  return Number.isFinite(n) && n >= 100 && n <= 900 ? n : 500;
}

const loadedFontLinks = new Set<string>();

/**
 * Lazily loads a stage font's weights from Google Fonts (once per family).
 * No-op for bundled/system fonts. Never throws (offline → fallback stack).
 */
export function ensureStageFontLoaded(familyId?: string): void {
  if (typeof document === 'undefined') return;
  const opt = getStageFontOption(familyId);
  if (!opt.googleFamily || opt.weights.length === 0) return;
  const key = `${opt.googleFamily}:${opt.weights.join(',')}`;
  if (loadedFontLinks.has(key)) return;
  loadedFontLinks.add(key);
  try {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${opt.googleFamily}:wght@${opt.weights.join(';')}&display=swap`;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  } catch {
    // Offline or CSP-blocked: system fallback stack still renders.
  }
}
