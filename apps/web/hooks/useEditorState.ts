'use client';

import { useReducer, useCallback, useEffect, useRef, useMemo } from 'react';
import { LyricLine, OpenLyricsDocument, WordToken } from '@/types/lyrics';
import { EditorAction, HistoryState } from '@/types/editor';
import { tokenizeLineIntoWords as tokenizeMultilingualWords, isJapaneseText, estimateWordPhoneticWeight, isCjkScript } from '@/lib/tokenizer';
import { convertDocumentToRomaji } from '@/lib/romaji';
import { convertDocumentToRomanHindi, isHindiText, hasHindiScript } from '@/lib/hindi';
import { convertDocumentToKoreanRoman, isKoreanText, hasKoreanScript } from '@/lib/korean';
import {
  convertDocumentToIndicRoman,
  detectIndicLanguage,
  detectAllIndicLanguages,
  hasIndicScript,
  INDIC_LANGUAGES,
  IndicLanguageCode,
  IndicLanguageInfo
} from '@/lib/indic';
import { getActiveDraft, saveActiveDraft, clearActiveDraft } from '@/lib/db';
export {
  isJapaneseText,
  convertDocumentToRomaji,
  isHindiText,
  hasHindiScript,
  convertDocumentToRomanHindi,
  isKoreanText,
  hasKoreanScript,
  convertDocumentToKoreanRoman,
  convertDocumentToIndicRoman,
  detectIndicLanguage,
  detectAllIndicLanguages,
  hasIndicScript,
  INDIC_LANGUAGES,
};
export type { IndicLanguageCode, IndicLanguageInfo };


const MAX_HISTORY = 100;

let nextUniqueId = 1;
function generateUniqueId(prefix = 'line'): string {
  return `${prefix}-${Date.now()}-${nextUniqueId++}-${Math.random().toString(36).substr(2, 7)}`;
}

/**
 * Splits line text into individual words for syllable/word-level synchronization.
 * - Correctly preserves backing vocals/parentheticals as separate words:
 *   e.g. "(Faut pas lui dire, tu la désires)" -> ["(Faut", "pas", "lui", "dire,", "tu", "la", "désires)"]
 * - Normalizes orphan punctuation across Latin, Indic (dandas), Arabic, and CJK scripts.
 * - Preserves leading/trailing brackets on boundary tokens.
 */
export function tokenizeLineIntoWords(text: string): string[] {
  if (!text) return [];
  // Normalize orphan punctuation before tokenizing across Latin, Indic (dandas), Arabic, and CJK
  const normalized = text.replace(/\s+([.,!?;:।॥،؟、。，！？])/g, '$1').trim();
  if (!normalized) return [];

  // Split on whitespace into discrete word units
  return tokenizeMultilingualWords(text);
}

// Backward-compatibility alias
export const tokenizeSentenceWithBrackets = tokenizeLineIntoWords;

/**
 * Native Sentence-to-Word Sync Engine:
 * Converts a sentence-synced LyricLine into multiple individual word-synced LyricLine objects.
 * - Words in brackets (xyz) do not split into separate rows; they attach to the main word.
 * - Word 0 starts EXACTLY at line.start
 * - Word N-1 ends EXACTLY at line.end
 * - Seamless contiguous boundaries between adjacent words.
 * - Attaches parentSentenceId for precise single-sentence Karaoke Mode rendering.
 */
function divideLineIntoWordLines(line: LyricLine): LyricLine[] {
  const words = tokenizeLineIntoWords(line.text);
  if (words.length <= 1) {
    return [line];
  }

  const parentSentenceId = line.sentenceId || line.id || generateUniqueId('sentence');

  // If line already has stamped word tokens that match words.length, use the actual stamped timings!
  if (line.tokens && line.tokens.length === words.length) {
    return words.map((w, idx) => ({
      id: generateUniqueId('word'),
      sentenceId: parentSentenceId,
      text: w,
      start: line.tokens![idx].start,
      end: line.tokens![idx].end,
      emphasis: line.tokens![idx].emphasis || line.emphasis || undefined,
    }));
  }

  const lineStart = line.start;
  const lineEnd = Math.max(lineStart + 0.1, line.end);
  const totalDuration = lineEnd - lineStart;
  const weights = words.map((w) => estimateWordPhoneticWeight(w));
  const totalWeight = weights.reduce((acc, val) => acc + val, 0) || 1;
  let currentStart = lineStart;

  return words.map((w, idx) => {
    const wordDuration = (weights[idx] / totalWeight) * totalDuration;
    const wordStart = idx === 0 ? lineStart : currentStart;
    const wordEnd = idx === words.length - 1 ? lineEnd : currentStart + wordDuration;
    currentStart = wordEnd;

    return {
      id: generateUniqueId('word'),
      sentenceId: parentSentenceId,
      text: w,
      start: Number(wordStart.toFixed(3)),
      end: Number(wordEnd.toFixed(3)),
      emphasis: line.emphasis || undefined,
    };
  });
}

/**
 * Generates WordToken[] from line text and duration boundaries
 */
export function createLineWordTokens(line: LyricLine): WordToken[] {
  const words = tokenizeLineIntoWords(line.text);
  if (words.length === 0) return [];

  const lineStart = line.start;
  const lineEnd = Math.max(lineStart + 0.1, line.end);
  const totalDuration = lineEnd - lineStart;
  const weights = words.map((w) => estimateWordPhoneticWeight(w));
  const totalWeight = weights.reduce((acc, val) => acc + val, 0) || 1;
  let currentStart = lineStart;

  return words.map((w, idx) => {
    const wordDuration = (weights[idx] / totalWeight) * totalDuration;
    const wordStart = idx === 0 ? lineStart : currentStart;
    const wordEnd = idx === words.length - 1 ? lineEnd : currentStart + wordDuration;
    currentStart = wordEnd;

    return {
      text: w,
      start: Number(wordStart.toFixed(3)),
      end: Number(wordEnd.toFixed(3)),
      emphasis: line.emphasis || undefined,
    };
  });
}

