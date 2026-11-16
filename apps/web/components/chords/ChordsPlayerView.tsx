'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  Share2,
  Search,
  Palette,
  Disc,
  SlidersHorizontal,
  Layers,
  Check,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { ChordSongConfig } from '@/lib/data/chordsData';
import { GuitarChordDiagram } from './GuitarChordDiagram';
import { HorizontalChordCarousel } from './HorizontalChordCarousel';
import { transposeChord } from '@/lib/chords/transpose';
import {
  buildChordTimelineFromLyricLines,
  buildFallbackChordTimeline,
  getActiveChordFrame,
  getActiveLineIndex,
  SyncedChordFrame,
} from '@/lib/chords/beatSyncEngine';
import { resolveTrackLyrics } from '@/lib/lyricsResolver';
import { LyricLine } from '@/types/lyrics';
import { YouTubeEmbedPlayer, YouTubeDisplayMode } from '@/components/lyrics/YouTubeEmbedPlayer';
import { YouTubeFetcherModal } from '@/components/lyrics/YouTubeFetcherModal';
import { BackgroundCustomizerModal, BackgroundConfig } from '@/components/lyrics/BackgroundCustomizerModal';
import { QuickSearchModal } from '@/components/lyrics/QuickSearchModal';
import { OpenLyrycLogo } from '@/components/OpenLyrycLogo';

const YouTubeIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.377.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

interface ChordsPlayerViewProps {
  song: ChordSongConfig;
  initialYoutubeId?: string | null;
  bgConfig: BackgroundConfig;
  onUpdateBgConfig: (cfg: BackgroundConfig) => void;
  onBackToSearch: () => void;
  onSelectSong: (song: ChordSongConfig) => void;
}

