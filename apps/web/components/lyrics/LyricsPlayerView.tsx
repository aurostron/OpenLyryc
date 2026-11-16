'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Check, 
  Download, 
  Share2, 
  Search, 
  Languages, 
  Palette, 
  Info, 
  Disc, 
  Volume2, 
  VolumeX, 
  ArrowLeft,
  ChevronDown,
  SlidersHorizontal,
  ExternalLink,
  Layers,
  Crosshair
} from 'lucide-react';
import { OpenLyricsDocument, LyricLine, WordToken, SongSearchResult } from '@/types/lyrics';
import { YouTubeEmbedPlayer, YouTubeDisplayMode } from './YouTubeEmbedPlayer';

const YouTubeIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);
import { YouTubeFetcherModal } from './YouTubeFetcherModal';
import { BackgroundCustomizerModal, BackgroundConfig } from './BackgroundCustomizerModal';
import { KawarpBackground } from './KawarpBackground';
import { TrackInfoModal } from './TrackInfoModal';
import { QuickSearchModal } from './QuickSearchModal';
import { SyncOffsetModal } from './SyncOffsetModal';
import { OpenLyrycLogo } from '@/components/OpenLyrycLogo';
import { convertDocumentToRomaji, hasJapaneseScript } from '@/lib/romaji';
import { convertDocumentToRomanHindi, hasHindiScript } from '@/lib/hindi';
import { convertDocumentToKoreanRoman, hasKoreanScript } from '@/lib/korean';
import { DetectedYouTubeMatch } from '@/lib/youtubeAutoDetector';
import {
  FlowLineRow,
  InstrumentalGapIndicator,
  buildDynamicFlowItems,
} from '@/components/LyricRenderer';
import { buildStageFontStack, stageFontWeightValue, ensureStageFontLoaded } from '@/lib/stageFonts';

interface LyricsPlayerViewProps {
  initialDoc: OpenLyricsDocument;
  coverArt?: string;
  initialYoutubeId?: string | null;
  bgConfig: BackgroundConfig;
  onUpdateBgConfig: (cfg: BackgroundConfig) => void;
  onBackToSearch: () => void;
  onSelectSong: (song: SongSearchResult) => void;
  autoPlay?: boolean;
  transparentBackdrop?: boolean;
  mode?: 'lyrics' | 'karaoke';
  isKaraoke?: boolean;
}

type LyricDisplayMode = 'synced' | 'plain';
type FontSize = 'sm' | 'md' | 'lg' | 'xl';

