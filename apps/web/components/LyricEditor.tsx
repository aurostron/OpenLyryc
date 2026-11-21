'use client';

import React, { useState, useMemo } from 'react';
import { LyricLine, WordToken } from '@/types/lyrics';
import { CollabUser } from '@/types/collab';
import { formatLrcTimecode, parseLrcTimecode } from '@/lib/lrcParser';
import { WordTokenEditor } from './WordTokenEditor';
import { tokenizeLineIntoWords } from '@/lib/tokenizer';
import { IndicLanguageInfo, IndicLanguageCode } from '@/lib/indic';
import {
  Play,
  Clock,
  Timer,
  Scissors,
  Plus,
  Trash2,
  Layers,
  RefreshCw,
  FileUp,
  FolderOpen,
  ClipboardPaste,
  Maximize2,
  Minimize2,
  Sparkles,
} from 'lucide-react';
import { FindMatch, FindOptions, buildSearchRegex } from './FindReplaceWidget';

interface LyricEditorProps {
  lines: LyricLine[];
  activeLineIndex: number;
  setActiveLineIndex: (idx: number) => void;
  currentTime?: number;
  activeTokenIndex?: number;
  setActiveTokenIndex?: (idx: number) => void;
  collabPeers?: CollabUser[];
  onStampLineStart: (lineIdx: number, time?: number) => void;
  onStampLineEnd: (lineIdx: number, time?: number) => void;
  onUpdateLineText: (lineIdx: number, text: string) => void;
  onAddLine: (afterIdx: number) => void;
  onDeleteLine: (lineIdx: number) => void;
  onDivideLineIntoWords?: (lineIdx: number) => void;
  onDivideAllLines?: () => void;
  onTokenizeLine?: (lineIdx: number) => void;
  onBatchTokenizeAll?: () => void;
  onSetWordToken?: (lineIdx: number, tokenIdx: number, start: number, end: number) => void;
  onSetWordTokenText?: (lineIdx: number, tokenIdx: number, text: string) => void;
  onToggleWordEmphasis?: (lineIdx: number, tokenIdx: number) => void;
  onToggleLineEmphasis?: (lineIdx: number) => void;
  onRemoveWordTokens?: (lineIdx: number) => void;
  onUpdateWordTokens?: (lineIdx: number, tokens: WordToken[]) => void;
  onSeek?: (time: number) => void;
  precisionMode?: boolean;
  autoFollowPlayhead?: boolean;
  onToggleAutoFollow?: (enabled: boolean) => void;
  onInputFocusChange?: (isFocused: boolean) => void;
  onActionToast?: (message: string, onUndo?: () => void) => void;
  onUndo?: () => void;
  onSetLineVocalist?: (lineIdx: number, vocalist: string | undefined) => void;
  isHoldSyncing?: boolean;
  onTriggerImport?: () => void;
  onOpenPasteLyrics?: () => void;
  onImportFile?: (file: File) => void;
  onConvertToRomaji?: () => void;
  onConvertToRomanHindi?: () => void;
  onConvertToKoreanRoman?: () => void;
  detectedIndicLanguages?: IndicLanguageInfo[];
  onConvertToIndicRoman?: (lang?: IndicLanguageCode) => void;
  onShiftAllTimestamps?: (deltaSeconds: number) => void;
  onStartTutorial?: () => void;
  findMatches?: FindMatch[];
  activeFindMatchIndex?: number;
  findQuery?: string;
  findOptions?: FindOptions;
}

interface TimecodePillProps {
  value: number;
  precisionMode: boolean;
  onCommit: (seconds: number) => void;
  onStamp: () => void;
  onFocusRow: () => void;
  onSeek?: (time: number) => void;
  tooltipTitle: string;
  type?: 'start' | 'end';
}

const TimecodePill: React.FC<TimecodePillProps> = React.memo(({
  value,
  precisionMode,
  onCommit,
  onStamp,
  onFocusRow,
  onSeek,
  tooltipTitle,
  type = 'start',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal] = useState('');

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditVal(formatLrcTimecode(value, precisionMode));
    onFocusRow();
  };

  const handleSeek = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFocusRow();
    if (value >= 0) {
      onSeek?.(value);
    }
  };

  const handleCommit = () => {
    const parsed = parseLrcTimecode(editVal);
    if (!isNaN(parsed) && parsed >= 0) {
      onCommit(parsed);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        type="text"
        value={editVal}
        autoFocus
        onChange={(e) => setEditVal(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCommit();
          if (e.key === 'Escape') setIsEditing(false);
        }}
        className="bg-white/10 text-white font-sans text-xs px-3 py-1.5 rounded-xl outline-none border border-white/40 w-28 text-center tabular-nums shadow-inner"
      />
    );
  }

  return (
    <div
      onClick={handleSeek}
      onDoubleClick={handleStartEdit}
      title={`Jump audio to ${formatLrcTimecode(value, precisionMode)} (Double-click to edit · Click clock to stamp)`}
      className="group/pill inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-black/50 hover:bg-white/[0.08] active:scale-[0.98] border border-white/[0.1] hover:border-white/[0.3] text-zinc-200 hover:text-white transition-all cursor-pointer select-none shadow-sm"
    >
      <span className="font-sans text-xs tracking-tight tabular-nums font-semibold group-hover/pill:text-white flex items-center gap-1.5">
        <Play className="w-3 h-3 opacity-0 group-hover/pill:opacity-90 transition-opacity fill-current text-white/80" />
        {formatLrcTimecode(value, precisionMode)}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onStamp();
        }}
        title={tooltipTitle}
        className="p-0.5 text-zinc-400 hover:text-white focus:text-white focus:outline-none transition-all cursor-pointer shrink-0 active:scale-90"
      >
        {type === 'start' ? (
          <Clock className="w-5 h-5 stroke-[2.5]" />
        ) : (
          <Timer className="w-5 h-5 stroke-[2.5]" />
        )}
      </button>
    </div>
  );
});
TimecodePill.displayName = 'TimecodePill';

