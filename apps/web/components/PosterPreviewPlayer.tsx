'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { OpenLyricsDocument, LyricLine, SongSearchResult } from '@/types/lyrics';
import { KineticPosterRenderer, TransitionMode } from './KineticPosterRenderer';
import { YouTubeCornerEmbed } from './YouTubeCornerEmbed';
import { MobileOrientationGuard } from './MobileOrientationGuard';
import { searchLrclib, fetchLrclibDocument, parseLrcStringToLines } from '@/lib/lrclibService';
import { searchAllOnlineLyrics } from '@/lib/onlineLyricsService';
import { resolveLyricsWithAutoRetry, RetryProgress, ResolveTrackQuery } from '@/lib/lyricsResolver';
import { detectBestYouTubeMatch, searchYouTubeMatches, DetectedYouTubeMatch } from '@/lib/youtubeAutoDetector';
import { parseYouTubeMusicId } from '@/lib/platformLinker';
import { resolvePreviewDocument } from '@/lib/previewLink';
import { fetchArtworkUrl } from '@/lib/artworkFetcher';
import { ensureStageFontLoaded } from '@/lib/stageFonts';
import { MountainPeakRenderer } from './MountainPeakRenderer';

interface PosterPreviewPlayerProps {
  initialQuery?: string;
  initialYoutubeId?: string;
  initialTrackId?: string;
  initialShortcode?: string;
  initialTransitionMode?: TransitionMode;
  isEmbed?: boolean;
  enableBackgroundVideo?: boolean;
  stageFontFamily?: string;
  stageFontWeight?: string;
  textXPercent?: number;
  textYPercent?: number;
  fontSizeMultiplier?: number;
  disableAudio?: boolean;
  parallaxEnabled?: boolean;
  shootingStarsEnabled?: boolean;
}

const POPULAR_RECOMMENDATIONS = [
  { title: 'Sapphire', artist: 'Ed Sheeran', query: 'Ed Sheeran Sapphire' },
  { title: 'Midnight City', artist: 'M83', query: 'M83 Midnight City' },
  { title: 'Blinding Lights', artist: 'The Weeknd', query: 'The Weeknd Blinding Lights' },
  { title: 'Yellow', artist: 'Coldplay', query: 'Coldplay Yellow' },
  { title: 'Shape of You', artist: 'Ed Sheeran', query: 'Ed Sheeran Shape of You' },
  { title: 'As It Was', artist: 'Harry Styles', query: 'Harry Styles As It Was' },
];