function formatTime(seconds?: number): string {
  if (seconds === undefined || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const LyricsPlayerView: React.FC<LyricsPlayerViewProps> = ({
  initialDoc,
  coverArt: initialCoverArt,
  initialYoutubeId = null,
  bgConfig,
  onUpdateBgConfig,
  onBackToSearch,
  onSelectSong,
  autoPlay = false,
  transparentBackdrop = false,
  mode = 'lyrics',
  isKaraoke = false,
}) => {
  const isKaraokeMode = mode === 'karaoke' || isKaraoke;
  // ── Document, Romaji, Roman Hindi & Korean State ─────────────────────────
  const [doc, setDoc] = useState<OpenLyricsDocument>(initialDoc);
  const [isRomajiActive, setIsRomajiActive] = useState(false);
  const [isRomanHindiActive, setIsRomanHindiActive] = useState(false);
  const [isKoreanRomanActive, setIsKoreanRomanActive] = useState(false);
  const originalDocRef = useRef<OpenLyricsDocument>(initialDoc);

  useEffect(() => {
    setDoc(initialDoc);
    originalDocRef.current = initialDoc;
    setIsRomajiActive(false);
    setIsRomanHindiActive(false);
    setIsKoreanRomanActive(false);
  }, [initialDoc]);

  // Check if track has Japanese lyrics for romaji button
  const hasJapanese = useMemo(() => {
    return originalDocRef.current.lines?.some((l) => hasJapaneseScript(l.text)) || doc.lines?.some((l) => hasJapaneseScript(l.text));
  }, [doc]);

  // Check if track has Hindi lyrics for Roman Hindi button
  const hasHindi = useMemo(() => {
    return originalDocRef.current.lines?.some((l) => hasHindiScript(l.text)) || doc.lines?.some((l) => hasHindiScript(l.text));
  }, [doc]);

  // Check if track has Korean lyrics for Roman Korean button
  const hasKorean = useMemo(() => {
    return originalDocRef.current.lines?.some((l) => hasKoreanScript(l.text)) || doc.lines?.some((l) => hasKoreanScript(l.text));
  }, [doc]);

  const toggleRomaji = () => {
    if (isRomajiActive) {
      setDoc(originalDocRef.current);
      setIsRomajiActive(false);
    } else {
      setIsRomanHindiActive(false);
      setIsKoreanRomanActive(false);
      const romajiDoc = convertDocumentToRomaji(originalDocRef.current);
      setDoc(romajiDoc);
      setIsRomajiActive(true);
    }
  };

  const toggleRomanHindi = () => {
    if (isRomanHindiActive) {
      setDoc(originalDocRef.current);
      setIsRomanHindiActive(false);
    } else {
      setIsRomajiActive(false);
      setIsKoreanRomanActive(false);
      const romanHindiDoc = convertDocumentToRomanHindi(originalDocRef.current);
      setDoc(romanHindiDoc);
      setIsRomanHindiActive(true);
    }
  };

  const toggleKoreanRoman = () => {
    if (isKoreanRomanActive) {
      setDoc(originalDocRef.current);
      setIsKoreanRomanActive(false);
    } else {
      setIsRomajiActive(false);
      setIsRomanHindiActive(false);
      const koreanRomanDoc = convertDocumentToKoreanRoman(originalDocRef.current);
      setDoc(koreanRomanDoc);
      setIsKoreanRomanActive(true);
    }
  };

  // ── Artwork State ────────────────────────────────────────────────────────
  const coverArt = initialCoverArt || doc.metadata.coverArt;

  // ── Mode & Typography State ──────────────────────────────────────────────
  const [displayMode, setDisplayMode] = useState<LyricDisplayMode>('synced');
  const [fontSize, setFontSize] = useState<FontSize>('lg');

  const textSizeClasses: Record<FontSize, string> = {
    sm: 'text-xl sm:text-2xl md:text-3xl',
    md: 'text-2xl sm:text-3xl md:text-4xl',
    lg: 'text-3xl sm:text-4xl md:text-5xl',
    xl: 'text-4xl sm:text-5xl md:text-6xl',
  };

  const cycleFontSize = () => {
    const sequence: FontSize[] = ['sm', 'md', 'lg', 'xl'];
    const nextIdx = (sequence.indexOf(fontSize) + 1) % sequence.length;
    setFontSize(sequence[nextIdx]);
    showToast(`Font Size: ${sequence[nextIdx].toUpperCase()}`);
  };

  // ── Playback & Clock State ───────────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay);
  const [followAlong, setFollowAlong] = useState<boolean>(true);
  const [syncOffset, setSyncOffset] = useState<number>(0);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [isCalibratingFirstLine, setIsCalibratingFirstLine] = useState<boolean>(false);
  const [showIntroPrompt, setShowIntroPrompt] = useState<boolean>(false);
  const [hasDismissedPrompt, setHasDismissedPrompt] = useState<boolean>(false);
  const [seekTrigger, setSeekTrigger] = useState<{ time: number; timestamp: number } | null>(null);


  // ── YouTube Embed & Fetcher State ────────────────────────────────────────
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(initialYoutubeId);
  const [youtubeTitle, setYoutubeTitle] = useState<string>('');
  const [youtubeChannel, setYoutubeChannel] = useState<string>('');
  const [ytDisplayMode, setYtDisplayMode] = useState<YouTubeDisplayMode>('side');
  const [coverArtError, setCoverArtError] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(100);

  // Sync initial youtube ID if prop changes
  useEffect(() => {
    if (initialYoutubeId) {
      setYoutubeVideoId(initialYoutubeId);
    }
  }, [initialYoutubeId]);

  const SYNC_OFFSETS_STORAGE_KEY = 'openlyryc_sync_offsets';

  const getStoredOffset = (videoId: string): number => {
    if (typeof window === 'undefined') return 0;
    try {
      const raw = localStorage.getItem(SYNC_OFFSETS_STORAGE_KEY);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return typeof parsed[videoId] === 'number' ? parsed[videoId] : 0;
    } catch {
      return 0;
    }
  };

  const saveStoredOffset = (videoId: string, offset: number) => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(SYNC_OFFSETS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed[videoId] = offset;
      localStorage.setItem(SYNC_OFFSETS_STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      // ignore
    }
  };

  const firstLine = useMemo(() => {
    if (!doc.lines || doc.lines.length === 0) return null;
    return doc.lines.find((l) => l.text && l.text.trim().length > 0) || doc.lines[0];
  }, [doc]);

  const firstLineTime = firstLine ? firstLine.start : 0;
  const firstLineText = firstLine ? firstLine.text : '';

  // Load stored offset whenever youtubeVideoId changes
  useEffect(() => {
    if (youtubeVideoId) {
      const stored = getStoredOffset(youtubeVideoId);
      setSyncOffset(stored);
    }
  }, [youtubeVideoId]);

  // Reset prompt dismissal when initialDoc changes
  useEffect(() => {
    setHasDismissedPrompt(false);
    setShowIntroPrompt(false);
    setIsCalibratingFirstLine(false);
  }, [initialDoc]);

  // Calibration action
  const handleExecuteCalibration = useCallback(() => {
    const rawVideoTime = currentTime + syncOffset;
    const targetLineTime = firstLineTime;
    const calculatedOffset = Math.round((rawVideoTime - targetLineTime) * 100) / 100;

    setSyncOffset(calculatedOffset);
    if (youtubeVideoId) {
      saveStoredOffset(youtubeVideoId, calculatedOffset);
    }
    setIsCalibratingFirstLine(false);
    setShowIntroPrompt(false);
    setHasDismissedPrompt(true);
    showToast(`Offset set to ${calculatedOffset > 0 ? `+${calculatedOffset}` : calculatedOffset}s`);
  }, [currentTime, syncOffset, firstLineTime, youtubeVideoId]);

  const updateSyncOffset = (newOffset: number) => {
    setSyncOffset(newOffset);
    if (youtubeVideoId) {
      saveStoredOffset(youtubeVideoId, newOffset);
    }
    showToast(`Sync Offset: ${newOffset > 0 ? `+${newOffset}` : newOffset}s`);
  };

  // Show intro prompt automatically during the opening intro of a karaoke song if offset is 0
  useEffect(() => {
    if (
      isKaraokeMode &&
      syncOffset === 0 &&
      !hasDismissedPrompt &&
      isPlaying &&
      currentTime < Math.max(12, firstLineTime + 3)
    ) {
      setShowIntroPrompt(true);
    } else if (currentTime >= firstLineTime + 5) {
      setShowIntroPrompt(false);
    }
  }, [isKaraokeMode, syncOffset, hasDismissedPrompt, isPlaying, currentTime, firstLineTime]);

  useEffect(() => {
    if (autoPlay) {
      setIsPlaying(true);
    }
  }, [autoPlay, initialYoutubeId]);

  const duration = useMemo(() => {
    if (doc.metadata.duration && doc.metadata.duration > 0) return doc.metadata.duration;
    const lastLine = doc.lines?.[doc.lines.length - 1];
    return lastLine ? Math.ceil(lastLine.end) : 180;
  }, [doc]);


  // Virtual Master Clock fallback (if YouTube audio is not running or paused)
  const virtualClockRef = useRef<number | null>(null);
  const lastVirtualTickRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isPlaying) {
      if (virtualClockRef.current) cancelAnimationFrame(virtualClockRef.current);
      return;
    }

    lastVirtualTickRef.current = Date.now();

    const loop = () => {
      const now = Date.now();
      const delta = (now - lastVirtualTickRef.current) / 1000;
      lastVirtualTickRef.current = now;

      // Advance clock smoothly if not driven by YouTube
      if (!youtubeVideoId) {
        setCurrentTime((prev) => {
          const next = prev + delta;
          if (next >= duration) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }

      virtualClockRef.current = requestAnimationFrame(loop);
    };

    virtualClockRef.current = requestAnimationFrame(loop);

    return () => {
      if (virtualClockRef.current) cancelAnimationFrame(virtualClockRef.current);
    };
  }, [isPlaying, youtubeVideoId, duration]);

  // ── Dynamic Flow Engine (Studio Precision) ────────────────────────────────
  const flowItems = useMemo(() => buildDynamicFlowItems(doc.lines || []), [doc.lines]);

  const lastFlowIndexRef = useRef<number>(-1);
  const activeFlowItemIndex = useMemo(() => {
    const len = flowItems.length;
    if (len === 0) return -1;

    const lastIdx = lastFlowIndexRef.current;
    if (lastIdx >= 0 && lastIdx < len) {
      const cur = flowItems[lastIdx];
      const curStart = cur.type === 'line' ? cur.line.start : cur.gap.start;
      const curEnd = cur.type === 'line' ? cur.line.end : cur.gap.end;
      if (currentTime >= curStart && currentTime <= curEnd) {
        return lastIdx;
      }
      const nextIdx = lastIdx + 1;
      if (nextIdx < len) {
        const next = flowItems[nextIdx];
        const nextStart = next.type === 'line' ? next.line.start : next.gap.start;
        const nextEnd = next.type === 'line' ? next.line.end : next.gap.end;
        if (currentTime >= nextStart && currentTime <= nextEnd) {
          lastFlowIndexRef.current = nextIdx;
          return nextIdx;
        }
      }
    }

    // Binary search on jumps / seeks
    let low = 0;
    let high = len - 1;
    let best = -1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const item = flowItems[mid];
      const itemStart = item.type === 'line' ? item.line.start : item.gap.start;
      if (itemStart <= currentTime) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    lastFlowIndexRef.current = best;
    return best;
  }, [flowItems, currentTime]);

  const activeLineIndex = useMemo(() => {
    if (activeFlowItemIndex < 0 || activeFlowItemIndex >= flowItems.length) return -1;
    const item = flowItems[activeFlowItemIndex];
    if (item.type === 'line') return item.idx;
    return -1;
  }, [flowItems, activeFlowItemIndex]);

  // ── Stage Typography (Default Poppins 500) ─────────────────────────────
  const stageFontFamily = 'poppins';
  const stageFontWeight = '500';
  const stageFontStack = buildStageFontStack(stageFontFamily);
  const stageWeight = stageFontWeightValue(stageFontWeight);

  useEffect(() => {
    ensureStageFontLoaded(stageFontFamily);
  }, []);

  const stageTextStyle: React.CSSProperties = useMemo(() => ({
    fontFamily: stageFontStack,
    fontWeight: stageWeight,
  }), [stageFontStack, stageWeight]);

  // ── Modals & Drawers ─────────────────────────────────────────────────────
  const [isYtModalOpen, setIsYtModalOpen] = useState(false);
  const [isBgModalOpen, setIsBgModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // ── Top-Right Hover Menu (Palette) State & Outside-Click Logic ───────────
  const [isHoverMenuOpen, setIsHoverMenuOpen] = useState(false);
  const hoverMenuTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hoverMenuRef = useRef<HTMLDivElement>(null);

  const handleMenuMouseEnter = () => {
    if (hoverMenuTimerRef.current) clearTimeout(hoverMenuTimerRef.current);
    setIsHoverMenuOpen(true);
  };

  const handleMenuMouseLeave = () => {
    if (hoverMenuTimerRef.current) clearTimeout(hoverMenuTimerRef.current);
    hoverMenuTimerRef.current = setTimeout(() => {
      setIsHoverMenuOpen(false);
    }, 280);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (hoverMenuRef.current && !hoverMenuRef.current.contains(e.target as Node)) {
        setIsHoverMenuOpen(false);
      }
    };
    if (isHoverMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isHoverMenuOpen]);

  useEffect(() => {
    return () => {
      if (hoverMenuTimerRef.current) clearTimeout(hoverMenuTimerRef.current);
    };
  }, []);

  const isAnyModalOpen = isYtModalOpen || isBgModalOpen || isInfoModalOpen || isDownloadOpen || isQuickSearchOpen || isHoverMenuOpen;

  // ── Auto-Hide Header State & Logic ────────────────────────────────────────
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const hideHeaderTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scheduleHeaderHide = useCallback(() => {
    if (hideHeaderTimerRef.current) clearTimeout(hideHeaderTimerRef.current);
    hideHeaderTimerRef.current = setTimeout(() => {
      setIsHeaderVisible(false);
    }, 3500);
  }, []);

  const handleHeaderUserActivity = useCallback(() => {
    setIsHeaderVisible(true);
    if (!isHeaderHovered && !isAnyModalOpen) {
      scheduleHeaderHide();
    }
  }, [isHeaderHovered, isAnyModalOpen, scheduleHeaderHide]);

  useEffect(() => {
    const onActivity = () => handleHeaderUserActivity();
    window.addEventListener('mousemove', onActivity);
    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('touchstart', onActivity);
    window.addEventListener('keydown', onActivity);
    window.addEventListener('wheel', onActivity, { passive: true });
    window.addEventListener('scroll', onActivity, { passive: true });

    scheduleHeaderHide();

    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('touchstart', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('wheel', onActivity);
      window.removeEventListener('scroll', onActivity);
      if (hideHeaderTimerRef.current) clearTimeout(hideHeaderTimerRef.current);
    };
  }, [handleHeaderUserActivity, scheduleHeaderHide]);

  useEffect(() => {
    if (isAnyModalOpen || isHeaderHovered) {
      setIsHeaderVisible(true);
      if (hideHeaderTimerRef.current) clearTimeout(hideHeaderTimerRef.current);
    } else {
      scheduleHeaderHide();
    }
  }, [isAnyModalOpen, isHeaderHovered, scheduleHeaderHide]);

  // ── Curvy S-Curve Scrubber Engine (Matching Reference) ────────────────────
  const CURVE_PATH_D = 'M 15 35 C 80 58, 140 50, 200 30 C 260 10, 320 12, 385 35';
  const curvePathRef = useRef<SVGPathElement>(null);
  const scrubberContainerRef = useRef<HTMLDivElement>(null);
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

  // ── Auto-scroll Follow Along Engine (Studio Dynamic Flow Sequential Mode) ──
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLineElemRef = useRef<HTMLDivElement>(null);
  const lastScrolledFlowIndexRef = useRef<number>(-1);

  // ── Vertical Line Slider (Right Edge) Drag & Smooth Seek Engine ──────────
  const verticalRailRef = useRef<HTMLDivElement>(null);
  const [isVerticalDragging, setIsVerticalDragging] = useState(false);

  useEffect(() => {
    if (!followAlong || displayMode !== 'synced' || isVerticalDragging) return;

    if (activeLineElemRef.current) {
      const sequential = activeFlowItemIndex === lastScrolledFlowIndexRef.current + 1;
      lastScrolledFlowIndexRef.current = activeFlowItemIndex;
      activeLineElemRef.current.scrollIntoView({
        behavior: sequential ? 'auto' : 'smooth',
        block: 'center',
      });
    }
  }, [activeFlowItemIndex, followAlong, displayMode, isVerticalDragging]);

  // ── Seek Controls ────────────────────────────────────────────────────────
  const handleSeek = useCallback((seconds: number) => {
    const target = Math.max(0, Math.min(seconds, duration));
    setCurrentTime(target);
    setSeekTrigger({ time: target, timestamp: Date.now() });
  }, [duration]);

  const handleVerticalSeek = useCallback(
    (clientY: number) => {
      if (!verticalRailRef.current || duration <= 0) return;
      const rect = verticalRailRef.current.getBoundingClientRect();
      if (rect.height <= 0) return;
      const pct = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const targetTime = pct * duration;
      handleSeek(targetTime);

      // Smoothly scroll the lyrics container directly to match the drag position
      if (lyricsContainerRef.current) {
        const scrollableHeight = lyricsContainerRef.current.scrollHeight - lyricsContainerRef.current.clientHeight;
        if (scrollableHeight > 0) {
          lyricsContainerRef.current.scrollTop = pct * scrollableHeight;
        }
      }
    },
    [duration, handleSeek]
  );

  const handleVerticalMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsVerticalDragging(true);
    handleVerticalSeek(e.clientY);

    const onMouseMove = (moveEvent: MouseEvent) => {
      handleVerticalSeek(moveEvent.clientX ? moveEvent.clientY : moveEvent.clientY);
    };

    const onMouseUp = () => {
      setIsVerticalDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleVerticalTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsVerticalDragging(true);
    const touch = e.touches[0];
    if (touch) handleVerticalSeek(touch.clientY);

    const onTouchMove = (moveEvent: TouchEvent) => {
      const t = moveEvent.touches[0];
      if (t) handleVerticalSeek(t.clientY);
    };

    const onTouchEnd = () => {
      setIsVerticalDragging(false);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };

    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
  };

  const handleCurvySeek = useCallback(
    (clientX: number) => {
      if (!scrubberContainerRef.current) return;
      const rect = scrubberContainerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const rawRatio = (clientX - rect.left) / rect.width;
      // Map across curve endpoints (x=15 to x=385 on 400-wide viewBox)
      const curveStart = 15 / 400;
      const curveEnd = 385 / 400;
      const ratio = Math.max(0, Math.min(1, (rawRatio - curveStart) / (curveEnd - curveStart)));
      const targetTime = ratio * duration;
      handleSeek(targetTime);
    },
    [duration, handleSeek]
  );

  const handleScrubberMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsScrubbing(true);
    handleCurvySeek(e.clientX);

    const onMouseMove = (moveEvent: MouseEvent) => {
      handleCurvySeek(moveEvent.clientX);
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
    if (touch) handleCurvySeek(touch.clientX);

    const onTouchMove = (moveEvent: TouchEvent) => {
      const t = moveEvent.touches[0];
      if (t) handleCurvySeek(t.clientX);
    };

    const onTouchEnd = () => {
      setIsScrubbing(false);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };

    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
  };

  const handlePrevLine = () => {
    if (!doc.lines || doc.lines.length === 0) return;
    const prevIdx = Math.max(0, activeLineIndex - 1);
    handleSeek(doc.lines[prevIdx].start);
  };

  const handleNextLine = () => {
    if (!doc.lines || doc.lines.length === 0) return;
    const nextIdx = Math.min(doc.lines.length - 1, activeLineIndex + 1);
    handleSeek(doc.lines[nextIdx].start);
  };

  // ── Sync Delay Nudge ─────────────────────────────────────────────────────
  const nudgeOffset = (delta: number) => {
    setSyncOffset((prev) => {
      const next = Math.round((prev + delta) * 10) / 10;
      if (youtubeVideoId) {
        saveStoredOffset(youtubeVideoId, next);
      }
      showToast(`Sync Offset: ${next > 0 ? `+${next}` : next}s`);
      return next;
    });
  };

  // ── Copy Full Lyrics ─────────────────────────────────────────────────────
  const handleCopyLyrics = async () => {
    const text = doc.lines?.map((l) => l.text).join('\n') || '';
    try {
      await navigator.clipboard.writeText(text);
      showToast('Lyrics copied to clipboard!');
    } catch {
      showToast('Failed to copy lyrics');
    }
  };

  // ── Share Link ───────────────────────────────────────────────────────────
  const handleShare = async () => {
    const params = new URLSearchParams();
    if (doc.metadata.canonicalKey) {
      params.set('id', doc.metadata.canonicalKey);
    } else if (doc.metadata.isrc) {
      params.set('id', `lrcred_${doc.metadata.isrc}`);
    } else {
      params.set('q', `${doc.metadata.artist} ${doc.metadata.title}`);
    }

    if (doc.metadata.title) params.set('title', doc.metadata.title);
    if (doc.metadata.artist) params.set('artist', doc.metadata.artist);
    if (coverArt) params.set('cover', coverArt);
    if (youtubeVideoId) params.set('yt', youtubeVideoId);

    const basePath = isKaraokeMode ? '/karaoke' : '/lyrics';
    const shareUrl = `${window.location.origin}${basePath}?${params.toString()}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Shareable link copied to clipboard!');
    } catch {
      showToast('Link copied');
    }
  };

  // ── Download Handlers ────────────────────────────────────────────────────
  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsDownloadOpen(false);
    showToast(`Downloaded ${filename}`);
  };

  const handleDownloadLrc = () => {
    let lrc = `[ti:${doc.metadata.title}]\n[ar:${doc.metadata.artist}]\n`;
    if (doc.metadata.album) lrc += `[al:${doc.metadata.album}]\n`;
    doc.lines.forEach((l) => {
      const min = Math.floor(l.start / 60).toString().padStart(2, '0');
      const sec = Math.floor(l.start % 60).toString().padStart(2, '0');
      const ms = Math.floor((l.start % 1) * 100).toString().padStart(2, '0');
      lrc += `[${min}:${sec}.${ms}]${l.text}\n`;
    });
    const safeName = `${doc.metadata.artist} - ${doc.metadata.title}.lrc`.replace(/[\\/]/g, '_');
    downloadFile(lrc, safeName, 'text/plain;charset=utf-8');
  };

  const handleDownloadTxt = () => {
    const txt = doc.lines.map((l) => l.text).join('\n');
    const safeName = `${doc.metadata.artist} - ${doc.metadata.title}.txt`.replace(/[\\/]/g, '_');
    downloadFile(txt, safeName, 'text/plain;charset=utf-8');
  };

  const handleDownloadJson = () => {
    const json = JSON.stringify(doc, null, 2);
    const safeName = `${doc.metadata.artist} - ${doc.metadata.title}.json`.replace(/[\\/]/g, '_');
    downloadFile(json, safeName, 'application/json;charset=utf-8');
  };

  // ── Keyboard Shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickSearchOpen(true);
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (isCalibratingFirstLine) {
          handleExecuteCalibration();
        } else {
          setIsPlaying((p) => !p);
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSeek(currentTime - 5);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSeek(currentTime + 5);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        handlePrevLine();
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        handleNextLine();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, syncOffset, handleSeek, activeLineIndex, isCalibratingFirstLine, handleExecuteCalibration]);

  // Line count stats
  const lineCount = doc.lines?.length || 0;
  const hasWordSync = doc.lines?.some((l) => l.tokens && l.tokens.length > 0);

  return (
    <div
      className="relative min-h-screen flex flex-col text-white selection:bg-white/20 selection:text-white bg-[#0a090e]"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {/* ── Background Layer: Fluid Kawarp or Selected Preset ───────────────── */}
      {!transparentBackdrop && (
        bgConfig.type === 'custom-link' && bgConfig.customUrl ? (
          /\.(mp4|webm|mov)(\?.*)?$/i.test(bgConfig.customUrl) ? (
            <video
              src={bgConfig.customUrl}
              autoPlay
              loop
              muted
              playsInline
              className="fixed inset-0 w-full h-full object-cover pointer-events-none z-0 transition-all duration-500"
              style={{ filter: `blur(${bgConfig.blur}px)` }}
            />
          ) : (
            <KawarpBackground
              src={bgConfig.customUrl}
              isPlaying={isPlaying}
              dim={bgConfig.dim}
              blurPasses={Math.max(4, Math.min(20, Math.round(bgConfig.blur / 2)))}
            />
          )
        ) : bgConfig.type === 'grid' ? (
          <>
            <div 
              className="fixed inset-0 pointer-events-none z-0 opacity-15"
              style={{
                backgroundImage: 'radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            />
            <div 
              className="fixed inset-0 bg-black pointer-events-none z-0 transition-opacity duration-300"
              style={{ opacity: bgConfig.dim }}
            />
          </>
        ) : bgConfig.type === 'pitch-black' ? (
          <div className="fixed inset-0 bg-black pointer-events-none z-0" />
        ) : bgConfig.type === 'obsidian' ? (
          <div className="fixed inset-0 bg-[#09090b] pointer-events-none z-0" />
        ) : bgConfig.type === 'graphite' ? (
          <div className="fixed inset-0 bg-gradient-to-br from-[#121316] via-[#0d0e11] to-[#070709] pointer-events-none z-0" />
        ) : coverArt ? (
          /* Kawarp Fluid Animated WebGL Canvas using song's cover art URL */
          <KawarpBackground
            src={coverArt}
            isPlaying={isPlaying}
            dim={bgConfig.dim}
            warpIntensity={0.85}
            blurPasses={Math.max(4, Math.min(20, Math.round(bgConfig.blur / 2)))}
          />
        ) : (
          /* Graceful ambient fallback if cover artwork is unavailable */
          <>
            <KawarpBackground
              isPlaying={isPlaying}
              dim={bgConfig.dim}
              warpIntensity={0.6}
              blurPasses={6}
            />
          </>
        )
      )}

      {/* ── YouTube Backdrop Player (if backdrop mode selected) ──────────── */}
      {youtubeVideoId && ytDisplayMode === 'backdrop' && (
        <div 
          className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
          style={{ opacity: 0.35, filter: 'blur(4px)' }}
        >
          <YouTubeEmbedPlayer
            videoId={youtubeVideoId}
            isPlaying={isPlaying}
            displayMode="backdrop"
            isMuted={isMuted}
            volume={volume}
            syncOffset={syncOffset}
            seekTrigger={seekTrigger}
            onTimeUpdate={(t) => setCurrentTime(t)}
            onDurationChange={() => {}}
            onPlayStateChange={(p) => setIsPlaying(p)}
            onOpenFetcher={() => setIsYtModalOpen(true)}
          />
        </div>
      )}

      {/* ── Top Edge Hover Sensor (Wakes Header When Approached) ───────────── */}
      <div
        onMouseEnter={() => {
          setIsHeaderVisible(true);
          setIsHeaderHovered(true);
        }}
        onMouseMove={() => {
          setIsHeaderVisible(true);
          setIsHeaderHovered(true);
        }}
        onMouseLeave={() => {
          setIsHeaderHovered(false);
          scheduleHeaderHide();
        }}
        className="fixed top-0 left-0 right-0 h-8 z-40 pointer-events-auto"
        aria-hidden="true"
      />

      {/* ── Top Navigation Bar (Auto-Hiding Floating Header) ──────────────── */}
      <header
        onMouseEnter={() => {
          setIsHeaderHovered(true);
          setIsHeaderVisible(true);
        }}
        onMouseMove={() => {
          setIsHeaderHovered(true);
          setIsHeaderVisible(true);
        }}
        onMouseLeave={() => {
          setIsHeaderHovered(false);
          scheduleHeaderHide();
        }}
        className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 ease-in-out ${
          isHeaderVisible
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
      >
        <div className="w-full px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 h-16 flex items-center justify-between gap-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent backdrop-blur-[2px]">
          {/* Left Brand + Back Button */}
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
              {isKaraokeMode && (
                <div className="relative inline-flex items-center justify-center overflow-hidden px-2.5 py-0.5 rounded-full border border-white/15 bg-white/[0.03] text-[10px] font-sans font-medium uppercase tracking-wider text-zinc-300">
                  <span className="relative z-10 bg-gradient-to-r from-zinc-300 via-white to-zinc-300 bg-clip-text text-transparent animate-shine-text font-semibold">
                    Karaoke
                  </span>
                  <span className="absolute inset-0 pointer-events-none -translate-x-full animate-karaoke-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </div>
              )}
            </Link>
          </div>

          {/* Center Search Pill (Screenshot 4: Search ⌘K) */}
          <button
            type="button"
            onClick={() => setIsQuickSearchOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-zinc-400 hover:text-white text-xs border border-white/[0.08] transition-colors cursor-pointer shadow-sm"
          >
            <Search className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-medium">Search</span>
            <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-white/[0.06] text-zinc-500 border border-white/[0.06]">
              ⌘K
            </span>
          </button>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2">
            {/* Romaji Button (for Japanese tracks) */}
            {hasJapanese && (
              <button
                type="button"
                onClick={toggleRomaji}
                className={`p-2 rounded-xl text-xs font-sans transition-colors cursor-pointer border ${
                  isRomajiActive
                    ? 'bg-white text-zinc-950 border-white font-medium shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.06] border-transparent hover:border-white/[0.08]'
                }`}
                title="Toggle Japanese Romaji"
              >
                <span>Romaji</span>
              </button>
            )}

            {/* Roman Hindi Button (for Hindi tracks) */}
            {hasHindi && (
              <button
                type="button"
                onClick={toggleRomanHindi}
                className={`p-2 rounded-xl text-xs font-sans transition-colors cursor-pointer border ${
                  isRomanHindiActive
                    ? 'bg-amber-400 text-zinc-950 border-amber-400 font-medium shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.06] border-transparent hover:border-white/[0.08]'
                }`}
                title="Toggle Roman Hindi"
              >
                <span>Roman Hindi</span>
              </button>
            )}

            {/* Roman Korean Button (for Korean tracks) */}
            {hasKorean && (
              <button
                type="button"
                onClick={toggleKoreanRoman}
                className={`p-2 rounded-xl text-xs font-sans transition-colors cursor-pointer border ${
                  isKoreanRomanActive
                    ? 'bg-violet-400 text-zinc-950 border-violet-400 font-medium shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.06] border-transparent hover:border-white/[0.08]'
                }`}
                title="Toggle Roman Korean"
              >
                <span>Roman Korean</span>
              </button>
            )}

            {/* Mode Dropdown / Button (Auto / Synced / Plain) */}
            <div className="flex items-center bg-white/[0.04] p-0.5 rounded-full border border-white/[0.08]">
              <button
                type="button"
                onClick={() => setDisplayMode('synced')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  displayMode === 'synced'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Synced
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('plain')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  displayMode === 'plain'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Plain
              </button>
            </div>

            {/* Audio Sync Offset Calibrator & Delay Button */}
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer border flex items-center gap-1.5 ${
                syncOffset !== 0
                  ? 'bg-white/10 text-white border-white/20 shadow-sm'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white border-white/[0.08]'
              }`}
              title="Audio Sync Offset (Align Instrumental Intro)"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="tabular-nums font-mono text-[11px]">
                {syncOffset !== 0 ? (syncOffset > 0 ? `+${syncOffset.toFixed(1)}s` : `${syncOffset.toFixed(1)}s`) : 'Sync'}
              </span>
            </button>

            {/* Download Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDownloadOpen((p) => !p)}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer border border-transparent hover:border-white/[0.08]"
                title="Download Lyrics"
              >
                <Download className="w-4 h-4" />
              </button>

              {isDownloadOpen && (
                <div 
                  className="absolute right-0 mt-2 w-48 bg-[#121216] border border-white/10 rounded-xl shadow-2xl p-1 z-40 space-y-0.5 text-xs animate-in fade-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={handleDownloadLrc}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-zinc-200 hover:text-white transition-colors cursor-pointer"
                  >
                    Download .LRC (Synced)
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadTxt}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-zinc-200 hover:text-white transition-colors cursor-pointer"
                  >
                    Download .TXT (Plain)
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadJson}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-zinc-200 hover:text-white transition-colors cursor-pointer"
                  >
                    Download .JSON (OpenLyrics)
                  </button>
                </div>
              )}
            </div>

            {/* Top-Right Hover Menu (Palette Button) */}
            <div
              ref={hoverMenuRef}
              className="relative"
              onMouseEnter={handleMenuMouseEnter}
              onMouseLeave={handleMenuMouseLeave}
            >
              <button
                type="button"
                onClick={() => setIsHoverMenuOpen((p) => !p)}
                className={`p-2 rounded-xl transition-all cursor-pointer border ${
                  isHoverMenuOpen
                    ? 'bg-white/10 text-white border-white/20 shadow-lg'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.06] border-transparent hover:border-white/[0.08]'
                }`}
                title="Controls & Customization"
                aria-label="Controls & Customization"
              >
                <Palette className="w-4 h-4" />
              </button>

              {isHoverMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-80 bg-[#121216]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-3 z-50 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Background Customizer Shortcut */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsBgModalOpen(true);
                      setIsHoverMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-200 hover:text-white transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Palette className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                      <span className="font-medium text-xs">Background Backdrop</span>
                    </div>
                    <span className="text-[11px] text-zinc-400 group-hover:text-zinc-200">Customize</span>
                  </button>

                  {/* Audio Sync Offset Shortcut */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSyncModalOpen(true);
                      setIsHoverMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-200 hover:text-white transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <SlidersHorizontal className="w-4 h-4 text-zinc-300 group-hover:scale-110 transition-transform" />
                      <span className="font-medium text-xs">Audio Sync Offset</span>
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-zinc-400 group-hover:text-zinc-200">
                      {syncOffset > 0 ? `+${syncOffset.toFixed(2)}s` : `${syncOffset.toFixed(2)}s`}
                    </span>
                  </button>

                  {/* YouTube Play Along Source Pill & Fetcher Trigger */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center gap-2 min-w-0">
                      <div>

                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] text-zinc-400 uppercase tracking-wider font-medium">
                          Audio Source
                        </div>
                        <div className="text-[11px] font-medium text-zinc-200 truncate max-w-[130px]">
                          {youtubeVideoId ? 'YouTube' : 'Master Clock'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsYtModalOpen(true);
                        setIsHoverMenuOpen(false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium transition-colors shrink-0 cursor-pointer"
                    >
                      {youtubeVideoId ? 'Change' : 'Fetch'}
                    </button>
                  </div>

                  {/* Follow along pill + Quick Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setFollowAlong((p) => !p)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                        followAlong
                          ? 'bg-white text-zinc-950 border-white font-medium shadow-sm'
                          : 'bg-white/[0.04] text-zinc-400 border-white/[0.08] hover:text-white'
                      }`}
                    >
                      <span>Follow along</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleCopyLyrics}
                        className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/[0.06] transition-colors cursor-pointer"
                        title="Copy Lyrics"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleShare}
                        className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/[0.06] transition-colors cursor-pointer"
                        title="Share Song Link"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Utility Row: Sync Offset Delay + Aa Font Size + Info */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.08] text-xs text-zinc-400">
                    <div className="flex items-center gap-1 bg-white/[0.04] px-2 py-1 rounded-lg border border-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => nudgeOffset(-0.1)}
                        className="px-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        title="Delay -0.1s"
                      >
                        —
                      </button>
                      <span className="text-zinc-200 tabular-nums text-[11px] px-0.5">
                        {syncOffset > 0 ? `+${syncOffset.toFixed(1)}s` : `${syncOffset.toFixed(1)}s`}
                      </span>
                      <button
                        type="button"
                        onClick={() => nudgeOffset(0.1)}
                        className="px-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        title="Delay +0.1s"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsInfoModalOpen(true);
                          setIsHoverMenuOpen(false);
                        }}
                        className="p-1.5 rounded-lg hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                        title="Track Info"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cycleFontSize}
                        className="px-2 py-1 rounded-lg hover:text-white hover:bg-white/[0.06] font-medium text-xs transition-colors cursor-pointer"
                        title={`Font Size: ${fontSize.toUpperCase()}`}
                      >
                        Aa
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Layout: Split Screen (Full Bleed Edge-to-Edge) ───────────── */}
      <div className="relative z-10 flex-1 w-full px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 pt-20 sm:pt-24 pb-6 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-14 items-start">
        {/* ── LEFT COLUMN: Sticky Track Card & Scrubber (Centered) ────────── */}
        <aside 
          className="lg:col-span-5 xl:col-span-4 2xl:col-span-3 lg:sticky lg:top-[16vh] flex flex-col gap-6 max-w-[360px] xl:max-w-[380px] w-full shrink-0 pt-4 lg:pt-8"
        >
          {/* Artwork & Video Player Card: directly shows video if available */}
          <div className="relative w-full max-w-[360px] xl:max-w-[380px] aspect-square rounded-2xl overflow-hidden bg-zinc-950 border border-white/10 shadow-2xl group">
            {youtubeVideoId && ytDisplayMode === 'side' ? (
              <div className="w-full h-full bg-black">
                <YouTubeEmbedPlayer
                  videoId={youtubeVideoId}
                  isPlaying={isPlaying}
                  displayMode="side"
                  isMuted={isMuted}
                  volume={volume}
                  syncOffset={syncOffset}
                  seekTrigger={seekTrigger}
                  onTimeUpdate={(t) => setCurrentTime(t)}
                  onDurationChange={() => {}}
                  onPlayStateChange={(p) => setIsPlaying(p)}
                  onOpenFetcher={() => setIsYtModalOpen(true)}
                />
              </div>
            ) : coverArt && !coverArtError ? (
              <img
                src={coverArt}
                alt={doc.metadata.title}
                onError={() => setCoverArtError(true)}
                className="w-full h-full object-cover select-none"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-600">
                <Disc className="w-20 h-20 mb-2 stroke-[1.2]" />
                <span className="text-xs font-normal text-zinc-500">No Video Available</span>
              </div>
            )}

            {/* Hidden Audio-Only Player (if audio display mode) */}
            {youtubeVideoId && ytDisplayMode === 'audio' && (
              <YouTubeEmbedPlayer
                videoId={youtubeVideoId}
                isPlaying={isPlaying}
                displayMode="audio"
                isMuted={isMuted}
                volume={volume}
                syncOffset={syncOffset}
                seekTrigger={seekTrigger}
                onTimeUpdate={(t) => setCurrentTime(t)}
                onDurationChange={() => {}}
                onPlayStateChange={(p) => setIsPlaying(p)}
                onOpenFetcher={() => setIsYtModalOpen(true)}
              />
            )}
          </div>

          {/* Track Meta Details */}
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-white leading-tight">
              {doc.metadata.title}
            </h1>
            <p className="text-base font-normal text-white/70">
              {doc.metadata.artist}
            </p>
              <div>
            </div>
          </div>

          {/* ── Curvy Duration Scrubber & Primary Controls (Matching Reference) ── */}
          <div className="space-y-3 pt-1">
            {/* Curvy S-Curve Scrubber Wave */}
            <div
              ref={scrubberContainerRef}
              onMouseEnter={() => setIsScrubberHovered(true)}
              onMouseLeave={() => setIsScrubberHovered(false)}
              onMouseDown={handleScrubberMouseDown}
              onTouchStart={handleScrubberTouchStart}
              className="relative w-full cursor-pointer py-1 select-none touch-none group"
              role="slider"
              aria-label="Seek time"
              aria-valuenow={currentTime}
              aria-valuemin={0}
              aria-valuemax={duration}
            >
              <svg
                viewBox="0 0 400 60"
                className="w-full h-14 overflow-visible pointer-events-none"
                fill="none"
              >
                <defs>
                  <filter id="lyrics-knob-glow" x="-50%" y="-50%" width="200%" height="200%">
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
                  filter="url(#lyrics-knob-glow)"
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                  className="transition-[r] duration-150 ease-out"
                />
              </svg>

              {/* Timestamps: Elapsed on left, Total on right */}
              <div className="flex items-center justify-between text-xs font-normal text-zinc-400 tabular-nums px-1 -mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── RIGHT COLUMN: Studio Dynamic Flow Viewport ─────────────────── */}
        <main className="lg:col-span-7 xl:col-span-8 2xl:col-span-9 flex flex-row relative w-full items-start">
          {/* Main Dynamic Flow Lyrics Container */}
          <div 
            ref={lyricsContainerRef}
            className="flex-1 overflow-y-auto max-h-[calc(100vh-6rem)] px-4 sm:px-8 py-36 flex flex-col gap-8 items-center no-scrollbar scroll-smooth [perspective:1000px]"
          >
            {displayMode === 'synced' ? (
              flowItems.map((item, idx) => {
                const isActive = idx === activeFlowItemIndex;
                const isPast = idx < activeFlowItemIndex;

                if (item.type === 'gap') {
                  return (
                    <InstrumentalGapIndicator
                      key={item.gap.id}
                      isActive={isActive}
                      isPast={isPast}
                      start={item.gap.start}
                      end={item.gap.end}
                      onSeek={handleSeek}
                      innerRef={isActive ? activeLineElemRef : undefined}
                    />
                  );
                }

                return (
                  <FlowLineRow
                    key={item.line.id ?? `flow-${item.idx}`}
                    line={item.line}
                    words={item.words}
                    idx={item.idx}
                    isActive={isActive}
                    isPast={isPast}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                    innerRef={isActive ? activeLineElemRef : undefined}
                    textSizeClass={textSizeClasses[fontSize]}
                    stageStyle={stageTextStyle}
                  />
                );
              })
            ) : (
              /* Plain Text Mode */
              <div style={stageTextStyle} className="space-y-4 py-8 text-lg sm:text-xl leading-relaxed text-zinc-300 font-normal max-w-2xl w-full text-center">
                {doc.lines?.map((line, idx) => (
                  <p key={line.id || idx} className="hover:text-white transition-colors cursor-text">
                    {line.text}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Minimap / Scrubber Bar on Far Right Edge (Subtle Ethereal Hairline Slider) */}
          {displayMode === 'synced' && duration > 0 && (
            <div 
              ref={verticalRailRef}
              onMouseDown={handleVerticalMouseDown}
              onTouchStart={handleVerticalTouchStart}
              className={`hidden sm:flex flex-col items-center w-7 shrink-0 h-[calc(100vh-8rem)] sticky top-20 select-none ml-2 sm:ml-4 lg:ml-6 touch-none cursor-ns-resize group py-2 transition-opacity duration-500 ${
                isVerticalDragging
                  ? 'opacity-100'
                  : 'opacity-25 hover:opacity-100 focus-within:opacity-100'
              }`}
              role="slider"
              aria-label="Lyrics timeline slider"
              aria-valuenow={currentTime}
              aria-valuemin={0}
              aria-valuemax={duration}
            >
              {/* Vertical Track Rail (Delicate 2px Hairline with Soft Hover Bloom) */}
              <div className="w-[2px] group-hover:w-[3px] h-full bg-white/[0.08] group-hover:bg-white/[0.2] rounded-full relative transition-all duration-300">
                {/* Active Progress Trail */}
                <div
                  className="w-full bg-white/25 group-hover:bg-white/50 rounded-full transition-all duration-75"
                  style={{ height: `${Math.min(100, Math.max(0, (currentTime / duration) * 100))}%` }}
                />

                {/* Needle Current Time Cursor (Subtle Ethereal Micro-Pip) */}
                <div
                  className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-200 pointer-events-none ${
                    isVerticalDragging
                      ? 'w-3.5 h-2 bg-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.7)]'
                      : 'w-2 h-1 bg-white/60 group-hover:w-3 group-hover:h-1.5 group-hover:bg-white group-hover:shadow-[0_0_6px_rgba(255,255,255,0.4)]'
                  }`}
                  style={{ top: `${Math.min(100, Math.max(0, (currentTime / duration) * 100))}%` }}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Modals & Notifications ────────────────────────────────────────── */}
      {/* YouTube Fetcher Modal */}
      <YouTubeFetcherModal
        isOpen={isYtModalOpen}
        onClose={() => setIsYtModalOpen(false)}
        currentVideoId={youtubeVideoId}
        currentVideoTitle={youtubeTitle}
        currentChannelTitle={youtubeChannel}
        songTitle={doc.metadata.title}
        artistName={doc.metadata.artist}
        songDuration={doc.metadata.duration}
        displayMode={ytDisplayMode}
        onChangeDisplayMode={(mode) => setYtDisplayMode(mode)}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted((p) => !p)}
        volume={volume}
        onChangeVolume={(v) => setVolume(v)}
        onSelectVideo={(vId, meta) => {
          setYoutubeVideoId(vId);
          if (meta) {
            setYoutubeTitle(meta.title);
            setYoutubeChannel(meta.channelTitle);
          }
          showToast('Synchronized with YouTube video!');
        }}
        isKaraoke={isKaraokeMode}
      />

      {/* Background Customizer Modal */}
      <BackgroundCustomizerModal
        isOpen={isBgModalOpen}
        onClose={() => setIsBgModalOpen(false)}
        config={bgConfig}
        coverArt={coverArt}
        onSaveConfig={(cfg) => {
          onUpdateBgConfig(cfg);
          showToast('Background updated');
        }}
      />

      {/* Track Info Modal */}
      <TrackInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        doc={doc}
        coverArt={coverArt}
      />

      {/* Quick Search Modal (⌘K) */}
      <QuickSearchModal
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        onSelectSong={(hit) => {
          onSelectSong(hit);
        }}
      />

      {/* Audio Sync Offset Modal */}
      <SyncOffsetModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        syncOffset={syncOffset}
        onChangeSyncOffset={updateSyncOffset}
        onStartFirstLineCalibration={() => setIsCalibratingFirstLine(true)}
        firstLineText={firstLineText}
        firstLineTime={firstLineTime}
      />

      {/* 1-Tap First Line Calibrator Overlay */}
      {isCalibratingFirstLine && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center select-none cursor-pointer animate-in fade-in duration-150"
          onClick={handleExecuteCalibration}
          onTouchStart={handleExecuteCalibration}
          role="button"
          tabIndex={0}
          aria-label="Touch screen or press Space to sync audio"
        >
          <div className="relative z-10 max-w-md w-full flex flex-col items-center space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
              <Crosshair className="w-6 h-6 text-white" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Audio Sync
              </h2>
              <p className="text-sm text-zinc-400">
                Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-xs border border-white/15">Space</kbd> or tap anywhere when the vocals start
              </p>
            </div>

            {/* Target Line Preview */}
            <div className="w-full p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <span className="text-[11px] uppercase tracking-wider text-zinc-400 block mb-1">
                First line
              </span>
              <p className="text-base sm:text-lg font-semibold text-white">
                &ldquo;{firstLineText}&rdquo;
              </p>
              <div className="text-xs text-zinc-500 mt-1 font-mono tabular-nums">
                Expected at {firstLineTime.toFixed(1)}s
              </div>
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCalibratingFirstLine(false);
              }}
              className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Floating Calibrator Prompt (Early intro) */}
      {showIntroPrompt && !isCalibratingFirstLine && !hasDismissedPrompt && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-40 max-w-md w-[92vw] px-4 py-3 rounded-2xl bg-[#121216]/95 border border-white/15 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">
              Out of sync?
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
              Press <kbd className="px-1 py-0.2 rounded bg-white/10 text-white font-mono text-[10px] border border-white/15">Space</kbd> when vocals start
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsCalibratingFirstLine(true)}
              className="px-3 py-1.5 rounded-xl bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-colors shadow-sm cursor-pointer"
            >
              Sync
            </button>
            <button
              type="button"
              onClick={() => {
                setShowIntroPrompt(false);
                setHasDismissedPrompt(true);
              }}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              title="Dismiss"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-white text-zinc-950 font-semibold text-xs shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toastMessage}
        </div>
      )}
    </div>
  );
};
