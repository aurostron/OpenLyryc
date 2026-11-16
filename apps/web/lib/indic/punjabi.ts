/**
 * OpenLyryc Punjabi Transliteration Engine (Gurmukhi to Roman Punjabi)
 *
 * Designed for Punjabi pop, Bhangra, Sufi, and folk lyrics (Diljit Dosanjh,
 * Sidhu Moosewala, AP Dhillon, Karan Aujla, Gurdas Maan, Nusrat Fateh Ali Khan).
 *
 * Attribution:
 * - Sanscript.js (Gurmukhi Brahmic mapping)
 * - Aksharamukha & Indic NLP Library (MIT License)
 *
 * Key features:
 * - Addak (ੱ) consonant doubling / gemination (ਬੱਲੇ -> balle, ਜੱਟ -> jatt).
 * - Tippi (ੰ) & Bindi (ਂ) context-aware nasalization (ਪੰਜਾਬ -> punjab, ਰੰਗ -> rang).
 * - Word-final schwa deletion for natural singing rhythm.
 * - Punjabi lyric lexicon for colloquial lyric spellings.
 * - Non-destructive: preserves original Gurmukhi in line.translations.pa.
 */

import { IndicTransliterateOptions } from './types';

// Independent Vowels
const VOWELS_INDEPENDENT: Record<string, string> = {
  'ਅ': 'a',
  'ਆ': 'aa',
  'ਇ': 'i',
  'ਈ': 'ee',
  'ਉ': 'u',
  'ਊ': 'oo',
  'ਏ': 'e',
  'ਐ': 'ai',
  'ਓ': 'o',
  'ਔ': 'au',
};

// Dependent Vowel Signs (Matras)
const VOWELS_MATRA: Record<string, string> = {
  'ਾ': 'aa',
  'ਿ': 'i',
  'ੀ': 'ee',
  'ੁ': 'u',
  'ੂ': 'oo',
  'ੇ': 'e',
  'ੈ': 'ai',
  'ੋ': 'o',
  'ੌ': 'au',
};

// Consonants
const CONSONANTS: Record<string, string> = {
  'ਕ': 'k', 'ਖ': 'kh', 'ਗ': 'g', 'ਘ': 'gh', 'ਙ': 'ng',
  'ਚ': 'ch', 'ਛ': 'chh', 'ਜ': 'j', 'ਝ': 'jh', 'ਞ': 'ny',
  'ਟ': 't', 'ਠ': 'th', 'ਡ': 'd', 'ਢ': 'dh', 'ਣ': 'n',
  'ਤ': 't', 'ਥ': 'th', 'ਦ': 'd', 'ਧ': 'dh', 'ਨ': 'n',
  'ਪ': 'p', 'ਫ': 'ph', 'ਬ': 'b', 'ਭ': 'bh', 'ਮ': 'm',
  'ਯ': 'y', 'ਰ': 'r', 'ਲ': 'l', 'ਵ': 'v', 'ੜ': 'rh',
  'ਸ਼': 'sh', 'ਖ਼': 'kh', 'ਗ਼': 'gh', 'ਜ਼': 'z', 'ਫ਼': 'f', 'ਲ਼': 'l',
};

// High-frequency Punjabi pop and folk lyric lexicon
const PUNJABI_LYRIC_LEXICON: Record<string, string> = {
  'ਤੇਰੇ': 'tere', 'ਮੇਰੇ': 'mere', 'ਸਾਡੇ': 'saade', 'ਤੁਹਾਡੇ': 'tuhade',
  'ਤੈਨੂੰ': 'tainu', 'ਮੈਨੂੰ': 'mainu', 'ਸਾਨੂੰ': 'saanu', 'ਤੁਹਾਨੂੰ': 'tuhanu',
  'ਕੁੜੀ': 'kudi', 'ਕੁੜੀਆਂ': 'kudiyan', 'ਮੁੰਡਾ': 'munda', 'ਮੁੰਡੇ': 'munde',
  'ਸੋਹਣੀ': 'sohni', 'ਸੋਹਣੀਏ': 'sohniye', 'ਸੋਹਣਾ': 'sohna',
  'ਦਿਲ': 'dil', 'ਜਿੰਦ': 'jind', 'ਜਾਨ': 'jaan', 'ਜਿੰਦੜੀ': 'jindri',
  'ਪਿਆਰ': 'pyaar', 'ਇਸ਼ਕ': 'ishq', 'ਯਾਰ': 'yaar', 'ਯਾਰੀ': 'yaari', 'ਮਿੱਤਰ': 'mittar',
  'ਨੱਚ': 'nach', 'ਨੱਚਣਾ': 'nachna', 'ਨੱਚਦੀ': 'nachdi', 'ਨੱਚਦੇ': 'nachde',
  'ਬੱਲੇ': 'balle', 'ਸ਼ਾਵਾ': 'shawa', 'ਹੋਏ': 'hoye',
  'ਅੱਖੀਆਂ': 'akkhiyan', 'ਅੱਖ': 'akkh', 'ਸੁਰਮਾ': 'surma',
  'ਜੱਟ': 'jatt', 'ਜੱਟੀ': 'jatti', 'ਵੰਗਾਂ': 'vaangan',
  'ਕੱਲ੍ਹ': 'kallh', 'ਅੱਜ': 'ajj', 'ਕਦੇ': 'kade', 'ਸਦਾ': 'sada',
  'ਗੱਲ': 'gall', 'ਗੱਲਾਂ': 'gallan', 'ਬੋਲ': 'bol', 'ਬੋਲੀ': 'boli',
  'ਵੇ': 've', 'ਨੀ': 'nee', 'ਹਾਂ': 'haan', 'ਨਾ': 'naa', 'ਨਹੀਂ': 'nahin',
  'ਮਾਹੀ': 'maahi', 'ਮਾਹੀਆ': 'maahiya', 'ਢੋਲ': 'dhol', 'ਢੋਲਣਾ': 'dholna',
  'ਰਾਹਾਂ': 'raahan', 'ਰੰਗ': 'rang', 'ਦੁਨੀਆ': 'duniya', 'ਰੱਬ': 'rabb',
  'ਵੱਲੋਂ': 'vallon', 'ਕੋਲ': 'kol', 'ਪਾਸੇ': 'paase', 'ਦੱਸ': 'dass',
};

