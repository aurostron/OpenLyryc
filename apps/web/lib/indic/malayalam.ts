/**
 * OpenLyryc Malayalam Transliteration Engine (Malayalam to Roman Malayalam)
 *
 * Tailored for Malayalam cinema, Mollywood soundtracks, and independent artists
 * (Sushin Shyam, Hesham Abdul Wahab, Rex Vijayan, Jakes Bejoy, Job Kurian).
 *
 * Attribution:
 * - Sanscript.js & Malayalam Open Source Tools (MIT License)
 * - Aksharamukha & Indic NLP Library (MIT License)
 *
 * Key features:
 * - Chillu consonants support (ൺ, ൻ, ർ, ൽ, ൾ, ൿ).
 * - Special retroflex letter ഴ (zh) and alveolar റ (r).
 * - Chandrakkala (്) virama & samvruthokaram handling.
 * - Anusvara (ം) m-nasalization.
 * - High-frequency Mollywood lyric lexicon.
 * - Non-destructive: preserves original script in line.translations.ml.
 */

import { IndicTransliterateOptions } from './types';

// Independent Vowels
const VOWELS_INDEPENDENT: Record<string, string> = {
  'അ': 'a',
  'ആ': 'aa',
  'ഇ': 'i',
  'ഈ': 'ee',
  'ഉ': 'u',
  'ഊ': 'oo',
  'ഋ': 'ru',
  'എ': 'e',
  'ഏ': 'e',
  'ഐ': 'ai',
  'ഒ': 'o',
  'ഓ': 'o',
  'ഔ': 'au',
};

// Dependent Vowel Matras
const VOWELS_MATRA: Record<string, string> = {
  'ാ': 'aa',
  'ി': 'i',
  'ീ': 'ee',
  'ു': 'u',
  'ൂ': 'oo',
  'ൃ': 'ru',
  'െ': 'e',
  'േ': 'e',
  'ൈ': 'ai',
  'ൊ': 'o',
  'ോ': 'o',
  'ൌ': 'au',
  'ൗ': 'au',
};

// Consonants
const CONSONANTS: Record<string, string> = {
  'ക': 'k', 'ഖ': 'kh', 'ഗ': 'g', 'ഘ': 'gh', 'ങ': 'ng',
  'ച': 'ch', 'ഛ': 'chh', 'ജ': 'j', 'ഝ': 'jh', 'ഞ': 'ny',
  'ട': 't', 'ഠ': 'th', 'ഡ': 'd', 'ഢ': 'dh', 'ണ': 'n',
  'ത': 'th', 'ഥ': 'th', 'ദ': 'dh', 'ധ': 'dh', 'ന': 'n',
  'പ': 'p', 'ഫ': 'f', 'ബ': 'b', 'ഭ': 'bh', 'മ': 'm',
  'യ': 'y', 'ര': 'r', 'ല': 'l', 'വ': 'v', 'ശ': 'sh',
  'ഷ': 'sh', 'സ': 's', 'ഹ': 'h', 'ള': 'l', 'ഴ': 'zh',
  'റ': 'r',
};

// Chillu Consonants (Pre-composed vowel-less letters)
const CHILLU_LETTERS: Record<string, string> = {
  'ൺ': 'n',
  'ൻ': 'n',
  'ർ': 'r',
  'ൽ': 'l',
  'ൾ': 'l',
  'ൿ': 'k',
};

