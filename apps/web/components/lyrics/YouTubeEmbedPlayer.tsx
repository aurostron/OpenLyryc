'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX, AlertCircle, ExternalLink } from 'lucide-react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type YouTubeDisplayMode = 'side' | 'backdrop' | 'pip' | 'audio';

interface YouTubeEmbedPlayerProps {
  videoId: string | null;
  isPlaying: boolean;
  displayMode: YouTubeDisplayMode;
  isMuted: boolean;
  volume: number;
  syncOffset: number;
  seekTrigger?: { time: number; timestamp: number } | null;
  onTimeUpdate: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onPlayStateChange?: (playing: boolean) => void;
  onOpenFetcher?: () => void;
}

export const YouTubeEmbedPlayer: React.FC<YouTubeEmbedPlayerProps> = ({
  videoId,
  isPlaying,
  displayMode,
  isMuted,
  volume,
  syncOffset,
  seekTrigger,
  onTimeUpdate,
  onDurationChange,
  onPlayStateChange,
  onOpenFetcher,
}) => {
  const containerIdRef = useRef(`yt-player-${Math.random().toString(36).substring(2, 9)}`);
  const playerRef = useRef<any>(null);
  const [isApiReady, setIsApiReady] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [embedError, setEmbedError] = useState<string | null>(null);

  const animFrameRef = useRef<number | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;

  const onPlayStateChangeRef = useRef(onPlayStateChange);
  onPlayStateChangeRef.current = onPlayStateChange;

  const onDurationChangeRef = useRef(onDurationChange);
  onDurationChangeRef.current = onDurationChange;

  const syncOffsetRef = useRef(syncOffset);
  syncOffsetRef.current = syncOffset;

  // 1. Load YouTube IFrame API
  useEffect(() => {
    if (!videoId) return;

    if (window.YT && window.YT.Player) {
      setIsApiReady(true);
      return;
    }

    const existingScript = document.getElementById('youtube-iframe-api');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevCallback) prevCallback();
      setIsApiReady(true);
    };

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (window.YT && window.YT.Player) {
        setIsApiReady(true);
        clearInterval(interval);
      } else if (attempts >= 40) {
        clearInterval(interval);
      }
    }, 120);

    return () => clearInterval(interval);
  }, [videoId]);

  // 2. Initialize or Update Player
  useEffect(() => {
    if (!isApiReady || !videoId) return;

    setEmbedError(null);
    setIsPlayerReady(false);

    let destroyed = false;

    try {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }

      playerRef.current = new window.YT.Player(containerIdRef.current, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: displayMode === 'pip' ? 1 : 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          playsinline: 1,
          enablejsapi: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
        events: {
          onReady: (event: any) => {
            if (destroyed) return;
            setIsPlayerReady(true);
            const player = event.target;
            if (isMuted) player.mute();
            else player.unMute();
            player.setVolume(volume);

            const dur = player.getDuration();
            if (dur && onDurationChangeRef.current) {
              onDurationChangeRef.current(dur);
            }

            if (isPlaying) {
              player.playVideo();
            }
          },
          onStateChange: (event: any) => {
            if (destroyed) return;
            // YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
            if (event.data === 1) {
              onPlayStateChangeRef.current?.(true);
            } else if (event.data === 2) {
              onPlayStateChangeRef.current?.(false);
            } else if (event.data === 0) {
              onPlayStateChangeRef.current?.(false);
              onTimeUpdateRef.current?.(0);
            }
          },
          onError: (event: any) => {
            if (destroyed) return;
            // 101 or 150 = Video cannot be played in embedded players
            if (event.data === 150 || event.data === 101) {
              setEmbedError('Owner has restricted playback to YouTube.com');
            } else if (event.data === 100) {
              setEmbedError('Video not found or removed');
            } else {
              setEmbedError('Unable to play this video');
            }
          },
        },
      });
    } catch (e: any) {
      setEmbedError(e?.message || 'Player initialization failed');
    }

    return () => {
      destroyed = true;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
    };
  }, [isApiReady, videoId]);

  // 3. React to isPlaying changes
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;
    try {
      if (isPlaying) {
        const state = playerRef.current.getPlayerState?.();
        if (state !== 1 && state !== 3) {
          playerRef.current.playVideo?.();
        }
      } else {
        playerRef.current.pauseVideo?.();
      }
    } catch {
      // ignore
    }
  }, [isPlaying, isPlayerReady]);

  // 4. React to Volume / Mute
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;
    try {
      if (isMuted) {
        playerRef.current.mute?.();
      } else {
        playerRef.current.unMute?.();
        playerRef.current.setVolume?.(volume);
      }
    } catch {
      // ignore
    }
  }, [isMuted, volume, isPlayerReady]);

  // 5. Seek Trigger
  useEffect(() => {
    if (!seekTrigger || !isPlayerReady || !playerRef.current) return;
    try {
      const target = Math.max(0, seekTrigger.time + syncOffsetRef.current);
      playerRef.current.seekTo?.(target, true);
    } catch {
      // ignore
    }
  }, [seekTrigger, isPlayerReady]);

  // 6. High-Frequency Clock Sync Loop
  useEffect(() => {
    if (!isPlayerReady || !isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    let isRunning = true;
    let lastPolledTime = -1;

    const tick = () => {
      if (!isRunning) return;

      try {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          const rawTime = playerRef.current.getCurrentTime();
          if (typeof rawTime === 'number' && !isNaN(rawTime)) {
            const adjustedTime = Math.max(0, rawTime - syncOffsetRef.current);
            if (Math.abs(adjustedTime - lastPolledTime) > 0.015) {
              lastPolledTime = adjustedTime;
              onTimeUpdateRef.current(adjustedTime);
            }
          }
        }
      } catch {
        // ignore
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlayerReady, isPlaying]);

  if (!videoId) return null;

  // Display mode styling
  let containerStyles = 'w-full h-full';
  if (displayMode === 'audio') {
    containerStyles = 'w-[1px] h-[1px] opacity-0 pointer-events-none absolute -left-[9999px]';
  } else if (displayMode === 'backdrop') {
    containerStyles = 'fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden';
  } else if (displayMode === 'pip') {
    containerStyles = 'fixed bottom-6 right-6 w-80 aspect-video rounded-xl shadow-2xl border border-white/10 z-40 overflow-hidden bg-black';
  }

  return (
    <div className={`relative ${containerStyles}`}>
      <div id={containerIdRef.current} className="w-full h-full" />

      {/* Error Fallback Banner */}
      {embedError && (
        <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center z-10 rounded-xl">
          <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
          <p className="text-xs font-semibold text-zinc-200 mb-1">{embedError}</p>
          <p className="text-[11px] text-zinc-400 mb-3 max-w-xs">
            Try picking an alternate video candidate using the YouTube Fetcher.
          </p>
          <div className="flex items-center gap-2">
            {onOpenFetcher && (
              <button
                type="button"
                onClick={onOpenFetcher}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Choose Alternate Video
              </button>
            )}
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Watch on YouTube</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
