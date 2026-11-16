/**
 * OpenLyryc Marathi Transliteration Engine (Marathi Devanagari to Roman Marathi)
 *
 * Tailored for Marathi music, Natya Sangeet, Bhavgeet, Lavani, and modern Marathi cinema
 * (Ajay-Atul, Swapnil Bandodkar, Avadhoot Gupte, Shreya Ghoshal Marathi tracks).
 *
 * Attribution:
 * - Sanscript.js & Marathi NLP (MIT License)
 * - Aksharamukha & Indic NLP Library (MIT License)
 *
 * Key features:
 * - Retroflex ळ (l) and Marathi consonant clusters.
 * - Contextual phonetic adaptations for Marathi lyric singing.
 * - Non-destructive: preserves original script in line.translations.mr.
 */

import { IndicTransliterateOptions } from './types';

// High-frequency Marathi lyric lexicon
const MARATHI_LYRIC_LEXICON: Record<string, string> = {
  'प्रेम': 'prem', 'माझे': 'maazhe', 'माझी': 'maazhi', 'माझा': 'maazha',
  'माझ्या': 'maazhya', 'तुझे': 'tuzhe', 'तुझी': 'tuzhi', 'तुझा': 'tuzha', 'तुझ्या': 'tuzhya',
  'आपले': 'aaple', 'आपली': 'aapli', 'आपला': 'aapla',
  'आठवण': 'aathvan', 'आठवणी': 'aathvani', 'डोळे': 'dole', 'डोळ्यात': 'dolyat',
  'मन': 'man', 'मनात': 'manaat', 'हृदय': 'hruday', 'गाणे': 'gaane', 'गीत': 'geet',
  'सुर': 'sur', 'जीव': 'jeev', 'जीवा': 'jeeva', 'सोबती': 'sobati',
  'कधी': 'kadhi', 'कसे': 'kase', 'कसा': 'kasa', 'कशी': 'kashi',
  'जेव्हा': 'jevha', 'तेव्हा': 'tevha', 'सांग': 'saang',
  'मराठी': 'marathi', 'देवा': 'deva', 'विठ्ठल': 'vitthal', 'माऊली': 'maauli',
  'आई': 'aai', 'बाबा': 'baba', 'चांदणे': 'chaandane', 'पाऊस': 'paaoos',
};

// Independent Vowels
const VOWELS_INDEPENDENT: Record<string, string> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
  'ऋ': 'ru', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
};

// Dependent Vowel Matras
const VOWELS_MATRA: Record<string, string> = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
  'ृ': 'ru', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
};

// Consonants with Marathi ळ
const CONSONANTS: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'ळ': 'l',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
};

export function hasMarathiScript(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

/**
 * Transliterates a single Marathi word to Roman Marathi.
 */
export function transliterateMarathiWord(word: string): string {
  if (!word) return '';

  const clean = word.replace(/[^\u0900-\u097F]/g, '');
  if (MARATHI_LYRIC_LEXICON[clean]) {
    return MARATHI_LYRIC_LEXICON[clean];
  }

  let result = '';
  const len = word.length;

  for (let i = 0; i < len; i++) {
    const ch = word[i];
    const next = i + 1 < len ? word[i + 1] : '';

    // Anusvara (ं)
    if (ch === 'ं') {
      result += 'n';
      continue;
    }

    // Visarga (ः)
    if (ch === 'ः') {
      result += 'h';
      continue;
    }

    // Virama / Halant (्)
    if (ch === '\u094D') {
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
      const isNextHalant = next === '\u094D';

      if (!isNextMatra && !isNextHalant) {
        // Word-final schwa deletion in song lyrics
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
 * Transliterates a Marathi lyric line or string.
 */
export function transliterateMarathiToRoman(text: string, options: IndicTransliterateOptions = {}): string {
  if (!text) return '';
  if (!hasMarathiScript(text)) return text;

  const parts = text.match(/([\u0900-\u097F]+|[^\u0900-\u097F]+)/gu) || [text];

  let out = parts
    .map((part) => (hasMarathiScript(part) ? transliterateMarathiWord(part) : part))
    .join('');

  if (options.capitalizeFirst !== false && out.length > 0) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }

  return out;
}

/**
 * Converts all Marathi lines and word tokens in an OpenLyricsDocument to Roman Marathi.
 */
export function convertDocumentToRomanMarathi<T extends { lines: Array<any>; metadata?: any }>(doc: T): T {
  if (!doc || !doc.lines) return doc;

  const convertedLines = doc.lines.map((line) => {
    const lineHasMarathi = hasMarathiScript(line.text);
    const romanText = lineHasMarathi ? transliterateMarathiToRoman(line.text) : line.text;

    const convertedTokens = line.tokens?.map((token: any) => {
      if (hasMarathiScript(token.text)) {
        return {
          ...token,
          text: transliterateMarathiWord(token.text),
        };
      }
      return token;
    });

    return {
      ...line,
      text: romanText,
      tokens: convertedTokens,
      translations: lineHasMarathi
        ? {
            ...(line.translations || {}),
            mr: line.text,
          }
        : line.translations,
    };
  });

  return {
    ...doc,
    metadata: {
      ...(doc.metadata || {}),
      language: doc.metadata?.language === 'mr' ? 'mr-Latn' : doc.metadata?.language,
    },
    lines: convertedLines,
  };
}
