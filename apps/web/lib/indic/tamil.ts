/**
 * OpenLyryc Tamil Transliteration Engine (Tamil to Roman Tamil)
 *
 * Tailored for Tamil cinema, Kollywood soundtracks, Carnatic music,
 * and independent Tamil artists (A.R. Rahman, Ilaiyaraaja, Anirudh Ravichander,
 * Harris Jayaraj, Sid Sriram, Yuvan Shankar Raja).
 *
 * Attribution:
 * - Sanscript.js & Open-Tamil (MIT License)
 * - Aksharamukha & Indic NLP Library (MIT License)
 *
 * Key features:
 * - Special Tamil consonants: ழ (zh retroflex approximant), ற (r/tr), ள (l).
 * - Intervocalic plosive voicing: க -> g, ப -> b, த -> dh, ட -> d between vowels or after nasals.
 * - Pulli (்) suppression and Grantha letters (ஜ, ஷ, ஸ, ஹ, ஸ்ரீ).
 * - High-frequency Kollywood lyric lexicon.
 * - Non-destructive: preserves original script in line.translations.ta.
 */

import { IndicTransliterateOptions } from './types';

// Independent Vowels
const VOWELS_INDEPENDENT: Record<string, string> = {
  'அ': 'a',
  'ஆ': 'aa',
  'இ': 'i',
  'ஈ': 'ee',
  'உ': 'u',
  'ஊ': 'oo',
  'எ': 'e',
  'ஏ': 'e',
  'ஐ': 'ai',
  'ஒ': 'o',
  'ஓ': 'o',
  'ஔ': 'au',
};

// Dependent Vowel Matras
const VOWELS_MATRA: Record<string, string> = {
  'ா': 'aa',
  'ி': 'i',
  'ீ': 'ee',
  'ு': 'u',
  'ூ': 'oo',
  'ெ': 'e',
  'ே': 'e',
  'ை': 'ai',
  'ொ': 'o',
  'ோ': 'o',
  'ௌ': 'au',
};

// Consonants Base
const CONSONANTS: Record<string, string> = {
  'க': 'k',
  'ங': 'ng',
  'ச': 's',
  'ஞ': 'ny',
  'ட': 't',
  'ண': 'n',
  'த': 'th',
  'ந': 'n',
  'ப': 'p',
  'ம': 'm',
  'ய': 'y',
  'ர': 'r',
  'ல': 'l',
  'வ': 'v',
  'ழ': 'zh',
  'ள': 'l',
  'ற': 'r',
  'ன': 'n',
  // Grantha
  'ஜ': 'j',
  'ஷ': 'sh',
  'ஸ': 's',
  'ஹ': 'h',
};

// High-frequency Kollywood lyric lexicon
const TAMIL_LYRIC_LEXICON: Record<string, string> = {
  'காதல்': 'kaadhal', 'காதலே': 'kaadhale', 'காதலன்': 'kaadhalan', 'காதலி': 'kaadhali',
  'அன்பே': 'anbe', 'அன்பு': 'anbu', 'உயிரே': 'uyire', 'உயிர்': 'uyir',
  'கண்ணே': 'kanne', 'கண்கள்': 'kangal', 'கண்': 'kan',
  'இதயம்': 'idhayam', 'மனம்': 'manam', 'மனசு': 'manasu',
  'நீ': 'nee', 'நான்': 'naan', 'நாம்': 'naam', 'நாங்கள்': 'naangal',
  'என்': 'en', 'உன்': 'un', 'என்னை': 'ennai', 'உன்னை': 'unnai',
  'என்னோடு': 'ennodu', 'உன்னோடு': 'unnodu', 'எங்கே': 'engae', 'எங்கு': 'engu',
  'அழகே': 'azhage', 'அழகு': 'azhagu', 'தமிழ்': 'thamizh',
  'பாடல்': 'paadal', 'பாட்டு': 'paattu', 'இசை': 'isai',
  'நிலா': 'nila', 'வானம்': 'vaanam', 'மழை': 'mazhai', 'காற்று': 'kaatru',
  'கனவு': 'kanavu', 'மலரே': 'malare', 'மலர்': 'malar',
  'வேண்டும்': 'vendum', 'வேண்டாம்': 'vendaam', 'போகாதே': 'pogaadhe',
  'வாழ்க்கை': 'vaazhkkai', 'நேசம்': 'nesam', 'பாசம்': 'paasam',
  'எப்படி': 'eppadi', 'இப்போது': 'ippodhu', 'எப்போதும்': 'eppodhum',
};