function cleanTokenForMatch(s: string): string {
  const cleaned = s.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
  return cleaned || s.trim().toLowerCase();
}

/**
 * Synchronizes existing word tokens with edited line text.
 * - Preserves existing stamped start/end timestamps and emphasis states.
 * - Handles token splitting: e.g. "Hey-yeah," -> "Hey" + "yeah,", dividing time proportionally.
 * - Handles token merging: e.g. "Hey" + "yeah" -> "Hey-yeah,", combining time bounds.
 * - Handles anchor matching and smooth non-overlapping interpolation for added/deleted words.
 * - Guarantees zero overlapping word timestamps under all editing conditions.
 */
export function syncLineWordTokens(
  existingTokens: WordToken[] | undefined,
  newText: string,
  lineStart: number,
  lineEnd: number,
  lineEmphasis?: boolean
): WordToken[] | undefined {
  if (!existingTokens || existingTokens.length === 0) {
    return undefined; // Line is not tokenized yet
  }

  const newWords = tokenizeLineIntoWords(newText);
  if (newWords.length === 0) {
    return [];
  }

  const safeLineStart = lineStart;
  const safeLineEnd = Math.max(safeLineStart + 0.1, lineEnd);

  // Case 1: Exact same token count (user fixed a word/typo without changing word boundaries)
  if (newWords.length === existingTokens.length) {
    return existingTokens.map((tok, idx) => ({
      ...tok,
      text: newWords[idx],
    }));
  }

  // Case 2: Token count changed (words split by removing hyphens, merged, inserted, or deleted)
  const result: WordToken[] = [];
  let wIdx = 0;
  let tIdx = 0;

  while (wIdx < newWords.length && tIdx < existingTokens.length) {
    const wClean = cleanTokenForMatch(newWords[wIdx]);
    const tClean = cleanTokenForMatch(existingTokens[tIdx].text);

    // Subcase 2A: Direct 1-to-1 word match
    if (wClean && wClean === tClean) {
      result.push({
        ...existingTokens[tIdx],
        text: newWords[wIdx],
      });
      wIdx++;
      tIdx++;
      continue;
    }

    // Subcase 2B: Token split - an existing token was split into multiple words (e.g. 'Hey-yeah,' -> 'Hey' + 'yeah,')
    const matchedWords: string[] = [];
    let accumWordClean = '';
    let lookW = wIdx;
    let isSplitFound = false;

    while (lookW < newWords.length) {
      accumWordClean += cleanTokenForMatch(newWords[lookW]);
      matchedWords.push(newWords[lookW]);
      lookW++;
      if (tClean && accumWordClean === tClean) {
        isSplitFound = true;
        break;
      }
      if (accumWordClean.length > tClean.length) {
        break;
      }
    }

    if (isSplitFound && matchedWords.length > 0) {
      const parentTok = existingTokens[tIdx];
      const tokDuration = Math.max(0.08, parentTok.end - parentTok.start);
      const weights = matchedWords.map((w) => estimateWordPhoneticWeight(w));
      const totalWeight = weights.reduce((acc, val) => acc + val, 0) || 1;
      let curStart = parentTok.start;

      for (let i = 0; i < matchedWords.length; i++) {
        const wDur = (weights[i] / totalWeight) * tokDuration;
        const wEnd = i === matchedWords.length - 1 ? parentTok.end : curStart + wDur;
        result.push({
          text: matchedWords[i],
          start: Number(curStart.toFixed(3)),
          end: Number(wEnd.toFixed(3)),
          emphasis: parentTok.emphasis ?? lineEmphasis ?? undefined,
        });
        curStart = wEnd;
      }

      wIdx = lookW;
      tIdx++;
      continue;
    }

    // Subcase 2C: Tokens merged - multiple existing tokens were merged into one word (e.g. 'Hey' + 'yeah' -> 'Hey-yeah')
    const matchedToks: WordToken[] = [];
    let accumTokClean = '';
    let lookT = tIdx;
    let isMergeFound = false;

    while (lookT < existingTokens.length) {
      accumTokClean += cleanTokenForMatch(existingTokens[lookT].text);
      matchedToks.push(existingTokens[lookT]);
      lookT++;
      if (wClean && accumTokClean === wClean) {
        isMergeFound = true;
        break;
      }
      if (accumTokClean.length > wClean.length) {
        break;
      }
    }

    if (isMergeFound && matchedToks.length > 0) {
      const firstTok = matchedToks[0];
      const lastTok = matchedToks[matchedToks.length - 1];
      result.push({
        text: newWords[wIdx],
        start: firstTok.start,
        end: lastTok.end,
        emphasis: firstTok.emphasis || lastTok.emphasis || lineEmphasis || undefined,
      });
      wIdx++;
      tIdx = lookT;
      continue;
    }

    // Subcase 2D: Insertion or word mismatch - look ahead for next anchor match
    let anchor: [number, number] | null = null;
    const maxLookahead = 4;
    for (let fw = wIdx + 1; fw < Math.min(newWords.length, wIdx + maxLookahead); fw++) {
      const fwClean = cleanTokenForMatch(newWords[fw]);
      if (!fwClean) continue;
      for (let ft = tIdx + 1; ft < Math.min(existingTokens.length, tIdx + maxLookahead); ft++) {
        if (fwClean === cleanTokenForMatch(existingTokens[ft].text)) {
          anchor = [fw, ft];
          break;
        }
      }
      if (anchor) break;
    }

    if (anchor) {
      const [fw, ft] = anchor;
      const spanStart = result.length > 0 ? result[result.length - 1].end : safeLineStart;
      const spanEnd = existingTokens[ft].start;
      const spanDuration = Math.max(0.08, spanEnd - spanStart);
      const intermediateWords = newWords.slice(wIdx, fw);
      const weights = intermediateWords.map((w) => estimateWordPhoneticWeight(w));
      const totalWeight = weights.reduce((acc, val) => acc + val, 0) || 1;
      let curStart = spanStart;

      for (let i = 0; i < intermediateWords.length; i++) {
        const wDur = (weights[i] / totalWeight) * spanDuration;
        const wEnd = i === intermediateWords.length - 1 ? spanEnd : curStart + wDur;
        result.push({
          text: intermediateWords[i],
          start: Number(curStart.toFixed(3)),
          end: Number(wEnd.toFixed(3)),
          emphasis: lineEmphasis || undefined,
        });
        curStart = wEnd;
      }

      wIdx = fw;
      tIdx = ft;
    } else {
      // 1-to-1 fallback for single word replacement/edit
      result.push({
        ...existingTokens[tIdx],
        text: newWords[wIdx],
      });
      wIdx++;
      tIdx++;
    }
  }

  // Handle any remaining newly added words at the end
  if (wIdx < newWords.length) {
    const trailingWords = newWords.slice(wIdx);
    const spanStart = result.length > 0 ? result[result.length - 1].end : safeLineStart;
    let spanEnd = safeLineEnd;
    if (spanEnd <= spanStart) {
      spanEnd = spanStart + 0.5 * trailingWords.length;
    }
    const spanDuration = spanEnd - spanStart;
    const weights = trailingWords.map((w) => estimateWordPhoneticWeight(w));
    const totalWeight = weights.reduce((acc, val) => acc + val, 0) || 1;
    let curStart = spanStart;

    for (let i = 0; i < trailingWords.length; i++) {
      const wDur = (weights[i] / totalWeight) * spanDuration;
      const wEnd = i === trailingWords.length - 1 ? spanEnd : curStart + wDur;
      result.push({
        text: trailingWords[i],
        start: Number(curStart.toFixed(3)),
        end: Number(wEnd.toFixed(3)),
        emphasis: lineEmphasis || undefined,
      });
      curStart = wEnd;
    }
  }

  // Monotonic Sanitization Pass: Enforce strict chronological bounds and positive duration
  for (let i = 0; i < result.length; i++) {
    if (result[i].start < safeLineStart) {
      result[i].start = safeLineStart;
    }
    if (result[i].end <= result[i].start) {
      result[i].end = Number((result[i].start + 0.05).toFixed(3));
    }
    if (i > 0 && result[i].start < result[i - 1].end) {
      result[i].start = result[i - 1].end;
      if (result[i].end <= result[i].start) {
        result[i].end = Number((result[i].start + 0.05).toFixed(3));
      }
    }
  }

  return result;
}

