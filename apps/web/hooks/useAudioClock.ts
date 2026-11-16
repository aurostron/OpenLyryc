'use client';

import { useEffect, useRef, useState } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { FramerateTarget } from '@/types/settings';

export interface AudioClockResult {
  /** Raw playback time in seconds — use for stamping timestamps (no offset applied) */
  rawTime: number;
  /** Display time with global offset + session nudge — use for rendering lyrics */
  displayTime: number;
}

/**
 * High-precision audio clock that drives lyrics rendering and timestamp stamping.
 *
 * Returns two values:
 * - rawTime:     exact playback position (seconds) — for recording/stamping
 * - displayTime: rawTime + globalOffset + sessionNudge — for visual rendering
 *
 * Direct derivation for YouTube/external audio ensures zero cascading render loops.
 */
export function useAudioClock(
  wavesurfer: WaveSurfer | null,
  framerateTarget: FramerateTarget = '60',
  externalFallbackTime: number = 0,
  globalOffsetMs: number = 0,
  sessionNudgeMs: number = 0,
  isDirectAudioMode: boolean = false
): AudioClockResult {
  const [localTime, setLocalTime] = useState<number>(0);
  const [hasLocalAudio, setHasLocalAudio] = useState<boolean>(false);
  const animFrameId = useRef<number | null>(null);
  const lastTickTime = useRef<number>(0);

  // P0 perf: cap React state emits at 60Hz (16.6ms). 'max' intentionally maps to
  // 16.6ms too — raw rAF interpolation stays smooth visually, but setLocalTime
  // no longer storms the tree at 120Hz. Use '30' (33.3ms) for power-saver.
  const frameIntervalMs =
    framerateTarget === '30' ? 33.3 : 16.6;

  // When switching away from direct audio mode (e.g. to YouTube mode), reset local flags
  useEffect(() => {
    if (!isDirectAudioMode) {
      setHasLocalAudio(false);
      setLocalTime(0);
    }
  }, [isDirectAudioMode]);

  useEffect(() => {
    if (!wavesurfer) {
      setHasLocalAudio(false);
      return;
    }

    let isRunning = false;

    const tick = (now: number) => {
      if (wavesurfer && wavesurfer.isPlaying()) {
        const elapsed = now - lastTickTime.current;

        if (elapsed >= frameIntervalMs) {
          lastTickTime.current = now;
          setLocalTime(wavesurfer.getCurrentTime());
        }

        animFrameId.current = requestAnimationFrame(tick);
      } else {
        isRunning = false;
        if (wavesurfer) {
          setLocalTime(wavesurfer.getCurrentTime());
        }
      }
    };

    const startLoop = () => {
      if (!isRunning) {
        isRunning = true;
        lastTickTime.current = performance.now();
        animFrameId.current = requestAnimationFrame(tick);
      }
    };

    const stopLoop = () => {
      isRunning = false;
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
        animFrameId.current = null;
      }
      if (wavesurfer) {
        setLocalTime(wavesurfer.getCurrentTime());
      }
    };

    const handleTimeUpdate = (currentTimeSeconds: number) => {
      // In background tab or minimized window, rAF loop is suspended by the browser.
      // Update local time directly from HTML5 audio timeupdate events so lyric sync never stalls.
      if (typeof document !== 'undefined' && document.hidden) {
        setLocalTime(currentTimeSeconds);
      } else if (!wavesurfer || !wavesurfer.isPlaying()) {
        setLocalTime(currentTimeSeconds);
      }
      if (currentTimeSeconds > 0) {
        setHasLocalAudio(true);
      }
    };

    const handleReadyOrDecode = (dur?: number) => {
      setHasLocalAudio(true);
      if (wavesurfer) {
        setLocalTime(wavesurfer.getCurrentTime());
      }
    };

    wavesurfer.on('play', startLoop);
    wavesurfer.on('pause', stopLoop);
    // NOTE: intentionally NOT stopping on 'seeking'. stopLoop cancels the rAF
    // clock, but no 'seeked'/'play' event follows a mid-playback seek to restart
    // it — the loop died while audio kept playing and lyrics froze forever.
    // The loop reads live currentTime, so seeks are reflected without a restart.
    wavesurfer.on('timeupdate', handleTimeUpdate);
    wavesurfer.on('ready', handleReadyOrDecode);
    wavesurfer.on('decode', handleReadyOrDecode);

    if (wavesurfer.getDuration() > 0) {
      setHasLocalAudio(true);
    } else {
      setHasLocalAudio(false);
    }

    if (wavesurfer.isPlaying()) {
      startLoop();
    } else {
      setLocalTime(wavesurfer.getCurrentTime());
    }

    return () => {
      stopLoop();
      wavesurfer.un('play', startLoop);
      wavesurfer.un('pause', stopLoop);
      wavesurfer.un('timeupdate', handleTimeUpdate);
      wavesurfer.un('ready', handleReadyOrDecode);
      wavesurfer.un('decode', handleReadyOrDecode);
    };
  }, [wavesurfer, frameIntervalMs]);

  // Derive time directly: if local audio or stream is active use wavesurfer local time, otherwise external fallback time
  const offsetSec = (globalOffsetMs + sessionNudgeMs) / 1000;
  const isLocalActive =
    isDirectAudioMode &&
    Boolean(wavesurfer && (hasLocalAudio || wavesurfer.getDuration() > 0));
  const rawTime = isLocalActive ? localTime : externalFallbackTime;
  const displayTime = rawTime + offsetSec;

  return { rawTime, displayTime };
}
