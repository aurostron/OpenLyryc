'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SyncOffsetHudProps {
  offsetMs: number;
  onUpdateOffset: (newOffsetMs: number) => void;
  onBakeOffset?: () => void;
  onShiftAllTimestamps?: (deltaSeconds: number) => void;
  currentTime?: number;
  rawTime?: number;
  displayTime?: number;
  activeWordText?: string;
  activeWordSpan?: { start: number; end: number };
  firstLineStart?: number;
  hasLines?: boolean;
  onActionToast?: (msg: string) => void;
}

export const SyncOffsetHud: React.FC<SyncOffsetHudProps> = ({
  offsetMs,
  onUpdateOffset,
  onBakeOffset,
  onShiftAllTimestamps,
  currentTime,
  rawTime,
  displayTime,
  activeWordText,
  activeWordSpan,
  firstLineStart,
  hasLines = false,
  onActionToast,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(String(offsetMs));
  const [isEditingInput, setIsEditingInput] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const actualRawTime = rawTime ?? currentTime ?? 0;
  const actualDisplayTime = displayTime ?? (actualRawTime + offsetMs / 1000);

  useEffect(() => {
    if (!isEditingInput) {
      setInputValue(String(offsetMs));
    }
  }, [offsetMs, isEditingInput]);

  // Click outside to dismiss popover
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsEditingInput(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleApplyInput = () => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed)) {
      onUpdateOffset(parsed);
      onActionToast?.(`Sync offset set to ${parsed > 0 ? `+${parsed}` : parsed}ms`);
    } else {
      setInputValue(String(offsetMs));
    }
    setIsEditingInput(false);
  };

  const handleNudge = (delta: number) => {
    const next = offsetMs + delta;
    onUpdateOffset(next);
    onActionToast?.(`Sync offset: ${next > 0 ? `+${next}` : next}ms (${delta > 0 ? 'Advance · Earlier' : 'Delay · Later'})`);
  };

  const handleBake = () => {
    if (!onBakeOffset || offsetMs === 0) return;
    const bakedMs = offsetMs;
    onBakeOffset();
    onActionToast?.(`Baked ${bakedMs > 0 ? `+${bakedMs}` : bakedMs}ms offset into all lyric timestamps!`);
    setIsOpen(false);
  };

  const handleAlignFirstLine = () => {
    if (!onShiftAllTimestamps || firstLineStart === undefined || !hasLines) return;
    const deltaSeconds = actualRawTime - firstLineStart;
    onShiftAllTimestamps(deltaSeconds);
    const deltaMs = Math.round(deltaSeconds * 1000);
    onActionToast?.(
      `Aligned line 1 to audio (${actualRawTime.toFixed(2)}s, shifted ${deltaMs > 0 ? `+${deltaMs}` : deltaMs}ms)`
    );
    setIsOpen(false);
  };

  const isOffsetNonZero = offsetMs !== 0;
  const canAlign = hasLines && firstLineStart !== undefined && actualRawTime > 0;

  return (
    <div className="relative inline-block select-none" ref={containerRef}>
      {/* Header Compact Pill Trigger - Stable Fixed Dimensions */}
      <div className="flex items-center h-8 rounded-xl border border-white/[0.1] bg-white/[0.04] text-[11px] font-sans text-zinc-300 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          title="Sync Offset Calibration (Hotkeys: [ / ])"
          className={`flex items-center gap-1.5 px-2.5 h-full transition-colors cursor-pointer ${
            isOpen
              ? 'bg-white text-zinc-950 font-bold'
              : 'hover:bg-white/[0.06] hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[14px] text-zinc-400">timer</span>
          <span className="tabular-nums min-w-[48px] text-center font-bold">
            {offsetMs > 0 ? `+${offsetMs}` : offsetMs}ms
          </span>
        </button>

        {/* Quick Stepper Buttons on Pill for Instant 1-Click Adjustments */}
        <div className="flex items-center h-full border-l border-white/[0.08] px-0.5">
          <button
            type="button"
            onClick={() => handleNudge(-100)}
            title="Delay Lyrics by 100ms (Lyrics too early) — Hotkey: ["
            className="w-7 h-6 flex items-center justify-center rounded text-[10px] font-sans text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            -100
          </button>
          <button
            type="button"
            onClick={() => handleNudge(100)}
            title="Advance Lyrics by 100ms (Lyrics too late) — Hotkey: ]"
            className="w-7 h-6 flex items-center justify-center rounded text-[10px] font-sans text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            +100
          </button>
        </div>
      </div>

      {/* Floating Sync Calibration Popover - Fixed Size, Pure Monochrome */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            transition={{ duration: 0.12 }}
            className="absolute top-10 right-0 z-50 w-84 bg-[#111115]/98 border border-white/[0.12] rounded-xl shadow-2xl shadow-black/80 backdrop-blur-xl p-3.5 space-y-3"
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-zinc-400">tune</span>
                <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">Sync Offset</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!isOffsetNonZero}
                  onClick={() => onUpdateOffset(0)}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  Reset (0ms)
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            </div>

            {/* Direct Input & Live Timing Telemetry */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400 font-medium">Global Offset:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step={10}
                    value={inputValue}
                    onChange={(e) => {
                      setIsEditingInput(true);
                      setInputValue(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleApplyInput();
                      if (e.key === 'Escape') {
                        setInputValue(String(offsetMs));
                        setIsEditingInput(false);
                      }
                    }}
                    onBlur={handleApplyInput}
                    className="w-20 px-2 py-0.5 rounded bg-black/60 border border-white/10 text-right font-sans font-bold text-xs text-white focus:outline-none focus:border-white/30"
                  />
                  <span className="text-xs font-sans text-zinc-500">ms</span>
                </div>
              </div>

              {/* Real-time Clock Comparison: Shows user exactly what audio vs lyrics are doing */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/[0.05] text-[11px] font-sans">
                <div className="bg-black/35 rounded-lg p-2 border border-white/[0.04]">
                  <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-sans font-semibold">Audio Playhead</div>
                  <div className="text-zinc-300 font-bold tabular-nums text-xs mt-0.5">
                    {actualRawTime.toFixed(2)}s
                  </div>
                </div>
                <div className="bg-black/35 rounded-lg p-2 border border-white/[0.04]">
                  <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-sans font-semibold flex items-center justify-between">
                    <span>Lyrics Clock</span>
                    <span className={`text-[10px] font-bold ${offsetMs > 0 ? 'text-emerald-400' : offsetMs < 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                      {offsetMs > 0 ? `+${offsetMs}ms` : offsetMs < 0 ? `${offsetMs}ms` : '0ms'}
                    </span>
                  </div>
                  <div className="text-white font-bold tabular-nums text-xs mt-0.5">
                    {actualDisplayTime.toFixed(2)}s
                  </div>
                </div>
              </div>

              {/* Active Word & Range: Explains why text stays held when paused inside a word */}
              {activeWordText && activeWordSpan && (
                <div className="text-[10px] font-sans text-zinc-400 bg-black/25 border border-white/[0.04] rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                  <div className="truncate max-w-[150px] text-zinc-200 font-sans font-semibold">
                    Word: &ldquo;{activeWordText}&rdquo;
                  </div>
                  <div className="text-[10px] text-zinc-500 tabular-nums">
                    {activeWordSpan.start.toFixed(2)}s – {activeWordSpan.end.toFixed(2)}s
                  </div>
                </div>
              )}

              {/* Status Explanation */}
              <div className="text-[10.5px] font-sans flex items-center gap-1.5 pt-0.5">
                {offsetMs > 0 ? (
                  <>
                    <span className="material-symbols-outlined text-[13px] text-emerald-400">speed</span>
                    <span className="text-emerald-300/90">+ Advance (lyrics trigger {offsetMs}ms earlier)</span>
                  </>
                ) : offsetMs < 0 ? (
                  <>
                    <span className="material-symbols-outlined text-[13px] text-amber-400">history</span>
                    <span className="text-amber-300/90">- Delay (lyrics trigger {Math.abs(offsetMs)}ms later)</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[13px] text-zinc-500">check_circle</span>
                    <span className="text-zinc-500">Master audio timing (exact match)</span>
                  </>
                )}
              </div>
            </div>

            {/* Calibration Stepper Buttons (Clear Symptoms) */}
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">
                Coarse Calibration (±100ms)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleNudge(-100)}
                  title="Delay lyrics: push lyrics later by 100ms (Hotkey: [)"
                  className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-left transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-1 font-sans font-bold text-xs text-zinc-300 group-hover:text-white">
                    <span className="material-symbols-outlined text-[14px] text-amber-400/80">history</span>
                    <span>-100ms (Delay)</span>
                  </div>
                  <div className="text-[9.5px] text-zinc-400 mt-0.5">Lyrics appear too early</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleNudge(100)}
                  title="Advance lyrics: pull lyrics earlier by 100ms (Hotkey: ])"
                  className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-left transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-1 font-sans font-bold text-xs text-zinc-300 group-hover:text-white">
                    <span className="material-symbols-outlined text-[14px] text-emerald-400/80">speed</span>
                    <span>+100ms (Advance)</span>
                  </div>
                  <div className="text-[9.5px] text-zinc-400 mt-0.5">Lyrics appear too late</div>
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">
                Fine Tuning (±10ms)
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleNudge(-10)}
                  title="Delay by 10ms (Hotkey: Shift+[)"
                  className="h-7 flex items-center justify-center gap-1 px-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] text-[11px] font-sans text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <span>-10ms (Delay)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleNudge(10)}
                  title="Advance by 10ms (Hotkey: Shift+])"
                  className="h-7 flex items-center justify-center gap-1 px-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] text-[11px] font-sans text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <span>+10ms (Advance)</span>
                </button>
              </div>
            </div>

            {/* Permanent Actions: Bake & Align */}
            <div className="space-y-1.5 pt-1.5 border-t border-white/[0.07]">
              {onBakeOffset && (
                <button
                  type="button"
                  disabled={!isOffsetNonZero}
                  onClick={handleBake}
                  className={`w-full h-8 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    isOffsetNonZero
                      ? 'bg-white/[0.08] hover:bg-white/[0.14] border border-white/20 text-white cursor-pointer'
                      : 'bg-white/[0.02] border border-white/[0.04] text-zinc-600 cursor-not-allowed opacity-40'
                  }`}
                  title="Applies offset directly to all timestamps and resets offset to 0ms"
                >
                  <span className="material-symbols-outlined text-[15px]">done_all</span>
                  <span>Bake Offset into Timestamps</span>
                </button>
              )}

              {onShiftAllTimestamps && (
                <button
                  type="button"
                  disabled={!canAlign}
                  onClick={handleAlignFirstLine}
                  className={`w-full h-8 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    canAlign
                      ? 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 hover:text-white cursor-pointer'
                      : 'bg-white/[0.02] border border-white/[0.04] text-zinc-600 cursor-not-allowed opacity-40'
                  }`}
                  title={`Shifts all timestamps so Line 1 begins at current audio playhead position (${actualRawTime.toFixed(2)}s)`}
                >
                  <span className="material-symbols-outlined text-[14px]">vertical_align_top</span>
                  <span>Align Line 1 to Audio ({actualRawTime.toFixed(2)}s)</span>
                </button>
              )}
            </div>

            {/* Hotkey Guide */}
            <div className="h-5 text-[10px] text-zinc-500 font-sans flex items-center justify-center gap-1.5 pt-1 border-t border-white/[0.06]">
              <span>Hotkeys:</span>
              <kbd className="px-1 py-0.2 rounded bg-white/[0.06] border border-white/10 text-zinc-400 font-sans">[</kbd>
              <kbd className="px-1 py-0.2 rounded bg-white/[0.06] border border-white/10 text-zinc-400 font-sans">]</kbd>
              <span>±100ms</span>
              <span className="text-zinc-600">·</span>
              <span>Shift: ±10ms</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
