/**
 * OpenLyryc Korean Transliteration Engine (Hangul to Revised Romanization / Romaja)
 *
 * High-accuracy, offline, zero-dependency Korean Romanization engine designed specifically
 * for song lyrics, K-pop tracks (BTS, BLACKPINK, NewJeans, IU, Stray Kids), ballads, and OSTs.
 *
 * Features:
 * - 100% Algorithmic Hangul decomposition (U+AC00 to U+D7A3: Choseong, Jungseong, Jongseong).
 * - South Korean Revised Romanization of Korean (국어의 로마자 표기법) standard.
 * - Comprehensive phonological assimilation rules:
 *   - Liaison (연음 법칙): Final consonants transfer smoothly to following vowel syllables (e.g. 음악 -> eumak, 꽃이 -> kkochi).
 *   - Palatalization (구개음화): ㄷ/ㅌ before 이 become j/ch (e.g. 같이 -> gachi).
 *   - Liquid Assimilation (유음화): ㄴ + ㄹ or ㄹ + ㄴ -> ll (e.g. 신라 -> silla, 연락 -> yeollak).
 *   - Nasal Assimilation (비음화): ㄱ/ㄷ/ㅂ before ㄴ/ㅁ become ng/n/m (e.g. 빗물 -> binmul, 십년 -> simnyeon).
 *   - Aspirated Mergers (거센소리화): Merges with ㅎ to produce k/t/p/ch (e.g. 축하 -> chuka, 입학 -> ipak, 어떻게 -> eotteoke).
 *   - Double Batchim resolution (ㄳ, ㄵ, ㄶ, ㄺ, ㄻ, ㄼ, ㄽ, ㄾ, ㄿ, ㅀ, ㅄ).
 * - High-frequency K-pop lyrics lexicon for standard lyric spellings.
 * - Word-token and millisecond-level timing synchronization preservation.
 * - Non-destructive: original Korean Hangul text preserved in line.translations.ko.
 */

// 19 Initial Consonants (Choseong 초성)
const CHOSEONG: string[] = [
  'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'
];

// 21 Medial Vowels (Jungseong 중성)
const JUNGSEONG: string[] = [
  'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'
];

// 28 Final Consonants (Jongseong 종성) standalone readings
const JONGSEONG_BASE: string[] = [
  '', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'
];

// Liaison transfer mapping when followed by a vowel syllable (ㅇ initial)
const LIAISON_MAP: Record<number, string> = {
  1: 'g', 2: 'kk', 3: 'ks', 4: 'n', 5: 'nj', 6: 'n', 7: 'd', 8: 'r',
  9: 'lg', 10: 'lm', 11: 'lb', 12: 'ls', 13: 'lt', 14: 'lp', 15: 'r',
  16: 'm', 17: 'b', 18: 'ps', 19: 's', 20: 'ss', 21: 'ng', 22: 'j',
  23: 'ch', 24: 'k', 25: 't', 26: 'p', 27: ''
};

// Curated high-frequency K-Pop and Korean song lyric lexicon
const KOREAN_LYRIC_LEXICON: Record<string, string> = {
  // Common Lyric Verbs & Expressions
  '사랑해': 'saranghae',
  '사랑': 'sarang',
  '사랑했던': 'saranghaetdeon',
  '사랑해요': 'saranghaeyo',
  '사랑을': 'sarangeul',
  '보고싶어': 'bogosipeo',
  '보고파': 'bogopa',
  '그리워': 'geuriwo',
  '안녕': 'annyeong',
  '미안해': 'mianhae',
  '고마워': 'gomawo',
  '괜찮아': 'gwaenchana',
  '어떻게': 'eotteoke',
  '그렇지만': 'geureochiman',
  '왜': 'wae',
  '정말': 'jeongmal',
  '진짜': 'jinjja',
  '너무': 'neomu',
  '함께': 'hamkke',
  '같이': 'gachi',
  '다시': 'dasi',
  '영원히': 'yeongwonhi',
  '마음': 'maeum',
  '맘': 'mam',
  '가슴': 'gaseum',
  '눈물': 'nunmul',
  '기억': 'gieok',
  '추억': 'chueok',
  '하늘': 'haneul',
  '바람': 'baram',
  '별': 'byeol',
  '달': 'dal',
  '노래': 'norae',
  '음악': 'eumak',
  '좋아': 'joa',
  '좋은': 'joeun',
  '싫어': 'sireo',
  '몰라': 'molla',
  '알아': 'ara',
  '있어': 'isseo',
  '없어': 'eopseo',
  '있잖아': 'itjana',
  '없잖아': 'eopjana',
  '행복해': 'haengbokhae',
  '빛나': 'binna',
  '반짝여': 'banjjagyeo',
  '예뻐': 'yeppeo',
  '아름다워': 'areumdawo',
  '오늘도': 'oneuldo',
  '내일도': 'naeildo',
  '하루': 'haru',
  '매일': 'maeil',
  '언제나': 'eonjena',
  '항상': 'hangsang',
  '나를': 'nareul',
  '너를': 'neoreul',
  '내가': 'naega',
  '네가': 'nega',
  '너의': 'neoui',
  '나의': 'naui',
  '우리': 'uri',
  '우린': 'urin',
  '그대': 'geudae',
  '널': 'neol',
  '날': 'nal',
  '넌': 'neon',
  '난': 'nan',
  '내': 'nae',
  '네': 'ne',
  '너': 'neo',
  '나': 'na'
};

