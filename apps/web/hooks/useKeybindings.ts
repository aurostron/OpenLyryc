'use client';

import { useEffect } from 'react';
import type WaveSurfer from 'wavesurfer.js';

interface KeybindingsProps {
  wavesurfer: WaveSurfer | null;
  activeLineIndex: number;
  setActiveLineIndex: (idx: number | ((prev: number) => number)) => void;
  lineCount: number;
  onStampLineStart: (lineIdx: number, time: number) => void;
  onStampLineEnd: (lineIdx: number, time: number) => void;
  activeTokenIndex?: number;
  setActiveTokenIndex?: (idx: number | ((prev: number) => number)) => void;
  tokenCount?: number;
  onStampWordToken?: (lineIdx: number, tokenIdx: number, time: number) => void;
  onHoldTokenStart?: (lineIdx: number, tokenIdx: number, time: number) => void;
  onHoldTokenEnd?: (lineIdx: number, tokenIdx: number, time: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  /** Live sync calibration: nudge display offset by ±10ms. `[` = -10ms, `]` = +10ms */
  onSyncNudge?: (deltaMs: number) => void;
  onTogglePlay?: () => void;
  onSeekRelative?: (deltaSeconds: number) => void;
  onSyncingChange?: (isSyncing: boolean) => void;
  currentTime?: number;
  isInputFocused?: boolean;
  onSetLoop?: () => void;
  onToggleDock?: () => void;
}

export function useKeybindings({
  wavesurfer,
  activeLineIndex,
  setActiveLineIndex,
  lineCount,
  onStampLineStart,
  onStampLineEnd,
  activeTokenIndex = 0,
  setActiveTokenIndex,
  tokenCount = 0,
  onStampWordToken,
  onUndo,
  onRedo,
  onSyncNudge,
  onTogglePlay,
  onSeekRelative,
  onSyncingChange,
  currentTime = 0,
  isInputFocused = false,
  onHoldTokenStart,
  onHoldTokenEnd,
  onSetLoop,
  onToggleDock,
}: KeybindingsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard: Ignore shortcuts if user is typing in an input or textarea
      if (isInputFocused) return;
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      // 1. Search Focus (/ or Ctrl+K / Cmd+K)
      if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        const searchInput = document.getElementById('search-lyrics-input') as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // 2. Undo / Redo (Ctrl+Z / Cmd+Z, Ctrl+Shift+Z, Ctrl+Y)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        onRedo();
        return;
      }

