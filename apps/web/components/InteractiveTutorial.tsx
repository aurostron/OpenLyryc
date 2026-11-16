'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  Play,
  RotateCcw,
  CheckCircle2,
  FileMusic,
} from 'lucide-react';
import { OpenLyrycLogo } from '@/components/OpenLyrycLogo';
import {
  TUTORIAL_STEPS,
  TUTORIAL_STORAGE_KEY,
  TutorialStep,
} from '@/lib/tutorialData';

interface InteractiveTutorialProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour: () => void;
  onFinishTour: (action: 'keep' | 'blank') => void;
  /** When true, runs the spotlight tour directly (e.g. from Replay button or when tour is initiated) */
  isActiveTour: boolean;
  onStepChange?: (step: TutorialStep, stepIndex: number) => void;
}

interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const InteractiveTutorial: React.FC<InteractiveTutorialProps> = ({
  isOpen,
  onClose,
  onStartTour,
  onFinishTour,
  isActiveTour,
  onStepChange,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isCompletedModalOpen, setIsCompletedModalOpen] = useState<boolean>(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const currentStep = TUTORIAL_STEPS[currentStepIndex] || TUTORIAL_STEPS[0];

  // Helper to locate target element and calculate rect with padding
  const updateTargetRect = useCallback(() => {
    if (!isActiveTour || !currentStep) return;

    let el: HTMLElement | null = document.querySelector(currentStep.targetSelector);
    if (!el && currentStep.fallbackSelector) {
      el = document.querySelector(currentStep.fallbackSelector);
    }

    if (el) {
      const domRect = el.getBoundingClientRect();
      const padding = 8;
      const rect: TargetRect = {
        x: Math.max(0, domRect.left - padding),
        y: Math.max(0, domRect.top - padding),
        width: Math.min(window.innerWidth, domRect.width + padding * 2),
        height: Math.min(window.innerHeight, domRect.height + padding * 2),
      };
      setTargetRect(rect);

      // Scroll element smoothly into view if out of visible bounds
      if (
        domRect.top < 0 ||
        domRect.bottom > window.innerHeight ||
        domRect.left < 0 ||
        domRect.right > window.innerWidth
      ) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }

      // Calculate tooltip position
      const cardWidth = 360;
      const cardHeight = 220;
      const margin = 16;
      let x = rect.x;
      let y = rect.y + rect.height + margin;

      if (currentStep.placement === 'top') {
        y = Math.max(margin, rect.y - cardHeight - margin);
      } else if (currentStep.placement === 'right') {
        x = rect.x + rect.width + margin;
        y = rect.y;
      } else if (currentStep.placement === 'left') {
        x = Math.max(margin, rect.x - cardWidth - margin);
        y = rect.y;
      }

      // Ensure tooltip remains inside screen viewport
      x = Math.max(margin, Math.min(window.innerWidth - cardWidth - margin, x));
      y = Math.max(margin, Math.min(window.innerHeight - cardHeight - margin, y));

      setTooltipPos({ x, y });
    } else {
      // Fallback: center spotlight on screen
      setTargetRect({
        x: window.innerWidth * 0.2,
        y: window.innerHeight * 0.25,
        width: window.innerWidth * 0.6,
        height: window.innerHeight * 0.5,
      });
      setTooltipPos({
        x: Math.max(16, (window.innerWidth - 360) / 2),
        y: window.innerHeight * 0.55,
      });
    }
  }, [isActiveTour, currentStep]);

  // Recalculate on step change, resize, scroll, or DOM changes
  useEffect(() => {
    if (!isActiveTour) return;

    if (onStepChange && currentStep) {
      onStepChange(currentStep, currentStepIndex);
    }

    const timer = setTimeout(() => {
      updateTargetRect();
    }, 120);

    const handleResizeOrScroll = () => {
      updateTargetRect();
    };

    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
    };
  }, [isActiveTour, currentStepIndex, updateTargetRect, onStepChange, currentStep]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      // Finished all steps
      setIsCompletedModalOpen(true);
    }
  }, [currentStepIndex]);

  const handlePrev = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const handleSkip = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
      } catch {}
    }
    onClose();
  }, [onClose]);

  const handleFinishAction = useCallback((action: 'keep' | 'blank') => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
      } catch {}
    }
    setIsCompletedModalOpen(false);
    onFinishTour(action);
  }, [onFinishTour]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActiveTour) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActiveTour, handleNext, handlePrev, handleSkip]);

  // 1. WELCOME PROMPT MODAL (When tour hasn't started yet)
  if (isOpen && !isActiveTour && !isCompletedModalOpen) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md select-none animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-xl rounded-2xl border border-white/[0.12] bg-[#0c0c10] shadow-[0_24px_80px_rgba(0,0,0,0.85)] p-6 sm:p-8 overflow-hidden"
        >
          {/* Subtle decorative glow */}
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close / Skip button */}
          <button
            type="button"
            onClick={handleSkip}
            title="Skip tutorial and start blank"
            className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex flex-col items-center text-center space-y-3 mb-6 relative">
            <div className="flex items-center gap-2">
              <OpenLyrycLogo className="h-6 w-auto text-white" />
              <span className="px-2 py-0.5 rounded-full text-[10px] font-sans uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                Interactive Tour
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Welcome to OpenLyryc Studio
            </h1>
            <p className="text-xs sm:text-sm text-zinc-300 max-w-md leading-relaxed">
              New here? Take a quick 2-minute tour to learn how to sync lyrics,
              preview kinetic typography, and export clean LRC & TTML files.
            </p>
          </div>

          {/* Demo Song Preview Card */}
          <div className="rounded-xl border border-white/[0.1] bg-white/[0.03] p-3.5 mb-6 flex items-center gap-3.5">
            <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-zinc-900 border border-white/[0.1] shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://img.youtube.com/vi/kRVXYHrJblk/hqdefault.jpg"
                alt="Jess Glynne - Hold My Hand"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <Play className="w-4 h-4 text-white fill-white/80" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-sans uppercase text-indigo-400 tracking-wider font-semibold">
                Demo Song Included
              </div>
              <div className="text-sm font-bold text-white truncate">
                Hold My Hand
              </div>
              <div className="text-xs text-zinc-400 truncate">
                Jess Glynne · Synced with YouTube
              </div>
            </div>
            <span className="px-2 py-1 rounded-md bg-white/[0.06] text-[11px] font-sans text-zinc-300 shrink-0">
              ~2 mins
            </span>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-2 gap-2.5 mb-7 text-[12px] text-zinc-300">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              <span className="text-indigo-400 font-bold">⚡</span>
              <span>Split-screen live studio</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              <span className="text-emerald-400 font-bold">⏱️</span>
              <span>Word & syllable timing</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              <span className="text-amber-400 font-bold">🎬</span>
              <span>YouTube video sync</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              <span className="text-pink-400 font-bold">🎨</span>
              <span>Kinetic visual styles</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={onStartTour}
              className="w-full sm:flex-1 h-11 px-5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-white/10 active:scale-[0.98] cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-indigo-600 fill-indigo-600" />
              <span>Start Interactive Tour</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="w-full sm:w-auto h-11 px-5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.08] font-semibold text-xs sm:text-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              Start Blank
            </button>
          </div>

          <p className="mt-4 text-center text-[10px] font-sans text-zinc-500">
            Plays once on first visit · Can be replayed anytime from Settings or Help
          </p>
        </motion.div>
      </div>
    );
  }

  // 2. LIVE SPOTLIGHT TOUR (Spotlight cutout + floating tooltip card)
  if (isActiveTour && !isCompletedModalOpen && targetRect) {
    return (
      <div className="fixed inset-0 z-[110] pointer-events-auto">
        {/* Fullscreen SVG Mask Cutout for Hardware-Accelerated Dimmed Backdrop */}
        <svg
          className="fixed inset-0 w-full h-full pointer-events-none z-[110]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <mask id="openlyryc-tutorial-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={targetRect.x}
                y={targetRect.y}
                width={targetRect.width}
                height={targetRect.height}
                rx="14"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%" height="100%"
            fill="rgba(5, 5, 8, 0.78)"
            mask="url(#openlyryc-tutorial-mask)"
          />
        </svg>

        {/* Pulsing Highlight Box around Target Element */}
        <motion.div
          initial={false}
          animate={{
            x: targetRect.x,
            y: targetRect.y,
            width: targetRect.width,
            height: targetRect.height,
          }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="fixed top-0 left-0 rounded-2xl pointer-events-none z-[111] ring-2 ring-indigo-400/90 shadow-[0_0_35px_rgba(99,102,241,0.45)]"
        />

        {/* Floating Tooltip Card */}
        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{
            opacity: 1,
            scale: 1,
            x: tooltipPos.x,
            y: tooltipPos.y,
          }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed top-0 left-0 w-[350px] max-w-[calc(100vw-32px)] z-[115] rounded-2xl border border-white/[0.14] bg-[#101015]/95 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] p-5 select-none"
        >
          {/* Top Bar: Step Counter & Close */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                Step {currentStepIndex + 1} of {TUTORIAL_STEPS.length}
              </span>
            </div>
            <button
              type="button"
              onClick={handleSkip}
              title="Exit tutorial"
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Title & Description */}
          <h3 className="text-base font-bold text-white tracking-tight mb-1.5">
            {currentStep.title}
          </h3>
          <p className="text-xs text-zinc-300 leading-relaxed mb-4">
            {currentStep.description}
          </p>

          {/* Footer: Step Indicators & Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
            {/* Step Dots */}
            <div className="flex items-center gap-1.5">
              {TUTORIAL_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === currentStepIndex
                      ? 'w-5 bg-indigo-400'
                      : 'w-1.5 bg-white/20 hover:bg-white/40'
                  }`}
                  aria-label={`Jump to step ${idx + 1}`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="h-8 px-2.5 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Back</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="h-8 px-3.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-500/25 transition-all cursor-pointer active:scale-95"
              >
                <span>
                  {currentStepIndex === TUTORIAL_STEPS.length - 1
                    ? 'Got it!'
                    : 'Next'}
                </span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // 3. COMPLETION MODAL
  if (isCompletedModalOpen) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md select-none animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#0c0c10] shadow-[0_24px_80px_rgba(0,0,0,0.85)] p-6 sm:p-8 text-center"
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400 mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
            You&apos;re All Set!
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-6">
            You&apos;ve completed the tour! You can keep experimenting with{' '}
            <strong className="text-white">Jess Glynne — Hold My Hand</strong>, or
            start with a clean blank canvas for your own song.
          </p>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => handleFinishAction('keep')}
              className="w-full h-11 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-white/10 active:scale-98"
            >
              <FileMusic className="w-4 h-4 text-indigo-600" />
              <span>Keep Practicing with Hold My Hand</span>
            </button>

            <button
              type="button"
              onClick={() => handleFinishAction('blank')}
              className="w-full h-11 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 hover:text-white border border-white/[0.1] font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
            >
              <RotateCcw className="w-4 h-4 text-zinc-400" />
              <span>Start Blank Project</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
};
