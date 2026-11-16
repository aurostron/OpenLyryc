/**
 * OpenLyryc Kannada Transliteration Engine (Kannada to Roman Kannada)
 *
 * Tailored for Kannada cinema, Sandalwood soundtracks, and folk / contemporary
 * music (Charan Raj, Arjun Janya, Raghu Dixit, Sanjith Hegde, Vasuki Vaibhav).
 *
 * Attribution:
 * - Sanscript.js & Kannada Open Source Tools (MIT License)
 * - Aksharamukha & Indic NLP Library (MIT License)
 *
 * Key features:
 * - Syllable preservation and vocalic endings.
 * - Anusvara (ಂ) nasalization.
 * - High-frequency Sandalwood lyric lexicon.
 * - Non-destructive: preserves original script in line.translations.kn.
 */

import { IndicTransliterateOptions } from './types';

// Independent Vowels
const VOWELS_INDEPENDENT: Record<string, string> = {
  'ಅ': 'a',
  'ಆ': 'aa',
  'ಇ': 'i',
  'ಈ': 'ee',
  'ಉ': 'u',
  'ಊ': 'oo',
  'ಋ': 'ru',
  'ಎ': 'e',
  'ಏ': 'e',
  'ಐ': 'ai',
  'ಒ': 'o',
  'ಓ': 'o',
  'ಔ': 'au',
};

// Dependent Vowel Matras
const VOWELS_MATRA: Record<string, string> = {
  'ಾ': 'aa',
  'ಿ': 'i',
  'ೀ': 'ee',
  'ು': 'u',
  'ೂ': 'oo',
  'ೃ': 'ru',
  'ೆ': 'e',
  'ೇ': 'e',
  'ೈ': 'ai',
  'ೊ': 'o',
  'ೋ': 'o',
  'ೌ': 'au',
};

// Consonants
const CONSONANTS: Record<string, string> = {
  'ಕ': 'k', 'ಖ': 'kh', 'ಗ': 'g', 'ಘ': 'gh', 'ಙ': 'ng',
  'ಚ': 'ch', 'ಛ': 'chh', 'ಜ': 'j', 'ಝ': 'jh', 'ಞ': 'ny',
  'ಟ': 't', 'ಠ': 'th', 'ಡ': 'd', 'ಢ': 'dh', 'ಣ': 'n',
  'ತ': 't', 'ಥ': 'th', 'ದ': 'd', 'ಧ': 'dh', 'ನ': 'n',
  'ಪ': 'p', 'ಫ': 'ph', 'ಬ': 'b', 'ಭ': 'bh', 'ಮ': 'm',
  'ಯ': 'y', 'ರ': 'r', 'ಲ': 'l', 'ವ': 'v', 'ಶ': 'sh',
  'ಷ': 'sh', 'ಸ': 's', 'ಹ': 'h', 'ಳ': 'l',
};

// High-frequency Sandalwood lyric lexicon
const KANNADA_LYRIC_LEXICON: Record<string, string> = {
  'ಪ್ರೀತಿ': 'preeti', 'ಪ್ರೀತಿಯ': 'preetiya', 'ಪ್ರೀತಿಸು': 'preetisu',
  'ಒಲವು': 'olavu', 'ಒಲವೇ': 'olave', 'ಚೆಲುವೆ': 'cheluve', 'ಚೆಲುವ': 'cheluva',
  'ನೀನು': 'neenu', 'ನಾನು': 'naanu', 'ನಾವು': 'naavu', 'ನೀನೆ': 'neene', 'ನಾನೆ': 'naane',
  'ನಿನ್ನ': 'ninna', 'ನನ್ನ': 'nanna', 'ನನಗೆ': 'nanage', 'ನಿನಗೆ': 'ninage',
  'ಹೃದಯ': 'hrudaya', 'ಮನಸ್ಸು': 'manassu', 'ಮನಸೇ': 'manase',
  'ಕಣ್ಣು': 'kannu', 'ಕಣ್ಣುಗಳು': 'kannugalu', 'ಕಣ್ಣಲ್ಲಿ': 'kannalli',
  'ಹಾಡು': 'haadu', 'ಮಾತು': 'maatu', 'ಮಾತನಾಡು': 'maatanaadu',
  'ಜೀವ': 'jeeva', 'ಜೀವನ': 'jeevana', 'ಬದುಕು': 'baduku',
  'ಕನ್ನಡ': 'kannada', 'ನಾಡು': 'naadu', 'ಬೆಳಕು': 'belaku',
  'ಎಲ್ಲಿ': 'elli', 'ಯಾಕೆ': 'yaake', 'ಹೇಗೆ': 'heege', 'ಯಾರು': 'yaaru',
  'ಬಾರೋ': 'baaro', 'ಬಾರೆ': 'baare', 'ಹೋಗು': 'hogu',
};