interface HangulSyllable {
  cho: number;
  jung: number;
  jong: number;
  raw: string;
  isNonHangul?: boolean;
  choRomOverride?: string;
}

/**
 * Checks if a string contains any Korean Hangul syllables or jamo characters.
 */
export function hasKoreanScript(text: string): boolean {
  if (!text) return false;
  return /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text);
}

/**
 * Detects if a string is predominantly or contains Korean Hangul text.
 */
export function isKoreanText(text: string): boolean {
  if (!text) return false;
  return /[\uAC00-\uD7AF]/.test(text);
}

/**
 * Decomposes a single Korean Hangul syllable character into its Choseong, Jungseong, and Jongseong indices.
 */
function decomposeHangul(char: string): HangulSyllable | null {
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  const index = code - 0xac00;
  const cho = Math.floor(index / 588);
  const jung = Math.floor((index % 588) / 28);
  const jong = index % 28;
  return { cho, jung, jong, raw: char };
}

/**
 * Transliterates a single Korean word from Hangul to Revised Romanization.
 */
export function transliterateHangulWord(word: string): string {
  if (!word) return '';

  const clean = word.trim();
  if (KOREAN_LYRIC_LEXICON[clean]) {
    return KOREAN_LYRIC_LEXICON[clean];
  }

  // Handle hyphenated compound words
  if (clean.includes('-')) {
    return clean.split('-').map(transliterateHangulWord).join('-');
  }

  const chars = Array.from(clean);
  const syllables: HangulSyllable[] = [];

  for (const ch of chars) {
    const s = decomposeHangul(ch);
    if (s) {
      syllables.push(s);
    } else {
      syllables.push({ cho: 0, jung: 0, jong: 0, raw: ch, isNonHangul: true });
    }
  }

  let result = '';

  for (let i = 0; i < syllables.length; i++) {
    const cur = syllables[i];
    if (cur.isNonHangul) {
      result += cur.raw;
      continue;
    }

    const next = (i + 1 < syllables.length && !syllables[i + 1].isNonHangul) ? syllables[i + 1] : null;

    let choRom = CHOSEONG[cur.cho];
    const jungRom = JUNGSEONG[cur.jung];
    let jongRom = '';

    if (cur.jong > 0) {
      const cJong = cur.jong;

      // 1. Followed by vowel (next.cho === 11, ㅇ): Liaison (연음 법칙)
      if (next && next.cho === 11) {
        // Palatalization: ㄷ (7) or ㅌ (25) followed by 이 (jung = 20)
        if (cJong === 7 && next.jung === 20) {
          jongRom = '';
          next.choRomOverride = 'j';
        } else if (cJong === 25 && next.jung === 20) {
          jongRom = '';
          next.choRomOverride = 'ch';
        } else {
          jongRom = '';
          next.choRomOverride = LIAISON_MAP[cJong] !== undefined ? LIAISON_MAP[cJong] : '';
        }
      }
      // 2. Aspirated merger with following ㅎ (18)
      else if (next && next.cho === 18) {
        // ㄱ (1, 2) + ㅎ -> k
        if (cJong === 1 || cJong === 2) {
          jongRom = '';
          next.choRomOverride = 'k';
        }
        // ㄷ, ㅅ, ㅆ, ㅈ, ㅊ (7, 19, 20, 22, 23) + ㅎ -> t
        else if ([7, 19, 20, 22, 23].includes(cJong)) {
          jongRom = '';
          next.choRomOverride = 't';
        }
        // ㅂ (17) + ㅎ -> p
        else if (cJong === 17) {
          jongRom = '';
          next.choRomOverride = 'p';
        } else {
          jongRom = JONGSEONG_BASE[cJong];
        }
      }
      // 3. ㅎ (27) followed by consonant
      else if (next && cJong === 27) {
        // ㅎ + ㄱ (0) -> k
        if (next.cho === 0) {
          jongRom = '';
          next.choRomOverride = 'k';
        }
        // ㅎ + ㄷ (3) -> t
        else if (next.cho === 3) {
          jongRom = '';
          next.choRomOverride = 't';
        }
        // ㅎ + ㅈ (12) -> ch
        else if (next.cho === 12) {
          jongRom = '';
          next.choRomOverride = 'ch';
        }
        // ㅎ + ㅅ (9) -> ss
        else if (next.cho === 9) {
          jongRom = '';
          next.choRomOverride = 'ss';
        }
        // ㅎ + ㄴ (2) -> n
        else if (next.cho === 2) {
          jongRom = 'n';
        } else {
          jongRom = '';
        }
      }
      // 4. Followed by other consonants: Phonological assimilation
      else if (next) {
        const nCho = next.cho;

        // Liquid assimilation: ㄴ (4) + ㄹ (5) -> ll, ㄹ (8) + ㄴ (2) -> ll, ㄹ + ㄹ -> ll
        if ((cJong === 4 && nCho === 5) || (cJong === 8 && nCho === 2) || (cJong === 8 && nCho === 5)) {
          jongRom = 'l';
          next.choRomOverride = 'l';
        }
        // Nasal assimilation:
        // ㄱ, ㄲ, ㅋ before ㄴ, ㅁ -> 'ng'
        else if ((cJong === 1 || cJong === 2 || cJong === 24) && (nCho === 2 || nCho === 6)) {
          jongRom = 'ng';
        }
        // ㄷ, ㅅ, ㅆ, ㅈ, ㅊ, ㅌ before ㄴ, ㅁ -> 'n'
        else if ([7, 19, 20, 22, 23, 25].includes(cJong) && (nCho === 2 || nCho === 6)) {
          jongRom = 'n';
        }
        // ㅂ, ㅍ before ㄴ, ㅁ -> 'm'
        else if ((cJong === 17 || cJong === 26) && (nCho === 2 || nCho === 6)) {
          jongRom = 'm';
        }
        // Default standalone batchim
        else {
          jongRom = JONGSEONG_BASE[cJong];
        }
      } else {
        // Word final jongseong
        jongRom = JONGSEONG_BASE[cJong];
      }
    }

    if (cur.choRomOverride !== undefined) {
      choRom = cur.choRomOverride;
    }

    result += choRom + jungRom + jongRom;
  }

  return result;
}

