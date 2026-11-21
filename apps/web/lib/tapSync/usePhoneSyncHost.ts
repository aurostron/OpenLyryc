'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LyricLine, WordToken, generateTapSyncRoomId, interpolateWordTokens, normalizeTapTokens } from '@openlyryc/schema';
import { TapSyncPeer } from '@/lib/tapSync/TapSyncPeer';

export interface UsePhoneSyncHostOptions {
  lines: LyricLine[];
  currentTime: number;
  isPlaying: boolean;
  songTitle: string;
  artist: string;
  duration: number;
  activeLineIndex: number;
  /** Bumped by the editor reducer on wholesale document/metadata changes —
   *  drives automatic re-push of lyrics to the companion after a track swap. */
  documentRevision?: number;
  onUpdateLines: (updater: (prevLines: LyricLine[]) => LyricLine[]) => void;
  onSetActiveLineIndex: (idx: number) => void;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
}

export interface PhoneSyncHostSession {
  /** Stable 4-character room code for the lifetime of the studio session */
  roomId: string;
  /** Whether a phone is currently connected */
  phoneConnected: boolean;
  /** Live synced-word stats, derived from the document */
  syncedWordStats: { stamped: number; total: number };
  /** Lazily create (or return) the sticky host peer. Connection persists after the modal closes. */
  ensureSession: () => TapSyncPeer | null;
  /** Broadcast the current session (title, lines, clock) to the phone. Pass overrideLines to push a fresh document. */
  broadcastSessionInit: (overrideLines?: LyricLine[]) => void;
  /** Direct access to the peer (may be null before the first modal open) */
  peerRef: React.MutableRefObject<TapSyncPeer | null>;
}

/**
 * Owns the studio-side Phone Tap Sync host session.
 *
 * Lifecycle: created lazily on the first Phone Tap Sync modal open, kept alive
 * until the studio unmounts. Closing the modal never tears down the socket, so
 * the companion stays paired (dock shows a steady dot) and re-opening the
 * modal shows the same room code and live stats.
 */
