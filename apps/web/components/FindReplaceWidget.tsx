'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { LyricLine, WordToken } from '@/types/lyrics';
import { syncLineWordTokens } from '@/hooks/useEditorState';
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Replace,
  Search,
} from 'lucide-react';

export interface FindMatch {
  id: string;
  lineIndex: number;
  startChar: number;
  endChar: number;
  text: string;
}

export interface FindOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
}

interface FindReplaceWidgetProps {
  lines: LyricLine[];
  onUpdateLineText: (lineIndex: number, text: string) => void;
  onBatchReplaceLines: (lines: LyricLine[], desc: string) => void;
  activeLineIndex: number;
  setActiveLineIndex: (idx: number) => void;
  isOpen: boolean;
  onClose: () => void;
  isReplaceExpanded?: boolean;
  onToggleReplace?: (expanded: boolean) => void;
  onMatchesChange?: (matches: FindMatch[], activeIndex: number, query: string, options: FindOptions) => void;
  onToast?: (message: string) => void;
}

export function buildSearchRegex(query: string, options: FindOptions): RegExp | null {
  if (!query) return null;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flags = 'g' + (options.caseSensitive ? '' : 'i') + 'u';

  try {
    if (options.wholeWord) {
      // Unicode-aware word boundaries using lookbehind and lookahead
      return new RegExp(`(?<=^|[^\\p{L}\\p{N}_])${escaped}(?=[^\\p{L}\\p{N}_]|$)`, flags);
    }
    return new RegExp(escaped, flags);
  } catch {
    // Fallback if Unicode lookbehinds are unsupported
    try {
      const fbPattern = options.wholeWord ? `\\b${escaped}\\b` : escaped;
      return new RegExp(fbPattern, options.caseSensitive ? 'g' : 'gi');
    } catch {
      return null;
    }
  }
}

