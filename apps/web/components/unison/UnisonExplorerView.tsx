'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  UnisonHeader,
  type UnisonTabId,
} from './UnisonHeader';
import { UnisonSongsView } from './UnisonSongsView';
import { UnisonLeaderboardView } from './UnisonLeaderboardView';
import { UnisonCuratorProfile } from './UnisonCuratorProfile';
import { UnisonAboutView } from './UnisonAboutView';
import { UnisonSongCard } from './UnisonSongCard';
import { UnisonKawarpBackdrop } from './UnisonKawarpBackdrop';
import { type UnisonSelectedSong } from './UnisonHubModal';
import { getDominantColorFromImage } from '@/lib/unison/colorExtractor';
import {
  fetchUnisonLyricsByVideo,
  fetchUnisonArtwork,
  searchUnisonLyrics,
  fetchUnisonLyricsVariant,
} from '@/lib/unison/apiClient';
import { parseTTML } from '@/lib/ttmlParser';
import { parseLRC } from '@/lib/lrcParser';
import { resolveLyricsWithAutoRetry } from '@/lib/lyricsResolver';
import { LyricsPlayerView } from '@/components/lyrics/LyricsPlayerView';
import type { OpenLyricsDocument } from '@/types/lyrics';
import { DEFAULT_BG_CONFIG, type BackgroundConfig } from '@/components/lyrics/BackgroundCustomizerModal';
import {
  loadUnisonSession,
  clearUnisonSession,
  signInWithIdentityFile,
  signInWithExtension,
  generateAndRegisterNewIdentity,
} from '@/lib/unison/authService';
import type {
  UnisonStoredSession,
  UnisonFeedEntry,
} from '@/lib/unison/types';
import { ExtensionConnectCard } from './ExtensionConnectCard';
import { BetterLyricsLogo } from './BetterLyricsLogo';
import { X, Upload, Sparkles, Key, LogOut, CheckCircle2, AlertCircle, Lock, ArrowLeft, RefreshCw, Shield } from 'lucide-react';

interface UnisonExplorerViewProps {
  onBack: () => void;
  onStartTimingSong: (song: UnisonSelectedSong) => void;
  onOpenProfileModal?: () => void;
}

// Helper to parse hex/rgb color string into [r, g, b]
function parseColorToRgb(color: string): [number, number, number] {
  if (!color) return [194, 65, 12];
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(hex.slice(0, 6), 16);
    if (!isNaN(num)) {
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
  }
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
  }
  return [194, 65, 12];
}

