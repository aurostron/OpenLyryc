import lexiconData from './data/japaneseLexicon.json';
/**
 * OpenLyryc Intelligent Multilingual Tokenizer
 *
 * Provides high-precision word and morpheme segmentation across:
 * - Japanese (Kanji, Hiragana, Katakana, Nakaguro, Okurigana, and bunsetsu/particle grouping)
 * - CJK scripts (Chinese, Korean)
 * - Latin and Western scripts (English, Spanish, French, German, etc.)
 * - Indic scripts (Hindi, Bengali, Punjabi/Gurmukhi, Tamil, Telugu, etc.)
 * - Arabic and Hebrew
 */

/**
 * Detects if text contains Japanese characters (Hiragana, Katakana, Japanese punctuation,
 * or CJK Unified Ideographs alongside Japanese kana/symbols).
 */
export function isJapaneseText(text: string): boolean {
  if (!text) return false;
  // Hiragana, Katakana, Katakana extensions, Half-width katakana
  if (/[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF\uFF65-\uFF9F]/.test(text)) {
    return true;
  }
  // Japanese punctuation/symbols (nakaguro ・, kanten 、 kouten 。, brackets 「」『』) with CJK Ideographs
  if (/[\u3000-\u303F]/.test(text) && /[\u4E00-\u9FFF\u3400-\u4DBF]/.test(text)) {
    return true;
  }
  return false;
}

export { hasHindiScript, isHindiText } from './hindi';
export { hasKoreanScript, isKoreanText } from './korean';

/**
 * Detects if text contains any CJK ideographs (Kanji/Hanzi/Hanja) without spaces,
 * which requires word segmentation instead of simple whitespace splitting.
 */
export function isCjkScript(text: string): boolean {
  if (!text) return false;
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\uAC00-\uD7AF]/.test(text);
}