// High-frequency Mollywood lyric lexicon
const MALAYALAM_LYRIC_LEXICON: Record<string, string> = {
  'സ്നേഹം': 'sneham', 'സ്നേഹമേ': 'snehame', 'പ്രണയം': 'pranayam',
  'നീ': 'nee', 'ഞാൻ': 'njaan', 'നാം': 'naam', 'നീയും': 'neeyum', 'ഞാനും': 'njaanum',
  'നിന്റെ': 'ninte', 'എന്റെ': 'ente', 'നിന്നെ': 'ninne', 'എന്നെ': 'enne',
  'മനം': 'manam', 'ഹൃദയം': 'hrudhayam', 'കണ്ണുകൾ': 'kannukal', 'കണ്ണിൽ': 'kannil',
  'ജീവൻ': 'jeevan', 'ഉയിർ': 'uyir', 'ഉയിരേ': 'uyire',
  'പാട്ട്': 'paattu', 'ഗാനം': 'gaanam', 'രാവ്': 'raavu', 'രാവിൽ': 'raavil',
  'കാറ്റ്': 'kaattu', 'മഴ': 'mazha', 'മഴയിൽ': 'mazhayil',
  'വിട': 'vida', 'ഓർമ്മ': 'ormma', 'ഓർമ്മകൾ': 'ormmakal',
  'എവിടെ': 'evide', 'എങ്ങനെ': 'engane', 'എന്തിന്': 'enthinu',
};

export function hasMalayalamScript(text: string): boolean {
  return /[\u0D00-\u0D7F]/.test(text);
}

/**
 * Transliterates a single Malayalam word to Roman Malayalam.
 */
export function transliterateMalayalamWord(word: string): string {
  if (!word) return '';

  const clean = word.replace(/[^\u0D00-\u0D7F]/g, '');
  if (MALAYALAM_LYRIC_LEXICON[clean]) {
    return MALAYALAM_LYRIC_LEXICON[clean];
  }

  let result = '';
  const len = word.length;

  for (let i = 0; i < len; i++) {
    const ch = word[i];
    const next = i + 1 < len ? word[i + 1] : '';

    // Chillu letters
    if (CHILLU_LETTERS[ch]) {
      result += CHILLU_LETTERS[ch];
      continue;
    }

    // Anusvara (ം)
    if (ch === 'ം') {
      result += 'm';
      continue;
    }

    // Visarga (ഃ)
    if (ch === 'ഃ') {
      result += 'h';
      continue;
    }

    // Chandrakkala (്)
    if (ch === '\u0D4D') {
      // In word-final position, often acts as samvruthokaram 'u' in lyrics
      if (i === len - 1) {
        result += 'u';
      }
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
      const isNextChandrakkala = next === '\u0D4D';

      if (!isNextMatra && !isNextChandrakkala) {
        result += 'a';
      }
      continue;
    }

    result += ch;
  }

  return result;
}

/**
 * Transliterates a Malayalam lyric line or string.
 */
export function transliterateMalayalamToRoman(text: string, options: IndicTransliterateOptions = {}): string {
  if (!text) return '';
  if (!hasMalayalamScript(text)) return text;

  const parts = text.match(/([\u0D00-\u0D7F]+|[^\u0D00-\u0D7F]+)/gu) || [text];

  let out = parts
    .map((part) => (hasMalayalamScript(part) ? transliterateMalayalamWord(part) : part))
    .join('');

  if (options.capitalizeFirst !== false && out.length > 0) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }

  return out;
}

/**
 * Converts all Malayalam lines and word tokens in an OpenLyricsDocument to Roman Malayalam.
 */
export function convertDocumentToRomanMalayalam<T extends { lines: Array<any>; metadata?: any }>(doc: T): T {
  if (!doc || !doc.lines) return doc;

  const convertedLines = doc.lines.map((line) => {
    const lineHasMalayalam = hasMalayalamScript(line.text);
    const romanText = lineHasMalayalam ? transliterateMalayalamToRoman(line.text) : line.text;

    const convertedTokens = line.tokens?.map((token: any) => {
      if (hasMalayalamScript(token.text)) {
        return {
          ...token,
          text: transliterateMalayalamWord(token.text),
        };
      }
      return token;
    });

    return {
      ...line,
      text: romanText,
      tokens: convertedTokens,
      translations: lineHasMalayalam
        ? {
            ...(line.translations || {}),
            ml: line.text,
          }
        : line.translations,
    };
  });

  return {
    ...doc,
    metadata: {
      ...(doc.metadata || {}),
      language: doc.metadata?.language === 'ml' ? 'ml-Latn' : doc.metadata?.language,
    },
    lines: convertedLines,
  };
}
