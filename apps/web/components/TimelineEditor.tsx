'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { LyricLine } from '@/types/lyrics';
import { ZoomIn, ZoomOut, ChevronDown, ChevronUp, Music, Layers } from 'lucide-react';

interface TimelineEditorProps {
  lines: LyricLine[];
  activeLineIndex: number | null;
  onSelectLine: (index: number) => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onUpdateLineTiming: (lineIndex: number, start: number, end: number) => void;
  onSetWordToken?: (lineIndex: number, tokenIndex: number, start: number, end: number) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  isPlaying?: boolean;
}

export const TimelineEditor: React.FC<TimelineEditorProps> = React.memo(({
  lines,
  activeLineIndex,
  onSelectLine,
  currentTime,
  duration,
  onSeek,
  onUpdateLineTiming,
  onSetWordToken,
  isOpen,
  onToggleOpen,
  isPlaying = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackScrollRef = useRef<HTMLDivElement>(null);

  // Zoom: pixels per second (min 20, max 200, default 45)
  const [zoom, setZoom] = useState<number>(45);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState<boolean>(false);
  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);
  const [draggingClip, setDraggingClip] = useState<{
    lineIndex: number;
    mode: 'move' | 'trim-start' | 'trim-end';
    initialX: number;
    initialStart: number;
    initialEnd: number;
  } | null>(null);

  const [draggingToken, setDraggingToken] = useState<{
    lineIndex: number;
    tokenIndex: number;
    mode: 'move' | 'trim-start' | 'trim-end';
    initialX: number;
    initialStart: number;
    initialEnd: number;
    lineStart: number;
    lineEnd: number;
  } | null>(null);

  const effectiveDuration = useMemo(() => {
    if (duration > 0) return duration;
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      return Math.max(lastLine.end + 5, 120);
    }
    return 180;
  }, [duration, lines]);

  const totalWidth = useMemo(() => {
    return Math.max(effectiveDuration * zoom, 900);
  }, [effectiveDuration, zoom]);

  // Handle Playhead Scrubbing
  const handleTimelineMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (
      (e.target as HTMLElement).closest('.clip-handle') ||
      (e.target as HTMLElement).closest('.timeline-clip') ||
      (e.target as HTMLElement).closest('.token-chip') ||
      (e.target as HTMLElement).closest('.token-handle')
    ) {
      return;
    }
    const rect = trackScrollRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickX = e.clientX - rect.left + (trackScrollRef.current?.scrollLeft || 0);
    const targetTime = Math.max(0, Math.min(clickX / zoom, effectiveDuration));
    onSeek(targetTime);
    setIsDraggingPlayhead(true);
  }, [zoom, effectiveDuration, onSeek]);

  // Global mouse move and mouse up for scrubbing, dragging line clips, and dragging sub-word tokens
  useEffect(() => {
    if (!isDraggingPlayhead && !draggingClip && !draggingToken) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingPlayhead) {
        const rect = trackScrollRef.current?.getBoundingClientRect();
        if (!rect) return;
        const clickX = e.clientX - rect.left + (trackScrollRef.current?.scrollLeft || 0);
        const targetTime = Math.max(0, Math.min(clickX / zoom, effectiveDuration));
        onSeek(targetTime);
      } else if (draggingClip) {
        const deltaX = e.clientX - draggingClip.initialX;
        const deltaTime = deltaX / zoom;
        const line = lines[draggingClip.lineIndex];
        if (!line) return;

        if (draggingClip.mode === 'move') {
          const clipDuration = draggingClip.initialEnd - draggingClip.initialStart;
          const newStart = Math.max(0, draggingClip.initialStart + deltaTime);
          const newEnd = newStart + clipDuration;
          onUpdateLineTiming(draggingClip.lineIndex, newStart, newEnd);
        } else if (draggingClip.mode === 'trim-start') {
          const newStart = Math.max(0, Math.min(draggingClip.initialStart + deltaTime, draggingClip.initialEnd - 0.2));
          onUpdateLineTiming(draggingClip.lineIndex, newStart, draggingClip.initialEnd);
        } else if (draggingClip.mode === 'trim-end') {
          const newEnd = Math.max(draggingClip.initialStart + 0.2, draggingClip.initialEnd + deltaTime);
          onUpdateLineTiming(draggingClip.lineIndex, draggingClip.initialStart, newEnd);
        }
      } else if (draggingToken && onSetWordToken) {
        const deltaX = e.clientX - draggingToken.initialX;
        const deltaTime = deltaX / zoom;
        const line = lines[draggingToken.lineIndex];
        if (!line || !line.tokens) return;
        const token = line.tokens[draggingToken.tokenIndex];
        if (!token) return;

        if (draggingToken.mode === 'move') {
          const tokenDuration = draggingToken.initialEnd - draggingToken.initialStart;
          const minAllowedStart = draggingToken.lineStart;
          const maxAllowedEnd = draggingToken.lineEnd;
          let newStart = draggingToken.initialStart + deltaTime;
          let newEnd = newStart + tokenDuration;

          if (newStart < minAllowedStart) {
            newStart = minAllowedStart;
            newEnd = newStart + tokenDuration;
          }
          if (newEnd > maxAllowedEnd) {
            newEnd = maxAllowedEnd;
            newStart = Math.max(minAllowedStart, newEnd - tokenDuration);
          }

          onSetWordToken(draggingToken.lineIndex, draggingToken.tokenIndex, newStart, newEnd);
        } else if (draggingToken.mode === 'trim-start') {
          const minAllowedStart = draggingToken.lineStart;
          const maxAllowedStart = draggingToken.initialEnd - 0.05;
          const newStart = Math.max(minAllowedStart, Math.min(draggingToken.initialStart + deltaTime, maxAllowedStart));
          onSetWordToken(draggingToken.lineIndex, draggingToken.tokenIndex, newStart, draggingToken.initialEnd);
        } else if (draggingToken.mode === 'trim-end') {
          const minAllowedEnd = draggingToken.initialStart + 0.05;
          const maxAllowedEnd = draggingToken.lineEnd;
          const newEnd = Math.min(maxAllowedEnd, Math.max(minAllowedEnd, draggingToken.initialEnd + deltaTime));
          onSetWordToken(draggingToken.lineIndex, draggingToken.tokenIndex, draggingToken.initialStart, newEnd);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
      setDraggingClip(null);
      setDraggingToken(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPlayhead, draggingClip, draggingToken, zoom, effectiveDuration, onSeek, lines, onUpdateLineTiming, onSetWordToken]);

  // Auto-scroll timeline to keep playhead in view when playing
  useEffect(() => {
    if (!isPlaying || !trackScrollRef.current || isDraggingPlayhead) return;
    const playheadX = currentTime * zoom;
    const scrollLeft = trackScrollRef.current.scrollLeft;
    const containerWidth = trackScrollRef.current.clientWidth;

    if (playheadX < scrollLeft + 50 || playheadX > scrollLeft + containerWidth - 100) {
      trackScrollRef.current.scrollLeft = playheadX - containerWidth / 3;
    }
  }, [currentTime, zoom, isPlaying, isDraggingPlayhead]);

  // Generate ruler tick marks with clean spacing
  const rulerTicks = useMemo(() => {
    const ticks: Array<{ time: number; label: string; isMajor: boolean }> = [];
    const step = zoom >= 80 ? 2 : zoom >= 40 ? 5 : 10;
    const maxSec = Math.ceil(effectiveDuration);

    for (let t = 0; t <= maxSec; t += step) {
      const mins = Math.floor(t / 60);
      const secs = t % 60;
      const label = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      ticks.push({
        time: t,
        label,
        isMajor: t % (step * 2) === 0,
      });
    }
    return ticks;
  }, [effectiveDuration, zoom]);

  const selectedLine = activeLineIndex !== null ? lines[activeLineIndex] : null;

  // Collapsed Minimal Strip
  if (!isOpen) {
    return (
      <div className="border-t border-white/[0.06] bg-[#09090b]/90 backdrop-blur-md px-3.5 py-1.5 flex items-center justify-between text-xs text-zinc-400 select-none z-20 shrink-0">
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-center w-5 h-5 rounded-md bg-white/[0.04] group-hover:bg-white/10 text-zinc-400 group-hover:text-white border border-white/[0.06] transition-all">
            <ChevronUp className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-zinc-300 group-hover:text-white font-sans flex items-center gap-1.5 text-xs">
            <Music className="w-3.5 h-3.5 text-zinc-400" />
            Audio Timeline
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-500 font-sans border border-white/[0.04]">
            {lines.length} clips
          </span>
        </button>

        <div className="flex items-center gap-2">
          {selectedLine && (
            <span className="text-[11px] text-zinc-500 font-sans truncate max-w-xs hidden sm:inline">
              Active: &ldquo;{selectedLine.text}&rdquo;
            </span>
          )}
          <button
            type="button"
            onClick={onToggleOpen}
            className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/10 hover:text-white text-zinc-300 text-xs font-medium transition-all cursor-pointer border border-white/[0.08]"
          >
            Expand Timeline
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="border-t border-white/[0.08] bg-[#070709] flex flex-col h-40 select-none z-20 shrink-0 relative transition-all duration-200 shadow-2xl"
    >
      {/* Sleek Minimalist Header */}
      <div className="h-7 px-3 bg-[#0a0a0d] border-b border-white/[0.06] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onToggleOpen}
            title="Collapse Timeline Drawer"
            className="p-0.5 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>Timeline Tracks</span>
          </span>

          {selectedLine && (
            <span className="text-[11px] text-zinc-400 truncate max-w-md font-sans border-l border-white/10 pl-2 ml-1 hidden sm:inline">
              #{activeLineIndex! + 1}: &ldquo;{selectedLine.text}&rdquo;
            </span>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((prev) => Math.max(20, prev - 10))}
            title="Zoom Out"
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <ZoomOut className="w-3 h-3" />
          </button>

          <span className="text-[10px] font-sans text-zinc-500 w-10 text-center">
            {Math.round(zoom)}px/s
          </span>

          <button
            type="button"
            onClick={() => setZoom((prev) => Math.min(180, prev + 15))}
            title="Zoom In"
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <ZoomIn className="w-3 h-3" />
          </button>

          <div className="w-[1px] h-3 bg-white/10 mx-1" />

          <button
            type="button"
            onClick={() => setZoom(45)}
            title="Reset Zoom"
            className="px-1.5 py-0.5 rounded text-[10px] bg-white/[0.04] hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer font-sans"
          >
            Fit
          </button>
        </div>
      </div>

      {/* Main Track Workspace */}
      <div
        ref={trackScrollRef}
        onMouseDown={handleTimelineMouseDown}
        className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar relative bg-[#050507] cursor-crosshair"
      >
        <div
          style={{ width: `${totalWidth}px` }}
          className="h-full relative flex flex-col justify-between py-1"
        >
          {/* 1. Timecode Ruler */}
          <div className="h-4 bg-[#08080a] border-b border-white/[0.04] relative shrink-0">
            {rulerTicks.map((tick) => (
              <div
                key={tick.time}
                style={{ left: `${tick.time * zoom}px` }}
                className="absolute top-0 bottom-0 flex flex-col justify-end pointer-events-none"
              >
                <div
                  className={`w-[1px] ${
                    tick.isMajor ? 'h-2.5 bg-white/25' : 'h-1.5 bg-white/10'
                  }`}
                />
                {tick.isMajor && (
                  <span className="text-[8px] font-sans text-zinc-500 pl-1 -translate-y-0.5 select-none">
                    {tick.label}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* 2. Primary Lyrics Line Track */}
          <div className="h-14 relative p-1 flex items-center">
            {lines.map((line, idx) => {
              const left = line.start * zoom;
              const width = Math.max((line.end - line.start) * zoom, 16);
              const isSelected = activeLineIndex === idx;
              const isHovered = hoveredLineIndex === idx;

              // Density rules: Clean presentation without clipped micro-text
              const showFullText = width >= 85;
              const showShortText = width >= 40 && width < 85;

              return (
                <div
                  key={line.id || idx}
                  style={{
                    left: `${left}px`,
                    width: `${width}px`,
                  }}
                  onMouseEnter={() => setHoveredLineIndex(idx)}
                  onMouseLeave={() => setHoveredLineIndex(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLine(idx);
                    onSeek(line.start);
                  }}
                  title={`#${idx + 1}: ${line.text}\n${line.start.toFixed(2)}s - ${line.end.toFixed(2)}s`}
                  className={`timeline-clip absolute h-10 rounded-md border text-xs flex flex-col justify-center px-1.5 cursor-pointer transition-all overflow-hidden select-none group shadow-sm ${
                    isSelected
                      ? 'bg-zinc-800 border-white text-white shadow-[0_0_12px_rgba(255,255,255,0.2)] ring-1 ring-white/50 z-10'
                      : isHovered
                      ? 'bg-zinc-800/80 border-white/30 text-zinc-100 z-5'
                      : 'bg-zinc-900/90 border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {/* Left Trim Handle */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDraggingClip({
                        lineIndex: idx,
                        mode: 'trim-start',
                        initialX: e.clientX,
                        initialStart: line.start,
                        initialEnd: line.end,
                      });
                    }}
                    title="Trim Start"
                    className="clip-handle absolute left-0 top-0 bottom-0 w-2 group-hover:bg-white/30 hover:!bg-white cursor-ew-resize transition-all rounded-l-md z-20"
                  />

                  {/* Adaptive Center Label (Prevents text slop) */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      onSelectLine(idx);
                      setDraggingClip({
                        lineIndex: idx,
                        mode: 'move',
                        initialX: e.clientX,
                        initialStart: line.start,
                        initialEnd: line.end,
                      });
                    }}
                    className="flex-1 flex flex-col justify-center min-w-0 px-1 cursor-grab active:cursor-grabbing"
                  >
                    {showFullText ? (
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-sans font-medium text-[11px] leading-tight">
                          {line.text || '(empty)'}
                        </span>
                        <span className="text-[8px] font-sans text-zinc-500 leading-none mt-0.5">
                          {line.start.toFixed(1)}s
                        </span>
                      </div>
                    ) : showShortText ? (
                      <span className="truncate font-sans text-[10px] font-medium leading-none">
                        {line.text ? line.text.split(' ')[0] : `#${idx + 1}`}
                      </span>
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-white/20 mx-auto" />
                    )}
                  </div>

                  {/* Right Trim Handle */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDraggingClip({
                        lineIndex: idx,
                        mode: 'trim-end',
                        initialX: e.clientX,
                        initialStart: line.start,
                        initialEnd: line.end,
                      });
                    }}
                    title="Trim End"
                    className="clip-handle absolute right-0 top-0 bottom-0 w-2 group-hover:bg-white/30 hover:!bg-white cursor-ew-resize transition-all rounded-r-md z-20"
                  />
                </div>
              );
            })}
          </div>

          {/* 3. Sub-track: Syllable / Word Tokens (Draggable & Trimmable) */}
          <div className="h-7 relative bg-[#070709]/90 border-t border-white/[0.04] p-0.5 flex items-center">
            {selectedLine && selectedLine.tokens && selectedLine.tokens.length > 0 ? (
              selectedLine.tokens.map((token, tIdx) => {
                const tokenLeft = token.start * zoom;
                const tokenWidth = Math.max((token.end - token.start) * zoom, 16);
                const isActiveWord = currentTime >= token.start && currentTime < token.end;
                const isDraggingThis = draggingToken?.tokenIndex === tIdx;
                const showWordText = tokenWidth >= 20;

                return (
                  <div
                    key={tIdx}
                    style={{
                      left: `${tokenLeft}px`,
                      width: `${tokenWidth}px`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeek(token.start);
                    }}
                    title={`"${token.text}" (${token.start.toFixed(2)}s - ${token.end.toFixed(2)}s) • Drag to move, drag edges to trim`}
                    className={`token-chip absolute h-5 rounded text-[10px] font-sans flex items-center justify-between px-0.5 cursor-pointer select-none transition-all group overflow-hidden border ${
                      isDraggingThis
                        ? 'bg-emerald-500/30 border-emerald-400 text-white shadow-lg shadow-emerald-500/20 z-20 ring-1 ring-emerald-400'
                        : isActiveWord
                        ? 'bg-white text-zinc-950 font-bold border-white shadow-sm z-10'
                        : 'bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-300 border-white/[0.1] hover:border-white/30'
                    }`}
                  >
                    {/* Token Left Trim Handle */}
                    {onSetWordToken && (
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setDraggingToken({
                            lineIndex: activeLineIndex!,
                            tokenIndex: tIdx,
                            mode: 'trim-start',
                            initialX: e.clientX,
                            initialStart: token.start,
                            initialEnd: token.end,
                            lineStart: selectedLine.start,
                            lineEnd: selectedLine.end,
                          });
                        }}
                        title="Trim word start"
                        className="token-handle absolute left-0 top-0 bottom-0 w-1.5 hover:w-2.5 bg-transparent hover:bg-emerald-400 cursor-ew-resize transition-all rounded-l z-20"
                      />
                    )}

                    {/* Token Move Center */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        if (onSetWordToken) {
                          setDraggingToken({
                            lineIndex: activeLineIndex!,
                            tokenIndex: tIdx,
                            mode: 'move',
                            initialX: e.clientX,
                            initialStart: token.start,
                            initialEnd: token.end,
                            lineStart: selectedLine.start,
                            lineEnd: selectedLine.end,
                          });
                        }
                      }}
                      className="flex-1 flex items-center justify-center min-w-0 px-0.5 cursor-grab active:cursor-grabbing"
                    >
                      {showWordText ? (
                        <span className="truncate leading-none">{token.text}</span>
                      ) : (
                        <span className="w-1 h-1 rounded-full bg-white/40" />
                      )}
                    </div>

                    {/* Token Right Trim Handle */}
                    {onSetWordToken && (
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setDraggingToken({
                            lineIndex: activeLineIndex!,
                            tokenIndex: tIdx,
                            mode: 'trim-end',
                            initialX: e.clientX,
                            initialStart: token.start,
                            initialEnd: token.end,
                            lineStart: selectedLine.start,
                            lineEnd: selectedLine.end,
                          });
                        }}
                        title="Trim word end"
                        className="token-handle absolute right-0 top-0 bottom-0 w-1.5 hover:w-2.5 bg-transparent hover:bg-emerald-400 cursor-ew-resize transition-all rounded-r z-20"
                      />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="px-2 text-[9px] text-zinc-600 font-sans">
                {selectedLine
                  ? 'Selected line has no word-level timestamps'
                  : 'Select a lyric clip to inspect and drag word timings'}
              </div>
            )}
          </div>

          {/* 4. Professional Studio Playhead Needle */}
          <div
            style={{ left: `${currentTime * zoom}px` }}
            className="absolute top-0 bottom-0 w-[1.5px] bg-rose-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(244,63,94,0.7)]"
          >
            {/* Top Diamond Indicator */}
            <div className="absolute -top-1 -translate-x-[4px] w-2.5 h-2.5 rotate-45 bg-rose-500 shadow-md pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
});

TimelineEditor.displayName = 'TimelineEditor';
