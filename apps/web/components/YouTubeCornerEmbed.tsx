'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { parseYouTubeMusicId } from '@/lib/platformLinker';
import { FramerateTarget, VideoDisplayMode, VideoQualityPreference } from '@/types/settings';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface WindowPosition {
  x: number;
  y: number;
}

interface YouTubeCornerEmbedProps {
  youtubeId?: string;
  isOpen: boolean;
  onClose: () => void;
  wavesurfer: WaveSurfer | null;
  isLocalAudioLoaded: boolean;
  isSidebarOpen?: boolean;
  onExternalTimeUpdate?: (time: number) => void;
  onExternalPlayStateChange?: (isPlaying: boolean) => void;
  onDurationDetected?: (duration: number) => void;
  framerateTarget?: FramerateTarget;
  videoDisplayMode?: VideoDisplayMode;
  disableBackdropMode?: boolean;
  onToggleDisplayMode?: (mode: VideoDisplayMode) => void;
  backdropOpacity?: number;
  backdropBlur?: number;
  videoQualityPreference?: VideoQualityPreference;
  hideBackdropControls?: boolean;
  isTimelineMode?: boolean;
  nleMonitorMode?: 'video' | 'stage';
  initialTime?: number;
  onError?: (error: string, errorCode: number) => void;
}

const STORAGE_KEY = 'openlyryc_yt_window_pos';
const SNAP_THRESHOLD = 18; // px near viewport edges to trigger magnetic snap