/**
 * Transliterates a single word token while preserving surrounding punctuation.
 * (e.g. "(사랑해)" -> "(saranghae)", "\"보고싶어\"" -> "\"bogosipeo\"", "안녕," -> "annyeong,")
 */
export function tokenToKoreanRoman(token: string): string {
  if (!token) return '';
  if (!hasKoreanScript(token)) return token;

  const match = token.match(/^([^\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]*)([\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\-]+)([^\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]*)$/);
  if (match) {
    const [, prefix, koreanPart, suffix] = match;
    return prefix + transliterateHangulWord(koreanPart) + suffix;
  }

  return transliterateHangulWord(token);
}

/**
 * Transliterates an entire line of Korean Hangul lyrics into Revised Romanization.
 */
export function transliterateKoreanToRoman(line: string): string {
  if (!line) return '';
  if (!hasKoreanScript(line)) return line;

  const tokenRegex = /([\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\-]+|[^\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\-]+)/gu;
  const parts = line.match(tokenRegex) || [line];

  let out = parts.map((part) => {
    if (hasKoreanScript(part)) {
      return transliterateHangulWord(part);
    }
    return part;
  }).join('');

  // Capitalize first character of line for clean typography
  if (out.length > 0) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }

  return out;
}

/**
 * Converts all Korean Hangul lines and word tokens in an OpenLyricsDocument to Romanization.
 *
 * - Transliterates line text while preserving existing timestamps and structure.
 * - Transliterates each individual word token's text, preserving millisecond sync timings.
 * - Stores original Korean Hangul text non-destructively in line.translations.ko.
 * - Updates document language metadata to 'ko-Latn' if originally 'ko'.
 */
export function convertDocumentToKoreanRoman<T extends { lines: Array<any>; metadata?: any }>(doc: T): T {
  if (!doc || !doc.lines) return doc;

  const convertedLines = doc.lines.map((line) => {
    const lineHasKorean = hasKoreanScript(line.text);
    const romanKoreanText = lineHasKorean ? transliterateKoreanToRoman(line.text) : line.text;

    // Transliterate every word token that contains Korean Hangul script
    const convertedTokens = line.tokens?.map((token: any) => {
      if (hasKoreanScript(token.text)) {
        return {
          ...token,
          text: tokenToKoreanRoman(token.text)
        };
      }
      return token;
    });

    return {
      ...line,
      text: romanKoreanText,
      tokens: convertedTokens,
      translations: lineHasKorean
        ? {
            ...(line.translations || {}),
            ko: line.text
          }
        : line.translations
    };
  });

  return {
    ...doc,
    metadata: {
      ...(doc.metadata || {}),
      language: doc.metadata?.language === 'ko' ? 'ko-Latn' : doc.metadata?.language
    },
    lines: convertedLines
  };
}
