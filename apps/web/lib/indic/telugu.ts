/**
 * OpenLyryc Telugu Transliteration Engine (Telugu to Roman Telugu)
 *
 * Tailored for Telugu cinema, Tollywood soundtracks, and independent music
 * (M.M. Keeravani, Devi Sri Prasad, S. Thaman, Sid Sriram, Anurag Kulkarni).
 *
 * Attribution:
 * - Sanscript.js & Telugu Open Source Tools (MIT License)
 * - Aksharamukha & Indic NLP Library (MIT License)
 *
 * Key features:
 * - Full vocalic syllable preservation (Telugu is vocalic, "Italian of the East").
 * - Anusvara (ం) context nasalization (m before labials/end, n otherwise).
 * - Tollywood lyric lexicon.
 * - Non-destructive: preserves original script in line.translations.te.
 */

import { IndicTransliterateOptions } from './types';

// Independent Vowels
const VOWELS_INDEPENDENT: Record<string, string> = {
  'అ': 'a',
  'ఆ': 'aa',
  'ఇ': 'i',
  'ఈ': 'ee',
  'ఉ': 'u',
  'ఊ': 'oo',
  'ఋ': 'ru',
  'ౠ': 'roo',
  'ఎ': 'e',
  'ఏ': 'e',
  'ఐ': 'ai',
  'ఒ': 'o',
  'ఓ': 'o',
  'ఔ': 'au',
};

// Dependent Vowel Matras
const VOWELS_MATRA: Record<string, string> = {
  'ా': 'aa',
  'ి': 'i',
  'ీ': 'ee',
  'ు': 'u',
  'ూ': 'oo',
  'ృ': 'ru',
  'ౄ': 'roo',
  'ె': 'e',
  'ే': 'e',
  'ై': 'ai',
  'ొ': 'o',
  'ో': 'o',
  'ౌ': 'au',
};

// Consonants
const CONSONANTS: Record<string, string> = {
  'క': 'k', 'ఖ': 'kh', 'గ': 'g', 'ఘ': 'gh', 'ఙ': 'ng',
  'చ': 'ch', 'ఛ': 'chh', 'జ': 'j', 'ఝ': 'jh', 'ఞ': 'ny',
  'ట': 't', 'ఠ': 'th', 'డ': 'd', 'ఢ': 'dh', 'ణ': 'n',
  'త': 't', 'థ': 'th', 'ద': 'd', 'ధ': 'dh', 'న': 'n',
  'ప': 'p', 'ఫ': 'ph', 'బ': 'b', 'భ': 'bh', 'మ': 'm',
  'య': 'y', 'ర': 'r', 'ల': 'l', 'వ': 'v', 'శ': 'sh',
  'ష': 'sh', 'స': 's', 'హ': 'h', 'ళ': 'l',
};

// High-frequency Tollywood lyric lexicon
const TELUGU_LYRIC_LEXICON: Record<string, string> = {
  'ప్రేమ': 'prema', 'ప్రేమించే': 'preminche', 'ప్రియతమా': 'priyathama',
  'నువ్వు': 'nuvvu', 'నేను': 'nenu', 'మనం': 'manam', 'మనము': 'manamu',
  'నువ్వే': 'nuvve', 'నేనే': 'nene', 'నిన్ను': 'ninnu', 'నన్ను': 'nannu',
  'నీతో': 'neetho', 'నాతో': 'naatho', 'నీకోసం': 'neekosam', 'నాకోసం': 'naakosam',
  'గుండె': 'gunde', 'గుండెల్లో': 'gundello', 'హృదయం': 'hrudayam',
  'కళ్ళు': 'kallu', 'కన్నులు': 'kannulu', 'చూపు': 'choopu', 'చూసి': 'choosi',
  'చెలియా': 'cheliya', 'ప్రాణం': 'praanam', 'జీవితం': 'jeevitham',
  'పాట': 'paata', 'మాట': 'maata', 'మాటలు': 'maatalu',
  'అందం': 'andam', 'అందమైన': 'andamaina', 'కల': 'kala', 'కలలో': 'kalalo',
  'ఎక్కడ': 'ekkada', 'ఎందుకు': 'enduku', 'ఎలా': 'elaa', 'ఎవరు': 'evaru',
  'రావా': 'raava', 'పోవా': 'pova', 'ఉంది': 'undi', 'ఉన్నా': 'unna',
};

export function hasTeluguScript(text: string): boolean {
  return /[\u0C00-\u0C7F]/.test(text);
}

/**
 * Transliterates a single Telugu word to Roman Telugu.
 */
export function transliterateTeluguWord(word: string): string {
  if (!word) return '';

  const clean = word.replace(/[^\u0C00-\u0C7F]/g, '');
  if (TELUGU_LYRIC_LEXICON[clean]) {
    return TELUGU_LYRIC_LEXICON[clean];
  }

  let result = '';
  const len = word.length;

  for (let i = 0; i < len; i++) {
    const ch = word[i];
    const next = i + 1 < len ? word[i + 1] : '';

    // Anusvara (ం)
    if (ch === 'ం') {
      if (next && ['ప', 'ఫ', 'బ', 'భ', 'మ'].includes(next)) {
        result += 'm';
      } else if (i === len - 1) {
        result += 'm';
      } else {
        result += 'n';
      }
      continue;
    }

    // Visarga (ః)
    if (ch === 'ః') {
      result += 'h';
      continue;
    }

    // Virama / Pollu (్)
    if (ch === '\u0C4D') {
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
      const isNextVirama = next === '\u0C4D';

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
 * Transliterates a Telugu lyric line or string.
 */
export function transliterateTeluguToRoman(text: string, options: IndicTransliterateOptions = {}): string {
  if (!text) return '';
  if (!hasTeluguScript(text)) return text;

  const parts = text.match(/([\u0C00-\u0C7F]+|[^\u0C00-\u0C7F]+)/gu) || [text];

  let out = parts
    .map((part) => (hasTeluguScript(part) ? transliterateTeluguWord(part) : part))
    .join('');

  if (options.capitalizeFirst !== false && out.length > 0) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }

  return out;
}

/**
 * Converts all Telugu lines and word tokens in an OpenLyricsDocument to Roman Telugu.
 */
export function convertDocumentToRomanTelugu<T extends { lines: Array<any>; metadata?: any }>(doc: T): T {
  if (!doc || !doc.lines) return doc;

  const convertedLines = doc.lines.map((line) => {
    const lineHasTelugu = hasTeluguScript(line.text);
    const romanText = lineHasTelugu ? transliterateTeluguToRoman(line.text) : line.text;

    const convertedTokens = line.tokens?.map((token: any) => {
      if (hasTeluguScript(token.text)) {
        return {
          ...token,
          text: transliterateTeluguWord(token.text),
        };
      }
      return token;
    });

    return {
      ...line,
      text: romanText,
      tokens: convertedTokens,
      translations: lineHasTelugu
        ? {
            ...(line.translations || {}),
            te: line.text,
          }
        : line.translations,
    };
  });

  return {
    ...doc,
    metadata: {
      ...(doc.metadata || {}),
      language: doc.metadata?.language === 'te' ? 'te-Latn' : doc.metadata?.language,
    },
    lines: convertedLines,
  };
}
