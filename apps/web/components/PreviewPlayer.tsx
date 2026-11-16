'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { OpenLyricsDocument, LyricLine } from '@/types/lyrics';
import { VideoDisplayMode } from '@/types/settings';
import { PreviewTheme, resolvePreviewDocument } from '@/lib/previewLink';
import { AmbientBackground } from './AmbientBackground';
import { YouTubeCornerEmbed } from './YouTubeCornerEmbed';
import { generateHarmonicPalette, ColorPalette } from '@/lib/colorExtractor';
import { parseYouTubeMusicId } from '@/lib/platformLinker';
import {
  AnimatedZigZagUnderline,
  isComplexScript,
  InstrumentalGapIndicator,
  buildDynamicFlowItems,
} from './LyricRenderer';

interface PreviewPlayerProps {
  id?: string;
  initialDoc?: OpenLyricsDocument;
  initialTheme?: PreviewTheme;
  initialTvMode?: boolean;
}

export const PreviewPlayer: React.FC<PreviewPlayerProps> = ({
  id,
  initialDoc,
  initialTheme = 'fluid_glow',
  initialTvMode = false,
}) => {
  const [doc, setDoc] = useState<OpenLyricsDocument | null>(initialDoc || null);
  const [loading, setLoading] = useState<boolean>(!initialDoc);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isYouTubePlaying, setIsYouTubePlaying] = useState<boolean>(false);
  const [theme, setTheme] = useState<PreviewTheme>(initialTheme);
  const [isTvMode, setIsTvMode] = useState<boolean>(initialTvMode);
  const [showRemoteHelp, setShowRemoteHelp] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);
  const [showChrome, setShowChrome] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [videoDisplayMode, setVideoDisplayMode] = useState<VideoDisplayMode>('backdrop');

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Resolve Document from ID or URL
  useEffect(() => {
    if (initialDoc) {
      setDoc(initialDoc);
      setLoading(false);
      return;
    }

    const loadDoc = async () => {
      setLoading(true);
      setError(null);
      const res = await resolvePreviewDocument(id);

      if (res.document) {
        setDoc(res.document);
        if (res.theme) {
          setTheme(res.theme);
        }
        if (res.tvMode !== undefined) {
          setIsTvMode(res.tvMode);
        }
        if (res.document.metadata.duration) {
          setDuration(res.document.metadata.duration);
        } else if (res.document.lines && res.document.lines.length > 0) {
          const lastLine = res.document.lines[res.document.lines.length - 1];
          const calcDur = Math.ceil(lastLine.end + 3);
          setDuration(calcDur);
        }
      } else {
        setError(res.error || 'Failed to load preview document.');
      }
      setLoading(false);
    };

    loadDoc();
  }, [id, initialDoc]);

  // Read theme and TV mode from URL search params / hash if present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('theme') as PreviewTheme;
      if (t && ['fluid_glow', 'monochrome_oled', 'vaporwave_neon', 'stage_karaoke'].includes(t)) {
        setTheme(t);
      }

      const hashStr = window.location.hash || '';
      const isTv =
        params.get('tv') === '1' ||
        params.get('tizen') === '1' ||
        params.get('low_end') === '1' ||
        hashStr.includes('tv=1') ||
        hashStr.includes('tizen=1') ||
        hashStr.includes('low_end=1');

      if (isTv) {
        setIsTvMode(true);
      }
    }
  }, []);

  // 2. Extract Color Palette from Document Metadata
  const palette: ColorPalette = useMemo(() => {
    if (!doc) return generateHarmonicPalette('OpenLyryc Preview');
    return generateHarmonicPalette(`${doc.metadata.title} - ${doc.metadata.artist}`);
  }, [doc]);

  // 3. Resolve YouTube Video ID for corner embed / backdrop sync
  const youtubeVideoId = useMemo(() => {
    if (!doc) return undefined;
    const meta = doc.metadata;
    if (meta.youtubeId) return parseYouTubeMusicId(meta.youtubeId);
    if (meta.canonicalKey && meta.canonicalKey.startsWith('yt:')) {
      return parseYouTubeMusicId(meta.canonicalKey.replace('yt:', ''));
    }
    const platYt = meta.platformLinks?.find((p) => p.platform === 'youtube');
    if (platYt) return parseYouTubeMusicId(platYt.platformId);

    // Check URL query parameters and hash (?yt=... or &yt=...)
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const ytParam = searchParams.get('yt') || searchParams.get('v') || searchParams.get('youtube');
      if (ytParam) return parseYouTubeMusicId(ytParam);

      const hash = window.location.hash || '';
      const hashYtMatch = hash.match(/[?&#](?:yt|v|youtube)=([^&]+)/i);
      if (hashYtMatch) return parseYouTubeMusicId(decodeURIComponent(hashYtMatch[1]));
    }

    // Only fallback for sample Midnight City demo track
    if (meta.canonicalKey === 's_m83_midnight' || meta.title?.toLowerCase() === 'midnight city') {
      return 'kJQP7kiw5Fk';
    }

    return undefined;
  }, [doc]);

  // 4. Auto-Hide Navigation Chrome on Inactivity (Theater Mode)
  const resetIdleTimer = useCallback(() => {
    setShowChrome(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setShowChrome(false);
      setShowRemoteHelp(false);
    }, 3200);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('touchstart', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    resetIdleTimer();

    return () => {
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('touchstart', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  const lines = useMemo(() => doc?.lines || [], [doc?.lines]);
  const flowItems = useMemo(() => buildDynamicFlowItems(lines), [lines]);
  const [activeFlowItemIdx, setActiveFlowItemIdx] = useState<number>(0);

  // 5. Track Active Flow Item (Line or Gap)
  useEffect(() => {
    if (!doc || flowItems.length === 0) return;
    let found = 0;
    for (let i = 0; i < flowItems.length; i++) {
      const item = flowItems[i];
      const start = item.type === 'line' ? item.line.start : item.gap.start;
      const end = item.type === 'line' ? item.line.end : item.gap.end;
      if (currentTime >= start && currentTime <= end) {
        found = i;
        break;
      }
      if (currentTime >= start) {
        found = i;
      }
    }
    setActiveFlowItemIdx(found);
  }, [currentTime, doc, flowItems]);

  // 6. Smooth Spring Scroll to Keep Active Item Centered (Tizen TV & Old Chromium Safe)
  useEffect(() => {
    if (!activeLineRef.current || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const activeEl = activeLineRef.current;

    const containerHeight = container.clientHeight;
    const elTop = activeEl.offsetTop;
    const elHeight = activeEl.clientHeight;

    const targetScrollTop = elTop - containerHeight / 2 + elHeight / 2;

    try {
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth',
        });
      } else {
        container.scrollTop = Math.max(0, targetScrollTop);
      }
    } catch {
      // Legacy WebKit / Chromium < 61 requires scrollTo(x, y) instead of dictionary
      try {
        container.scrollTo(0, Math.max(0, targetScrollTop));
      } catch {
        container.scrollTop = Math.max(0, targetScrollTop);
      }
    }
  }, [activeFlowItemIdx]);

  // 6b. Smooth Virtual Clock Loop (Active when YouTube is NOT driving playback)
  useEffect(() => {
    if (!isPlaying || isYouTubePlaying) return;
    let animationFrameId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      setCurrentTime((prev) => {
        const next = prev + dt * playbackRate;
        if (duration > 0 && next >= duration) {
          setIsPlaying(false);
          return duration;
        }
        return next;
      });
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, isYouTubePlaying, playbackRate, duration]);

  // 7. Interactive Playback Handlers
  const handleSeek = useCallback((time: number) => {
    const target = Math.max(0, Math.min(duration || 9999, time));
    setCurrentTime(target);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openlyryc:seek-to', { detail: { time: target } }));
    }
  }, [duration]);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('openlyryc:toggle-play', { detail: { isPlaying: next } }));
      }
      return next;
    });
  }, []);

  const handleRelativeSeek = useCallback((seconds: number) => {
    setCurrentTime((prev) => Math.max(0, Math.min(duration || 9999, prev + seconds)));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openlyryc:seek-relative', { detail: { seconds } }));
    }
  }, [duration]);

  // Jump between lines (Remote D-Pad Up / Down)
  const handleJumpLine = useCallback((direction: 'prev' | 'next') => {
    if (!flowItems || flowItems.length === 0) return;
    const newIdx =
      direction === 'prev'
        ? Math.max(0, activeFlowItemIdx - 1)
        : Math.min(flowItems.length - 1, activeFlowItemIdx + 1);
    const item = flowItems[newIdx];
    const targetTime = item.type === 'line' ? item.line.start : item.gap.start;
    handleSeek(targetTime);
  }, [flowItems, activeFlowItemIdx, handleSeek]);

  const handleExternalTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleExternalPlayStateChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
    setIsYouTubePlaying(playing);
  }, []);

  const handleDurationDetected = useCallback((dur: number) => {
    if (dur > 0) {
      setDuration((prev) => (!prev || Math.abs(prev - dur) > 1 ? dur : prev));
    }
  }, []);

  const handleCloseYouTube = useCallback(() => {}, []);

  // 8. Keyboard & Samsung Tizen TV Remote Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const code = e.code;
      const keyCode = e.keyCode || e.which;

      // ── Samsung Tizen & Standard Remote Keys ──
      // Play / Pause: Space (32), Enter (13), MediaPlayPause (10252), MediaPlay (415), MediaPause (19)
      if (
        code === 'Space' ||
        code === 'Enter' ||
        keyCode === 13 ||
        keyCode === 32 ||
        keyCode === 10252 ||
        keyCode === 415 ||
        keyCode === 19
      ) {
        e.preventDefault();
        handleTogglePlay();
      }
      // Rewind / Left: ArrowLeft (37), MediaRewind (412)
      else if (code === 'ArrowLeft' || keyCode === 37 || keyCode === 412) {
        e.preventDefault();
        handleRelativeSeek(keyCode === 412 ? -10 : -5);
      }
      // FastForward / Right: ArrowRight (39), MediaFastForward (417)
      else if (code === 'ArrowRight' || keyCode === 39 || keyCode === 417) {
        e.preventDefault();
        handleRelativeSeek(keyCode === 417 ? 10 : 5);
      }
      // D-Pad Up: Jump to previous lyric line
      else if (code === 'ArrowUp' || keyCode === 38) {
        e.preventDefault();
        handleJumpLine('prev');
      }
      // D-Pad Down: Jump to next lyric line
      else if (code === 'ArrowDown' || keyCode === 40) {
        e.preventDefault();
        handleJumpLine('next');
      }
      // Stop: MediaStop (413)
      else if (keyCode === 413) {
        e.preventDefault();
        handleSeek(0);
        setIsPlaying(false);
      }
      // Fullscreen Toggle
      else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
      // TV Mode Toggle: Key 'T' or key '0' or TV Key (10182)
      else if (e.key === 't' || e.key === 'T' || e.key === '0' || keyCode === 10182) {
        e.preventDefault();
        setIsTvMode((prev) => !prev);
      }
      // Remote Help Toggle: Key 'H' or '?' or Info Key (457)
      else if (e.key === 'h' || e.key === 'H' || e.key === '?' || keyCode === 457) {
        e.preventDefault();
        setShowRemoteHelp((prev) => !prev);
      }
      // Color Keys (Samsung Tizen Remotes) & Number Keys (1-4)
      // Red (403) / Key 1 -> Fluid Glow
      else if (keyCode === 403 || e.key === '1') {
        setTheme('fluid_glow');
      }
      // Green (404) / Key 2 -> OLED Studio
      else if (keyCode === 404 || e.key === '2') {
        setTheme('monochrome_oled');
      }
      // Yellow (405) / Key 3 -> Vaporwave Neon
      else if (keyCode === 405 || e.key === '3') {
        setTheme('vaporwave_neon');
      }
      // Blue (406) / Key 4 -> Stage Karaoke
      else if (keyCode === 406 || e.key === '4') {
        setTheme('stage_karaoke');
      }
      // Return / Back: Tizen Return (10009), Escape (27)
      else if (keyCode === 10009 || code === 'Escape' || keyCode === 27) {
        setShowChrome((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, handleRelativeSeek, handleJumpLine, handleSeek]);

  // 9. Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // 10. Copy Share Link
  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    });
  };

  // Format mm:ss helper
  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#070709] flex flex-col items-center justify-center text-zinc-400 gap-4 font-sans select-none">
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-white animate-spin" />
          <span className="material-symbols-outlined absolute text-lg text-white/50">
            music_note
          </span>
        </div>
        <p className="text-xs font-semibold tracking-wider uppercase text-zinc-400">
          Loading Live Preview…
        </p>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="fixed inset-0 bg-[#070709] flex flex-col items-center justify-center text-zinc-300 gap-5 p-6 font-sans text-center select-none">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.1] flex items-center justify-center shadow-xl">
          <span className="material-symbols-outlined text-2xl text-red-400">error</span>
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h2 className="text-base font-bold text-white tracking-tight">Preview Not Found</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">{error}</p>
        </div>
        <Link
          href="/"
          className="px-6 py-2.5 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-all shadow-lg active:scale-95 cursor-pointer"
        >
          Open in OpenLyryc Editor
        </Link>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-tv-mode={isTvMode ? 'true' : undefined}
      className={`fixed inset-0 w-full h-[100dvh] overflow-hidden select-none font-sans transition-colors duration-700 ${
        isTvMode ? 'tv-mode' : ''
      } ${
        theme === 'monochrome_oled'
          ? 'bg-[#000000] text-white'
          : theme === 'vaporwave_neon'
          ? 'bg-[#070114] text-cyan-300'
          : theme === 'stage_karaoke'
          ? 'bg-[#040814] text-white'
          : 'bg-[#08080a] text-white'
      }`}
    >
      {/* ── Dynamic Ambient Background ────────────────────────────────────── */}
      {theme === 'fluid_glow' && (
        <AmbientBackground palette={palette} enabled={true} />
      )}

      {theme === 'vaporwave_neon' && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(147,51,234,0.18),transparent_70%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(6,182,212,0.15),transparent_60%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,240,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,0,128,0.03)_1px,transparent_1px)] bg-[size:48px_48px] opacity-40" />
        </div>
      )}

      {theme === 'stage_karaoke' && (
        <div className="absolute inset-0 pointer-events-none -z-10 bg-gradient-to-b from-[#0e1e38]/70 via-[#060c18] to-[#02050d]" />
      )}

      {/* ── Floating Detached Glassmorphism Header ────────────────────────── */}
      <header
        className={`fixed top-4 inset-x-4 max-w-4xl mx-auto z-40 flex items-center justify-between px-4 py-2.5 rounded-2xl ${
          isTvMode ? 'tv-glass-card bg-[#0b0b10] border border-white/20' : 'bg-[#0f0f14]/85 backdrop-blur-2xl border border-white/[0.12]'
        } shadow-2xl shadow-black/80 transition-all duration-300 ${
          showChrome ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
      >
        {/* Left: Back Link & Track Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            title="Open in Editor (Esc)"
            className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/20 border border-white/[0.1] flex items-center justify-center text-zinc-300 hover:text-white transition-all shrink-0 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
          </Link>

          {/* Animated Vinyl Disc Icon */}
          <div
            className={`w-7 h-7 rounded-full border border-white/20 flex items-center justify-center shrink-0 shadow-inner ${
              isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''
            }`}
            style={{
              background: `radial-gradient(circle, #222 30%, ${palette.primary} 100%)`,
            }}
          >
            <div className="w-2 h-2 rounded-full bg-white/80" />
          </div>

          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-bold text-white truncate tracking-tight">
                {doc.metadata.title}
              </h1>
              {isTvMode && (
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[9px] font-bold tracking-wider uppercase shrink-0">
                  TV Mode
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] text-zinc-400 truncate">
              {doc.metadata.artist}
            </p>
          </div>
        </div>

        {/* Right: Theme Switcher, TV Toggle & Actions */}
        <div className="flex items-center gap-2">
          {/* TV Mode Toggle Button */}
          <button
            type="button"
            onClick={() => setIsTvMode((prev) => !prev)}
            title={isTvMode ? 'Disable Big TV Mode (T)' : 'Enable Big TV Mode (T)'}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer ${
              isTvMode
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'bg-white/[0.06] text-zinc-400 border-white/[0.08] hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">tv</span>
            <span className="hidden sm:inline">TV Mode</span>
          </button>

          {/* Segmented Native Theme Switcher */}
          <div className="hidden md:flex items-center p-0.5 rounded-xl bg-white/[0.06] border border-white/[0.08]">
            {(
              [
                { key: 'fluid_glow', label: 'Glow', icon: 'blur_on' },
                { key: 'monochrome_oled', label: 'OLED', icon: 'contrast' },
                { key: 'vaporwave_neon', label: 'Neon', icon: 'local_fire_department' },
                { key: 'stage_karaoke', label: 'Stage', icon: 'mic' },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTheme(t.key)}
                title={`Switch to ${t.label} Theme (${t.key === 'fluid_glow' ? '1' : t.key === 'monochrome_oled' ? '2' : t.key === 'vaporwave_neon' ? '3' : '4'})`}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  theme === t.key
                    ? 'bg-white text-zinc-950 shadow-md scale-[1.02]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[13px]">{t.icon}</span>
                <span className="hidden lg:inline">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Copy Link Action */}
          <button
            type="button"
            onClick={handleCopyLink}
            title="Copy Shareable Link"
            className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/20 border border-white/[0.1] text-zinc-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[14px]">
              {copiedToast ? 'check' : 'share'}
            </span>
            <span className="hidden sm:inline">{copiedToast ? 'Copied!' : 'Share'}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}
            className="p-1.5 rounded-xl bg-white/[0.06] hover:bg-white/20 border border-white/[0.1] text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">
              {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>
        </div>
      </header>

      {/* ── Main Dynamic Flow Lyrics Display ── */}
      <main
        ref={scrollContainerRef}
        className="relative z-10 w-full h-full overflow-y-auto px-6 sm:px-12 pt-32 pb-48 flex flex-col items-center no-scrollbar tv-accelerated-layer"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div
          className={`w-full my-auto transition-all duration-300 ${
            isTvMode
              ? 'max-w-4xl space-y-10 sm:space-y-14 py-8'
              : 'max-w-2xl space-y-6 sm:space-y-8'
          }`}
        >
          {flowItems.map((item, idx) => {
            const isActive = idx === activeFlowItemIdx;
            const isPast = idx < activeFlowItemIdx;

            if (item.type === 'gap') {
              return (
                <InstrumentalGapIndicator
                  key={item.gap.id}
                  isActive={isActive}
                  isPast={isPast}
                  start={item.gap.start}
                  end={item.gap.end}
                  onSeek={handleSeek}
                  innerRef={isActive ? activeLineRef : undefined}
                />
              );
            }

            const { line, isComplex } = item;
            const lineDur = Math.max(0.1, line.end - line.start);
            const lineProgress = Math.min(1, Math.max(0, (currentTime - line.start) / lineDur));

            return (
              <div
                key={line.id || `line-${item.idx}`}
                ref={isActive ? activeLineRef : undefined}
                onClick={() => handleSeek(line.start)}
                className={`lyric-line-item transition-all duration-300 cursor-pointer group relative py-1 text-center sm:text-left select-text ${
                  isActive
                    ? isTvMode
                      ? 'scale-[1.04] opacity-100 translate-z-0'
                      : 'scale-[1.02] opacity-100 translate-z-0'
                    : isPast
                    ? isTvMode
                      ? 'opacity-30 hover:opacity-75 scale-[0.97]'
                      : 'opacity-35 hover:opacity-75 scale-[0.98]'
                    : isTvMode
                    ? 'opacity-25 hover:opacity-65 scale-[0.97]'
                    : 'opacity-25 hover:opacity-65 scale-[0.98]'
                }`}
              >
                {/* Word Tokens / Line Text */}
                {line.tokens && line.tokens.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-2">
                    {line.tokens.map((tok, tIdx) => {
                      const isWordActive = currentTime >= tok.start && currentTime <= tok.end;
                      const isWordPast = currentTime > tok.end;
                      const tokDur = Math.max(0.01, tok.end - tok.start);
                      const tokProgress = Math.min(
                        1,
                        Math.max(0, (currentTime - tok.start) / tokDur)
                      );

                      const hasWordEmphasis = Boolean(tok.emphasis ?? line.emphasis);

                      return (
                        <span
                          key={`tok-${tIdx}`}
                          className={`relative inline-block tracking-tight transition-all duration-150 ${
                            isTvMode
                              ? 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black'
                              : 'text-xl sm:text-2xl md:text-3xl font-extrabold'
                          } ${
                            isComplex ? 'leading-relaxed' : 'leading-snug'
                          } ${
                            theme === 'vaporwave_neon'
                              ? isWordActive
                                ? 'text-white scale-[1.03] drop-shadow-[0_0_16px_#00f0ff]'
                                : isWordPast
                                ? 'text-pink-400/90'
                                : 'text-zinc-600'
                              : theme === 'stage_karaoke'
                              ? isWordActive
                                ? 'text-[#ffd700] scale-[1.03] drop-shadow-[0_0_12px_#ffd700]'
                                : isWordPast
                                ? 'text-cyan-300'
                                : 'text-zinc-500'
                              : isWordActive
                              ? 'text-white scale-[1.04] drop-shadow-[0_0_16px_rgba(255,255,255,0.7)]'
                              : isWordPast
                              ? 'text-zinc-100'
                              : 'text-zinc-500'
                          }`}
                        >
                          {tok.text}
                          {hasWordEmphasis && !isTvMode && (
                            <AnimatedZigZagUnderline
                              progress={tokProgress}
                              isActive={isWordActive}
                            />
                          )}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p
                    className={`relative inline-block tracking-tight transition-all ${
                      isTvMode
                        ? 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black'
                        : 'text-xl sm:text-2xl md:text-3xl font-bold'
                    } ${
                      isComplex ? 'leading-relaxed' : 'leading-snug'
                    } ${
                      theme === 'vaporwave_neon'
                        ? isActive
                          ? 'text-cyan-300 drop-shadow-[0_0_16px_#00f0ff]'
                          : 'text-zinc-600'
                        : theme === 'stage_karaoke'
                        ? isActive
                          ? 'text-[#ffd700]'
                          : 'text-zinc-500'
                        : isActive
                        ? 'text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.6)]'
                        : 'text-zinc-500'
                    }`}
                  >
                    {line.text}
                    {Boolean(line.emphasis) && !isTvMode && (
                      <AnimatedZigZagUnderline progress={lineProgress} isActive={isActive} />
                    )}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* ── TV Autoplay Call-to-Action Prompt (Addresses Smart TV Autoplay Restrictions) ── */}
      {isTvMode && !isPlaying && !isYouTubePlaying && (
        <div
          onClick={handleTogglePlay}
          className="fixed inset-0 z-30 flex flex-col items-center justify-center cursor-pointer select-none bg-black/30 backdrop-blur-[2px] transition-all animate-in fade-in duration-300"
        >
          <div className="px-8 py-6 rounded-3xl bg-[#0f0f14]/95 border border-white/20 shadow-2xl flex flex-col items-center gap-4 text-center hover:scale-105 transition-transform">
            <div className="w-14 h-14 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-xl shadow-white/20">
              <span className="material-symbols-outlined text-3xl">play_arrow</span>
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Press OK on Remote to Play
              </h2>
              <p className="text-xs text-zinc-400">
                Use D-Pad (◄ ► Seek, ▲ ▼ Jump Lines)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Big TV Remote Control Legend ────────────────────────── */}
      {isTvMode && (
        <div className="fixed bottom-2 inset-x-0 z-30 flex justify-center pointer-events-none select-none">
          <div className="px-4 py-1.5 rounded-full bg-[#0a0a0f]/80 border border-white/10 text-[10px] text-zinc-400 font-sans flex items-center gap-2.5 shadow-lg">
            <span className="text-white font-bold bg-white/10 px-1.5 py-0.5 rounded">OK</span> Play/Pause
            <span className="text-zinc-600">•</span>
            <span className="text-white font-bold bg-white/10 px-1.5 py-0.5 rounded">◄ ►</span> Seek ±5s
            <span className="text-zinc-600">•</span>
            <span className="text-white font-bold bg-white/10 px-1.5 py-0.5 rounded">▲ ▼</span> Lines
            <span className="text-zinc-600">•</span>
            <span className="text-white font-bold bg-white/10 px-1.5 py-0.5 rounded">1-4</span> Themes
          </div>
        </div>
      )}

      {/* ── Floating Transport & Scrubber Bar ─────────────────────────────── */}
      <div
        className={`fixed bottom-8 inset-x-4 max-w-xl mx-auto z-40 flex flex-col gap-2 p-3 rounded-2xl ${
          isTvMode ? 'tv-transport-bar bg-[#0b0b10] border border-white/20' : 'bg-[#0f0f14]/90 backdrop-blur-2xl border border-white/[0.12]'
        } shadow-2xl shadow-black/80 transition-all duration-300 ${
          showChrome ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none'
        }`}
      >
        {/* Scrubber Timeline */}
        <div className="flex items-center gap-3 px-1">
          <span className="text-[10px] font-sans text-zinc-400 tabular-nums w-8 text-right">
            {formatTime(currentTime)}
          </span>
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              if (duration > 0) handleSeek(pct * duration);
            }}
            className="relative flex-1 h-1.5 bg-white/10 hover:h-2.5 rounded-full cursor-pointer transition-all group/scrub"
          >
            <div
              className="absolute left-0 top-0 bottom-0 bg-white rounded-full transition-all group-hover/scrub:bg-emerald-400"
              style={{
                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
              }}
            />
          </div>
          <span className="text-[10px] font-sans text-zinc-400 tabular-nums w-8">
            {formatTime(duration)}
          </span>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center justify-between px-2 pt-1 border-t border-white/[0.06]">
          <div className="flex items-center gap-1">
            {/* -5s Skip */}
            <button
              type="button"
              onClick={() => handleRelativeSeek(-5)}
              title="Seek Backward 5s (← / Remote ◄)"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">replay_5</span>
            </button>

            {/* Play/Pause */}
            <button
              type="button"
              onClick={handleTogglePlay}
              title={isPlaying ? 'Pause (Space / OK)' : 'Play (Space / OK)'}
              className="w-8 h-8 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 flex items-center justify-center shadow-md transition-all cursor-pointer active:scale-90"
            >
              <span className="material-symbols-outlined text-base">
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>

            {/* +5s Skip */}
            <button
              type="button"
              onClick={() => handleRelativeSeek(5)}
              title="Seek Forward 5s (→ / Remote ►)"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">forward_5</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Speed Multiplier */}
            <button
              type="button"
              onClick={() => {
                const next = playbackRate === 1 ? 0.75 : playbackRate === 0.75 ? 1.25 : 1;
                setPlaybackRate(next);
              }}
              title="Playback Speed"
              className="px-2 py-0.5 rounded-lg bg-white/[0.06] hover:bg-white/15 border border-white/[0.08] text-[10px] font-sans text-zinc-300 transition-all cursor-pointer"
            >
              {playbackRate}x
            </button>

            {/* Keyboard Help Hint */}
            <span className="hidden sm:inline text-[10px] text-zinc-500 font-medium">
              Space / ← → / F / T (TV)
            </span>
          </div>
        </div>
      </div>

      {/* ── YouTube Corner Embed / Cinematic Backdrop Synchronizer ─────────────────────────────── */}
      {youtubeVideoId && (
        <YouTubeCornerEmbed
          youtubeId={youtubeVideoId}
          isOpen={true}
          onClose={handleCloseYouTube}
          wavesurfer={null}
          isLocalAudioLoaded={false}
          onExternalTimeUpdate={handleExternalTimeUpdate}
          onExternalPlayStateChange={handleExternalPlayStateChange}
          onDurationDetected={handleDurationDetected}
          videoDisplayMode={videoDisplayMode}
          onToggleDisplayMode={setVideoDisplayMode}
          backdropOpacity={0.35}
          backdropBlur={0}
        />
      )}
    </div>
  );
};

export default PreviewPlayer;