export const FindReplaceWidget: React.FC<FindReplaceWidgetProps> = ({
  lines,
  onUpdateLineText,
  onBatchReplaceLines,
  activeLineIndex,
  setActiveLineIndex,
  isOpen,
  onClose,
  isReplaceExpanded = false,
  onToggleReplace,
  onMatchesChange,
  onToast,
}) => {
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [showReplace, setShowReplace] = useState(isReplaceExpanded);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Sync internal replace visibility with parent prop
  useEffect(() => {
    setShowReplace(isReplaceExpanded);
  }, [isReplaceExpanded]);

  const toggleReplace = useCallback(() => {
    setShowReplace((prev) => {
      const next = !prev;
      onToggleReplace?.(next);
      return next;
    });
  }, [onToggleReplace]);

  const options = useMemo<FindOptions>(
    () => ({ caseSensitive, wholeWord }),
    [caseSensitive, wholeWord]
  );

  const handleClose = useCallback(() => {
    setFindQuery('');
    setActiveMatchIndex(0);
    onMatchesChange?.([], 0, '', options);
    onClose();
  }, [onClose, onMatchesChange, options]);

  // When widget is closed externally, reset query and notify parent
  useEffect(() => {
    if (!isOpen) {
      setFindQuery('');
      setActiveMatchIndex(0);
      onMatchesChange?.([], 0, '', options);
    }
  }, [isOpen, options, onMatchesChange]);

  // Auto-focus find input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        findInputRef.current?.focus();
        findInputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Compute all matches across lines
  const matches = useMemo<FindMatch[]>(() => {
    if (!findQuery) return [];
    const rx = buildSearchRegex(findQuery, options);
    if (!rx) return [];

    const found: FindMatch[] = [];
    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      const text = lines[lIdx].text || '';
      rx.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(text)) !== null) {
        if (m[0].length === 0) {
          rx.lastIndex++;
          continue;
        }
        found.push({
          id: `${lIdx}-${m.index}-${m.index + m[0].length}`,
          lineIndex: lIdx,
          startChar: m.index,
          endChar: m.index + m[0].length,
          text: m[0],
        });
      }
    }
    return found;
  }, [findQuery, options, lines]);

  // Keep activeMatchIndex in bounds
  useEffect(() => {
    if (matches.length === 0) {
      setActiveMatchIndex(0);
    } else if (activeMatchIndex >= matches.length) {
      setActiveMatchIndex(0);
    }
  }, [matches.length, activeMatchIndex]);

  // Notify parent of matches change
  useEffect(() => {
    onMatchesChange?.(matches, activeMatchIndex, findQuery, options);
  }, [matches, activeMatchIndex, findQuery, options, onMatchesChange]);

  const scrollToLine = useCallback(
    (lineIdx: number) => {
      setActiveLineIndex(lineIdx);
      const el = document.getElementById(`lyric-row-${lineIdx}`);
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    },
    [setActiveLineIndex]
  );

  const handleNext = useCallback(() => {
    if (matches.length === 0) return;
    const nextIdx = (activeMatchIndex + 1) % matches.length;
    setActiveMatchIndex(nextIdx);
    scrollToLine(matches[nextIdx].lineIndex);
  }, [matches, activeMatchIndex, scrollToLine]);

  const handlePrev = useCallback(() => {
    if (matches.length === 0) return;
    const prevIdx = (activeMatchIndex - 1 + matches.length) % matches.length;
    setActiveMatchIndex(prevIdx);
    scrollToLine(matches[prevIdx].lineIndex);
  }, [matches, activeMatchIndex, scrollToLine]);

  const handleReplaceOne = useCallback(() => {
    if (matches.length === 0) return;
    const curMatch = matches[activeMatchIndex];
    if (!curMatch) return;

    const line = lines[curMatch.lineIndex];
    if (!line) return;

    const curText = line.text;
    const newText =
      curText.slice(0, curMatch.startChar) +
      replaceQuery +
      curText.slice(curMatch.endChar);

    onUpdateLineText(curMatch.lineIndex, newText);

    // If there were other matches, keep cursor on same position or advance
    if (matches.length > 1) {
      const nextIdx = activeMatchIndex % (matches.length - 1);
      setActiveMatchIndex(nextIdx);
    }
  }, [matches, activeMatchIndex, lines, replaceQuery, onUpdateLineText]);

  const handleReplaceAll = useCallback(() => {
    if (!findQuery || matches.length === 0) return;
    const rx = buildSearchRegex(findQuery, options);
    if (!rx) return;

    let totalReplaced = 0;
    const updatedLines = lines.map((line) => {
      rx.lastIndex = 0;
      if (!rx.test(line.text)) return line;

      rx.lastIndex = 0;
      const occurrences = (line.text.match(rx) || []).length;
      totalReplaced += occurrences;

      rx.lastIndex = 0;
      const newText = line.text.replace(rx, replaceQuery);
      const newTokens = syncLineWordTokens(
        line.tokens,
        newText,
        line.start,
        line.end,
        line.emphasis
      );

      return {
        ...line,
        text: newText,
        ...(newTokens ? { tokens: newTokens } : {}),
      };
    });

    if (totalReplaced > 0) {
      onBatchReplaceLines(
        updatedLines,
        `replaced ${totalReplaced} occurrences of "${findQuery}" with "${replaceQuery}"`
      );
      onToast?.(`Replaced ${totalReplaced} occurrences`);
    }
  }, [findQuery, replaceQuery, options, matches.length, lines, onBatchReplaceLines, onToast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleClose();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrev();
      } else {
        handleNext();
      }
    }
  };

  const handleReplaceKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleClose();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.altKey) {
        handleReplaceAll();
      } else {
        handleReplaceOne();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="search"
      aria-label="Find and Replace"
      className="absolute top-3 right-4 z-40 flex flex-col gap-1.5 p-2 bg-[#121215]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.85)] text-xs text-zinc-200 select-none animate-in fade-in zoom-in-95 duration-150"
    >
      {/* 1. Find Row */}
      <div className="flex items-center gap-1.5">
        {/* Toggle Replace Chevron */}
        <button
          type="button"
          onClick={toggleReplace}
          title={showReplace ? 'Collapse Replace' : 'Expand Replace (Ctrl+H)'}
          className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
        >
          {showReplace ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Find Input Box */}
        <div className="flex items-center gap-1.5 bg-[#18181d] border border-white/10 focus-within:border-white/30 rounded-lg px-2 py-1 h-7 w-44 sm:w-56 transition-all">
          <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input
            ref={findInputRef}
            type="text"
            placeholder="Find words..."
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 outline-none font-sans"
          />
          {findQuery && (
            <button
              type="button"
              onClick={() => setFindQuery('')}
              className="text-zinc-500 hover:text-zinc-200 cursor-pointer"
              title="Clear"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Match Count Counter Pill */}
        <div className="min-w-[48px] text-center px-1 text-[11px] font-mono tabular-nums text-zinc-400">
          {findQuery ? (
            matches.length > 0 ? (
              <span>
                <strong className="text-zinc-200">{activeMatchIndex + 1}</strong>
                <span className="opacity-60">/{matches.length}</span>
              </span>
            ) : (
              <span className="text-zinc-500">0/0</span>
            )
          ) : (
            <span className="text-zinc-600">—</span>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-white/10 shrink-0" />

        {/* Case Sensitive Toggle (Aa) */}
        <button
          type="button"
          onClick={() => setCaseSensitive((prev) => !prev)}
          title={`Match Case (${caseSensitive ? 'On' : 'Off'})`}
          className={`h-6 px-1.5 rounded-md text-[11px] font-mono font-medium transition-all cursor-pointer ${
            caseSensitive
              ? 'bg-white/20 text-white border border-white/30 shadow-xs'
              : 'text-zinc-400 hover:text-white hover:bg-white/10'
          }`}
        >
          Aa
        </button>

        {/* Match Whole Word Toggle ([W]) */}
        <button
          type="button"
          onClick={() => setWholeWord((prev) => !prev)}
          title={`Match Whole Word (${wholeWord ? 'On' : 'Off'})`}
          className={`h-6 px-1.5 rounded-md text-[11px] font-mono font-medium transition-all cursor-pointer ${
            wholeWord
              ? 'bg-white/20 text-white border border-white/30 shadow-xs'
              : 'text-zinc-400 hover:text-white hover:bg-white/10'
          }`}
        >
          [W]
        </button>

        {/* Prev Match Button */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={matches.length === 0}
          title="Previous Match (Shift+Enter)"
          className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer shrink-0"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>

        {/* Next Match Button */}
        <button
          type="button"
          onClick={handleNext}
          disabled={matches.length === 0}
          title="Next Match (Enter)"
          className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer shrink-0"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {/* Close Widget Button */}
        <button
          type="button"
          onClick={handleClose}
          title="Close (Escape)"
          className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Replace Row (Expanded) */}
      {showReplace && (
        <div className="flex items-center gap-1.5 pl-7.5 pt-0.5">
          {/* Replace Input Box */}
          <div className="flex items-center gap-1.5 bg-[#18181d] border border-white/10 focus-within:border-white/30 rounded-lg px-2 py-1 h-7 w-44 sm:w-56 transition-all">
            <Replace className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <input
              ref={replaceInputRef}
              type="text"
              placeholder="Replace with..."
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              onKeyDown={handleReplaceKeyDown}
              className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 outline-none font-sans"
            />
            {replaceQuery && (
              <button
                type="button"
                onClick={() => setReplaceQuery('')}
                className="text-zinc-500 hover:text-zinc-200 cursor-pointer"
                title="Clear"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Replace Button */}
          <button
            type="button"
            onClick={handleReplaceOne}
            disabled={matches.length === 0}
            title="Replace single occurrence (Enter)"
            className="h-7 px-2.5 rounded-lg text-[11px] font-medium bg-white/[0.08] hover:bg-white/[0.16] disabled:opacity-30 text-zinc-200 hover:text-white border border-white/10 transition-colors cursor-pointer shrink-0"
          >
            Replace
          </button>

          {/* Replace All Button */}
          <button
            type="button"
            onClick={handleReplaceAll}
            disabled={matches.length === 0}
            title="Replace all occurrences (Alt+Enter)"
            className="h-7 px-2.5 rounded-lg text-[11px] font-medium bg-white/[0.08] hover:bg-white/[0.16] disabled:opacity-30 text-zinc-200 hover:text-white border border-white/10 transition-colors cursor-pointer shrink-0"
          >
            All
          </button>
        </div>
      )}
    </div>
  );
};
