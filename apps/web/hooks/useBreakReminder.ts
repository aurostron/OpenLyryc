'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseBreakReminderOptions {
  breakIntervalMinutes?: number;
  isPlaying?: boolean;
  onPauseAudio?: () => void;
}

const STORAGE_KEY = 'openlyryc_continuous_active_secs';
const IDLE_TIMEOUT_MS = 90_000; // 90 seconds of no mouse/keyboard interaction counts as stepping away

export function useBreakReminder({
  breakIntervalMinutes = 30,
  isPlaying = false,
  onPauseAudio,
}: UseBreakReminderOptions = {}) {
  // Clamp interval between 10 and 60 minutes
  const safeIntervalMinutes = Math.max(10, Math.min(60, Number(breakIntervalMinutes) || 30));
  const targetSeconds = safeIntervalMinutes * 60;

  const [isBreakActive, setIsBreakActive] = useState<boolean>(false);
  const continuousSecondsRef = useRef<number>(0);
  const lastInteractionRef = useRef<number>(Date.now());
  const onPauseAudioRef = useRef(onPauseAudio);

  useEffect(() => {
    onPauseAudioRef.current = onPauseAudio;
  }, [onPauseAudio]);

  // Restore stored active screentime on initial mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed < targetSeconds) {
          continuousSecondsRef.current = parsed;
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, [targetSeconds]);

  const triggerBreak = useCallback(() => {
    setIsBreakActive(true);
    continuousSecondsRef.current = 0;
    try {
      sessionStorage.setItem(STORAGE_KEY, '0');
    } catch {
      // Ignore
    }
    onPauseAudioRef.current?.();
  }, []);

  const finishBreak = useCallback(() => {
    setIsBreakActive(false);
    continuousSecondsRef.current = 0;
    lastInteractionRef.current = Date.now();
    try {
      sessionStorage.setItem(STORAGE_KEY, '0');
    } catch {
      // Ignore
    }
  }, []);

  // Listen to user interaction events to record activity
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let throttleTimeout: NodeJS.Timeout | null = null;
    const handleUserActivity = () => {
      if (throttleTimeout) return;
      lastInteractionRef.current = Date.now();
      throttleTimeout = setTimeout(() => {
        throttleTimeout = null;
      }, 1000);
    };

    const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    // Global developer simulation command & keyboard shortcut
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Alt+B or Cmd+Alt+B to simulate break
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        triggerBreak();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Expose developer commands on window
    (window as any).triggerBreak = triggerBreak;
    (window as any).__openlyryc_trigger_break = triggerBreak;

    return () => {
      if (throttleTimeout) clearTimeout(throttleTimeout);
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [triggerBreak]);

  // Main 1-second screentime ticker
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const intervalId = setInterval(() => {
      if (isBreakActive) return;

      // Only accumulate screentime when tab is visible
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const timeSinceLastInteraction = Date.now() - lastInteractionRef.current;
        const isUserActive = isPlaying || timeSinceLastInteraction < IDLE_TIMEOUT_MS;

        if (isUserActive) {
          continuousSecondsRef.current += 1;
          if (continuousSecondsRef.current % 10 === 0) {
            try {
              sessionStorage.setItem(STORAGE_KEY, String(continuousSecondsRef.current));
            } catch {
              // Ignore
            }
          }

          if (continuousSecondsRef.current >= targetSeconds) {
            triggerBreak();
          }
        } else {
          // User has been idle for > 90 seconds (stepped away). Reset continuous screentime.
          continuousSecondsRef.current = 0;
          try {
            sessionStorage.setItem(STORAGE_KEY, '0');
          } catch {
            // Ignore
          }
        }
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isBreakActive, isPlaying, targetSeconds, triggerBreak]);

  return {
    isBreakActive,
    triggerBreak,
    finishBreak,
    safeIntervalMinutes,
  };
}