interface LyricRowProps {
  line: LyricLine;
  idx: number;
  isActive: boolean;
  precisionMode: boolean;
  currentTime: number;
  activeTokenIndex: number;
  peerOnThisLine?: CollabUser | null;
  setActiveLineIndex: (idx: number) => void;
  setActiveTokenIndex?: (idx: number) => void;
  onStampLineStart: (lineIdx: number, time?: number) => void;
  onStampLineEnd: (lineIdx: number, time?: number) => void;
  onUpdateLineText: (lineIdx: number, text: string) => void;
  onAddLine: (afterIdx: number) => void;
  onDeleteLine: (lineIdx: number) => void;
  onDivideLineIntoWords?: (lineIdx: number) => void;
  onTokenizeLine?: (lineIdx: number) => void;
  onSetWordToken?: (lineIdx: number, tokenIdx: number, start: number, end: number) => void;
  onSetWordTokenText?: (lineIdx: number, tokenIdx: number, text: string) => void;
  onToggleWordEmphasis?: (lineIdx: number, tokenIdx: number) => void;
  onToggleLineEmphasis?: (lineIdx: number) => void;
  onRemoveWordTokens?: (lineIdx: number) => void;
  onUpdateWordTokens?: (lineIdx: number, tokens: WordToken[]) => void;
  onSeek?: (time: number) => void;
  innerRef?: React.Ref<HTMLDivElement>;
  onInputFocusChange?: (isFocused: boolean) => void;
  onActionToast?: (message: string, onUndo?: () => void) => void;
  onUndo?: () => void;
  onSetLineVocalist?: (lineIdx: number, vocalist: string | undefined) => void;
  isHoldSyncing?: boolean;
  lineMatches?: FindMatch[];
  activeMatchId?: string;
  findQuery?: string;
  findOptions?: FindOptions;
}

function renderHighlightedText(
  text: string,
  matches: FindMatch[],
  activeMatchId?: string
): React.ReactNode {
  if (!matches || matches.length === 0) return text;
  const sorted = [...matches].sort((a, b) => a.startChar - b.startChar);
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;

  sorted.forEach((m, i) => {
    if (m.startChar > lastIndex) {
      elements.push(text.slice(lastIndex, m.startChar));
    }
    const isCurActive = m.id === activeMatchId;
    elements.push(
      <mark
        key={`match-${i}-${m.startChar}`}
        className={`rounded px-0.5 ${
          isCurActive
            ? 'bg-amber-400 text-black font-semibold ring-1 ring-amber-300 shadow-xs'
            : 'bg-amber-400/25 text-amber-200'
        }`}
      >
        {text.slice(m.startChar, m.endChar)}
      </mark>
    );
    lastIndex = m.endChar;
  });

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return <>{elements}</>;
}

