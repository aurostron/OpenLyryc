/**
 * OpenLyryc Odia Transliteration Engine (Odia to Roman Odia)
 *
 * Tailored for Odia music, Sambalpuri folk, Odissi classical, and modern pop
 * (Akshaya Mohanty, Humane Sagar, Asim Cook, Kuldeep Pattanaik).
 *
 * Attribution:
 * - Sanscript.js & Odia Open Source Tools (MIT License)
 * - Aksharamukha & Indic NLP Library (MIT License)
 *
 * Key features:
 * - Odia rounded inherent vowel phonetics.
 * - Non-destructive: preserves original script in line.translations.or.
 */

import { IndicTransliterateOptions } from './types';

// Independent Vowels
const VOWELS_INDEPENDENT: Record<string, string> = {
  'ଅ': 'o',
  'ଆ': 'aa',
  'ଇ': 'i',
  'ଈ': 'ee',
  'ଉ': 'u',
  'ଊ': 'oo',
  'ଋ': 'ru',
  'ଏ': 'e',
  'ଐ': 'oi',
  'ଓ': 'o',
  'ଔ': 'ou',
};

// Dependent Vowel Matras
const VOWELS_MATRA: Record<string, string> = {
  'ା': 'aa',
  'ି': 'i',
  'ୀ': 'ee',
  'ୁ': 'u',
  'ୂ': 'oo',
  'ୃ': 'ru',
  'େ': 'e',
  'ୈ': 'oi',
  'ୋ': 'o',
  'ୌ': 'ou',
};

// Consonants
const CONSONANTS: Record<string, string> = {
  'କ': 'k', 'ଖ': 'kh', 'ଗ': 'g', 'ଘ': 'gh', 'ଙ': 'ng',
  'ଚ': 'ch', 'ଛ': 'chh', 'ଜ': 'j', 'ଝ': 'jh', 'ଞ': 'ny',
  'ଟ': 't', 'ଠ': 'th', 'ଡ': 'd', 'ଢ': 'dh', 'ଣ': 'n',
  'ତ': 't', 'ଥ': 'th', 'ଦ': 'd', 'ଧ': 'dh', 'ନ': 'n',
  'ପ': 'p', 'ଫ': 'f', 'ବ': 'b', 'ଭ': 'bh', 'ମ': 'm',
  'ଯ': 'j', 'ୟ': 'y', 'ର': 'r', 'ଲ': 'l', 'ଳ': 'l',
  'ଶ': 'sh', 'ଷ': 'sh', 'ସ': 's', 'ହ': 'h',
  'ଡ଼': 'r', 'ଢ଼': 'rh',
};

// High-frequency Odia lyric lexicon
const ODIA_LYRIC_LEXICON: Record<string, string> = {
  'ପ୍ରେମ': 'prema', 'ତୁମେ': 'tume', 'ମୁଁ': 'mun', 'ଆମେ': 'aame',
  'ମୋହର': 'mohar', 'ତୋହର': 'tohar', 'ମୋର': 'mora', 'ତୋର': 'tora',
  'ମନ': 'mana', 'ଗୀତ': 'geeta', 'ଆଖି': 'aakhi', 'ହୃଦୟ': 'hrudaya',
  'ଜୀବନ': 'jeebana', 'ଭଲପାଏ': 'bhalapaae', 'ବନ୍ଧୁ': 'bandhu',
  'ରାତି': 'raati', 'ଚାନ୍ଦ': 'chaanda', 'ନଦୀ': 'nadee',
};

export function hasOdiaScript(text: string): boolean {
  return /[\u0B00-\u0B7F]/.test(text);
}

/**
 * Transliterates a single Odia word to Roman Odia.
 */
export function transliterateOdiaWord(word: string): string {
  if (!word) return '';

  const clean = word.replace(/[^\u0B00-\u0B7F]/g, '');
  if (ODIA_LYRIC_LEXICON[clean]) {
    return ODIA_LYRIC_LEXICON[clean];
  }

  let result = '';
  const len = word.length;

  for (let i = 0; i < len; i++) {
    const ch = word[i];
    const next = i + 1 < len ? word[i + 1] : '';

    // Anusvara (ଂ)
    if (ch === 'ଂ') {
      result += 'ng';
      continue;
    }

    // Chandrabindu (ଁ)
    if (ch === 'ଁ') {
      result += 'n';
      continue;
    }

    // Visarga (ଃ)
    if (ch === 'ଃ') {
      result += 'h';
      continue;
    }

    // Virama (୍)
    if (ch === '\u0B4D') {
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
      const isNextVirama = next === '\u0B4D';

      if (!isNextMatra && !isNextVirama) {
        result += 'a';
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
 * Transliterates an Odia lyric line or string.
 */
export function transliterateOdiaToRoman(text: string, options: IndicTransliterateOptions = {}): string {
  if (!text) return '';
  if (!hasOdiaScript(text)) return text;

  const parts = text.match(/([\u0B00-\u0B7F]+|[^\u0B00-\u0B7F]+)/gu) || [text];

  let out = parts
    .map((part) => (hasOdiaScript(part) ? transliterateOdiaWord(part) : part))
    .join('');

  if (options.capitalizeFirst !== false && out.length > 0) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }

  return out;
}

/**
 * Converts all Odia lines and word tokens in an OpenLyricsDocument to Roman Odia.
 */
export function convertDocumentToRomanOdia<T extends { lines: Array<any>; metadata?: any }>(doc: T): T {
  if (!doc || !doc.lines) return doc;

  const convertedLines = doc.lines.map((line) => {
    const lineHasOdia = hasOdiaScript(line.text);
    const romanText = lineHasOdia ? transliterateOdiaToRoman(line.text) : line.text;

    const convertedTokens = line.tokens?.map((token: any) => {
      if (hasOdiaScript(token.text)) {
        return {
          ...token,
          text: transliterateOdiaWord(token.text),
        };
      }
      return token;
    });

    return {
      ...line,
      text: romanText,
      tokens: convertedTokens,
      translations: lineHasOdia
        ? {
            ...(line.translations || {}),
            or: line.text,
          }
        : line.translations,
    };
  });

  return {
    ...doc,
    metadata: {
      ...(doc.metadata || {}),
      language: doc.metadata?.language === 'or' ? 'or-Latn' : doc.metadata?.language,
    },
    lines: convertedLines,
  };
}
