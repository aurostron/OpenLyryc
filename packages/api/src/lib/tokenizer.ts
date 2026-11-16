import lexiconData from './data/japaneseLexicon.json';

/**
 * OpenLyryc Intelligent Multilingual Tokenizer for Edge Worker API
 */

export function isJapaneseText(text: string): boolean {
  if (!text) return false;
  return /[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF\uFF65-\uFF9F]/.test(text) ||
    (/[\u3000-\u303F]/.test(text) && /[\u4E00-\u9FFF\u3400-\u4DBF]/.test(text));
}

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

export function tokenizeLineIntoWords(text: string): string[] {
  if (!text) return [];

  const normalized = text.replace(/\s+([.,!?;:।॥،؟、。，！？])/g, '$1').trim();
  if (!normalized) return [];

  if (!isCjkScript(normalized)) {
    return normalized.split(/\s+/).filter(Boolean);
  }

  if (typeof Intl === 'undefined' || typeof (Intl as any).Segmenter !== 'function') {
    return normalized.split(/\s+/).filter(Boolean);
  }

  const spaceChunks = normalized.split(/\s+/).filter(Boolean);
  const allTokens: string[] = [];
  const seg = new (Intl as any).Segmenter('ja', { granularity: 'word' });

  for (const chunk of spaceChunks) {
    if (!isCjkScript(chunk)) {
      allTokens.push(chunk);
      continue;
    }

    const raw = Array.from(seg.segment(chunk)) as Array<{ segment: string; isWordLike: boolean }>;
    const chunkTokens: string[] = [];

    for (let i = 0; i < raw.length; i++) {
      const s = raw[i].segment;
      const isWord = raw[i].isWordLike;

      if (/^\s+$/.test(s)) continue;

      if (/^[(\[（【「『"']$/.test(s)) {
        if (i + 1 < raw.length) {
          raw[i + 1].segment = s + raw[i + 1].segment;
          continue;
        }
      }

      if (/(ろう|おう|こう|そう|とう|のう|ぼう|もう|ごう)と$/.test(s)) {
        const base = s.slice(0, -1);
        chunkTokens.push(base, 'と');
        continue;
      }

      if (isWord) {
        chunkTokens.push(s);
      } else if (chunkTokens.length > 0) {
        chunkTokens[chunkTokens.length - 1] += s;
      } else {
        chunkTokens.push(s);
      }
    }

    const refined: string[] = [];
    let i = 0;

    const isParticleWord = (tok: string): boolean => {
      return /^(は|が|を|に|へ|で|と|も|の|から|まで|より|だけ|さえ|など|だ|です|じゃ|なら|ならば|では|には|とは|へと|でも|にも|のに|ので|かも|けど|けれど)$/.test(tok);
    };

    while (i < chunkTokens.length) {
      let cur = chunkTokens[i];

      while (i + 1 < chunkTokens.length) {
        const next = chunkTokens[i + 1];
        if (/[)\]）】」』"'・、。，！？!?,.:;…]$/.test(cur) || /^[(\[（【「『"']/.test(next)) break;

        const curClean = cur.replace(/^[(\[（【「『"']|[)\]）】」』"'・、。，！？!?,.:;…]+$/g, '');
        const nextClean = next.replace(/^[(\[（【「『"']|[)\]）】」』"'・、。，！？!?,.:;…]+$/g, '');

        let shouldMerge = false;
        if (/^[っッぁぃぅぇぉゃゅょゎ]/.test(nextClean) || /[っッ]$/.test(curClean)) {
          shouldMerge = true;
        } else if (isKatakana(curClean) && isKatakana(nextClean) && (curClean.length === 1 || nextClean.length === 1)) {
          shouldMerge = true;
        } else if (!isParticleWord(curClean) && !isParticleWord(nextClean) && (lexiconData as any)?.vocab?.[curClean + nextClean]) {
          shouldMerge = true;
        } else if (/[一-龯]$/.test(curClean) && isHiragana(nextClean) && !isParticleWord(nextClean)) {
          shouldMerge = true;
        }

        if (shouldMerge) {
          cur = cur + next;
          i++;
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

export function estimateWordPhoneticWeight(word: string): number {
  if (!word) return 1;
  const clean = word.replace(/^[(\[（【「『"']+|[)\]）】」』"'.,!?;:।॥،؟、。，！？~*]+$/gu, '').trim();
  if (!clean) return 1;

  const cjkMatches = clean.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/gu);
  if (cjkMatches && cjkMatches.length > 0) {
    return Math.max(1, cjkMatches.length);
  }

  const vowelNuclei = clean.match(/[aeiouyáéíóúàèìòùâêîôûäëïöüãõāīūēōḍṛ]+/gi);
  const nucleusCount = vowelNuclei ? vowelNuclei.length : 0;
  const lengthWeight = clean.length / 4.5;

  return Math.max(1, Math.max(nucleusCount, lengthWeight));
}