      // 3. Toggle Left Actions Dock (Ctrl+B / Cmd+B)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        onToggleDock?.();
        return;
      }

      // 4. Play / Pause (Space)
      if (e.code === 'Space') {
        e.preventDefault();
        if (onTogglePlay) {
          onTogglePlay();
        } else if (wavesurfer) {
          wavesurfer.playPause();
        }
        return;
      }

      // 4. Stamp Line Start (Tab) & Stamp Line End (Shift + Tab)
      if (e.key === 'Tab') {
        e.preventDefault();
        const stampTime = wavesurfer && wavesurfer.getDuration() > 0 ? wavesurfer.getCurrentTime() : currentTime;
        if (e.shiftKey) {
          onStampLineEnd(activeLineIndex, stampTime);
        } else {
          onStampLineStart(activeLineIndex, stampTime);
          // Auto advance line focus
          if (activeLineIndex < lineCount - 1) {
            setActiveLineIndex((prev) => Math.min(prev + 1, lineCount - 1));
          }
        }
        return;
      }

      // 5. Word Token Stamping ('A' / 'D')
      if (e.key === 'a' || e.key === 'A') {
        if ((onStampWordToken || onHoldTokenStart) && tokenCount > 0) {
          e.preventDefault();
          const stampTime = wavesurfer && wavesurfer.getDuration() > 0 ? wavesurfer.getCurrentTime() : currentTime;
          if (e.shiftKey && setActiveTokenIndex) {
            // Step token backward
            setActiveTokenIndex((prev) => Math.max(0, prev - 1));
          } else {
            if (onHoldTokenStart) {
              onHoldTokenStart(activeLineIndex, activeTokenIndex, stampTime);
            } else if (onStampWordToken) {
              // Stamp current token
              onStampWordToken(activeLineIndex, activeTokenIndex, stampTime);
              if (setActiveTokenIndex) {
                if (activeTokenIndex < tokenCount - 1) {
                  setActiveTokenIndex((prev) => prev + 1);
                } else if (activeLineIndex < lineCount - 1) {
                  // Line completed, advance to next line
                  setActiveLineIndex((prev) => prev + 1);
                  setActiveTokenIndex(0);
                }
              }
            }
          }
          return;
        }
      }

      if (e.key === 'd' || e.key === 'D') {
        if (setActiveTokenIndex && tokenCount > 0) {
          e.preventDefault();
          setActiveTokenIndex((prev) => Math.min(tokenCount - 1, prev + 1));
          return;
        }
      }

      // 6. Line Navigation (Up / Down)
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveLineIndex((prev) => Math.max(0, prev - 1));
        if (setActiveTokenIndex) setActiveTokenIndex(0);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveLineIndex((prev) => Math.min(lineCount - 1, prev + 1));
        if (setActiveTokenIndex) setActiveTokenIndex(0);
        return;
      }

      // 7. Live Sync Calibration Nudge ('[' / ']' or '{' / '}')
      // Tap: ±100ms (noticeable shift), Shift+tap: ±10ms (fine calibration)
      if (
        e.code === 'BracketLeft' ||
        e.code === 'BracketRight' ||
        e.key === '[' ||
        e.key === ']' ||
        e.key === '{' ||
        e.key === '}'
      ) {
        if (onSyncNudge) {
          e.preventDefault();
          const isShift = e.shiftKey || e.key === '{' || e.key === '}';
          const step = isShift ? 10 : 100;
          const isLeft = e.code === 'BracketLeft' || e.key === '[' || e.key === '{';
          const delta = isLeft ? -step : step;
          onSyncNudge(delta);
        }
        return;
      }

      // Feature 3: Loop Region Bracket
      if (e.key === 'l' || e.key === 'L') {
        if (onSetLoop) {
          e.preventDefault();
          onSetLoop();
        }
        return;
      }

      // 8. Playhead Nudge (Left / Right) -> 100ms or 10ms with Shift
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 0.01 : 0.1; // 10ms vs 100ms
        const delta = e.key === 'ArrowLeft' ? -step : step;
        if (onSeekRelative) {
          onSeekRelative(delta);
        } else if (wavesurfer) {
          const newTime = Math.max(0, wavesurfer.getCurrentTime() + delta);
          wavesurfer.setTime(newTime);
        }
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.code === 'Space' || e.key === 'a' || e.key === 'A') {
        onSyncingChange?.(false);
      }
      if (!isInputFocused && (e.key === 'a' || e.key === 'A') && onHoldTokenEnd && tokenCount > 0) {
        const stampTime = wavesurfer && wavesurfer.getDuration() > 0 ? wavesurfer.getCurrentTime() : currentTime;
        onHoldTokenEnd(activeLineIndex, activeTokenIndex, stampTime);
        // advance token
        if (setActiveTokenIndex) {
          if (activeTokenIndex < tokenCount - 1) {
            setActiveTokenIndex((prev) => prev + 1);
          } else if (activeLineIndex < lineCount - 1) {
            setActiveLineIndex((prev) => prev + 1);
            setActiveTokenIndex(0);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    wavesurfer,
    activeLineIndex,
    setActiveLineIndex,
    lineCount,
    onStampLineStart,
    onStampLineEnd,
    activeTokenIndex,
    setActiveTokenIndex,
    tokenCount,
    onStampWordToken,
    onHoldTokenStart,
    onHoldTokenEnd,
    onUndo,
    onRedo,
    onSyncNudge,
    onTogglePlay,
    onSeekRelative,
    onSetLoop,
    onSyncingChange,
    currentTime,
    isInputFocused,
    onToggleDock,
  ]);
}
