'use client';

import React, { useEffect, useRef, useState } from 'react';
import { refreshYtAuth, subscribeYtAuth } from '@/lib/studioConnect';
import { parseYouTubeMusicId } from '@/lib/platformLinker';

export type StudioConnectStatus = 'idle' | 'loading' | 'playing' | 'error';

/**
 * Belt-and-braces: `fetchTrackFile` bounds every stage itself (timeout.ts);
 * their worst case (20 s session + 45 s resolve + 8 s manifest + 60 s download)
 * stays under this watchdog, so a real stage error is what the user sees. Only
 * a chain that somehow never settles hits the generic message.
 */
const WATCHDOG_MS = 180_000;

interface StudioConnectPlayerProps {
  youtubeId?: string;
  /** audioSourceMode === 'connect'. When it flips false, any in-flight resolution is aborted. */
  isOpen: boolean;
  /** Fires once per track with the downloaded file (the Studio ingests it like a dropped file). */
  onResolvedFile?: (file: File, title: string) => void;
  /** A human-readable failure; the track did not load. */
  onError?: (message: string) => void;
  onStatusChange?: (status: StudioConnectStatus) => void;
}

/**
 * OpenLyryc Studio Connect: resolves the YouTube Music track the document
 * points at and downloads it straight into the Studio through the companion
 * extension — no embed, no iframe, no daemon. The file is handed to
 * `onResolvedFile`, where the Studio ingests it exactly like a dropped local
 * file (peaks, waveform, 60fps clock, scrubbing).
 *
 * The heavy lifting (InnerTube, BotGuard) is dynamically imported, so none of
 * it is in the critical bundle. Invisible: renders null.
 */
export const StudioConnectPlayer: React.FC<StudioConnectPlayerProps> = ({
  youtubeId,
  isOpen,
  onResolvedFile,
  onError,
  onStatusChange,
}) => {
  const [engineReady, setEngineReady] = useState(false);
  const fetchRef = useRef<typeof import('@/lib/studioConnect/resolveFile').fetchTrackFile | null>(null);

  const onResolvedFileRef = useRef(onResolvedFile);
  const onErrorRef = useRef(onError);
  const onStatusRef = useRef(onStatusChange);
  useEffect(() => {
    onResolvedFileRef.current = onResolvedFile;
    onErrorRef.current = onError;
    onStatusRef.current = onStatusChange;
  });

  const cleanVideoId = React.useMemo(() => (youtubeId ? parseYouTubeMusicId(youtubeId) : null), [youtubeId]);
  const lastResolvedIdRef = useRef<string | null>(null);
  const inFlightRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWatchdog = () => {
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = null;
  };

  const setStatus = (status: StudioConnectStatus) => onStatusRef.current?.(status);

  // Load the resolver once (it drags YouTube.js + BotGuard in behind it).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const mod = await import('@/lib/studioConnect/resolveFile');
        if (cancelled) return;
        fetchRef.current = mod.fetchTrackFile;
        setEngineReady(true);
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          onErrorRef.current?.(`Studio Connect failed to start: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cancel bytes and invalidate callbacks on unmount.
  useEffect(
    () => () => {
      generationRef.current++;
      abortRef.current?.abort();
      clearWatchdog();
    },
    [],
  );

  // Keep the auth snapshot fresh (sign-in elsewhere in the browser).
  useEffect(() => subscribeYtAuth(), []);

  // ── Resolving / downloading tracks ──────────────────────────────────────────
  useEffect(() => {
    const fetchTrack = fetchRef.current;
    if (!engineReady || !fetchTrack) return;
    if (!isOpen) {
      // Abort whatever is in flight and cancel the bytes on the wire; the
      // track already in the studio stays cached.
      generationRef.current++;
      abortRef.current?.abort();
      abortRef.current = null;
      inFlightRef.current = null;
      clearWatchdog();
      setStatus('idle');
      return;
    }
    if (!cleanVideoId) {
      setStatus('idle');
      return;
    }
    if (lastResolvedIdRef.current === cleanVideoId) return;
    if (inFlightRef.current === cleanVideoId) return;
    inFlightRef.current = cleanVideoId;
    const generation = ++generationRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');
    clearWatchdog();
    watchdogRef.current = setTimeout(() => {
      if (generation !== generationRef.current) return;
      controller.abort();
      inFlightRef.current = null;
      lastResolvedIdRef.current = null;
      setStatus('error');
      onErrorRef.current?.('Studio Connect timed out while fetching the track — check your connection and retry.');
    }, WATCHDOG_MS);
    void refreshYtAuth().catch(() => null);
    fetchTrack(cleanVideoId, controller.signal)
      .then(({ file, title }) => {
        clearWatchdog();
        if (generation !== generationRef.current) return; // superseded
        lastResolvedIdRef.current = cleanVideoId;
        inFlightRef.current = null;
        setStatus('playing');
        onResolvedFileRef.current?.(file, title);
      })
      .catch((error: unknown) => {
        clearWatchdog();
        if (generation !== generationRef.current) return;
        if (controller.signal.aborted) return; // intentional abort, not a failure
        inFlightRef.current = null;
        lastResolvedIdRef.current = null; // allow a retry
        setStatus('error');
        const message = error instanceof Error ? error.message : String(error);
        onErrorRef.current?.(message);
      });
  }, [engineReady, isOpen, cleanVideoId]);

  return null;
};
