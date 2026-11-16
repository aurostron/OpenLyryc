'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, RotateCw, X, History, Activity } from 'lucide-react';

export interface ToastAction {
  id: string;
  message: string;
  actionType?: 'undo' | 'redo' | 'info' | 'sync';
  onRevert?: () => void;
  durationMs?: number;
}

interface UndoToastProps {
  toast: ToastAction | null;
  onDismiss: () => void;
}

export const UndoToast: React.FC<UndoToastProps> = ({ toast, onDismiss }) => {
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;

  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!toast) return;
    const duration = toast.durationMs || 4000;
    let remaining = duration;
    let lastTimestamp = Date.now();

    const timer = setInterval(() => {
      if (isPausedRef.current) {
        lastTimestamp = Date.now();
        return;
      }
      const now = Date.now();
      const delta = now - lastTimestamp;
      lastTimestamp = now;
      remaining -= delta;

      if (remaining <= 0) {
        clearInterval(timer);
        onDismissRef.current();
      }
    }, 80);

    return () => clearInterval(timer);
  }, [toast?.id]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 24, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 14, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 360 }}
          role="status"
          aria-live="polite"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="fixed bottom-24 right-5 sm:right-8 max-sm:left-4 max-sm:right-4 z-50 flex items-center gap-3 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-[#131317]/95 border border-white/[0.15] text-white shadow-2xl backdrop-blur-xl ring-1 ring-white/10 select-none"
        >
          <div className="w-6 h-6 rounded-lg bg-white/[0.08] border border-white/[0.1] flex items-center justify-center shrink-0 text-zinc-300">
            {toast.actionType === 'redo' ? (
              <RotateCw className="w-3.5 h-3.5 stroke-[2.25]" />
            ) : toast.actionType === 'undo' ? (
              <RotateCcw className="w-3.5 h-3.5 stroke-[2.25]" />
            ) : toast.actionType === 'sync' ? (
              <Activity className="w-3.5 h-3.5 stroke-[2.25] text-emerald-400" />
            ) : (
              <History className="w-3.5 h-3.5 stroke-[2.25]" />
            )}
          </div>

          <span className="text-xs font-semibold font-sans text-zinc-100 min-w-0 pr-1 truncate max-w-[220px] sm:max-w-xs">
            {toast.message}
          </span>

          {toast.onRevert && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                toast.onRevert?.();
                onDismissRef.current();
              }}
              title="Revert action"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-bold transition-colors cursor-pointer shadow-md shrink-0 ml-auto"
            >
              <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Revert</span>
            </motion.button>
          )}

          <motion.button
            type="button"
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.88 }}
            onClick={() => onDismissRef.current()}
            title="Dismiss notification"
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