export const YouTubeCornerEmbed: React.FC<YouTubeCornerEmbedProps> = React.memo(({
  youtubeId,
  isOpen,
  onClose,
  wavesurfer,
  isLocalAudioLoaded,
  isSidebarOpen = true,
  onExternalTimeUpdate,
  onExternalPlayStateChange,
  onDurationDetected,
  framerateTarget = '60',
  videoDisplayMode = 'pip',
  disableBackdropMode = false,
  onToggleDisplayMode,
  backdropOpacity = 0.35,
  backdropBlur = 0,
  videoQualityPreference = 'default',
  hideBackdropControls = false,
  isTimelineMode = false,
  nleMonitorMode = 'video',
  initialTime,
  onError,
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isExpandedSize, setIsExpandedSize] = useState<boolean>(false);
  const [isApiReady, setIsApiReady] = useState<boolean>(false);
  const [isPlayerReady, setIsPlayerReady] = useState<boolean>(false);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(isLocalAudioLoaded);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);

  // Free-form Window Position (Floating window placement with local persistence)
  const [position, setPosition] = useState<WindowPosition | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Automatically un-minimize if backdrop is disabled (e.g. Editorial mode) to guarantee video visibility
  useEffect(() => {
    if (disableBackdropMode && isMinimized) {
      setIsMinimized(false);
    }
  }, [disableBackdropMode, isMinimized]);

  // Responsive Bounding Rect for Program Monitor Docking in Classic NLE Mode
  const [timelineViewportRect, setTimelineViewportRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (!isTimelineMode) {
      setTimelineViewportRect(null);
      return;
    }

    let ro: ResizeObserver | null = null;
    let observedEl: HTMLElement | null = null;

    const updateRect = () => {
      const el = document.getElementById('nle-program-monitor-viewport');
      if (el) {
        if (!ro && typeof ResizeObserver !== 'undefined' && el !== observedEl) {
          ro = new ResizeObserver(updateRect);
          ro.observe(el);
          observedEl = el;
        }
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          setTimelineViewportRect((prev) => {
            if (
              prev &&
              Math.abs(prev.left - r.left) < 1 &&
              Math.abs(prev.top - r.top) < 1 &&
              Math.abs(prev.width - r.width) < 1 &&
              Math.abs(prev.height - r.height) < 1
            ) {
              return prev;
            }
            return { left: r.left, top: r.top, width: r.width, height: r.height };
          });
        }
      }
    };

    updateRect();

    // Polling interval ensures attachment even during AnimatePresence exit animations (180ms delay)
    const interval = setInterval(updateRect, 80);

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect);
    window.addEventListener('nle-viewport-resize', updateRect);

    return () => {
      clearInterval(interval);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
      window.removeEventListener('nle-viewport-resize', updateRect);
    };
  }, [isTimelineMode]);

  const containerId = useMemo(() => `yt-embed-box-${Math.random().toString(36).substring(2, 9)}`, []);
  const playerRef = useRef<any>(null);
  const embedBoxRef = useRef<HTMLDivElement>(null);
  const isSyncingFromOpenLyryc = useRef<boolean>(false);
  const isSyncingFromYouTube = useRef<boolean>(false);
  const clockAnimFrameRef = useRef<number | null>(null);
  const userWantsPlaybackRef = useRef<boolean>(false);

  const postIframeCommand = useCallback((command: string, args: any[] = []) => {
    try {
      const iframeEl = embedBoxRef.current?.querySelector('iframe') as HTMLIFrameElement | null;
      if (iframeEl && iframeEl.contentWindow) {
        iframeEl.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: command, args }),
          'https://www.youtube.com'
        );
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // ── Performance Anchor Clock ──────────────────────────────────────────────
  const anchorYtTime = useRef<number>(0);
  const anchorPerfTime = useRef<number>(0);
  const lastPolledYtTime = useRef<number>(-1);
  const isYtStalled = useRef<boolean>(false);
  const lastPollPerfTime = useRef<number>(0);
  const lastEmitTime = useRef<number>(0);
  const lastEmittedValue = useRef<number>(-1);

  const cleanVideoId = useMemo(() => {
    return parseYouTubeMusicId(youtubeId);
  }, [youtubeId]);

  const onExternalTimeUpdateRef = useRef(onExternalTimeUpdate);
  onExternalTimeUpdateRef.current = onExternalTimeUpdate;

  const onExternalPlayStateChangeRef = useRef(onExternalPlayStateChange);
  onExternalPlayStateChangeRef.current = onExternalPlayStateChange;

  // 1. Load YouTube IFrame Player API Script
  useEffect(() => {
    if (!cleanVideoId || !isOpen) return;

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
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevCallback) prevCallback();
      setIsApiReady(true);
    };

    // P1 perf: cap API-ready polling (~5s) so a blocked API script doesn't
    // leave a 100ms interval running for the life of the page.
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (window.YT && window.YT.Player) {
        setIsApiReady(true);
        clearInterval(interval);
      } else if (attempts >= 50) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [cleanVideoId, isOpen]);

  // 2. Initialize & Hot-Swap YouTube Player
  const currentVideoIdRef = useRef<string | null>(null);

  // Seamless Video Hot-Swap when user switches YouTube video midway
  useEffect(() => {
    if (!cleanVideoId || !isPlayerReady || !playerRef.current) return;

    if (currentVideoIdRef.current && currentVideoIdRef.current !== cleanVideoId) {
      currentVideoIdRef.current = cleanVideoId;

      // Reset performance clock anchors for the newly loaded track
      anchorYtTime.current = 0;
      anchorPerfTime.current = performance.now();
      lastPolledYtTime.current = -1;
      isYtStalled.current = false;
      lastPollPerfTime.current = 0;
      lastEmitTime.current = 0;
      onExternalTimeUpdateRef.current?.(0);

      const wasPlaying = isVideoPlaying || (wavesurfer && wavesurfer.isPlaying());

      try {
        if (wasPlaying) {
          if (typeof playerRef.current.loadVideoById === 'function') {
            playerRef.current.loadVideoById({
              videoId: cleanVideoId,
              startSeconds: 0,
            });
            playerRef.current.playVideo?.();
          }
        } else {
          if (typeof playerRef.current.cueVideoById === 'function') {
            playerRef.current.cueVideoById({
              videoId: cleanVideoId,
              startSeconds: 0,
            });
          }
        }
      } catch (err) {
        console.warn('Error hot-swapping YouTube video:', err);
      }
    }
  }, [cleanVideoId, isPlayerReady, wavesurfer, isVideoPlaying]);

  const isLocalAudioLoadedRef = useRef(isLocalAudioLoaded);
  isLocalAudioLoadedRef.current = isLocalAudioLoaded;

  const isVideoPlayingRef = useRef(isVideoPlaying);
  isVideoPlayingRef.current = isVideoPlaying;

  const wavesurferRef = useRef(wavesurfer);
  wavesurferRef.current = wavesurfer;

  const onDurationDetectedRef = useRef(onDurationDetected);
  onDurationDetectedRef.current = onDurationDetected;

  const videoQualityPreferenceRef = useRef(videoQualityPreference);
  videoQualityPreferenceRef.current = videoQualityPreference;

  const pendingSeekTimeRef = useRef<number | null>(null);
  const pendingPlayStateRef = useRef<boolean | null>(null);

  // Set preferred video quality on the YouTube Player API
  useEffect(() => {
    if (playerRef.current && isPlayerReady && typeof playerRef.current.setPlaybackQuality === 'function') {
      try {
        playerRef.current.setPlaybackQuality(videoQualityPreference);
      } catch (err) {
        // ignore
      }
    }
  }, [videoQualityPreference, isPlayerReady]);

  // Initial YouTube Player setup
  useEffect(() => {
    if (!isApiReady || !cleanVideoId || !isOpen) return;
    if (playerRef.current) return; // Player already initialized, hot-swap handles video changes

    currentVideoIdRef.current = cleanVideoId;
    let destroyed = false;

    const timer = setTimeout(() => {
      if (destroyed) return;
      const targetEl = document.getElementById(containerId);
      if (!targetEl) return;

      try {
        const ws = wavesurferRef.current;
        const targetTime = (ws && ws.getDuration() > 0)
          ? ws.getCurrentTime()
          : (initialTime !== undefined && initialTime > 0 ? initialTime : (anchorYtTime.current || 0));

        playerRef.current = new window.YT.Player(containerId, {
          width: '100%',
          height: '100%',
          videoId: cleanVideoId,
          playerVars: {
            autoplay: isVideoPlayingRef.current || (ws && ws.isPlaying()) ? 1 : 0,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            enablejsapi: 1,
            start: Math.floor(targetTime),
            origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          },
          events: {
            onReady: (event: any) => {
              if (destroyed) return;
              setIsPlayerReady(true);
              setEmbedError(null);

              try {
                const iframe = embedBoxRef.current?.querySelector('iframe');
                if (iframe) {
                  iframe.setAttribute(
                    'allow',
                    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
                  );
                }
              } catch {}

              try {
                const dur = event.target.getDuration?.();
                if (typeof dur === 'number' && dur >= 1) {
                  onDurationDetectedRef.current?.(dur);
                }
              } catch (e) {
                // ignore
              }

              try {
                event.target.setVolume?.(100);
              } catch {}

              if (isLocalAudioLoadedRef.current) {
                event.target.mute();
                setIsMuted(true);
              } else {
                try {
                  event.target.unMute();
                  setIsMuted(false);
                } catch {
                  // ignore
                }
              }

              const pref = videoQualityPreferenceRef.current;
              if (pref && pref !== 'default') {
                try {
                  event.target.setPlaybackQuality(pref);
                } catch (e) {
                  // ignore
                }
              }

              if (pendingSeekTimeRef.current !== null) {
                event.target.seekTo(pendingSeekTimeRef.current, true);
                anchorYtTime.current = pendingSeekTimeRef.current;
                anchorPerfTime.current = performance.now();
                pendingSeekTimeRef.current = null;
              } else if (targetTime > 0) {
                event.target.seekTo(targetTime, true);
                anchorYtTime.current = targetTime;
                anchorPerfTime.current = performance.now();
              }

              const wsCurrent = wavesurferRef.current;
              const shouldAutoPlay = pendingPlayStateRef.current !== null
                ? pendingPlayStateRef.current
                : (isVideoPlayingRef.current || (wsCurrent && wsCurrent.isPlaying()));

              if (shouldAutoPlay) {
                userWantsPlaybackRef.current = true;
                try {
                  event.target.playVideo?.();
                } catch {
                  try {
                    event.target.mute?.();
                    setIsMuted(true);
                    event.target.playVideo?.();
                  } catch {}
                }
                setTimeout(() => {
                  if (userWantsPlaybackRef.current && event.target) {
                    try {
                      const st = event.target.getPlayerState?.();
                      if (st !== 1 && st !== 3) {
                        event.target.mute?.();
                        setIsMuted(true);
                        event.target.playVideo?.();
                      }
                    } catch {}
                  }
                }, 300);
                setIsVideoPlaying(true);
                onExternalPlayStateChange?.(true);
              }
            },
            onStateChange: (event: any) => {
              if (destroyed) return;
              try {
                const dur = event.target.getDuration?.();
                if (typeof dur === 'number' && dur >= 1) {
                  onDurationDetectedRef.current?.(dur);
                }
              } catch (e) {
                // ignore
              }

              const pref = videoQualityPreferenceRef.current;
              if (event.data === 1 && pref && pref !== 'default') {
                try {
                  event.target.setPlaybackQuality(pref);
                } catch (e) {
                  // ignore
                }
              }

              handleYouTubeStateChange(event.data);
            },
            onError: (event: any) => {
              console.warn('YouTube Player Event Error:', event.data);
              let msg = 'Playback error';
              if (event.data === 150 || event.data === 101) {
                msg = 'Owner restricted playback on external sites (Error 150)';
              } else if (event.data === 100) {
                msg = 'Video not found or private (Error 100)';
              } else if (event.data === 2) {
                msg = 'Invalid YouTube video ID (Error 2)';
              } else if (event.data === 5) {
                msg = 'HTML5 player error';
              }
              setEmbedError(msg);
              onError?.(msg, event.data);
            },
          },
        });
      } catch (err) {
        console.error('Error initializing YouTube Player:', err);
      }
    }, 50);

    return () => {
      destroyed = true;
      clearTimeout(timer);
    };
  }, [isApiReady, cleanVideoId, isOpen, containerId]);

  // Teardown player only when embed is closed or unmounted
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // ignore
        }
        playerRef.current = null;
      }
      setIsPlayerReady(false);
    };
  }, [isOpen]);

  const isMutedRef = useRef<boolean>(isMuted);
  isMutedRef.current = isMuted;

  // Emit mute state changes globally so host players (like PosterPreviewPlayer) can update indicators
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('openlyryc:mute-state', { detail: { isMuted } })
      );
    }
  }, [isMuted]);

  // When browser autoplay policy forces muted playback, auto-unmute on the first user interaction
  useEffect(() => {
    if (!isMuted || isLocalAudioLoadedRef.current) return;

    const handleFirstUserGesture = () => {
      if (playerRef.current) {
        try {
          playerRef.current.unMute?.();
          playerRef.current.setVolume?.(100);
          setIsMuted(false);
        } catch {}
      }
    };

    window.addEventListener('pointerdown', handleFirstUserGesture, { capture: true, once: true });
    window.addEventListener('keydown', handleFirstUserGesture, { capture: true, once: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstUserGesture, { capture: true });
      window.removeEventListener('keydown', handleFirstUserGesture, { capture: true });
    };
  }, [isMuted]);

  // Enforce YouTube mute state strictly based on selected audio source mode
  useEffect(() => {
    setIsMuted(isLocalAudioLoaded);
    if (playerRef.current && isPlayerReady) {
      try {
        if (isLocalAudioLoaded) {
          playerRef.current.mute?.();
        } else {
          playerRef.current.unMute?.();
          playerRef.current.setVolume?.(100);
        }
      } catch (e) {
        // ignore
      }
    }
  }, [isLocalAudioLoaded, isPlayerReady]);

  // 3. Sync from YouTube -> OpenLyryc (State Change Handler)
  const handleYouTubeStateChange = useCallback((state: number) => {
    if (!window.YT) return;

    if (state === window.YT.PlayerState.PLAYING) {
      userWantsPlaybackRef.current = true;
      setIsVideoPlaying(true);
      isYtStalled.current = false;
      try {
        const cur = playerRef.current?.getCurrentTime?.();
        if (typeof cur === 'number' && cur >= 0) {
          anchorYtTime.current = cur;
          anchorPerfTime.current = performance.now();
        }
        const dur = playerRef.current?.getDuration?.();
        if (typeof dur === 'number' && dur >= 1) {
          onDurationDetectedRef.current?.(dur);
        }
      } catch {}
      // Only emit play state if YouTube is the primary audio source
      if (!isLocalAudioLoadedRef.current) {
        onExternalPlayStateChangeRef.current?.(true);
      }
    } else if (state === window.YT.PlayerState.PAUSED) {
      const isBackgrounded =
        typeof document !== 'undefined' &&
        (document.hidden || !document.hasFocus());

      // If user did not manually pause, but browser minimized or tab lost focus:
      // Prevent unwanted auto-pause from YouTube embed and re-issue play command immediately!
      if (userWantsPlaybackRef.current && isBackgrounded) {
        try {
          playerRef.current?.playVideo?.();
          postIframeCommand('playVideo');
        } catch {}

        setTimeout(() => {
          if (userWantsPlaybackRef.current && (document.hidden || !document.hasFocus())) {
            try {
              playerRef.current?.playVideo?.();
              postIframeCommand('playVideo');
            } catch {}
          }
        }, 120);

        // Keep playing in OpenLyryc
        return;
      }

      userWantsPlaybackRef.current = false;
      setIsVideoPlaying(false);
      // Only emit play state if YouTube is the primary audio source
      if (!isLocalAudioLoadedRef.current) {
        onExternalPlayStateChangeRef.current?.(false);
      }
    } else if (state === window.YT.PlayerState.ENDED) {
      userWantsPlaybackRef.current = false;
      setIsVideoPlaying(false);
      // Only emit play state if YouTube is the primary audio source
      if (!isLocalAudioLoadedRef.current) {
        onExternalPlayStateChangeRef.current?.(false);
      }
    }
  }, [postIframeCommand]);

  // 4. Continuous Clock Sync Loop from YouTube (Active only in YT source mode)
  useEffect(() => {
    if (!isVideoPlaying || !isPlayerReady || !playerRef.current || isLocalAudioLoaded) {
      if (clockAnimFrameRef.current) {
        cancelAnimationFrame(clockAnimFrameRef.current);
        clockAnimFrameRef.current = null;
      }
      return;
    }

    // P1 perf: poll getCurrentTime() by wall-time (every 250ms) instead of
    // every N rAF frames — identical behavior on 60Hz/120Hz/240Hz displays,
    // ~4 IPC postMessages/sec instead of ~10-20. Smoothness comes from
    // performance.now() extrapolation between polls.
    const POLL_INTERVAL_MS = 250;
    const SNAP_THRESH = 0.5;

    const streamClock = () => {
      if (!playerRef.current || !playerRef.current.getCurrentTime) {
        clockAnimFrameRef.current = requestAnimationFrame(streamClock);
        return;
      }

      const now = performance.now();

      if (now - lastPollPerfTime.current >= POLL_INTERVAL_MS) {
        lastPollPerfTime.current = now;

        const reportedYtTime: number = playerRef.current.getCurrentTime() || 0;

        // Continuously ensure duration is reported if not already detected
        try {
          const currentDur = playerRef.current.getDuration?.();
          if (typeof currentDur === 'number' && currentDur >= 1) {
            onDurationDetectedRef.current?.(currentDur);
          }
        } catch {}

        // Only stall if YouTube explicitly reports BUFFERING (state 3)
        let isBuffering = false;
        try {
          isBuffering = playerRef.current?.getPlayerState?.() === 3;
        } catch {}

        if (isBuffering) {
          isYtStalled.current = true;
          anchorYtTime.current = reportedYtTime;
          anchorPerfTime.current = now;
        } else {
          isYtStalled.current = false;

          const currentEst = anchorYtTime.current + (now - anchorPerfTime.current) / 1000;
          const drift = reportedYtTime - currentEst;

          if (Math.abs(drift) > SNAP_THRESH) {
            anchorYtTime.current = reportedYtTime;
            anchorPerfTime.current = now;
          } else if (Math.abs(drift) > 0.04) {
            // Smoothly align anchor together with performance time to eliminate jump steps
            anchorYtTime.current = currentEst + drift * 0.2;
            anchorPerfTime.current = now;
          }
        }

        lastPolledYtTime.current = reportedYtTime;
      }

      let estimatedTime: number;
      if (isYtStalled.current) {
        estimatedTime = anchorYtTime.current;
      } else {
        estimatedTime = anchorYtTime.current + (now - anchorPerfTime.current) / 1000;
      }

      // P0 perf: cap React emits at 60Hz. 'max' maps to 16.6ms (same as '60');
      // polling stays at POLL_INTERVAL frames, interpolation via performance.now().
      const frameIntervalMs =
        framerateTarget === '30' ? 33.3 : 16.6;

      const elapsed = now - lastEmitTime.current;
      if (elapsed >= frameIntervalMs && Math.abs(estimatedTime - lastEmittedValue.current) >= 0.005) {
        lastEmitTime.current = now;
        lastEmittedValue.current = estimatedTime;
        onExternalTimeUpdateRef.current?.(estimatedTime);
      }

      clockAnimFrameRef.current = requestAnimationFrame(streamClock);
    };

    const initYtTime = playerRef.current?.getCurrentTime?.() || 0;
    anchorYtTime.current = initYtTime;
    anchorPerfTime.current = performance.now();
    lastPolledYtTime.current = -1;
    isYtStalled.current = false;
    lastPollPerfTime.current = 0;

    clockAnimFrameRef.current = requestAnimationFrame(streamClock);

    return () => {
      if (clockAnimFrameRef.current) {
        cancelAnimationFrame(clockAnimFrameRef.current);
        clockAnimFrameRef.current = null;
      }
    };
  }, [isVideoPlaying, isPlayerReady, isLocalAudioLoaded, framerateTarget, cleanVideoId]);

  // 5. Sync from OpenLyryc (Wavesurfer) -> YouTube
  useEffect(() => {
    if (!wavesurfer || !isPlayerReady || !playerRef.current) return;

    const handleWsPlay = () => {
      userWantsPlaybackRef.current = true;
      if (isSyncingFromYouTube.current) return;
      isSyncingFromOpenLyryc.current = true;
      try {
        const curTime = wavesurfer.getCurrentTime();
        if (playerRef.current.seekTo) {
          playerRef.current.seekTo(curTime, true);
        }
        if (playerRef.current.playVideo) {
          playerRef.current.playVideo();
        }
      } catch (e) {
        // ignore
      }
      setTimeout(() => {
        isSyncingFromOpenLyryc.current = false;
      }, 250);
    };

    const handleWsPause = () => {
      if (isLocalAudioLoadedRef.current) {
        userWantsPlaybackRef.current = false;
      }
      if (isSyncingFromYouTube.current) return;
      isSyncingFromOpenLyryc.current = true;
      try {
        if (playerRef.current.pauseVideo) {
          playerRef.current.pauseVideo();
        }
      } catch (e) {
        // ignore
      }
      setTimeout(() => {
        isSyncingFromOpenLyryc.current = false;
      }, 250);
    };

    const handleWsSeeking = () => {
      if (isSyncingFromYouTube.current) return;
      isSyncingFromOpenLyryc.current = true;
      try {
        const curTime = wavesurfer.getCurrentTime();
        if (playerRef.current.seekTo) {
          playerRef.current.seekTo(curTime, true);
        }
      } catch (e) {
        // ignore
      }
      setTimeout(() => {
        isSyncingFromOpenLyryc.current = false;
      }, 250);
    };

    wavesurfer.on('play', handleWsPlay);
    wavesurfer.on('pause', handleWsPause);
    wavesurfer.on('seeking', handleWsSeeking);

    return () => {
      wavesurfer.un('play', handleWsPlay);
      wavesurfer.un('pause', handleWsPause);
      wavesurfer.un('seeking', handleWsSeeking);
    };
  }, [wavesurfer, isPlayerReady]);

  // Keep YouTube playback active when the browser window is minimized or tab is unfocused
  useEffect(() => {
    const keepPlayingInBackground = () => {
      if (userWantsPlaybackRef.current) {
        const resume = () => {
          if (userWantsPlaybackRef.current) {
            try {
              playerRef.current?.playVideo?.();
              postIframeCommand('playVideo');
            } catch {}
          }
        };

        resume();
        setTimeout(resume, 60);
        setTimeout(resume, 180);
        setTimeout(resume, 360);
      }
    };

    document.addEventListener('visibilitychange', keepPlayingInBackground);
    window.addEventListener('blur', keepPlayingInBackground);

    return () => {
      document.removeEventListener('visibilitychange', keepPlayingInBackground);
      window.removeEventListener('blur', keepPlayingInBackground);
    };
  }, [postIframeCommand]);

  // Keep virtual audio clock streaming to OpenLyryc during browser backgrounding / minimize
  // P1 perf: 250ms cadence matches the foreground poll rate (was 80ms — 3x IPC spam while hidden).
  useEffect(() => {
    let bgInterval: NodeJS.Timeout | null = null;

    const handleVisibilityClock = () => {
      if (document.hidden) {
        if (!bgInterval) {
          bgInterval = setInterval(() => {
            if (!playerRef.current || !userWantsPlaybackRef.current) return;
            try {
              const ytTime = playerRef.current.getCurrentTime?.();
              if (typeof ytTime === 'number' && ytTime >= 0) {
                onExternalTimeUpdateRef.current?.(ytTime);
              }
            } catch {}
          }, 250);
        }
      } else {
        if (bgInterval) {
          clearInterval(bgInterval);
          bgInterval = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityClock);
    return () => {
      if (bgInterval) clearInterval(bgInterval);
      document.removeEventListener('visibilitychange', handleVisibilityClock);
    };
  }, []);

  // 6. Direct Global Events
  useEffect(() => {
    const handleToggle = (e: any) => {
      setTimeout(() => {
        let targetState: boolean | undefined = undefined;
        if (typeof e?.detail === 'boolean') {
          targetState = e.detail;
        } else if (typeof e?.detail?.isPlaying === 'boolean') {
          targetState = e.detail.isPlaying;
        } else if (typeof e?.detail?.play === 'boolean') {
          targetState = e.detail.play;
        } else if (typeof e?.detail?.state === 'boolean') {
          targetState = e.detail.state;
        }

      if (!isLocalAudioLoadedRef.current) {
        if (!playerRef.current || typeof playerRef.current.getPlayerState !== 'function') {
          pendingPlayStateRef.current = targetState ?? !isVideoPlaying;
          if (targetState !== undefined) {
            userWantsPlaybackRef.current = targetState;
            setIsVideoPlaying(targetState);
            onExternalPlayStateChange?.(targetState);
          }
        }
      }

      let handled = false;

      if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
        try {
          const state = playerRef.current.getPlayerState();
          const isCurrentlyPlaying = state === window.YT?.PlayerState?.PLAYING;
          const willPlay = targetState !== undefined ? targetState : !isCurrentlyPlaying;
          userWantsPlaybackRef.current = willPlay;

          if (willPlay === isCurrentlyPlaying) {
            // Even if already playing, if it was playing muted, unmute now!
            if (willPlay && !isLocalAudioLoadedRef.current && (isMutedRef.current || playerRef.current?.isMuted?.())) {
              try {
                playerRef.current.unMute?.();
                playerRef.current.setVolume?.(100);
                setIsMuted(false);
              } catch {}
            }
            handled = true;
            return;
          }

          if (willPlay) {
            if (isLocalAudioLoadedRef.current) {
              playerRef.current.mute?.();
              setIsMuted(true);
            } else {
              try {
                playerRef.current.unMute?.();
                playerRef.current.setVolume?.(100);
                setIsMuted(false);
              } catch {
                // ignore
              }
            }
            try {
              playerRef.current.playVideo?.();
            } catch {
              try {
                playerRef.current.mute?.();
                setIsMuted(true);
                playerRef.current.playVideo?.();
              } catch {}
            }
            setTimeout(() => {
              if (userWantsPlaybackRef.current && playerRef.current) {
                try {
                  const st = playerRef.current.getPlayerState?.();
                  if (st !== window.YT?.PlayerState?.PLAYING && st !== window.YT?.PlayerState?.BUFFERING) {
                    playerRef.current.mute?.();
                    setIsMuted(true);
                    playerRef.current.playVideo?.();
                  }
                } catch {}
              }
            }, 300);
            setIsVideoPlaying(true);
            if (!isLocalAudioLoadedRef.current) {
              onExternalPlayStateChange?.(true);
            }
          } else {
            playerRef.current.pauseVideo?.();
            setIsVideoPlaying(false);
            if (!isLocalAudioLoadedRef.current) {
              onExternalPlayStateChange?.(false);
            }
          }
          handled = true;
        } catch (err) {
          // fallback to postMessage
        }
      }

      if (!handled) {
        if (targetState === false) {
          userWantsPlaybackRef.current = false;
          postIframeCommand('pauseVideo');
          setIsVideoPlaying(false);
          onExternalPlayStateChange?.(false);
        } else if (targetState === true) {
          userWantsPlaybackRef.current = true;
          postIframeCommand('playVideo');
          setIsVideoPlaying(true);
          onExternalPlayStateChange?.(true);
        } else {
          // Toggle
          if (isVideoPlaying) {
            userWantsPlaybackRef.current = false;
            postIframeCommand('pauseVideo');
            setIsVideoPlaying(false);
            onExternalPlayStateChange?.(false);
          } else {
            userWantsPlaybackRef.current = true;
            postIframeCommand('playVideo');
            setIsVideoPlaying(true);
            onExternalPlayStateChange?.(true);
          }
        }
      }
      }, 0);
    };

    const handleSeek = (e: any) => {
      const seconds = e.detail?.seconds || 0;
      let handled = false;
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const cur = playerRef.current.getCurrentTime() || 0;
          const target = Math.max(0, cur + seconds);
          if (Math.abs(cur - target) > 0.08) {
            playerRef.current.seekTo?.(target, true);
          }
          anchorYtTime.current = target;
          anchorPerfTime.current = performance.now();
          lastPolledYtTime.current = -1;
          isYtStalled.current = false;
          onExternalTimeUpdate?.(target);
          handled = true;
        } catch (err) {
          // fallback
        }
      }
      if (!handled) {
        postIframeCommand('seekTo', [seconds, true]);
        anchorYtTime.current += seconds;
        anchorPerfTime.current = performance.now();
        onExternalTimeUpdate?.(anchorYtTime.current);
      }
    };

    const handleAbsoluteSeek = (e: any) => {
      const target = Math.max(0, e.detail?.time ?? 0);
      if (!playerRef.current || typeof playerRef.current.seekTo !== 'function') {
        pendingSeekTimeRef.current = target;
        anchorYtTime.current = target;
        anchorPerfTime.current = performance.now();
        onExternalTimeUpdate?.(target);
        return;
      }

      let handled = false;
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        try {
          const cur = playerRef.current.getCurrentTime?.() || 0;
          if (Math.abs(cur - target) > 0.08) {
            playerRef.current.seekTo?.(target, true);
          }
          anchorYtTime.current = target;
          anchorPerfTime.current = performance.now();
          lastPolledYtTime.current = -1;
          isYtStalled.current = false;
          onExternalTimeUpdate?.(target);
          handled = true;
        } catch (err) {
          // fallback
        }
      }
      if (!handled) {
        postIframeCommand('seekTo', [target, true]);
        anchorYtTime.current = target;
        anchorPerfTime.current = performance.now();
        onExternalTimeUpdate?.(target);
      }
    };

    const handleUnmuteEvent = () => {
      if (playerRef.current) {
        try {
          playerRef.current.unMute?.();
          playerRef.current.setVolume?.(100);
          setIsMuted(false);
        } catch {}
      }
    };

    const handleMuteEvent = () => {
      if (playerRef.current) {
        try {
          playerRef.current.mute?.();
          setIsMuted(true);
        } catch {}
      }
    };

    const handleToggleMuteEvent = () => {
      if (playerRef.current) {
        try {
          const currentlyMuted = isMutedRef.current || Boolean(playerRef.current.isMuted?.());
          if (currentlyMuted) {
            playerRef.current.unMute?.();
            playerRef.current.setVolume?.(100);
            setIsMuted(false);
          } else {
            playerRef.current.mute?.();
            setIsMuted(true);
          }
        } catch {}
      }
    };

    window.addEventListener('openlyryc:toggle-play', handleToggle);
    window.addEventListener('openlyryc:seek-relative', handleSeek);
    window.addEventListener('openlyryc:seek-to', handleAbsoluteSeek);
    window.addEventListener('openlyryc:unmute', handleUnmuteEvent);
    window.addEventListener('openlyryc:mute', handleMuteEvent);
    window.addEventListener('openlyryc:toggle-mute', handleToggleMuteEvent);

    const handlePostMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data) return;

        if (data.info && typeof data.info.duration === 'number' && data.info.duration > 0) {
          onDurationDetected?.(data.info.duration);
        }

        if (data.info && typeof data.info.playerState === 'number') {
          const st = data.info.playerState;
          if (st === 1) {
            setIsVideoPlaying(true);
            onExternalPlayStateChange?.(true);
          } else if (st === 2 || st === 0) {
            setIsVideoPlaying(false);
            onExternalPlayStateChange?.(false);
          }
        }

        if (data.info && typeof data.info.currentTime === 'number') {
          const t = data.info.currentTime;
          anchorYtTime.current = t;
          anchorPerfTime.current = performance.now();
          onExternalTimeUpdate?.(t);
        }
      } catch (e) {
        // ignore
      }
    };
    window.addEventListener('message', handlePostMessage);

    return () => {
      window.removeEventListener('openlyryc:toggle-play', handleToggle);
      window.removeEventListener('openlyryc:seek-relative', handleSeek);
      window.removeEventListener('openlyryc:seek-to', handleAbsoluteSeek);
      window.removeEventListener('openlyryc:unmute', handleUnmuteEvent);
      window.removeEventListener('openlyryc:mute', handleMuteEvent);
      window.removeEventListener('openlyryc:toggle-mute', handleToggleMuteEvent);
      window.removeEventListener('message', handlePostMessage);
    };
  }, [onDurationDetected, onExternalPlayStateChange, onExternalTimeUpdate]);

  // Initialize Position for PiP Mode
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const computeDefaultOrSaved = () => {
      const curW = isExpandedSize ? 420 : 320;
      const curH = isExpandedSize ? 268 : 212;
      const minX = 8;
      const maxX = Math.max(minX, window.innerWidth - curW - 8);
      const minY = 56;
      const maxY = Math.max(minY, window.innerHeight - curH - 8);

      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            setPosition({
              x: Math.max(minX, Math.min(maxX, parsed.x)),
              y: Math.max(minY, Math.min(maxY, parsed.y)),
            });
            return;
          }
        }
      } catch (e) {
        // ignore
      }

      setPosition({
        x: Math.max(minX, window.innerWidth - curW - 20),
        y: Math.max(minY, window.innerHeight - curH - 20),
      });
    };

    computeDefaultOrSaved();

    const handleWindowResize = () => {
      setPosition((prev) => {
        if (!prev) return prev;
        const curW = isExpandedSize ? 420 : 320;
        const curH = isExpandedSize ? 268 : 212;
        const minX = 8;
        const maxX = Math.max(minX, window.innerWidth - curW - 8);
        const minY = 56;
        const maxY = Math.max(minY, window.innerHeight - curH - 8);
        return {
          x: Math.max(minX, Math.min(maxX, prev.x)),
          y: Math.max(minY, Math.min(maxY, prev.y)),
        };
      });
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [isExpandedSize]);

  // Drag & Snap Engine for PiP Window
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!embedBoxRef.current || videoDisplayMode === 'backdrop') return;
    if ('button' in e && e.button !== 0) return;

    e.preventDefault();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const rect = embedBoxRef.current.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;

    setIsDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curClientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curClientY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const rawX = curClientX - offsetX;
      const rawY = curClientY - offsetY;

      const curWidth = embedBoxRef.current?.offsetWidth || 320;
      const curHeight = embedBoxRef.current?.offsetHeight || 212;

      const minX = 4;
      const maxX = Math.max(minX, window.innerWidth - curWidth - 4);
      const minY = 48;
      const maxY = Math.max(minY, window.innerHeight - curHeight - 4);

      setPosition({
        x: Math.max(minX, Math.min(maxX, rawX)),
        y: Math.max(minY, Math.min(maxY, rawY)),
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);

      setIsDragging(false);

      if (embedBoxRef.current) {
        const curWidth = embedBoxRef.current.offsetWidth;
        const curHeight = embedBoxRef.current.offsetHeight;
        const minX = 8;
        const maxX = Math.max(minX, window.innerWidth - curWidth - 8);
        const minY = 56;
        const maxY = Math.max(minY, window.innerHeight - curHeight - 8);

        setPosition((prev) => {
          if (!prev) return prev;
          let finalX = prev.x;
          let finalY = prev.y;

          if (Math.abs(finalX - minX) < SNAP_THRESHOLD) {
            finalX = minX;
          } else if (Math.abs(finalX - maxX) < SNAP_THRESHOLD) {
            finalX = maxX;
          }

          if (Math.abs(finalY - minY) < SNAP_THRESHOLD) {
            finalY = minY;
          } else if (Math.abs(finalY - maxY) < SNAP_THRESHOLD) {
            finalY = maxY;
          }

          const finalPos = {
            x: Math.max(minX, Math.min(maxX, finalX)),
            y: Math.max(minY, Math.min(maxY, finalY)),
          };

          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(finalPos));
          } catch (err) {
            // ignore
          }

          return finalPos;
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    try {
      const currentlyMuted = isMutedRef.current || Boolean(playerRef.current.isMuted?.());
      if (currentlyMuted) {
        playerRef.current.unMute();
        playerRef.current.setVolume?.(100);
        setIsMuted(false);
      } else {
        playerRef.current.mute();
        setIsMuted(true);
      }
    } catch (e) {
      // ignore
    }
  };

  if (!isOpen || !cleanVideoId) {
    return null;
  }

  const isBackdrop = videoDisplayMode === 'backdrop' && !disableBackdropMode;

  // Compute position styles:
  // Backdrop: absolute inside the lyrics container (z-0)
  // PiP: fixed in viewport corner (z-45)
  // Classic NLE: docked over program monitor viewport (z-25)
  const getContainerStyle = (): React.CSSProperties => {
    if (isBackdrop) {
      return {
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
      };
    }

    if (isTimelineMode) {
      const isVisible = nleMonitorMode === 'video';
      let rect = timelineViewportRect;
      if (!rect && typeof document !== 'undefined') {
        const el = document.getElementById('nle-program-monitor-viewport');
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            rect = { left: r.left, top: r.top, width: r.width, height: r.height };
          }
        }
      }

      if (rect && rect.width > 0 && rect.height > 0) {
        return {
          position: 'fixed',
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          zIndex: 30,
          borderRadius: '0.75rem',
          overflow: 'hidden',
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? 'auto' : 'none',
          transition: 'opacity 0.15s ease',
        };
      }
      return {
        position: 'fixed',
        left: '-9999px',
        top: '-9999px',
        width: '320px',
        height: '180px',
        opacity: 0,
        pointerEvents: 'none',
        zIndex: 0,
      };
    }

    if (isMinimized) {
      return {
        position: 'fixed',
        left: '-9999px',
        top: '-9999px',
        width: '280px',
        height: '158px',
        opacity: 0,
        pointerEvents: 'none',
        zIndex: 0,
      };
    }

    if (position) {
      return {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 45,
        transition: isDragging ? 'none' : 'width 0.2s ease, height 0.2s ease',
      };
    }

    return {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: 45,
    };
  };

  return (
    <>
      {/* ── Single Persistent Video Wrapper (Never Unmounted) ──────────────── */}
      <div
        ref={embedBoxRef}
        data-tutorial="youtube-player"
        style={getContainerStyle()}
        className={
          isBackdrop
            ? 'w-full h-full select-none'
            : isTimelineMode
            ? 'w-full h-full select-none border-0 rounded-xl overflow-hidden'
            : isMinimized
            ? 'opacity-0 pointer-events-none'
            : `flex flex-col bg-[#0f0f12]/95 backdrop-blur-2xl border border-white/[0.12] rounded-xl shadow-2xl overflow-hidden select-none group/embed ${
                isExpandedSize ? 'w-64 sm:w-80 md:w-[440px]' : 'w-48 sm:w-72 md:w-80'
              } ${isDragging ? 'shadow-2xl shadow-black/90 ring-1 ring-white/30 scale-[1.008] opacity-98 cursor-grabbing' : ''}`
        }
      >
        {/* Header Bar (Visible ONLY in PiP Mode) */}
        {!isBackdrop && !isMinimized && !isTimelineMode && (
          <div
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            className={`h-8 px-2.5 bg-white/[0.03] border-b border-white/[0.08] flex items-center justify-between shrink-0 select-none ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            title="Drag anywhere to reposition"
          >
            {/* Left: Drag Handle & Clean Title */}
            <div className="flex items-center gap-1.5 text-zinc-400">
              <span className="material-symbols-outlined text-[13px] text-zinc-500 group-hover/embed:text-zinc-300 transition-colors">
                drag_indicator
              </span>
              <span className="text-[11px] font-semibold text-zinc-300 font-sans tracking-tight">
                YouTube
              </span>
            </div>

            {/* Right: Action Buttons */}
            <div
              className="flex items-center gap-0.5"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >

              {/* Switch to Backdrop / Canvas Mode (hidden when backdrop is disabled) */}
              {!disableBackdropMode && !hideBackdropControls && (
                <button
                  type="button"
                  onClick={() => onToggleDisplayMode?.('backdrop')}
                  title="Switch to Lyrics Stage Backdrop Mode"
                  className="p-1 rounded text-zinc-400 hover:text-cyan-300 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    wallpaper
                  </span>
                </button>
              )}

              {/* Mute/Unmute */}
              <button
                type="button"
                onClick={toggleMute}
                title={isMuted ? 'Unmute Video Audio' : 'Mute Video Audio'}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {isMuted ? 'volume_off' : 'volume_up'}
                </span>
              </button>

              {/* Toggle Size */}
              <button
                type="button"
                onClick={() => setIsExpandedSize((prev) => !prev)}
                title={isExpandedSize ? 'Normal View' : 'Expand View'}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {isExpandedSize ? 'close_fullscreen' : 'open_in_full'}
                </span>
              </button>

              {/* Minimize */}
              {!hideBackdropControls && (
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  title="Minimize"
                  className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    minimize
                  </span>
                </button>
              )}

              {/* Close */}
              {!hideBackdropControls && (
                <button
                  type="button"
                  onClick={onClose}
                  title="Close"
                  className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    close
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Video Canvas Container (Full cover zoom in backdrop mode) */}
        <div
          className={
            isBackdrop
              ? 'absolute inset-0 flex items-center justify-center overflow-hidden transition-opacity duration-300 ease-out pointer-events-none yt-backdrop-cover'
              : isTimelineMode
              ? 'w-full h-full relative bg-black flex items-center justify-center overflow-hidden'
              : `relative w-full bg-black ${isDragging ? 'pointer-events-none' : ''}`
          }
          style={
            isBackdrop
              ? {
                  opacity: Math.max(0.05, Math.min(0.95, backdropOpacity)),
                }
              : isTimelineMode
              ? {
                  width: '100%',
                  height: '100%',
                }
              : {
                  // Explicit aspect-ratio height so YT.Player iframe gets real dimensions.
                  // aspect-video CSS class alone gives 0px height inside a flex column
                  // because the column height is driven by content, not the viewport.
                  aspectRatio: '16 / 9',
                  minHeight: '120px',
                }
          }
        >
          {cleanVideoId ? (
            <div className={isBackdrop ? "w-full h-full relative overflow-hidden flex items-center justify-center yt-backdrop-cover" : isTimelineMode ? "w-full h-full relative flex items-center justify-center [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0 [&>iframe]:block" : "w-full h-full relative"}>
              <div
                id={containerId}
                style={!isBackdrop ? { width: '100%', height: '100%', minHeight: isTimelineMode ? '100%' : '120px' } : undefined}
                className={
                  isBackdrop
                    ? 'yt-backdrop-cover border-0'
                    : isTimelineMode
                    ? 'w-full h-full border-0 rounded-xl [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0 [&>iframe]:block'
                    : 'w-full h-full border-0 rounded-b-xl [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0 [&>iframe]:block [&>iframe]:rounded-b-xl'
                }
              />
              {!isBackdrop && embedError && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 text-center bg-[#101016] text-zinc-300 gap-2 select-none">
                  <span className="material-symbols-outlined text-amber-400 text-2xl">warning</span>
                  <p className="text-xs font-bold text-white tracking-tight">{embedError}</p>
                  <p className="text-[11px] text-zinc-400">Virtual audio clock sync is active.</p>
                  <a
                    href={`https://www.youtube.com/watch?v=${cleanVideoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                    <span>Watch on YouTube</span>
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">
              No YouTube video linked
            </div>
          )}
        </div>

        {/* Backdrop Mode Subtle Vignette Contrast Shield */}
        {isBackdrop && (
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090b]/85 via-transparent to-[#09090b]/60 pointer-events-none" />
        )}
      </div>

      {/* ── Backdrop Mode Quick Controller Pill ────────────────────────────── */}
      {isBackdrop && !hideBackdropControls && !isTimelineMode && (
        <div className="absolute bottom-3 right-3 z-30 pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-full bg-[#0f0f12]/90 hover:bg-[#141418] border border-white/[0.12] shadow-2xl backdrop-blur-xl transition-all select-none">
          <button
            type="button"
            onClick={() => onToggleDisplayMode?.('pip')}
            title="Switch to Floating Window (PiP)"
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[13px] text-cyan-400">
              picture_in_picture_alt
            </span>
            <span>Floating PiP</span>
          </button>

          <button
            type="button"
            onClick={toggleMute}
            title={isMuted ? 'Unmute Video Audio' : 'Mute Video Audio'}
            className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">
              {isMuted ? 'volume_off' : 'volume_up'}
            </span>
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Hide Video"
            className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">
              close
            </span>
          </button>
        </div>
      )}

      {/* ── Backdrop Error Notice Pill ──────────────────────────────────────── */}
      {isBackdrop && !hideBackdropControls && embedError && (
        <div className="absolute bottom-16 right-4 z-30 pointer-events-auto max-w-sm px-3 py-2 rounded-xl bg-[#14141a]/95 border border-amber-500/30 text-amber-200 text-xs shadow-2xl flex items-center gap-2 select-none animate-in fade-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-sm text-amber-400">warning</span>
          <span className="text-[11px] leading-tight flex-1 font-sans">{embedError} — Virtual sync active</span>
          {cleanVideoId && (
            <a
              href={`https://www.youtube.com/watch?v=${cleanVideoId}`}
              target="_blank"
              rel="noreferrer"
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] whitespace-nowrap cursor-pointer"
            >
              YouTube ↗
            </a>
          )}
        </div>
      )}

      {/* ── Minimized Pill (PiP Mode Only) ─────────────────────────────────── */}
      {!isBackdrop && !isTimelineMode && isMinimized && (
        <div
          style={
            position
              ? {
                  position: 'fixed',
                  left: `${Math.min(typeof window !== 'undefined' ? window.innerWidth - 130 : 500, Math.max(16, position.x))}px`,
                  top: `${Math.min(typeof window !== 'undefined' ? window.innerHeight - 44 : 500, Math.max(56, position.y))}px`,
                  zIndex: 45,
                }
              : { position: 'fixed', bottom: '16px', right: '16px', zIndex: 45 }
          }
          className="animate-in fade-in zoom-in-95 duration-200 select-none"
        >
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            title="Restore Video Reference"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0f0f12]/90 hover:bg-white text-zinc-300 hover:text-zinc-950 border border-white/[0.12] hover:border-white shadow-xl backdrop-blur-xl transition-all cursor-pointer group active:scale-95 text-xs font-medium font-sans"
          >
            <span className="material-symbols-outlined text-xs text-[#FF0000]">
              smart_display
            </span>
            <span>YouTube</span>
            <span className="material-symbols-outlined text-xs text-zinc-500 group-hover:text-zinc-700">
              open_in_full
            </span>
          </button>
        </div>
      )}
    </>
  );
});

YouTubeCornerEmbed.displayName = 'YouTubeCornerEmbed';
export default YouTubeCornerEmbed;
