import lexiconData from './data/japaneseLexicon.json';
import { tokenizeLineIntoWords } from './tokenizer.js';
import { OpenLyricsDocument } from '@openlyryc/schema';

interface JapaneseLexicon {
  vocab: Record<string, string>;
  stems: Record<string, string>;
  kanji: Record<string, string>;
}

const lexicon: JapaneseLexicon = lexiconData as unknown as JapaneseLexicon;

const HIRA_TO_ROMAJI: Record<string, string> = {
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
  'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  'わ': 'wa', 'ゐ': 'wi', 'ゑ': 'we', 'を': 'o',
  'ん': 'n',

  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
  'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
  'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',

  'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
  'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
  'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
  'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
  'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
  'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
  'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
  'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
  'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
  'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
  'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
  'ふぁ': 'fa', 'ふぃ': 'fi', 'ふぇ': 'fe', 'ふぉ': 'fo',
  'ゔぁ': 'va', 'ゔぃ': 'vi', 'ゔ': 'vu', 'ゔぇ': 've', 'ゔぉ': 'vo',
  'てぃ': 'ti', 'でぃ': 'di', 'うぃ': 'wi', 'うぇ': 'we', 'うぉ': 'wo'
};

const KATAKANA_SPECIAL: Record<string, string> = {
  'ティ': 'ti', 'ディ': 'di', 'トゥ': 'tu', 'ドゥ': 'du',
  'ウィ': 'wi', 'ウェ': 'we', 'ウォ': 'wo',
  'シェ': 'she', 'ジェ': 'je', 'チェ': 'che',
  'ファ': 'fa', 'フィ': 'fi', 'フェ': 'fe', 'フォ': 'fo', 'フュ': 'fyu',
  'ヴァ': 'va', 'ヴィ': 'vi', 'ヴ': 'vu', 'ヴェ': 've', 'ヴォ': 'vo',
  'スィ': 'si', 'ズィ': 'zi', 'ツァ': 'tsa', 'ツィ': 'tsi', 'ツェ': 'tse', 'ツォ': 'tso'
};

const KANJI_STANDALONE: Record<string, string> = {
  '私': 'わたし', '前': 'まえ', '頃': 'ころ', '訳': 'わけ', '缶': 'かん',
  '通': 'とお', '怒': 'おこ', '廻': 'まわ', '的': 'てき', '目': 'め',
  '手': 'て', '足': 'あし', '心': 'こころ', '愛': 'あい', '空': 'そら',
  '海': 'うみ', '星': 'ほし', '夜': 'よる', '朝': 'あさ', '花': 'はな',
  '風': 'かぜ', '雨': 'あめ', '雪': 'ゆき', '夢': 'ゆめ', '歌': 'うた',
  '声': 'こえ', '音': 'おと', '道': 'みち', '時': 'とき', '今': 'いま'
};

export function hasJapaneseScript(text: string): boolean {
  if (!text) return false;
  return /[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF\uFF65-\uFF9F\u4E00-\u9FFF\u3400-\u4DBF]/.test(text);
}

