'use client';

import React, { useEffect, useState } from 'react';

export type TransitionPhase = 'idle' | 'fading-out' | 'holding' | 'fading-in';

export interface TvSwipeTransitionProps {
  /** Explicit lifecycle phase for coordinated scene crossfading */
  phase?: TransitionPhase;
  /** Status message to display calmly if holding during network fetch */
  statusText?: string;
  onFadeOutComplete?: () => void;
  onFadeInComplete?: () => void;

  /** Legacy boolean trigger for standalone / self-contained usage */
  isActive?: boolean;
  onComplete?: () => void;
  durationMs?: number;
}

/**
 * Screen Fade-Out & Fade-In Transition
 * Coordinated cinematic scene crossfade that fades out the current song,
 * holds dark while the next song loads into state, and smoothly fades in
 * to reveal the new song without jump-cuts or premature reveal.
 */
export const TvSwipeTransition: React.FC<TvSwipeTransitionProps> = ({
  phase,
  statusText,
  onFadeOutComplete,
  onFadeInComplete,
  isActive,
  onComplete,
  durationMs = 1600,
}) => {
  const [internalPhase, setInternalPhase] = useState<TransitionPhase>('idle');

  // Handle self-contained isActive mode
  useEffect(() => {
    if (phase !== undefined) {
      setInternalPhase(phase);
      return;
    }

    if (isActive) {
      setInternalPhase('fading-out');
      const fadeOutTimer = setTimeout(() => {
        setInternalPhase('holding');
        const holdTimer = setTimeout(() => {
          setInternalPhase('fading-in');
          const fadeInTimer = setTimeout(() => {
            setInternalPhase('idle');
            onComplete?.();
          }, 800);
          return () => clearTimeout(fadeInTimer);
        }, 180);
        return () => clearTimeout(holdTimer);
      }, 700);
      return () => clearTimeout(fadeOutTimer);
    } else {
      setInternalPhase('idle');
    }
  }, [phase, isActive, onComplete, durationMs]);

  // When in controlled mode, notify parent on animation completion
  useEffect(() => {
    if (phase === 'fading-out') {
      const timer = setTimeout(() => {
        onFadeOutComplete?.();
      }, 700);
      return () => clearTimeout(timer);
    } else if (phase === 'fading-in') {
      const timer = setTimeout(() => {
        onFadeInComplete?.();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [phase, onFadeOutComplete, onFadeInComplete]);

  const activePhase = phase !== undefined ? phase : internalPhase;

  if (activePhase === 'idle') return null;

  return (
    <div
      className={`fixed inset-0 z-50 overflow-hidden select-none flex flex-col items-center justify-center bg-[#09090b] ${
        activePhase === 'fading-in' ? 'pointer-events-none' : 'pointer-events-auto'
      } ${
        activePhase === 'fading-out'
          ? 'animate-screen-fade-out'
          : activePhase === 'fading-in'
          ? 'animate-screen-fade-in'
          : 'opacity-100'
      }`}
      aria-hidden="true"
    >
      {/* Calm, minimal status indicator while holding during network fetch */}
      {activePhase === 'holding' && statusText && (
        <div className="flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white animate-spin mb-3.5" />
          <p className="text-xs font-medium text-white/90 tracking-tight">{statusText}</p>
        </div>
      )}
    </div>
  );
};