function isKatakana(str: string): boolean {
  const clean = str.replace(/^[(\[（【「『"']|[)\]）】」』"'・、。，！？!?,.:;…]+$/g, '');
  return Boolean(clean) && /^[\u30A0-\u30FF\u31F0-\u31FF\uFF65-\uFF9Fー]+$/.test(clean);
}

function isHiragana(str: string): boolean {
  const clean = str.replace(/^[(\[（【「『"']|[)\]）】」』"'・、。，！？!?,.:;…]+$/g, '');
  return Boolean(clean) && /^[\u3040-\u309Fー]+$/.test(clean);
}

/**
 * Splits line text into individual words for syllable/word-level synchronization.
 * - For Japanese and CJK: smartly segments words and morphemes using Intl.Segmenter
 *   with okurigana, katakana, and punctuation binding.
 * - For Latin and other spaced scripts: splits on whitespace, cleanly preserving
 *   parentheticals, quotes, and punctuation.
 */
export function tokenizeLineIntoWords(text: string): string[] {
  if (!text) return [];

  // Normalize orphan punctuation before tokenizing across Latin, Indic (dandas), Arabic, and CJK
  const normalized = text.replace(/\s+([.,!?;:।॥،؟、。，！？])/g, '$1').trim();
  if (!normalized) return [];

  // If text does NOT contain Japanese or CJK characters, use standard whitespace tokenization
  if (!isCjkScript(normalized)) {
    return normalized.split(/\s+/).filter(Boolean);
  }

  // If Intl.Segmenter is not available in environment, fallback to space-split or character grouping
  if (typeof Intl === 'undefined' || typeof (Intl as any).Segmenter !== 'function') {
    return normalized.split(/\s+/).filter(Boolean);
  }

  // Handle Japanese / CJK segmentation
  const spaceChunks = normalized.split(/\s+/).filter(Boolean);
  const allTokens: string[] = [];

  const seg = new (Intl as any).Segmenter('ja', { granularity: 'word' });

  for (const chunk of spaceChunks) {
    // If this space-separated chunk is purely Latin/digits/symbols, keep as a single token
    if (!isCjkScript(chunk)) {
      allTokens.push(chunk);
      continue;
    }

    const raw = Array.from(seg.segment(chunk)) as Array<{ segment: string; isWordLike: boolean }>;
    const chunkTokens: string[] = [];

    // Pass 1: Attach brackets, quotes, trailing punctuation, and split compound volitional particles
    for (let i = 0; i < raw.length; i++) {
      const s = raw[i].segment;
      const isWord = raw[i].isWordLike;

      if (/^\s+$/.test(s)) continue;

      // Opening brackets and quotes attach to the start of the next token
      if (/^[(\[（【「『"']$/.test(s)) {
        if (i + 1 < raw.length) {
          raw[i + 1].segment = s + raw[i + 1].segment;
          continue;
        }
      }

      // Split volitional + と (e.g. ろうと -> ろう + と, おうと -> おう + と)
      if (/(ろう|おう|こう|そう|とう|のう|ぼう|もう|ごう)と$/.test(s)) {
        const base = s.slice(0, -1);
        chunkTokens.push(base);
        chunkTokens.push('と');
        continue;
      }

      // Split 今すぐ -> 今 + すぐ
      if (s === '今すぐ') {
        chunkTokens.push('今', 'すぐ');
        continue;
      }

      // Split common English loanword Katakana compounds (e.g. ラブストーリー -> ラブ + ストーリー, アイムソーリー -> アイム + ソーリー)
      if (s === 'ラブストーリー') {
        chunkTokens.push('ラブ', 'ストーリー');
        continue;
      }
      if (s === 'アイムソーリー') {
        chunkTokens.push('アイム', 'ソーリー');
        continue;
      }

      // Split 〜として / 〜としても when following past/volitional verb (e.g. 動き出そう + として + る -> 動き出そう + と + して + る)
      if (s === 'として' && chunkTokens.length > 0 && /(そう|よう|ろう|た|だ)$/.test(chunkTokens[chunkTokens.length - 1])) {
        chunkTokens.push('と', 'して');
        continue;
      }
      if (s === 'としても' && chunkTokens.length > 0 && /(そう|よう|ろう|た|だ)$/.test(chunkTokens[chunkTokens.length - 1])) {
        chunkTokens.push('と', 'しても');
        continue;
      }

      if (isWord) {
        chunkTokens.push(s);
      } else if (chunkTokens.length > 0) {
        // Trailing punctuation, nakaguro ・, closing brackets attach to previous word
        chunkTokens[chunkTokens.length - 1] += s;
      } else {
        chunkTokens.push(s);
      }
    }

    // Pass 2: Morphological refinement
    // 1. Sokuon & small kana agglutination (促音/捨て仮名: っ, ぁ, ぃ, ぅ, ぇ, ぉ, ゃ, ゅ, ょ)
    // 2. Compound particle unification (には, では, とは, でも, にも, へと)
    // 3. Kanji stem + Okurigana / Auxiliary (結 + ばれる, 青 + き, 犯 + した, 育て + てる, 負け + ない)
    // 4. Shattered Hiragana repair (まくら + ぎ, ぶ + ら + さ + げ + て, ば + ら + ま + い + て)
    // 5. Authentic dictionary compounds (心 + 臓, 前前 + 前世, 大 + 都会)
    const refined: string[] = [];
    let i = 0;

    const isParticleWord = (tok: string, next?: string): boolean => {
      // Core grammatical particles, copulas, and compound particles that are ALWAYS particles when standing alone:
      if (/^(は|が|を|に|へ|で|と|も|の|から|まで|より|だけ|さえ|など|だ|です|じゃ|なら|ならば|では|には|とは|へと|でも|にも|のに|ので|かも|けど|けれど)$/.test(tok)) {
        return true;
      }
      // Negative / passive okurigana starting with わ is NOT a sentence particle:
      if (tok === 'わ') {
        if (next && /^(ない|なかった|ぬ|ず|れる|られる|せる|させる|せた|れた)$/.test(next)) {
          return false;
        }
        return true;
      }
      // Sentence-ending or conjunctive particles (only if not leading a shattered multi-kana word):
      if (/^(や|か|よ|ね|ば|さ)$/.test(tok)) {
        if (next && next.length === 1 && isHiragana(next) && !/^(は|が|を|に|へ|で|と|も|や|か|よ|ね|の|ば|わ|さ)$/.test(next)) {
          return false;
        }
        return true;
      }
      return false;
    };

    while (i < chunkTokens.length) {
      let cur = chunkTokens[i];

      while (i + 1 < chunkTokens.length) {
        const next = chunkTokens[i + 1];

        // Do not merge across trailing punctuation or brackets
        if (/[)\]）】」』"'・、。，！？!?,.:;…]$/.test(cur) || /^[(\[（【「『"']/.test(next)) {
          break;
        }

        const curClean = cur.replace(/^[(\[（【「『"']|[)\]）】」』"'・、。，！？!?,.:;…]+$/g, '');
        const nextClean = next.replace(/^[(\[（【「『"']|[)\]）】」』"'・、。，！？!?,.:;…]+$/g, '');

        const isCurParticle = isParticleWord(curClean, nextClean);
        const isNextParticle = isParticleWord(nextClean, chunkTokens[i + 2]);

        let shouldMerge = false;

        // Special adjective/copula fragments: よ + かった, で + しょう
        if (curClean === 'よ' && /^(か|かっ|かった)$/.test(nextClean)) {
          shouldMerge = true;
        } else if (curClean === 'で' && nextClean === 'しょう') {
          shouldMerge = true;
        }
        // Sokuon (small っ) or small kana extension (ぁ, ぃ, ぅ, ぇ, ぉ, ゃ, ゅ, ょ): MUST merge!
        else if (/^[っッぁぃぅぇぉゃゅょゎ]/.test(nextClean) || /[っッ]$/.test(curClean)) {
          shouldMerge = true;
        }
        // Compound particle pairs (e.g. に + は -> には, で + は -> では, と + は -> とは, で + も -> でも, に + も -> にも, へ + と -> へと)
        else if (isCurParticle && isNextParticle) {
          if (/^(に|で|と)$/.test(curClean) && nextClean === 'は') shouldMerge = true;
          else if (/^(で|に)$/.test(curClean) && nextClean === 'も') shouldMerge = true;
          else if (curClean === 'へ' && nextClean === 'と') shouldMerge = true;
        }
        // If current token is a particle, do NOT merge it with following words
        else if (isCurParticle) {
          shouldMerge = false;
        }
        // Genuine vocab compounds (both non-particles)
        else if (!isNextParticle && (lexiconData as any)?.vocab?.[curClean + nextClean]) {
          shouldMerge = true;
        }
        // Single character katakana fragmentation or nasal/sokuon split (e.g. ル + ラ + ラ -> ルララ, ダン + シン + グ -> ダンシング)
        else if (isKatakana(curClean) && isKatakana(nextClean) && (curClean.length === 1 || nextClean.length === 1 || (/[ンッ]$/.test(curClean) && curClean.length <= 2))) {
          shouldMerge = true;
        }
        // Hypothetical conditional verb form (仮定形 + ば, e.g. 始まれ + ば -> 始まれば, しまえ + ば -> しまえば)
        else if (/[えけせてねへめれげぜべで]$/.test(curClean) && nextClean === 'ば') {
          shouldMerge = true;
        }
        // Euphonic past inflection after nasal / sokuon (e.g. 叫ん + だ -> 叫んだ, 走っ + た -> 走った, 傷つけ + て -> 傷つけて)
        else if (/[んっ]$/.test(curClean) && /^(た|だ|たり|たる|て|で)/.test(nextClean)) {
          shouldMerge = true;
        }
        // Causative / volitional / imperative fragments: せ + ま -> せま, ま + しょう -> ましょう, 咲かせ + ましょう -> 咲かせましょう, 泣き + なさい -> 泣きなさい
        else if (curClean === 'せ' && nextClean === 'ま') {
          shouldMerge = true;
        } else if (curClean === 'ま' && nextClean === 'しょう') {
          shouldMerge = true;
        } else if (/[えけせてねへめれげぜべできしちにひみりぎじび]$/.test(curClean) && /^(ましょう|なさい)$/.test(nextClean)) {
          shouldMerge = true;
        }
        // Verbal auxiliary te-form helper (し + まったり -> しまったり)
        else if (curClean === 'し' && nextClean === 'まったり') {
          shouldMerge = true;
        }
        // Kanji stem + Okurigana (e.g. 結 + ばれる, 青 + き, 犯 + した, 飛 + ば).
        // Only if nextClean is NOT an independent word in lexicon (like ただ) and not a particle (or is okurigana ば)!
        else if (/[一-龯]$/.test(curClean) && isHiragana(nextClean) && (!isNextParticle || nextClean === 'ば') && !(lexiconData as any)?.vocab?.[nextClean]) {
          shouldMerge = true;
        }
        // Euphonic inflection (e.g. 失っ + たり)
        else if (/[んっ]$/.test(curClean) && isHiragana(nextClean) && !isNextParticle) {
          shouldMerge = true;
        }
        // Verb/Adjective stem + auxiliary / inflection / nominalizer
        // If nextClean is 'よう' and followed by 'な/に/だ', do NOT merge into preceding verb (treat 'ような'/'ように' as independent modifier)
        else if (
          /[ぁ-ん]$/.test(curClean) &&
          /^(ない|なかった|てる|ている|ていた|てた|た|だ|った|て|ます|ました|たい|たく|たかった|れる|られる|せる|させる|えば|たら|たり|ていく|てゆく|てくる|てみた|てみる|てしま|てくれ|てやる|ちゃう|ちゃった|ろう|よう|そう|さ|み|る)$/.test(nextClean)
        ) {
          if (nextClean === 'よう' && chunkTokens[i + 2] && /^(な|に|だ|です)$/.test(chunkTokens[i + 2])) {
            shouldMerge = false;
          } else {
            shouldMerge = true;
          }
        }
        // Similarity modifier: よう + な -> ような, よう + に -> ように, よう + だ -> ようだ
        else if (curClean === 'よう' && /^(な|に|だ|です)$/.test(nextClean)) {
          shouldMerge = true;
        }
        // Shattered Hiragana: a single Hiragana character that is NOT a particle cannot stand alone!
        // But if curClean is already a complete word in lexicon (e.g. 'うっせぇ'), do not greedily slurp the next word!
        else if (isHiragana(curClean) && isHiragana(nextClean) && !isCurParticle && !isNextParticle) {
          if ((lexiconData as any)?.vocab?.[curClean]) {
            shouldMerge = false;
          } else if (curClean.length === 1 || nextClean.length === 1) {
            shouldMerge = true;
          }
        }
        // Auxiliary verbal endings: ている, ていた, ないで, てしまえば, たくて, なくても
        else if (curClean.endsWith('ない') && nextClean === 'で') {
          shouldMerge = true;
        } else if (/[てで]$/.test(curClean) && /^(いる|いた|いこう|いける|おく|おいた|しまった|しまう|しまえば|しまったり)$/.test(nextClean)) {
          shouldMerge = true;
        } else if (curClean.endsWith('たく') && nextClean === 'て') {
          shouldMerge = true;
        } else if (curClean.endsWith('なく') && nextClean === 'て') {
          shouldMerge = true;
        } else if (curClean.endsWith('なくて') && nextClean === 'も') {
          shouldMerge = true;
        } else if (curClean === 'たどり' && nextClean.startsWith('着')) {
          shouldMerge = true;
        }

        if (shouldMerge) {
          cur = cur + next;
          i++; // advance past merged token
        } else {
          break;
        }
      }

      refined.push(cur);
      i++;
    }


    allTokens.push(...refined);
  }

  return allTokens;
}

// Backward-compatibility alias
export const tokenizeSentenceWithBrackets = tokenizeLineIntoWords;

/**
 * Calculates a phonetic syllable/rhythmic weight for a word to proportionally
 * distribute line durations across words when explicit word tokens are absent.
 *
 * Prevents multi-syllabic words in Romanized Indic/CJK (e.g. "padhthavaigkum" = 5 syllables)
 * from being compressed into the same duration as single-syllable particles (e.g. "ey" = 1 syllable).
 */
export function estimateWordPhoneticWeight(word: string): number {
  if (!word) return 1;
  const clean = word.replace(/^[(\[（【「『"']+|[)\]）】」』"'.,!?;:।॥،؟、。，！？~*]+$/gu, '').trim();
  if (!clean) return 1;

  // 1. CJK characters (each ideograph is roughly one spoken syllable)
  const cjkMatches = clean.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/gu);
  if (cjkMatches && cjkMatches.length > 0) {
    return Math.max(1, cjkMatches.length);
  }

  // 2. Brahmic native script characters (Devanagari, Tamil, Telugu, etc. - count vowel signs and consonants)
  const brahmicMatches = clean.match(/[\u0900-\u0D7F]/gu);
  if (brahmicMatches && brahmicMatches.length > 0) {
    const vowels = clean.match(/[\u0904-\u0914\u093E-\u094C\u0985-\u0994\u09BE-\u09CC\u0A05-\u0A14\u0A3E-\u0A4C\u0A85-\u0A94\u0ABE-\u0ACC\u0B05-\u0B14\u0B3E-\u0B4C\u0B85-\u0B94\u0BBE-\u0BCC\u0C05-\u0C14\u0C3E-\u0C4C\u0C85-\u0C94\u0CBE-\u0CCC\u0D05-\u0D14\u0D3E-\u0D4C]/gu);
    return Math.max(1, vowels ? vowels.length : Math.ceil(brahmicMatches.length / 2));
  }

  // 3. Latin / Romanized text (English, Romanized Indic, Romaji, Pinyin, Spanish, etc.)
  // Count vowel nucleus clusters (e.g. "aa", "ai", "ou", "oo", "ee" count as unified diphthongs / prolonged vowels)
  const vowelNuclei = clean.match(/[aeiouyáéíóúàèìòùâêîôûäëïöüãõāīūēōḍṛ]+/gi);
  const nucleusCount = vowelNuclei ? vowelNuclei.length : 0;

  // Length factor: long words with consonant clusters also take physical articulation time
  const lengthWeight = clean.length / 4.5;

  return Math.max(1, Math.max(nucleusCount, lengthWeight));
}