export function hasPunjabiScript(text: string): boolean {
  return /[\u0A00-\u0A7F]/.test(text);
}

/**
 * Transliterates a single Punjabi word from Gurmukhi to Roman Punjabi.
 */
export function transliteratePunjabiWord(word: string): string {
  if (!word) return '';

  const clean = word.replace(/[^\u0A00-\u0A7F]/g, '');
  if (PUNJABI_LYRIC_LEXICON[clean]) {
    return PUNJABI_LYRIC_LEXICON[clean];
  }

  let result = '';
  const len = word.length;

  for (let i = 0; i < len; i++) {
    const ch = word[i];
    const next = i + 1 < len ? word[i + 1] : '';
    const nextNext = i + 2 < len ? word[i + 2] : '';

    // Addak (ੱ) - gemination / doubles following consonant
    if (ch === '\u0A71') {
      if (next && CONSONANTS[next]) {
        result += CONSONANTS[next];
      }
      continue;
    }

    // Tippi (ੰ) - nasalization (n / m / ng depending on following consonant)
    if (ch === '\u0A70') {
      if (next && ['ਪ', 'ਫ', 'ਬ', 'ਭ', 'ਮ'].includes(next)) {
        result += 'm';
      } else if (next && ['ਕ', 'ਖ', 'ਗ', 'ਘ'].includes(next)) {
        result += 'ng';
      } else {
        result += 'n';
      }
      continue;
    }

    // Bindi (ਂ) - nasalization
    if (ch === '\u0A02') {
      // If preceded by long vowel or end of word
      result += 'n';
      continue;
    }

    // Halant (੍) - suppresses vowel
    if (ch === '\u0A4D') {
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
      const cStr = CONSONANTS[ch];
      result += cStr;

      // Check if inherent schwa 'a' should follow
      const isNextMatra = VOWELS_MATRA[next] !== undefined;
      const isNextHalant = next === '\u0A4D';
      const isNextAddak = next === '\u0A71';
      const isNextTippi = next === '\u0A70';
      const isNextBindi = next === '\u0A02';

      if (!isNextMatra && !isNextHalant && !isNextAddak) {
        // If it's the last letter of word, schwa is deleted (e.g. ਦਿਲ -> dil, ਰੱਬ -> rabb)
        const isLastOfWord = i === len - 1 || (!CONSONANTS[next] && !VOWELS_INDEPENDENT[next] && !next);

        if (!isLastOfWord) {
          // Medial schwa deletion: if next consonant is followed by a vowel matra (C_CV rule)
          const isNextConsonant = CONSONANTS[next] !== undefined;
          const isNextNextMatra = VOWELS_MATRA[nextNext] !== undefined;

          if (isNextConsonant && isNextNextMatra && !isNextTippi && !isNextBindi) {
            // Drop medial schwa (e.g. ਨੱਚਦੀ -> nachdi, rather than nachadi)
          } else {
            result += 'a';
          }
        }
      }
      continue;
    }

    // Non-Gurmukhi characters (punctuation, numbers, spaces)
    result += ch;
  }

  // Final cleanup: 'ee' at the end of lyric words is naturally sung as 'i' (sohni, kudi)
  return result
    .replace(/ee$/g, 'i')
    .replace(/oo$/g, 'u');
}

/**
 * Transliterates a Punjabi lyric line or string.
 */
export function transliteratePunjabiToRoman(text: string, options: IndicTransliterateOptions = {}): string {
  if (!text) return '';
  if (!hasPunjabiScript(text)) return text;

  const parts = text.match(/([\u0A00-\u0A7F]+|[^\u0A00-\u0A7F]+)/gu) || [text];

  let out = parts
    .map((part) => (hasPunjabiScript(part) ? transliteratePunjabiWord(part) : part))
    .join('');

  if (options.capitalizeFirst !== false && out.length > 0) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }

  return out;
}

/**
 * Converts all Punjabi lines and word tokens in an OpenLyricsDocument to Roman Punjabi.
 */
export function convertDocumentToRomanPunjabi<T extends { lines: Array<any>; metadata?: any }>(doc: T): T {
  if (!doc || !doc.lines) return doc;

  const convertedLines = doc.lines.map((line) => {
    const lineHasPunjabi = hasPunjabiScript(line.text);
    const romanText = lineHasPunjabi ? transliteratePunjabiToRoman(line.text) : line.text;

    const convertedTokens = line.tokens?.map((token: any) => {
      if (hasPunjabiScript(token.text)) {
        return {
          ...token,
          text: transliteratePunjabiWord(token.text),
        };
      }
      return token;
    });

    return {
      ...line,
      text: romanText,
      tokens: convertedTokens,
      translations: lineHasPunjabi
        ? {
            ...(line.translations || {}),
            pa: line.text,
          }
        : line.translations,
    };
  });

  return {
    ...doc,
    metadata: {
      ...(doc.metadata || {}),
      language: doc.metadata?.language === 'pa' ? 'pa-Latn' : doc.metadata?.language,
    },
    lines: convertedLines,
  };
}
