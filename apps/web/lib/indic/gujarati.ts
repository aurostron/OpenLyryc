/**
 * OpenLyryc Gujarati Transliteration Engine (Gujarati to Roman Gujarati)
 *
 * Tailored for Gujarati music, Garba, Sugam Sangeet, and folk songs
 * (Aditya Gadhvi, Kinjal Dave, Kirtidan Gadhvi, Sachin-Jigar).
 *
 * Attribution:
 * - Sanscript.js & Gujarati Open Source Tools (MIT License)
 * - Aksharamukha & Indic NLP Library (MIT License)
 *
 * Key features:
 * - Word-final schwa deletion for natural lyric singing rhythm.
 * - Anusvara (ં) nasalization.
 * - High-frequency Garba and Gujarati lyric lexicon.
 * - Non-destructive: preserves original script in line.translations.gu.
 */

import { IndicTransliterateOptions } from './types';

// Independent Vowels
const VOWELS_INDEPENDENT: Record<string, string> = {
  'અ': 'a',
  'આ': 'aa',
  'ઇ': 'i',
  'ઈ': 'ee',
  'ઉ': 'u',
  'ઊ': 'oo',
  'ઋ': 'ru',
  'એ': 'e',
  'ઐ': 'ai',
  'ઓ': 'o',
  'ઔ': 'au',
};

// Dependent Vowel Matras
const VOWELS_MATRA: Record<string, string> = {
  'ા': 'aa',
  'િ': 'i',
  'ી': 'ee',
  'ુ': 'u',
  'ૂ': 'oo',
  'ૃ': 'ru',
  'ે': 'e',
  'ૈ': 'ai',
  'ો': 'o',
  'ૌ': 'au',
};

// Consonants
const CONSONANTS: Record<string, string> = {
  'ક': 'k', 'ખ': 'kh', 'ગ': 'g', 'ઘ': 'gh', 'ઙ': 'ng',
  'ચ': 'ch', 'છ': 'chh', 'જ': 'j', 'ઝ': 'jh', 'ઞ': 'ny',
  'ટ': 't', 'ઠ': 'th', 'ડ': 'd', 'ઢ': 'dh', 'ણ': 'n',
  'ત': 't', 'થ': 'th', 'દ': 'd', 'ધ': 'dh', 'ન': 'n',
  'પ': 'p', 'ફ': 'f', 'બ': 'b', 'ભ': 'bh', 'મ': 'm',
  'ય': 'y', 'ર': 'r', 'લ': 'l', 'વ': 'v', 'શ': 'sh',
  'ષ': 'sh', 'સ': 's', 'હ': 'h', 'ળ': 'l',
};

// High-frequency Gujarati & Garba lyric lexicon
const GUJARATI_LYRIC_LEXICON: Record<string, string> = {
  'પ્રેમ': 'prem', 'તમે': 'tame', 'હું': 'hoon', 'અમે': 'ame',
  'તારો': 'taaro', 'તારી': 'taari', 'મારો': 'maaro', 'મારી': 'maari',
  'ગરબા': 'garba', 'રાસ': 'raas', 'રમવા': 'ramva', 'તાલી': 'taali',
  'દિલ': 'dil', 'મન': 'man', 'વાત': 'vaat', 'સાથે': 'saathe',
  'કેમ': 'kem', 'ક્યાં': 'kyaan', 'ક્યારે': 'kyaare',
  'આવો': 'aavo', 'જાઓ': 'jaao', 'વ્હાલા': 'vhaala', 'વ્હાલી': 'vhaali',
  'સખી': 'sakhi', 'રાધા': 'radha', 'કાન': 'kaan', 'કાનુડો': 'kaanudo',
  'ગોપી': 'gopi', 'મોરલી': 'morli', 'છોકરી': 'chhokri', 'છોકરો': 'chhokro',
};

export function hasGujaratiScript(text: string): boolean {
  return /[\u0A80-\u0AFF]/.test(text);
}

/**
 * Transliterates a single Gujarati word to Roman Gujarati.
 */
export function transliterateGujaratiWord(word: string): string {
  if (!word) return '';

  const clean = word.replace(/[^\u0A80-\u0AFF]/g, '');
  if (GUJARATI_LYRIC_LEXICON[clean]) {
    return GUJARATI_LYRIC_LEXICON[clean];
  }

  let result = '';
  const len = word.length;

  for (let i = 0; i < len; i++) {
    const ch = word[i];
    const next = i + 1 < len ? word[i + 1] : '';

    // Anusvara (ં)
    if (ch === 'ં') {
      result += 'n';
      continue;
    }

    // Visarga (ઃ)
    if (ch === 'ઃ') {
      result += 'h';
      continue;
    }

    // Virama (્)
    if (ch === '\u0ACD') {
      continue;
    }

    // Independent Vowel
    if (VOWELS_INDEPENDENT[ch]) {
      result += VOWELS_INDEPENDENT[ch];
      continue;
    }

    // Dependent Vowel Matra
    if (VOWELS_MATRA[ch]) {
      result += VOWELS_MATRA[ch];
      continue;
    }

    // Consonant
    if (CONSONANTS[ch]) {
      result += CONSONANTS[ch];

      const isNextMatra = VOWELS_MATRA[next] !== undefined;
      const isNextVirama = next === '\u0ACD';

      if (!isNextMatra && !isNextVirama) {
        // Schwa deletion at end of word
        const isLastOfWord = i === len - 1 || (!CONSONANTS[next] && !VOWELS_INDEPENDENT[next] && !next);

        if (!isLastOfWord) {
          result += 'a';
        }
      }
      continue;
    }

    result += ch;
  }

  return result
    .replace(/ee$/g, 'i')
    .replace(/oo$/g, 'u');
}

/**
 * Transliterates a Gujarati lyric line or string.
 */
export function transliterateGujaratiToRoman(text: string, options: IndicTransliterateOptions = {}): string {
  if (!text) return '';
  if (!hasGujaratiScript(text)) return text;

  const parts = text.match(/([\u0A80-\u0AFF]+|[^\u0A80-\u0AFF]+)/gu) || [text];

  let out = parts
    .map((part) => (hasGujaratiScript(part) ? transliterateGujaratiWord(part) : part))
    .join('');

  if (options.capitalizeFirst !== false && out.length > 0) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }

  return out;
}

/**
 * Converts all Gujarati lines and word tokens in an OpenLyricsDocument to Roman Gujarati.
 */
export function convertDocumentToRomanGujarati<T extends { lines: Array<any>; metadata?: any }>(doc: T): T {
  if (!doc || !doc.lines) return doc;

  const convertedLines = doc.lines.map((line) => {
    const lineHasGujarati = hasGujaratiScript(line.text);
    const romanText = lineHasGujarati ? transliterateGujaratiToRoman(line.text) : line.text;

    const convertedTokens = line.tokens?.map((token: any) => {
      if (hasGujaratiScript(token.text)) {
        return {
          ...token,
          text: transliterateGujaratiWord(token.text),
        };
      }
      return token;
    });

    return {
      ...line,
      text: romanText,
      tokens: convertedTokens,
      translations: lineHasGujarati
        ? {
            ...(line.translations || {}),
            gu: line.text,
          }
        : line.translations,
    };
  });

  return {
    ...doc,
    metadata: {
      ...(doc.metadata || {}),
      language: doc.metadata?.language === 'gu' ? 'gu-Latn' : doc.metadata?.language,
    },
    lines: convertedLines,
  };
}