function formatTime(seconds?: number): string {
  if (seconds === undefined || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Transposes a LyricLine's text content (not timestamps) — no-op for now, placeholder */
function applyTransposeToLine(line: LyricLine, _semitones: number): LyricLine {
  return line;
}

export const ChordsPlayerView: React.FC<ChordsPlayerViewProps> = ({
  song,
  initialYoutubeId = null,
  bgConfig,
  onUpdateBgConfig,
  onBackToSearch,
  onSelectSong,
}) => {
  // ── Transposition & Playback State ────────────────────────────────────────
  const [transpose, setTranspose] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // ── Live Lyrics State ─────────────────────────────────────────────────────
  const [resolvedLines, setResolvedLines] = useState<LyricLine[]>([]);
  const [lyricsStatus, setLyricsStatus] = useState<'loading' | 'ready' | 'fallback' | 'error'>('loading');
  const resolveAbortRef = useRef<AbortController | null>(null);

  // ── Audio & YouTube Sync State ────────────────────────────────────────────
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(
    initialYoutubeId || song.youtubeId || null
  );
  const [ytDisplayMode, setYtDisplayMode] = useState<YouTubeDisplayMode>('side');
  const [showVideoInsteadOfCover, setShowVideoInsteadOfCover] = useState(true);
  const [syncOffset, setSyncOffset] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [seekTrigger, setSeekTrigger] = useState<{ time: number; timestamp: number } | null>(null);

  // ── Modals State ──────────────────────────────────────────────────────────
  const [isYtModalOpen, setIsYtModalOpen] = useState(false);
  const [isBgModalOpen, setIsBgModalOpen] = useState(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  // ── Auto-Hide Header on Inactivity / Hover Logic ──────────────────────────
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const hideHeaderTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isAnyModalOpen = isYtModalOpen || isBgModalOpen || isQuickSearchOpen;

  const scheduleHeaderHide = useCallback(() => {
    if (hideHeaderTimerRef.current) clearTimeout(hideHeaderTimerRef.current);
    hideHeaderTimerRef.current = setTimeout(() => {
      setIsHeaderVisible(false);
    }, 3500);
  }, []);

  const handleUserActivity = useCallback(() => {
    setIsHeaderVisible(true);
    if (!isHeaderHovered && !isAnyModalOpen) {
      scheduleHeaderHide();
    }
  }, [isHeaderHovered, isAnyModalOpen, scheduleHeaderHide]);

  useEffect(() => {
    const onActivity = () => handleUserActivity();
    window.addEventListener('mousemove', onActivity);
    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('touchstart', onActivity);
    window.addEventListener('keydown', onActivity);

    scheduleHeaderHide();

    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('touchstart', onActivity);
      window.removeEventListener('keydown', onActivity);
      if (hideHeaderTimerRef.current) clearTimeout(hideHeaderTimerRef.current);
    };
  }, [handleUserActivity, scheduleHeaderHide]);

  useEffect(() => {
    if (isAnyModalOpen || isHeaderHovered) {
      setIsHeaderVisible(true);
      if (hideHeaderTimerRef.current) clearTimeout(hideHeaderTimerRef.current);
    } else {
      scheduleHeaderHide();
    }
  }, [isAnyModalOpen, isHeaderHovered, scheduleHeaderHide]);

  // ── Fetch live lyrics from the resolver ───────────────────────────────────
  useEffect(() => {
    setLyricsStatus('loading');
    setResolvedLines([]);

    // Cancel any in-flight request from a previous song
    if (resolveAbortRef.current) {
      resolveAbortRef.current.abort();
    }
    const controller = new AbortController();
    resolveAbortRef.current = controller;

    resolveTrackLyrics(
      { title: song.title, artist: song.artist },
      controller.signal
    )
      .then((doc) => {
        if (controller.signal.aborted) return;
        if (doc && doc.lines && doc.lines.length > 0) {
          setResolvedLines(doc.lines);
          setLyricsStatus('ready');
          if (doc.metadata.duration && doc.metadata.duration > 0) {
            setDuration(doc.metadata.duration);
          } else {
            const lastLine = doc.lines[doc.lines.length - 1];
            setDuration(Math.max(180, Math.ceil(lastLine.end || lastLine.start + 10)));
          }
        } else {
          setLyricsStatus('fallback');
        }
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        console.warn('[ChordsPlayer] Lyrics resolve failed, using fallback:', err);
        setLyricsStatus('fallback');
      });

    return () => {
      controller.abort();
    };
  }, [song.id, song.title, song.artist]);

  // ── Transposed chord names (for the "Chords Used" list) ──────────────────
  const transposedChordsUsed = useMemo(
    () => song.chordsUsed.map((c) => transposeChord(c, transpose)),
    [song.chordsUsed, transpose]
  );

  // ── Transposed annotations ────────────────────────────────────────────────
  const transposedAnnotations = useMemo(
    () =>
      song.chordAnnotations.map((ann) => ({
        ...ann,
        chord: transposeChord(ann.chord, transpose),
      })),
    [song.chordAnnotations, transpose]
  );

  // ── Build chord timeline ──────────────────────────────────────────────────
  const chordTimeline = useMemo<SyncedChordFrame[]>(() => {
    if (lyricsStatus === 'ready' && resolvedLines.length > 0) {
      return buildChordTimelineFromLyricLines(
        resolvedLines,
        transposedAnnotations,
        song.bpm,
        song.timeSignature
      );
    }
    if (lyricsStatus === 'fallback') {
      // Use BPM estimation when no lyrics found
      return buildFallbackChordTimeline(transposedAnnotations, {
        bpm: song.bpm,
        timeSignature: song.timeSignature,
        introOffset: 0,
      }, Math.max(...transposedAnnotations.map((a) => a.lineIndex)) + 1);
    }
    return [];
  }, [lyricsStatus, resolvedLines, transposedAnnotations, song.bpm, song.timeSignature]);

  // ── Active line index from real timestamps ────────────────────────────────
  const activeLineIndex = useMemo(
    () => getActiveLineIndex(resolvedLines, currentTime),
    [resolvedLines, currentTime]
  );

  // ── Active chord frame ────────────────────────────────────────────────────
  const activeChordFrame = useMemo(
    () => getActiveChordFrame(chordTimeline, currentTime),
    [chordTimeline, currentTime]
  );

  const currentChord = activeChordFrame?.chord || transposedChordsUsed[0] || 'G';
  const nextChord = activeChordFrame?.nextChord || null;
  const prevChord = activeChordFrame?.prevChord || null;

  // ── Current and next display lines ───────────────────────────────────────
  const currentLine = resolvedLines[activeLineIndex] || null;
  const nextLine = resolvedLines[activeLineIndex + 1] || null;

  // ── Master Clock Fallback (no YouTube video attached) ────────────────────
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isPlaying && !youtubeVideoId) {
      timer = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 0.25;
          const end = duration > 0 ? duration : 360;
          if (next >= end) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }, 250);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, youtubeVideoId, duration]);

  // ── Seek helpers ─────────────────────────────────────────────────────────
  const handleSeek = useCallback(
    (time: number) => {
      const end = duration > 0 ? duration : 360;
      const clamped = Math.max(0, Math.min(time, end));
      setCurrentTime(clamped);
      setSeekTrigger({ time: clamped, timestamp: Date.now() });
    },
    [duration]
  );

  const handlePrevLine = () => {
    const prevIdx = Math.max(0, activeLineIndex - 1);
    const line = resolvedLines[prevIdx];
    if (line) handleSeek(line.start);
  };

  const handleNextLine = () => {
    const nextIdx = Math.min(resolvedLines.length - 1, activeLineIndex + 1);
    const line = resolvedLines[nextIdx];
    if (line) handleSeek(line.start);
  };

  // ── Curvy S-Curve Scrubber Engine (Matching Reference) ────────────────────
  const CURVE_PATH_D = 'M 15 35 C 80 58, 140 50, 200 30 C 260 10, 320 12, 385 35';
  const curvePathRef = useRef<SVGPathElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [pathLength, setPathLength] = useState<number>(400);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [isScrubberHovered, setIsScrubberHovered] = useState<boolean>(false);

  useEffect(() => {
    if (curvePathRef.current) {
      const len = curvePathRef.current.getTotalLength();
      if (len > 0) setPathLength(len);
    }
  }, []);

  const progressRatio = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;

  const knobPos = useMemo(() => {
    if (typeof window !== 'undefined' && curvePathRef.current && pathLength > 0) {
      try {
        const pt = curvePathRef.current.getPointAtLength(progressRatio * pathLength);
        return { x: pt.x, y: pt.y };
      } catch {
        // Fallback below
      }
    }
    const x = 15 + progressRatio * 370;
    const y = 35 - Math.sin((progressRatio - 0.25) * Math.PI * 2) * 16;
    return { x, y };
  }, [progressRatio, pathLength]);

  const handleScrubberSeek = useCallback(
    (clientX: number) => {
      if (!progressBarRef.current) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const rawRatio = (clientX - rect.left) / rect.width;
      const curveStart = 15 / 400;
      const curveEnd = 385 / 400;
      const ratio = Math.max(0, Math.min(1, (rawRatio - curveStart) / (curveEnd - curveStart)));
      const targetTime = ratio * (duration || 180);
      handleSeek(targetTime);
    },
    [duration, handleSeek]
  );

  const handleScrubberMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsScrubbing(true);
    handleScrubberSeek(e.clientX);

    const onMouseMove = (moveEvent: MouseEvent) => {
      handleScrubberSeek(moveEvent.clientX);
    };

    const onMouseUp = () => {
      setIsScrubbing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleScrubberTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    const touch = e.touches[0];
    if (touch) handleScrubberSeek(touch.clientX);

    const onTouchMove = (moveEvent: TouchEvent) => {
      const t = moveEvent.touches[0];
      if (t) handleScrubberSeek(t.clientX);
    };

    const onTouchEnd = () => {
      setIsScrubbing(false);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };

    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
  };

  // ── Share ─────────────────────────────────────────────────────────────────
  const handleShare = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('id', song.id);
    if (transpose !== 0) url.searchParams.set('transpose', transpose.toString());
    if (youtubeVideoId) url.searchParams.set('yt', youtubeVideoId);
    navigator.clipboard.writeText(url.toString());
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  return (
    <div className="fixed inset-0 flex flex-col text-white selection:bg-white/20 selection:text-white overflow-hidden bg-[#08080a] font-sans select-none">
      {/* ── Ambient Background ──────────────────────────────────────────────── */}
      {song.coverArt && (
        <div
          className="fixed inset-0 bg-cover bg-center pointer-events-none z-0 scale-125 opacity-25 filter blur-3xl transition-all duration-700"
          style={{ backgroundImage: `url(${song.coverArt})` }}
        />
      )}
      <div className="fixed inset-0 bg-black/80 pointer-events-none z-0" />

      {/* ── YouTube Audio Engine (off-screen) ──────────────────────────────── */}
      {youtubeVideoId && (
        <div
          className={
            showVideoInsteadOfCover && ytDisplayMode === 'side'
              ? 'hidden'
              : 'fixed -top-96 -left-96 w-1 h-1 opacity-0 pointer-events-none'
          }
        >
          <YouTubeEmbedPlayer
            videoId={youtubeVideoId}
            isPlaying={isPlaying}
            displayMode={showVideoInsteadOfCover ? 'side' : 'audio'}
            isMuted={isMuted}
            volume={volume}
            syncOffset={syncOffset}
            seekTrigger={seekTrigger}
            onTimeUpdate={(t) => setCurrentTime(t)}
            onDurationChange={(d) => setDuration(d)}
            onPlayStateChange={(p) => setIsPlaying(p)}
            onOpenFetcher={() => setIsYtModalOpen(true)}
          />
        </div>
      )}

      {/* ── Invisible Top Hover Sensor (Awakens header when cursor moves to top edge) ── */}
      <div
        onMouseEnter={() => handleUserActivity()}
        className="fixed top-0 left-0 right-0 h-4 z-40 pointer-events-auto"
      />

      {/* ── Top Header Bar (Auto-hides on inactivity / returns on hover or interaction) ── */}
      <header
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
        className={`fixed top-0 left-0 right-0 z-30 bg-[#08080a]/80 backdrop-blur-md border-b border-white/[0.04] transition-all duration-300 ease-in-out ${
          isHeaderVisible
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
      >
        <div className="w-full px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToSearch}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Back to Search"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <Link href="/" className="flex items-center gap-2 group cursor-pointer select-none" title="OpenLyryc Home">
              <OpenLyrycLogo className="h-5 w-auto text-white group-hover:opacity-90 transition-opacity" />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setIsQuickSearchOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-zinc-400 hover:text-white text-xs border border-white/[0.08] transition-colors cursor-pointer shadow-sm"
          >
            <Search className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-medium">Search Chords</span>
            <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-500 border border-white/[0.06]">
              ⌘K
            </span>
          </button>

          <div className="flex items-center gap-2">
            {/* Lyrics status pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-sans border transition-colors"
              style={{
                borderColor: lyricsStatus === 'ready' ? 'rgba(255,255,255,0.12)' : lyricsStatus === 'fallback' ? 'rgba(255,200,0,0.2)' : 'rgba(255,255,255,0.06)',
                color: lyricsStatus === 'ready' ? 'rgba(160,200,160,1)' : lyricsStatus === 'fallback' ? 'rgba(200,180,80,1)' : 'rgba(120,120,120,1)',
              }}
            >
              {lyricsStatus === 'loading' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
              {lyricsStatus === 'loading' ? 'Syncing lyrics…' : lyricsStatus === 'ready' ? `${resolvedLines.length} lines synced` : 'Estimated sync'}
            </div>

            <button
              type="button"
              onClick={() => setIsBgModalOpen(true)}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Customize Background"
            >
              <Palette className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer relative"
              title="Share Chord Sheet"
            >
              {copiedShare ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Fixed Workspace ─────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 pt-16 pb-4 gap-8">
        {/* Left Column: Cover, Track Info & Controls (4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between h-full pr-2">
          <div className="space-y-6 overflow-y-auto custom-scrollbar">
            {/* Cover / Video Container */}
            <div className="relative aspect-square w-full max-w-[260px] mx-auto lg:mx-0 rounded-3xl overflow-hidden shadow-2xl border border-white/10 group bg-zinc-900 shrink-0">
              {youtubeVideoId && ytDisplayMode === 'side' && showVideoInsteadOfCover ? (
                <div className="w-full h-full">
                  <YouTubeEmbedPlayer
                    videoId={youtubeVideoId}
                    isPlaying={isPlaying}
                    displayMode="side"
                    isMuted={isMuted}
                    volume={volume}
                    syncOffset={syncOffset}
                    seekTrigger={seekTrigger}
                    onTimeUpdate={(t) => setCurrentTime(t)}
                    onDurationChange={(d) => setDuration(d)}
                    onPlayStateChange={(p) => setIsPlaying(p)}
                    onOpenFetcher={() => setIsYtModalOpen(true)}
                  />
                </div>
              ) : song.coverArt ? (
                <img
                  src={song.coverArt}
                  alt={song.title}
                  className="w-full h-full object-cover select-none"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600">
                  <Disc className="w-20 h-20 mb-2 stroke-[1.2]" />
                  <span className="text-xs font-normal text-zinc-500">No Cover Artwork</span>
                </div>
              )}

              {youtubeVideoId && (
                <button
                  type="button"
                  onClick={() => setShowVideoInsteadOfCover((p) => !p)}
                  className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/75 hover:bg-black text-white text-[10px] font-medium backdrop-blur-md border border-white/20 transition-all cursor-pointer opacity-0 group-hover:opacity-100 flex items-center gap-1.5 shadow-md"
                >
                  <Layers className="w-3 h-3" />
                  <span>{showVideoInsteadOfCover ? 'Show Artwork' : 'Show Video'}</span>
                </button>
              )}
            </div>

            {/* Track details */}
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
                {song.title}
              </h1>
              <p className="text-base font-medium text-zinc-400">{song.artist}</p>
              <div className="flex items-center gap-2 pt-2 text-xs font-sans text-zinc-400">
                {song.key && (
                  <span className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">
                    {song.key}
                  </span>
                )}
                {song.capo && (
                  <span className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">
                    {song.capo}
                  </span>
                )}
              </div>
            </div>

            {/* ── Curvy Duration Scrubber & Primary Controls (Matching Reference) ── */}
            <div className="space-y-3 pt-1">
              {/* Curvy S-Curve Scrubber Wave */}
              <div
                ref={progressBarRef}
                onMouseEnter={() => setIsScrubberHovered(true)}
                onMouseLeave={() => setIsScrubberHovered(false)}
                onMouseDown={handleScrubberMouseDown}
                onTouchStart={handleScrubberTouchStart}
                className="relative w-full cursor-pointer py-1 select-none touch-none group"
                role="slider"
                aria-label="Seek time"
                aria-valuenow={currentTime}
                aria-valuemin={0}
                aria-valuemax={duration || 180}
              >
                <svg
                  viewBox="0 0 400 60"
                  className="w-full h-14 overflow-visible pointer-events-none"
                  fill="none"
                >
                  <defs>
                    <filter id="chords-knob-glow" x="-50%" y="-50%" width="200%" height="200%">
                      <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodColor="#ffffff" floodOpacity="0.4" />
                    </filter>
                  </defs>

                  {/* Background Unplayed Curve Rail */}
                  <path
                    d={CURVE_PATH_D}
                    stroke="rgba(255, 255, 255, 0.18)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                  />

                  {/* Active Played Curve with Dashoffset */}
                  <path
                    ref={curvePathRef}
                    d={CURVE_PATH_D}
                    stroke="#FFFFFF"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={pathLength}
                    strokeDashoffset={pathLength * (1 - progressRatio)}
                    className="transition-[stroke-dashoffset] duration-75 ease-out"
                  />

                  {/* Scrubber Knob on Curve (Locked to path via radius transition, no offset transform) */}
                  <circle
                    cx={knobPos.x}
                    cy={knobPos.y}
                    r={isScrubbing ? 8.5 : isScrubberHovered ? 8 : 6.5}
                    fill="#FFFFFF"
                    filter="url(#chords-knob-glow)"
                    style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                    className="transition-[r] duration-150 ease-out"
                  />
                </svg>

                {/* Timestamps: Elapsed on left, Total on right */}
                <div className="flex items-center justify-between text-xs font-sans text-zinc-400 tabular-nums px-1 -mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration || undefined)}</span>
                </div>
              </div>

              {/* Centered Controls Row (SkipBack, Big Circular Play/Pause, SkipForward) */}
              <div className="flex items-center justify-center gap-6">
                {/* Previous Line (Line Backward) */}
                <button
                  type="button"
                  onClick={handlePrevLine}
                  className="p-3 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all cursor-pointer"
                  title="Previous Line"
                >
                  <SkipBack className="w-5 h-5 fill-current" />
                </button>

                {/* Prominent Circular Play / Pause Button */}
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className="w-14 h-14 rounded-full bg-white text-zinc-950 flex items-center justify-center hover:scale-105 active:scale-95 hover:bg-zinc-200 transition-all shadow-xl cursor-pointer shrink-0"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 fill-current" />
                  ) : (
                    <Play className="w-6 h-6 fill-current ml-0.5" />
                  )}
                </button>

                {/* Next Line (Line Forward) */}
                <button
                  type="button"
                  onClick={handleNextLine}
                  className="p-3 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all cursor-pointer"
                  title="Next Line"
                >
                  <SkipForward className="w-5 h-5 fill-current" />
                </button>
              </div>
            </div>

            {/* Transpose */}
            <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Transpose Key</span>
                </span>
                <span className="text-white font-sans font-bold">
                  {transpose === 0 ? 'Original' : transpose > 0 ? `+${transpose}` : `${transpose}`}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setTranspose((t) => t - 1)}
                  className="py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white font-bold text-xs transition-all border border-white/[0.08]"
                >
                  -1 Flat
                </button>
                <button
                  onClick={() => setTranspose(0)}
                  disabled={transpose === 0}
                  className="py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-40 text-zinc-300 font-bold text-xs transition-all border border-white/[0.08] flex items-center justify-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
                <button
                  onClick={() => setTranspose((t) => t + 1)}
                  className="py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white font-bold text-xs transition-all border border-white/[0.08]"
                >
                  +1 Sharp
                </button>
              </div>
            </div>
          </div>

          {/* Attach YouTube Video */}
          <button
            onClick={() => setIsYtModalOpen(true)}
            className="w-full py-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-2 mt-4"
          >
            <YouTubeIcon className="w-4 h-4 text-red-500" />
            <span>{youtubeVideoId ? 'Change Video' : 'Attach YouTube Video'}</span>
          </button>
        </div>

        {/* Right Column: Chord Carousel + 2-Line Rotating Stage */}
        <div className="lg:col-span-8 relative h-full flex flex-col items-center justify-between py-2 px-4 overflow-hidden">
          {/* Scrubber accent line */}
          <div className="absolute top-0 right-2 bottom-0 w-0.5 bg-gradient-to-b from-white/10 via-white/40 to-white/10 shadow-[0_0_8px_rgba(255,255,255,0.6)] rounded-full pointer-events-none" />

          {/* ── Horizontal Chord Carousel (fixed at top) ── */}
          <div className="w-full flex flex-col items-center justify-center shrink-0 py-2">
            <HorizontalChordCarousel
              currentChord={currentChord}
              nextChord={nextChord}
              prevChord={prevChord}
            />
          </div>

          {/* ── 2-Line Rotating Lyrics Stage ── */}
          <div className="w-full max-w-2xl flex flex-col gap-6 justify-center my-auto py-4 text-left">
            {lyricsStatus === 'loading' && (
              <div className="flex items-center gap-3 text-zinc-500">
                <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                <span className="text-lg font-medium">Fetching synced lyrics…</span>
              </div>
            )}

            {lyricsStatus !== 'loading' && !currentLine && (
              <p className="text-2xl font-bold text-zinc-500 italic">
                {isPlaying ? '♪' : 'Press play to begin'}
              </p>
            )}

            {/* LINE 1: CURRENT ACTIVE LINE */}
            {currentLine && (
              <div className="space-y-2">
                {/* Unboxed, prominent chord text adjacent to lyrics */}
                <div className="flex items-baseline gap-3 font-sans">
                  <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                    {currentChord}
                  </span>
                  {nextChord && (
                    <span className="text-xs sm:text-sm text-zinc-500 font-medium">
                      next <span className="text-zinc-400 font-semibold">{nextChord}</span>
                    </span>
                  )}
                </div>

                <p className="text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-snug">
                  {currentLine.tokens && currentLine.tokens.length > 0 ? (
                    currentLine.tokens.map((token, tIdx) => {
                      const isWordActive = currentTime >= token.start && currentTime <= token.end;
                      return (
                        <span
                          key={tIdx}
                          className={`inline-block mr-2 transition-colors duration-100 ${
                            isWordActive
                              ? 'text-white underline decoration-white/40 decoration-2 underline-offset-8'
                              : 'text-zinc-400'
                          }`}
                        >
                          {token.text}
                        </span>
                      );
                    })
                  ) : (
                    currentLine.text || '♪'
                  )}
                </p>
              </div>
            )}

            {/* LINE 2: NEXT LINE PREVIEW */}
            {nextLine && (
              <div
                className="opacity-35 hover:opacity-60 transition-opacity cursor-pointer"
                onClick={handleNextLine}
              >
                <p className="text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight text-zinc-400 leading-snug">
                  {nextLine.text || '♪'}
                </p>
              </div>
            )}

            {/* Sync source badge */}
            {lyricsStatus !== 'loading' && (
              <p className="text-[10px] font-sans text-zinc-600 mt-2">
                {lyricsStatus === 'ready'
                  ? `Sync: live resolver · ${resolvedLines.length} lines`
                  : 'Sync: BPM estimate (no lyrics found)'}
              </p>
            )}
          </div>
        </div>
      </main>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {isYtModalOpen && (
        <YouTubeFetcherModal
          isOpen={isYtModalOpen}
          onClose={() => setIsYtModalOpen(false)}
          currentVideoId={youtubeVideoId}
          songTitle={song.title}
          artistName={song.artist}
          displayMode={ytDisplayMode}
          onChangeDisplayMode={setYtDisplayMode}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(!isMuted)}
          volume={volume}
          onChangeVolume={setVolume}
          onSelectVideo={(id) => setYoutubeVideoId(id)}
        />
      )}

      {isBgModalOpen && (
        <BackgroundCustomizerModal
          isOpen={isBgModalOpen}
          onClose={() => setIsBgModalOpen(false)}
          config={bgConfig}
          coverArt={song.coverArt}
          onSaveConfig={onUpdateBgConfig}
        />
      )}

      {isQuickSearchOpen && (
        <QuickSearchModal
          isOpen={isQuickSearchOpen}
          onClose={() => setIsQuickSearchOpen(false)}
          onSelectSong={(result) => {
            onSelectSong({
              id: result.id,
              slug: result.id,
              title: result.title,
              artist: result.artist,
              coverArt: result.coverArt || song.coverArt,
              bpm: 85,
              timeSignature: [4, 4],
              chordsUsed: ['C', 'G', 'Am', 'F'],
              chordAnnotations: [],
            });
            setIsQuickSearchOpen(false);
          }}
        />
      )}
    </div>
  );
};