export const defaultEmptyDocument: OpenLyricsDocument = {
  $schema: 'https://openlyrics.dev/schema/v1.json',
  version: 1,
  metadata: {
    title: 'Untitled Track',
    artist: 'Untitled Artist',
    album: '',
    duration: 0,
    syncedBy: 'OpenLyryc Contributor',
  },
  lines: [],
};

function commitAction(
  state: HistoryState,
  newPresent: OpenLyricsDocument,
  actionDesc: string
): HistoryState {
  return {
    past: [...state.past, { document: state.present, actionDesc }].slice(-MAX_HISTORY),
    present: newPresent,
    future: [],
    lastHistoryAction: undefined,
  };
}

function historyReducer(state: HistoryState, action: EditorAction): HistoryState {
  const { past, present, future } = state;

  switch (action.type) {
    case 'UNDO': {
      if (past.length === 0) return state;
      const previousSnapshot = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);
      return {
        past: newPast,
        present: previousSnapshot.document,
        future: [{ document: present, actionDesc: previousSnapshot.actionDesc }, ...future],
        lastHistoryAction: {
          type: 'undo',
          description: previousSnapshot.actionDesc,
          timestamp: Date.now(),
        },
      };
    }

    case 'REDO': {
      if (future.length === 0) return state;
      const nextSnapshot = future[0];
      const newFuture = future.slice(1);
      return {
        past: [...past, { document: present, actionDesc: nextSnapshot.actionDesc }].slice(-MAX_HISTORY),
        present: nextSnapshot.document,
        future: newFuture,
        lastHistoryAction: {
          type: 'redo',
          description: nextSnapshot.actionDesc,
          timestamp: Date.now(),
        },
      };
    }

    case 'SET_DOCUMENT': {
      const seenIds = new Set<string>();
      const safeLines = action.document.lines.map((line, idx) => {
        let text = line.text;
        // Fix squished lines that have word tokens but missing spaces (e.g. from older imports or legacy cached state)
        if (line.tokens && line.tokens.length > 1 && !/\s/.test(text || '') && !isJapaneseText(text || '') && !isCjkScript(text || '')) {
          text = line.tokens.map((t) => t.text.trim()).filter(Boolean).join(' ');
        }
        let lineId = String(line.id !== undefined && line.id !== null && line.id !== '' ? line.id : `line-${idx}`);
        if (seenIds.has(lineId)) {
          lineId = `${lineId}_${idx}`;
        }
        seenIds.add(lineId);
        return {
          ...line,
          text,
          id: lineId,
        };
      });

      return commitAction(
        state,
        { ...action.document, lines: safeLines },
        'imported lyrics document'
      );
    }

    case 'APPLY_REMOTE_DOCUMENT': {
      const seenIds = new Set<string>();
      const safeLines = action.document.lines.map((line, idx) => {
        let text = line.text;
        if (line.tokens && line.tokens.length > 1 && !/\s/.test(text || '') && !isJapaneseText(text || '') && !isCjkScript(text || '')) {
          text = line.tokens.map((t) => t.text.trim()).filter(Boolean).join(' ');
        }
        let lineId = String(line.id !== undefined && line.id !== null && line.id !== '' ? line.id : `line-${idx}`);
        if (seenIds.has(lineId)) {
          lineId = `${lineId}_${idx}`;
        }
        seenIds.add(lineId);
        return {
          ...line,
          text,
          id: lineId,
        };
      });

      const newPresent = { ...action.document, lines: safeLines };

      // Avoid duplicate history entries if document is identical
      if (JSON.stringify(present) === JSON.stringify(newPresent)) {
        return state;
      }

      return commitAction(state, newPresent, 'synced remote document');
    }

    case 'SET_LINE_START': {
      const { lineIndex, timestamp } = action;
      if (lineIndex < 0 || lineIndex >= present.lines.length) return state;

      const newLines = [...present.lines];
      const targetLine = newLines[lineIndex];

      let updatedEnd = targetLine.end;
      if (updatedEnd <= timestamp) {
        const nextLine = newLines[lineIndex + 1];
        updatedEnd = nextLine && nextLine.start > timestamp
          ? nextLine.start
          : Number((timestamp + 2.0).toFixed(3));
      }

      newLines[lineIndex] = {
        ...targetLine,
        start: timestamp,
        end: updatedEnd,
      };

      // Self-adjust previous block's end value to the start of the new block if previous end > new start
      if (lineIndex > 0) {
        const prevLine = newLines[lineIndex - 1];
        if (prevLine && prevLine.end > timestamp) {
          newLines[lineIndex - 1] = {
            ...prevLine,
            end: timestamp,
          };
        }
      }

      return commitAction(
        state,
        { ...present, lines: newLines },
        `stamped line ${lineIndex + 1} start`
      );
    }

    case 'SET_LINE_END': {
      const { lineIndex, timestamp } = action;
      if (lineIndex < 0 || lineIndex >= present.lines.length) return state;

      const newLines = [...present.lines];
      const targetLine = newLines[lineIndex];

      newLines[lineIndex] = {
        ...targetLine,
        end: timestamp,
      };

      // Self-adjust next block's start value to the end of this block if next start < new end
      if (lineIndex < newLines.length - 1) {
        const nextLine = newLines[lineIndex + 1];
        if (nextLine && nextLine.start < timestamp) {
          newLines[lineIndex + 1] = {
            ...nextLine,
            start: timestamp,
          };
        }
      }

      return commitAction(
        state,
        { ...present, lines: newLines },
        `stamped line ${lineIndex + 1} end`
      );
    }

    case 'SET_LINE_TIMING': {
      const { lineIndex, start, end } = action;
      if (lineIndex < 0 || lineIndex >= present.lines.length) return state;

      const newLines = [...present.lines];
      const targetLine = newLines[lineIndex];
      const roundedStart = Number(start.toFixed(3));
      const roundedEnd = Number(end.toFixed(3));

      // Rescale tokens if present proportionally
      let updatedTokens = targetLine.tokens;
      if (updatedTokens && updatedTokens.length > 0 && targetLine.end > targetLine.start) {
        const oldDur = targetLine.end - targetLine.start;
        const newDur = roundedEnd - roundedStart;
        const ratio = newDur / oldDur;
        updatedTokens = updatedTokens.map((t) => ({
          ...t,
          start: Number((roundedStart + (t.start - targetLine.start) * ratio).toFixed(3)),
          end: Number((roundedStart + (t.end - targetLine.start) * ratio).toFixed(3)),
        }));
      }

      newLines[lineIndex] = {
        ...targetLine,
        start: roundedStart,
        end: roundedEnd,
        ...(action.layerId !== undefined ? { layerId: action.layerId } : {}),
        tokens: updatedTokens,
      };

      return commitAction(
        state,
        { ...present, lines: newLines },
        `adjusted line ${lineIndex + 1} timing`
      );
    }

    case 'SET_LINE_LAYER': {
      const { lineIndex, layerId } = action;
      if (lineIndex < 0 || lineIndex >= present.lines.length) return state;

      const newLines = [...present.lines];
      newLines[lineIndex] = {
        ...newLines[lineIndex],
        layerId,
      };

      return commitAction(
        state,
        { ...present, lines: newLines },
        `shifted line ${lineIndex + 1} to layer`
      );
    }

    case 'REORDER_LINES': {
      const { fromIndex, toIndex } = action;
      if (
        fromIndex < 0 ||
        fromIndex >= present.lines.length ||
        toIndex < 0 ||
        toIndex >= present.lines.length ||
        fromIndex === toIndex
      ) {
        return state;
      }

      const newLines = [...present.lines];
      const [movedLine] = newLines.splice(fromIndex, 1);
      newLines.splice(toIndex, 0, movedLine);

      return commitAction(
        state,
        { ...present, lines: newLines },
        `reordered line ${fromIndex + 1} to position ${toIndex + 1}`
      );
    }

    case 'UPDATE_LINE_TEXT': {
      const now = Date.now();
      const isRapidSuccessiveTextEdit =
        state.lastEditTime &&
        now - state.lastEditTime < 750 &&
        past.length > 0 &&
        past[past.length - 1].actionDesc === `edited line ${action.lineIndex + 1}`;

      const newLines = present.lines.map((line, idx) => {
        if (idx === action.lineIndex) {
          const updatedTokens = syncLineWordTokens(line.tokens, action.text, line.start, line.end, line.emphasis);
          return {
            ...line,
            text: action.text,
            tokens: updatedTokens,
          };
        }
        return line;
      });

      if (isRapidSuccessiveTextEdit) {
        return {
          ...state,
          present: { ...present, lines: newLines },
          lastEditTime: now,
        };
      }

      return {
        ...commitAction(
          state,
          { ...present, lines: newLines },
          `edited line ${action.lineIndex + 1}`
        ),
        lastEditTime: now,
      };
    }

    case 'ADD_LINE': {
      const insertAt = action.afterIndex !== undefined ? action.afterIndex + 1 : present.lines.length;
      const defaultStart = insertAt > 0 ? present.lines[insertAt - 1].end + 0.5 : 0;
      const defaultEnd = insertAt > 0 ? present.lines[insertAt - 1].end + 3.5 : 3.0;

      const newLine: LyricLine = {
        id: generateUniqueId('add'),
        text: action.text !== undefined ? action.text : 'New lyric line...',
        start: action.start !== undefined ? action.start : defaultStart,
        end: action.end !== undefined ? action.end : (action.start !== undefined ? action.start + 2.5 : defaultEnd),
        layerId: action.layerId,
      };

      const newLines = [...present.lines];
      newLines.splice(insertAt, 0, newLine);

      return commitAction(
        state,
        { ...present, lines: newLines },
        'added lyric line'
      );
    }

    case 'DELETE_LINE': {
      if (present.lines.length <= 1) return state;
      const newLines = present.lines.filter((_, idx) => idx !== action.lineIndex);

      return commitAction(
        state,
        { ...present, lines: newLines },
        'deleted lyric line'
      );
    }

    case 'DIVIDE_LINE_INTO_WORDS': {
      if (action.lineIndex < 0 || action.lineIndex >= present.lines.length) return state;

      const targetLine = present.lines[action.lineIndex];
      const wordLines = divideLineIntoWordLines(targetLine);

      const newLines = [...present.lines];
      newLines.splice(action.lineIndex, 1, ...wordLines);

      return commitAction(
        state,
        { ...present, lines: newLines },
        `split line ${action.lineIndex + 1} into words`
      );
    }

    case 'DIVIDE_ALL_LINES': {
      const newLines = present.lines.flatMap((line) => divideLineIntoWordLines(line));

      return commitAction(
        state,
        { ...present, lines: newLines },
        'split all lines into words'
      );
    }

    case 'TOKENIZE_LINE': {
      if (action.lineIndex < 0 || action.lineIndex >= present.lines.length) return state;
      const targetLine = present.lines[action.lineIndex];
      const tokens = createLineWordTokens(targetLine);

      const newLines = [...present.lines];
      newLines[action.lineIndex] = {
        ...targetLine,
        tokens,
      };

      return commitAction(
        state,
        { ...present, lines: newLines },
        `tokenized words for line ${action.lineIndex + 1}`
      );
    }

    case 'UPDATE_WORD_TOKENS': {
      if (action.lineIndex < 0 || action.lineIndex >= present.lines.length) return state;
      const targetLine = present.lines[action.lineIndex];

      const newLines = [...present.lines];
      newLines[action.lineIndex] = {
        ...targetLine,
        tokens: action.tokens,
      };

      return commitAction(
        state,
        { ...present, lines: newLines },
        'updated word tokens'
      );
    }

    case 'SET_WORD_TOKEN': {
      const { lineIndex, tokenIndex, start, end } = action;
      if (lineIndex < 0 || lineIndex >= present.lines.length) return state;

      const targetLine = present.lines[lineIndex];
      if (!targetLine.tokens || tokenIndex < 0 || tokenIndex >= targetLine.tokens.length) return state;

      const newTokens = [...targetLine.tokens];
      const clampedStart = Math.max(targetLine.start, Math.min(targetLine.end - 0.04, Number(start.toFixed(3))));
      const clampedEnd = Math.max(clampedStart + 0.04, Math.min(targetLine.end, Number(end.toFixed(3))));

      newTokens[tokenIndex] = {
        ...newTokens[tokenIndex],
        start: clampedStart,
        end: clampedEnd,
      };

      // Contiguous boundary self-adjustments
      if (tokenIndex > 0 && newTokens[tokenIndex - 1].end > clampedStart) {
        newTokens[tokenIndex - 1] = {
          ...newTokens[tokenIndex - 1],
          end: clampedStart,
        };
      }
      if (tokenIndex < newTokens.length - 1 && newTokens[tokenIndex + 1].start < clampedEnd) {
        newTokens[tokenIndex + 1] = {
          ...newTokens[tokenIndex + 1],
          start: clampedEnd,
        };
      }

      // Word 0 is strictly anchored to targetLine.start; Last word is anchored to targetLine.end
      if (tokenIndex === 0) {
        newTokens[0].start = targetLine.start;
      }
      if (tokenIndex === newTokens.length - 1) {
        newTokens[newTokens.length - 1].end = targetLine.end;
      }

      const newLines = [...present.lines];
      newLines[lineIndex] = {
        ...targetLine,
        tokens: newTokens,
      };

      const wordText = targetLine.tokens?.[tokenIndex]?.text;

      return commitAction(
        state,
        { ...present, lines: newLines },
        wordText ? `stamped word '${wordText}'` : 'stamped word token'
      );
    }

    case 'SET_WORD_TOKEN_TEXT': {
      const { lineIndex, tokenIndex, text } = action;
      if (lineIndex < 0 || lineIndex >= present.lines.length) return state;

      const targetLine = present.lines[lineIndex];
      if (!targetLine.tokens || tokenIndex < 0 || tokenIndex >= targetLine.tokens.length) return state;

      const newTokens = [...targetLine.tokens];
      newTokens[tokenIndex] = {
        ...newTokens[tokenIndex],
        text,
      };

      const newLines = [...present.lines];
      newLines[lineIndex] = {
        ...targetLine,
        text: isJapaneseText(targetLine.text) && !/\s/.test(targetLine.text)
          ? newTokens.map((t) => t.text).join('')
          : newTokens.map((t) => t.text).join(' '),
        tokens: newTokens,
      };

      return commitAction(
        state,
        { ...present, lines: newLines },
        `edited word '${text}'`
      );
    }

    case 'REMOVE_WORD_TOKENS': {
      if (action.lineIndex < 0 || action.lineIndex >= present.lines.length) return state;

      const targetLine = present.lines[action.lineIndex];
      const { tokens: _, ...rest } = targetLine;

      const newLines = [...present.lines];
      newLines[action.lineIndex] = rest;

      return commitAction(
        state,
        { ...present, lines: newLines },
        'removed word tokens'
      );
    }

    case 'TOGGLE_WORD_EMPHASIS': {
      const { lineIndex, tokenIndex } = action;
      if (lineIndex < 0 || lineIndex >= present.lines.length) return state;

      const targetLine = present.lines[lineIndex];
      if (!targetLine.tokens || tokenIndex < 0 || tokenIndex >= targetLine.tokens.length) return state;

      const newTokens = [...targetLine.tokens];
      const currentToken = newTokens[tokenIndex];
      newTokens[tokenIndex] = {
        ...currentToken,
        emphasis: !currentToken.emphasis,
      };

      const hasAnyTokenEmphasis = newTokens.some((t) => Boolean(t.emphasis));

      const newLines = [...present.lines];
      newLines[lineIndex] = {
        ...targetLine,
        emphasis: hasAnyTokenEmphasis,
        tokens: newTokens,
      };

      const wordText = targetLine.tokens?.[tokenIndex]?.text;

      return commitAction(
        state,
        { ...present, lines: newLines },
        wordText ? `toggled emphasis on '${wordText}'` : 'toggled word emphasis'
      );
    }

    case 'TOGGLE_LINE_EMPHASIS': {
      const { lineIndex } = action;
      if (lineIndex < 0 || lineIndex >= present.lines.length) return state;

      const targetLine = present.lines[lineIndex];
      const newEmphasis = !targetLine.emphasis;

      let newTokens = targetLine.tokens;
      if (newTokens && newTokens.length > 0) {
        newTokens = newTokens.map((t) => ({ ...t, emphasis: newEmphasis }));
      }

      const newLines = [...present.lines];
      newLines[lineIndex] = {
        ...targetLine,
        emphasis: newEmphasis,
        ...(newTokens ? { tokens: newTokens } : {}),
      };

      return commitAction(
        state,
        { ...present, lines: newLines },
        'toggled line emphasis'
      );
    }

    case 'BATCH_TOKENIZE_ALL': {
      const newLines = present.lines.map((line) => ({
        ...line,
        tokens: createLineWordTokens(line),
      }));

      return commitAction(
        state,
        { ...present, lines: newLines },
        'batch tokenized all lyrics'
      );
    }

    case 'UPDATE_METADATA': {
      let desc = 'updated metadata';
      if (action.metadata.offset !== undefined) {
        const newOffset = action.metadata.offset || 0;
        desc = `adjusted sync to be ${newOffset > 0 ? `+${newOffset}` : newOffset}ms`;
      } else if (action.metadata.title !== undefined) {
        desc = 'updated song title';
      } else if (action.metadata.artist !== undefined) {
        desc = 'updated artist name';
      } else if (action.metadata.precisionMode !== undefined) {
        desc = action.metadata.precisionMode ? 'enabled millisecond precision' : 'disabled millisecond precision';
      }

      return commitAction(
        state,
        {
          ...present,
          metadata: { ...present.metadata, ...action.metadata },
        },
        desc
      );
    }

    case 'SET_LINE_VOCALIST': {
      const { lineIndex, vocalist } = action;
      if (lineIndex < 0 || lineIndex >= present.lines.length) return state;
      const newLines = [...present.lines];
      newLines[lineIndex] = {
        ...newLines[lineIndex],
        vocalist,
      };
      const vocalistLabel = vocalist || 'none';
      return commitAction(
        state,
        { ...present, lines: newLines },
        `set vocalist to ${vocalistLabel} on line ${lineIndex + 1}`
      );
    }

    case 'CONVERT_TO_ROMAJI': {
      const converted = convertDocumentToRomaji(present);
      return commitAction(state, converted, 'converted Japanese lyrics to Romaji');
    }

    case 'CONVERT_TO_ROMAN_HINDI': {
      const converted = convertDocumentToRomanHindi(present);
      return commitAction(state, converted, 'converted Hindi lyrics to Roman Hindi');
    }

    case 'CONVERT_TO_KOREAN_ROMAN': {
      const converted = convertDocumentToKoreanRoman(present);
      return commitAction(state, converted, 'converted Korean lyrics to Romanization');
    }

    case 'CONVERT_TO_INDIC_ROMAN': {
      const { doc: converted, language } = convertDocumentToIndicRoman(
        present,
        action.language as IndicLanguageCode | undefined
      );
      const langName = language && INDIC_LANGUAGES[language] ? INDIC_LANGUAGES[language].name : 'Indic';
      return commitAction(state, converted, `converted ${langName} lyrics to Roman script`);
    }

    case 'SHIFT_ALL_TIMESTAMPS': {
      const { deltaSeconds } = action;
      if (!deltaSeconds || deltaSeconds === 0) return state;

      const newLines = present.lines.map((line) => {
        const newStart = Math.max(0, Number((line.start + deltaSeconds).toFixed(3)));
        const newEnd = Math.max(newStart + 0.05, Number((line.end + deltaSeconds).toFixed(3)));
        const newTokens = line.tokens?.map((tok) => ({
          ...tok,
          start: Math.max(0, Number((tok.start + deltaSeconds).toFixed(3))),
          end: Math.max(0.05, Number((tok.end + deltaSeconds).toFixed(3))),
        }));

        return {
          ...line,
          start: newStart,
          end: newEnd,
          ...(newTokens ? { tokens: newTokens } : {}),
        };
      });

      const ms = Math.round(deltaSeconds * 1000);
      return commitAction(
        state,
        { ...present, lines: newLines },
        `shifted all timestamps by ${ms > 0 ? `+${ms}` : ms}ms`
      );
    }

    case 'BAKE_OFFSET_INTO_TIMESTAMPS': {
      const offsetMs = present.metadata.offset || 0;
      if (offsetMs === 0) return state;
      // In OpenLyryc, displayTime = rawTime + (offsetMs / 1000).
      // A positive offset causes lyrics to render earlier by offsetMs.
      // Baking converts this virtual clock advance into permanent timestamp offsets:
      // newTimestamp = oldTimestamp - (offsetMs / 1000).
      const deltaSeconds = -(offsetMs / 1000);

      const newLines = present.lines.map((line) => {
        const newStart = Math.max(0, Number((line.start + deltaSeconds).toFixed(3)));
        const newEnd = Math.max(newStart + 0.05, Number((line.end + deltaSeconds).toFixed(3)));
        const newTokens = line.tokens?.map((tok) => ({
          ...tok,
          start: Math.max(0, Number((tok.start + deltaSeconds).toFixed(3))),
          end: Math.max(0.05, Number((tok.end + deltaSeconds).toFixed(3))),
        }));

        return {
          ...line,
          start: newStart,
          end: newEnd,
          ...(newTokens ? { tokens: newTokens } : {}),
        };
      });

      return commitAction(
        state,
        {
          ...present,
          metadata: { ...present.metadata, offset: 0 },
          lines: newLines,
        },
        `baked ${offsetMs > 0 ? `+${offsetMs}` : offsetMs}ms sync offset into timestamps`
      );
    }

    case 'BATCH_REPLACE_LINES': {
      return commitAction(
        state,
        { ...present, lines: action.lines },
        action.desc
      );
    }

    default:
      return state;
  }
}