export function hasTamilScript(text: string): boolean {
  return /[\u0B80-\u0BFF]/.test(text);
}

/**
 * Transliterates a single Tamil word to Roman Tamil.
 */
export function transliterateTamilWord(word: string): string {
  if (!word) return '';

  const clean = word.replace(/[^\u0B80-\u0BFF]/g, '');
  if (TAMIL_LYRIC_LEXICON[clean]) {
    return TAMIL_LYRIC_LEXICON[clean];
  }

  let result = '';
  const len = word.length;

  for (let i = 0; i < len; i++) {
    const ch = word[i];
    const prev = i > 0 ? word[i - 1] : '';
    const next = i + 1 < len ? word[i + 1] : '';

    // Pulli (Virama ்)
    if (ch === '\u0BCD') {
      continue;
    }

    // Aytham (ஃ)
    if (ch === 'ஃ') {
      result += 'h';
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
      let c = CONSONANTS[ch];

      // Tamil Intervocalic / Post-Nasal Plosive Voicing Rules
      const isWordInitial = i === 0 || word[i - 1] === ' ';
      const isPostPulli = prev === '\u0BCD';

      if (!isWordInitial && !isPostPulli) {
        if (ch === 'க') c = 'g';
        else if (ch === 'ப') c = 'b';
        else if (ch === 'த') c = 'dh';
        else if (ch === 'ட') c = 'd';
      } else if (isPostPulli && i >= 2) {
        const prePulliChar = word[i - 2];
        // After nasal consonant (ங், ஞ், ண், ந், ம், ன்)
        if (['ங', 'ஞ', 'ண', 'ந', 'ம', 'ன'].includes(prePulliChar)) {
          if (ch === 'க') c = 'g';
          else if (ch === 'ப') c = 'b';
          else if (ch === 'த') c = 'dh';
          else if (ch === 'ட') c = 'd';
        }
      }

      result += c;

      // Check if inherent vowel 'a' applies
      const isNextMatra = VOWELS_MATRA[next] !== undefined;
      const isNextPulli = next === '\u0BCD';

      if (!isNextMatra && !isNextPulli) {
        result += 'a';
      }
      continue;
    }

    result += ch;
  }

  return result;
}

/**
 * Transliterates a Tamil lyric line or string.
 */
export function transliterateTamilToRoman(text: string, options: IndicTransliterateOptions = {}): string {
  if (!text) return '';
  if (!hasTamilScript(text)) return text;

  const parts = text.match(/([\u0B80-\u0BFF]+|[^\u0B80-\u0BFF]+)/gu) || [text];

  let out = parts
    .map((part) => (hasTamilScript(part) ? transliterateTamilWord(part) : part))
    .join('');

  if (options.capitalizeFirst !== false && out.length > 0) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }

  return out;
}

/**
 * Converts all Tamil lines and word tokens in an OpenLyricsDocument to Roman Tamil.
 */
export function convertDocumentToRomanTamil<T extends { lines: Array<any>; metadata?: any }>(doc: T): T {
  if (!doc || !doc.lines) return doc;

  const convertedLines = doc.lines.map((line) => {
    const lineHasTamil = hasTamilScript(line.text);
    const romanText = lineHasTamil ? transliterateTamilToRoman(line.text) : line.text;

    const convertedTokens = line.tokens?.map((token: any) => {
      if (hasTamilScript(token.text)) {
        return {
          ...token,
          text: transliterateTamilWord(token.text),
        };
      }
      return token;
    });

    return {
      ...line,
      text: romanText,
      tokens: convertedTokens,
      translations: lineHasTamil
        ? {
            ...(line.translations || {}),
            ta: line.text,
          }
        : line.translations,
    };
  });

  return {
    ...doc,
    metadata: {
      ...(doc.metadata || {}),
      language: doc.metadata?.language === 'ta' ? 'ta-Latn' : doc.metadata?.language,
    },
    lines: convertedLines,
  };
}