export function usePhoneSyncHost({
  lines,
  currentTime,
  isPlaying,
  songTitle,
  artist,
  duration,
  activeLineIndex,
  documentRevision,
  onUpdateLines,
  onSetActiveLineIndex,
  onTogglePlay,
  onSeek,
}: UsePhoneSyncHostOptions): PhoneSyncHostSession {
  const [roomId] = useState<string>(() => generateTapSyncRoomId());
  const [phoneConnected, setPhoneConnected] = useState<boolean>(false);
  const [syncedWordStats, setSyncedWordStats] = useState<{ stamped: number; total: number }>({
    stamped: 0,
    total: 0,
  });

  const peerRef = useRef<TapSyncPeer | null>(null);
  const currentTimeRef = useRef<number>(0);
  currentTimeRef.current = currentTime;
  const isPlayingRef = useRef<boolean>(false);
  isPlayingRef.current = isPlaying;
  const linesRef = useRef<LyricLine[]>(lines);
  linesRef.current = lines;
  const songTitleRef = useRef<string>(songTitle);
  songTitleRef.current = songTitle;
  const artistRef = useRef<string>(artist);
  artistRef.current = artist;
  const durationRef = useRef<number>(duration);
  durationRef.current = duration;
  const activeLineIndexRef = useRef<number>(activeLineIndex);
  activeLineIndexRef.current = activeLineIndex;
  const onUpdateLinesRef = useRef(onUpdateLines);
  onUpdateLinesRef.current = onUpdateLines;
  const onSetActiveLineIndexRef = useRef(onSetActiveLineIndex);
  onSetActiveLineIndexRef.current = onSetActiveLineIndex;
  const onTogglePlayRef = useRef(onTogglePlay);
  onTogglePlayRef.current = onTogglePlay;
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;

  const stampLineTokens = useCallback((rawTokens: WordToken[], lineStart: number, boundaryEnd: number) => {
    const normalized = normalizeTapTokens(rawTokens, lineStart || undefined, boundaryEnd);
    return interpolateWordTokens(normalized, lineStart || 0, boundaryEnd);
  }, []);

  // Broadcast session init (full document) to the connected phone
  const broadcastSessionInit = useCallback((overrideLines?: LyricLine[]) => {
    const peer = peerRef.current;
    if (!peer) return;
    const baseLines = overrideLines ?? linesRef.current ?? [];
    let needsTokenize = false;
    const tokenizedLines: LyricLine[] = baseLines.map((l) => {
      if (l.tokens && l.tokens.length > 0) return l;
      const words = (l.text || '').trim().split(/\s+/).filter(Boolean);
      needsTokenize = true;
      return {
        ...l,
        tokens: words.map((w) => ({ text: w, start: 0, end: 0 })),
      };
    });

    // Only push the re-tokenized document back into the studio if something actually changed
    if (needsTokenize) {
      onUpdateLinesRef.current(() => tokenizedLines);
    }

    peer.sendSessionInit({
      title: songTitleRef.current || 'Untitled Track',
      artist: artistRef.current || '',
      duration: durationRef.current || 0,
      lines: tokenizedLines,
      currentLineIndex: overrideLines ? 0 : activeLineIndexRef.current || 0,
      isPlaying: isPlayingRef.current,
      currentTime: currentTimeRef.current,
    });
  }, []);

  // Create / reuse the sticky host peer. Called on the first modal open and kept alive until unmount.
  const ensureSession = useCallback((): TapSyncPeer | null => {
    if (peerRef.current) return peerRef.current;
    if (typeof window === 'undefined') return null;

    const peer = new TapSyncPeer(roomId, true, {
      onPeerJoin: () => {
        setPhoneConnected(true);
        broadcastSessionInit();
      },
      onPeerLeave: () => {
        setPhoneConnected(false);
      },
      onRequestSync: () => {
        setPhoneConnected(true);
        broadcastSessionInit();
      },
      onTapReceived: (lineIdx, tokenIdx, timestamp) => {
        // Authoritative timestamp from the studio audio clock
        const authoritativeTime = currentTimeRef.current > 0 ? currentTimeRef.current : timestamp;
        const curLine = linesRef.current[lineIdx];
        if (!curLine) return;

        const baseTokens: WordToken[] =
          curLine.tokens && curLine.tokens.length > 0
            ? curLine.tokens
            : (curLine.text || '')
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .map((w) => ({ text: w, start: 0, end: 0 }));

        const updatedTokens: WordToken[] = baseTokens.map((tok, idx) =>
          idx === tokenIdx ? { ...tok, start: authoritativeTime, end: authoritativeTime + 0.35 } : tok
        );

        const smoothed = stampLineTokens(
          updatedTokens,
          curLine.start || authoritativeTime,
          authoritativeTime + 1.2
        );

        const patchedLine: LyricLine = {
          ...curLine,
          start: curLine.start === 0 ? authoritativeTime : Math.min(curLine.start, authoritativeTime),
          tokens: smoothed,
        };

        onUpdateLinesRef.current((prevLines) => {
          const next = [...prevLines];
          next[lineIdx] = patchedLine;
          return next;
        });

        // Fast path: send ONLY the changed line (≈1KB) instead of the whole document
        peerRef.current?.sendLinePatch(lineIdx, patchedLine);
      },
      onCompleteLineReceived: (lineIdx, endTime) => {
        const finalTime = currentTimeRef.current > 0 ? currentTimeRef.current : endTime;
        const curLine = linesRef.current[lineIdx];
        if (!curLine) return;

        const smoothed = stampLineTokens(
          curLine.tokens || [],
          curLine.start,
          finalTime
        );

        const patchedLine: LyricLine = {
          ...curLine,
          end: finalTime,
          tokens: smoothed,
        };

        onUpdateLinesRef.current((prevLines) => {
          const next = [...prevLines];
          next[lineIdx] = patchedLine;
          return next;
        });

        const nextLineIdx = Math.min(linesRef.current.length - 1, lineIdx + 1);
        onSetActiveLineIndexRef.current(nextLineIdx);
        peerRef.current?.sendLinePatch(lineIdx, patchedLine);
      },
      onUndoReceived: (lineIdx, tokenIdx) => {
        const curLine = linesRef.current[lineIdx];
        if (!curLine || !curLine.tokens) return;

        const updatedTokens = curLine.tokens.map((tok, idx) =>
          idx === tokenIdx ? { ...tok, start: 0, end: 0 } : tok
        );

        const patchedLine: LyricLine = { ...curLine, tokens: updatedTokens };

        onUpdateLinesRef.current((prevLines) => {
          const next = [...prevLines];
          next[lineIdx] = patchedLine;
          return next;
        });
        peerRef.current?.sendLinePatch(lineIdx, patchedLine);
      },
      onJumpLineReceived: (lineIdx) => {
        onSetActiveLineIndexRef.current(lineIdx);
        const targetLine = linesRef.current[lineIdx];
        if (targetLine && targetLine.start > 0) {
          onSeekRef.current(targetLine.start);
        }
      },
      onTogglePlayReceived: () => {
        onTogglePlayRef.current();
        // The 80ms clock broadcast reconciles the phone's isPlaying state
        peerRef.current?.sendClock(currentTimeRef.current, isPlayingRef.current);
      },
      onSeekReceived: (time) => {
        onSeekRef.current(time);
        peerRef.current?.sendClock(Math.max(0, time), isPlayingRef.current);
      },
    });

    peerRef.current = peer;
    return peer;
  }, [roomId, broadcastSessionInit, stampLineTokens]);

  // Auto re-push lyrics to the companion after a track swap / new file / song change.
  // Debounced trailing 600ms (song loads fire metadata + document in quick succession).
  const lastRevisionRef = useRef<number | undefined>(undefined);
  const resyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (documentRevision === undefined) return;
    if (lastRevisionRef.current === undefined) {
      lastRevisionRef.current = documentRevision;
      return;
    }
    if (documentRevision === lastRevisionRef.current) return;
    lastRevisionRef.current = documentRevision;
    if (resyncTimerRef.current) clearTimeout(resyncTimerRef.current);
    resyncTimerRef.current = setTimeout(() => {
      resyncTimerRef.current = null;
      broadcastSessionInit();
    }, 600);
  }, [documentRevision, broadcastSessionInit]);

  // Destroy the peer only when the studio itself unmounts — never on modal close
  useEffect(() => {
    return () => {
      if (resyncTimerRef.current) clearTimeout(resyncTimerRef.current);
      peerRef.current?.destroy();
      peerRef.current = null;
    };
  }, []);

  // Stream audio clock ticks to the phone while connected
  useEffect(() => {
    if (!phoneConnected) return;
    const interval = setInterval(() => {
      peerRef.current?.sendClock(currentTimeRef.current, isPlayingRef.current);
    }, 80);
    return () => clearInterval(interval);
  }, [phoneConnected]);

  // Live synced-word stats
  useEffect(() => {
    let stamped = 0;
    let total = 0;
    for (const line of lines) {
      if (line.tokens && line.tokens.length > 0) {
        total += line.tokens.length;
        stamped += line.tokens.filter((t) => t.start > 0).length;
      }
    }
    setSyncedWordStats({ stamped, total });
  }, [lines]);

  return useMemo(
    () => ({
      roomId,
      phoneConnected,
      syncedWordStats,
      ensureSession,
      broadcastSessionInit,
      peerRef,
    }),
    [roomId, phoneConnected, syncedWordStats, ensureSession, broadcastSessionInit]
  );
}
