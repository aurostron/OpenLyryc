/**
 * OpenLyryc Indic Script & Language Detector
 *
 * High-speed Unicode block analyzer that identifies which Indic script
 * is present in lyrics text, lines, or documents.
 */

import { IndicLanguageCode } from './types';

// Unicode Script Block Regexes
export const SCRIPT_PATTERNS: Record<IndicLanguageCode, RegExp> = {
  hi: /[\u0900-\u097F]/, // Devanagari (Hindi)
  pa: /[\u0A00-\u0A7F]/, // Gurmukhi (Punjabi)
  bn: /[\u0980-\u09FF]/, // Bengali / Assamese
  ta: /[\u0B80-\u0BFF]/, // Tamil
  te: /[\u0C00-\u0C7F]/, // Telugu
  kn: /[\u0C80-\u0CFF]/, // Kannada
  ml: /[\u0D00-\u0D7F]/, // Malayalam
  gu: /[\u0A80-\u0AFF]/, // Gujarati
  or: /[\u0B00-\u0B7F]/, // Odia
  mr: /[\u0900-\u097F]/, // Devanagari (Marathi)
};

// Distinctive characters for Marathi (e.g. ळ = U+0933) or specific words
const MARATHI_DISTINCTIVE = /[\u0933\u0972\u0973\u0974\u0975]/;

export function hasIndicScript(text: string): boolean {
  if (!text) return false;
  // Check range 0x0900 to 0x0D7F
  return /[\u0900-\u0D7F]/.test(text);
}

export function hasScript(text: string, lang: IndicLanguageCode): boolean {
  if (!text) return false;
  const pattern = SCRIPT_PATTERNS[lang];
  return pattern ? pattern.test(text) : false;
}

/**
 * Detects the predominant Indic language from a sample of text or array of lyric lines.
 * Returns null if no Indic script is found.
 */
export function detectIndicLanguage(textOrLines: string | string[]): IndicLanguageCode | null {
  const text = Array.isArray(textOrLines) ? textOrLines.join(' ') : textOrLines;
  if (!text || !hasIndicScript(text)) return null;

  // Count character matches per script block
  const counts: Record<IndicLanguageCode, number> = {
    pa: (text.match(/[\u0A00-\u0A7F]/g) || []).length,
    bn: (text.match(/[\u0980-\u09FF]/g) || []).length,
    ta: (text.match(/[\u0B80-\u0BFF]/g) || []).length,
    te: (text.match(/[\u0C00-\u0C7F]/g) || []).length,
    kn: (text.match(/[\u0C80-\u0CFF]/g) || []).length,
    ml: (text.match(/[\u0D00-\u0D7F]/g) || []).length,
    gu: (text.match(/[\u0A80-\u0AFF]/g) || []).length,
    or: (text.match(/[\u0B00-\u0B7F]/g) || []).length,
    hi: (text.match(/[\u0900-\u097F]/g) || []).length,
    mr: 0,
  };

  // If Devanagari is found, distinguish Marathi if distinctive Marathi characters exist
  if (counts.hi > 0 && MARATHI_DISTINCTIVE.test(text)) {
    counts.mr = (text.match(MARATHI_DISTINCTIVE) || []).length * 10;
  }

  let highestLang: IndicLanguageCode | null = null;
  let highestCount = 0;

  for (const [lang, count] of Object.entries(counts) as [IndicLanguageCode, number][]) {
    if (count > highestCount) {
      highestCount = count;
      highestLang = lang;
    }
  }

  return highestCount > 0 ? highestLang : null;
}

/**
 * Detects all distinct Indic languages present in a lyric document.
 */
export function detectAllIndicLanguages(lines: Array<{ text: string }>): IndicLanguageCode[] {
  const detected = new Set<IndicLanguageCode>();
  const fullText = lines.map((l) => l.text).join(' ');

  for (const lang of ['pa', 'bn', 'ta', 'te', 'kn', 'ml', 'gu', 'or', 'hi'] as IndicLanguageCode[]) {
    if (hasScript(fullText, lang)) {
      if (lang === 'hi' && MARATHI_DISTINCTIVE.test(fullText)) {
        detected.add('mr');
      } else {
        detected.add(lang);
      }
    }
  }

  return Array.from(detected);
}
