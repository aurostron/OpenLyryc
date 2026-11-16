/**
 * OpenLyryc Indic Transliteration & Romanization Engine
 *
 * Unified, modular, offline Romanization suite for major Indic languages:
 * - Hindi (Devanagari)
 * - Punjabi (Gurmukhi)
 * - Bengali / Assamese (Bengali)
 * - Tamil (Tamil)
 * - Telugu (Telugu)
 * - Kannada (Kannada)
 * - Malayalam (Malayalam)
 * - Gujarati (Gujarati)
 * - Odia (Odia)
 * - Marathi (Devanagari variant)
 *
 * Open-source attribution & references:
 * - Sanscript.js (Brahmic transformation schemes - MIT License)
 * - Aksharamukha (Script transliteration - Apache 2.0 / MIT)
 * - Indic-Transliteration & Indic NLP Library (MIT License)
 */

import { IndicLanguageCode, INDIC_LANGUAGES, IndicLanguageInfo } from './types';
import { detectIndicLanguage, detectAllIndicLanguages, hasIndicScript, hasScript } from './detector';
import { convertDocumentToRomanHindi, transliterateHindiToRoman } from '../hindi';
import { convertDocumentToRomanPunjabi, transliteratePunjabiToRoman, hasPunjabiScript } from './punjabi';
import { convertDocumentToRomanBengali, transliterateBengaliToRoman, hasBengaliScript } from './bengali';
import { convertDocumentToRomanTamil, transliterateTamilToRoman, hasTamilScript } from './tamil';
import { convertDocumentToRomanTelugu, transliterateTeluguToRoman, hasTeluguScript } from './telugu';
import { convertDocumentToRomanKannada, transliterateKannadaToRoman, hasKannadaScript } from './kannada';
import { convertDocumentToRomanMalayalam, transliterateMalayalamToRoman, hasMalayalamScript } from './malayalam';
import { convertDocumentToRomanGujarati, transliterateGujaratiToRoman, hasGujaratiScript } from './gujarati';
import { convertDocumentToRomanOdia, transliterateOdiaToRoman, hasOdiaScript } from './odia';
import { convertDocumentToRomanMarathi, transliterateMarathiToRoman, hasMarathiScript } from './marathi';

export * from './types';
export * from './detector';
export * from './punjabi';
export * from './bengali';
export * from './tamil';
export * from './telugu';
export * from './kannada';
export * from './malayalam';
export * from './gujarati';
export * from './odia';
export * from './marathi';

/**
 * Universal Indic text-to-Roman transliterator with auto-detection.
 */
export function transliterateIndicToRoman(text: string, lang?: IndicLanguageCode): string {
  if (!text) return '';
  const targetLang = lang || detectIndicLanguage(text);
  if (!targetLang) return text;

  switch (targetLang) {
    case 'pa':
      return transliteratePunjabiToRoman(text);
    case 'bn':
      return transliterateBengaliToRoman(text);
    case 'ta':
      return transliterateTamilToRoman(text);
    case 'te':
      return transliterateTeluguToRoman(text);
    case 'kn':
      return transliterateKannadaToRoman(text);
    case 'ml':
      return transliterateMalayalamToRoman(text);
    case 'gu':
      return transliterateGujaratiToRoman(text);
    case 'or':
      return transliterateOdiaToRoman(text);
    case 'mr':
      return transliterateMarathiToRoman(text);
    case 'hi':
    default:
      return transliterateHindiToRoman(text);
  }
}

/**
 * Universal document converter for Indic lyrics.
 *
 * Automatically detects the Indic language from the document or uses the specified language.
 * Preserves millisecond-level word token timings and stores original script in `line.translations[lang]`.
 */
export function convertDocumentToIndicRoman<T extends { lines: Array<any>; metadata?: any }>(
  doc: T,
  preferredLanguage?: IndicLanguageCode
): { doc: T; language: IndicLanguageCode | null } {
  if (!doc || !doc.lines || doc.lines.length === 0) {
    return { doc, language: null };
  }

  const sampleTexts = doc.lines.slice(0, 15).map((l) => l.text);
  const targetLang = preferredLanguage || detectIndicLanguage(sampleTexts);

  if (!targetLang) {
    return { doc, language: null };
  }

  let convertedDoc: T;

  switch (targetLang) {
    case 'pa':
      convertedDoc = convertDocumentToRomanPunjabi(doc);
      break;
    case 'bn':
      convertedDoc = convertDocumentToRomanBengali(doc);
      break;
    case 'ta':
      convertedDoc = convertDocumentToRomanTamil(doc);
      break;
    case 'te':
      convertedDoc = convertDocumentToRomanTelugu(doc);
      break;
    case 'kn':
      convertedDoc = convertDocumentToRomanKannada(doc);
      break;
    case 'ml':
      convertedDoc = convertDocumentToRomanMalayalam(doc);
      break;
    case 'gu':
      convertedDoc = convertDocumentToRomanGujarati(doc);
      break;
    case 'or':
      convertedDoc = convertDocumentToRomanOdia(doc);
      break;
    case 'mr':
      convertedDoc = convertDocumentToRomanMarathi(doc);
      break;
    case 'hi':
    default:
      convertedDoc = convertDocumentToRomanHindi(doc);
      break;
  }

  return {
    doc: convertedDoc,
    language: targetLang,
  };
}
