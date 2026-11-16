/**
 * OpenLyryc Bengali Transliteration Engine (Bengali to Roman Bengali)
 *
 * Designed for Bengali music (Rabindra Sangeet, Nazrul Geeti, Modern Bengali
 * Pop, Anupam Roy, Arijit Singh Bengali originals, Coke Studio Bangla).
 *
 * Attribution:
 * - Sanscript.js (Bengali Brahmic mapping)
 * - Aksharamukha & Indic NLP Library (MIT License)
 *
 * Key features:
 * - Bengali inherent vowel harmony: default inherent vowel is 'o' (মন -> mon, জল -> jol).
 * - Sibilant normalization: শ, ষ, স phonetically map to 'sh' (সুন্দর -> shundor).
 * - Khanda-ta (ৎ) final-t stop (হঠাৎ -> hothat, উৎসব -> utshob).
 * - Anusvara (ং) ng-nasalization (রং -> rong) and Chandrabindu (ঁ) vowel nasalization.
 * - Comprehensive Bengali lyric lexicon.
 * - Non-destructive: preserves original script in line.translations.bn.
 */

import { IndicTransliterateOptions } from './types';

// Independent Vowels
const VOWELS_INDEPENDENT: Record<string, string> = {
  'অ': 'o',
  'আ': 'aa',
  'ই': 'i',
  'ঈ': 'ee',
  'উ': 'u',
  'ঊ': 'oo',
  'ঋ': 'ri',
  'এ': 'e',
  'ঐ': 'oi',
  'ও': 'o',
  'ঔ': 'ou',
};

// Dependent Vowel Matras
const VOWELS_MATRA: Record<string, string> = {
  'া': 'aa',
  'ি': 'i',
  'ী': 'ee',
  'ু': 'u',
  'ূ': 'oo',
  'ৃ': 'ri',
  'ে': 'e',
  'ৈ': 'oi',
  'ো': 'o',
  'ৌ': 'ou',
};

// Consonants
const CONSONANTS: Record<string, string> = {
  'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng',
  'চ': 'ch', 'ছ': 'chh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'ny',
  'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n',
  'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
  'প': 'p', 'ফ': 'f', 'ব': 'b', 'ভ': 'bh', 'ম': 'm',
  'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh',
  'স': 'sh', 'হ': 'h', 'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y',
  'ৎ': 't',
};

// High-frequency Bengali lyric lexicon
const BENGALI_LYRIC_LEXICON: Record<string, string> = {
  'আমি': 'aami', 'তুমি': 'tumi', 'সে': 'she', 'আমরা': 'aamra', 'তোমরা': 'tomra',
  'আমার': 'aamar', 'তোমার': 'tomar', 'আমাদের': 'aamader', 'তোমাদের': 'tomader',
  'আমাকে': 'aamake', 'তোমাকে': 'tomake', 'তাকে': 'taake',
  'ভালোবাসা': 'bhalobasha', 'ভালোবাসি': 'bhalobashi', 'প্রেম': 'prem',
  'মন': 'mon', 'প্রাণ': 'praan', 'হৃদয়': 'hridoy', 'বন্ধু': 'bondhu',
  'গান': 'gaan', 'সুর': 'shur', 'কথা': 'kotha', 'সোনার': 'shonar',
  'বাংলা': 'bangla', 'বৃষ্টি': 'brishti', 'মেঘ': 'megh', 'চোখ': 'chokh',
  'রাত': 'raat', 'চাঁদ': 'chaand', 'আলো': 'aalo', 'নদী': 'nodi',
  'জীবন': 'jibon', 'মরণ': 'moron', 'ভালো': 'bhalo', 'সুন্দর': 'shundor',
  'হঠাৎ': 'hothat', 'কখনো': 'kokhono', 'আজ': 'aaj', 'কাল': 'kaal',
  'আছে': 'aachhe', 'নেই': 'nei', 'হলো': 'holo', 'হবে': 'hobe',
  'যায়': 'jaay', 'আসে': 'aashe', 'বলে': 'bole', 'শুনে': 'shune',
  'দেখে': 'dekhe', 'জানি': 'jaani', 'বোঝো': 'bozho',
};

export function hasBengaliScript(text: string): boolean {
  return /[\u0980-\u09FF]/.test(text);
}

/**
 * Transliterates a single Bengali word to Roman.
 */
export function transliterateBengaliWord(word: string): string {
  if (!word) return '';

  const clean = word.replace(/[^\u0980-\u09FF]/g, '');
  if (BENGALI_LYRIC_LEXICON[clean]) {
    return BENGALI_LYRIC_LEXICON[clean];
  }

  let result = '';
  const len = word.length;

  for (let i = 0; i < len; i++) {
    const ch = word[i];
    const next = i + 1 < len ? word[i + 1] : '';

    // Khanda-ta (ৎ)
    if (ch === 'ৎ') {
      result += 't';
      continue;
    }

    // Anusvara (ং)
    if (ch === 'ং') {
      result += 'ng';
      continue;
    }

    // Chandrabindu (ঁ)
    if (ch === 'ঁ') {
      result += 'n';
      continue;
    }

    // Visarga (ঃ)
    if (ch === 'ঃ') {
      result += 'h';
      continue;
    }

    // Hasanta (্)
    if (ch === '\u09CD') {
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
      const isNextHasanta = next === '\u09CD';

      if (!isNextMatra && !isNextHasanta) {
        // Bengali inherent vowel rule: final consonant is often silent/halant in lyrics (e.g. গান -> gaan, মন -> mon)
        const isLastOfWord = i === len - 1 || (!CONSONANTS[next] && !VOWELS_INDEPENDENT[next] && !next);

        if (!isLastOfWord) {
          result += 'o';
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
 * Transliterates a Bengali lyric line or string.
 */
export function transliterateBengaliToRoman(text: string, options: IndicTransliterateOptions = {}): string {
  if (!text) return '';
  if (!hasBengaliScript(text)) return text;

  const parts = text.match(/([\u0980-\u09FF]+|[^\u0980-\u09FF]+)/gu) || [text];

  let out = parts
    .map((part) => (hasBengaliScript(part) ? transliterateBengaliWord(part) : part))
    .join('');

  if (options.capitalizeFirst !== false && out.length > 0) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }

  return out;
}

/**
 * Converts all Bengali lines and word tokens in an OpenLyricsDocument to Roman Bengali.
 */
export function convertDocumentToRomanBengali<T extends { lines: Array<any>; metadata?: any }>(doc: T): T {
  if (!doc || !doc.lines) return doc;

  const convertedLines = doc.lines.map((line) => {
    const lineHasBengali = hasBengaliScript(line.text);
    const romanText = lineHasBengali ? transliterateBengaliToRoman(line.text) : line.text;

    const convertedTokens = line.tokens?.map((token: any) => {
      if (hasBengaliScript(token.text)) {
        return {
          ...token,
          text: transliterateBengaliWord(token.text),
        };
      }
      return token;
    });

    return {
      ...line,
      text: romanText,
      tokens: convertedTokens,
      translations: lineHasBengali
        ? {
            ...(line.translations || {}),
            bn: line.text,
          }
        : line.translations,
    };
  });

  return {
    ...doc,
    metadata: {
      ...(doc.metadata || {}),
      language: doc.metadata?.language === 'bn' ? 'bn-Latn' : doc.metadata?.language,
    },
    lines: convertedLines,
  };
}