// Continuous lerping ambient canvas: mathematically guarantees 0 color jumps under all conditions
const ContinuousAmbientGlow: React.FC<{
  color: string;
  isHovered: boolean;
  baseIntensity?: number;
  hoverIntensity?: number;
}> = ({ color, isHovered, baseIntensity = 0.22, hoverIntensity = 0.70 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({
    currentR: 194,
    currentG: 65,
    currentB: 12,
    currentAlpha: baseIntensity,
    targetR: 194,
    targetG: 65,
    targetB: 12,
    targetAlpha: baseIntensity,
    isAnimating: false,
  });

  // Update target values when props change
  useEffect(() => {
    const [tr, tg, tb] = parseColorToRgb(color);
    const s = stateRef.current;
    s.targetR = tr;
    s.targetG = tg;
    s.targetB = tb;
    s.targetAlpha = isHovered ? hoverIntensity : baseIntensity;

    if (!s.isAnimating) {
      s.isAnimating = true;
      let rafId: number;

      const tick = () => {
        const canvas = canvasRef.current;
        if (!canvas) {
          s.isAnimating = false;
          return;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          s.isAnimating = false;
          return;
        }

        // Exponential decay ease (~2.2s silky smooth continuous color glide)
        const ease = 0.032;
        s.currentR += (s.targetR - s.currentR) * ease;
        s.currentG += (s.targetG - s.currentG) * ease;
        s.currentB += (s.targetB - s.currentB) * ease;
        s.currentAlpha += (s.targetAlpha - s.currentAlpha) * ease;

        const diffR = Math.abs(s.targetR - s.currentR);
        const diffG = Math.abs(s.targetG - s.currentG);
        const diffB = Math.abs(s.targetB - s.currentB);
        const diffA = Math.abs(s.targetAlpha - s.currentAlpha);

        // Near target check: snap and pause rAF loop when settled
        if (diffR < 0.4 && diffG < 0.4 && diffB < 0.4 && diffA < 0.004) {
          s.currentR = s.targetR;
          s.currentG = s.targetG;
          s.currentB = s.targetB;
          s.currentAlpha = s.targetAlpha;
          s.isAnimating = false;
        }

        // Render soft celestial radial gradient
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const cr = Math.round(s.currentR);
        const cg = Math.round(s.currentG);
        const cb = Math.round(s.currentB);
        const ca = Math.max(0, Math.min(1, s.currentAlpha));

        const grad = ctx.createRadialGradient(w / 2, h * 0.18, 0, w / 2, h * 0.18, w * 0.55);
        grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${(ca * 0.65).toFixed(3)})`);
        grad.addColorStop(0.45, `rgba(${cr}, ${cg}, ${cb}, ${(ca * 0.22).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        if (s.isAnimating) {
          rafId = requestAnimationFrame(tick);
        }
      };

      rafId = requestAnimationFrame(tick);
      return () => {
        cancelAnimationFrame(rafId);
        s.isAnimating = false;
      };
    }
  }, [color, isHovered, baseIntensity, hoverIntensity]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none">
      <canvas
        ref={canvasRef}
        width={256}
        height={256}
        className="absolute inset-0 w-full h-full pointer-events-none select-none blur-3xl scale-125 will-change-transform"
        aria-hidden="true"
      />
    </div>
  );
};

export const UnisonExplorerView: React.FC<UnisonExplorerViewProps> = ({
  onBack,
  onStartTimingSong,
}) => {
  const [activeTab, setActiveTab] = useState<UnisonTabId>('songs');
  const [selectedCuratorKeyId, setSelectedCuratorKeyId] = useState<string | null>(null);

  // Session & Auth Modal
  const [session, setSession] = useState<UnisonStoredSession | null>(() => {
    return typeof window !== 'undefined' ? loadUnisonSession() : null;
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [exclusiveAuthTab, setExclusiveAuthTab] = useState<'extension' | 'file' | 'create'>('extension');
  const identityFileInputRef = useRef<HTMLInputElement>(null);

  // Seamless In-Page Now Playing Lyrics View
  const [playingSong, setPlayingSong] = useState<{
    videoId: string;
    song: string;
    artist: string;
    id?: number;
    thumbnailUrl?: string | null;
  } | null>(null);
  const [playingDoc, setPlayingDoc] = useState<OpenLyricsDocument | null>(null);
  const [isLoadingPlayingLyrics, setIsLoadingPlayingLyrics] = useState(false);
  const [playerBgConfig, setPlayerBgConfig] = useState<BackgroundConfig>(DEFAULT_BG_CONFIG);

  // Cinematic Fade-to-Black & Fade-in-to-Screen State
  const [isCurtainActive, setIsCurtainActive] = useState<boolean>(false);
  const [curtainOpacity, setCurtainOpacity] = useState<number>(0);
  const [isPlayerActive, setIsPlayerActive] = useState<boolean>(false);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  // Dynamic Backdrop State (syncs to Profile Photo & Song Hover)
  const [curatorAvatarUrl, setCuratorAvatarUrl] = useState<string | null>(null);
  const isProfileMode = Boolean(selectedCuratorKeyId || activeTab === 'profile');
  const baseAmbientColor = isProfileMode ? '#c88232' : '#c2410c';

  const [activeGlowColor, setActiveGlowColor] = useState<string>(baseAmbientColor);
  const [isGlowHovered, setIsGlowHovered] = useState<boolean>(false);
  const hoverDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hoverExtractionSeqRef = useRef<number>(0);

  // Sync ambient color when entering or exiting curator profile mode
  useEffect(() => {
    if (isProfileMode) {
      const avatar = curatorAvatarUrl || session?.avatarUrl;
      if (avatar) {
        getDominantColorFromImage(avatar, '#c88232').then((col) => {
          setActiveGlowColor(col);
        });
      } else {
        setActiveGlowColor('#c88232');
      }
    } else {
      setActiveGlowColor('#c2410c');
    }
  }, [isProfileMode, curatorAvatarUrl, session?.avatarUrl]);

  // Debounced hover color extraction: resolves the true artwork pigment BEFORE triggering transition,
  // preventing any temporary fallback flash or abrupt color jumping
  const handleHoverArtworkDebounced = useCallback(
    (artworkUrl: string | null) => {
      const currentSeq = ++hoverExtractionSeqRef.current;
      if (hoverDebounceTimerRef.current) {
        clearTimeout(hoverDebounceTimerRef.current);
      }

      if (artworkUrl) {
        // 90ms intentional hover threshold before starting extraction
        hoverDebounceTimerRef.current = setTimeout(async () => {
          try {
            const extracted = await getDominantColorFromImage(artworkUrl, baseAmbientColor);
            if (hoverExtractionSeqRef.current === currentSeq) {
              setActiveGlowColor(extracted);
              setIsGlowHovered(true);
            }
          } catch {
            // keep current on error
          }
        }, 90);
      } else {
        // 220ms smooth grace period when cursor leaves card
        hoverDebounceTimerRef.current = setTimeout(() => {
          if (hoverExtractionSeqRef.current === currentSeq) {
            setIsGlowHovered(false);
            setActiveGlowColor(baseAmbientColor);
          }
        }, 220);
      }
    },
    [baseAmbientColor]
  );

  useEffect(() => {
    return () => {
      if (hoverDebounceTimerRef.current) clearTimeout(hoverDebounceTimerRef.current);
    };
  }, []);

  // WebGL Kawarp stays stably on Aurora preset on Home Screen & Leaderboard;
  // only loads custom photo when in Curator Profile mode
  const kawarpBackdropSrc = isProfileMode ? (curatorAvatarUrl || session?.avatarUrl || undefined) : undefined;

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<UnisonFeedEntry[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Fluid WebGL Background
  const [isKawarpActive, setIsKawarpActive] = useState<boolean>(true);

  // Load session on mount
  useEffect(() => {
    setSession(loadUnisonSession());
    const handleSync = () => {
      setSession(loadUnisonSession());
    };
    window.addEventListener('openlyryc-unison-session-updated', handleSync);
    return () => {
      window.removeEventListener('openlyryc-unison-session-updated', handleSync);
    };
  }, []);

  // Global Escape key handling to return to Studio
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAuthModalOpen) {
          setIsAuthModalOpen(false);
          return;
        }
        if (selectedCuratorKeyId) {
          setSelectedCuratorKeyId(null);
          return;
        }
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, selectedCuratorKeyId, onBack]);

  // Handle Search Input Debouncing
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!value.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const raw = await searchUnisonLyrics({ q: value.trim() });
        const list: UnisonFeedEntry[] = Array.isArray(raw)
          ? raw.map((r: any) => ({
              id: r.id || undefined,
              videoId: r.videoId || r.id || '',
              song: r.song || r.title || 'Untitled',
              artist: r.artist || 'Unknown',
              album: r.album,
              format: r.format || 'ttml',
              syncType: r.syncType || r.format || 'richsync',
              duration: r.duration,
              confidence: r.confidence || 'verified',
              voteCount: r.voteCount || 0,
              createdAt: r.createdAt || Math.floor(Date.now() / 1000),
              submitter: r.submitter || undefined,
            }))
          : [];
        setSearchResults(list);
      } catch (err) {
        console.warn('[UnisonExplorerView] Search failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  // Seamless In-Page Playback (Fade out to black -> Buffer & load -> Fade in to screen)
  const handlePlaySong = useCallback(
    async (song: {
      videoId: string;
      song: string;
      artist: string;
      id?: number;
      thumbnailUrl?: string | null;
      originRect?: { top: number; left: number; width: number; height: number } | null;
    }) => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);

      // 1. Immediately start fading out to pure black (480ms) - No UI in between
      setIsCurtainActive(true);
      requestAnimationFrame(() => {
        setCurtainOpacity(1);
      });

      // Prepare lightweight skeleton document for immediate player mount
      const initialDoc: OpenLyricsDocument = {
        $schema: 'https://openlyryc.org/schema/v1.json',
        version: 1,
        metadata: {
          title: song.song,
          artist: song.artist,
          duration: 0,
          syncedBy: 'Unison Community',
        },
        lines: [],
      };

      // 2. Fetch lyrics concurrently in background
      const fetchLyricsPromise = (async () => {
        let doc: OpenLyricsDocument | null = null;
        if (song.id) {
          try {
            const v = await fetchUnisonLyricsVariant(song.id);
            if (v?.lyrics) {
              const raw = String(v.lyrics);
              doc = v.format === 'lrc' ? parseLRC(raw) : parseTTML(raw);
            }
          } catch {}
        }
        if (!doc && song.videoId) {
          try {
            const resp = await fetchUnisonLyricsByVideo(song.videoId);
            if (resp?.lyrics) {
              const raw = String(resp.lyrics);
              doc = resp.format === 'lrc' ? parseLRC(raw) : parseTTML(raw);
            }
          } catch {}
        }
        if (!doc) {
          try {
            doc = await resolveLyricsWithAutoRetry({
              title: song.song,
              artist: song.artist,
            });
          } catch {}
        }
        if (doc) {
          doc.metadata.title = song.song;
          doc.metadata.artist = song.artist;
        }
        return doc;
      })();

      // 3. Once screen has faded out to 100% black (480ms), mount player behind the black curtain
      transitionTimerRef.current = setTimeout(() => {
        setPlayingSong(song);
        setPlayingDoc(initialDoc);
        setIsPlayerActive(true);

        fetchLyricsPromise.then((loadedDoc) => {
          if (loadedDoc) setPlayingDoc(loadedDoc);
        });

        // 4. Hold on black for 450ms: smooth time for music & video to initialize and buffer
        transitionTimerRef.current = setTimeout(() => {
          // 5. Fade in smoothly to screen (curtain fades 1 -> 0 over 500ms)
          setCurtainOpacity(0);

          transitionTimerRef.current = setTimeout(() => {
            setIsCurtainActive(false);
          }, 500);
        }, 450);
      }, 480);
    },
    []
  );

  // Return to Unison Hub: Fade out to black -> Unmount player -> Fade in to Hub
  const handleClosePlayer = useCallback(() => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);

    // 1. Fade player out to black over 380ms
    setIsCurtainActive(true);
    requestAnimationFrame(() => {
      setCurtainOpacity(1);
    });

    transitionTimerRef.current = setTimeout(() => {
      // 2. Completely black: unmount player immediately (halts all video & audio playback)
      setPlayingSong(null);
      setPlayingDoc(null);
      setIsPlayerActive(false);

      // 3. Fade in smoothly to Unison Hub over 380ms
      setCurtainOpacity(0);

      transitionTimerRef.current = setTimeout(() => {
        setIsCurtainActive(false);
      }, 380);
    }, 380);
  }, []);

  // Escape key closes player view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && playingSong) {
        handleClosePlayer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playingSong, handleClosePlayer]);

  // Edit in OpenLyryc Studio editor
  const handleEditInStudio = useCallback(
    async (song: { videoId: string; song: string; artist: string; id?: number; thumbnailUrl?: string | null }) => {
      let initialLyrics: string | undefined = undefined;
      let format: 'ttml' | 'lrc' | 'plain' = 'ttml';

      try {
        const existing = await fetchUnisonLyricsByVideo(song.videoId);
        if (existing?.lyrics) {
          initialLyrics = existing.lyrics;
          format = existing.format || 'ttml';
        }
      } catch {}

      let resolvedThumb = song.thumbnailUrl || null;
      if (!resolvedThumb && song.videoId) {
        try {
          const art = await fetchUnisonArtwork(song.videoId);
          if (art) resolvedThumb = art;
        } catch {}
      }

      if (!resolvedThumb && song.videoId && song.videoId.length === 11) {
        resolvedThumb = `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`;
      }

      onStartTimingSong({
        videoId: song.videoId,
        song: song.song,
        artist: song.artist,
        thumbnailUrl: resolvedThumb,
        initialLyrics,
        format,
      });
    },
    [onStartTimingSong]
  );

  // Curator selection
  const handleSelectCurator = useCallback((curator: { keyId: string; displayName?: string } | string) => {
    const key = typeof curator === 'string' ? curator : curator.keyId;
    setSelectedCuratorKeyId(key);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Header navigation
  const handleTabChange = useCallback(
    (tab: UnisonTabId) => {
      if (tab === 'profile') {
        if (session?.keyId) {
          setSelectedCuratorKeyId(session.keyId);
        } else {
          setIsAuthModalOpen(true);
        }
        return;
      }
      setSelectedCuratorKeyId(null);
      setActiveTab(tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [session]
  );

  // Auth: Upload keyfile
  const handleUploadKeyfile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsConnecting(true);
    setAuthError(null);
    try {
      const newSession = await signInWithIdentityFile(file);
      setSession(newSession);
      setIsAuthModalOpen(false);
    } catch (err: any) {
      setAuthError(err.message || 'Failed to authenticate with identity file.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Auth: Extension connect
  const handleConnectExtension = async () => {
    setIsConnecting(true);
    setAuthError(null);
    try {
      const newSession = await signInWithExtension();
      setSession(newSession);
      setIsAuthModalOpen(false);
    } catch (err: any) {
      setAuthError(err.message || 'Better Lyrics extension not detected in browser.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Auth: Generate new keypair
  const handleGenerateIdentity = async () => {
    setIsConnecting(true);
    setAuthError(null);
    try {
      const res = await generateAndRegisterNewIdentity();
      setSession(res.session);
      setIsAuthModalOpen(false);
    } catch (err: any) {
      setAuthError(err.message || 'Failed to generate keypair.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect
  const handleDisconnect = () => {
    clearUnisonSession();
    setSession(null);
    setSelectedCuratorKeyId(null);
    setIsAuthModalOpen(false);
  };

  // ── Account Exclusive Gate: If user has no active Unison session, gate the hub ──
  if (!session?.keyId) {
    return (
      <div
        className="unison-hub flex-1 flex flex-col h-full bg-[#0a090e] text-zinc-100 select-none overflow-y-auto relative [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        {/* Hidden keyfile input */}
        <input
          ref={identityFileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleUploadKeyfile}
        />

        {/* Fluid Ambient WebGL Animated Backdrop */}
        <UnisonKawarpBackdrop presetIndex={0} opacity={0.75} />

        {/* Minimal Navigation Top Bar */}
        <header className="relative z-20 w-full h-16 border-b border-white/[0.06] bg-[#0c0a12]/60 backdrop-blur-xl flex items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <BetterLyricsLogo size={24} variant="color" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-white">Unison</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-[10px] font-medium text-amber-300">
                Account Exclusive
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-normal text-zinc-300 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-zinc-400" />
            <span>Return to Studio</span>
            <kbd className="text-[10px] px-1 py-0.2 bg-white/[0.08] rounded border border-white/10 text-zinc-400">Esc</kbd>
          </button>
        </header>

        {/* Central Hero Gate Container */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10 my-auto">
          <div className="w-full max-w-lg bg-[#141219]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-200">
            {/* Header Icon & Copy */}
            <div className="space-y-2.5">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 grid place-items-center mx-auto shadow-inner shadow-amber-500/10">
                <BetterLyricsLogo size={28} variant="color" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-medium text-amber-400">
                <Lock className="w-3 h-3 text-amber-400" />
                <span>Sign in Required</span>
              </div>

              <h1 className="text-xl sm:text-2xl font-medium text-white tracking-tight">
                Unison Hub is Account Exclusive
              </h1>
              <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                Connect your Better Lyrics identity or generate a key to access the community hub, explore synced lyrics, view curator rankings, and publish tracks.
              </p>
            </div>

            {authError && (
              <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-950/40 text-xs text-red-200 flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span className="leading-relaxed">{authError}</span>
              </div>
            )}

            {/* Auth Method Selector */}
            <div className="flex p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06] max-w-sm mx-auto">
              <button
                type="button"
                onClick={() => setExclusiveAuthTab('extension')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  exclusiveAuthTab === 'extension' ? 'bg-white/12 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Extension
              </button>
              <button
                type="button"
                onClick={() => setExclusiveAuthTab('file')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  exclusiveAuthTab === 'file' ? 'bg-white/12 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Identity File
              </button>
              <button
                type="button"
                onClick={() => setExclusiveAuthTab('create')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  exclusiveAuthTab === 'create' ? 'bg-white/12 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Create Key
              </button>
            </div>

            {/* Tab 1: Extension Connect Card */}
            {exclusiveAuthTab === 'extension' && (
              <div className="animate-in fade-in duration-150">
                <ExtensionConnectCard
                  onSuccess={(newSession) => {
                    setSession(newSession);
                    setAuthError(null);
                  }}
                  onError={(err) => setAuthError(err)}
                  onSwitchToFile={() => setExclusiveAuthTab('file')}
                />
              </div>
            )}

            {/* Tab 2: Identity File Upload */}
            {exclusiveAuthTab === 'file' && (
              <div className="space-y-3.5 animate-in fade-in duration-150">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-3 text-left">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 grid place-items-center text-blue-400 shrink-0">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">Import Better Lyrics Keyfile</p>
                      <p className="text-[11px] text-zinc-400">Upload your exported <code className="px-1 rounded bg-black/40 text-blue-300">better-lyrics-identity.json</code></p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isConnecting}
                    onClick={() => identityFileInputRef.current?.click()}
                    className="w-full h-10 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 active:scale-[0.98] font-medium text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Select JSON File</span>
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-zinc-500 text-center leading-relaxed">
                    In Better Lyrics extension options → Identity → Export Identity File.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 3: Create New Identity */}
            {exclusiveAuthTab === 'create' && (
              <div className="space-y-3.5 animate-in fade-in duration-150">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-3 text-left">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 grid place-items-center text-amber-400 shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">Generate Cryptographic Key</p>
                      <p className="text-[11px] text-zinc-400">Creates a new ECDSA P-256 identity in your browser</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isConnecting}
                    onClick={handleGenerateIdentity}
                    className="w-full h-10 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate Key & Unlock Hub</span>
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-zinc-500 text-center leading-relaxed">
                    A backup JSON key file will automatically download to your device.
                  </p>
                </div>
              </div>
            )}

            {/* Studio Return Link */}
            <div className="pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={onBack}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                Return to OpenLyryc Studio Editor
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="unison-hub flex-1 flex flex-col h-full bg-[#0a090e] text-zinc-100 select-none overflow-y-auto relative [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {/* ── Fluid Ambient WebGL Animated Backdrop (Aurora default, saturation 0, 3s transition) ── */}
      <UnisonKawarpBackdrop
        src={kawarpBackdropSrc}
        presetIndex={0}
        opacity={isKawarpActive ? 0.85 : 0}
      />

      {/* ── Continuous Ambient Color Glow Layer (100% continuous lerp, zero color jumps) ── */}
      <ContinuousAmbientGlow
        color={activeGlowColor}
        isHovered={isGlowHovered}
      />

      {/* ── Official Unison Header (minus Showcase) ── */}
      <UnisonHeader
        activeTab={selectedCuratorKeyId ? 'profile' : activeTab}
        onTabChange={handleTabChange}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        session={session}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onBack={onBack}
        curatorHandle={session?.displayName}
      />

      {/* ── Main Content Container ── */}
      <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 z-10">
        {/* If user searched from header, show search results */}
        {searchQuery.trim().length > 0 ? (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-medium text-white tracking-tight">
                  Search results for &ldquo;{searchQuery}&rdquo;
                </h1>
                <p className="text-xs text-white/50 mt-1 font-normal">
                  {isSearching ? 'Searching Unison corpus…' : `${searchResults.length} matching songs found`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium px-3 py-1.5 rounded-lg bg-white/[0.04] transition-colors"
              >
                Clear search
              </button>
            </div>

            {isSearching && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-2xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
                ))}
              </div>
            )}

            {!isSearching && searchResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
                {searchResults.map((entry) => (
                  <UnisonSongCard
                    key={entry.id || entry.videoId}
                    entry={entry}
                    onPlaySong={handlePlaySong}
                    onEditInStudio={handleEditInStudio}
                    onSelectCurator={(c) => setSelectedCuratorKeyId(c.keyId)}
                    onHoverArtwork={handleHoverArtworkDebounced}
                  />
                ))}
              </div>
            )}

            {!isSearching && searchResults.length === 0 && (
              <div className="p-16 text-center border border-white/5 rounded-2xl bg-white/[0.01]">
                <p className="text-base font-medium text-white/70">No lyrics found for &ldquo;{searchQuery}&rdquo;</p>
                <p className="text-xs text-white/40 mt-1 font-normal">
                  Be the first to submit lyrics for this song in OpenLyryc Studio!
                </p>
              </div>
            )}
          </div>
        ) : selectedCuratorKeyId ? (
          /* ── In-Hub Curator Profile View ── */
          <UnisonCuratorProfile
            keyId={selectedCuratorKeyId}
            onBack={() => {
              setSelectedCuratorKeyId(null);
              setCuratorAvatarUrl(null);
              setIsGlowHovered(false);
            }}
            onSelectSong={(s) =>
              handlePlaySong({
                videoId: s.videoId,
                song: s.title,
                artist: s.artist,
                id: s.id,
                thumbnailUrl: s.thumbnailUrl,
                originRect: s.originRect,
              })
            }
            onStartTimingSong={(title, artist, videoId) =>
              handleEditInStudio({
                videoId: videoId || '',
                song: title,
                artist,
              })
            }
            selfKeyId={session?.keyId}
            onProfileAvatarChange={(url) => setCuratorAvatarUrl(url)}
            onHoverSongArtwork={handleHoverArtworkDebounced}
          />
        ) : (
          /* ── Main Tab Navigation Switch ── */
          <>
            {activeTab === 'songs' && (
              <UnisonSongsView
                onPlaySong={handlePlaySong}
                onEditInStudio={handleEditInStudio}
                onSelectCurator={(c) => setSelectedCuratorKeyId(c.keyId)}
                onNavigateToTab={handleTabChange}
                onHoverSongArtwork={handleHoverArtworkDebounced}
              />
            )}

            {activeTab === 'leaderboard' && (
              <UnisonLeaderboardView
                onSelectCurator={(keyId) => setSelectedCuratorKeyId(keyId)}
                selfKeyId={session?.keyId}
              />
            )}

            {activeTab === 'about' && <UnisonAboutView />}
          </>
        )}
      </main>

      {/* ── Sign-in / Identity Management Modal ── */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-[#141219] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h2 className="text-xl font-medium text-white tracking-tight">
                Sign in to Unison
              </h2>
              <p className="text-xs text-white/50 mt-1 leading-relaxed font-normal">
                Connect your Better Lyrics key to earn XP, unlock badges, and upload lyrics.
              </p>
            </div>

            {authError && (
              <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-950/30 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {session ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 grid place-items-center text-amber-300 font-medium">
                    {(session.displayName || 'U').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{session.displayName || 'Curator'}</p>
                    <p className="text-[11px] text-white/40 truncate">{session.keyId}</p>
                  </div>
                  <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Connected
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAuthModalOpen(false);
                      setSelectedCuratorKeyId(session.keyId);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-medium text-xs transition-colors"
                  >
                    View profile
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 font-medium text-xs transition-colors flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 1. Connect Better Lyrics Extension */}
                <button
                  type="button"
                  disabled={isConnecting}
                  onClick={handleConnectExtension}
                  className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-left transition-all group disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/30 grid place-items-center text-red-400 font-medium shrink-0">
                    ♪
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white group-hover:text-amber-400 transition-colors">
                      Connect Better Lyrics extension
                    </p>
                    <p className="text-[11px] text-white/40 font-normal">Sync key directly from your browser</p>
                  </div>
                </button>

                {/* 2. Upload Identity File */}
                <input
                  ref={identityFileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleUploadKeyfile}
                />
                <button
                  type="button"
                  disabled={isConnecting}
                  onClick={() => identityFileInputRef.current?.click()}
                  className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-left transition-all group disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 grid place-items-center text-blue-400 shrink-0">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white group-hover:text-amber-400 transition-colors">
                      Upload keyfile (.json)
                    </p>
                    <p className="text-[11px] text-white/40 font-normal">Exported from Better Lyrics Options</p>
                  </div>
                </button>

                {/* 3. Generate New Identity */}
                <button
                  type="button"
                  disabled={isConnecting}
                  onClick={handleGenerateIdentity}
                  className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-left transition-all group disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 grid place-items-center text-amber-400 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white group-hover:text-amber-400 transition-colors">
                      Create new key
                    </p>
                    <p className="text-[11px] text-white/40 font-normal">Generate a new keypair in your browser</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── In-Page Lyrics Player Screen (mounted cleanly behind black curtain) ── */}
      {playingSong && playingDoc && isPlayerActive && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-[#0a090e] select-text [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <LyricsPlayerView
            initialDoc={playingDoc}
            coverArt={playingSong.thumbnailUrl || undefined}
            initialYoutubeId={playingSong.videoId}
            bgConfig={playerBgConfig}
            onUpdateBgConfig={setPlayerBgConfig}
            onBackToSearch={handleClosePlayer}
            onSelectSong={(s) => {
              handlePlaySong({
                videoId: s.id || '',
                song: s.title,
                artist: s.artist,
                thumbnailUrl: s.coverArt,
              });
            }}
            autoPlay={true}
            transparentBackdrop={false}
          />
        </div>
      )}

      {/* ── Seamless Cinematic Blackout Curtain (Fade out to black & Fade in to screen) ── */}
      {isCurtainActive && (
        <div
          className="fixed inset-0 z-50 bg-[#0a090e] pointer-events-auto transition-opacity duration-500 ease-in-out will-change-[opacity]"
          style={{ opacity: curtainOpacity }}
          aria-hidden="true"
        />
      )}
    </div>
  );
};