export function useEditorState(initialDoc: OpenLyricsDocument = defaultEmptyDocument) {
  const [state, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initialDoc,
    future: [],
  });

  // History log for the History Drawer (Feature 10): newest-first, max 20 entries
  const historyLog = useMemo(() => {
    const log: { description: string; isPast: boolean; index: number }[] = [];
    for (let i = state.past.length - 1; i >= 0; i--) {
      log.push({ description: state.past[i].actionDesc, isPast: true, index: i });
      if (log.length >= 20) break;
    }
    return log;
  }, [state.past]);

  // Rehydrate state from Dexie IndexedDB on browser mount (skip if joining a collaborative session)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let isMounted = true;
    try {
      const isCollabRoom =
        window.location.hash.includes('room=') ||
        window.location.search.includes('room=');
      if (isCollabRoom) {
        // Do not load local cached song when joining a shared room
        return;
      }
      getActiveDraft()
        .then((parsed) => {
          if (!isMounted) return;
          if (parsed && Array.isArray(parsed.lines)) {
            dispatch({ type: 'SET_DOCUMENT', document: parsed });
          }
        })
        .catch((e) => {
          console.warn('Failed to rehydrate document from Dexie/localStorage', e);
        });
    } catch (e) {
      console.warn('Failed to rehydrate document from Dexie/localStorage', e);
    }
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-persist active document to Dexie IndexedDB (P0 perf: debounced 800ms +
  // JSON-change skip so every keystroke/stamp doesn't double-persist).
  const persistTimerRef = useRef<number | null>(null);
  const lastPersistedJsonRef = useRef<string>('');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      try {
        if (state.present.lines.length > 0 || state.present.metadata.title !== 'Untitled Track') {
          const json = JSON.stringify(state.present);
          if (json !== lastPersistedJsonRef.current) {
            saveActiveDraft(state.present).catch((err) => {
              console.error('Failed to auto-save document to Dexie', err);
            });
            lastPersistedJsonRef.current = json;
          }
        }
      } catch (e) {
        console.error('Failed to auto-save document to Dexie', e);
      }
    }, 800);
    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    };
  }, [state.present]);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);
  const setDocument = useCallback(
    (doc: OpenLyricsDocument) => dispatch({ type: 'SET_DOCUMENT', document: doc }),
    []
  );
  const clearDocument = useCallback(() => {
    dispatch({ type: 'SET_DOCUMENT', document: defaultEmptyDocument });
    clearActiveDraft().catch(() => {});
  }, []);
  const setLineStart = useCallback(
    (lineIndex: number, timestamp: number) =>
      dispatch({ type: 'SET_LINE_START', lineIndex, timestamp }),
    []
  );
  const setLineEnd = useCallback(
    (lineIndex: number, timestamp: number) =>
      dispatch({ type: 'SET_LINE_END', lineIndex, timestamp }),
    []
  );
  const setLineTiming = useCallback(
    (lineIndex: number, start: number, end: number, layerId?: string) =>
      dispatch({ type: 'SET_LINE_TIMING', lineIndex, start, end, layerId }),
    []
  );
  const setLineLayer = useCallback(
    (lineIndex: number, layerId: string) =>
      dispatch({ type: 'SET_LINE_LAYER', lineIndex, layerId }),
    []
  );
  const reorderLines = useCallback(
    (fromIndex: number, toIndex: number) =>
      dispatch({ type: 'REORDER_LINES', fromIndex, toIndex }),
    []
  );
  const updateLineText = useCallback(
    (lineIndex: number, text: string) => dispatch({ type: 'UPDATE_LINE_TEXT', lineIndex, text }),
    []
  );
  const addLine = useCallback(
    (afterIndex?: number, text?: string, start?: number, end?: number, layerId?: string) =>
      dispatch({ type: 'ADD_LINE', afterIndex, text, start, end, layerId }),
    []
  );
  const deleteLine = useCallback(
    (lineIndex: number) => dispatch({ type: 'DELETE_LINE', lineIndex }),
    []
  );
  const divideLineIntoWords = useCallback(
    (lineIndex: number) => dispatch({ type: 'DIVIDE_LINE_INTO_WORDS', lineIndex }),
    []
  );
  const divideAllLines = useCallback(
    () => dispatch({ type: 'DIVIDE_ALL_LINES' }),
    []
  );
  const tokenizeLine = useCallback(
    (lineIndex: number) => dispatch({ type: 'TOKENIZE_LINE', lineIndex }),
    []
  );
  const updateWordTokens = useCallback(
    (lineIndex: number, tokens: import('@/types/lyrics').WordToken[]) =>
      dispatch({ type: 'UPDATE_WORD_TOKENS', lineIndex, tokens }),
    []
  );
  const setWordToken = useCallback(
    (lineIndex: number, tokenIndex: number, start: number, end: number) =>
      dispatch({ type: 'SET_WORD_TOKEN', lineIndex, tokenIndex, start, end }),
    []
  );
  const setWordTokenText = useCallback(
    (lineIndex: number, tokenIndex: number, text: string) =>
      dispatch({ type: 'SET_WORD_TOKEN_TEXT', lineIndex, tokenIndex, text }),
    []
  );
  const removeWordTokens = useCallback(
    (lineIndex: number) => dispatch({ type: 'REMOVE_WORD_TOKENS', lineIndex }),
    []
  );
  const toggleWordEmphasis = useCallback(
    (lineIndex: number, tokenIndex: number) =>
      dispatch({ type: 'TOGGLE_WORD_EMPHASIS', lineIndex, tokenIndex }),
    []
  );
  const toggleLineEmphasis = useCallback(
    (lineIndex: number) =>
      dispatch({ type: 'TOGGLE_LINE_EMPHASIS', lineIndex }),
    []
  );
  const batchTokenizeAll = useCallback(
    () => dispatch({ type: 'BATCH_TOKENIZE_ALL' }),
    []
  );
  const updateMetadata = useCallback(
    (metadata: Partial<OpenLyricsDocument['metadata']>) =>
      dispatch({ type: 'UPDATE_METADATA', metadata }),
    []
  );
  const applyRemoteDocument = useCallback(
    (document: OpenLyricsDocument) =>
      dispatch({ type: 'APPLY_REMOTE_DOCUMENT', document }),
    []
  );

  return {
    document: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    lastHistoryAction: state.lastHistoryAction,
    undo,
    redo,
    setDocument,
    applyRemoteDocument,
    clearDocument,
    setLineStart,
    setLineEnd,
    setLineTiming,
    setLineLayer,
    reorderLines,
    updateLineText,
    addLine,
    deleteLine,
    divideLineIntoWords,
    divideAllLines,
    tokenizeLine,
    updateWordTokens,
    setWordToken,
    setWordTokenText,
    removeWordTokens,
    toggleWordEmphasis,
    toggleLineEmphasis,
    batchTokenizeAll,
    updateMetadata,
    setLineVocalist: useCallback(
      (lineIndex: number, vocalist: string | undefined) =>
        dispatch({ type: 'SET_LINE_VOCALIST', lineIndex, vocalist }),
      []
    ),
    convertToRomaji: useCallback(
      () => dispatch({ type: 'CONVERT_TO_ROMAJI' }),
      []
    ),
    convertToRomanHindi: useCallback(
      () => dispatch({ type: 'CONVERT_TO_ROMAN_HINDI' }),
      []
    ),
    convertToKoreanRoman: useCallback(
      () => dispatch({ type: 'CONVERT_TO_KOREAN_ROMAN' }),
      []
    ),
    convertToIndicRoman: useCallback(
      (language?: string) => dispatch({ type: 'CONVERT_TO_INDIC_ROMAN', language }),
      []
    ),
    shiftAllTimestamps: useCallback(
      (deltaSeconds: number) => dispatch({ type: 'SHIFT_ALL_TIMESTAMPS', deltaSeconds }),
      []
    ),
    bakeOffsetIntoTimestamps: useCallback(
      () => dispatch({ type: 'BAKE_OFFSET_INTO_TIMESTAMPS' }),
      []
    ),
    batchReplaceLines: useCallback(
      (lines: LyricLine[], desc = 'replaced text') =>
        dispatch({ type: 'BATCH_REPLACE_LINES', lines, desc }),
      []
    ),
    historyLog,
  };
}