function katakanaToHiragana(text: string): string {
  return text.replace(/[\u30A1-\u30F6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

export function kanaToRomaji(kana: string, isParticle: boolean = false): string {
  if (!kana) return '';

  if (isParticle) {
    if (kana === 'は') return 'wa';
    if (kana === 'へ') return 'e';
    if (kana === 'を') return 'o';
  }

  let text = kana;
  for (const [kat, rom] of Object.entries(KATAKANA_SPECIAL)) {
    if (text.includes(kat)) text = text.split(kat).join(rom);
  }

  const hira = katakanaToHiragana(text);
  let res = '';
  let i = 0;

  while (i < hira.length) {
    const ch = hira[i];

    if (ch === 'っ' || ch === 'ッ') {
      const nextPair = hira.slice(i + 1, i + 3);
      const nextRom = HIRA_TO_ROMAJI[nextPair] || HIRA_TO_ROMAJI[hira[i + 1]] || '';
      if (nextRom.startsWith('ch')) res += 't';
      else if (nextRom) res += nextRom[0];
      i++;
      continue;
    }

    if (ch === 'ー') {
      const lastVowel = res.slice(-1);
      if (/[aeiou]/.test(lastVowel)) res += lastVowel;
      i++;
      continue;
    }

    if (ch === 'ん' || ch === 'ン') {
      res += 'n';
      const nextCh = hira[i + 1];
      if (nextCh && /^[あいうえおやゆよアイウエオヤユヨ]/.test(nextCh)) res += "'";
      i++;
      continue;
    }

    if (i + 1 < hira.length) {
      const pair = hira.slice(i, i + 2);
      if (HIRA_TO_ROMAJI[pair]) {
        res += HIRA_TO_ROMAJI[pair];
        i += 2;
        continue;
      }
    }

    if (HIRA_TO_ROMAJI[ch]) {
      res += HIRA_TO_ROMAJI[ch];
      i++;
      continue;
    }

    res += ch;
    i++;
  }

  return res;
}

export function tokenToRomaji(token: string, isParticle: boolean = false): string {
  if (!token) return '';
  if (!hasJapaneseScript(token)) return token;

  const clean = token.replace(/^[(\[（【「『"']+|[)\]）】」』"'・、。，！？!?,.:;…]+$/gu, '');
  if (!clean) return token;

  if (isParticle && /^(は|を|へ)$/.test(clean)) {
    return kanaToRomaji(clean, true);
  }

  if (lexicon.vocab[clean]) {
    return kanaToRomaji(lexicon.vocab[clean]);
  }

  // Okurigana / stem resolution
  for (let len = clean.length - 1; len >= 1; len--) {
    const stem = clean.slice(0, len);
    const suffix = clean.slice(len);
    if (lexicon.stems[stem]) {
      return kanaToRomaji(lexicon.stems[stem] + suffix);
    }
  }

  let kanaRes = '';
  let i = 0;
  while (i < clean.length) {
    const ch = clean[i];
    if (/[\u3040-\u309F\u30A0-\u30FFー]/.test(ch)) {
      kanaRes += ch;
      i++;
      continue;
    }
    let matched = false;
    for (let len = Math.min(6, clean.length - i); len >= 2; len--) {
      const cand = clean.slice(i, i + len);
      if (lexicon.vocab[cand]) {
        kanaRes += lexicon.vocab[cand];
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      kanaRes += KANJI_STANDALONE[ch] || lexicon.kanji[ch] || ch;
      i++;
    }
  }

  const rom = kanaToRomaji(kanaRes);
  return token.replace(clean, rom);
}

export function transliterateJapaneseToRomaji(line: string): string {
  if (!line || !hasJapaneseScript(line)) return line;

  const rawTokens = tokenizeLineIntoWords(line);
  const romWords: string[] = [];

  for (let idx = 0; idx < rawTokens.length; idx++) {
    const tok = rawTokens[idx];
    const isParticle = (tok === 'は' || tok === 'を' || tok === 'へ') && idx > 0;
    romWords.push(tokenToRomaji(tok, isParticle));
  }

  return romWords
    .join(' ')
    .replace(/\s+([.,!?;:・、。，！？「」『』()[\]"'~〜…\-])/g, '$1')
    .trim();
}

export function convertDocumentToRomaji(doc: OpenLyricsDocument): OpenLyricsDocument {
  if (!doc || !doc.lines) return doc;

  const convertedLines = doc.lines.map((line) => {
    const lineHasJapanese = hasJapaneseScript(line.text);
    const romajiText = lineHasJapanese ? transliterateJapaneseToRomaji(line.text) : line.text;

    const convertedTokens = line.tokens?.map((token) => {
      if (hasJapaneseScript(token.text)) {
        return {
          ...token,
          text: tokenToRomaji(token.text),
        };
      }
      return token;
    });

    return {
      ...line,
      text: romajiText,
      tokens: convertedTokens,
      translations: lineHasJapanese
        ? {
            ...(line.translations || {}),
            ja: line.text,
          }
        : line.translations,
    };
  });

  return {
    ...doc,
    metadata: {
      ...doc.metadata,
      language: doc.metadata?.language === 'ja' ? 'ja-Latn' : doc.metadata?.language,
    },
    lines: convertedLines,
  };
}