const LyricRow: React.FC<LyricRowProps> = React.memo(({
  line,
  idx,
  isActive,
  precisionMode,
  currentTime,
  activeTokenIndex,
  peerOnThisLine,
  setActiveLineIndex,
  setActiveTokenIndex,
  onStampLineStart,
  onStampLineEnd,
  onUpdateLineText,
  onAddLine,
  onDeleteLine,
  onDivideLineIntoWords,
  onTokenizeLine,
  onSetWordToken,
  onSetWordTokenText,
  onToggleWordEmphasis,
  onToggleLineEmphasis,
  onRemoveWordTokens,
  onUpdateWordTokens,
  onSeek,
  innerRef,
  onInputFocusChange,
  onActionToast,
  onUndo,
  onSetLineVocalist,
  isHoldSyncing,
  lineMatches,
  activeMatchId,
  findQuery,
  findOptions,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isEditingText, setIsEditingText] = useState<boolean>(false);
  const hasTokens = Boolean(line.tokens && line.tokens.length > 0);
  const isEmphasized = Boolean(line.emphasis);
  const hasLineMatches = Boolean(lineMatches && lineMatches.length > 0);

  const searchRx = useMemo(
    () => (findQuery ? buildSearchRegex(findQuery, findOptions || { caseSensitive: false, wholeWord: false }) : null),
    [findQuery, findOptions]
  );

  // Map token spans to correlate with exact lineMatches for individual word highlighting
  const tokenSpans = useMemo(() => {
    if (!line.tokens || line.tokens.length === 0) return [];
    const spans: { startChar: number; endChar: number }[] = [];
    let cursor = 0;
    for (const token of line.tokens) {
      const rawWord = token.text;
      const foundIdx = line.text.indexOf(rawWord, cursor);
      if (foundIdx !== -1) {
        spans.push({ startChar: foundIdx, endChar: foundIdx + rawWord.length });
        cursor = foundIdx + rawWord.length;
      } else {
        spans.push({ startChar: cursor, endChar: cursor + rawWord.length });
      }
    }
    return spans;
  }, [line.tokens, line.text]);

  return (
    <div
      id={`lyric-row-${idx}`}
      ref={innerRef}
      onClick={() => {
        setActiveLineIndex(idx);
        onSeek?.(line.start);
      }}
      style={
        peerOnThisLine && !isActive
          ? {
              borderColor: `${peerOnThisLine.color}60`,
              backgroundColor: `${peerOnThisLine.color}08`,
              boxShadow: `0 0 14px ${peerOnThisLine.color}15`,
            }
          : undefined
      }
      data-tutorial={isActive ? 'active-lyric-row' : undefined}
      className={`group flex flex-col rounded-xl px-4 py-2.5 transition-all cursor-pointer scroll-mt-24 ${
        isActive
          ? 'bg-white/[0.025] border-l-2 border-l-white/80 border-y border-r border-white/[0.08] shadow-lg shadow-black/40'
          : peerOnThisLine
          ? 'border-l-2 border-l-transparent border-y border-r border-transparent ring-1 ring-white/10'
          : 'bg-transparent border-l-2 border-l-transparent border-y border-r border-transparent hover:bg-white/[0.02] hover:border-white/[0.05]'
      }`}
    >
      <div className="flex items-center gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
        {/* Line Index Number */}
        <div className="flex items-center gap-1 w-7 sm:w-8 shrink-0 select-none">
          <span
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-sans font-medium tabular-nums transition-all ${
              isActive 
                ? 'bg-white/10 text-white font-semibold border border-white/20 shadow-xs' 
                : 'text-zinc-500 bg-white/[0.02]'
            }`}
          >
            {(idx + 1).toString().padStart(2, '0')}
          </span>
        </div>

        {/* Start Timecode Pill */}
        <TimecodePill
          value={line.start}
          precisionMode={precisionMode}
          onCommit={(seconds) => onStampLineStart(idx, seconds)}
          onStamp={() => onStampLineStart(idx)}
          onFocusRow={() => {
            setActiveLineIndex(idx);
            onSeek?.(line.start);
          }}
          onSeek={onSeek}
          type="start"
          tooltipTitle="Stamp playhead start time (Tab)"
        />

        {/* End Timecode Pill */}
        <TimecodePill
          value={line.end}
          precisionMode={precisionMode}
          onCommit={(seconds) => onStampLineEnd(idx, seconds)}
          onStamp={() => onStampLineEnd(idx)}
          onFocusRow={() => {
            setActiveLineIndex(idx);
            onSeek?.(line.end);
          }}
          onSeek={onSeek}
          type="end"
          tooltipTitle="Stamp playhead end time (Shift+Tab)"
        />

        {/* Inline Lyric Text Input + Empty Space Click-to-Seek Area */}
        <div className="flex-1 flex items-center gap-2.5 min-w-[200px]">
          <div className="flex-1 flex flex-col justify-center relative min-w-0">
            {hasTokens && line.tokens && line.tokens.length > 0 && !isEditingText ? (
              <div
                data-tutorial={isActive ? 'word-tokens' : undefined}
                className="relative flex items-center gap-1.5 flex-wrap pt-2 pb-1 select-text"
                onDoubleClick={() => setIsEditingText(true)}
                title="Double-click to edit line text"
              >
                {line.tokens.map((token, tIdx) => {
                  const isWordFocused = isActive && tIdx === activeTokenIndex;
                  const isEmphasizedWord = Boolean(token.emphasis ?? line.emphasis);

                  const span = tokenSpans[tIdx];
                  const matchingMatch = lineMatches?.find(
                    (m) => span && m.startChar < span.endChar && m.endChar > span.startChar
                  );
                  const isTokenMatch = Boolean(findQuery && matchingMatch);
                  const isTokenActiveMatch = Boolean(findQuery && matchingMatch && matchingMatch.id === activeMatchId);

                  return (
                    <span
                      key={tIdx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveLineIndex(idx);
                        if (setActiveTokenIndex) setActiveTokenIndex(tIdx);
                        onSeek?.(token.start);
                      }}
                      className={`relative inline-flex items-center px-0.5 py-0.5 transition-colors cursor-pointer font-sans text-base sm:text-sm leading-normal select-none ${
                        isTokenActiveMatch
                          ? 'bg-amber-400 text-black font-semibold rounded px-1 ring-1 ring-amber-300 shadow-xs'
                          : isTokenMatch
                          ? 'bg-amber-400/25 text-amber-200 rounded px-1'
                          : isWordFocused
                          ? 'text-white font-bold'
                          : isActive
                          ? 'text-zinc-200 hover:text-white'
                          : 'text-zinc-300 hover:text-white'
                      }`}
                      title={`${token.text} (${formatLrcTimecode(token.start, precisionMode)} → ${formatLrcTimecode(token.end, precisionMode)}) · Click to seek · Double-click to edit text`}
                    >
                      {/* Down-facing arrow directly above the active word */}
                      {isWordFocused && (
                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center justify-center text-white pointer-events-none">
                          <svg
                            className="w-3.5 h-2.5 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                            viewBox="0 0 12 8"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M1.5 2 L6 6.5 L10.5 2" />
                          </svg>
                        </span>
                      )}

                      {/* Pulsing red dot if hold-syncing active */}
                      {isWordFocused && isHoldSyncing && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_red] animate-pulse mr-1 shrink-0" />
                      )}

                      <span className="relative inline-block">
                        {token.text}
                        {isEmphasizedWord && (
                          <span
                            className="absolute left-0 right-0 -bottom-1 h-1.5 pointer-events-none select-none opacity-80"
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 8' width='16' height='8'%3E%3Cpath d='M 0 4 C 2.5 1.2, 5.5 1.2, 8 4 C 10.5 6.8, 13.5 6.8, 16 4' fill='none' stroke='%23ffffff' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                              backgroundRepeat: 'repeat-x',
                              backgroundPosition: 'left center',
                            }}
                          />
                        )}
                      </span>
                    </span>
                  );
                })}
              </div>
            ) : findQuery && !isEditingText && hasLineMatches ? (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingText(true);
                  setActiveLineIndex(idx);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setIsEditingText(true);
                  setActiveLineIndex(idx);
                }}
                className={`w-full py-1.5 font-sans text-base sm:text-sm font-medium cursor-text select-text transition-colors leading-normal ${
                  isActive ? 'text-white font-semibold' : 'text-zinc-200'
                }`}
                title="Click to edit text"
              >
                {renderHighlightedText(line.text, lineMatches || [], activeMatchId)}
              </div>
            ) : (
              <input
                type="text"
                value={line.text}
                autoFocus={isEditingText}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onUpdateLineText(idx, e.target.value)}
                onFocus={() => {
                  setActiveLineIndex(idx);
                  onInputFocusChange?.(true);
                }}
                onBlur={() => {
                  setIsEditingText(false);
                  onInputFocusChange?.(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    setIsEditingText(false);
                    onInputFocusChange?.(false);
                  }
                }}
                placeholder="Enter lyric content..."
                className={`w-full bg-transparent placeholder:text-zinc-600 font-sans text-base sm:text-sm font-medium focus:outline-none py-1.5 select-text transition-colors leading-normal ${
                  isActive ? 'text-white font-semibold' : 'text-zinc-200'
                }`}
              />
            )}

            {/* Smooth Wave Underline only for plain lines without tokens */}
            {isEmphasized && (!hasTokens || !line.tokens || line.tokens.length === 0) && (
              <div
                className="w-full max-w-sm h-1.5 -mt-0.5 pointer-events-none select-none opacity-80"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 8' width='16' height='8'%3E%3Cpath d='M 0 4 C 2.5 1.2, 5.5 1.2, 8 4 C 10.5 6.8, 13.5 6.8, 16 4' fill='none' stroke='%23ffffff' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'repeat-x',
                  backgroundPosition: 'left center',
                }}
              />
            )}
          </div>

          {line.section && (
            <span className="text-[10px] font-sans font-semibold uppercase bg-white/[0.06] text-zinc-400 border border-white/[0.08] px-2 py-0.5 rounded select-none shrink-0">
              {line.section}
            </span>
          )}
          {line.vocalist && (
            <span className="text-[10px] font-sans font-semibold uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded select-none shrink-0">
              {line.vocalist}
            </span>
          )}
          {line.isBackground && (
            <span className="text-[10px] font-sans font-semibold uppercase bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded select-none shrink-0">
              BG
            </span>
          )}
          {hasTokens && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setActiveLineIndex(idx);
                setIsExpanded((prev) => !prev);
              }}
              className="opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity text-[11px] font-sans font-medium bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/[0.1] hover:border-white/20 px-2.5 py-0.5 rounded-full select-none shrink-0 cursor-pointer"
              title="Click to toggle word timing controls"
            >
              {line.tokens!.length} words
            </span>
          )}

          {/* Real-Time Collaborator Presence Badge */}
          {peerOnThisLine && (
            <div
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-sans font-medium shadow-xs shrink-0 select-none animate-in fade-in duration-150"
              style={{
                backgroundColor: `${peerOnThisLine.color}20`,
                color: peerOnThisLine.color || '#34d399',
                border: `1px solid ${peerOnThisLine.color}45`,
              }}
              title={`${peerOnThisLine.name}${peerOnThisLine.isHost ? ' (Admin)' : ''} is on this line`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: peerOnThisLine.color || '#34d399' }}
              />
              <span className="truncate max-w-[100px]">
                {peerOnThisLine.name}
                {peerOnThisLine.isHost && (
                  <span className="ml-1 text-[9px] text-amber-300 font-semibold font-sans">
                    (Admin)
                  </span>
                )}
              </span>
              {peerOnThisLine.isSyncing && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 ml-0.5 animate-pulse" />
              )}
            </div>
          )}
        </div>

        {/* Quick Row Actions Floating Toolbar */}
        <div
          className="flex items-center gap-1 bg-black/60 border border-white/[0.08] p-0.5 rounded-xl backdrop-blur-md transition-opacity opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto shrink-0"
        >
          {onSetLineVocalist && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const roles = [undefined, 'Lead', 'Partner', 'Backing'] as const;
                const cur = roles.indexOf(line.vocalist as typeof roles[number]);
                const next = roles[(cur + 1) % roles.length];
                onSetLineVocalist(idx, next);
              }}
              title={line.vocalist ? `Vocalist: ${line.vocalist} (click to change)` : 'Set vocalist'}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer text-[9px] font-bold ${
                line.vocalist
                  ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/35'
                  : 'text-zinc-500 hover:text-indigo-300 hover:bg-indigo-500/15'
              }`}
            >
              {line.vocalist ? line.vocalist.slice(0, 2).toUpperCase() : (
                <span className="material-symbols-outlined text-[13px]">person</span>
              )}
            </button>
          )}

          {/* Wave Underline Emphasis Toggle */}
          {onToggleLineEmphasis && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleLineEmphasis(idx);
                setActiveLineIndex(idx);
              }}
              title={isEmphasized ? 'Remove squiggle emphasis' : 'Add squiggle emphasis'}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                isEmphasized
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <span className="material-symbols-outlined text-[15px] font-semibold">
                gesture
              </span>
            </button>
          )}

          {/* Expand / Collapse Word Timing Controls */}
          {hasTokens && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveLineIndex(idx);
                setIsExpanded((prev) => !prev);
              }}
              title={isExpanded ? 'Collapse to simple mode' : 'Expand detailed word controls'}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                isExpanded
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {isExpanded ? (
                <Minimize2 className="w-3.5 h-3.5 stroke-[2]" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 stroke-[2]" />
              )}
            </button>
          )}

          {/* Tokenize Line (if no tokens yet) */}
          {onTokenizeLine && !hasTokens && line.text.trim().length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTokenizeLine(idx);
                setActiveLineIndex(idx);
              }}
              title="Split line into word tokens"
              className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white transition-all cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 stroke-[2]" />
              <span className="text-[11px]">Sync Words</span>
            </button>
          )}

          {/* Divide Sentence into Rows */}
          {onDivideLineIntoWords && tokenizeLineIntoWords(line.text).length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDivideLineIntoWords(idx);
                onActionToast?.('Sentence divided into separate rows', onUndo);
              }}
              title="Split sentence into separate lines"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Scissors className="w-3.5 h-3.5 stroke-[2]" />
            </button>
          )}

          {/* Add Line Below */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddLine(idx);
            }}
            title="Add new line below"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2]" />
          </button>

          {/* Delete Line */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteLine(idx);
              onActionToast?.('Line deleted', onUndo);
            }}
            title="Delete line"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 stroke-[2]" />
          </button>
        </div>
      </div>

      {/* Expanded Mode: Full detailed WordTokenEditor with timecode inputs and collapse toggle */}
      {isActive && hasTokens && line.tokens && isExpanded && onSetWordToken && onSetWordTokenText && onRemoveWordTokens && onUpdateWordTokens && (
        <WordTokenEditor
          lineIndex={idx}
          tokens={line.tokens}
          currentTime={currentTime}
          activeTokenIndex={activeTokenIndex}
          setActiveTokenIndex={(tIdx) => {
            setActiveLineIndex(idx);
            if (setActiveTokenIndex) setActiveTokenIndex(tIdx);
          }}
          onSetWordToken={onSetWordToken}
          onSetWordTokenText={onSetWordTokenText}
          onToggleWordEmphasis={onToggleWordEmphasis}
          onRemoveTokens={onRemoveWordTokens}
          onUpdateTokens={onUpdateWordTokens}
          onSeek={onSeek}
          precisionMode={precisionMode}
          isHoldSyncing={isHoldSyncing}
          onCollapse={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
}, (prev, next) => {
  if (prev.isActive !== next.isActive) return false;
  if (prev.isActive && next.isActive && prev.currentTime !== next.currentTime) return false;
  if (prev.isActive && next.isActive && prev.activeTokenIndex !== next.activeTokenIndex) return false;
  if (prev.isHoldSyncing !== next.isHoldSyncing) return false;
  if (prev.peerOnThisLine?.id !== next.peerOnThisLine?.id) return false;
  if (prev.peerOnThisLine?.name !== next.peerOnThisLine?.name) return false;
  if (prev.peerOnThisLine?.color !== next.peerOnThisLine?.color) return false;
  if (prev.peerOnThisLine?.isSyncing !== next.peerOnThisLine?.isSyncing) return false;
  if (prev.line !== next.line) return false;
  if (prev.line.vocalist !== next.line.vocalist) return false;
  if (prev.precisionMode !== next.precisionMode) return false;
  return true;
});
LyricRow.displayName = 'LyricRow';

export const LyricEditor: React.FC<LyricEditorProps> = React.memo(({
  lines,
  activeLineIndex,
  setActiveLineIndex,
  currentTime = 0,
  activeTokenIndex = 0,
  setActiveTokenIndex,
  collabPeers = [],
  onStampLineStart,
  onStampLineEnd,
  onUpdateLineText,
  onAddLine,
  onDeleteLine,
  onDivideLineIntoWords,
  onDivideAllLines,
  onTokenizeLine,
  onBatchTokenizeAll,
  onSetWordToken,
  onSetWordTokenText,
  onToggleWordEmphasis,
  onToggleLineEmphasis,
  onRemoveWordTokens,
  onUpdateWordTokens,
  onSeek,
  precisionMode = false,
  autoFollowPlayhead = true,
  onToggleAutoFollow,
  onInputFocusChange,
  onActionToast,
  onUndo,
  onSetLineVocalist,
  isHoldSyncing,
  onTriggerImport,
  onOpenPasteLyrics,
  onImportFile,
  onConvertToRomaji,
  onConvertToRomanHindi,
  onConvertToKoreanRoman,
  detectedIndicLanguages,
  onConvertToIndicRoman,
  onShiftAllTimestamps,
  onStartTutorial,
  findMatches,
  activeFindMatchIndex,
  findQuery,
  findOptions,
}) => {
  const activeRowRef = React.useRef<HTMLDivElement>(null);
  const [isBoxDragOver, setIsBoxDragOver] = useState(false);
  const dropFileInputRef = React.useRef<HTMLInputElement>(null);

  const matchesByLine = useMemo(() => {
    const map = new Map<number, FindMatch[]>();
    if (!findMatches || findMatches.length === 0) return map;
    for (const m of findMatches) {
      const list = map.get(m.lineIndex) || [];
      list.push(m);
      map.set(m.lineIndex, list);
    }
    return map;
  }, [findMatches]);

  const activeMatchId = useMemo(() => {
    if (!findMatches || activeFindMatchIndex === undefined) return undefined;
    return findMatches[activeFindMatchIndex]?.id;
  }, [findMatches, activeFindMatchIndex]);

  const handleBoxDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsBoxDragOver(true);
  };

  const handleBoxDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsBoxDragOver(false);
  };

  const handleBoxDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsBoxDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (onImportFile) {
        onImportFile(file);
      } else {
        onTriggerImport?.();
      }
    }
  };

  const handleBoxClick = () => {
    if (onTriggerImport) {
      onTriggerImport();
    } else {
      dropFileInputRef.current?.click();
    }
  };

  const handleDropFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (onImportFile) {
        onImportFile(file);
      }
      e.target.value = '';
    }
  };

  // P1 perf: sequential advances scroll instantly ('auto'); only jumps seek smoothly.
  const lastScrolledRowRef = React.useRef<number>(-1);
  React.useEffect(() => {
    if (autoFollowPlayhead && activeRowRef.current) {
      const sequential = activeLineIndex === lastScrolledRowRef.current + 1;
      lastScrolledRowRef.current = activeLineIndex;
      activeRowRef.current.scrollIntoView({
        behavior: sequential ? 'auto' : 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex, autoFollowPlayhead]);

  return (
    <div className="flex-1 flex flex-col bg-transparent h-full overflow-hidden select-none">
      {/* Sleek Minimalist Header Toolbar */}
      <div className="h-12 bg-white/[0.02] border-b border-white/[0.06] px-4 sm:px-6 flex items-center justify-between shrink-0 overflow-x-auto no-scrollbar gap-2">
        <div className="hidden sm:flex items-center gap-6 text-xs font-semibold text-zinc-400 uppercase tracking-wider font-sans shrink-0">
        
          <span className={precisionMode ? 'w-28 text-left' : 'w-24 text-left'}>Start</span>
          <span className={precisionMode ? 'w-28 text-left' : 'w-24 text-left'}>End</span>
          <span>Lyrics</span>
        </div>

        <div className="flex items-center gap-2 shrink-0 overflow-x-auto no-scrollbar py-1">
          {/* Auto-Follow Playhead Toggle */}
          {onToggleAutoFollow && (
            <button
              type="button"
              onClick={() => onToggleAutoFollow(!autoFollowPlayhead)}
              title={autoFollowPlayhead ? 'Auto-scroll active' : 'Auto-scroll paused'}
              className={`h-8 flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0 ${
                autoFollowPlayhead
                  ? 'bg-white text-zinc-950 font-bold shadow-sm'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/[0.06]'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 stroke-[2] ${autoFollowPlayhead ? 'text-zinc-950' : ''}`} />
              <span>Follow Playhead</span>
            </button>
          )}

          {/* Align Line 1 to Playhead */}
          {lines.length > 0 && currentTime > 0 && onShiftAllTimestamps && (
            <button
              type="button"
              onClick={() => {
                const delta = currentTime - lines[0].start;
                onShiftAllTimestamps(delta);
                const deltaMs = Math.round(delta * 1000);
                onActionToast?.(
                  `Aligned line 1 to playhead (${currentTime.toFixed(2)}s, shifted ${deltaMs > 0 ? `+${deltaMs}` : deltaMs}ms)`,
                  onUndo
                );
              }}
              title={`Shift all lyrics so Line 1 starts at current playhead position (${currentTime.toFixed(2)}s)`}
              className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 text-zinc-200 hover:text-white text-xs font-medium transition-all cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[15px] text-zinc-400">vertical_align_top</span>
              <span className="hidden sm:inline">Align to Playhead</span>
            </button>
          )}

          {onBatchTokenizeAll && (
            <button
              onClick={onBatchTokenizeAll}
              title="Tokenize all lines"
              className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 text-zinc-200 text-xs font-medium transition-all cursor-pointer shrink-0"
            >
              <Layers className="w-3.5 h-3.5 stroke-[2]" />
              <span className="hidden sm:inline">Enable Word Sync</span>
            </button>
          )}

          {onDivideAllLines && (
            <button
              onClick={onDivideAllLines}
              title="Split lines into words"
              className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 text-zinc-200 text-xs font-medium transition-all cursor-pointer shrink-0"
            >
              <Scissors className="w-3.5 h-3.5 stroke-[2]" />
              <span className="hidden sm:inline">Split into Words</span>
            </button>
          )}

          {onConvertToRomaji && (
            <button
              type="button"
              onClick={onConvertToRomaji}
              title="Convert Japanese lyrics to Romaji"
              className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-gradient-to-r from-rose-500/15 to-pink-500/15 hover:from-rose-500/25 hover:to-pink-500/25 border border-rose-500/30 hover:border-rose-500/50 text-rose-200 hover:text-white text-xs font-semibold transition-all cursor-pointer shrink-0"
            >
              <span className="text-[10px] font-sans px-1 py-0.2 rounded bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold">
                あ → Ro
              </span>
              <span className="hidden sm:inline">Convert to Romaji</span>
            </button>
          )}

          {/* Indic Transliteration Buttons */}
          {detectedIndicLanguages && detectedIndicLanguages.length > 0 ? (
            detectedIndicLanguages.map((langInfo) => (
              <button
                key={langInfo.code}
                type="button"
                onClick={() => onConvertToIndicRoman?.(langInfo.code)}
                title={`Convert ${langInfo.name} lyrics (${langInfo.nativeName}) to Roman script`}
                className={`h-8 flex items-center gap-1.5 px-3 rounded-lg bg-gradient-to-r ${langInfo.colorGradient} border ${langInfo.borderColor} ${langInfo.textColor} text-xs font-semibold transition-all cursor-pointer shrink-0`}
              >
                <span className={`text-[10px] font-sans px-1 py-0.2 rounded ${langInfo.badgeBg} font-bold`}>
                  {langInfo.glyphSample} → Ro
                </span>
                <span className="hidden sm:inline">Convert to Roman {langInfo.name}</span>
              </button>
            ))
          ) : (
            onConvertToRomanHindi && (
              <button
                type="button"
                onClick={onConvertToRomanHindi}
                title="Convert Hindi lyrics to Roman Hindi"
                className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-gradient-to-r from-amber-500/15 to-orange-500/15 hover:from-amber-500/25 hover:to-orange-500/25 border border-amber-500/30 hover:border-amber-500/50 text-amber-200 hover:text-white text-xs font-semibold transition-all cursor-pointer shrink-0"
              >
                <span className="text-[10px] font-sans px-1 py-0.2 rounded bg-amber-500/25 text-amber-300 border border-amber-500/30 font-bold">
                  अ → Ro
                </span>
                <span className="hidden sm:inline">Convert to Roman Hindi</span>
              </button>
            )
          )}

          {onConvertToKoreanRoman && (
            <button
              type="button"
              onClick={onConvertToKoreanRoman}
              title="Convert Korean Hangul lyrics to Romanization"
              className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-gradient-to-r from-violet-500/15 to-purple-500/15 hover:from-violet-500/25 hover:to-purple-500/25 border border-violet-500/30 hover:border-violet-500/50 text-violet-200 hover:text-white text-xs font-semibold transition-all cursor-pointer shrink-0"
            >
              <span className="text-[10px] font-sans px-1 py-0.2 rounded bg-violet-500/25 text-violet-300 border border-violet-500/30 font-bold">
                한 → Ro
              </span>
              <span className="hidden sm:inline">Convert to Roman Korean</span>
            </button>
          )}

          <button
            onClick={() => onAddLine(lines.length - 1)}
            className="h-8 flex items-center gap-1.5 px-3.5 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-bold transition-all shadow-md shadow-white/5 active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Line</span>
          </button>
        </div>
      </div>

      {/* Main Lyric Data Rows Grid (High Performance Virtualized Layout) */}
      <div data-tutorial="lyric-rows" className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar space-y-1.5 flex flex-col">
        {lines.length === 0 ? (
          <div className="flex-1 min-h-[420px] flex flex-col items-center justify-center text-center p-6 select-none my-auto w-full max-w-xl mx-auto">
            {/* Interactive Drop & Import Hero Card */}
            <div
              onDragOver={handleBoxDragOver}
              onDragLeave={handleBoxDragLeave}
              onDrop={handleBoxDrop}
              onClick={handleBoxClick}
              className={`group relative w-full p-8 sm:p-10 rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer flex flex-col items-center ${
                isBoxDragOver
                  ? 'border-indigo-400 bg-indigo-500/[0.08] shadow-[0_0_35px_rgba(99,102,241,0.2)] scale-[1.01]'
                  : 'border-white/[0.12] hover:border-white/[0.25] bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
            >
              <input
                ref={dropFileInputRef}
                type="file"
                accept=".lrc,.olrc,.elrc,.ttml,.xml,.json,.txt"
                onChange={handleDropFileInputChange}
                className="hidden"
              />

              <div
                className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-4 transition-all duration-200 ${
                  isBoxDragOver
                    ? 'bg-indigo-500/25 border-indigo-400/60 text-indigo-300'
                    : 'bg-white/[0.04] border-white/[0.08] text-zinc-400 group-hover:text-white group-hover:scale-105 group-hover:border-white/[0.2]'
                }`}
              >
                <FileUp className="w-6 h-6 stroke-[2]" />
              </div>

              <h3 className="text-base sm:text-lg font-bold text-zinc-100 mb-1.5 tracking-tight group-hover:text-white transition-colors">
                Drag and drop your lyrics files here
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm mb-6 leading-relaxed">
                Drop your <span className="text-zinc-200 font-medium">.lrc</span>, <span className="text-zinc-200 font-medium">.txt</span>, <span className="text-zinc-200 font-medium">.json</span>, or <span className="text-zinc-200 font-medium">.ttml</span> file here, or click to browse
              </p>

              {/* Actions row accompanied together in the centre */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddLine(-1);
                  }}
                  className="h-9 px-4 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-bold transition-all shadow-md shadow-white/10 active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Add First Line</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBoxClick();
                  }}
                  className="h-9 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-zinc-200 hover:text-white border border-white/[0.1] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 shrink-0"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Browse File</span>
                </button>

                {onOpenPasteLyrics && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPasteLyrics();
                    }}
                    className="h-9 px-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.08] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 shrink-0"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Got lyrics already? Paste it here</span>
                  </button>
                )}

                {/* Interactive 2-minute Tutorial Button (Gated) */}
                {onStartTutorial && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartTutorial();
                    }}
                    className="h-9 px-3.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 shrink-0"
                    title="2-minute interactive guided tour with demo song Jess Glynne - Hold My Hand"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Take Tutorial (2 mins)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          (() => {
            const seenKeys = new Set<string>();
            return lines.map((line, idx) => {
              const isActive = idx === activeLineIndex;
              const peerOnThisLine = collabPeers.find((p) => p.activeLineIndex === idx) || null;
              let rowKey = String(line.id !== undefined && line.id !== null && line.id !== '' ? line.id : `line-${idx}`);
              if (seenKeys.has(rowKey)) {
                rowKey = `${rowKey}_${idx}`;
              }
              seenKeys.add(rowKey);

              return (
                <LyricRow
                  key={rowKey}
                  line={line}
                  idx={idx}
                isActive={isActive}
                peerOnThisLine={peerOnThisLine}
                innerRef={isActive ? activeRowRef : undefined}
                precisionMode={precisionMode}
                currentTime={currentTime}
                activeTokenIndex={activeTokenIndex}
                setActiveLineIndex={setActiveLineIndex}
                setActiveTokenIndex={setActiveTokenIndex}
                onStampLineStart={onStampLineStart}
                onStampLineEnd={onStampLineEnd}
                onUpdateLineText={onUpdateLineText}
                onAddLine={onAddLine}
                onDeleteLine={onDeleteLine}
                onDivideLineIntoWords={onDivideLineIntoWords}
                onTokenizeLine={onTokenizeLine}
                onSetWordToken={onSetWordToken}
                onSetWordTokenText={onSetWordTokenText}
                onToggleWordEmphasis={onToggleWordEmphasis}
                onToggleLineEmphasis={onToggleLineEmphasis}
                onRemoveWordTokens={onRemoveWordTokens}
                onUpdateWordTokens={onUpdateWordTokens}
                onSeek={onSeek}
                onInputFocusChange={onInputFocusChange}
                onActionToast={onActionToast}
                onUndo={onUndo}
                onSetLineVocalist={onSetLineVocalist}
                isHoldSyncing={isHoldSyncing}
                lineMatches={matchesByLine.get(idx)}
                activeMatchId={activeMatchId}
                findQuery={findQuery}
                findOptions={findOptions}
              />
            );
          });
        })()
      )}
      </div>
    </div>
  );
});
LyricEditor.displayName = 'LyricEditor';

