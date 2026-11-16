import { OpenLyricsDocument, PackedLyricDocument, CompactLyricLine, CompactWordToken, LyricLine, WordToken } from './lyrics';

/**
 * Compresses a canonical OpenLyricsDocument into a PackedLyricDocument (v2)
 * - Uses dictionary string table for word tokens
 * - Converts timestamps to relative millisecond deltas
 */
export function compressDocumentToDelta(doc: OpenLyricsDocument): PackedLyricDocument {
  const dictionaryMap = new Map<string, number>();
  const words: string[] = [];

  const getWordIndex = (text: string): number => {
    let idx = dictionaryMap.get(text);
    if (idx === undefined) {
      idx = words.length;
      dictionaryMap.set(text, idx);
      words.push(text);
    }
    return idx;
  };

  const packedLines: CompactLyricLine[] = doc.lines.map((line) => {
    const lineStartMs = Math.round(line.start * 1000);
    const lineEndMs = Math.round(line.end * 1000);

    let compactTokens: CompactWordToken[] | undefined = undefined;

    if (line.tokens && line.tokens.length > 0) {
      compactTokens = line.tokens.map((token) => {
        const tokenStartMs = Math.round(token.start * 1000);
        const tokenEndMs = Math.round(token.end * 1000);
        const deltaMs = Math.max(0, tokenStartMs - lineStartMs);
        const durMs = Math.max(10, tokenEndMs - tokenStartMs);

        return {
          wIdx: getWordIndex(token.text),
          dMs: deltaMs,
          durMs,
        };
      });
    }

    return {
      id: line.id,
      text: line.text,
      sMs: lineStartMs,
      eMs: lineEndMs,
      tokens: compactTokens,
    };
  });

  return {
    v: 2,
    metadata: doc.metadata,
    words,
    lines: packedLines,
  };
}

/**
 * Decompresses a PackedLyricDocument (v2) back into a canonical OpenLyricsDocument (v1)
 */
export function decompressDeltaToDocument(packed: PackedLyricDocument): OpenLyricsDocument {
  const words = packed.words || [];

  const lines: LyricLine[] = packed.lines.map((cLine) => {
    const lineStartSec = cLine.sMs / 1000;
    const lineEndSec = cLine.eMs / 1000;

    let tokens: WordToken[] | undefined = undefined;

    if (cLine.tokens && cLine.tokens.length > 0) {
      tokens = cLine.tokens.map((cTok) => {
        const text = words[cTok.wIdx] || '';
        const tokenStartSec = (cLine.sMs + cTok.dMs) / 1000;
        const tokenEndSec = (cLine.sMs + cTok.dMs + cTok.durMs) / 1000;

        return {
          text,
          start: Number(tokenStartSec.toFixed(3)),
          end: Number(tokenEndSec.toFixed(3)),
        };
      });
    }

    return {
      id: cLine.id,
      text: cLine.text,
      start: Number(lineStartSec.toFixed(3)),
      end: Number(lineEndSec.toFixed(3)),
      tokens,
    };
  });

  return {
    $schema: 'https://openlyrics.dev/schema/v1.json',
    version: 1,
    metadata: packed.metadata,
    lines,
  };
}