function formatTime(seconds?: number): string {
  if (seconds === undefined || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const PosterPreviewPlayer: React.FC<PosterPreviewPlayerProps> = ({
  initialQuery,
  initialYoutubeId,
  initialTrackId,
  initialShortcode,
  initialTransitionMode = 'pivot',
  isEmbed = false,
  enableBackgroundVideo = false,
  stageFontFamily = 'poppins',
  stageFontWeight = '500',
  textXPercent = 0,
  textYPercent = 16,
  fontSizeMultiplier = 1.0,
  disableAudio = false,
  parallaxEnabled = true,
  shootingStarsEnabled = true,
}) => {
  useEffect(() => {
    ensureStageFontLoaded(stageFontFamily);
  }, [stageFontFamily]);

  // ── Transition Mode State (Option 1: Pivot, Option 2: Cube, Option 3: Whip) ──
  const [transitionMode, setTransitionMode] = useState<TransitionMode>(initialTransitionMode);
  // ── Cinematic Centered Ken Burns Slow Zoom State ──
  const [kenBurns, setKenBurns] = useState<boolean>(true);
  // ── Video Backdrop State: OFF by default unless explicitly requested via param/header ──
  const [showVideoBg, setShowVideoBg] = useState<boolean>(enableBackgroundVideo);

  // ── Document & Playback States ──────────────────────────────────────────
  const [doc, setDoc] = useState<OpenLyricsDocument | null>(null);
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoadingSong, setIsLoadingSong] = useState<boolean>(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryInfo, setRetryInfo] = useState<RetryProgress | null>(null);
  const activeLoadAbortControllerRef = useRef<AbortController | null>(null);
  const lastTrackQueryRef = useRef<ResolveTrackQuery | null>(null);
  const currentLoadIdRef = useRef<number>(0);
  const hasMountedRef = useRef<boolean>(false);
  const lastResolvedParamRef = useRef<string>('');
  const showVideoBgRef = useRef<boolean>(showVideoBg);
  showVideoBgRef.current = showVideoBg;

  // ── Audio Engine & Mute Control States ──────────────────────────────────
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const ytCandidatesRef = useRef<DetectedYouTubeMatch[]>([]);

  const isAudioDisabled = useMemo(() => {
    if (disableAudio) return true;
    if (typeof window === 'undefined') return false;
    const sp = new URLSearchParams(window.location.search);
    return sp.get('audio') === 'false' || sp.get('sound') === 'false' || sp.get('mute') === 'true';
  }, [disableAudio]);

  useEffect(() => {
    const handleMuteChange = (e: any) => {
      if (typeof e.detail?.isMuted === 'boolean') {
        setIsAudioMuted(e.detail.isMuted);
      }
    };
    window.addEventListener('openlyryc:mute-state', handleMuteChange);
    return () => window.removeEventListener('openlyryc:mute-state', handleMuteChange);
  }, []);

  // ── Search & UI Overlay States ──────────────────────────────────────────
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SongSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const isYouTubeUrl = useMemo(
    () => Boolean(parseYouTubeMusicId(searchQuery.trim())),
    [searchQuery]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Master Playback State & Clock Refs (100% Source-Agnostic Engine)
  const isPlayingRef = useRef<boolean>(false);
  isPlayingRef.current = isPlaying;
  const currentTimeRef = useRef<number>(0);
  currentTimeRef.current = currentTime;
  const durationRef = useRef<number>(0);
  durationRef.current = duration;

  // High-Precision Virtual Master Clock Anchors
  const baseTimeRef = useRef<number>(0);
  const baseWallTimeRef = useRef<number>(typeof performance !== 'undefined' ? performance.now() : 0);
  const lastExternalSyncRef = useRef<number>(0);

  // ── 1. Auto-hide Minimalist Controls during Playback ─────────────────────
  const resetIdleTimer = useCallback(() => {
    setShowControls(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (isPlaying && !isSearchOpen) {
      idleTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2600);
    }
  }, [isPlaying, isSearchOpen]);

  useEffect(() => {
    const handleActivity = () => resetIdleTimer();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('keydown', handleActivity);

    resetIdleTimer();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  // ── 2. Master Clock Sync, Play, Pause & Seek Dispatchers ─────────────────
  const syncTime = useCallback((time: number) => {
    if (typeof time !== 'number' || isNaN(time)) return;
    const clamped = Math.max(0, time);
    const now = performance.now();
    const currentInterp =
      baseTimeRef.current + (isPlayingRef.current ? (now - baseWallTimeRef.current) / 1000 : 0);
    const delta = clamped - currentInterp;

    // If deviation is significant (> 350ms seek/jump) or paused, snap immediately
    if (Math.abs(delta) > 0.35 || !isPlayingRef.current) {
      baseTimeRef.current = clamped;
      baseWallTimeRef.current = now;
      setCurrentTime(clamped);
      currentTimeRef.current = clamped;
    } else if (Math.abs(delta) > 0.05) {
      // Smooth PLL alignment: gently correct anchor drift without snapping or jumping
      baseTimeRef.current += delta * 0.1;
    }

    // If external host is sending advancing timestamps, ensure player state is playing
    if (!isPlayingRef.current && clamped > currentTimeRef.current && clamped > 0) {
      setIsPlaying(true);
      isPlayingRef.current = true;
    }

    lastExternalSyncRef.current = now;
  }, []);

  const setPlayState = useCallback(
    (nextPlaying: boolean, source?: string) => {
      if (isPlayingRef.current === nextPlaying) return;
      setIsPlaying(nextPlaying);
      isPlayingRef.current = nextPlaying;
      if (nextPlaying) {
        baseTimeRef.current = currentTimeRef.current;
        baseWallTimeRef.current = performance.now();
      }
      if (source !== 'youtube') {
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('openlyryc:toggle-play', { detail: { isPlaying: nextPlaying } })
            );
          }
        }, 0);
      }
      resetIdleTimer();
    },
    [resetIdleTimer]
  );

  const handleTogglePlay = useCallback(() => {
    setPlayState(!isPlayingRef.current);
  }, [setPlayState]);

  const handleStageClick = useCallback(() => {
    if (isAudioMuted) {
      window.dispatchEvent(new CustomEvent('openlyryc:unmute'));
      setIsAudioMuted(false);
    }
    if (!isEmbed) {
      handleTogglePlay();
    }
  }, [isAudioMuted, isEmbed, handleTogglePlay]);

  const handleYouTubeError = useCallback(
    (errorMsg: string, errorCode: number) => {
      console.warn(`YouTube player error ${errorCode}: ${errorMsg}`);
      if (errorCode === 150 || errorCode === 101 || errorCode === 100) {
        const candidates = ytCandidatesRef.current;
        const curId = youtubeVideoId;
        const next = candidates.find((c) => c.videoId && c.videoId !== curId);
        if (next) {
          console.log(`Auto-failing over to alternative YouTube candidate: "${next.title}" (${next.videoId})`);
          setYoutubeVideoId(next.videoId);
        }
      }
    },
    [youtubeVideoId]
  );

  const handleSeek = useCallback(
    (time: number) => {
      const maxDur = durationRef.current > 0 ? durationRef.current : 9999;
      const target = Math.max(0, Math.min(maxDur, time));
      syncTime(target);
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('openlyryc:seek-to', { detail: { time: target } })
          );
          try {
            window.parent?.postMessage({ type: 'openlyryc:seek', time: target }, '*');
            (window as any).OpenLyrycAndroid?.onSeek?.(target);
            (window as any).AndroidBridge?.onSeek?.(target);
          } catch {
            // ignore
          }
        }
      }, 0);
      resetIdleTimer();
    },
    [syncTime, resetIdleTimer]
  );

  const handleRelativeSeek = useCallback(
    (seconds: number) => {
      handleSeek(currentTimeRef.current + seconds);
    },
    [handleSeek]
  );

  // ── 3. High-Precision Source-Agnostic Animation Frame Clock (Zero-Lag) ───
  useEffect(() => {
    let animId: number;
    const tick = () => {
      const now = performance.now();

      if (isPlayingRef.current) {
        const elapsed = (now - baseWallTimeRef.current) / 1000;
        const target = baseTimeRef.current + elapsed;
        const maxDur = durationRef.current > 0 ? durationRef.current : 99999;
        const clamped = Math.min(target, maxDur);

        setCurrentTime(clamped);
        currentTimeRef.current = clamped;

        if (durationRef.current > 0 && clamped >= durationRef.current) {
          setIsPlaying(false);
          isPlayingRef.current = false;
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // ── Auto-Fetch HD Cover Art for Loaded Document ──
  useEffect(() => {
    if (!doc) return;
    if (doc.metadata.coverArt) return;
    const { artist, title } = doc.metadata;
    if (!artist && !title) return;

    let isMounted = true;
    fetchArtworkUrl(artist, title).then((artUrl) => {
      if (isMounted && artUrl) {
        setDoc((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            metadata: {
              ...prev.metadata,
              coverArt: artUrl,
            },
          };
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [doc?.metadata.title, doc?.metadata.artist, doc?.metadata.coverArt]);

  // ── 4. Load Song with Resilient Multi-Provider Resolver & Auto-Retry ──────
  const loadSong = useCallback(
    async (track: ResolveTrackQuery) => {
      lastTrackQueryRef.current = track;

      // Increment load counter to guard against race conditions from earlier requests
      const loadId = ++currentLoadIdRef.current;

      // Abort any prior in-flight search/load operation
      if (activeLoadAbortControllerRef.current) {
        activeLoadAbortControllerRef.current.abort();
      }
      activeLoadAbortControllerRef.current = new AbortController();
      const signal = activeLoadAbortControllerRef.current.signal;

      try {
        setIsLoadingSong(true);
        setErrorMessage(null);
        setIsSearchOpen(false);
        setRetryInfo(null);
        setLoadingStatus(`Resolving lyrics for "${track.title || track.query || 'track'}"…`);

        // Reset playhead clock state
        setCurrentTime(0);
        currentTimeRef.current = 0;
        baseTimeRef.current = 0;
        baseWallTimeRef.current = performance.now();

        // If explicit YouTube video was passed with query, set it immediately
        if (track.youtubeId) {
          setYoutubeVideoId(track.youtubeId);
        }

        const lyricDoc = await resolveLyricsWithAutoRetry(
          {
            id: track.id,
            title: track.title,
            artist: track.artist,
            duration: track.duration,
            query: track.query,
          },
          {
            signal,
            maxRetries: 4,
            onProgress: (p) => {
              if (currentLoadIdRef.current === loadId) {
                setRetryInfo(p);
                setLoadingStatus(p.status);
              }
            },
          }
        );

        if (currentLoadIdRef.current !== loadId) return;

        if (!lyricDoc || !lyricDoc.lines || lyricDoc.lines.length === 0) {
          throw new Error(`Synced lyrics could not be found for "${track.title || track.query}".`);
        }

        setDoc(lyricDoc);
        const dur =
          lyricDoc.metadata.duration ||
          (lyricDoc.lines.length > 0
            ? Math.ceil(lyricDoc.lines[lyricDoc.lines.length - 1].end + 3)
            : 0);
        setDuration(dur);
        durationRef.current = dur;

        // Reset clock playhead to 0
        baseTimeRef.current = 0;
        baseWallTimeRef.current = performance.now();
        setCurrentTime(0);
        currentTimeRef.current = 0;
        setIsPlaying(true);
        isPlayingRef.current = true;
        setRetryInfo(null);

        if (typeof window !== 'undefined') {
          try {
            window.parent?.postMessage(
              {
                type: 'openlyryc:loaded',
                title: lyricDoc.metadata.title,
                artist: lyricDoc.metadata.artist,
                duration: dur,
                lineCount: lyricDoc.lines.length,
              },
              '*'
            );
            (window as any).OpenLyrycAndroid?.onLyricsLoaded?.(
              lyricDoc.metadata.title,
              lyricDoc.metadata.artist,
              dur
            );
            (window as any).AndroidBridge?.onLyricsLoaded?.(
              lyricDoc.metadata.title,
              lyricDoc.metadata.artist,
              dur
            );
          } catch {
            // ignore
          }
        }

        // Always search and match YouTube audio stream unless audio is explicitly disabled
        if (!track.youtubeId && !isAudioDisabled) {
          try {
            if (currentLoadIdRef.current === loadId) {
              setLoadingStatus(`Matching YouTube audio/video for "${lyricDoc.metadata.title}"...`);
            }
            const ytResult = await searchYouTubeMatches(
              track.artist || lyricDoc.metadata.artist,
              track.title || lyricDoc.metadata.title,
              track.duration || dur
            );

            if (currentLoadIdRef.current === loadId) {
              if (ytResult && ytResult.candidates) {
                ytCandidatesRef.current = ytResult.candidates;
              }
              const bestMatch = ytResult?.bestMatch;
              if (bestMatch && bestMatch.videoId) {
                setYoutubeVideoId(bestMatch.videoId);
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href);
                  url.searchParams.set('q', `${lyricDoc.metadata.artist} - ${lyricDoc.metadata.title}`);
                  url.searchParams.set('yt', bestMatch.videoId);
                  lastResolvedParamRef.current = `${url.searchParams.get('q') || ''}|${bestMatch.videoId}|${track.id || ''}|`;
                  window.history.replaceState({}, '', url.toString());
                }
              }
            }
          } catch (ytErr) {
            console.warn('YouTube match skipped/failed:', ytErr);
          }
        }
      } catch (err: any) {
        if (currentLoadIdRef.current !== loadId) return;
        if (err?.name === 'AbortError') return;
        console.error('Failed to load song:', err);
        const msg = err?.message || 'Failed to load lyrics across all providers.';
        setErrorMessage(msg);
        setRetryInfo(null);
        if (typeof window !== 'undefined') {
          try {
            window.parent?.postMessage({ type: 'openlyryc:error', message: msg }, '*');
            (window as any).OpenLyrycAndroid?.onError?.(msg);
            (window as any).AndroidBridge?.onError?.(msg);
          } catch {}
        }
      } finally {
        if (currentLoadIdRef.current === loadId) {
          setIsLoadingSong(false);
          setLoadingStatus('');
        }
      }
    },
    [isAudioDisabled]
  );

  // ── 5. Raw LRC String Loader (100% Offline / Direct Support) ────────────
  const setLrc = useCallback(
    (lrcContent: string, title?: string, artist?: string) => {
      try {
        const parsedLines = parseLrcStringToLines(lrcContent);
        if (!parsedLines || parsedLines.length === 0) {
          throw new Error('No synced lyric lines found in LRC string.');
        }

        const calculatedDuration = Math.ceil(parsedLines[parsedLines.length - 1].end + 3);
        const lyricDoc: OpenLyricsDocument = {
          $schema: 'https://openlyrics.org/v1/schema.json',
          version: 1,
          metadata: {
            title: title || 'Synced Track',
            artist: artist || 'OpenLyryc',
            duration: calculatedDuration,
            syncedBy: 'LRC',
          },
          lines: parsedLines,
        };

        setDoc(lyricDoc);
        setDuration(calculatedDuration);
        durationRef.current = calculatedDuration;
        baseTimeRef.current = 0;
        baseWallTimeRef.current = performance.now();
        setCurrentTime(0);
        currentTimeRef.current = 0;
        setIsPlaying(true);
        isPlayingRef.current = true;
      } catch (e: any) {
        console.error('Failed to set LRC:', e);
        setErrorMessage(e?.message || 'Failed to parse LRC.');
      }
    },
    []
  );

  // ── 4. Load from YouTube URL or Video ID directly ────────────────────────
  const loadFromYouTubeInput = useCallback(
    async (ytInput: string) => {
      const cleanId = parseYouTubeMusicId(ytInput);
      if (!cleanId) {
        setErrorMessage('Invalid YouTube URL or Video ID.');
        return;
      }

      const loadId = ++currentLoadIdRef.current;

      // Abort prior in-flight searches
      if (activeLoadAbortControllerRef.current) {
        activeLoadAbortControllerRef.current.abort();
      }
      activeLoadAbortControllerRef.current = new AbortController();
      const signal = activeLoadAbortControllerRef.current.signal;

      try {
        setIsLoadingSong(true);
        setErrorMessage(null);
        setIsSearchOpen(false);
        setLoadingStatus('Resolving YouTube video metadata…');

        // Reset playhead clock state
        setCurrentTime(0);
        currentTimeRef.current = 0;
        baseTimeRef.current = 0;
        baseWallTimeRef.current = performance.now();

        // Connect the YouTube stream and enable background video
        setYoutubeVideoId(cleanId);
        setShowVideoBg(true);

        // Fetch oEmbed video details
        let videoTitle = '';
        let channelTitle = '';
        try {
          const res = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${cleanId}&format=json`
          );
          if (res.ok) {
            const data = await res.json();
            videoTitle = data.title || '';
            channelTitle = data.author_name || '';
          }
        } catch {
          // fallback
        }

        if (!videoTitle) {
          videoTitle = cleanId;
        }

        if (currentLoadIdRef.current !== loadId) return;

        setLoadingStatus(`Finding matching synced lyrics for "${videoTitle}"…`);

        // Clean video title to strip extraneous media tags
        const cleanedTitle = videoTitle
          .replace(/official/gi, '')
          .replace(/music/gi, '')
          .replace(/video/gi, '')
          .replace(/audio/gi, '')
          .replace(/lyric(s)?/gi, '')
          .replace(/[\(\)\[\]]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const channelWords = channelTitle.toLowerCase().trim();
        const titleLower = cleanedTitle.toLowerCase();
        const queryToSearch =
          channelWords && !titleLower.includes(channelWords)
            ? `${channelTitle} ${cleanedTitle}`.trim()
            : cleanedTitle;

        // Multi-provider cascade lookup across lrc.red, Binimum, Musixmatch, and LRCLIB
        let matchedDoc: OpenLyricsDocument | null = null;
        try {
          matchedDoc = await resolveLyricsWithAutoRetry(
            {
              query: queryToSearch,
              title: cleanedTitle,
              artist: channelTitle,
            },
            {
              signal,
              maxRetries: 3,
              onProgress: (p) => {
                if (currentLoadIdRef.current === loadId) {
                  setRetryInfo(p);
                  setLoadingStatus(p.status);
                }
              },
            }
          );
        } catch {
          // Lyrics not matched online across providers
        }

        if (currentLoadIdRef.current !== loadId) return;

        if (matchedDoc && matchedDoc.lines && matchedDoc.lines.length > 0) {
          matchedDoc.metadata.youtubeId = cleanId;
          setDoc(matchedDoc);
          const dur =
            matchedDoc.metadata.duration ||
            Math.ceil(matchedDoc.lines[matchedDoc.lines.length - 1].end + 3);
          setDuration(dur);
          durationRef.current = dur;
        } else {
          // Robust Fallback: Never wipe doc to null leaving an empty stage!
          // Provide an interactive display stage for the YouTube video.
          const fallbackDoc: OpenLyricsDocument = {
            $schema: 'https://openlyrics.org/v1/schema.json',
            version: 1,
            metadata: {
              title: videoTitle,
              artist: channelTitle || 'YouTube Stream',
              duration: 240,
              syncedBy: 'OpenLyryc Stream',
              youtubeId: cleanId,
            },
            lines: [
              {
                id: 0,
                text: `♪ ${videoTitle}`,
                start: 0,
                end: 9999,
              },
            ],
          };
          setDoc(fallbackDoc);
          setDuration(240);
          durationRef.current = 240;
        }

        // Update URL
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('yt', cleanId);
          if (videoTitle && videoTitle !== cleanId) {
            url.searchParams.set('q', `${channelTitle ? channelTitle + ' - ' : ''}${videoTitle}`);
          }
          lastResolvedParamRef.current = `${url.searchParams.get('q') || ''}|${cleanId}||`;
          window.history.replaceState({}, '', url.toString());
        }

        setIsPlaying(true);
        isPlayingRef.current = true;
      } catch (err: any) {
        if (currentLoadIdRef.current !== loadId) return;
        if (err?.name === 'AbortError') return;
        console.error('Failed to load from YouTube:', err);
        setErrorMessage(err?.message || 'Failed to load video.');
      } finally {
        if (currentLoadIdRef.current === loadId) {
          setIsLoadingSong(false);
          setLoadingStatus('');
          setRetryInfo(null);
        }
      }
    },
    []
  );

  // ── 5. Search Execution (Debounced) ──────────────────────────────────────
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Check if input is a YouTube URL
    if (parseYouTubeMusicId(trimmed)) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchAllOnlineLyrics(trimmed);
        setSearchResults(results);
      } catch (e) {
        console.warn('Search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── 6. Initial Mount Route Query Parameter Resolution ───────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const q = initialQuery || params.get('q') || params.get('query') || undefined;
    const yt = initialYoutubeId || params.get('yt') || params.get('v') || params.get('youtube') || undefined;
    const trackId = initialTrackId || params.get('id') || params.get('track') || undefined;
    const shortcode = initialShortcode || params.get('c') || params.get('code') || undefined;
    const hash = window.location.hash || '';

    const paramSignature = `${q || ''}|${yt || ''}|${trackId || ''}|${shortcode || ''}`;
    if (hasMountedRef.current && lastResolvedParamRef.current === paramSignature) {
      return;
    }
    hasMountedRef.current = true;
    lastResolvedParamRef.current = paramSignature;

    if (q) {
      loadSong({ query: q, title: q, youtubeId: yt });
    } else if (yt) {
      loadFromYouTubeInput(yt);
    } else if (trackId) {
      loadSong({ id: trackId, title: '', artist: '', youtubeId: yt });
    } else if (shortcode || hash.length > 5) {
      // Fallback for existing shortcodes or hash links
      (async () => {
        setIsLoadingSong(true);
        setLoadingStatus('Resolving shared preview…');
        const res = await resolvePreviewDocument(shortcode);
        if (res.document) {
          setDoc(res.document);
          if (res.document.metadata.duration) {
            setDuration(res.document.metadata.duration);
          }
          if (res.document.metadata.youtubeId) {
            setYoutubeVideoId(res.document.metadata.youtubeId);
          } else {
            const match = await detectBestYouTubeMatch(
              res.document.metadata.artist,
              res.document.metadata.title,
              res.document.metadata.duration
            );
            if (match) setYoutubeVideoId(match.videoId);
          }
          setIsPlaying(true);
        } else {
          setIsSearchOpen(true);
        }
        setIsLoadingSong(false);
      })();
    } else {
      // No parameters provided: show clean stage with single search pill
    }
  }, [initialQuery, initialYoutubeId, initialTrackId, initialShortcode, loadSong, loadFromYouTubeInput]);

  // ── 6b. IPC Bridge for Android Native, Tauri, Webviews & Iframe Embeds ──
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadTrackFlexible = (trackOrQuery: any) => {
      if (typeof trackOrQuery === 'string') {
        loadSong({ query: trackOrQuery, title: trackOrQuery, artist: '' });
      } else if (trackOrQuery && typeof trackOrQuery === 'object') {
        loadSong({
          id: trackOrQuery.id,
          title: trackOrQuery.title || trackOrQuery.name || trackOrQuery.track || '',
          artist: trackOrQuery.artist || '',
          album: trackOrQuery.album || '',
          duration: trackOrQuery.duration,
          query: trackOrQuery.query,
        });
      }
    };

    const bridgeApi = {
      syncTime,
      play: () => setPlayState(true),
      pause: () => setPlayState(false),
      seek: handleSeek,
      setMode: (mode: TransitionMode) => {
        if (mode === 'pivot' || mode === 'cube' || mode === 'whip' || mode === 'peak') {
          setTransitionMode(mode);
        }
      },
      loadTrack: loadTrackFlexible,
      setDocument: (document: OpenLyricsDocument) => {
        if (document && document.lines) {
          setDoc(document);
          const dur =
            document.metadata?.duration ||
            (document.lines.length > 0
              ? Math.ceil(document.lines[document.lines.length - 1].end + 3)
              : 0);
          setDuration(dur);
          durationRef.current = dur;
          baseTimeRef.current = 0;
          baseWallTimeRef.current = performance.now();
          setCurrentTime(0);
          currentTimeRef.current = 0;
          setPlayState(true);
        }
      },
      setLrc,
    };

    (window as any).openlyryc = bridgeApi;
    (window as any).OpenLyryc = bridgeApi;

    const sendReadyEvent = () => {
      try {
        window.parent?.postMessage(
          {
            type: 'openlyryc:ready',
            isReady: true,
            currentTime: currentTimeRef.current,
            isPlaying: isPlayingRef.current,
          },
          '*'
        );
        (window as any).OpenLyrycAndroid?.onReady?.();
        (window as any).AndroidBridge?.onReady?.();
      } catch {
        // ignore
      }
    };

    const handleWindowMessage = (event: MessageEvent) => {
      let data = event.data;
      if (!data) return;

      // Handle JSON-stringified payloads from WebViews / postMessage bridges
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          const num = parseFloat(data);
          if (!isNaN(num)) {
            syncTime(num);
          }
          return;
        }
      }

      // Handle raw number payload: e.g. postMessage(12.5, '*')
      if (typeof data === 'number' && !isNaN(data)) {
        syncTime(data);
        return;
      }

      if (typeof data !== 'object') return;

      // 1. Time / Position / Seek message
      const rawTime =
        data.time ??
        data.currentTime ??
        data.position ??
        data.seconds ??
        data.progress;
      if (rawTime !== undefined) {
        const t = typeof rawTime === 'number' ? rawTime : parseFloat(rawTime);
        if (!isNaN(t)) {
          syncTime(t);
        }
      }

      // 2. Play command
      if (
        data.type === 'openlyryc:play' ||
        data.type === 'play' ||
        data.action === 'play' ||
        data.command === 'play'
      ) {
        setPlayState(true);
      }

      // 3. Pause command
      if (
        data.type === 'openlyryc:pause' ||
        data.type === 'pause' ||
        data.action === 'pause' ||
        data.command === 'pause'
      ) {
        setPlayState(false);
      }

      // 4. PlayState boolean
      if (
        (data.type === 'openlyryc:playState' || data.type === 'playState') &&
        data.isPlaying !== undefined
      ) {
        setPlayState(Boolean(data.isPlaying));
      }

      // 5. Track load command
      if (
        data.type === 'openlyryc:track' ||
        data.type === 'track' ||
        data.action === 'loadTrack' ||
        data.action === 'load'
      ) {
        if (typeof data.track === 'string') {
          loadTrackFlexible(data.track);
        } else if (data.track && typeof data.track === 'object') {
          loadTrackFlexible(data.track);
        } else if (data.title) {
          loadTrackFlexible({ title: data.title, artist: data.artist || '' });
        } else if (data.query) {
          loadTrackFlexible(data.query);
        }
      }

      // 6. Direct OpenLyricsDocument
      if (
        (data.type === 'openlyryc:document' || data.type === 'document') &&
        (data.doc || data.document)
      ) {
        bridgeApi.setDocument(data.doc || data.document);
      }

      // 7. Raw LRC string
      if (
        (data.type === 'openlyryc:lrc' || data.type === 'lrc') &&
        (data.lrc || data.text)
      ) {
        setLrc(data.lrc || data.text, data.title, data.artist);
      }

      // 8. 3D Transition Mode
      if (
        (data.type === 'openlyryc:mode' || data.type === 'mode') &&
        data.mode
      ) {
        bridgeApi.setMode(data.mode);
      }

      // 9. Ping Handshake
      if (data.type === 'openlyryc:ping' || data.type === 'ping') {
        sendReadyEvent();
      }
    };

    window.addEventListener('message', handleWindowMessage);

    // Announce ready state to host
    sendReadyEvent();

    return () => {
      window.removeEventListener('message', handleWindowMessage);
    };
  }, [loadSong, setLrc, setPlayState, syncTime, handleSeek]);

  // ── 7. Global Keyboard Shortcuts ────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          setIsSearchOpen(false);
        }
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === '/' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          containerRef.current?.requestFullscreen?.();
          setIsFullscreen(true);
        } else {
          document.exitFullscreen?.();
          setIsFullscreen(false);
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleRelativeSeek(-5);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleRelativeSeek(5);
      } else if (e.key === '1') {
        setTransitionMode('pivot');
      } else if (e.key === '2') {
        setTransitionMode('cube');
      } else if (e.key === '3') {
        setTransitionMode('whip');
      } else if (e.key === '4') {
        setTransitionMode('peak');
      } else if (e.key === 'z' || e.key === 'Z') {
        setKenBurns((prev) => !prev);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('openlyryc:toggle-mute'));
      } else if (e.key === 'Escape') {
        if (isSearchOpen) {
          setIsSearchOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, handleRelativeSeek, isSearchOpen]);

  const lines: LyricLine[] = useMemo(() => doc?.lines || [], [doc?.lines]);

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 w-full h-[100dvh] overflow-hidden bg-black text-white font-sans select-none [container-type:size] ${
        !showControls && isPlaying ? 'cursor-none' : ''
      }`}
    >
      {/* ── 0. Smart Mobile Vertical Orientation Advisory Guard ───────────── */}
      {!isEmbed && <MobileOrientationGuard />}

      {/* ── 1. YouTube Audio & Video Engine ─────────────────────────────────── */}
      {youtubeVideoId && !isAudioDisabled && (
        <div
          className={`absolute inset-0 z-0 overflow-hidden pointer-events-none transition-opacity duration-700 ${
            showVideoBg ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <YouTubeCornerEmbed
            youtubeId={youtubeVideoId}
            isOpen={true}
            onClose={() => {}}
            wavesurfer={null}
            isLocalAudioLoaded={false}
            videoDisplayMode="backdrop"
            backdropOpacity={0.48}
            hideBackdropControls={true}
            onError={handleYouTubeError}
            onExternalTimeUpdate={(t) => syncTime(t)}
            onExternalPlayStateChange={(playing) => setPlayState(playing, 'youtube')}
            onDurationDetected={(d) => {
              if (d > 0) {
                setDuration((prev) => (prev > 0 ? prev : d));
                durationRef.current = Math.max(durationRef.current, d);
              }
            }}
            initialTime={currentTimeRef.current}
          />

          {/* High-Contrast Vignette & Film Grain Overlay */}
          <div className="absolute inset-0 bg-black/45 bg-gradient-to-t from-black/80 via-transparent to-black/60 pointer-events-none" />
        </div>
      )}

      {/* ── 1.5 Floating Unmute / Sound Enable Pill (Shown when browser autoplay forces mute) ── */}
      {isAudioMuted && isPlaying && (
        <div className="fixed bottom-14 sm:bottom-16 left-1/2 -translate-x-1/2 z-40 pointer-events-auto select-none animate-in fade-in slide-in-from-bottom-2 duration-200 font-sans">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent('openlyryc:unmute'));
              setIsAudioMuted(false);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 shadow-2xl font-semibold text-xs transition-all active:scale-95 cursor-pointer ring-4 ring-black/40 hover:ring-white/20"
          >
            <span className="material-symbols-outlined text-base animate-pulse">volume_up</span>
            <span>Click to enable sound</span>
          </button>
        </div>
      )}

      {/* Pure, high-performance ambient dark background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#0e0e14] via-[#070709] to-[#040406]" />

      {/* ── 2. Full-Screen Kinetic Poster Typography Stage ───────────────── */}
      <div
        onClick={handleStageClick}
        className="relative z-10 w-full h-full flex flex-col justify-center items-center cursor-pointer [container-type:size]"
      >
        {lines.length > 0 ? (
          transitionMode === 'peak' ? (
            <MountainPeakRenderer
              lines={lines}
              currentTime={currentTime}
              onSeek={handleSeek}
              trackTitle={doc?.metadata.title}
              artistName={doc?.metadata.artist}
              stageFontFamily={stageFontFamily}
              stageFontWeight={stageFontWeight}
              textXPercent={textXPercent}
              textYPercent={textYPercent}
              fontSizeMultiplier={fontSizeMultiplier}
              parallaxEnabled={parallaxEnabled}
              shootingStarsEnabled={shootingStarsEnabled}
            />
          ) : (
            <KineticPosterRenderer
              lines={lines}
              currentTime={currentTime}
              onSeek={handleSeek}
              transitionMode={transitionMode}
              kenBurns={kenBurns}
              trackTitle={doc?.metadata.title}
              artistName={doc?.metadata.artist}
              isPlaying={isPlaying}
              coverArt={doc?.metadata.coverArt}
              stageFontFamily={stageFontFamily}
              stageFontWeight={stageFontWeight}
            />
          )
        ) : isLoadingSong ? (
          <div className="flex flex-col items-center justify-center gap-4 p-6 text-center select-none text-zinc-400 animate-in fade-in duration-300 max-w-sm mx-auto">
            <div className="relative flex items-center justify-center">
              <span className="material-symbols-outlined text-5xl text-white/40 animate-pulse">
                music_note
              </span>
              <div className="absolute -inset-2 rounded-full border border-white/10 border-t-white/60 animate-spin" />
            </div>
            <div className="flex flex-col gap-1 items-center">
              <p className="text-xs font-medium text-zinc-300">
                {retryInfo?.status || loadingStatus || 'Searching lyrics across providers…'}
              </p>
              {retryInfo && (
                <span className="text-[10px] font-sans text-zinc-500">
                  Attempt {retryInfo.attempt} of {retryInfo.maxRetries} (lrc.red, lrclib, binimum, mxm)
                </span>
              )}
            </div>
          </div>
        ) : errorMessage ? (
          <div className="flex flex-col items-center justify-center gap-4 p-6 text-center select-none text-zinc-400 animate-in fade-in duration-300 max-w-sm mx-auto">
            <span className="material-symbols-outlined text-4xl text-zinc-600">
              music_off
            </span>
            <div className="flex flex-col gap-1 items-center">
              <p className="text-xs text-zinc-300 font-medium">Synced lyrics could not be found</p>
              <p className="text-[11px] text-zinc-500 max-w-xs">{errorMessage}</p>
            </div>
            {lastTrackQueryRef.current && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  loadSong(lastTrackQueryRef.current!);
                }}
                className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-zinc-200 hover:text-white font-medium transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                <span>Retry Search</span>
              </button>
            )}
          </div>
        ) : !isSearchOpen ? (
          youtubeVideoId ? (
            <div className="flex flex-col items-center justify-center gap-4 p-6 text-center select-none text-zinc-400 animate-in fade-in duration-300 max-w-sm mx-auto">
              <span className="material-symbols-outlined text-4xl text-white/50 animate-pulse">
                smart_display
              </span>
              <div className="flex flex-col gap-1 items-center">
                <p className="text-xs font-semibold text-white">Streaming Video & Audio</p>
                <p className="text-[11px] text-zinc-400">Media stream is active and playing</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSearchOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className="px-4 py-1.5 rounded-full bg-white text-zinc-950 font-medium text-xs hover:bg-zinc-200 transition-all cursor-pointer shadow-md active:scale-95 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">search</span>
                <span>Match Synced Lyrics</span>
              </button>
            </div>
          ) : isEmbed ? (
            <div className="flex flex-col items-center justify-center gap-3 p-6 text-center select-none text-zinc-500 animate-in fade-in duration-300">
              <span className="material-symbols-outlined text-4xl text-zinc-600 animate-pulse">
                music_note
              </span>
              <p className="text-xs font-sans tracking-wider text-zinc-500">Waiting for track…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-6 text-center p-6 max-w-sm w-full select-none">
              <span className="material-symbols-outlined text-5xl text-white/30">
                music_note
              </span>

              {/* The One Nice Way: Sleek Search Pill */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSearchOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className="w-full flex items-center justify-center gap-2.5 h-11 px-5 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 font-medium text-xs sm:text-sm tracking-tight transition-all cursor-pointer active:scale-[0.98] shadow-md hover:shadow-lg"
              >
                <span className="material-symbols-outlined text-base">search</span>
                <span>Search a song or artist…</span>
              </button>
            </div>
          )
        ) : null}
      </div>

      {/* ── 3. Subtle Play / Pause State Flash ────────────────────────────── */}
      {!isEmbed && showControls && !isPlaying && doc && !isSearchOpen && (
        <div
          onClick={handleTogglePlay}
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/25 pointer-events-auto cursor-pointer transition-opacity"
        >
          <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl hover:scale-105 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-4xl">play_arrow</span>
          </div>
        </div>
      )}

      {/* ── 4. Minimalist Auto-Hiding Controls (Only Visible on Movement/Pause) ── */}
      {!isEmbed && (
      <div
        className={`fixed inset-0 z-30 pointer-events-none flex flex-col justify-between p-6 transition-opacity duration-500 ease-out ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Top Header Bar */}
        <header className="flex items-center justify-between w-full pointer-events-auto select-none font-sans">
          {/* Track Information & Editor Link */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              title="Open Studio Editor"
              className="w-8 h-8 rounded-lg bg-[#09090b]/80 hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-white backdrop-blur-md transition-colors active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
            </Link>

            {doc && (
              <div className="flex flex-col">
                <h1 className="text-xs font-semibold text-white tracking-tight leading-none drop-shadow">
                  {doc.metadata.title}
                </h1>
                <p className="text-[10px] font-sans text-zinc-400 uppercase tracking-wider leading-tight drop-shadow mt-1">
                  {doc.metadata.artist}
                </p>
              </div>
            )}
          </div>

          {/* Right Action Icons: Transition Mode, Search & Fullscreen */}
          <div className="flex items-center gap-2">
            {/* Playback Controls (Transitions, Ken Burns, Video) - Visible When Song or Video Loaded */}
            {(lines.length > 0 || doc || youtubeVideoId) && (
              <>
                {/* Transition Mode Switcher (Options 1, 2, 3) */}
                <div className="hidden sm:flex items-center bg-[#09090b]/80 border border-white/[0.08] rounded-lg p-0.5 backdrop-blur-md text-xs font-sans">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTransitionMode('pivot');
                    }}
                    title="Option 1: 90° Clockwise Pivot (Press 1)"
                    className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                      transitionMode === 'pivot'
                        ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    1: 90° Turn
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTransitionMode('cube');
                    }}
                    title="Option 2: 3D Spatial Billboard / Cube Turnover (Press 2)"
                    className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                      transitionMode === 'cube'
                        ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    2: 3D Billboard
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTransitionMode('whip');
                    }}
                    title="Option 3: Kinetic Whip-Sweep (Press 3)"
                    className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                      transitionMode === 'whip'
                        ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    3: Kinetic Whip
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTransitionMode('peak');
                    }}
                    title="Option 4: Mountain Peak Ridge Visualizer (Press 4)"
                    className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                      transitionMode === 'peak'
                        ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    4: Mountain Peak
                  </button>
                </div>

                {/* Ken Burns Cinematic Zoom Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setKenBurns((prev) => !prev);
                  }}
                  title="Toggle Cinematic Ken Burns Slow Zoom (Press Z)"
                  className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium backdrop-blur-md transition-all cursor-pointer active:scale-95 ${
                    kenBurns
                      ? 'bg-white/15 border-white/20 text-white shadow-sm'
                      : 'bg-[#09090b]/80 border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {kenBurns ? 'zoom_in' : 'zoom_out'}
                  </span>
                  <span>Ken Burns</span>
                </button>

                {/* Video Backdrop Toggle (Default OFF) */}
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const next = !showVideoBg;
                    setShowVideoBg(next);
                    if (next) {
                      let targetYtId = youtubeVideoId;
                      if (!targetYtId && doc) {
                        try {
                          const ytMatch = await detectBestYouTubeMatch(
                            doc.metadata.artist,
                            doc.metadata.title,
                            durationRef.current
                          );
                          if (ytMatch && ytMatch.videoId) {
                            targetYtId = ytMatch.videoId;
                            setYoutubeVideoId(ytMatch.videoId);
                          }
                        } catch {}
                      }
                      // Synchronize YouTube video position and trigger playback
                      const cur = currentTimeRef.current;
                      setTimeout(() => {
                        window.dispatchEvent(
                          new CustomEvent('openlyryc:seek-to', { detail: { time: cur } })
                        );
                        if (isPlayingRef.current) {
                          window.dispatchEvent(
                            new CustomEvent('openlyryc:toggle-play', { detail: { isPlaying: true } })
                          );
                        }
                      }, 50);
                    }
                  }}
                  title="Toggle YouTube Video Backdrop (Default: OFF)"
                  className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium backdrop-blur-md transition-all cursor-pointer active:scale-95 ${
                    showVideoBg
                      ? 'bg-white/15 border-white/20 text-white shadow-sm'
                      : 'bg-[#09090b]/80 border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {showVideoBg ? 'videocam' : 'videocam_off'}
                  </span>
                  <span>{showVideoBg ? 'Video: ON' : 'Video: OFF'}</span>
                </button>
              </>
            )}

            {/* Header Search Trigger - Always accessible so user can switch songs anytime */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsSearchOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              title="Search Song"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#09090b]/80 hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-zinc-300 hover:text-white backdrop-blur-md transition-all cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">search</span>
              <span className="hidden sm:inline">Search</span>
            </button>

            {/* Audio Mute/Unmute Toggle Button */}
            {youtubeVideoId && !isAudioDisabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent('openlyryc:toggle-mute'));
                }}
                title={isAudioMuted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center backdrop-blur-md transition-all cursor-pointer active:scale-95 ${
                  isAudioMuted
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse'
                    : 'bg-[#09090b]/80 hover:bg-white/[0.08] border-white/[0.08] text-zinc-300 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-base">
                  {isAudioMuted ? 'volume_off' : 'volume_up'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!document.fullscreenElement) {
                  containerRef.current?.requestFullscreen?.();
                  setIsFullscreen(true);
                } else {
                  document.exitFullscreen?.();
                  setIsFullscreen(false);
                }
              }}
              title="Toggle Fullscreen (F)"
              className="w-8 h-8 rounded-lg bg-[#09090b]/80 hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-zinc-300 hover:text-white backdrop-blur-md transition-all cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-base">
                {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
              </span>
            </button>
          </div>
        </header>

        {/* Bottom Minimalist Timeline Scrubber */}
        {(duration > 0 || doc || youtubeVideoId) && (
          <footer className="w-full max-w-2xl mx-auto pointer-events-auto select-none flex flex-col gap-1.5 bg-[#09090b]/75 border border-white/[0.08] backdrop-blur-md rounded-xl px-4 py-2.5 font-sans">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTogglePlay();
                }}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                <span className="material-symbols-outlined text-sm">
                  {isPlaying ? "pause" : "play_arrow"}
                </span>
              </button>

              <span className="text-[10px] font-sans text-zinc-400 tabular-nums w-8 text-right">
                {formatTime(currentTime)}
              </span>

              <div
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  if (duration > 0) handleSeek(pct * duration);
                }}
                className="relative flex-1 h-1.5 hover:h-2 bg-white/10 hover:bg-white/15 rounded-full cursor-pointer transition-all group"
              >
                <div
                  className="absolute left-0 top-0 bottom-0 bg-white rounded-full transition-all group-hover:bg-zinc-200"
                  style={{
                    width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                  }}
                />
              </div>

              <span className="text-[10px] font-sans text-zinc-400 tabular-nums w-8">
                {formatTime(duration)}
              </span>

              {youtubeVideoId && !isAudioDisabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent('openlyryc:toggle-mute'));
                  }}
                  className={`transition-colors cursor-pointer ${isAudioMuted ? 'text-amber-400 animate-pulse' : 'text-zinc-400 hover:text-white'}`}
                  title={isAudioMuted ? "Unmute Audio (M)" : "Mute Audio (M)"}
                >
                  <span className="material-symbols-outlined text-sm">
                    {isAudioMuted ? "volume_off" : "volume_up"}
                  </span>
                </button>
              )}
            </div>
          </footer>
        )}
      </div>
      )}

      {/* ── 5. Loading Overlay ────────────────────────────────────────────── */}
      {isLoadingSong && (
        <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center gap-3 text-center select-none animate-in fade-in duration-300 font-sans">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          {!isEmbed && (
            <>
              <p className="text-sm font-medium text-white tracking-tight">{loadingStatus}</p>
              <p className="text-xs text-zinc-400">Preparing distraction-free kinetic stage...</p>
            </>
          )}
        </div>
      )}

      {/* ── 6. Error Banner ──────────────────────────────────────────────── */}
      {errorMessage && !isEmbed && (
        <div className="fixed top-16 inset-x-4 max-w-md mx-auto z-40 p-4 rounded-xl bg-red-950/80 border border-red-500/30 text-red-200 text-xs backdrop-blur-md shadow-2xl flex items-center justify-between gap-3 select-none font-sans">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-red-400 shrink-0 text-base">error</span>
            <span className="truncate">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-zinc-400 hover:text-white p-1 cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* ── 7. Search & Discovery Modal Dialog ────────────────────────────── */}
      {isSearchOpen && !isEmbed && (
        <div
          onClick={() => setIsSearchOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150 font-sans"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-[#101014] border border-white/[0.1] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] text-zinc-100 overflow-hidden select-text"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
              <div>
                <div className="text-[10px] font-sans uppercase tracking-widest text-zinc-500">
                  Stage Catalog
                </div>
                <h2 className="font-semibold text-white text-base tracking-tight mt-0.5">
                  Search & Play Songs
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="w-8 h-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors flex items-center justify-center cursor-pointer"
                aria-label="Close search modal"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="p-5 border-b border-white/[0.08] bg-white/[0.01]">
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-lg pointer-events-none">
                  search
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      if (isYouTubeUrl) {
                        loadFromYouTubeInput(searchQuery);
                      } else if (searchResults.length > 0) {
                        const top = searchResults.find((r) => r.hasLineSync) || searchResults[0];
                        loadSong({
                          id: top.id,
                          title: top.title,
                          artist: top.artist,
                          duration: top.duration,
                        });
                      } else {
                        loadSong({ query: searchQuery.trim(), title: searchQuery.trim() });
                      }
                    }
                  }}
                  placeholder="Song name, artist, or paste a YouTube URL..."
                  className="w-full bg-white/[0.04] border border-white/[0.1] focus:border-white/40 focus:bg-white/[0.06] rounded-xl text-white py-2.5 pl-10 pr-20 text-sm focus:outline-none transition-all placeholder:text-zinc-500"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">cancel</span>
                  </button>
                ) : (
                  <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-sans text-zinc-500 bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 rounded pointer-events-none">
                    ↵
                  </kbd>
                )}
              </div>
            </div>

            {/* Direct YouTube Video Detected Card */}
            {isYouTubeUrl && (
              <div className="mx-5 mt-4 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between gap-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                    <span className="material-symbols-outlined text-lg">smart_display</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-white">YouTube Stream Detected</p>
                      <span className="text-[9px] font-sans uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400 border border-white/[0.06]">
                        Direct Target
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                      Will load video backdrop and match synchronized lyrics
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => loadFromYouTubeInput(searchQuery)}
                  className="px-3.5 py-1.5 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 font-semibold text-xs shrink-0 cursor-pointer shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">play_arrow</span>
                  Play Video
                </button>
              </div>
            )}

            {/* Live Search Results List */}
            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-1 p-5 min-h-[180px]">
              {isSearching ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-zinc-400">
                  <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  <span className="text-xs font-sans">Searching across providers (lrc.red, Apple Music, LRCLIB, Musixmatch)…</span>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((item) => {
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        loadSong({
                          id: item.id,
                          title: item.title,
                          artist: item.artist,
                          duration: item.duration,
                        })
                      }
                      className="w-full text-left p-3 rounded-xl hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08] flex items-center justify-between gap-3 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-400 group-hover:text-white shrink-0">
                          <span className="material-symbols-outlined text-base">music_note</span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-white group-hover:text-zinc-100 truncate transition-colors">
                            {item.title}
                          </h4>
                          <p className="text-[11px] text-zinc-400 truncate">
                            {item.artist} {item.album ? `• ${item.album}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.hasLineSync ? (
                          <span className="px-2 py-0.5 rounded-md bg-white/[0.08] border border-white/10 text-zinc-200 font-sans text-[9px] tracking-wider uppercase">
                            Synced
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.06] text-zinc-500 font-sans text-[9px] tracking-wider uppercase">
                            Plain
                          </span>
                        )}
                        <span className="text-[10px] font-sans text-zinc-500 tabular-nums">
                          {formatTime(item.duration)}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : isYouTubeUrl ? (
                /* Clear instructions when a direct YouTube URL is loaded, eliminating contradictory "no lyrics" error */
                <div className="py-12 text-center text-zinc-400 text-xs flex flex-col items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-zinc-500 text-2xl">movie</span>
                  <p className="font-medium text-zinc-300">Ready to play YouTube stream</p>
                  <p className="text-zinc-500 text-[11px]">
                    Press <kbd className="font-sans bg-white/10 px-1.5 py-0.5 rounded text-zinc-300">Enter</kbd> or click <strong>Play Video</strong> above to launch stage playback.
                  </p>
                </div>
              ) : searchQuery.trim().length >= 2 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  No lyrics found for &quot;{searchQuery}&quot;. Try pasting a direct YouTube video URL.
                </div>
              ) : (
                /* Recommendations when input is empty */
                <div className="flex flex-col gap-2 pt-1">
                  <p className="text-[10px] font-sans uppercase tracking-widest text-zinc-500 px-1">
                    Featured Tracks
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {POPULAR_RECOMMENDATIONS.map((rec) => (
                      <button
                        key={rec.query}
                        type="button"
                        onClick={() => {
                          setSearchQuery(rec.query);
                        }}
                        className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.1] text-left flex items-center gap-2.5 cursor-pointer transition-colors group"
                      >
                        <span className="material-symbols-outlined text-sm text-zinc-400 group-hover:text-white transition-colors">
                          play_circle
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-200 group-hover:text-white truncate transition-colors">
                            {rec.title}
                          </p>
                          <p className="text-[10px] text-zinc-500 truncate">{rec.artist}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

PosterPreviewPlayer.displayName = 'PosterPreviewPlayer';
