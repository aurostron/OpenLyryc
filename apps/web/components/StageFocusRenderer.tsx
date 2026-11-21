'use client';

import React, { useMemo } from 'react';
import type { LyricLine } from '@/types/lyrics';
import {
  LyricWordFill,
  getLineSequentialWords,
  isComplexScript,
} from '@/components/LyricRenderer';

interface StageFocusRendererProps {
  lines: LyricLine[];
  currentTime: number;
  onSeek?: (time: number) => void;
  stageStyle?: React.CSSProperties;
}

const SolidMusicNote: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={`inline-block select-none animate-pulse ${className}`}
    aria-hidden="true"
  >
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
  </svg>
);

export const StageFocusRenderer: React.FC<StageFocusRendererProps> = ({
  lines,
  currentTime,
  onSeek,
  stageStyle,
}) => {
  const parsedLines = useMemo(() => {
    return lines.map((line, idx) => ({
      line,
      words: getLineSequentialWords(line),
      isComplex: isComplexScript(line.text),
      idx,
    }));
  }, [lines]);

  const activeLineIndex = useMemo(() => {
    if (lines.length === 0) return -1;
    for (let i = 0; i < lines.length; i++) {
      if (currentTime >= lines[i].start && currentTime <= lines[i].end) {
        return i;
      }
    }
    return -1;
  }, [lines, currentTime]);

  const activeLineItem = activeLineIndex >= 0 ? parsedLines[activeLineIndex] : undefined;

  const activeGap = useMemo(() => {
    if (lines.length === 0) return null;
    if (currentTime < lines[0].start && lines[0].start >= 2.5) {
      return { start: 0, end: lines[0].start };
    }
    if (activeLineIndex >= 0 && activeLineIndex < lines.length - 1) {
      const curLine = lines[activeLineIndex];
      const nextLine = lines[activeLineIndex + 1];
      if (
        currentTime >= curLine.end &&
        currentTime < nextLine.start &&
        nextLine.start - curLine.end >= 2.5
      ) {
        return { start: curLine.end, end: nextLine.start };
      }
    }
    return null;
  }, [lines, currentTime, activeLineIndex]);

  return (
    <div className="absolute inset-0 flex items-center justify-center p-8 overflow-hidden text-center w-full">
      {/* Ambient Stage Focus Radial Backlight */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.015)_50%,transparent_80%)] pointer-events-none filter blur-2xl -z-10"
      />
      {activeLineItem && !activeGap ? (
        <div className="w-full flex items-center justify-center px-4 overflow-visible">
          <div
            onClick={() => onSeek && onSeek(activeLineItem.line.start)}
            style={
              stageStyle && !activeLineItem.isComplex
                ? stageStyle
                : stageStyle?.fontWeight !== undefined
                ? { fontWeight: stageStyle.fontWeight }
                : undefined
            }
            className={`flex flex-wrap items-baseline ${
              activeLineItem.isComplex ? 'gap-x-0 gap-y-3' : 'gap-x-2 gap-y-3'
            } font-black text-white leading-[1.3] font-sans max-w-5xl overflow-visible cursor-pointer transition-transform duration-300 ${
              activeLineItem.isComplex ? 'tracking-normal' : 'tracking-[-0.045em]'
            } ${
              activeLineItem.line.vocalist === 'Partner'
                ? 'justify-end text-right translate-x-4 sm:translate-x-12 text-4xl sm:text-5xl md:text-6xl lg:text-7xl'
                : activeLineItem.line.vocalist === 'Backing'
                ? 'justify-center text-center text-4xl sm:text-5xl md:text-6xl lg:text-7xl opacity-80 italic'
                : 'justify-center text-center text-5xl sm:text-6xl md:text-7xl lg:text-8xl'
            }`}
          >
            {activeLineItem.words.map((word, wIdx) => {
              let wordProgress = 0;
              if (currentTime >= word.end) {
                wordProgress = 1;
              } else if (currentTime > word.start && currentTime < word.end) {
                wordProgress =
                  (currentTime - word.start) / Math.max(0.01, word.end - word.start);
              }

              return (
                <LyricWordFill
                  key={wIdx}
                  word={word}
                  wordProgress={wordProgress}
                  isActive={true}
                  isPast={false}
                  textSizeClass={
                    word.isBracketed ? 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl' : ''
                  }
                  onSeek={onSeek}
                  stageStyle={stageStyle}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center select-none animate-in fade-in zoom-in-95 duration-300">
          <SolidMusicNote className="w-9 h-9 sm:w-10 sm:h-10 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.35)]" />
        </div>
      )}
    </div>
  );
};
