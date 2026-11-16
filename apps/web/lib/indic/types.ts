/**
 * OpenLyryc Indic Romanization Engine - Types & Specifications
 *
 * Open-source foundations & attribution:
 * - Sanscript.js (MIT License) - Brahmic scheme transformations
 * - Aksharamukha (Apache 2.0 / MIT) - Script conversion standards
 * - Indic-Transliteration (MIT) - Phonetic schemes (ITRANS, ISO 15919, Velthuis)
 * - Indic NLP Library (MIT) - Indian language syllable & script processing
 */

export type IndicLanguageCode =
  | 'hi' // Hindi (Devanagari)
  | 'pa' // Punjabi (Gurmukhi)
  | 'bn' // Bengali / Bangla
  | 'ta' // Tamil
  | 'te' // Telugu
  | 'kn' // Kannada
  | 'ml' // Malayalam
  | 'gu' // Gujarati
  | 'or' // Odia
  | 'mr'; // Marathi (Devanagari variant)

export interface IndicLanguageInfo {
  code: IndicLanguageCode;
  name: string;
  nativeName: string;
  scriptName: string;
  glyphSample: string;
  colorGradient: string;
  borderColor: string;
  textColor: string;
  badgeBg: string;
}

export interface IndicTransliterateOptions {
  capitalizeFirst?: boolean;
  preservePunctuation?: boolean;
  preserveSync?: boolean;
}

export const INDIC_LANGUAGES: Record<IndicLanguageCode, IndicLanguageInfo> = {
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    scriptName: 'Devanagari',
    glyphSample: 'अ',
    colorGradient: 'from-amber-500/15 to-orange-500/15 hover:from-amber-500/25 hover:to-orange-500/25',
    borderColor: 'border-amber-500/30 hover:border-amber-500/50',
    textColor: 'text-amber-200 hover:text-white',
    badgeBg: 'bg-amber-500/25 text-amber-300 border-amber-500/30',
  },
  pa: {
    code: 'pa',
    name: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    scriptName: 'Gurmukhi',
    glyphSample: 'ਅ',
    colorGradient: 'from-orange-500/15 to-yellow-500/15 hover:from-orange-500/25 hover:to-yellow-500/25',
    borderColor: 'border-orange-500/30 hover:border-orange-500/50',
    textColor: 'text-orange-200 hover:text-white',
    badgeBg: 'bg-orange-500/25 text-orange-300 border-orange-500/30',
  },
  bn: {
    code: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    scriptName: 'Bengali',
    glyphSample: 'অ',
    colorGradient: 'from-emerald-500/15 to-teal-500/15 hover:from-emerald-500/25 hover:to-teal-500/25',
    borderColor: 'border-emerald-500/30 hover:border-emerald-500/50',
    textColor: 'text-emerald-200 hover:text-white',
    badgeBg: 'bg-emerald-500/25 text-emerald-300 border-emerald-500/30',
  },
  ta: {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    scriptName: 'Tamil',
    glyphSample: 'அ',
    colorGradient: 'from-red-500/15 to-rose-500/15 hover:from-red-500/25 hover:to-rose-500/25',
    borderColor: 'border-red-500/30 hover:border-red-500/50',
    textColor: 'text-red-200 hover:text-white',
    badgeBg: 'bg-red-500/25 text-red-300 border-red-500/30',
  },
  te: {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    scriptName: 'Telugu',
    glyphSample: 'తె',
    colorGradient: 'from-cyan-500/15 to-blue-500/15 hover:from-cyan-500/25 hover:to-blue-500/25',
    borderColor: 'border-cyan-500/30 hover:border-cyan-500/50',
    textColor: 'text-cyan-200 hover:text-white',
    badgeBg: 'bg-cyan-500/25 text-cyan-300 border-cyan-500/30',
  },
  kn: {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    scriptName: 'Kannada',
    glyphSample: 'ಕ',
    colorGradient: 'from-yellow-500/15 to-amber-500/15 hover:from-yellow-500/25 hover:to-amber-500/25',
    borderColor: 'border-yellow-500/30 hover:border-yellow-500/50',
    textColor: 'text-yellow-200 hover:text-white',
    badgeBg: 'bg-yellow-500/25 text-yellow-300 border-yellow-500/30',
  },
  ml: {
    code: 'ml',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    scriptName: 'Malayalam',
    glyphSample: 'മ',
    colorGradient: 'from-green-500/15 to-emerald-500/15 hover:from-green-500/25 hover:to-emerald-500/25',
    borderColor: 'border-green-500/30 hover:border-green-500/50',
    textColor: 'text-green-200 hover:text-white',
    badgeBg: 'bg-green-500/25 text-green-300 border-green-500/30',
  },
  gu: {
    code: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    scriptName: 'Gujarati',
    glyphSample: 'ગુ',
    colorGradient: 'from-pink-500/15 to-rose-500/15 hover:from-pink-500/25 hover:to-rose-500/25',
    borderColor: 'border-pink-500/30 hover:border-pink-500/50',
    textColor: 'text-pink-200 hover:text-white',
    badgeBg: 'bg-pink-500/25 text-pink-300 border-pink-500/30',
  },
  or: {
    code: 'or',
    name: 'Odia',
    nativeName: 'ଓଡ଼ିଆ',
    scriptName: 'Odia',
    glyphSample: 'ଓ',
    colorGradient: 'from-purple-500/15 to-violet-500/15 hover:from-purple-500/25 hover:to-violet-500/25',
    borderColor: 'border-purple-500/30 hover:border-purple-500/50',
    textColor: 'text-purple-200 hover:text-white',
    badgeBg: 'bg-purple-500/25 text-purple-300 border-purple-500/30',
  },
  mr: {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    scriptName: 'Devanagari (Marathi)',
    glyphSample: 'म',
    colorGradient: 'from-amber-600/15 to-red-600/15 hover:from-amber-600/25 hover:to-red-600/25',
    borderColor: 'border-amber-600/30 hover:border-amber-600/50',
    textColor: 'text-amber-100 hover:text-white',
    badgeBg: 'bg-amber-600/25 text-amber-200 border-amber-600/30',
  },
};
