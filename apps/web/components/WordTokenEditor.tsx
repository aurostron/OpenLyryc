'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { WordToken } from '@/types/lyrics';
import { formatLrcTimecode, parseLrcTimecode } from '@/lib/lrcParser';
import { Clock, Trash2, Layers, Minimize2 } from 'lucide-react';

interface WordTokenEditorProps {
  lineIndex: number;
  tokens: WordToken[];
  currentTime: number;
  activeTokenIndex: number;
  setActiveTokenIndex: (idx: number) => void;
  onSetWordToken: (lineIdx: number, tokenIdx: number, start: number, end: number) => void;
  onSetWordTokenText: (lineIdx: number, tokenIdx: number, text: string) => void;
  onToggleWordEmphasis?: (lineIdx: number, tokenIdx: number) => void;
  onRemoveTokens: (lineIdx: number) => void;
  onUpdateTokens?: (lineIdx: number, tokens: WordToken[]) => void;
  onSeek?: (time: number) => void;
  precisionMode?: boolean;
  isHoldSyncing?: boolean;
  onCollapse?: () => void;
}

export const WordTokenEditor: React.FC<WordTokenEditorProps> = ({
  lineIndex,
  tokens,
  currentTime,
  activeTokenIndex,
  setActiveTokenIndex,
  onSetWordToken,
  onSetWordTokenText,
  onToggleWordEmphasis,
  onRemoveTokens,
  onSeek,
  precisionMode = false,
  isHoldSyncing = false,
  onCollapse,
}) => {
  const [editingTokenIdx, setEditingTokenIdx] = useState<number | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [editingTimeIdx, setEditingTimeIdx] = useState<{ idx: number; type: 'start' | 'end' } | null>(null);
  const [timeInputVal, setTimeInputVal] = useState<string>('');

  const handleStartTextEdit = (idx: number, currentText: string) => {
    setEditingTokenIdx(idx);
    setEditingText(currentText);
  };

  const handleSaveTextEdit = (idx: number) => {
    if (editingText.trim()) {
      onSetWordTokenText(lineIndex, idx, editingText.trim());
    }
    setEditingTokenIdx(null);
  };

  const handleStampTokenStart = (idx: number) => {
    const token = tokens[idx];
    const newStart = currentTime;
    const newEnd = Math.max(newStart + 0.1, token.end);
    onSetWordToken(lineIndex, idx, newStart, newEnd);
    setActiveTokenIndex(Math.min(tokens.length - 1, idx + 1));
  };

  const handleTimeCommit = (idx: number, type: 'start' | 'end') => {
    const parsed = parseLrcTimecode(timeInputVal);
    if (!isNaN(parsed)) {
      const token = tokens[idx];
      if (type === 'start') {
        onSetWordToken(lineIndex, idx, parsed, Math.max(parsed + 0.05, token.end));
      } else {
        onSetWordToken(lineIndex, idx, Math.min(token.start, parsed - 0.05), parsed);
      }
    }
    setEditingTimeIdx(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.16 }}
      className="bg-[#0b0b0e]/95 border border-white/[0.1] rounded-xl px-4 py-3 my-2 flex flex-col gap-3 shadow-xl shadow-black/50 backdrop-blur-xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Sleek Sub-Header */}
      <div className="flex items-center justify-between text-xs pb-1 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.08] border border-white/[0.1] text-white font-medium text-[11px]">
            <Layers className="w-3.5 h-3.5 text-zinc-300 stroke-[2.25]" />
            <span>Word Sync ({tokens.length})</span>
          </div>
          <span className="text-zinc-400 text-[11px] font-sans hidden sm:inline-flex items-center gap-1.5">
            <span>Tap</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-sans text-[10px] font-bold">A</kbd>
            <span>to stamp</span>
            <span className="text-zinc-600">·</span>
            <span>Click</span>
            <span className="material-symbols-outlined text-[13px] inline-block align-middle text-white bg-white/10 px-1 py-0.5 rounded">gesture</span>
            <span title="Marks a word as held or drawn out — for melisma or sustained notes">for vocal flourish</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] text-zinc-300 hover:text-white text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-white/[0.08] hover:border-white/20"
              title="Collapse to simple mode"
            >
              <Minimize2 className="w-3 h-3 stroke-[2.2]" />
              <span>Collapse</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onRemoveTokens(lineIndex)}
            className="px-2.5 py-1 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-400 text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Remove word tokens"
          >
            <Trash2 className="w-3.5 h-3.5 stroke-[2]" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Word Token Chips Flow */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {tokens.map((token, tIdx) => {
          const isFocused = tIdx === activeTokenIndex;
          const isSinging = currentTime >= token.start && currentTime < token.end;
          const isPassed = currentTime >= token.end;
          const isEmphasized = Boolean(token.emphasis);

          let progress = 0;
          if (isPassed) progress = 1;
          else if (isSinging) {
            progress = (currentTime - token.start) / Math.max(0.01, token.end - token.start);
          }

          const fillPct = (progress * 100).toFixed(0);

          return (
            <motion.div
              key={tIdx}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setActiveTokenIndex(tIdx);
                onSeek?.(token.start);
              }}
              className={`group relative flex flex-col items-center rounded-xl px-3.5 py-2 cursor-pointer select-none border transition-all ${
                isFocused
                  ? 'bg-white/[0.12] text-white border-white/40 shadow-lg shadow-black/40 ring-1 ring-white/20'
                  : isEmphasized
                  ? 'bg-white/[0.06] text-zinc-100 border-white/20 hover:border-white/35 hover:bg-white/[0.09]'
                  : 'bg-white/[0.025] text-zinc-300 border-white/[0.06] hover:border-white/20 hover:bg-white/[0.05]'
              }`}
            >
              {/* Down-facing > pointer above active word */}
              {isFocused && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center justify-center text-white pointer-events-none">
                  <svg
                    className="w-2.5 h-2 text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                    viewBox="0 0 10 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 1.5 L5 5.5 L9 1.5" />
                  </svg>
                </div>
              )}

              {isFocused && isHoldSyncing && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_6px_red] animate-pulse" />
              )}

              {/* Active Singing Progress Bar */}
              {progress > 0 && !isFocused && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-white transition-all duration-75 overflow-hidden"
                >
                  <div
                    className="h-full bg-white shadow-[0_0_8px_white]"
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
              )}

              {/* Word Text / Inline Edit */}
              <div className="flex items-center gap-1.5">
                {editingTokenIdx === tIdx ? (
                  <input
                    type="text"
                    value={editingText}
                    autoFocus
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={() => handleSaveTextEdit(tIdx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTextEdit(tIdx);
                      if (e.key === 'Escape') setEditingTokenIdx(null);
                    }}
                    className="bg-transparent font-bold outline-none border-b border-current w-16 text-center text-xs py-0"
                  />
                ) : (
                  <div className="relative flex flex-col items-center">
                    <span
                      onDoubleClick={() => handleStartTextEdit(tIdx, token.text)}
                      className={`font-semibold tracking-normal font-sans text-xs ${
                        isFocused ? 'text-white font-bold' : 'text-zinc-200'
                      }`}
                      title="Double-click to edit text"
                    >
                      {token.text}
                    </span>

                    {/* Uniform Smooth Wave Underline */}
                    {isEmphasized && (
                      <div
                        className={`w-full min-w-[20px] h-1.5 mt-1 pointer-events-none select-none ${
                          isFocused ? 'opacity-90' : 'opacity-60'
                        }`}
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 8' width='16' height='8'%3E%3Cpath d='M 0 4 C 2.5 1.2, 5.5 1.2, 8 4 C 10.5 6.8, 13.5 6.8, 16 4' fill='none' stroke='%23ffffff' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                          backgroundRepeat: 'repeat-x',
                          backgroundPosition: 'left center',
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Emphasis Toggle Button */}
                {onToggleWordEmphasis && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWordEmphasis(lineIndex, tIdx);
                    }}
                    title={isEmphasized ? 'Remove squiggle emphasis' : 'Add squiggle emphasis'}
                    className={`p-1 rounded-md transition-all flex items-center justify-center cursor-pointer ${
                      isEmphasized
                        ? isFocused
                          ? 'bg-white/20 text-white shadow-xs border border-white/30'
                          : 'bg-white/10 text-white shadow-xs border border-white/20'
                        : isFocused
                        ? 'text-zinc-300 hover:text-white hover:bg-white/10'
                        : 'text-zinc-400 hover:text-white hover:bg-white/10 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px] font-semibold">
                      gesture
                    </span>
                  </button>
                )}

                {/* Quick Stamp Icon Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStampTokenStart(tIdx);
                  }}
                  title="Stamp current playhead time (Hotkey: A)"
                  className={`p-0.5 transition-all flex items-center justify-center cursor-pointer active:scale-90 ${
                    isFocused
                      ? 'text-white/80 hover:text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Clock className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Clean Timecode Label */}
              <div
                className={`text-[9.5px] tabular-nums font-sans tracking-tight mt-1 flex items-center gap-1 ${
                  isFocused ? 'text-zinc-300 font-medium' : 'text-zinc-400'
                }`}
              >
                {editingTimeIdx?.idx === tIdx && editingTimeIdx.type === 'start' ? (
                  <input
                    type="text"
                    value={timeInputVal}
                    autoFocus
                    onChange={(e) => setTimeInputVal(e.target.value)}
                    onBlur={() => handleTimeCommit(tIdx, 'start')}
                    onKeyDown={(e) => e.key === 'Enter' && handleTimeCommit(tIdx, 'start')}
                    className="w-12 bg-transparent text-center border-b border-current outline-none text-[9.5px]"
                  />
                ) : (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTimeIdx({ idx: tIdx, type: 'start' });
                      setTimeInputVal(formatLrcTimecode(token.start, precisionMode));
                    }}
                    className="hover:underline cursor-pointer"
                    title="Edit start time"
                  >
                    {formatLrcTimecode(token.start, precisionMode)}
                  </span>
                )}

                <span className="opacity-40">→</span>

                {editingTimeIdx?.idx === tIdx && editingTimeIdx.type === 'end' ? (
                  <input
                    type="text"
                    value={timeInputVal}
                    autoFocus
                    onChange={(e) => setTimeInputVal(e.target.value)}
                    onBlur={() => handleTimeCommit(tIdx, 'end')}
                    onKeyDown={(e) => e.key === 'Enter' && handleTimeCommit(tIdx, 'end')}
                    className="w-12 bg-transparent text-center border-b border-current outline-none text-[9.5px]"
                  />
                ) : (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTimeIdx({ idx: tIdx, type: 'end' });
                      setTimeInputVal(formatLrcTimecode(token.end, precisionMode));
                    }}
                    className="hover:underline cursor-pointer"
                    title="Edit end time"
                  >
                    {formatLrcTimecode(token.end, precisionMode)}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};
