'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ExternalLink, RefreshCw, Music, Search } from 'lucide-react';

declare global {
  interface Window {
    SC?: {
      Widget?: {
        (element: HTMLIFrameElement | string): any;
        Events: {
          LOAD_PROGRESS: string;
          PLAY_PROGRESS: string;
          PLAY: string;
          PAUSE: string;
          FINISH: string;
          SEEK: string;
          READY: string;
          ERROR: string;
        };
      };
    };
  }
}

interface SoundCloudBottomEmbedProps {
  soundcloudUrl: string;
  isOpen: boolean;
  coverArt?: string;
  onClose?: () => void;
  onOpenChangeTrack?: () => void;
  onSwitchToWaveform?: () => void;
  hasYouTube?: boolean;
  onSwitchToYouTube?: () => void;
  onExternalTimeUpdate?: (time: number) => void;
  onExternalPlayStateChange?: (isPlaying: boolean) => void;
  onDurationDetected?: (duration: number) => void;
  trackTitle?: string;
  artistName?: string;
}

export const SoundCloudBottomEmbed: React.FC<SoundCloudBottomEmbedProps> = React.memo(({
  soundcloudUrl,
  isOpen,
  coverArt,
  onClose,
  onOpenChangeTrack,
  onSwitchToWaveform,
  hasYouTube = false,
  onSwitchToYouTube,
  onExternalTimeUpdate,
  onExternalPlayStateChange,
  onDurationDetected,
  trackTitle,
  artistName,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const widgetRef = useRef<any>(null);
  const [isWidgetReady, setIsWidgetReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(coverArt || null);

  useEffect(() => {
    if (coverArt) {
      setArtworkUrl(coverArt);
    }
  }, [coverArt]);

  // Fetch official high-res non-inverted cover artwork via SoundCloud oEmbed
  useEffect(() => {
    if (!soundcloudUrl) return;
    let cancelled = false;
    fetch(`https://soundcloud.com/oembed?url=${encodeURIComponent(soundcloudUrl)}&format=json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.thumbnail_url) {
          setArtworkUrl(data.thumbnail_url);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [soundcloudUrl]);

  // Time Anchors for buttery smooth 60fps interpolation between ~250ms SoundCloud ticks
  const anchorScTime = useRef<number>(0);
  const anchorPerfTime = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // Keep references fresh for event loops
  const onExternalTimeUpdateRef = useRef(onExternalTimeUpdate);
  onExternalTimeUpdateRef.current = onExternalTimeUpdate;
  const onExternalPlayStateChangeRef = useRef(onExternalPlayStateChange);
  onExternalPlayStateChangeRef.current = onExternalPlayStateChange;
  const onDurationDetectedRef = useRef(onDurationDetected);
  onDurationDetectedRef.current = onDurationDetected;

  // 1. Load SoundCloud Widget API script once
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.SC?.Widget) {
      return;
    }

    const existingScript = document.getElementById('sc-widget-api');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'sc-widget-api';
      script.src = 'https://w.soundcloud.com/player/api.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // 2. High-precision 60fps clock interpolation loop
  const stopClockLoop = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  const startClockLoop = useCallback(() => {
    stopClockLoop();

    const streamClock = () => {
      const now = performance.now();
      const elapsedSec = (now - anchorPerfTime.current) / 1000;
      const estimatedTime = Math.max(0, anchorScTime.current + elapsedSec);

      onExternalTimeUpdateRef.current?.(estimatedTime);
      animFrameRef.current = requestAnimationFrame(streamClock);
    };

    animFrameRef.current = requestAnimationFrame(streamClock);
  }, [stopClockLoop]);

  // 3. Initialize SC.Widget when iframe and API are ready
  const initWidget = useCallback(() => {
    if (!iframeRef.current || typeof window === 'undefined') return;

    if (!window.SC?.Widget) {
      // Retry in 150ms until script loads
      const timer = setTimeout(initWidget, 150);
      return () => clearTimeout(timer);
    }

    try {
      const widget = window.SC.Widget(iframeRef.current);
      widgetRef.current = widget;

      const events = window.SC.Widget.Events;

      widget.bind(events.READY, () => {
        setIsWidgetReady(true);
        setLoadError(null);

        widget.getDuration((durationMs: number) => {
          if (typeof durationMs === 'number' && durationMs > 0) {
            onDurationDetectedRef.current?.(durationMs / 1000);
          }
        });
      });

      widget.bind(events.PLAY, () => {
        setIsPlaying(true);
        onExternalPlayStateChangeRef.current?.(true);
        startClockLoop();
      });

      widget.bind(events.PAUSE, () => {
        setIsPlaying(false);
        onExternalPlayStateChangeRef.current?.(false);
        stopClockLoop();

        widget.getPosition((posMs: number) => {
          const sec = posMs / 1000;
          anchorScTime.current = sec;
          anchorPerfTime.current = performance.now();
          onExternalTimeUpdateRef.current?.(sec);
        });
      });

      widget.bind(events.FINISH, () => {
        setIsPlaying(false);
        onExternalPlayStateChangeRef.current?.(false);
        stopClockLoop();
      });

      widget.bind(events.PLAY_PROGRESS, (data: { currentPosition: number }) => {
        const sec = data.currentPosition / 1000;
        anchorScTime.current = sec;
        anchorPerfTime.current = performance.now();
      });

      widget.bind(events.SEEK, (data: { currentPosition: number }) => {
        const sec = data.currentPosition / 1000;
        anchorScTime.current = sec;
        anchorPerfTime.current = performance.now();
        onExternalTimeUpdateRef.current?.(sec);
      });

      widget.bind(events.ERROR, () => {
        setLoadError('SoundCloud track could not be loaded or is private.');
        stopClockLoop();
      });
    } catch (err: any) {
      console.warn('[SoundCloudBottomEmbed] Init error:', err);
      setLoadError('Failed to initialize SoundCloud widget.');
    }
  }, [startClockLoop, stopClockLoop]);

  useEffect(() => {
    initWidget();

    return () => {
      stopClockLoop();
      if (widgetRef.current && window.SC?.Widget?.Events) {
        try {
          widgetRef.current.unbind(window.SC.Widget.Events.PLAY);
          widgetRef.current.unbind(window.SC.Widget.Events.PAUSE);
          widgetRef.current.unbind(window.SC.Widget.Events.FINISH);
          widgetRef.current.unbind(window.SC.Widget.Events.PLAY_PROGRESS);
          widgetRef.current.unbind(window.SC.Widget.Events.SEEK);
          widgetRef.current.unbind(window.SC.Widget.Events.READY);
          widgetRef.current.unbind(window.SC.Widget.Events.ERROR);
        } catch {}
      }
    };
  }, [initWidget, stopClockLoop, soundcloudUrl]);

  // 4. Global OpenLyryc Studio Transport Bus
  useEffect(() => {
    const handleToggle = (e: any) => {
      if (!widgetRef.current) return;
      try {
        if (e?.detail && typeof e.detail.isPlaying === 'boolean') {
          if (e.detail.isPlaying) {
            widgetRef.current.play();
          } else {
            widgetRef.current.pause();
          }
        } else {
          widgetRef.current.toggle();
        }
      } catch {}
    };

    const handleSeekRelative = (e: any) => {
      if (!widgetRef.current) return;
      const seconds = e.detail?.seconds ?? 0;
      try {
        widgetRef.current.getPosition((posMs: number) => {
          const target = Math.max(0, posMs + seconds * 1000);
          widgetRef.current.seekTo(target);
          anchorScTime.current = target / 1000;
          anchorPerfTime.current = performance.now();
          onExternalTimeUpdateRef.current?.(target / 1000);
        });
      } catch {}
    };

    const handleSeekTo = (e: any) => {
      if (!widgetRef.current) return;
      const targetSeconds = Math.max(0, e.detail?.time ?? 0);
      try {
        const targetMs = targetSeconds * 1000;
        widgetRef.current.seekTo(targetMs);
        anchorScTime.current = targetSeconds;
        anchorPerfTime.current = performance.now();
        onExternalTimeUpdateRef.current?.(targetSeconds);
      } catch {}
    };

    window.addEventListener('openlyryc:toggle-play', handleToggle);
    window.addEventListener('openlyryc:seek-relative', handleSeekRelative);
    window.addEventListener('openlyryc:seek-to', handleSeekTo);

    return () => {
      window.removeEventListener('openlyryc:toggle-play', handleToggle);
      window.removeEventListener('openlyryc:seek-relative', handleSeekRelative);
      window.removeEventListener('openlyryc:seek-to', handleSeekTo);
    };
  }, []);

  if (!isOpen || !soundcloudUrl) return null;

  // Encode widget iframe URL: visual=false gives the sleek classic waveform view
  const iframeSrc = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
    soundcloudUrl
  )}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false`;

  return (
    <footer className="w-full bg-[#070709] border-t border-white/[0.08] shadow-2xl relative z-20 select-none studio-chrome">
      {/* Discreet floating corner actions (Minimal, no vertical row space) */}
      <div className="absolute top-2 right-3 z-30 flex items-center gap-1.5 pointer-events-auto">
        {hasYouTube && onSwitchToYouTube && (
          <button
            type="button"
            onClick={onSwitchToYouTube}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium text-zinc-400 hover:text-white bg-[#121216]/90 hover:bg-[#1a1a22] border border-white/10 backdrop-blur-md transition-colors cursor-pointer shadow-sm flex items-center gap-1"
            title="Switch back to YouTube Audio Source"
          >
            <span className="material-symbols-outlined text-[12px]">smart_display</span>
            <span>YouTube</span>
          </button>
        )}

        {onSwitchToWaveform && (
          <button
            type="button"
            onClick={onSwitchToWaveform}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium text-zinc-400 hover:text-white bg-[#121216]/90 hover:bg-[#1a1a22] border border-white/10 backdrop-blur-md transition-colors cursor-pointer shadow-sm"
            title="Switch back to WaveSurfer Local Audio Mode"
          >
            Waveform
          </button>
        )}

        {onOpenChangeTrack && (
          <button
            type="button"
            onClick={onOpenChangeTrack}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium text-zinc-300 hover:text-white bg-[#121216]/90 hover:bg-[#1a1a22] border border-white/10 backdrop-blur-md transition-colors cursor-pointer shadow-sm flex items-center gap-1"
            title="Search or select a different SoundCloud track"
          >
            <Search className="w-2.5 h-2.5 text-zinc-400" />
            <span>Change Track</span>
          </button>
        )}

        <a
          href={soundcloudUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-5 h-5 rounded-full flex items-center justify-center text-zinc-400 hover:text-white bg-[#121216]/90 hover:bg-[#1a1a22] border border-white/10 backdrop-blur-md transition-colors shadow-sm"
          title="Open track on SoundCloud"
        >
          <ExternalLink className="w-3 h-3" />
        </a>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 rounded-full flex items-center justify-center text-zinc-400 hover:text-white bg-[#121216]/90 hover:bg-[#1a1a22] border border-white/10 backdrop-blur-md transition-colors cursor-pointer shadow-sm"
            title="Close SoundCloud player"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Slim & Sleek Obsidian Embedded Player */}
      <div className="relative h-[68px] sm:h-[76px] w-full bg-[#070709] overflow-hidden flex items-center">
        {/* True-Color Non-Inverted Artwork Overlay (Shields the inverted thumbnail & privacy text) */}
        {artworkUrl ? (
          <div
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('openlyryc:toggle-play', {
                    detail: { isPlaying: !isPlaying },
                  })
                );
              }
            }}
            className="absolute top-0 bottom-0 left-0 aspect-square z-10 cursor-pointer overflow-hidden bg-[#070709] border-r border-white/10 shadow-lg select-none group/art"
            title="Click to toggle playback"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={artworkUrl}
              alt={trackTitle || 'Track Artwork'}
              className="w-full h-full object-cover transition-transform duration-300 group-hover/art:scale-105"
            />
            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/art:opacity-100 transition-opacity flex items-center justify-center">
              <span className="material-symbols-outlined text-white/95 text-xl drop-shadow-md">
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </div>
          </div>
        ) : (
          <div className="absolute top-0 bottom-0 left-0 aspect-square z-10 bg-[#0d0d12] flex items-center justify-center border-r border-white/10 select-none">
            <Music className="w-5 h-5 text-zinc-600 animate-pulse" />
          </div>
        )}
        {loadError ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-4">
            <p className="text-xs text-red-300 font-medium">{loadError}</p>
            <button
              type="button"
              onClick={initWidget}
              className="px-3 py-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-xs text-white flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            width="100%"
            height="80"
            scrolling="no"
            frameBorder="no"
            allow="autoplay"
            className="w-full h-full border-0 block"
            style={{
              filter: 'invert(0.93) hue-rotate(180deg) brightness(0.92) contrast(1.05)',
              backgroundColor: '#070709',
            }}
            title={trackTitle ? (artistName ? `${artistName} - ${trackTitle}` : trackTitle) : 'SoundCloud Studio Player'}
          />
        )}
      </div>
    </footer>
  );
});

SoundCloudBottomEmbed.displayName = 'SoundCloudBottomEmbed';
