'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BreakReminderOverlayProps {
  isOpen: boolean;
  onFinish: () => void;
  breakDurationMs?: number; // Default 30,000ms (30 seconds)
}

export const BreakReminderOverlay: React.FC<BreakReminderOverlayProps> = ({
  isOpen,
  onFinish,
  breakDurationMs = 30_000,
}) => {
  const [progress, setProgress] = useState<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      startTimeRef.current = null;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    startTimeRef.current = performance.now();

    const tick = (now: number) => {
      if (!startTimeRef.current) return;
      const elapsed = now - startTimeRef.current;
      const currentProgress = Math.min(1, elapsed / breakDurationMs);
      setProgress(currentProgress);

      if (currentProgress < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        // Break complete
        onFinish();
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);

    // Escape key emergency resume
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onFinish();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, breakDurationMs, onFinish]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[999999] flex flex-col items-center justify-center p-6 select-none bg-[#070709]/80 backdrop-blur-3xl overflow-hidden"
          style={{ fontFamily: 'var(--font-geist), sans-serif' }}
        >
          {/* Subtle Ambient Background Glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-emerald-500/5 blur-3xl opacity-70 animate-pulse" />
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -10 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 max-w-3xl flex flex-col items-center text-center px-4"
          >
            {/* Giant Heading in Geist */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-[1.08] text-balance">
              You&apos;ve been working for too long!
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-2xl md:text-3xl text-zinc-300 font-light mt-4 sm:mt-6 tracking-normal">
              Mind having a break?
            </p>

            {/* Sleek Progress Bar (No explicit countdown numbers) */}
            <div className="w-64 sm:w-80 md:w-96 h-1.5 sm:h-2 rounded-full bg-white/10 overflow-hidden backdrop-blur-md relative mt-10 sm:mt-14 shadow-inner">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-white/70 via-white to-white/90 shadow-[0_0_14px_rgba(255,255,255,0.7)]"
                style={{
                  width: `${progress * 100}%`,
                  transition: 'width 80ms linear',
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
