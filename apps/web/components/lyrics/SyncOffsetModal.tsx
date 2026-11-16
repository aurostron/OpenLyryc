'use client';

import React from 'react';
import { X, SlidersHorizontal, RotateCcw, Crosshair } from 'lucide-react';

interface SyncOffsetModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncOffset: number;
  onChangeSyncOffset: (newOffset: number) => void;
  onStartFirstLineCalibration: () => void;
  firstLineText?: string;
  firstLineTime?: number;
}

export const SyncOffsetModal: React.FC<SyncOffsetModalProps> = ({
  isOpen,
  onClose,
  syncOffset,
  onChangeSyncOffset,
  onStartFirstLineCalibration,
  firstLineText,
  firstLineTime = 0,
}) => {
  if (!isOpen) return null;

  const nudge = (delta: number) => {
    const updated = Math.round((syncOffset + delta) * 100) / 100;
    onChangeSyncOffset(updated);
  };

  const reset = () => {
    onChangeSyncOffset(0);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#111115] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-zinc-300" />
            <h2 className="text-sm font-semibold text-white">Audio Sync</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Main Offset Display */}
          <div className="py-2 text-center">
            <div className="text-3xl font-bold font-sans text-white tabular-nums tracking-tight">
              {syncOffset > 0 ? `+${syncOffset.toFixed(2)}s` : `${syncOffset.toFixed(2)}s`}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {syncOffset === 0
                ? 'Lyrics matched to studio audio'
                : syncOffset > 0
                ? `Delayed by ${syncOffset.toFixed(2)}s (video intro)`
                : `Advanced by ${Math.abs(syncOffset).toFixed(2)}s`}
            </p>
          </div>

          {/* Quick Fine-Tuning Nudge Buttons */}
          <div className="grid grid-cols-5 gap-1.5">
            <button
              type="button"
              onClick={() => nudge(-1.0)}
              className="px-2 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white text-xs font-medium transition-colors cursor-pointer active:scale-95"
            >
              -1s
            </button>
            <button
              type="button"
              onClick={() => nudge(-0.1)}
              className="px-2 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white text-xs font-medium transition-colors cursor-pointer active:scale-95"
            >
              -0.1s
            </button>
            <button
              type="button"
              onClick={reset}
              className="px-2 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-zinc-200 hover:text-white text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1 active:scale-95"
              title="Reset to 0s"
            >
              <RotateCcw className="w-3 h-3" />
              <span>0s</span>
            </button>
            <button
              type="button"
              onClick={() => nudge(0.1)}
              className="px-2 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white text-xs font-medium transition-colors cursor-pointer active:scale-95"
            >
              +0.1s
            </button>
            <button
              type="button"
              onClick={() => nudge(1.0)}
              className="px-2 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white text-xs font-medium transition-colors cursor-pointer active:scale-95"
            >
              +1s
            </button>
          </div>

          {/* Quick 1-Tap Sync Trigger */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white">Tap to Sync</div>
              <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                Press Space when vocals begin
              </p>
              {firstLineText && (
                <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                  &ldquo;{firstLineText}&rdquo; ({firstLineTime.toFixed(1)}s)
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onStartFirstLineCalibration();
              }}
              className="px-3 py-1.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold shrink-0 transition-colors cursor-pointer active:scale-95"
            >
              Start
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-zinc-500">
          <span>Saves per video</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
