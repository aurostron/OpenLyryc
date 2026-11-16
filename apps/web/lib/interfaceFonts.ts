'use client';

/**
 * Interface font catalog — Google Fonts for the Studio UI only.
 *
 * Design rules:
 * - `geist` is the bundled default (zero visual change, no download).
 * - Fonts load lazily at runtime via Google Fonts CSS, only when selected,
 *   with `display=swap` — offline means the system sans fallback stack.
 * - This catalog is separate from the Stage lyric fonts and never affects
 *   any lyric renderer; it only changes `--font-ui` on the Studio root.
 */

export interface InterfaceFontOption {
  id: string;
  label: string;
  /** CSS family name. Null = bundled/system (no download). */
  family: string | null;
  /** Google Fonts css2 family slug. Null = bundled/system (no download). */
  googleFamily: string | null;
  /** Weights to request from Google Fonts. */
  weights: number[];
}

export const INTERFACE_DEFAULT_FONT = 'geist';

export const INTERFACE_FONT_OPTIONS: InterfaceFontOption[] = [
  { id: 'geist', label: 'Geist', family: 'Geist', googleFamily: null, weights: [] },
  { id: 'geist-mono', label: 'Geist Mono', family: 'Geist Mono', googleFamily: null, weights: [] },
  { id: 'inter', label: 'Inter', family: 'Inter', googleFamily: 'Inter', weights: [400, 500, 600, 700] },
  { id: 'outfit', label: 'Outfit', family: 'Outfit', googleFamily: 'Outfit', weights: [400, 500, 600, 700] },
  { id: 'manrope', label: 'Manrope', family: 'Manrope', googleFamily: 'Manrope', weights: [400, 500, 600, 700] },
  { id: 'poppins', label: 'Poppins', family: 'Poppins', googleFamily: 'Poppins', weights: [400, 500, 600, 700] },
  { id: 'sora', label: 'Sora', family: 'Sora', googleFamily: 'Sora', weights: [400, 500, 600, 700] },
  { id: 'space-grotesk', label: 'Space Grotesk', family: "'Space Grotesk'", googleFamily: 'Space+Grotesk', weights: [400, 500, 600, 700] },
  { id: 'archivo', label: 'Archivo', family: 'Archivo', googleFamily: 'Archivo', weights: [400, 500, 600, 700] },
  { id: 'montserrat', label: 'Montserrat', family: 'Montserrat', googleFamily: 'Montserrat', weights: [400, 500, 600, 700] },
  { id: 'figtree', label: 'Figtree', family: 'Figtree', googleFamily: 'Figtree', weights: [400, 500, 600, 700] },
  { id: 'instrument-sans', label: 'Instrument Sans', family: "'Instrument Sans'", googleFamily: 'Instrument+Sans', weights: [400, 500, 600, 700] },
  { id: 'ibm-plex-sans', label: 'IBM Plex Sans', family: "'IBM Plex Sans'", googleFamily: 'IBM+Plex+Sans', weights: [400, 500, 600, 700] },
];

export function getInterfaceFontOption(id?: string): InterfaceFontOption {
  const targetId = !id ? INTERFACE_DEFAULT_FONT : id;
  return INTERFACE_FONT_OPTIONS.find((o) => o.id === targetId) ?? INTERFACE_FONT_OPTIONS[0];
}

const FALLBACK_TAIL =
  "'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Bengali', 'Noto Sans Arabic', 'Noto Sans Tamil', 'Noto Sans Telugu', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * Builds the CSS font-family stack for the Studio UI.
 * Geist and Geist Mono resolve to the bundled next/font stacks.
 */
export function buildInterfaceFontStack(familyId?: string): string {
  const opt = getInterfaceFontOption(familyId);
  if (opt.id === 'geist') {
    return `var(--font-geist), ${FALLBACK_TAIL}`;
  }
  if (opt.id === 'geist-mono') {
    return `var(--font-geist_mono), ${FALLBACK_TAIL}`;
  }
  if (!opt.family) {
    return `var(--font-geist), ${FALLBACK_TAIL}`;
  }
  return `${opt.family}, ${FALLBACK_TAIL}`;
}

const loadedFontLinks = new Set<string>();

/**
 * Lazily loads an interface font's weights from Google Fonts (once per family).
 * No-op for bundled Geist/Geist Mono. Never throws (offline → fallback stack).
 */
export function ensureInterfaceFontLoaded(familyId?: string): void {
  if (typeof document === 'undefined') return;
  const opt = getInterfaceFontOption(familyId);
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
