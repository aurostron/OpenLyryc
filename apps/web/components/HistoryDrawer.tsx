'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, CornerUpLeft } from 'lucide-react';

interface HistoryEntry {
  description: string;
  isPast: boolean;
  index: number;
}

interface HistoryDrawerProps {
  historyLog: HistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Undo `n` steps (click-to-jump) */
  onUndoSteps: (n: number) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  historyLog,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onUndoSteps,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Undo / Redo buttons + history toggle */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          title="Undo (Ctrl+Z)"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">undo</span>
        </button>
        <button
          type="button"
          disabled={!canRedo}
          onClick={onRedo}
          title="Redo (Ctrl+Shift+Z)"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">redo</span>
        </button>
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          title="History"
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
            open
              ? 'bg-white text-zinc-950'
              : 'text-zinc-400 hover:text-white hover:bg-white/10'
          }`}
        >
          <History className="w-3.5 h-3.5 stroke-[2]" />
        </button>
      </div>

      {/* Dropdown popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="absolute top-10 right-0 z-50 w-64 bg-[#111115]/98 border border-white/[0.12] rounded-xl shadow-2xl shadow-black/70 backdrop-blur-xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-white/[0.07] flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                History
              </span>
              <span className="text-[10px] text-zinc-500">
                {historyLog.length} actions
              </span>
            </div>

            {/* Current state marker */}
            <div className="px-3 py-1.5 bg-white/[0.04] border-b border-white/[0.06]">
              <span className="text-[10px] text-white font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                Current state
              </span>
            </div>

            {/* History entries */}
            <div className="max-h-52 overflow-y-auto custom-scrollbar">
              {historyLog.length === 0 ? (
                <div className="px-3 py-4 text-center text-[11px] text-zinc-500">
                  No history yet
                </div>
              ) : (
                historyLog.map((entry, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      // Undo i+1 steps to reach that state
                      onUndoSteps(i + 1);
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-white/[0.05] transition-colors cursor-pointer group"
                  >
                    <CornerUpLeft className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 shrink-0 stroke-[2]" />
                    <span className="text-[11px] text-zinc-400 group-hover:text-zinc-200 truncate transition-colors">
                      {entry.description}
                    </span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