export function hasKannadaScript(text: string): boolean {
  return /[\u0C80-\u0CFF]/.test(text);
}

/**
 * Transliterates a single Kannada word to Roman Kannada.
 */
export function transliterateKannadaWord(word: string): string {
  if (!word) return '';

  const clean = word.replace(/[^\u0C80-\u0CFF]/g, '');
  if (KANNADA_LYRIC_LEXICON[clean]) {
    return KANNADA_LYRIC_LEXICON[clean];
  }

  let result = '';
  const len = word.length;

  for (let i = 0; i < len; i++) {
    const ch = word[i];
    const next = i + 1 < len ? word[i + 1] : '';

    // Anusvara (ಂ)
    if (ch === 'ಂ') {
      if (next && ['ಪ', 'ಫ', 'ಬ', 'ಭ', 'ಮ'].includes(next)) {
        result += 'm';
      } else if (i === len - 1) {
        result += 'm';
      } else {
        result += 'n';
      }
      continue;
    }

    // Visarga (ಃ)
    if (ch === 'ಃ') {
      result += 'h';
      continue;
    }

    // Virama (್)
    if (ch === '\u0CCD') {
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
      const isNextVirama = next === '\u0CCD';

      if (!isNextMatra && !isNextVirama) {
        result += 'a';
      }
      continue;
    }

    result += ch;
  }

  return result;
}

/**
 * Transliterates a Kannada lyric line or string.
 */
export function transliterateKannadaToRoman(text: string, options: IndicTransliterateOptions = {}): string {
  if (!text) return '';
  if (!hasKannadaScript(text)) return text;

  const parts = text.match(/([\u0C80-\u0CFF]+|[^\u0C80-\u0CFF]+)/gu) || [text];

  let out = parts
    .map((part) => (hasKannadaScript(part) ? transliterateKannadaWord(part) : part))
    .join('');

  if (options.capitalizeFirst !== false && out.length > 0) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }

  return out;
}

/**
 * Converts all Kannada lines and word tokens in an OpenLyricsDocument to Roman Kannada.
 */
export function convertDocumentToRomanKannada<T extends { lines: Array<any>; metadata?: any }>(doc: T): T {
  if (!doc || !doc.lines) return doc;

  const convertedLines = doc.lines.map((line) => {
    const lineHasKannada = hasKannadaScript(line.text);
    const romanText = lineHasKannada ? transliterateKannadaToRoman(line.text) : line.text;

    const convertedTokens = line.tokens?.map((token: any) => {
      if (hasKannadaScript(token.text)) {
        return {
          ...token,
          text: transliterateKannadaWord(token.text),
        };
      }
      return token;
    });

    return {
      ...line,
      text: romanText,
      tokens: convertedTokens,
      translations: lineHasKannada
        ? {
            ...(line.translations || {}),
            kn: line.text,
          }
        : line.translations,
    };
  });

  return {
    ...doc,
    metadata: {
      ...(doc.metadata || {}),
      language: doc.metadata?.language === 'kn' ? 'kn-Latn' : doc.metadata?.language,
    },
    lines: convertedLines,
  };
}
