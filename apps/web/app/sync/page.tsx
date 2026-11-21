'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, ChevronRight, ChevronLeft, Check, Wifi, WifiOff, Rewind, FastForward } from 'lucide-react';
import { LyricLine, WordToken, interpolateWordTokens, normalizeTapTokens } from '@openlyryc/schema';
import { TapSyncPeer } from '@/lib/tapSync/TapSyncPeer';

const SECONDS_PER_PX = 0.05; // 20px of drag = 1 second of seek

function TapSyncClientContent() {
  const searchParams = useSearchParams();
  const roomParam = searchParams.get('room') || '';

  const [roomId, setRoomId] = useState<string>(roomParam.toUpperCase());
  const [inputCode, setInputCode] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [songTitle, setSongTitle] = useState<string>('OpenLyryc Studio');
  const [artist, setArtist] = useState<string>('');
  const [lines, setLines] = useState<LyricLine[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(0);
  const [activeTokenIndex, setActiveTokenIndex] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [lastTapFeedback, setLastTapFeedback] = useState<string | null>(null);
  const [showConnectedToast, setShowConnectedToast] = useState<boolean>(false);

  const peerRef = useRef<TapSyncPeer | null>(null);
  const audioClockRef = useRef<number>(0);
  audioClockRef.current = currentTime;

  // Format time mm:ss.xx
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  // Connect to room
  const connectToRoom = useCallback((code: string) => {
    if (!code.trim()) return;
    const cleanCode = code.toUpperCase().trim();
    setRoomId(cleanCode);

    if (peerRef.current) {
      peerRef.current.destroy();
    }

    const peer = new TapSyncPeer(cleanCode, false, {
      onPeerJoin: () => {
        setIsConnected(true);
        setShowConnectedToast(true);
        setTimeout(() => setShowConnectedToast(false), 3500);
      },
      onPeerLeave: () => {
        setIsConnected(false);
      },
      onInitReceived: (payload) => {
        if (!payload || !Array.isArray(payload.lines)) {
          return;
        }
        setSongTitle(payload.title || 'OpenLyryc Studio');
        setArtist(payload.artist || '');
        const incomingLines = payload.lines;
        setLines(incomingLines);
        setCurrentLineIndex(Math.min(payload.currentLineIndex || 0, Math.max(0, incomingLines.length - 1)));
        setCurrentTime(payload.currentTime || 0);
        setIsPlaying(payload.isPlaying || false);
        setIsFinished(false);
        setLastTapFeedback(null);
        setIsConnected(true);
        setShowConnectedToast(true);

        try {
          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([15, 30, 20]);
          }
        } catch {}

        setTimeout(() => setShowConnectedToast(false), 3500);

        // Find active token in current line
        const curLine = payload.lines[payload.currentLineIndex || 0];
        if (curLine && curLine.tokens) {
          const firstUnsynced = curLine.tokens.findIndex((t) => t.start === 0);
          setActiveTokenIndex(firstUnsynced >= 0 ? firstUnsynced : 0);
        }
      },
      onClockReceived: (time, playing) => {
        setCurrentTime(time);
        setIsPlaying(playing);
        setIsConnected(true);
      },
      onDocUpdateReceived: (updatedLines, activeIdx) => {
        setLines(updatedLines);
        setIsConnected(true);
        if (typeof activeIdx === 'number') {
          setCurrentLineIndex(activeIdx);
        }
      },
      onLinePatchReceived: (lineIndex, line) => {
        // Fast path: the studio pushed just the one line that changed
        setLines((prevLines) => {
          if (lineIndex < 0 || lineIndex >= prevLines.length) return prevLines;
          const nextLines = [...prevLines];
          nextLines[lineIndex] = line;
          return nextLines;
        });
        setIsConnected(true);
      },
      onError: (err) => {
        console.warn('[TapSync Mobile] Peer error:', err);
      },
    });

    peerRef.current = peer;
  }, []);

  useEffect(() => {
    if (roomParam) {
      connectToRoom(roomParam);
    }
    return () => {
      peerRef.current?.destroy();
    };
  }, [roomParam, connectToRoom]);

  // Keep requesting sync from desktop until song lines arrive
  useEffect(() => {
    if (!roomId) return;
    if (lines.length === 0) {
      const interval = setInterval(() => {
        if (peerRef.current && lines.length === 0) {
          peerRef.current.requestSync();
        }
      }, 1200);
      return () => clearInterval(interval);
    }
  }, [roomId, lines.length]);

  // Auto-follow the playback clock (mirrors the studio's follow-playhead behavior):
  // while playing, advance the displayed line as the studio does instead of waiting
  // for the next doc_update / pause to re-sync.
  useEffect(() => {
    if (!isPlaying || lines.length === 0) return;
    const t = currentTime;
    let idx = 0;
    for (let i = 0; i < lines.length; i++) {
      if ((lines[i].start ?? 0) <= t) idx = i;
    }
    if (idx !== currentLineIndex) {
      setCurrentLineIndex(idx);
      const newLine = lines[idx];
      const toks = newLine?.tokens || [];
      const firstUnsynced = toks.findIndex((tok) => tok.start === 0);
      setActiveTokenIndex(firstUnsynced >= 0 ? firstUnsynced : 0);
    }
  }, [currentTime, isPlaying, lines, currentLineIndex]);

  // Active Line & Words
  const activeLine = lines[currentLineIndex] || null;
  const tokens = React.useMemo(() => {
    if (!activeLine) return [];
    if (activeLine.tokens && activeLine.tokens.length > 0) {
      return activeLine.tokens;
    }
    const words = (activeLine.text || '').trim().split(/\s+/).filter(Boolean);
    return words.map((w) => ({ text: w, start: 0, end: 0 }));
  }, [activeLine]);

  // Haptic feedback
  const triggerHaptic = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(12);
      }
    } catch {}
  }, []);

  // Tap current word or specific word
  const handleTapWord = useCallback(
    (targetTokenIdx?: number) => {
      if (!activeLine || tokens.length === 0) return;

      const tokenIdx = typeof targetTokenIdx === 'number' ? targetTokenIdx : activeTokenIndex;
      if (tokenIdx >= tokens.length) return;

      const tapTimestamp = audioClockRef.current;
      triggerHaptic();

      const tappedWordText = tokens[tokenIdx]?.text || '';
      setLastTapFeedback(tappedWordText);
      setTimeout(() => setLastTapFeedback(null), 300);

      // Send to Studio peer
      peerRef.current?.sendWordTap(currentLineIndex, tokenIdx, tapTimestamp);

      // Local optimistic update
      setLines((prevLines) => {
        const nextLines = [...prevLines];
        const line = { ...nextLines[currentLineIndex] };
        if (line) {
          const currentTokens = line.tokens && line.tokens.length > 0 ? line.tokens : tokens;
          const newTokens: WordToken[] = currentTokens.map((tok, idx) => {
            if (idx === tokenIdx) {
              return {
                ...tok,
                start: tapTimestamp,
                end: tapTimestamp + 0.4,
              };
            }
            return tok;
          });

          // Run real-time syllable interpolation across tokens so far
          const normalized = normalizeTapTokens(newTokens, line.start || tapTimestamp, tapTimestamp + 1.2);
          line.tokens = interpolateWordTokens(normalized, line.start || tapTimestamp, tapTimestamp + 1.2);
          if (line.start === 0 || line.start > tapTimestamp) {
            line.start = tapTimestamp;
          }
          nextLines[currentLineIndex] = line;
        }
        return nextLines;
      });

      // Advance token index or move to next line if end of line reached
      if (tokenIdx + 1 < tokens.length) {
        setActiveTokenIndex(tokenIdx + 1);
      } else {
        // Line completed! Smooth advance to next sentence
        const lineEnd = tapTimestamp + 0.5;
        peerRef.current?.sendCompleteLine(currentLineIndex, lineEnd);

        if (currentLineIndex + 1 < lines.length) {
          setTimeout(() => {
            setCurrentLineIndex((prev) => prev + 1);
            setActiveTokenIndex(0);
          }, 180);
        } else {
          setIsFinished(true);
        }
      }
    },
    [activeLine, tokens, activeTokenIndex, currentLineIndex, lines.length, triggerHaptic]
  );

  // Undo last word tap
  const handleUndo = useCallback(() => {
    triggerHaptic();
    if (activeTokenIndex > 0) {
      const prevIdx = activeTokenIndex - 1;
      setActiveTokenIndex(prevIdx);
      peerRef.current?.sendUndo(currentLineIndex, prevIdx);
    } else if (currentLineIndex > 0) {
      const prevLineIdx = currentLineIndex - 1;
      setCurrentLineIndex(prevLineIdx);
      const prevLineTokens = lines[prevLineIdx]?.tokens || [];
      const lastTokenIdx = Math.max(0, prevLineTokens.length - 1);
      setActiveTokenIndex(lastTokenIdx);
      peerRef.current?.sendJumpLine(prevLineIdx);
    }
  }, [activeTokenIndex, currentLineIndex, lines, triggerHaptic]);

  // Jump to next line manually
  const handleSkipLine = useCallback(() => {
    triggerHaptic();
    if (currentLineIndex + 1 < lines.length) {
      const nextIdx = currentLineIndex + 1;
      setCurrentLineIndex(nextIdx);
      setActiveTokenIndex(0);
      peerRef.current?.sendJumpLine(nextIdx);
    }
  }, [currentLineIndex, lines.length, triggerHaptic]);

  // Rewind / forward the studio's authoritative clock by a relative delta
  const handleRewindForward = useCallback((deltaSeconds: number) => {
    triggerHaptic();
    const target = Math.max(0, audioClockRef.current + deltaSeconds);
    audioClockRef.current = target;
    setCurrentTime(target);
    peerRef.current?.sendSeek(target);
  }, [triggerHaptic]);

  // --- Drag-to-scrub ribbon (drag left = rewind, right = forward) ---
  const scrubStateRef = useRef<{ startX: number; baseTime: number; delta: number; lastSentAt: number } | null>(null);
  const [scrubDelta, setScrubDelta] = useState<number | null>(null);

  const finishScrub = useCallback(() => {
    const state = scrubStateRef.current;
    if (state) {
      const target = Math.max(0, state.baseTime + state.delta);
      peerRef.current?.sendSeek(target);
      triggerHaptic();
    }
    scrubStateRef.current = null;
    setScrubDelta(null);
  }, [triggerHaptic]);

  const handleScrubPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {}
    scrubStateRef.current = {
      startX: e.clientX,
      baseTime: audioClockRef.current,
      delta: 0,
      lastSentAt: 0,
    };
    setScrubDelta(0);
  }, []);

  const handleScrubPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = scrubStateRef.current;
      if (!state) return;
      const delta = (e.clientX - state.startX) * SECONDS_PER_PX;
      state.delta = delta;
      const target = Math.max(0, state.baseTime + delta);
      audioClockRef.current = target;
      setCurrentTime(target);
      setScrubDelta(delta);

      // Live-seek the desktop while dragging (throttled to ~7 seeks/sec)
      const now = performance.now();
      if (now - state.lastSentAt >= 150) {
        state.lastSentAt = now;
        peerRef.current?.sendSeek(target);
      }
    },
    []
  );

  // Toggle studio audio playback
  const handleTogglePlay = useCallback(() => {
    triggerHaptic();
    const nextPlay = !isPlaying;
    setIsPlaying(nextPlay);
    peerRef.current?.sendTogglePlay(nextPlay);
    if (lines.length === 0) {
      peerRef.current?.requestSync();
    }
  }, [isPlaying, lines.length, triggerHaptic]);

  // Screen 1: Connect / Pairing screen (if no room in URL)
  if (!roomId) {
    return (
      <main className="min-h-[100dvh] bg-[#000000] text-zinc-100 flex flex-col justify-between px-6 py-8 font-sans select-none touch-manipulation">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-white uppercase">OpenLyryc</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">Tap Sync</span>
          </div>
        </header>

        <div className="flex flex-col items-center text-center max-w-sm mx-auto my-auto w-full">
          <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">Connect to Studio</h1>
          <p className="text-sm text-zinc-400 mb-8 leading-relaxed">
            Scan the QR code displayed in OpenLyryc Studio on your computer, or enter the 4-digit code.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inputCode.length >= 4) {
                connectToRoom(inputCode);
              }
            }}
            className="w-full flex flex-col gap-4"
          >
            <input
              type="text"
              maxLength={4}
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="e.g. 7K9M"
              className="w-full text-center text-3xl font-bold tracking-widest uppercase py-4 rounded-3xl bg-white/[0.05] text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all border-0"
            />
            <button
              type="submit"
              disabled={inputCode.length < 4}
              className="w-full py-4 rounded-3xl bg-white text-black font-semibold text-base active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer border-0"
            >
              Connect
            </button>
          </form>
        </div>

        <footer className="text-center text-xs text-zinc-600">
          Super fast native WebRTC peer-to-peer connection
        </footer>
      </main>
    );
  }

  // Screen 2: Finished state
  if (isFinished) {
    return (
      <main className="min-h-[100dvh] bg-[#000000] text-white flex flex-col items-center justify-center p-6 text-center font-sans select-none">
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-6">
          <Check className="w-8 h-8 text-white stroke-[2.5]" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Sync Complete!</h1>
        <p className="text-sm text-zinc-400 max-w-xs mb-8">
          All sentences and words have been synced down to the syllable level and smoothed in OpenLyryc Studio.
        </p>
        <button
          onClick={() => {
            setIsFinished(false);
            setCurrentLineIndex(0);
            setActiveTokenIndex(0);
          }}
          className="px-6 py-3 rounded-xl bg-white text-black font-semibold text-sm active:scale-[0.98] transition-all"
        >
          Review & Sync Again
        </button>
      </main>
    );
  }

  // Screen 3: The Dedicated Tap Sync Surface (OLED Pitch Black, Zero Monospace, Non-Boxy, Zero Blinking Dots)
  return (
    <main className="min-h-[100dvh] bg-[#000000] text-zinc-100 flex flex-col justify-between overflow-hidden font-sans select-none touch-manipulation">
      {/* 1. Ultra-Discrete Status Header (No Harsh Borders, Solid Status) */}
      <header className="px-6 pt-5 pb-3 flex items-center justify-between text-xs text-zinc-400 shrink-0">
        <div className="flex items-center gap-2.5 truncate max-w-[60%]">
          <span className="font-semibold text-zinc-200 truncate">{songTitle}</span>
          {artist && <span className="text-zinc-500 truncate hidden sm:inline">· {artist}</span>}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            {isConnected ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                <span>Connected</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] text-zinc-400">
                <WifiOff className="w-3 h-3 text-zinc-500 stroke-[2]" />
                <span>Pairing</span>
              </span>
            )}
          </div>
          <span className="text-zinc-700">|</span>
          <span className="tabular-nums text-zinc-300 font-medium">
            {formatTime(currentTime)}
          </span>
        </div>
      </header>

      {/* Connection Success Toast / Hint */}
      <AnimatePresence>
        {showConnectedToast && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="mx-6 mt-3 px-4 py-2.5 rounded-2xl bg-white text-black flex items-center justify-between text-xs font-semibold shadow-2xl shadow-white/20 shrink-0"
          >
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Connected to Studio</span>
            </div>
            <span className="text-[10px] text-zinc-700 font-medium">Ready to Tap</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Main Lyric Focus Stage (One Sentence at a Time, Non-Boxy Organic Words) */}
      <section className="flex-1 flex flex-col justify-center px-6 py-4 max-w-xl mx-auto w-full relative">
        <div className="text-center mb-4 text-[11px] uppercase tracking-wider text-zinc-500 font-medium">
          Line {currentLineIndex + 1} of {Math.max(1, lines.length)}
          {activeLine?.section && <span className="text-zinc-400 ml-2">({activeLine.section})</span>}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentLineIndex}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 py-6"
          >
            {tokens.length > 0 ? (
              tokens.map((token, idx) => {
                const isSynced = token.start > 0;
                const isCurrent = idx === activeTokenIndex;

                return (
                  <button
                    key={`${currentLineIndex}-${idx}`}
                    type="button"
                    onClick={() => handleTapWord(idx)}
                    className={`relative px-4 py-2.5 rounded-2xl text-2xl sm:text-3xl font-semibold tracking-tight transition-all duration-150 cursor-pointer active:scale-[0.96] ${
                      isCurrent
                        ? 'text-white bg-white/20 shadow-xl shadow-black/50'
                        : isSynced
                        ? 'text-white/80 bg-white/[0.06]'
                        : 'text-zinc-600 hover:text-zinc-400 bg-transparent'
                    }`}
                  >
                    <span>{token.text}</span>
                  </button>
                );
              })
            ) : lines.length === 0 ? (
              <div className="text-center flex flex-col items-center gap-3 py-10 px-4">
                <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center text-zinc-400">
                  <Wifi className="w-5 h-5 stroke-[2]" />
                </div>
                <span className="text-zinc-200 font-semibold text-sm">
                  {isConnected ? 'Loading song lines from Studio...' : 'Connecting to Studio...'}
                </span>
                <p className="text-zinc-500 text-xs max-w-xs leading-relaxed">
                  Audio & lyrics load from OpenLyryc Studio on your computer. You can also tap the rhythm pad below to trigger playback.
                </p>
                <button
                  type="button"
                  onClick={() => peerRef.current?.requestSync()}
                  className="mt-2 px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-xs text-white font-medium active:scale-[0.98] transition-all cursor-pointer"
                >
                  Refresh Lyrics
                </button>
              </div>
            ) : (
              <div className="text-center text-zinc-500 text-lg">
                {activeLine?.text || 'Empty line'}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Visual Tap Indicator Ripple */}
        {lastTapFeedback && (
          <div className="absolute inset-x-0 bottom-2 flex justify-center pointer-events-none">
            <span className="text-xs uppercase font-medium tracking-widest text-zinc-400 bg-white/10 px-4 py-1.5 rounded-full">
              Synced: {lastTapFeedback}
            </span>
          </div>
        )}
      </section>

      {/* 3. Tactile Rhythm Tap Pad (Lower Half - Seamless Non-Boxy Surface) */}
      <section className="px-6 pb-6 pt-2 max-w-xl mx-auto w-full flex flex-col gap-3">
        {/* Giant Rhythm Tap Surface (Seamless, Zero Harsh Outlines) */}
        <button
          type="button"
          onClick={() => handleTapWord()}
          disabled={tokens.length === 0}
          className="w-full h-40 sm:h-48 rounded-[36px] bg-white/[0.06] hover:bg-white/[0.08] active:bg-white active:text-black text-white flex flex-col items-center justify-center gap-2 transition-all duration-75 shadow-2xl shadow-black active:scale-[0.98] cursor-pointer disabled:opacity-30 disabled:pointer-events-none border-0"
        >
          <span className="text-xl sm:text-2xl font-bold tracking-tight">TAP IN RHYTHM</span>
          <span className="text-xs text-zinc-400 group-active:text-zinc-800 font-medium">
            {tokens[activeTokenIndex]
              ? `Next Word: "${tokens[activeTokenIndex].text}"`
              : tokens.length === 0
              ? 'Waiting for lyrics in Studio'
              : 'Advance Line'}
          </span>
        </button>

        {/* Rewind / Forward Scrub Row (Drag left to rewind, right to fast-forward) */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => handleRewindForward(-5)}
            className="shrink-0 flex flex-col items-center justify-center gap-0.5 w-16 sm:w-20 h-14 sm:h-16 rounded-3xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.94] text-zinc-200 transition-all cursor-pointer border-0"
            aria-label="Rewind 5 seconds"
            title="Rewind 5 seconds"
          >
            <Rewind className="w-4 h-4 fill-current" />
            <span className="text-[10px] font-semibold tabular-nums text-zinc-400">5s</span>
          </button>

          <div
            role="slider"
            aria-label="Scrub audio timeline"
            aria-valuenow={Math.round(currentTime * 10) / 10}
            aria-valuemin={0}
            aria-valuemax={Math.round((audioClockRef.current + 120) * 10) / 10}
            tabIndex={0}
            onPointerDown={handleScrubPointerDown}
            onPointerMove={handleScrubPointerMove}
            onPointerUp={finishScrub}
            onPointerCancel={finishScrub}
            onLostPointerCapture={finishScrub}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                handleRewindForward(-2);
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                handleRewindForward(2);
              }
            }}
            className="relative flex-1 h-14 sm:h-16 rounded-3xl bg-white/[0.04] hover:bg-white/[0.07] active:bg-white/[0.09] flex flex-col items-center justify-center overflow-hidden touch-none select-none cursor-ew-resize transition-colors outline-none focus-visible:ring-1 focus-visible:ring-white/30"
          >
            {/* Fine hairline playhead in the middle */}
            <div className="absolute inset-y-2 left-1/2 w-px bg-white/10 pointer-events-none" />
            <ChevronLeft className="absolute left-1.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700 pointer-events-none" strokeWidth={2.5} />
            <ChevronRight className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700 pointer-events-none" strokeWidth={2.5} />

            {scrubDelta === null ? (
              <>
                <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-semibold">
                  Drag to Scrub
                </span>
                <span className="text-[9px] text-zinc-600 font-medium mt-0.5">
                  Left rewinds · Right forwards
                </span>
              </>
            ) : (
              <>
                <span className="text-lg font-bold tabular-nums text-white leading-none">
                  {scrubDelta >= 0 ? '+' : ''}
                  {scrubDelta.toFixed(1)}s
                </span>
                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-medium mt-1">
                  Release to seek
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleRewindForward(5)}
            className="shrink-0 flex flex-col items-center justify-center gap-0.5 w-16 sm:w-20 h-14 sm:h-16 rounded-3xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.94] text-zinc-200 transition-all cursor-pointer border-0"
            aria-label="Forward 5 seconds"
            title="Forward 5 seconds"
          >
            <FastForward className="w-4 h-4 fill-current" />
            <span className="text-[10px] font-semibold tabular-nums text-zinc-400">5s</span>
          </button>
        </div>

        {/* Bottom Utility Micro-Bar (Non-Boxy, Organic Pills) */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleUndo}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-medium text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.96] transition-all cursor-pointer border-0"
            title="Undo last tapped word"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>

          <button
            type="button"
            onClick={handleTogglePlay}
            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-semibold text-white bg-white/15 hover:bg-white/20 active:scale-[0.96] transition-all cursor-pointer border-0"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSkipLine}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-medium text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.96] transition-all cursor-pointer border-0"
            title="Skip to next sentence"
          >
            <span>Skip Line</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>
    </main>
  );
}

export default function TapSyncPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-[#000000] text-zinc-400 flex items-center justify-center font-sans text-sm">
          Loading OpenLyryc Tap Sync...
        </div>
      }
    >
      <TapSyncClientContent />
    </Suspense>
  );
}
