'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type WaveSurfer from 'wavesurfer.js';
import { Edit3, Tv, Sliders, MoreHorizontal, Folder, Music, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { WaveformPlayer } from '@/components/WaveformPlayer';
import { LyricEditor } from '@/components/LyricEditor';
import { LyricRenderer } from '@/components/LyricRenderer';
import { fetchArtworkUrl } from '@/lib/artworkFetcher';
import { withChunkRecovery } from '@/lib/chunkRecovery';
// P0 perf: Full-screen sub-pages and heavy editors split dynamically for on-demand loading.
// Every one of them is wrapped in withChunkRecovery(): a stale cached document
// after a redeploy 404s on the old chunk hash, the dynamic() promise rejects,
// and (before this) the entire studio tree died with the bare Next.js
// "This page couldn't load" screen. Now that single failure costs one automatic
// reload into the current deployment, and a genuine failure falls through to
// the scoped app/studio/error.tsx boundary instead of the global one.
const TrackMetadataView = dynamic(withChunkRecovery(() => import('@/components/TrackMetadataView').then((m) => ({ default: m.TrackMetadataView })), 'Track Info'), { ssr: false });
const TimelineEditor = dynamic(withChunkRecovery(() => import('@/components/TimelineEditor').then((m) => ({ default: m.TimelineEditor })), 'Timeline'), { ssr: false });
const ClassicNLEStudio = dynamic(withChunkRecovery(() => import('@/components/ClassicNLEStudio').then((m) => ({ default: m.ClassicNLEStudio })), 'Classic Mode'), { ssr: false });
const SettingsView = dynamic(withChunkRecovery(() => import('@/components/SettingsView').then((m) => ({ default: m.SettingsView })), 'Settings'), { ssr: false });
const ProjectsView = dynamic(withChunkRecovery(() => import('@/components/ProjectsView').then((m) => ({ default: m.ProjectsView })), 'Projects'), { ssr: false });
const ExportView = dynamic(withChunkRecovery(() => import('@/components/ExportView').then((m) => ({ default: m.ExportView })), 'Export'), { ssr: false });
const ShortcutsView = dynamic(withChunkRecovery(() => import('@/components/ShortcutsView').then((m) => ({ default: m.ShortcutsView })), 'Shortcuts'), { ssr: false });
const PluginsView = dynamic(withChunkRecovery(() => import('@/components/PluginsView').then((m) => ({ default: m.PluginsView })), 'Plugins'), { ssr: false });
const MonochromeFetchModal = dynamic(withChunkRecovery(() => import('@/components/MonochromeFetchModal').then((m) => ({ default: m.MonochromeFetchModal })), 'Fetch Audio'), { ssr: false });
const RevisionHistoryView = dynamic(withChunkRecovery(() => import('@/components/RevisionHistoryView').then((m) => ({ default: m.RevisionHistoryView })), 'Revision History'), { ssr: false });
const CloudSearchView = dynamic(withChunkRecovery(() => import('@/components/CloudSearchView').then((m) => ({ default: m.CloudSearchView })), 'Cloud Search'), { ssr: false });
const PasteLyricsView = dynamic(withChunkRecovery(() => import('@/components/PasteLyricsView').then((m) => ({ default: m.PasteLyricsView })), 'Paste Lyrics'), { ssr: false });
const CollabView = dynamic(withChunkRecovery(() => import('@/components/CollabView').then((m) => ({ default: m.CollabView })), 'Collaboration'), { ssr: false });
const CloudPublishView = dynamic(withChunkRecovery(() => import('@/components/CloudPublishView').then((m) => ({ default: m.CloudPublishView })), 'Publish'), { ssr: false });
const SharePreviewView = dynamic(withChunkRecovery(() => import('@/components/SharePreviewView').then((m) => ({ default: m.SharePreviewView })), 'Share Preview'), { ssr: false });
const UnisonExplorerView = dynamic(withChunkRecovery(() => import('@/components/unison/UnisonExplorerView').then((m) => ({ default: m.UnisonExplorerView })), 'Unison Hub'), { ssr: false });
import type { SettingsCategory } from '@/components/SettingsView';
import { ProjectsModal, saveProjectToStorage, SavedProject, ACTIVE_PROJECT_ID_KEY } from '@/components/ProjectsModal';
import { CollabPresenceBar } from '@/components/CollabPresenceBar';
import { CollabCursors } from '@/components/CollabCursors';
import { NoAudioSourceModal } from '@/components/NoAudioSourceModal';
import { StudioConnectPlayer, type StudioConnectStatus } from '@/components/StudioConnectPlayer';
import { CompanionFetchModal } from '@/components/CompanionFetchModal';
import { useStudioConnect } from '@/hooks/useStudioConnect';
import { StageTimeoutError, withTimeout } from '@/lib/studioConnect/timeout';
import { checkCompanionBridge, downloadViaCompanionBridge, isCompanionPaired, setCompanionPaired } from '@/lib/companionBridge';
import { UndoToast, ToastAction } from '@/components/UndoToast';
import { StudioTaskbarDock } from '@/components/StudioTaskbarDock';
import { AmbientBackground } from '@/components/AmbientBackground';
import { YouTubeCornerEmbed } from '@/components/YouTubeCornerEmbed';
import { SoundCloudBottomEmbed } from '@/components/SoundCloudBottomEmbed';
import { SoundCloudSelectModal } from '@/components/SoundCloudSelectModal';
import { OpenLyrycLogo } from '@/components/OpenLyrycLogo';
import { AboutStudioModal } from '@/components/AboutStudioModal';
import { BpmSearchModal } from '@/components/BpmSearchModal';
import { UserProfileModal } from '@/components/profile/UserProfileModal';
import { UnisonHubModal, type UnisonSelectedSong } from '@/components/unison/UnisonHubModal';
import { UnisonSubmitModal } from '@/components/unison/UnisonSubmitModal';
import { BetterLyricsLogo } from '@/components/unison/BetterLyricsLogo';
import { TurnstileGate } from '@/components/security/TurnstileGate';
import { getLocalUserProfile, LocalUserProfile } from '@/lib/userProfile';
import { loadUnisonSession } from '@/lib/unison/authService';
import { AnnouncementBar } from '@/components/AnnouncementBar';
import { HistoryDrawer } from '@/components/HistoryDrawer';
import { SyncLintBadge } from '@/components/SyncLintBadge';
import { SyncOffsetHud } from '@/components/SyncOffsetHud';
import { lintDocument, autoFixGaps, autoFixAllIssues, autoFixSingleIssue } from '@/lib/syncLinter';
import { useAudioClock } from '@/hooks/useAudioClock';
import {
  useEditorState,
  isJapaneseText,
  isHindiText,
  isKoreanText,
  detectAllIndicLanguages,
  INDIC_LANGUAGES,
  IndicLanguageCode,
} from '@/hooks/useEditorState';
import { useKeybindings } from '@/hooks/useKeybindings';
import { useCollabRoom } from '@/hooks/useCollabRoom';
import { PartyStageConfig, PartyPlaybackState, CollabSongChange } from '@/types/collab';
import { resolveTrackLyrics } from '@/lib/lyricsResolver';
import { exportLRC, parseLRC } from '@/lib/lrcParser';
import { exportJSON } from '@/lib/jsonExporter';
import { parseTTML } from '@/lib/ttmlParser';
import { exportTTML } from '@/lib/ttmlSerializer';
import { extractColorsFromImage, generateHarmonicPalette, ColorPalette } from '@/lib/colorExtractor';
import { generateAudioFingerprint } from '@/lib/audioFingerprint';
import { fetchBestYouTubeMatchId } from '@/lib/youtubeAutoDetector';
import { fetchBestSoundCloudMatch } from '@/lib/soundcloudAutoDetector';
import { useRuntimeMode } from '@/hooks/useRuntimeMode';
import { WelcomeModeScreen } from '@/components/WelcomeModeScreen';
import { RuntimeModeSwitcher } from '@/components/RuntimeModeSwitcher';
import { CloudflareModeFrame } from '@/components/CloudflareModeFrame';
import { InteractiveTutorial } from '@/components/InteractiveTutorial';
import { getHoldMyHandTutorialDocument, TUTORIAL_STORAGE_KEY, TutorialStep } from '@/lib/tutorialData';
import { AppBackdrop } from '@/components/AppBackdrop';
import {
  isBackdropMediaFile,
  persistBackdropMedia,
  getActiveAppBackdrop,
  clearAppBackdropBlob,
} from '@/lib/appBackdrop';
import { ViewTab, RendererViewMode } from '@/types/editor';
import { SongSearchResult, OpenLyricsDocument } from '@/types/lyrics';
import { AppSettings, DEFAULT_SETTINGS, VideoDisplayMode } from '@/types/settings';
import { buildInterfaceFontStack, ensureInterfaceFontLoaded } from '@/lib/interfaceFonts';
import { useBreakReminder } from '@/hooks/useBreakReminder';
import { BreakReminderOverlay } from '@/components/BreakReminderOverlay';
import { hasActiveStreamResolvers, hasActiveSearchProviders, resolveStreamWithPlugins } from '@/lib/plugins/pluginManager';
import type { FetchedTrackMeta } from '@/components/MonochromeFetchModal';

// Feature flag: plugin system temporarily parked (unclickable + unopenable).
// Flip back to true to restore Plugins & Fetch Audio entry points.
const PLUGINS_ENABLED = false;

// P1 perf: O(1) temporal-locality + O(log N) binary-search active line locator.
// Sequential playback (the common case) hits the fast path; seeks fall back to
// binary search. Replaces the per-tick O(N) linear scan (same algorithm as
// LyricRenderer's locator, kept local to avoid importing from a component module).
function findActiveLineIndex(
  lines: { start: number }[],
  time: number,
  hintIndex: number
): number {
  const len = lines.length;
  if (len === 0) return -1;
  if (hintIndex >= 0 && hintIndex < len) {
    if (time >= lines[hintIndex].start && (hintIndex === len - 1 || time < lines[hintIndex + 1].start)) {
      return hintIndex;
    }
    const nextIdx = hintIndex + 1;
    if (nextIdx < len && time >= lines[nextIdx].start && (nextIdx === len - 1 || time < lines[nextIdx + 1].start)) {
      return nextIdx;
    }
  }
  let low = 0;
  let high = len - 1;
  let best = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].start <= time) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (best === -1) return time < lines[0].start ? 0 : len - 1;
  return best;
}

export type StudioHashView =
  | 'editor'
  | 'stage'
  | 'projects'
  | 'export'
  | 'settings'
  | 'shortcuts'
  | 'plugins'
  | 'revisions'
  | 'search'
  | 'paste'
  | 'collab'
  | 'publish'
  | 'share'
  | 'metadata'
  | 'unison';

export function parseStudioHash(hashStr: string): StudioHashView {
  const clean = (hashStr || '').replace(/^#/, '').split('&')[0].toLowerCase().trim();
  switch (clean) {
    case 'stage':
    case 'preview':
    case 'performance':
      return 'stage';
    case 'projects':
      return 'projects';
    case 'metadata':
      case 'track':
      case 'info':
      case 'track-info':
        return 'metadata';
      case 'export':
        return 'export';
      case 'settings':
      case 'preferences':
        return 'settings';
      case 'shortcuts':
      case 'keybindings':
        return 'shortcuts';
      case 'plugins':
      case 'addons':
        return 'plugins';
      case 'revisions':
      case 'history':
        return 'revisions';
      case 'search':
      case 'catalog':
      case 'cloud-search':
        return 'search';
      case 'paste':
      case 'import-text':
        return 'paste';
      case 'collab':
      case 'collaboration':
        return 'collab';
      case 'publish':
        return 'publish';
      case 'share':
        return 'share';
      case 'unison':
      case 'unison-hub':
      case 'curators':
      case 'leaderboard':
      case 'betterlyrics':
        return 'unison';
    case 'editor':
    default:
      return 'editor';
  }
}

export default function OpenLyricsSyncEngine() {
  const [wavesurfer, setWavesurfer] = useState<WaveSurfer | null>(null);

  // Runtime mode: Offline (max perf, local) vs Cloudflare Live (latest website).
  // Dormant on the production website — active only inside the Tauri desktop shell.
  const { mode: runtimeMode, isReady: isRuntimeReady, isTauri: isDesktopApp, selectMode: selectRuntimeMode } = useRuntimeMode();
  const [isModeDialogOpen, setIsModeDialogOpen] = useState<boolean>(false);
  const showModeUI = isRuntimeReady && isDesktopApp;

  // App & Performance Settings with LocalStorage persistence
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const interfaceFontStack = useMemo(
    () => buildInterfaceFontStack(settings.interfaceFontFamily ?? 'geist'),
    [settings.interfaceFontFamily]
  );

  useEffect(() => {
    ensureInterfaceFontLoaded(settings.interfaceFontFamily ?? 'geist');
  }, [settings.interfaceFontFamily]);

  const activeBackdropObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('openlyrics_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.stageFontFamily || parsed.stageFontFamily === 'default') {
          parsed.stageFontFamily = 'poppins';
        }
        if (!parsed.stageFontWeight || parsed.stageFontWeight === 'auto') {
          parsed.stageFontWeight = '500';
        }
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      // ignore
    }

    // Rehydrate persistent backdrop Blob from Dexie (consistent for images & videos)
    getActiveAppBackdrop()
      .then((backdrop) => {
        if (backdrop && backdrop.url) {
          if (activeBackdropObjectUrlRef.current) {
            try { URL.revokeObjectURL(activeBackdropObjectUrlRef.current); } catch {}
          }
          activeBackdropObjectUrlRef.current = backdrop.url;
          setSettings((prev) => ({
            ...prev,
            appBackdropUrl: backdrop.url,
            appBackdropType: backdrop.mediaType,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const handleUpdateSettings = useCallback((partial: Partial<AppSettings>) => {
    if (
      partial.appBackdropUrl === '' ||
      (partial.appBackdropUrl && !partial.appBackdropUrl.startsWith('blob:'))
    ) {
      void clearAppBackdropBlob();
      if (activeBackdropObjectUrlRef.current && partial.appBackdropUrl === '') {
        try { URL.revokeObjectURL(activeBackdropObjectUrlRef.current); } catch {}
        activeBackdropObjectUrlRef.current = null;
      }
    }
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('openlyrics_settings', JSON.stringify(next));
        } catch (e) {
          // ignore
        }
      }
      return next;
    });
  }, []);

  const {
    document: doc,
    historyLog,
    canUndo,
    canRedo,
    lastHistoryAction,
    undo,
    redo,
    setDocument,
    clearDocument,
    applyRemoteDocument,
    setLineStart,
    setLineEnd,
    setLineTiming,
    setLineLayer,
    reorderLines,
    updateLineText,
    addLine,
    deleteLine,
    divideLineIntoWords,
    divideAllLines,
    tokenizeLine,
    updateWordTokens,
    setWordToken,
    setWordTokenText,
    removeWordTokens,
    toggleWordEmphasis,
    toggleLineEmphasis,
    batchTokenizeAll,
    updateMetadata,
    setLineVocalist,
    convertToRomaji,
    convertToRomanHindi,
    convertToKoreanRoman,
    convertToIndicRoman,
    shiftAllTimestamps,
    bakeOffsetIntoTimestamps,
  } = useEditorState();

  const lintIssues = useMemo(() => lintDocument(doc), [doc]);

  const [externalPlaybackTime, setExternalPlaybackTime] = useState<number>(0);
  const [isExternalPlaying, setIsExternalPlaying] = useState<boolean>(false);
  const [audioSourceMode, setAudioSourceMode] = useState<'stream' | 'yt' | 'sc' | 'connect' | 'local' | 'none'>('yt');
  const [currentAudioFile, setCurrentAudioFile] = useState<File | null>(null);
  const [resolvedStreamUrl, setResolvedStreamUrl] = useState<string | null>(null);
  const [isResolvingStream, setIsResolvingStream] = useState<boolean>(false);
  const [isResolvingSoundCloud, setIsResolvingSoundCloud] = useState<boolean>(false);
  const [isResolvingConnect, setIsResolvingConnect] = useState<boolean>(false);
  const [hasStreamResolver, setHasStreamResolver] = useState<boolean>(false);
  const [hasSearchProvider, setHasSearchProvider] = useState<boolean>(false);
  const [isMonoModalOpen, setIsMonoModalOpen] = useState<boolean>(false);
  const [isCompanionOnline, setIsCompanionOnline] = useState<boolean>(false);
  const [isCompanionModalOpen, setIsCompanionModalOpen] = useState<boolean>(false);
  // OpenLyryc Studio Connect (browser extension): detection + engine status
  const { available: isConnectAvailable } = useStudioConnect();
  const [connectStatus, setConnectStatus] = useState<StudioConnectStatus>('idle');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState<boolean>(false);
  const [isBpmModalOpen, setIsBpmModalOpen] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // User Profile & Unison Integration Modals
  const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState<boolean>(false);
  const [isUnisonHubModalOpen, setIsUnisonHubModalOpen] = useState<boolean>(false);
  const [isUnisonSubmitModalOpen, setIsUnisonSubmitModalOpen] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<LocalUserProfile>(getLocalUserProfile);
  const [unisonSession, setUnisonSession] = useState(loadUnisonSession);

  // Keep local user profile & unison session in sync with custom events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleProfileSync = () => {
      setUserProfile(getLocalUserProfile());
      setUnisonSession(loadUnisonSession());
    };
    window.addEventListener('openlyryc-profile-updated', handleProfileSync);
    window.addEventListener('openlyryc-unison-session-updated', handleProfileSync);
    return () => {
      window.removeEventListener('openlyryc-profile-updated', handleProfileSync);
      window.removeEventListener('openlyryc-unison-session-updated', handleProfileSync);
    };
  }, []);

  // Adjustable Split View Proportion & Drag State
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingSplitRef = useRef<boolean>(false);
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);

  // Collapsible Studio Taskbar Dock State (Ctrl+B)
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('openlyryc:dock-collapsed') === 'true';
      } catch {}
    }
    return false;
  });

  const toggleDock = useCallback(() => {
    setIsDockCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('openlyryc:dock-collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  const [isTimelineOpen, setIsTimelineOpen] = useState<boolean>(false);
  const [activeToast, setActiveToast] = useState<ToastAction | null>(null);

  // Automatically pop up Undo/Redo notification on history micro-movements
  useEffect(() => {
    if (!lastHistoryAction) return;

    if (lastHistoryAction.type === 'undo') {
      setActiveToast({
        id: `undo-${lastHistoryAction.timestamp}`,
        message: `Undo ${lastHistoryAction.description}`,
        actionType: 'undo',
        onRevert: redo,
        durationMs: 4200,
      });
    } else if (lastHistoryAction.type === 'redo') {
      setActiveToast({
        id: `redo-${lastHistoryAction.timestamp}`,
        message: `Redo ${lastHistoryAction.description}`,
        actionType: 'redo',
        onRevert: undo,
        durationMs: 4200,
      });
    }
  }, [lastHistoryAction, redo, undo]);

  const showActionToast = useCallback(
    (
      message: string,
      onUndoAction?: (() => void) | null,
      options?: { actionType?: 'undo' | 'redo' | 'info' | 'sync'; durationMs?: number }
    ) => {
      setActiveToast({
        id: `${Date.now()}`,
        message,
        actionType: options?.actionType || 'info',
        onRevert: onUndoAction === null ? undefined : (onUndoAction || undo),
        durationMs: options?.durationMs ?? 4200,
      });
    },
    [undo]
  );

  const hasJapaneseLyrics = useMemo(
    () => doc.lines.some((l) => isJapaneseText(l.text)),
    [doc.lines]
  );

  const handleConvertToRomaji = useCallback(() => {
    convertToRomaji();
    showActionToast('Converted Japanese lyrics to Romaji');
  }, [convertToRomaji, showActionToast]);

  const hasHindiLyrics = useMemo(
    () => doc.lines.some((l) => isHindiText(l.text)),
    [doc.lines]
  );

  const handleConvertToRomanHindi = useCallback(() => {
    convertToRomanHindi();
    showActionToast('Converted Hindi lyrics to Roman Hindi');
  }, [convertToRomanHindi, showActionToast]);

  const hasKoreanLyrics = useMemo(
    () => doc.lines.some((l) => isKoreanText(l.text)),
    [doc.lines]
  );

  const handleConvertToKoreanRoman = useCallback(() => {
    convertToKoreanRoman();
    showActionToast('Converted Korean lyrics to Romanization');
  }, [convertToKoreanRoman, showActionToast]);

  const detectedIndicLanguages = useMemo(() => {
    const codes = detectAllIndicLanguages(doc.lines);
    return codes
      .filter((code): code is IndicLanguageCode => code in INDIC_LANGUAGES)
      .map((code) => INDIC_LANGUAGES[code]);
  }, [doc.lines]);

  const handleConvertToIndicRoman = useCallback(
    (lang?: IndicLanguageCode) => {
      convertToIndicRoman(lang);
      const name = lang && INDIC_LANGUAGES[lang] ? INDIC_LANGUAGES[lang].name : 'Indic';
      showActionToast(`Converted ${name} lyrics to Roman script`);
    },
    [convertToIndicRoman, showActionToast]
  );

  const handleDismissToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  const isApplyingRemoteRef = useRef(false);
  const prevDocJsonRef = useRef<string>(JSON.stringify(doc));

  const [songChangeNotice, setSongChangeNotice] = useState<{
    title: string;
    artist?: string;
    coverArt?: string;
    status: 'loading' | 'ready';
  } | null>(null);
  const songNoticeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleRemoteDocumentChange = useCallback(
    (remoteDoc: OpenLyricsDocument) => {
      const incomingJson = JSON.stringify(remoteDoc);
      if (incomingJson === JSON.stringify(doc)) return;

      // Detect song change from remote host document
      const isDifferentSong =
        (remoteDoc.metadata.title && remoteDoc.metadata.title !== doc.metadata.title) ||
        (remoteDoc.metadata.artist && remoteDoc.metadata.artist !== doc.metadata.artist) ||
        (remoteDoc.metadata.youtubeId && remoteDoc.metadata.youtubeId !== doc.metadata.youtubeId);

      if (isDifferentSong && (remoteDoc.metadata.title || remoteDoc.metadata.artist)) {
        if (songNoticeTimerRef.current) clearTimeout(songNoticeTimerRef.current);
        setSongChangeNotice({
          title: remoteDoc.metadata.title || 'New Track',
          artist: remoteDoc.metadata.artist,
          status: 'loading',
        });

        // Automatically fetch cover art if missing
        if (!remoteDoc.metadata.coverArt && remoteDoc.metadata.title) {
          fetchArtworkUrl(remoteDoc.metadata.artist, remoteDoc.metadata.title)
            .then((artUrl) => {
              if (artUrl) updateMetadata({ coverArt: artUrl });
            })
            .catch(() => {});
        }

        setTimeout(() => {
          setSongChangeNotice((prev) => (prev ? { ...prev, status: 'ready' } : null));
          songNoticeTimerRef.current = setTimeout(() => setSongChangeNotice(null), 3200);
        }, 600);
      }

      isApplyingRemoteRef.current = true;
      prevDocJsonRef.current = incomingJson;
      applyRemoteDocument(remoteDoc);
      // Reset after React render cycle
      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 100);
    },
    [applyRemoteDocument, doc, updateMetadata]
  );

  const processAudioFileRef = useRef<((file: File) => void) | null>(null);

  const handleRemoteStageSync = useCallback((stage: PartyStageConfig) => {
    if (stage.roomMode === 'party') {
      setViewTab('preview');
    } else if (stage.viewTab) {
      setViewTab(stage.viewTab);
    } else {
      setViewTab('preview');
    }
    if (stage.mode) {
      setRendererMode(stage.mode);
    }
    if (
      stage.fontFamily ||
      stage.fontWeight ||
      stage.colorsBeatDivision ||
      stage.colorsFontFamily ||
      stage.colorsFontSize !== undefined
    ) {
      setSettings((prev) => ({
        ...prev,
        stageFontFamily: stage.fontFamily || prev.stageFontFamily,
        stageFontWeight: stage.fontWeight || prev.stageFontWeight,
        colorsBeatDivision: stage.colorsBeatDivision || prev.colorsBeatDivision || '4',
        colorsFontFamily: stage.colorsFontFamily || prev.colorsFontFamily || 'anton',
        colorsFontSize: stage.colorsFontSize ?? prev.colorsFontSize ?? 1,
      }));
    }
    if (stage.ambientGlow !== undefined) {
      updateMetadata({ ambientGlow: stage.ambientGlow });
    }
  }, [updateMetadata]);

  const handleRemotePlaybackSync = useCallback(
    (playback: PartyPlaybackState) => {
      // 1. YouTube metadata & source mode sync
      if (playback.youtubeId) {
        if (doc.metadata.youtubeId !== playback.youtubeId) {
          updateMetadata({ youtubeId: playback.youtubeId });
        }
        if (audioSourceMode !== 'yt') {
          setAudioSourceMode('yt');
        }
      }

      // 2. Playback position & state sync (ListenTogether latency-compensated timing model)
      const now = Date.now();
      const latencySec = playback.timestamp ? Math.max(0, Math.min((now - playback.timestamp) / 1000, 2.0)) : 0;
      const expectedTime = playback.isPlaying ? playback.currentTime + latencySec : playback.currentTime;

      if (wavesurfer && (audioSourceMode === 'local' || (audioSourceMode === 'connect' && currentAudioFile))) {
        const currentLocalTime = wavesurfer.getCurrentTime();
        const drift = Math.abs(currentLocalTime - expectedTime);

        if (playback.isPlaying && !wavesurfer.isPlaying()) {
          wavesurfer.setTime(expectedTime);
          wavesurfer.play();
        } else if (!playback.isPlaying && wavesurfer.isPlaying()) {
          wavesurfer.pause();
          wavesurfer.setTime(expectedTime);
        } else if (drift > 0.65) {
          wavesurfer.setTime(expectedTime);
        }
      } else if (audioSourceMode === 'yt' || audioSourceMode === 'connect' || playback.youtubeId) {
        const drift = Math.abs(externalPlaybackTime - expectedTime);
        if (typeof window !== 'undefined') {
          if (drift > 0.65 || playback.isPlaying !== isExternalPlaying) {
            window.dispatchEvent(
              new CustomEvent('openlyryc:seek-to', {
                detail: { time: expectedTime },
              })
            );
          }
          if (playback.isPlaying !== isExternalPlaying) {
            window.dispatchEvent(
              new CustomEvent('openlyryc:toggle-play', {
                detail: { targetState: playback.isPlaying },
              })
            );
          }
        }
      }
    },
    [wavesurfer, audioSourceMode, externalPlaybackTime, isExternalPlaying, doc.metadata.youtubeId, updateMetadata]
  );

  const handleAudioFileReceived = useCallback(
    (blob: Blob, fileName: string) => {
      const file = new File([blob], fileName, { type: blob.type });
      if (processAudioFileRef.current) {
        processAudioFileRef.current(file);
      }
      showActionToast(`Loaded song: ${fileName}`, null, { actionType: 'info' });
    },
    [showActionToast]
  );

  const handleRemoteSongChange = useCallback(
    async (song: CollabSongChange) => {
      const trackTitle = song.title || 'New Track';
      const trackArtist = song.artist || '';

      // 1. Show visual indication that the host is loading a different song
      if (songNoticeTimerRef.current) clearTimeout(songNoticeTimerRef.current);
      setSongChangeNotice({
        title: trackTitle,
        artist: trackArtist,
        status: 'loading',
      });

      // 2. Sync YouTube playback source if provided
      if (song.youtubeId) {
        if (doc.metadata.youtubeId !== song.youtubeId) {
          updateMetadata({ youtubeId: song.youtubeId });
        }
        if (audioSourceMode !== 'yt') {
          setAudioSourceMode('yt');
        }
      }

      // 3. Sync metadata
      updateMetadata({
        title: trackTitle,
        artist: trackArtist,
        album: song.album || '',
        duration: song.duration || doc.metadata.duration,
        ...(song.coverArt ? { coverArt: song.coverArt } : {}),
      });

      // 4. Automatically fetch artwork if not provided
      if (!song.coverArt && trackTitle) {
        fetchArtworkUrl(trackArtist, trackTitle)
          .then((artUrl) => {
            if (artUrl) {
              updateMetadata({ coverArt: artUrl });
            }
          })
          .catch(() => {});
      }

      // 5. Automatically fetch lyrics if current document has no matching lines
      try {
        if (trackTitle && (!doc.lines || doc.lines.length === 0 || doc.metadata.title !== trackTitle)) {
          const resolved = await resolveTrackLyrics({
            title: trackTitle,
            artist: trackArtist,
            duration: song.duration,
          });

          if (resolved && resolved.lines && resolved.lines.length > 0) {
            setDocument(resolved);
          }
        }
      } catch (err) {
        console.warn('[Studio] Auto-fetch lyrics error:', err);
      } finally {
        setSongChangeNotice({
          title: trackTitle,
          artist: trackArtist,
          status: 'ready',
        });
        songNoticeTimerRef.current = setTimeout(() => {
          setSongChangeNotice(null);
        }, 3200);
      }
    },
    [doc.metadata.youtubeId, doc.metadata.duration, doc.metadata.title, doc.lines, audioSourceMode, updateMetadata, setDocument]
  );

  const collab = useCollabRoom({
    currentDocument: doc,
    onRemoteDocumentChange: handleRemoteDocumentChange,
    onStageSync: handleRemoteStageSync,
    onPlaybackSync: handleRemotePlaybackSync,
    onSongChange: handleRemoteSongChange,
    onAudioFileReceived: handleAudioFileReceived,
  });

  // Live Synced Mouse Cursor Broadcasting across Collaborators
  useEffect(() => {
    if (!collab.isConnected) return;

    let animFrame: number | null = null;
    let lastSent = 0;

    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      // Throttle cursor broadcast to ~35fps for ultra-smooth tracking with minimal bandwidth
      if (now - lastSent < 28) return;
      lastSent = now;

      if (animFrame) cancelAnimationFrame(animFrame);
      animFrame = requestAnimationFrame(() => {
        const px = Number(((e.clientX / window.innerWidth) * 100).toFixed(2));
        const py = Number(((e.clientY / window.innerHeight) * 100).toFixed(2));
        collab.updateCursor({
          x: px,
          y: py,
          vw: window.innerWidth,
          vh: window.innerHeight,
        });
      });
    };

    const handlePointerLeave = () => {
      if (animFrame) cancelAnimationFrame(animFrame);
      collab.updateCursor(null);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave);
    document.addEventListener('mouseleave', handlePointerLeave);

    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      document.removeEventListener('mouseleave', handlePointerLeave);
      collab.updateCursor(null);
    };
  }, [collab.isConnected, collab.updateCursor]);

  // Broadcast local document mutations to room peers (including Undo / Redo and metadata)
  // Listeners in Watch Party mode never broadcast edits
  const collabBroadcastTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const currentJson = JSON.stringify(doc);
    if (!collab.isConnected || isApplyingRemoteRef.current || (collab.roomMode === 'party' && !collab.isHost)) {
      prevDocJsonRef.current = currentJson;
      return;
    }

    if (prevDocJsonRef.current !== currentJson) {
      if (collabBroadcastTimerRef.current) window.clearTimeout(collabBroadcastTimerRef.current);
      collabBroadcastTimerRef.current = window.setTimeout(() => {
        collab.broadcastDocumentChange(doc);
      }, 200);
      prevDocJsonRef.current = currentJson;
    }
    return () => {
      if (collabBroadcastTimerRef.current) window.clearTimeout(collabBroadcastTimerRef.current);
    };
  }, [doc, collab.isConnected, collab.isHost, collab.roomMode, collab.broadcastDocumentChange]);

  const { rawTime, displayTime } = useAudioClock(
    wavesurfer,
    settings.framerateTarget,
    externalPlaybackTime,
    doc.metadata.offset || 0,
    0,
    audioSourceMode === 'stream' ||
      audioSourceMode === 'local' ||
      (audioSourceMode === 'connect' && Boolean(currentAudioFile))
  );

  const [isHoldSyncing, setIsHoldSyncing] = useState<boolean>(false);
  const [activeLineIndex, setActiveLineIndex] = useState<number>(0);
  const [activeTokenIndex, setActiveTokenIndex] = useState<number>(0);
  const [autoFollowPlayhead, setAutoFollowPlayhead] = useState<boolean>(true);
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [viewTab, setViewTab] = useState<ViewTab>('editor');
  const [rendererMode, setRendererMode] = useState<RendererViewMode>('flow');
  // Hidden focus preview: Ctrl/Cmd+Click the Stage canvas → the renderer takes
  // over the full viewport (opaque layer above all chrome, nothing unmounted so
  // playback/clock keep running). Esc exits. No UI hints by design.
  const [isStageFocused, setIsStageFocused] = useState<boolean>(false);

  // Capture-phase so word-level click-to-seek inside the renderer never fires:
  // stopPropagation during capture prevents the event from reaching the target.
  const handleStageFocusClickCapture = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      setIsStageFocused(true);
    }
  };

  // Esc exits focus preview. Capture-phase + stopPropagation so the existing
  // Escape shortcuts (sub-page return, keybindings) don't fire on the same press.
  useEffect(() => {
    if (!isStageFocused) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsStageFocused(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [isStageFocused]);

  // Leaving the Stage tab implicitly exits focus preview. Render-time
  // adjustment (the documented props-change pattern): no effect, no cascade —
  // React re-renders once with isStageFocused=false before paint.
  if (viewTab !== 'preview' && isStageFocused) {
    setIsStageFocused(false);
  }

  // The studio mounted from the current deployment → a previous chunk-recovery
  // reload did its job; clear the flag so the next deploy gets a fresh attempt.
  useEffect(() => {
    try {
      sessionStorage.removeItem('openlyryc:studio:chunk-reload');
    } catch {
      /* private mode — flag simply persists for the session */
    }
  }, []);
  const [activeHashView, setActiveHashView] = useState<StudioHashView>('editor');

  const navigateToHash = useCallback((target: StudioHashView) => {
    if (typeof window === 'undefined') return;
    const currentParsed = parseStudioHash(window.location.hash);
    if (currentParsed !== target) {
      if (target === 'editor') {
        if (collab.roomId) {
          const modeParam = collab.roomMode !== 'edit' ? `&mode=${collab.roomMode}` : '';
          const transportParam = collab.transport !== 'trystero' ? `&t=${collab.transport}` : '';
          window.history.pushState(null, '', `${window.location.pathname}#room=${collab.roomId}${modeParam}${transportParam}`);
        } else {
          window.history.pushState(null, '', window.location.pathname);
        }
      } else if (target === 'stage') {
        if (collab.roomId) {
          const modeParam = collab.roomMode !== 'edit' ? `&mode=${collab.roomMode}` : '';
          const transportParam = collab.transport !== 'trystero' ? `&t=${collab.transport}` : '';
          window.history.pushState(null, '', `${window.location.pathname}#stage&room=${collab.roomId}${modeParam}${transportParam}`);
        } else {
          window.location.hash = `#stage`;
        }
      } else {
        window.location.hash = `#${target}`;
      }
    }
    setActiveHashView(target);
  }, [collab.roomId, collab.roomMode, collab.transport]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleHashSync = () => {
      const parsed = parseStudioHash(window.location.hash);
      setActiveHashView(parsed);
      if (parsed === 'stage') {
        setViewTab('preview');
      }
    };
    handleHashSync();
    window.addEventListener('hashchange', handleHashSync);
    window.addEventListener('popstate', handleHashSync);
    return () => {
      window.removeEventListener('hashchange', handleHashSync);
      window.removeEventListener('popstate', handleHashSync);
    };
  }, []);

  const isWatchPartyGuest = Boolean(
    collab.isConnected &&
    (collab.roomMode === 'party' || collab.localUser?.role === 'listener') &&
    !collab.isHost
  );

  // Auto-pin Watch Party guests to fullscreen stage and close any sub-drawers
  useEffect(() => {
    if (isWatchPartyGuest) {
      if (viewTab !== 'preview') setViewTab('preview');
      if (activeHashView !== 'stage') setActiveHashView('stage');
    }
  }, [isWatchPartyGuest, viewTab, activeHashView]);

  // Return to editor view on Escape key if currently in any sub-page or watch party
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isWatchPartyGuest) {
          collab.leaveRoom();
          navigateToHash('editor');
          showActionToast('Left Watch Party', null, { actionType: 'info' });
        } else if (activeHashView !== 'editor') {
          navigateToHash('editor');
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isWatchPartyGuest, activeHashView, navigateToHash, collab.leaveRoom, showActionToast]);

  const [isYouTubeEmbedOpen, setIsYouTubeEmbedOpen] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isNoAudioModalOpen, setIsNoAudioModalOpen] = useState<boolean>(false);
  const [isSoundCloudModalOpen, setIsSoundCloudModalOpen] = useState<boolean>(false);
  const [isFreePlaybackConfirmed, setIsFreePlaybackConfirmed] = useState<boolean>(false);
  const [isFreePlaying, setIsFreePlaying] = useState<boolean>(false);
  const [loopRegion, setLoopRegion] = useState<[number, number] | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const publishDropdownRef = useRef<HTMLDivElement>(null);
  const [isPublishDropdownOpen, setIsPublishDropdownOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!isPublishDropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (publishDropdownRef.current && !publishDropdownRef.current.contains(e.target as Node)) {
        setIsPublishDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isPublishDropdownOpen]);

  // Rehydrate active project ID from storage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedId = localStorage.getItem(ACTIVE_PROJECT_ID_KEY);
      if (savedId) {
        setActiveProjectId(savedId);
      }
    } catch {}
  }, []);

  // Probe Desktop Companion Bridge daemon (:4040) conditionally
  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const probe = async () => {
      // Guard: strictly avoid probing localhost unless user explicitly paired or loaded companion audio
      if (!isCompanionPaired()) {
        if (mounted) setIsCompanionOnline(false);
        return;
      }
      const s = await checkCompanionBridge();
      if (mounted) setIsCompanionOnline(Boolean(s?.ok));
    };

    probe();
    timer = setInterval(probe, 8000);

    const onCompanionPairedChange = () => {
      probe();
    };
    window.addEventListener('openlyryc:companion-paired', onCompanionPairedChange);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
      window.removeEventListener('openlyryc:companion-paired', onCompanionPairedChange);
    };
  }, []);

  // Check URL query for audio streamed directly from Desktop Companion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const companionAudio =
        params.get('local_audio') || params.get('companion_audio') || params.get('companionStream');
      if (companionAudio) {
        setCompanionPaired(true);
        setIsCompanionOnline(true);
        setResolvedStreamUrl(companionAudio);
        setAudioSourceMode('stream');
        setIsYouTubeEmbedOpen(false);
        const titleParam = params.get('title');
        if (titleParam) {
          updateMetadata({ title: titleParam });
        }
        showActionToast('Loaded audio from Desktop Companion');
      }
    } catch {}
  }, [updateMetadata, showActionToast]);

  // Rehydrate split proportion from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('openlyryc:split-percent');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 20 && val <= 80) {
          setSplitPercent(val);
        }
      }
    } catch {}
  }, []);

  // Update cursor and selection styles on drag
  useEffect(() => {
    if (isDraggingSplit) {
      const prevCursor = document.body.style.cursor;
      const prevSelect = document.body.style.userSelect;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      return () => {
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevSelect;
      };
    }
  }, [isDraggingSplit]);

  // Global pointer listeners while dragging split divider
  useEffect(() => {
    if (!isDraggingSplit) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingSplitRef.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;

      const rawX = e.clientX - rect.left;
      const minPercent = Math.max(20, Math.min(45, (320 / rect.width) * 100));
      const maxPercent = Math.min(80, Math.max(55, ((rect.width - 280) / rect.width) * 100));

      const percent = Math.min(Math.max((rawX / rect.width) * 100, minPercent), maxPercent);
      setSplitPercent(percent);
    };

    const onPointerUp = () => {
      setIsDraggingSplit(false);
      isDraggingSplitRef.current = false;
      try {
        localStorage.setItem('openlyryc:split-percent', splitPercent.toFixed(1));
      } catch {}
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [isDraggingSplit, splitPercent]);

  const handleSplitPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsDraggingSplit(true);
    isDraggingSplitRef.current = true;
  };

  const handleSplitKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSplitPercent((prev) => {
        const next = Math.max(20, prev - 2);
        try {
          localStorage.setItem('openlyryc:split-percent', next.toFixed(1));
        } catch {}
        return next;
      });
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSplitPercent((prev) => {
        const next = Math.min(80, prev + 2);
        try {
          localStorage.setItem('openlyryc:split-percent', next.toFixed(1));
        } catch {}
        return next;
      });
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSplitPercent(25);
      try {
        localStorage.setItem('openlyryc:split-percent', '25');
      } catch {}
    } else if (e.key === 'End') {
      e.preventDefault();
      setSplitPercent(75);
      try {
        localStorage.setItem('openlyryc:split-percent', '75');
      } catch {}
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSplitPercent(50);
      try {
        localStorage.setItem('openlyryc:split-percent', '50');
      } catch {}
    }
  };

  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>('video');
  const [nleMonitorMode, setNleMonitorMode] = useState<'video' | 'stage'>('video');

  const openSettings = (category: SettingsCategory = 'video') => {
    setSettingsCategory(category);
    navigateToHash('settings');
  };

  const handleImportLyricsText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (trimmed.startsWith('<?xml') || trimmed.startsWith('<tt') || trimmed.includes('<p begin=')) {
      setDocument(parseTTML(text));
    } else if (trimmed.startsWith('{') && trimmed.includes('"lines"')) {
      try {
        const jsonDoc = JSON.parse(text);
        if (jsonDoc && Array.isArray(jsonDoc.lines)) {
          setDocument(jsonDoc);
          showActionToast('Imported OpenLyrics JSON');
          return;
        }
      } catch {}
      setDocument(parseLRC(text));
    } else {
      setDocument(parseLRC(text));
    }
    showActionToast('Imported lyrics');
  }, [setDocument, showActionToast]);

  const handleNewBlankProject = () => {
    const blankDoc: OpenLyricsDocument = {
      $schema: 'https://openlyryc.org/schema/v1.json',
      version: 1,
      metadata: { title: 'Untitled Song', artist: 'Unknown Artist', duration: 0, syncedBy: 'OpenLyryc Studio' },
      lines: [{ id: 'line_1', start: 0, end: 5, text: 'Click to edit lyrics...' }],
    };
    if (wavesurfer) {
      try {
        wavesurfer.stop();
        wavesurfer.empty();
      } catch {}
    }
    setResolvedStreamUrl(null);
    setCurrentAudioFile(null);
    setAudioSourceMode('yt');
    setExternalPlaybackTime(0);
    setIsExternalPlaying(false);
    setIsFreePlaying(false);
    setActiveLineIndex(0);
    setActiveTokenIndex(0);
    setDocument(blankDoc);
    const newId = `proj_${Date.now()}`;
    setActiveProjectId(newId);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_PROJECT_ID_KEY, newId);
    }
    saveProjectToStorage(blankDoc, 'Untitled Song', newId).catch((err) => {
      console.warn('Failed to auto-save blank project:', err);
    });
  };

  const handleSelectProject = (project: SavedProject) => {
    if (wavesurfer) {
      try {
        wavesurfer.stop();
        wavesurfer.empty();
      } catch {}
    }
    setResolvedStreamUrl(null);
    setCurrentAudioFile(null);
    if (project.document.metadata.soundcloudUrl && !project.document.metadata.youtubeId) {
      setAudioSourceMode('sc');
    } else {
      setAudioSourceMode('yt');
    }
    setExternalPlaybackTime(0);
    setIsExternalPlaying(false);
    setIsFreePlaying(false);
    setActiveLineIndex(0);
    setActiveTokenIndex(0);
    setDocument(project.document);
    setActiveProjectId(project.id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_PROJECT_ID_KEY, project.id);
    }
  };

  // Reset stream and stop wavesurfer when switching tracks
  const currentTrackKey = `${doc.metadata.youtubeId || ''}::${doc.metadata.soundcloudUrl || ''}::${doc.metadata.title || ''}::${doc.metadata.artist || ''}`;
  const prevTrackKeyRef = useRef<string>(currentTrackKey);
  // Set by processAudioFile: the key change below was CAUSED by a fresh upload,
  // so the wipe must not empty() the instance (child load effect already started
  // loading the new blob — empty() would abort it and wedge playback). Consumed once.
  const skipWipeOnceRef = useRef<boolean>(false);

  useEffect(() => {
    if (prevTrackKeyRef.current !== currentTrackKey) {
      prevTrackKeyRef.current = currentTrackKey;
      setResolvedStreamUrl(null);
      const skipWipe = skipWipeOnceRef.current;
      skipWipeOnceRef.current = false;
      if (wavesurfer) {
        try {
          wavesurfer.stop();
          // NOTE: empty() is deliberately skipped for just-uploaded files — it
          // aborts the in-flight load() (child effects run before this parent
          // effect) and leaves a 0.001s dummy with no media src, after which
          // the same file can never reload (stale lastLoadedKeyRef) and play()
          // rejects silently. stop() alone is safe: it never touches load state.
          if (!skipWipe) {
            wavesurfer.empty();
          }
        } catch {}
      }
      setExternalPlaybackTime(0);
      setIsExternalPlaying(false);
      setActiveLineIndex(0);
      setActiveTokenIndex(0);
      if (!currentAudioFile) {
        if (doc.metadata.soundcloudUrl && !doc.metadata.youtubeId) {
          setAudioSourceMode('sc');
        } else {
          setAudioSourceMode('yt');
        }
      }
    }
  }, [currentTrackKey, wavesurfer, currentAudioFile]);

  // Sync active plugin resolver capabilities on mount and route change
  useEffect(() => {
    setHasStreamResolver(hasActiveStreamResolvers());
    setHasSearchProvider(hasActiveSearchProviders());
  }, [activeHashView, isMonoModalOpen]);

  // Open the Fetch Audio modal. Prioritizes Desktop Companion Bridge daemon
  // with fallback to Monochrome provider if installed.
  const handleOpenFetchAudio = useCallback(() => {
    if (isCompanionOnline) {
      setIsCompanionModalOpen(true);
      return;
    }
    const hasProvider = hasActiveSearchProviders();
    setHasSearchProvider(hasProvider);
    if (hasProvider) {
      setIsMonoModalOpen(true);
    } else {
      setIsCompanionModalOpen(true);
    }
  }, [isCompanionOnline]);

  // Resolve direct audio stream using companion bridge or active plugins
  const resolveCurrentTrackStream = useCallback(
    async (forcePlay: boolean = false) => {
      const sourceId = doc.metadata.youtubeId;
      const title = doc.metadata.title;
      const artist = doc.metadata.artist;
      if (!sourceId && !title) return;

      setIsResolvingStream(true);
      try {
        // Desktop Companion Bridge resolution (hidden high-fidelity stream mode)
        if (isCompanionOnline || isCompanionPaired()) {
          const target = sourceId
            ? `https://www.youtube.com/watch?v=${sourceId}`
            : (artist && title ? `${artist} - ${title}` : title || artist || '');
          const res = await downloadViaCompanionBridge(target, 'opus', title);
          if (res?.ok && res.streamUrl) {
            setResolvedStreamUrl(res.streamUrl);
            setAudioSourceMode('stream');
            setIsYouTubeEmbedOpen(false);
            showActionToast('Streaming audio via Desktop Companion');
            return;
          }
        }

        const { result } = await resolveStreamWithPlugins({
          sourceId,
          youtubeId: sourceId,
          title,
          artist,
        });
        if (result?.streamUrl) {
          setResolvedStreamUrl(result.streamUrl);
          if (forcePlay || audioSourceMode === 'stream') {
            setAudioSourceMode('stream');
          }
        }
      } catch (err) {
        console.warn('[Studio] Stream resolution error:', err);
      } finally {
        setIsResolvingStream(false);
      }
    },
    [doc.metadata.youtubeId, doc.metadata.title, doc.metadata.artist, isCompanionOnline, showActionToast]
  );

  // Centralized Audio Source Mode Switcher & Disconnect Handler
  const handleAudioSourceModeChange = useCallback(
    (mode: 'stream' | 'yt' | 'sc' | 'connect' | 'local' | 'none') => {
      if (mode === 'none') {
        // Disconnect: pause all audio playback and stay in idle mode
        if (wavesurfer && wavesurfer.isPlaying()) {
          try {
            wavesurfer.pause();
          } catch {}
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('openlyryc:toggle-play', {
              detail: { isPlaying: false, play: false, state: false },
            })
          );
        }
        setIsExternalPlaying(false);
        setIsFreePlaying(false);
        setIsYouTubeEmbedOpen(false);
        setAudioSourceMode('none');
        return;
      }

      if (mode === 'yt') {
        // Switching to YouTube: pause WaveSurfer and unhide YouTube embed
        if (wavesurfer && wavesurfer.isPlaying()) {
          try {
            wavesurfer.pause();
          } catch {}
        }
        setAudioSourceMode('yt');
        setIsYouTubeEmbedOpen(true);
        return;
      }

      if (mode === 'connect') {
        // Switching to Studio Connect: pause WaveSurfer; the hidden player takes the global transport events.
        if (wavesurfer && wavesurfer.isPlaying()) {
          try {
            wavesurfer.pause();
          } catch {}
        }
        if (audioSourceMode === 'yt' && typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('openlyryc:toggle-play', {
              detail: { isPlaying: false, play: false, state: false },
            })
          );
        }
        setIsYouTubeEmbedOpen(false);
        setConnectError(null);
        setAudioSourceMode('connect');
        return;
      }

      // Switching to other source ('stream', 'sc', 'local'):
      // Automatically hide YouTube embed
      setIsYouTubeEmbedOpen(false);

      // If YouTube or Connect was playing, pause it
      if ((audioSourceMode === 'yt' || audioSourceMode === 'connect') && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('openlyryc:toggle-play', {
            detail: { isPlaying: false, play: false, state: false },
          })
        );
      }

      setAudioSourceMode(mode);

      if (mode === 'stream' && !resolvedStreamUrl) {
        resolveCurrentTrackStream(true);
      }
    },
    [wavesurfer, audioSourceMode, resolvedStreamUrl, resolveCurrentTrackStream]
  );

  // Start timing a community song chosen from Unison Hub
  const handleStartTimingUnisonSong = useCallback(
    (selectedSong: UnisonSelectedSong) => {
      const trackTitle = selectedSong.song || 'Untitled Track';
      const artistName = selectedSong.artist || 'Unknown Artist';
      const ytId = selectedSong.videoId || undefined;
      const coverArt = selectedSong.thumbnailUrl || undefined;

      // 1. If song comes with lyrics, import them or set up initial doc
      if (selectedSong.initialLyrics && selectedSong.initialLyrics.trim().length > 0) {
        const trimmed = selectedSong.initialLyrics.trim();
        if (trimmed.startsWith('<?xml') || trimmed.startsWith('<tt') || trimmed.includes('<p begin=')) {
          const parsed = parseTTML(trimmed);
          parsed.metadata = {
            ...parsed.metadata,
            title: trackTitle,
            artist: artistName,
            youtubeId: ytId || parsed.metadata.youtubeId,
            coverArt: coverArt || parsed.metadata.coverArt,
            syncedBy: userProfile.displayName || parsed.metadata.syncedBy || 'OpenLyryc Studio',
          };
          setDocument(parsed);
        } else {
          const parsed = parseLRC(trimmed);
          parsed.metadata = {
            ...parsed.metadata,
            title: trackTitle,
            artist: artistName,
            youtubeId: ytId || parsed.metadata.youtubeId,
            coverArt: coverArt || parsed.metadata.coverArt,
            syncedBy: userProfile.displayName || parsed.metadata.syncedBy || 'OpenLyryc Studio',
          };
          setDocument(parsed);
        }
      } else {
        updateMetadata({
          title: trackTitle,
          artist: artistName,
          youtubeId: ytId,
          coverArt: coverArt,
          syncedBy: userProfile.displayName || 'OpenLyryc Studio',
        });
      }

      // 2. If YouTube ID is available, activate YouTube source mode
      if (ytId) {
        handleAudioSourceModeChange('yt');
      }

      // 3. Switch back to editor view and toast confirmation
      navigateToHash('editor');
      showActionToast(`Loaded "${trackTitle}" from Unison`, null, { actionType: 'info' });
    },
    [userProfile.displayName, setDocument, updateMetadata, handleAudioSourceModeChange, navigateToHash, showActionToast]
  );

  // Auto-resolve stream when track metadata changes if resolver is active
  useEffect(() => {
    if (hasStreamResolver && (doc.metadata.youtubeId || doc.metadata.title)) {
      resolveCurrentTrackStream();
    }
  }, [hasStreamResolver, doc.metadata.youtubeId, doc.metadata.title, resolveCurrentTrackStream]);

  // Free Synthetic Playback Clock Timer Loop (Runs when no audio track or YouTube embed is bound)
  useEffect(() => {
    if (!isFreePlaying) return;

    let animId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const deltaSec = (now - lastTime) / 1000;
      lastTime = now;

      setExternalPlaybackTime((prev) => prev + deltaSec);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isFreePlaying]);

  // Responsive Mobile Detection & Performance Adaptation
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [palette, setPalette] = useState<ColorPalette>(() =>
    generateHarmonicPalette(`${doc.metadata.title} - ${doc.metadata.artist}`)
  );

  // Broadcast presence updates (active line, syncing status)
  useEffect(() => {
    if (collab.isConnected) {
      collab.updatePresence({
        activeLineIndex,
        activeTokenIndex,
        isSyncing,
      });
    }
  }, [activeLineIndex, activeTokenIndex, isSyncing, collab.isConnected, collab.updatePresence]);

  // Auto-track and auto-open active lyric lines and word tokens as audio plays
  // P1 perf: O(1)/O(log N) line lookup via findActiveLineIndex (was O(N) scan per tick).
  useEffect(() => {
    if (!autoFollowPlayhead || isInputFocused || !doc.lines || doc.lines.length === 0) return;

    const lineIdx = findActiveLineIndex(doc.lines, displayTime, activeLineIndex);

    if (lineIdx !== -1 && lineIdx !== activeLineIndex) {
      setActiveLineIndex(lineIdx);
    }

    const curLine = doc.lines[lineIdx !== -1 ? lineIdx : activeLineIndex];
    if (curLine?.tokens && curLine.tokens.length > 0) {
      let tIdx = 0;
      for (let j = 0; j < curLine.tokens.length; j++) {
        const tok = curLine.tokens[j];
        const nextTok = curLine.tokens[j + 1];
        if (displayTime >= tok.start && (!nextTok || displayTime < nextTok.start)) {
          tIdx = j;
          break;
        }
      }
      setActiveTokenIndex((prev) => (prev !== tIdx ? tIdx : prev));
    }
  }, [displayTime, autoFollowPlayhead, isInputFocused, doc.lines, activeLineIndex]);

  // Auto-open corner embed & auto-fetch clean YouTube thumbnail as cover art
  const ytThumbnailFetchedRef = useRef<string | null>(null);
  useEffect(() => {
    const ytId = doc.metadata.youtubeId;
    if (!ytId) return;

    setIsYouTubeEmbedOpen(true);

    // Skip if we already fetched for this exact video ID, or user uploaded custom artwork (base64)
    if (ytThumbnailFetchedRef.current === ytId) return;
    if (doc.metadata.coverArt && doc.metadata.coverArt.startsWith('data:')) return;

    ytThumbnailFetchedRef.current = ytId;

    // Probe maxresdefault (1080p) first, fall back to hqdefault (480p)
    const maxRes = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
    const hqFallback = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // YouTube returns a 120×90 grey placeholder for missing maxresdefault — detect it
      if (img.naturalWidth > 200) {
        updateMetadata({ coverArt: maxRes });
      } else {
        updateMetadata({ coverArt: hqFallback });
      }
    };
    img.onerror = () => {
      updateMetadata({ coverArt: hqFallback });
    };
    img.src = maxRes;
  }, [doc.metadata.youtubeId]);

  // Auto-fetch HD cover art if coverArt is not set on doc.metadata
  useEffect(() => {
    if (doc.metadata.coverArt) return;
    const { artist, title } = doc.metadata;
    if (!artist && !title) return;

    let cancelled = false;
    fetchArtworkUrl(artist, title).then((artUrl) => {
      if (!cancelled && artUrl) {
        updateMetadata({ coverArt: artUrl });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [doc.metadata.coverArt, doc.metadata.artist, doc.metadata.title, updateMetadata]);

  // Update dynamic ambient palette whenever artwork or title changes
  useEffect(() => {
    if (doc.metadata.coverArt) {
      extractColorsFromImage(doc.metadata.coverArt).then(setPalette);
    } else {
      setPalette(generateHarmonicPalette(`${doc.metadata.title} - ${doc.metadata.artist}`));
    }
  }, [doc.metadata.coverArt, doc.metadata.title, doc.metadata.artist]);

  const handleDurationDetected = useCallback((dur: number) => {
    if (dur >= 1 && (!doc.metadata.duration || doc.metadata.duration < 1 || Math.abs(doc.metadata.duration - dur) > 1)) {
      updateMetadata({ duration: Math.round(dur * 100) / 100 });
    }
  }, [doc.metadata.duration, updateMetadata]);

  const handleSelectCloudSong = (newDoc: OpenLyricsDocument, song: SongSearchResult) => {
    if (wavesurfer) {
      try {
        wavesurfer.stop();
        wavesurfer.empty();
      } catch {}
    }
    setResolvedStreamUrl(null);
    setCurrentAudioFile(null);
    setAudioSourceMode('yt');
    setExternalPlaybackTime(0);
    setIsExternalPlaying(false);
    setIsFreePlaying(false);
    setActiveLineIndex(0);
    setActiveTokenIndex(0);
    setDocument(newDoc);
    updateMetadata({
      title: song.title,
      artist: song.artist,
      album: song.album || '',
      duration: song.duration && song.duration >= 1 ? song.duration : (newDoc.metadata.duration && newDoc.metadata.duration >= 1 ? newDoc.metadata.duration : 0),
    });
  };

  // Audio & Media Drag & Drop Refs
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const dragDepthRef = useRef<number>(0);
  const lastDropTimeRef = useRef<number>(0);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const lrcInputRef = useRef<HTMLInputElement>(null);
  const handleIncomingFileRef = useRef<((file: File) => void) | null>(null);

  // Active Song Title from metadata
  const activeSongTitle = doc.metadata.title || 'Untitled Track';

  // Auto-save active document to recent projects (P0 perf: debounced 1000ms —
  // was synchronously re-stringifying + rewriting the 20-doc list on every keystroke).
  const projectSaveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!doc || !doc.lines || doc.lines.length === 0) return;
    if (projectSaveTimerRef.current) window.clearTimeout(projectSaveTimerRef.current);
    projectSaveTimerRef.current = window.setTimeout(() => {
      saveProjectToStorage(doc, activeSongTitle, activeProjectId || undefined)
        .then((id) => {
          if (id && id !== activeProjectId) {
            setActiveProjectId(id);
          }
        })
        .catch((err) => {
          console.warn('Failed to auto-save project to storage:', err);
        });
    }, 1000);
    return () => {
      if (projectSaveTimerRef.current) window.clearTimeout(projectSaveTimerRef.current);
    };
  }, [doc, activeSongTitle, activeProjectId]);

  // Handle play/pause state change from YouTube Corner Embed
  const handleExternalPlayStateChange = useCallback((playing: boolean) => {
    setIsExternalPlaying(playing);
  }, []);

  const handleCloseYouTubeEmbed = useCallback(() => {
    setIsYouTubeEmbedOpen(false);
    if (audioSourceMode === 'yt') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('openlyryc:toggle-play', {
            detail: { isPlaying: false, play: false, state: false },
          })
        );
      }
      setIsExternalPlaying(false);
      setAudioSourceMode('none');
    }
  }, [audioSourceMode]);

  const handleToggleVideoDisplayMode = useCallback((mode: VideoDisplayMode) => {
    if (rendererMode === 'editorial' && mode === 'backdrop') {
      return; // Backdrop mode forbidden in Editorial view to comply with YouTube visibility requirements
    }
    handleUpdateSettings({ videoDisplayMode: mode });
    if (mode === 'backdrop') {
      setViewTab('preview');
    }
  }, [handleUpdateSettings, rendererMode]);

  // In Editorial mode, ensure YouTube embed is popped out & open so the video is visible and compliant with YouTube TOS
  useEffect(() => {
    if (rendererMode === 'editorial' && audioSourceMode === 'yt' && doc.metadata.youtubeId && !isYouTubeEmbedOpen) {
      setIsYouTubeEmbedOpen(true);
    }
  }, [rendererMode, audioSourceMode, doc.metadata.youtubeId, isYouTubeEmbedOpen]);

  // Undo history for editorial settings
  const [editorialHistory, setEditorialHistory] = useState<
    Array<{ maxLines: number; cleanLyrics: boolean; wordsPerRow?: number }>
  >([]);

  const handleUpdateEditorialSettings = useCallback(
    (newSettings: { maxLines?: number; cleanLyrics?: boolean; wordsPerRow?: number }) => {
      const prevMaxLines = settings.editorialMaxLines ?? 4;
      const prevCleanLyrics = settings.editorialCleanLyrics ?? true;
      const prevWordsPerRow = settings.editorialWordsPerRow ?? 0;

      // Save previous state to undo history
      setEditorialHistory((prev) => [
        ...prev,
        { maxLines: prevMaxLines, cleanLyrics: prevCleanLyrics, wordsPerRow: prevWordsPerRow },
      ]);

      const updatedMaxLines = newSettings.maxLines !== undefined ? newSettings.maxLines : prevMaxLines;
      const updatedCleanLyrics = newSettings.cleanLyrics !== undefined ? newSettings.cleanLyrics : prevCleanLyrics;
      let updatedWordsPerRow = newSettings.wordsPerRow !== undefined ? newSettings.wordsPerRow : prevWordsPerRow;

      // When switching to 1 Row mode for the first time, default to 4 words per row so typography is huge
      if (newSettings.maxLines === 1 && prevMaxLines !== 1 && newSettings.wordsPerRow === undefined && (!prevWordsPerRow || prevWordsPerRow === 0)) {
        updatedWordsPerRow = 4;
      }

      handleUpdateSettings({
        editorialMaxLines: updatedMaxLines,
        editorialCleanLyrics: updatedCleanLyrics,
        editorialWordsPerRow: updatedWordsPerRow,
      });

      const changeDesc =
        newSettings.wordsPerRow !== undefined
          ? `Words per row set to ${newSettings.wordsPerRow === 0 ? 'Sentence' : newSettings.wordsPerRow}`
          : newSettings.maxLines !== undefined
          ? `Layout set to ${newSettings.maxLines === 1 ? '1 Row' : newSettings.maxLines === 99 ? 'Tower' : `${newSettings.maxLines} lines`}`
          : `Clean lyrics ${updatedCleanLyrics ? 'enabled' : 'disabled'}`;

      showActionToast(changeDesc, () => {
        handleUpdateSettings({
          editorialMaxLines: prevMaxLines,
          editorialCleanLyrics: prevCleanLyrics,
          editorialWordsPerRow: prevWordsPerRow,
        });
      });
    },
    [settings.editorialMaxLines, settings.editorialCleanLyrics, settings.editorialWordsPerRow, handleUpdateSettings, showActionToast]
  );

  const handleUndoEditorialSettings = useCallback(() => {
    if (editorialHistory.length === 0) return;
    const last = editorialHistory[editorialHistory.length - 1];
    setEditorialHistory((prev) => prev.slice(0, -1));
    handleUpdateSettings({
      editorialMaxLines: last.maxLines,
      editorialCleanLyrics: last.cleanLyrics,
      editorialWordsPerRow: last.wordsPerRow,
    });
    showActionToast('Reverted Editorial Settings');
  }, [editorialHistory, handleUpdateSettings, showActionToast]);

  const startFreePlayback = () => {
    setIsFreePlaybackConfirmed(true);
    setIsFreePlaying(true);
    setIsExternalPlaying(true);
  };

  // No-Audio modal → same YouTube auto-detect engine as Metadata → Auto:
  // best match is applied directly (embed opens + thumbnail via the
  // youtubeId effect); ambiguous cases stay refinable in #metadata.
  const [ytFetchError, setYtFetchError] = useState<string | null>(null);

  const handleModalFetchYouTube = useCallback(async (): Promise<boolean> => {
    const { artist, title, duration } = doc.metadata;
    setYtFetchError(null);
    const targetDuration =
      duration || (doc.lines.length > 0 ? Math.ceil(doc.lines[doc.lines.length - 1].end) : undefined);
    try {
      const best = await fetchBestYouTubeMatchId(artist || '', title || '', targetDuration);
      if (best?.videoId) {
        updateMetadata({ youtubeId: best.videoId });
        setAudioSourceMode('yt');
        setIsYouTubeEmbedOpen(true);
        setIsNoAudioModalOpen(false);
        showActionToast(`Fetched YouTube: ${best.title}`);
        return true;
      }
    } catch {
      // fall through to the no-match error below
    }
    setYtFetchError('No match found — refine artist/title, or pick a video in Metadata → YouTube Synchronization.');
    return false;
  }, [doc.metadata, doc.lines, updateMetadata, showActionToast]);

  const [scFetchError, setScFetchError] = useState<string | null>(null);

  // Studio Connect auto-match: youtubeId for this track, then switch the
  // source to the extension's direct stream (no embed, real audio + peaks via Web Audio clock).
  const handleModalFetchConnect = useCallback(async (): Promise<boolean> => {
    const { artist, title, duration } = doc.metadata;
    if (!isConnectAvailable) {
      setConnectError('The OpenLyryc Studio Connect extension isn’t installed (or didn’t answer a ping).');
      return false;
    }
    setConnectError(null);
    setIsResolvingConnect(true);
    const targetDuration =
      duration || (doc.lines.length > 0 ? Math.ceil(doc.lines[doc.lines.length - 1].end) : undefined);
    try {
      const best = await withTimeout(
        fetchBestYouTubeMatchId(artist || '', title || '', targetDuration),
        15_000,
        'YouTube search',
      );
      if (best?.videoId) {
        updateMetadata({ youtubeId: best.videoId });
        handleAudioSourceModeChange('connect');
        setIsNoAudioModalOpen(false);
        showActionToast(`Streaming via Studio Connect: ${best.title}`);
        return true;
      }
    } catch (error) {
      const message =
        error instanceof StageTimeoutError
          ? 'YouTube search timed out — check your connection, then retry Connect.'
          : 'No match found — refine artist/title, or pick a video in Metadata.';
      setConnectError(message);
      showActionToast(message);
      return false;
    } finally {
      setIsResolvingConnect(false);
    }
    setConnectError('No match found — refine artist/title, or pick a video in Metadata.');
    showActionToast('No YouTube match found — refine artist/title in Metadata');
    return false;
  }, [doc.metadata, doc.lines, isConnectAvailable, updateMetadata, handleAudioSourceModeChange, showActionToast]);

  const handleModalFetchSoundCloud = useCallback(async (): Promise<boolean> => {
    const { artist, title } = doc.metadata;
    setScFetchError(null);
    setIsResolvingSoundCloud(true);
    try {
      const best = await fetchBestSoundCloudMatch(artist || '', title || '');
      if (best?.url) {
        updateMetadata({ soundcloudUrl: best.url });
        handleAudioSourceModeChange('sc');
        setIsNoAudioModalOpen(false);
        showActionToast(`Loaded SoundCloud: ${best.title}`);
        return true;
      }
    } catch (err) {
      console.warn('[Studio] SoundCloud auto-match error:', err);
    } finally {
      setIsResolvingSoundCloud(false);
    }
    setScFetchError('No SoundCloud match found — refine artist/title in Metadata.');
    setIsSoundCloudModalOpen(true);
    showActionToast('Choose a candidate track or paste a link');
    return false;
  }, [doc.metadata, updateMetadata, handleAudioSourceModeChange, showActionToast]);

  const handleModalFetchCompanion = useCallback(async (): Promise<boolean> => {
    const { artist, title, youtubeId } = doc.metadata;
    const query = youtubeId || (artist && title ? `${artist} - ${title}` : title || artist);
    if (!query) {
      showActionToast('Set song title or artist first');
      return false;
    }
    try {
      const res = await downloadViaCompanionBridge(query, 'opus', title);
      if (res?.ok && res.streamUrl) {
        setResolvedStreamUrl(res.streamUrl);
        setAudioSourceMode('stream');
        setIsYouTubeEmbedOpen(false);
        setIsNoAudioModalOpen(false);
        showActionToast('Lossless audio loaded via Companion! Real waveform ready.');
        return true;
      }
    } catch (err) {
      console.warn('[Studio] Companion fetch error:', err);
    }
    showActionToast('Failed to fetch via Companion. Ensure companion app is active.');
    return false;
  }, [doc.metadata, showActionToast]);

  // Toggle play/pause (Supports Wavesurfer Stream / Local Audio, YouTube Video Embed, or Free Synthetic Timer Playback)
  const togglePlay = () => {
    if (
      audioSourceMode === 'stream' ||
      (audioSourceMode === 'local' && currentAudioFile) ||
      (audioSourceMode === 'connect' && currentAudioFile)
    ) {
      if (wavesurfer) {
        // playPause() is async: a rejected media.play() (e.g. no src yet because
        // load() is still fetching) must not die as an unhandled rejection —
        // and the user needs to see it instead of a dead silent button.
        wavesurfer.playPause()?.catch?.((err) => {
          if (err?.name !== 'AbortError') {
            console.warn('[Studio] Local/stream play failed (file may still be loading):', err);
          }
        });
      } else {
        console.warn('[Studio] Play pressed with no audio engine yet — WaveSurfer still initializing?');
      }
    } else if (
      (audioSourceMode === 'yt' && doc.metadata.youtubeId) ||
      (audioSourceMode === 'sc' && doc.metadata.soundcloudUrl)
    ) {
      if (typeof window !== 'undefined') {
        const willPlay = !isExternalPlaying;
        window.dispatchEvent(
          new CustomEvent('openlyryc:toggle-play', {
            detail: { isPlaying: willPlay, play: willPlay, state: willPlay },
          })
        );
        setIsExternalPlaying(willPlay);
      }
    } else if (audioSourceMode === 'connect' && doc.metadata.youtubeId) {
      // The track is still downloading (or failed) — the hidden resolver owns
      // playback once the file lands; don't drop into the free-play timer.
      showActionToast(connectStatus === 'error' && connectError ? connectError : 'Connect is fetching the track…');
    } else {
      // No local audio file and no YouTube/SoundCloud source bound
      if (isFreePlaying) {
        setIsFreePlaying(false);
        setIsExternalPlaying(false);
      } else {
        if (!isFreePlaybackConfirmed) {
          setIsNoAudioModalOpen(true);
        } else {
          startFreePlayback();
        }
      }
    }
  };

  // Seek offset by seconds (Supports Stream / Local Audio, YouTube Embed, SoundCloud Embed, or Free Synthetic Timer)
  const seekRelative = (seconds: number) => {
    if (
      (audioSourceMode === 'stream' ||
      audioSourceMode === 'local' ||
      (audioSourceMode === 'connect' && currentAudioFile)) && wavesurfer
    ) {
      const cur = wavesurfer.getCurrentTime();
      const dur = wavesurfer.getDuration() || doc.metadata.duration || 0;
      const target = Math.max(0, Math.min(dur > 0 ? dur : Infinity, cur + seconds));
      wavesurfer.setTime(target);
    } else if (
      (audioSourceMode === 'yt' && doc.metadata.youtubeId) ||
      (audioSourceMode === 'sc' && doc.metadata.soundcloudUrl)
    ) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('openlyryc:seek-relative', { detail: { seconds } }));
      }
    } else {
      setExternalPlaybackTime((prev) => Math.max(0, prev + seconds));
    }
  };

  // Unified Seek Handler (Supports Stream / Local Audio, YouTube Embed, SoundCloud Embed, or Free Synthetic Timer)
  const handleSeek = useCallback(
    (time: number) => {
      const targetTime = Math.max(0, time);
      if (
        (audioSourceMode === 'stream' ||
          audioSourceMode === 'local' ||
          (audioSourceMode === 'connect' && currentAudioFile)) && wavesurfer
      ) {
        wavesurfer.setTime(targetTime);
        setExternalPlaybackTime(targetTime);
      } else if (
        (audioSourceMode === 'yt' && doc.metadata.youtubeId) ||
        (audioSourceMode === 'sc' && doc.metadata.soundcloudUrl)
      ) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('openlyryc:seek-to', {
              detail: { time: targetTime },
            })
          );
        }
        setExternalPlaybackTime(targetTime);
      } else {
        setExternalPlaybackTime(targetTime);
      }

      // Broadcast immediate seek update to room listeners (ListenTogether pattern)
      if (collab.isConnected && collab.isHost) {
        const isPlaying =
          audioSourceMode === 'yt' || (audioSourceMode === 'connect' && !currentAudioFile)
            ? isExternalPlaying
            : (wavesurfer?.isPlaying() ?? false);
        collab.broadcastPlaybackState({
          currentTime: targetTime,
          isPlaying,
          playbackRate: 1,
          duration: doc.metadata.duration || 0,
          timestamp: Date.now(),
          youtubeId: doc.metadata.youtubeId,
          audioFileName: currentAudioFile?.name || doc.metadata.audioFileName,
          audioFileSize: currentAudioFile?.size,
        });
      }
    },
    [
      wavesurfer,
      audioSourceMode,
      doc.metadata.youtubeId,
      doc.metadata.soundcloudUrl,
      doc.metadata.duration,
      doc.metadata.audioFileName,
      collab.isConnected,
      collab.isHost,
      collab.broadcastPlaybackState,
      isExternalPlaying,
      currentAudioFile,
    ]
  );

  // Global seek-to event listener (unifies Seek events across embed, preview player, tests)
  useEffect(() => {
    const handleGlobalSeekTo = (e: Event) => {
      const custom = e as CustomEvent<{ time: number }>;
      if (typeof custom.detail?.time === 'number') {
        const target = Math.max(0, custom.detail.time);
        if (
          wavesurfer &&
          (audioSourceMode === 'stream' ||
            audioSourceMode === 'local' ||
            (audioSourceMode === 'connect' && currentAudioFile))
        ) {
          wavesurfer.setTime(target);
        }
        setExternalPlaybackTime(target);
      }
    };
    window.addEventListener('openlyryc:seek-to', handleGlobalSeekTo);
    return () => window.removeEventListener('openlyryc:seek-to', handleGlobalSeekTo);
  }, [wavesurfer, audioSourceMode]);

  // ── First-Time User Interactive Tutorial & Spotlight Tour ────────────────
  // Feature gate: disabled in production until onboarding tutorial work is finalized.
  // Can be tested locally via URL query parameter ?tutorial=dev or ?tutorial=true
  const [isTutorialEnabled, setIsTutorialEnabled] = useState<boolean>(false);
  const [isTutorialModalOpen, setIsTutorialModalOpen] = useState<boolean>(false);
  const [isTutorialTourActive, setIsTutorialTourActive] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('tutorial') === 'dev' || params.get('tutorial') === 'true') {
      setIsTutorialEnabled(true);
    }
  }, []);

  const handleStartTutorial = useCallback(() => {
    const tutorialDoc = getHoldMyHandTutorialDocument();
    setDocument(tutorialDoc);
    setViewTab('split');
    setAudioSourceMode('yt');
    setIsYouTubeEmbedOpen(true);
    setActiveLineIndex(2); // Line 03: "In my mind, I'm running 'round a cold and empty space"
    handleSeek(21.372); // Jump to active phrase as seen in screenshot
    setIsTutorialModalOpen(false);
    setIsTutorialTourActive(true);
    showActionToast('Loaded tutorial: Jess Glynne — Hold My Hand');
  }, [setDocument, handleSeek, showActionToast]);

  const handleFinishTutorial = useCallback(
    (action: 'keep' | 'blank') => {
      setIsTutorialTourActive(false);
      setIsTutorialModalOpen(false);
      if (action === 'blank') {
        clearDocument();
        setAudioSourceMode('none');
        setIsYouTubeEmbedOpen(false);
        showActionToast('Reset to blank canvas. Ready to create!');
      } else {
        showActionToast('Enjoy creating with Hold My Hand!');
      }
    },
    [clearDocument, showActionToast]
  );

  const handleTutorialStepChange = useCallback(
    (step: TutorialStep) => {
      if (step.seekTime !== undefined) {
        handleSeek(step.seekTime);
      }
      if (step.activeLineIndex !== undefined) {
        setActiveLineIndex(step.activeLineIndex);
      }
      if (viewTab !== 'split') {
        setViewTab('split');
      }
    },
    [handleSeek, viewTab]
  );

  // Trigger first-time interactive tutorial modal only once on first visit (when tutorial is enabled)
  useEffect(() => {
    if (!isTutorialEnabled || typeof window === 'undefined') return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      const isCollabRoom =
        window.location.hash.includes('room=') ||
        window.location.search.includes('room=');
      if (isCollabRoom) return;

      const tutorialSeen = localStorage.getItem(TUTORIAL_STORAGE_KEY);
      if (!tutorialSeen) {
        // Delay 500ms so the initial empty studio paints first
        timeoutId = setTimeout(() => {
          setIsTutorialModalOpen(true);
        }, 500);
      }
    } catch {}

    const onStartTutorialEvent = () => {
      handleStartTutorial();
    };
    window.addEventListener('openlyryc:start-tutorial', onStartTutorialEvent);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('openlyryc:start-tutorial', onStartTutorialEvent);
    };
  }, [isTutorialEnabled, handleStartTutorial]);

  // Loop region enforcer — runs after every displayTime tick
  useEffect(() => {
    if (!loopRegion || !isExternalPlaying) return;
    const [loopStart, loopEnd] = loopRegion;
    if (displayTime >= loopEnd) {
      handleSeek(loopStart);
    }
  }, [displayTime, loopRegion, isExternalPlaying, handleSeek]);

  // Playhead step stampers (uses raw un-offset time to prevent skewing stored sync)
  const stampActiveStart = () => {
    if (activeLineIndex >= 0 && activeLineIndex < doc.lines.length) {
      setLineStart(activeLineIndex, rawTime);
    }
  };

  const stampActiveEnd = () => {
    if (activeLineIndex >= 0 && activeLineIndex < doc.lines.length) {
      setLineEnd(activeLineIndex, rawTime);
      if (activeLineIndex + 1 < doc.lines.length) {
        setActiveLineIndex(activeLineIndex + 1);
        setActiveTokenIndex(0);
      }
    }
  };

  // Precision mode from metadata
  const isPrecision = Boolean(doc.metadata.precisionMode);

  // Filtered lines memoized
  const filteredLines = useMemo(() => {
    if (!searchQuery.trim()) return doc.lines;
    const q = searchQuery.toLowerCase();
    return doc.lines.filter((l) => l.text.toLowerCase().includes(q));
  }, [doc.lines, searchQuery]);

  // Global Keyboard Shortcuts
  useKeybindings({
    wavesurfer,
    activeLineIndex,
    setActiveLineIndex,
    lineCount: doc.lines.length,
    onStampLineStart: setLineStart,
    onStampLineEnd: setLineEnd,
    activeTokenIndex,
    setActiveTokenIndex,
    tokenCount: doc.lines[activeLineIndex]?.tokens?.length || 0,
    onStampWordToken: (lIdx, tIdx, time) => {
      const curLine = doc.lines[lIdx];
      if (curLine?.tokens && curLine.tokens[tIdx]) {
        setWordToken(lIdx, tIdx, curLine.tokens[tIdx].start, time ?? rawTime);
      }
    },
    onHoldTokenStart: (lIdx, tIdx, time) => {
      const curLine = doc.lines[lIdx];
      if (curLine?.tokens?.[tIdx]) {
        setWordToken(lIdx, tIdx, time, Math.max(time + 0.1, curLine.tokens[tIdx].end));
        setIsHoldSyncing(true);
      }
    },
    onHoldTokenEnd: (lIdx, tIdx, time) => {
      const curLine = doc.lines[lIdx];
      if (curLine?.tokens?.[tIdx]) {
        setWordToken(lIdx, tIdx, curLine.tokens[tIdx].start, time);
      }
      setIsHoldSyncing(false);
    },
    onSetLoop: () => {
      const line = doc.lines[activeLineIndex];
      if (line) {
        setLoopRegion((prev) =>
          prev && prev[0] === line.start && prev[1] === line.end ? null : [line.start, line.end]
        );
      }
    },
    onUndo: undo,
    onRedo: redo,
    onSyncNudge: (deltaMs) => {
      const cur = doc.metadata.offset || 0;
      const next = cur + deltaMs;
      updateMetadata({ offset: next });
      showActionToast(`Sync offset: ${next > 0 ? `+${next}` : next}ms (${deltaMs > 0 ? '+Earlier' : '-Later'})`);
    },
    onTogglePlay: togglePlay,
    onSeekRelative: seekRelative,
    onSyncingChange: setIsSyncing,
    currentTime: rawTime,
    isInputFocused: isInputFocused || activeHashView !== 'editor' || isWatchPartyGuest,
    onToggleDock: toggleDock,
  });

  // Stable Drag & Drop Handlers with Depth Counting and Drop Cooldown
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Prevent reviving overlay immediately following a drop (e.g. Chromium trailing events)
    if (Date.now() - lastDropTimeRef.current < 500) return;

    // Filter to file drags only
    const types = e.dataTransfer?.types ? Array.from(e.dataTransfer.types) : [];
    const hasFiles = types.length === 0 || types.some((t) => t.toLowerCase() === 'files');
    if (!hasFiles) return;

    dragDepthRef.current += 1;
    setIsDraggingOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    // Only set dragging if positive depth and not in drop cooldown
    if (
      dragDepthRef.current > 0 &&
      Date.now() - lastDropTimeRef.current > 500 &&
      !isDraggingOver
    ) {
      setIsDraggingOver(true);
    }
  }, [isDraggingOver]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    // Only dismiss when drag truly leaves the outer studio container
    const related = e.relatedTarget as Node | null;
    if (
      dragDepthRef.current <= 0 ||
      !related ||
      (e.currentTarget && !e.currentTarget.contains(related))
    ) {
      dragDepthRef.current = 0;
      setIsDraggingOver(false);
    }
  }, []);

  // Global drag & drop safety interceptor:
  // MUST preventDefault on BOTH window 'dragover' and 'drop' so the browser NEVER navigates away
  // or starts playing the dropped audio/media file in a new tab!
  useEffect(() => {
    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (Date.now() - lastDropTimeRef.current < 500) return;
      const types = e.dataTransfer?.types ? Array.from(e.dataTransfer.types) : [];
      const hasFiles = types.length === 0 || types.some((t) => t.toLowerCase() === 'files');
      if (!hasFiles) return;

      dragDepthRef.current += 1;
      setIsDraggingOver(true);
    };

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      if (
        dragDepthRef.current > 0 &&
        Date.now() - lastDropTimeRef.current > 500
      ) {
        setIsDraggingOver(true);
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      // If cursor leaves the browser window viewport entirely
      if (
        dragDepthRef.current <= 0 ||
        !e.relatedTarget ||
        e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      ) {
        dragDepthRef.current = 0;
        setIsDraggingOver(false);
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      lastDropTimeRef.current = Date.now();
      setIsDraggingOver(false);

      try {
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
          handleIncomingFileRef.current?.(e.dataTransfer.files[0]);
        }
      } catch (err) {
        console.warn('[Studio] Window drop handling error:', err);
      }
    };

    const handleGlobalDragEnd = () => {
      dragDepthRef.current = 0;
      lastDropTimeRef.current = Date.now();
      setIsDraggingOver(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dragDepthRef.current = 0;
        setIsDraggingOver(false);
      }
    };

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);
    window.addEventListener('dragend', handleGlobalDragEnd);
    window.addEventListener('blur', handleGlobalDragEnd);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
      window.removeEventListener('dragend', handleGlobalDragEnd);
      window.removeEventListener('blur', handleGlobalDragEnd);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const processAudioFile = (file: File) => {
    setCurrentAudioFile(file);
    handleAudioSourceModeChange('local');
    // The metadata update below changes title/artist on fresh docs, which flips
    // currentTrackKey — tell the track-switch wipe effect to spare this load.
    skipWipeOnceRef.current = true;
    const updates: Partial<typeof doc.metadata> = {
      audioFileName: file.name,
    };

    if (!doc.metadata.title || doc.metadata.title === 'Untitled Track') {
      const rawName = file.name.replace(/\.[^/.]+$/, '');
      const parts = rawName.split('-');
      if (parts.length >= 2) {
        updates.artist = parts[0].trim();
        updates.title = parts.slice(1).join('-').trim();
      } else {
        updates.title = rawName.trim();
      }
    }

    updateMetadata(updates);

    // Compute cryptographic SHA-256 audio content hash
    generateAudioFingerprint(file).then((res) => {
      updateMetadata({
        audioHash: res.audioHash,
        duration: res.durationSeconds || doc.metadata.duration,
      });
    });
  };

  // Keep processAudioFile ref in sync
  useEffect(() => {
    processAudioFileRef.current = processAudioFile;
  });

  // Studio Connect ingest: the resolved track arrives as a real File — hand it
  // to the same pipeline as a dropped local file (peaks, wavesurfer, clock),
  // but stay in connect mode (the Connect pill reflects reality, not "local").
  const ingestConnectFile = useCallback(
    (file: File, title: string) => {
      skipWipeOnceRef.current = true;
      setCurrentAudioFile(file);
      if (title && (!doc.metadata.title || doc.metadata.title === 'Untitled Track')) {
        updateMetadata({ title });
      }
      generateAudioFingerprint(file)
        .then((res) => {
          updateMetadata({
            audioFileName: file.name,
            audioHash: res.audioHash,
            duration: res.durationSeconds || doc.metadata.duration,
          });
        })
        .catch(() => updateMetadata({ audioFileName: file.name }));
    },
    [doc.metadata.title, doc.metadata.duration, updateMetadata],
  );

  // Cache host audio file for room peers to download
  useEffect(() => {
    if (currentAudioFile && collab.isHost) {
      currentAudioFile
        .arrayBuffer()
        .then((buf) => {
          collab.setHostAudioFile(buf, currentAudioFile.name);
        })
        .catch(() => {});
    }
  }, [currentAudioFile, collab.isHost, collab.setHostAudioFile]);

  // Broadcast stage settings in Watch Party mode or whenever host is on Stage
  useEffect(() => {
    if (!collab.isConnected || !collab.isHost) return;
    if (collab.roomMode === 'party' || viewTab === 'preview') {
      collab.broadcastStageConfig({
        mode: rendererMode,
        fontFamily: settings.stageFontFamily || 'poppins',
        fontWeight: settings.stageFontWeight || '500',
        ambientGlow: doc.metadata.ambientGlow ?? true,
        viewTab: viewTab,
        roomMode: collab.roomMode,
        colorsBeatDivision: settings.colorsBeatDivision ?? '4',
        colorsFontFamily: settings.colorsFontFamily ?? 'anton',
        colorsFontSize: settings.colorsFontSize ?? 1,
      });
    }
  }, [
    collab.isConnected,
    collab.isHost,
    collab.roomMode,
    collab.peers.length,
    rendererMode,
    settings.stageFontFamily,
    settings.stageFontWeight,
    settings.colorsBeatDivision,
    settings.colorsFontFamily,
    settings.colorsFontSize,
    doc.metadata.ambientGlow,
    viewTab,
    collab.broadcastStageConfig,
  ]);

  // Broadcast playback state (ListenTogether timing model):
  // Broadcasts immediately on Play/Pause, and checks sometimes in between (every 5s heartbeat, not every second)
  const isCurrentlyPlaying =
    audioSourceMode === 'yt' || (audioSourceMode === 'connect' && !currentAudioFile)
      ? isExternalPlaying
      : (wavesurfer?.isPlaying() ?? false);
  const rawTimeRef = useRef(rawTime);
  rawTimeRef.current = rawTime;

  useEffect(() => {
    if (!collab.isConnected || !collab.isHost) return;
    if (collab.roomMode !== 'party' && collab.peers.length === 0) return;

    // Send immediate state update on Play / Pause transition
    const now = Date.now();
    collab.broadcastPlaybackState({
      currentTime: rawTimeRef.current,
      isPlaying: isCurrentlyPlaying,
      playbackRate: 1,
      duration: doc.metadata.duration || 0,
      timestamp: now,
      youtubeId: doc.metadata.youtubeId,
      audioFileName: currentAudioFile?.name || doc.metadata.audioFileName,
      audioFileSize: currentAudioFile?.size,
    });

    // If paused, do not run background interval (0% CPU while paused)
    if (!isCurrentlyPlaying) return;

    // Periodic drift-check heartbeat: checks every 5 seconds (not every second)
    const interval = setInterval(() => {
      collab.broadcastPlaybackState({
        currentTime: rawTimeRef.current,
        isPlaying: true,
        playbackRate: 1,
        duration: doc.metadata.duration || 0,
        timestamp: Date.now(),
        youtubeId: doc.metadata.youtubeId,
        audioFileName: currentAudioFile?.name || doc.metadata.audioFileName,
        audioFileSize: currentAudioFile?.size,
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [
    collab.isConnected,
    collab.isHost,
    collab.roomMode,
    collab.peers.length,
    isCurrentlyPlaying,
    doc.metadata.youtubeId,
    doc.metadata.duration,
    currentAudioFile,
    doc.metadata.audioFileName,
    collab.broadcastPlaybackState,
  ]);

  // Mindful Screentime Break Rule (Always-on health rule, pauses audio & blurs studio after configured interval)
  const handlePauseForBreak = useCallback(() => {
    if (wavesurfer && wavesurfer.isPlaying()) {
      try {
        wavesurfer.pause();
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('openlyryc:toggle-play', {
          detail: { isPlaying: false, play: false, state: false },
        })
      );
    }
    setIsExternalPlaying(false);
    setIsFreePlaying(false);
  }, [wavesurfer]);

  const { isBreakActive, finishBreak } = useBreakReminder({
    breakIntervalMinutes: settings.breakIntervalMinutes ?? 30,
    isPlaying: isCurrentlyPlaying,
    onPauseAudio: handlePauseForBreak,
  });

  // Broadcast song changes to room when host changes track
  const prevHostSongIdRef = useRef<string>('');
  useEffect(() => {
    if (!collab.isConnected || !collab.isHost) return;
    const currentSongId = `${doc.metadata.title || ''}:::${doc.metadata.artist || ''}:::${doc.metadata.youtubeId || ''}`;
    if (!prevHostSongIdRef.current) {
      prevHostSongIdRef.current = currentSongId;
      return;
    }
    if (currentSongId !== prevHostSongIdRef.current && (doc.metadata.title || doc.metadata.artist || doc.metadata.youtubeId)) {
      prevHostSongIdRef.current = currentSongId;
      collab.broadcastSongChange({
        title: doc.metadata.title || 'Untitled Track',
        artist: doc.metadata.artist || '',
        album: doc.metadata.album || '',
        coverArt: doc.metadata.coverArt,
        youtubeId: doc.metadata.youtubeId,
        duration: doc.metadata.duration,
        canonicalKey: doc.metadata.canonicalKey,
      });
    }
  }, [
    collab.isConnected,
    collab.isHost,
    doc.metadata.title,
    doc.metadata.artist,
    doc.metadata.album,
    doc.metadata.coverArt,
    doc.metadata.youtubeId,
    doc.metadata.duration,
    doc.metadata.canonicalKey,
    collab.broadcastSongChange,
  ]);

  // Ensure audio fingerprint is computed whenever currentAudioFile is set
  useEffect(() => {
    if (currentAudioFile && !doc.metadata.audioHash) {
      generateAudioFingerprint(currentAudioFile).then((res) => {
        updateMetadata({
          audioHash: res.audioHash,
          audioFileName: currentAudioFile.name,
          duration: res.durationSeconds || doc.metadata.duration,
        });
      });
    }
  }, [currentAudioFile, doc.metadata.audioHash]);

  // Load a track fetched via audio-source plugins (e.g. Monochrome Bridge)
  // into the Studio: file → local audio path + authoritative track metadata.
  const handleMonochromeFile = useCallback((file: File, meta: FetchedTrackMeta) => {
    processAudioFile(file);
    updateMetadata({
      title: meta.title || doc.metadata.title,
      artist: meta.artist || doc.metadata.artist,
      album: meta.album || doc.metadata.album,
      duration: meta.duration || doc.metadata.duration,
      ...(meta.coverArt ? { coverArt: meta.coverArt } : {}),
    });
    showActionToast(`Loaded "${meta.title}" into Studio`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.metadata.title, doc.metadata.artist, doc.metadata.album, doc.metadata.duration]);

  const importLyricsFile = useCallback((file: File) => {
    file.text().then((text) => {
      const trimmed = text.trim();
      if (
        file.name.endsWith('.ttml') ||
        file.name.endsWith('.xml') ||
        trimmed.startsWith('<?xml') ||
        trimmed.startsWith('<tt') ||
        trimmed.includes('<p begin=')
      ) {
        setDocument(parseTTML(text));
        return;
      }
      if (file.name.endsWith('.json') || (trimmed.startsWith('{') && trimmed.includes('"lines"'))) {
        try {
          const jsonDoc = JSON.parse(text);
          if (jsonDoc && Array.isArray(jsonDoc.lines)) {
            setDocument(jsonDoc);
            return;
          }
        } catch (e) {
          // fallback to parseLRC
        }
      }
      const parsed = parseLRC(text);
      setDocument(parsed);
    });
  }, [setDocument]);

  const handleBackdropFile = useCallback(async (file: File) => {
    try {
      if (activeBackdropObjectUrlRef.current) {
        try { URL.revokeObjectURL(activeBackdropObjectUrlRef.current); } catch {}
        activeBackdropObjectUrlRef.current = null;
      }
      const { url, mediaType, persisted } = await persistBackdropMedia(file);
      activeBackdropObjectUrlRef.current = url;
      handleUpdateSettings({ appBackdropUrl: url, appBackdropType: mediaType });
      showActionToast(
        persisted
          ? `${mediaType === 'video' ? 'Video' : 'Image'} backdrop saved (persists across reloads)`
          : `${mediaType === 'video' ? 'Video' : 'Image'} backdrop applied for session`
      );
    } catch {
      showActionToast('Could not load that file as a backdrop');
    }
  }, [handleUpdateSettings, showActionToast]);

  const handleIncomingFile = useCallback((file: File) => {
    if (isBackdropMediaFile(file)) {
      // Both images and videos become persistent Studio backdrops via Dexie
      void handleBackdropFile(file);
      return;
    }
    if (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a|flac)$/i)) {
      processAudioFile(file);
    } else {
      importLyricsFile(file);
    }
  }, [handleBackdropFile, processAudioFile, importLyricsFile]);

  useEffect(() => {
    handleIncomingFileRef.current = handleIncomingFile;
  }, [handleIncomingFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    lastDropTimeRef.current = Date.now();
    setIsDraggingOver(false);
    try {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleIncomingFile(e.dataTransfer.files[0]);
      }
    } catch (err) {
      console.warn('[Studio] File drop handling error:', err);
    }
  }, [handleIncomingFile]);

  const triggerAudioPicker = () => {
    audioInputRef.current?.click();
  };

  const handleAudioInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processAudioFile(file);
      e.target.value = '';
    }
  };

  const triggerLrcPicker = () => {
    lrcInputRef.current?.click();
  };

  const handleLrcInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleIncomingFile(e.target.files[0]);
      e.target.value = '';
    }
  };



  const handleDownload = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Runtime mode gate (desktop app only; inert on the website) ──
  // Hooks above always run; these early returns only branch rendering.
  // On openlyryc.pages.dev showModeUI is always false → studio renders
  // exactly as before, with zero picker/pill/frame changes.
  if (showModeUI && (!runtimeMode || isModeDialogOpen)) {
    return (
      <div className="fixed inset-0 bg-[#08080a]">
        {/* Keep the local studio mounted underneath once a mode exists so
            switching back from the dialog is instant. First-run renders
            the picker alone. */}
        <WelcomeModeScreen
          onSelect={(next) => {
            selectRuntimeMode(next);
            setIsModeDialogOpen(false);
          }}
          onClose={runtimeMode ? () => setIsModeDialogOpen(false) : undefined}
        />
      </div>
    );
  }

  if (showModeUI && runtimeMode === 'cloudflare') {
    return (
      <CloudflareModeFrame
        onSwitchOffline={() => selectRuntimeMode('offline')}
        onChangeMode={() => setIsModeDialogOpen(true)}
      />
    );
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="fixed inset-0 flex bg-transparent text-zinc-100 overflow-hidden select-none"
      style={{ fontFamily: interfaceFontStack }}
      suppressHydrationWarning
    >
      {/* Global Studio backdrop (bottom-most layer; embeds/stage/text paint above).
          Hidden wherever the Stage renderer is on screen (preview + split tabs)
          so stage modes (incl. YouTube video backdrop) keep their own background. */}
      {viewTab !== 'preview' && viewTab !== 'split' && (
        <AppBackdrop
          imageUrl={settings.appBackdropUrl}
          type={settings.appBackdropType}
          dim={settings.appBackdropDim ?? 0.6}
          blur={settings.appBackdropBlur ?? 10}
          fit={settings.appBackdropFit ?? 'cover'}
          hardwareAcceleration={settings.hardwareAcceleration ?? true}
          onError={() => {
            if (settings.appBackdropUrl?.startsWith('blob:')) {
              handleUpdateSettings({ appBackdropUrl: '', appBackdropType: 'auto' });
            }
          }}
        />
      )}



      {/* GPU Isolated Ambient Gradient Background Layer */}
      {/* P1 perf: auto low-power (static gradients, no 90-110px live blurs) on
          mobile or when hardware acceleration is off. lowPower path existed
          but was never enabled. */}
      <AmbientBackground
        palette={palette}
        // Off while a sub-page is open: the palette-driven blobs bleed warm
        // colour through the sub-pages' own chrome, which reads as a muddy
        // brown wash. Sub-pages sit on solid black instead. (A user-set
        // AppBackdrop image is unaffected — it renders independently below.)
        enabled={
          activeHashView === 'editor' &&
          (viewTab !== 'preview' || settings.videoDisplayMode !== 'backdrop' || !doc.metadata.youtubeId || !isYouTubeEmbedOpen)
        }
        lowPower={isMobile || !settings.hardwareAcceleration}
      />

      {/* Real-time Synced Remote Colored Cursors (Desktop Only, excluded on Watch Party stage) */}
      {!isMobile && !isWatchPartyGuest && <CollabCursors peers={collab.peers} />}

      {/* Floating Song Change Notification Indicator (Host & Guests) */}
      <AnimatePresence>
        {songChangeNotice && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#141418]/95 border border-white/15 backdrop-blur-xl shadow-2xl pointer-events-none select-none max-w-sm sm:max-w-md w-auto"
          >
            {songChangeNotice.coverArt ? (
              <img
                src={songChangeNotice.coverArt}
                alt=""
                className="w-7 h-7 rounded-lg object-cover border border-white/10 shrink-0"
              />
            ) : songChangeNotice.status === 'loading' ? (
              <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[15px]">check</span>
              </div>
            )}
            <div className="flex flex-col min-w-0 pr-1">
              <span className="font-semibold text-xs text-white truncate">
                {songChangeNotice.status === 'loading'
                  ? `Host loading song: ${songChangeNotice.title}`
                  : `Synced: ${songChangeNotice.title}`}
              </span>
              <span className="text-[11px] text-zinc-400 truncate">
                {songChangeNotice.status === 'loading'
                  ? (songChangeNotice.artist ? `${songChangeNotice.artist} · Fetching lyrics...` : 'Fetching lyrics & metadata...')
                  : (songChangeNotice.artist ? `${songChangeNotice.artist} · Ready` : 'Ready to play')}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden File Pickers */}
      <input
        type="file"
        ref={audioInputRef}
        onChange={handleAudioInputChange}
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
        className="hidden"
      />
      <input
        type="file"
        ref={lrcInputRef}
        onChange={handleLrcInputChange}
        accept=".lrc,.olrc,.elrc,.ttml,.xml,.json,.txt"
        className="hidden"
      />

      {/* Drag & Drop Fullscreen Overlay */}
      {isDraggingOver && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={handleDrop}
          onClick={() => {
            dragDepthRef.current = 0;
            setIsDraggingOver(false);
          }}
          className="fixed inset-0 z-50 bg-[#09090b]/90 border-4 border-dashed border-white/40 flex flex-col items-center justify-center backdrop-blur-md animate-in fade-in duration-150 cursor-copy"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="p-6 rounded-3xl bg-white/[0.04] border border-white/10 flex flex-col items-center gap-3 pointer-events-none select-none"
          >
            <span className="material-symbols-outlined text-5xl text-white">cloud_upload</span>
            <span className="text-xl font-bold font-sans text-white">
              Drop Media or Lyrics
            </span>
            <span className="text-xs text-zinc-400 font-sans">
              Accepts .mp3/.wav audio, .mp4/.webm video or photo backdrop, and .lrc/.ttml lyrics
            </span>
          </div>
        </div>
      )}

      {/* Watch Party Dedicated Fullscreen Stage (Guest View) */}
      {isWatchPartyGuest ? (
        <div className="fixed inset-0 z-40 bg-[#09090b] flex flex-col overflow-hidden select-none">
          {/* Top-Right Clean Exit / Leave Session Button */}
          <div className="absolute top-4 right-5 z-50 flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={() => {
                collab.leaveRoom();
                navigateToHash('editor');
                showActionToast('Left Watch Party', null, { actionType: 'info' });
              }}
              className="group flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 hover:bg-zinc-900/90 text-zinc-300 hover:text-white border border-white/10 hover:border-white/25 backdrop-blur-md text-xs font-medium transition-all shadow-xl cursor-pointer active:scale-95"
              title="Leave Watch Party"
            >
              <LogOut className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
              <span>Leave Party</span>
            </button>
          </div>

          {/* Fullscreen Stage Container */}
          <div className="flex-1 w-full h-full relative overflow-hidden">
            <LyricRenderer
              lines={doc.lines}
              currentTime={displayTime}
              songTitle={activeSongTitle}
              artistName={doc.metadata.artist}
              coverArt={doc.metadata.coverArt}
              viewMode={rendererMode}
              hasBackdrop={
                rendererMode !== 'editorial' &&
                rendererMode !== 'peak' &&
                rendererMode !== 'colors' &&
                rendererMode !== 'flythrough' &&
                Boolean(doc.metadata.youtubeId)
              }
              palette={palette}
              editorialMaxLines={settings.editorialMaxLines ?? 4}
              editorialCleanLyrics={settings.editorialCleanLyrics ?? true}
              editorialWordsPerRow={settings.editorialWordsPerRow ?? 0}
              stageFontFamily={settings.stageFontFamily ?? 'poppins'}
              stageFontWeight={settings.stageFontWeight ?? '500'}
              alveDayNight={settings.alveDayNight ?? true}
              alveAnimation={settings.alveAnimation ?? true}
              alveDim={settings.alveDim ?? 0.25}
              alveTimeMode={settings.alveTimeMode ?? 'cycle'}
              alveFontSize={settings.alveFontSize ?? 1}
              peakTextX={settings.peakTextX ?? 0}
              peakTextY={settings.peakTextY ?? 16}
              peakFontSize={settings.peakFontSize ?? 1}
              peakParallax={settings.peakParallax ?? false}
              colorsBeatDivision={settings.colorsBeatDivision ?? '4'}
              colorsFontFamily={settings.colorsFontFamily ?? 'anton'}
              colorsFontSize={settings.colorsFontSize ?? 1}
              bpm={doc.metadata.bpm}
              hideControls={true}
            />

            {/* Backdrop / Background YouTube Embed */}
            {doc.metadata.youtubeId && (
              <YouTubeCornerEmbed
                youtubeId={doc.metadata.youtubeId}
                isOpen={true}
                onClose={handleCloseYouTubeEmbed}
                wavesurfer={wavesurfer}
                isLocalAudioLoaded={
                audioSourceMode === 'stream' ||
                audioSourceMode === 'local' ||
                (audioSourceMode === 'connect' && Boolean(currentAudioFile))
              }
                onExternalTimeUpdate={setExternalPlaybackTime}
                onExternalPlayStateChange={handleExternalPlayStateChange}
                onDurationDetected={handleDurationDetected}
                framerateTarget={settings.framerateTarget}
                videoDisplayMode={
                  rendererMode === 'editorial' ? 'pip' : 'backdrop'
                }
                disableBackdropMode={rendererMode === 'editorial'}
                hideBackdropControls={true}
                isTimelineMode={false}
                nleMonitorMode="stage"
                backdropOpacity={settings.videoBackdropOpacity}
                backdropBlur={settings.videoBackdropBlur}
                videoQualityPreference={settings.videoQualityPreference}
              />
            )}
          </div>

          {/* Hidden Waveform Player for Audio Engine (when audio is local or stream) */}
          <div className="absolute -top-[9999px] -left-[9999px] w-[600px] h-0 overflow-hidden pointer-events-none opacity-0">
            <WaveformPlayer
              onWaveSurferInit={setWavesurfer}
              currentTime={displayTime}
              currentAudioFile={currentAudioFile}
              onAudioSelect={processAudioFile}
              onDurationDetected={handleDurationDetected}
              externalDuration={
                doc.metadata.duration && doc.metadata.duration >= 1
                  ? doc.metadata.duration
                  : (doc.lines && doc.lines.length > 0 ? doc.lines[doc.lines.length - 1].end : 0)
              }
              isExternalPlaying={isExternalPlaying}
              onTogglePlay={togglePlay}
              onSeek={handleSeek}
              trackTitle={activeSongTitle}
              hasYouTubeEmbed={Boolean(doc.metadata.youtubeId)}
              hasSoundCloudEmbed={Boolean(doc.metadata.soundcloudUrl)}
              audioSourceMode={audioSourceMode}
              onAudioSourceModeChange={handleAudioSourceModeChange}
              isConnectAvailable={isConnectAvailable}
              connectStatus={connectStatus}
              lines={doc.lines}
            />
          </div>
        </div>
      ) : (
        <>
      {/* Studio Left Actions Dock (Desktop Activity Bar with smooth collapse & expand toggle) */}
      <div
        className={`hidden md:flex transition-[width,opacity] duration-200 ease-in-out shrink-0 relative z-40 ${
          isDockCollapsed ? 'w-0 opacity-0 pointer-events-none overflow-hidden' : 'w-14 opacity-100'
        }`}
      >
        <StudioTaskbarDock
          activeView={viewTab}
          activeCategory={viewTab === 'settings' ? settingsCategory : undefined}
          activeHashView={activeHashView}
          onOpenProjects={() => navigateToHash(activeHashView === 'projects' ? 'editor' : 'projects')}
          onOpenMetadata={() => navigateToHash(activeHashView === 'metadata' ? 'editor' : 'metadata')}
          onOpenSettings={() => navigateToHash(activeHashView === 'settings' ? 'editor' : 'settings')}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onOpenRevisions={() => navigateToHash(activeHashView === 'revisions' ? 'editor' : 'revisions')}
          onOpenCloudSearch={() => navigateToHash(activeHashView === 'search' ? 'editor' : 'search')}
          onOpenPasteLyrics={() => navigateToHash(activeHashView === 'paste' ? 'editor' : 'paste')}
          onTriggerImport={triggerLrcPicker}
          onOpenExport={() => navigateToHash(activeHashView === 'export' ? 'editor' : 'export')}
          onOpenCollab={() => navigateToHash(activeHashView === 'collab' ? 'editor' : 'collab')}
          collabConnected={collab.isConnected}
          collabPeerCount={collab.peers.length}
          onOpenPlugins={PLUGINS_ENABLED ? () => navigateToHash(activeHashView === 'plugins' ? 'editor' : 'plugins') : undefined}
          onOpenKeybindings={() => navigateToHash(activeHashView === 'shortcuts' ? 'editor' : 'shortcuts')}
          onOpenUserProfile={() => setIsUserProfileModalOpen(true)}
          onOpenUnisonHub={() => navigateToHash(activeHashView === 'unison' ? 'editor' : 'unison')}
          isUnisonConnected={Boolean(unisonSession?.keyId)}
          userDisplayName={userProfile.displayName}
          userAvatarUrl={userProfile.avatarUrl}
          onBackToEditor={() => navigateToHash('editor')}
          onToggleTimeline={() => setIsTimelineOpen((prev) => !prev)}
          isTimelineOpen={isTimelineOpen}
          isTimelineEnabled={settings.enableTimelineEditor}
          framerateTarget={settings.framerateTarget}
        />

        {/* Clean < button to collapse dock */}
        {!isDockCollapsed && (
          <button
            type="button"
            onClick={toggleDock}
            title="Collapse dock (Ctrl+B)"
            aria-label="Collapse studio dock"
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-3.5 h-10 bg-[#111115] hover:bg-[#1c1c22] border border-white/[0.12] rounded-r-md flex items-center justify-center text-zinc-400 hover:text-white transition-all shadow-md shadow-black/50 cursor-pointer z-50 group hover:w-4"
          >
            <ChevronLeft className="w-3 h-3 stroke-[2.5] transition-transform group-hover:-translate-x-0.5" />
          </button>
        )}
      </div>

      {/* Clean > button sticking to left edge when collapsed */}
      {isDockCollapsed && (
        <button
          type="button"
          onClick={toggleDock}
          title="Expand dock (Ctrl+B)"
          aria-label="Expand studio dock"
          className="hidden md:flex fixed left-0 top-1/2 -translate-y-1/2 w-3.5 h-10 bg-[#111115]/95 hover:bg-[#1c1c22] border border-l-0 border-white/[0.14] rounded-r-md items-center justify-center text-zinc-400 hover:text-white transition-all shadow-lg shadow-black/60 cursor-pointer z-50 backdrop-blur-md group hover:w-4.5"
        >
          <ChevronRight className="w-3 h-3 stroke-[2.5] transition-transform group-hover:translate-x-0.5" />
        </button>
      )}

      {/* Main Studio Viewport (Right of Dock: Header + Workspace + Waveform + Modal Overlays) */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative z-[1] bg-transparent">
        {/* Slim notifier bar (one row, dismissible) */}
        <AnnouncementBar />

        {/* App Header Bar (Clean, Balanced Studio Navigation) */}
        <header className="h-12 bg-[#09090b]/95 backdrop-blur-md border-b border-white/[0.08] px-3 sm:px-5 flex items-center justify-between shrink-0 z-20 gap-3 select-none studio-chrome">
        {/* 1. Left: Brand & Track Info */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 min-w-0">
          <div className="flex flex-col justify-center min-w-0">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setIsAboutModalOpen(true)}
                title="About OpenLyryc Studio & What's New"
                className="hover:opacity-85 transition-opacity cursor-pointer inline-flex items-center group"
              >
                <OpenLyrycLogo className="h-4 sm:h-5 w-auto text-white select-none transition-transform group-hover:scale-[1.02]" />
              </button>
            </div>
            <div className="text-[10px] text-zinc-400 font-medium truncate max-w-[130px] sm:max-w-[180px] lg:max-w-[240px] leading-tight">
              {doc.metadata.artist && doc.metadata.artist !== 'Untitled Artist' && doc.metadata.artist !== 'Sample Artist'
                ? `${doc.metadata.artist} — ${activeSongTitle}`
                : activeSongTitle}
            </div>
          </div>
        </div>

        {/* 2. Center: Segmented View Switcher (Desktop Only) */}
        <div className="hidden md:flex items-center justify-center flex-1 min-w-0">
          <div data-tutorial="view-switcher" className="flex items-center h-8 rounded-xl bg-white/[0.03] border border-white/[0.08] p-0.5 shrink-0 relative">
            <motion.button
              onClick={() => setViewTab('editor')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.94 }}
              title="Editor"
              className="relative flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-semibold cursor-pointer select-none"
            >
              {viewTab === 'editor' && (
                <motion.div
                  layoutId="headerActiveTab"
                  className="absolute inset-0 rounded-lg bg-white shadow-sm"
                  transition={{ type: 'spring', damping: 26, stiffness: 380 }}
                />
              )}
              <span className={`relative z-10 flex items-center gap-1.5 ${viewTab === 'editor' ? 'text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}>
                <span className="material-symbols-outlined text-[15px]">edit_note</span>
                <span>Editor</span>
              </span>
            </motion.button>

            <motion.button
              onClick={() => setViewTab('preview')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.94 }}
              title="Performance"
              className="relative flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-semibold cursor-pointer select-none"
            >
              {viewTab === 'preview' && (
                <motion.div
                  layoutId="headerActiveTab"
                  className="absolute inset-0 rounded-lg bg-white shadow-sm"
                  transition={{ type: 'spring', damping: 26, stiffness: 380 }}
                />
              )}
              <span className={`relative z-10 flex items-center gap-1.5 ${viewTab === 'preview' ? 'text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}>
                <span className="material-symbols-outlined text-[15px]">live_tv</span>
                <span>Stage</span>
              </span>
            </motion.button>

            <motion.button
              onClick={() => setViewTab('split')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.94 }}
              title="Split"
              className="relative flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-semibold cursor-pointer select-none"
            >
              {viewTab === 'split' && (
                <motion.div
                  layoutId="headerActiveTab"
                  className="absolute inset-0 rounded-lg bg-white shadow-sm"
                  transition={{ type: 'spring', damping: 26, stiffness: 380 }}
                />
              )}
              <span className={`relative z-10 flex items-center gap-1.5 ${viewTab === 'split' ? 'text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}>
                <span className="material-symbols-outlined text-[15px]">vertical_split</span>
                <span>Split</span>
              </span>
            </motion.button>

            <motion.button
              onClick={() => setViewTab('timeline')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.94 }}
              title="Classic Mode (Alpha)"
              className="relative flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-semibold cursor-pointer select-none"
            >
              {viewTab === 'timeline' && (
                <motion.div
                  layoutId="headerActiveTab"
                  className="absolute inset-0 rounded-lg bg-white shadow-sm"
                  transition={{ type: 'spring', damping: 26, stiffness: 380 }}
                />
              )}
              <span className={`relative z-10 flex items-center gap-1.5 ${viewTab === 'timeline' ? 'text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}>
                <span className="material-symbols-outlined text-[15px]">view_timeline</span>
                <span>Timeline</span>
              </span>
            </motion.button>
          </div>
        </div>

        {/* 3. Right: Search, Sync Offset & CTAs */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Search Input (Desktop Only) */}
          <div className="relative hidden lg:flex items-center w-52 xl:w-64 group">
            <span className="material-symbols-outlined absolute left-2.5 text-zinc-400 group-focus-within:text-white text-[15px] pointer-events-none transition-colors">
              search
            </span>
            <input
              id="search-lyrics-input"
              type="text"
              placeholder="Search lyrics  / or ⌘K ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 bg-[#141417] hover:bg-[#18181c] focus:bg-[#18181c] border border-white/[0.12] hover:border-white/[0.2] focus:border-white/35 rounded-xl pl-8 pr-8 text-xs text-zinc-100 placeholder:text-zinc-500 font-sans outline-none transition-all"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 p-0.5 rounded text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
                title="Clear search"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            ) : (
              <div className="absolute right-2 pointer-events-none flex items-center">
                
              </div>
            )}
          </div>


          {/* Sync Health Timing Linter */}
          <SyncLintBadge
            issues={lintIssues}
            onJumpToLine={(idx) => {
              setActiveLineIndex(idx);
              if (viewTab !== 'editor' && viewTab !== 'split' && viewTab !== 'timeline') {
                setViewTab('editor');
              }
            }}
            onAutoFix={() => {
              const fixed = autoFixAllIssues(doc);
              setDocument(fixed);
              showActionToast('All timing collisions and word tokens aligned');
            }}
            onFixSingleIssue={(issue) => {
              const fixed = autoFixSingleIssue(doc, issue);
              setDocument(fixed);
              showActionToast(`Resolved timing on line ${issue.lineIndex + 1}`);
            }}
          />

          {/* History Drawer */}
          <HistoryDrawer
            historyLog={historyLog}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onUndoSteps={(n) => { for (let i = 0; i < n; i++) undo(); }}
          />

          {/* Live Sync Offset HUD / Calibration Suite */}
          <SyncOffsetHud
            offsetMs={doc.metadata.offset || 0}
            onUpdateOffset={(offset) => updateMetadata({ offset })}
            onBakeOffset={bakeOffsetIntoTimestamps}
            onShiftAllTimestamps={shiftAllTimestamps}
            currentTime={rawTime}
            rawTime={rawTime}
            displayTime={displayTime}
            activeWordText={
              doc.lines[activeLineIndex]?.tokens?.[activeTokenIndex]?.text ||
              doc.lines[activeLineIndex]?.text
            }
            activeWordSpan={
              doc.lines[activeLineIndex]?.tokens?.[activeTokenIndex]
                ? {
                    start: doc.lines[activeLineIndex].tokens[activeTokenIndex].start,
                    end: doc.lines[activeLineIndex].tokens[activeTokenIndex].end,
                  }
                : doc.lines[activeLineIndex]
                ? {
                    start: doc.lines[activeLineIndex].start,
                    end: doc.lines[activeLineIndex].end,
                  }
                : undefined
            }
            firstLineStart={doc.lines[0]?.start}
            hasLines={doc.lines.length > 0}
            onActionToast={showActionToast}
          />

          {/* Runtime mode pill (desktop app only — hidden on the website) */}
          {showModeUI && runtimeMode && (
            <RuntimeModeSwitcher
              mode={runtimeMode}
              onClick={() => setIsModeDialogOpen(true)}
            />
          )}

          {/* Share Button (Desktop icon) */}
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => navigateToHash('share')}
            title="Share"
            className="hidden sm:flex items-center justify-center h-8 px-2.5 rounded-xl border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">share</span>
          </motion.button>

          {/* Publish & Export Dropdown */}
          <div ref={publishDropdownRef} className="relative hidden sm:block">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setIsPublishDropdownOpen((prev) => !prev)}
              title="Publish or Export lyrics"
              className={`flex items-center gap-1.5 h-8 px-3 rounded-xl border transition-all cursor-pointer text-xs font-medium ${
                isPublishDropdownOpen
                  ? 'bg-white/10 border-white/30 text-white shadow-lg'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.1] text-zinc-200 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[15px] text-zinc-300">upload</span>
              <span>Publish</span>
              <span className={`material-symbols-outlined text-[14px] text-zinc-400 transition-transform duration-200 ${isPublishDropdownOpen ? 'rotate-180' : ''}`}>
                keyboard_arrow_down
              </span>
            </motion.button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {isPublishDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-[#141418] border border-white/10 shadow-2xl backdrop-blur-2xl p-1.5 z-50 divide-y divide-white/[0.06]"
                >
                  <div className="p-1 space-y-1">
                    {/* 1. Publish to Unison */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsPublishDropdownOpen(false);
                        setIsUnisonSubmitModalOpen(true);
                      }}
                      className="w-full flex items-start gap-2.5 p-2 rounded-xl text-left hover:bg-white/[0.06] transition-colors cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/10 group-hover:border-white/20 transition-colors">
                        <BetterLyricsLogo size={16} variant="color" className="text-white" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-white">Publish to Unison</span>
                        </div>
                        <span className="text-[11px] text-zinc-400 leading-tight mt-0.5">
                          Submit verified lyrics to the Better Lyrics database
                        </span>
                      </div>
                    </button>
                  </div>

                  <div className="p-1 space-y-1">
                    {/* 2. Local Export */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsPublishDropdownOpen(false);
                        navigateToHash('export');
                      }}
                      className="w-full flex items-start gap-2.5 p-2 rounded-xl text-left hover:bg-white/[0.06] transition-colors cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/10 group-hover:border-white/20 transition-colors">
                        <span className="material-symbols-outlined text-[17px] text-zinc-300 group-hover:text-white">file_download</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-white">Local Export</span>
                        <span className="text-[11px] text-zinc-400 leading-tight mt-0.5">
                          Download as standard LRC, TTML, SRT, JSON, or enhanced video formats
                        </span>
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Autosave Status — replaces disabled Publish button */}
          <span data-tutorial="autosave-badge" className="hidden sm:flex items-center gap-1.5 h-8 px-3.5 rounded-xl border border-white/[0.06] text-zinc-400 text-xs font-sans select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            Autosaved
          </span>

          {/* Mobile Overflow Menu Trigger */}
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setIsMobileMenuOpen(true)}
            title="Menu"
            className="md:hidden flex items-center justify-center h-8 w-8 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/[0.1] text-zinc-200 hover:text-white cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">more_vert</span>
          </motion.button>
        </div>
      </header>

      {/* Main Workspace Area (Center Stage + Right Track Sidebar) */}
      <main className="flex-1 flex overflow-hidden relative bg-transparent">
        {/* Editor Center Stage (Permanent Warm Mount - Zero DOM Teardown).
            Hidden from paint (not unmounted) under hash views so the
            transparent overlay never double-renders editor + view. */}
        <div
          className={`flex-1 flex flex-col overflow-hidden relative bg-transparent ${
            activeHashView !== 'editor' ? 'pointer-events-none select-none invisible' : ''
          }`}
          aria-hidden={activeHashView !== 'editor'}
        >
          {viewTab === 'editor' && (
            <div className="flex-1 flex flex-col overflow-hidden relative h-full">
              <LyricEditor
                lines={filteredLines}
                activeLineIndex={activeLineIndex}
                setActiveLineIndex={setActiveLineIndex}
                currentTime={displayTime}
                activeTokenIndex={activeTokenIndex}
                setActiveTokenIndex={setActiveTokenIndex}
                collabPeers={collab.peers}
                onStampLineStart={(idx, time) => setLineStart(idx, time !== undefined ? time : rawTime)}
                onStampLineEnd={(idx, time) => setLineEnd(idx, time !== undefined ? time : rawTime)}
                onUpdateLineText={updateLineText}
                onAddLine={addLine}
                onDeleteLine={deleteLine}
                onDivideLineIntoWords={divideLineIntoWords}
                onDivideAllLines={divideAllLines}
                onTokenizeLine={tokenizeLine}
                onBatchTokenizeAll={batchTokenizeAll}
                onSetWordToken={setWordToken}
                onSetWordTokenText={setWordTokenText}
                onToggleWordEmphasis={toggleWordEmphasis}
                onToggleLineEmphasis={toggleLineEmphasis}
                onRemoveWordTokens={removeWordTokens}
                onUpdateWordTokens={updateWordTokens}
                onSeek={handleSeek}
                precisionMode={isPrecision}
                autoFollowPlayhead={autoFollowPlayhead}
                onToggleAutoFollow={setAutoFollowPlayhead}
                onInputFocusChange={setIsInputFocused}
                onActionToast={showActionToast}
                onUndo={undo}
                isHoldSyncing={isHoldSyncing}
                onSetLineVocalist={setLineVocalist}
                onTriggerImport={triggerLrcPicker}
                onOpenPasteLyrics={() => navigateToHash('paste')}
                onImportFile={handleIncomingFile}
                onConvertToRomaji={hasJapaneseLyrics ? handleConvertToRomaji : undefined}
                onConvertToRomanHindi={hasHindiLyrics ? handleConvertToRomanHindi : undefined}
                onConvertToKoreanRoman={hasKoreanLyrics ? handleConvertToKoreanRoman : undefined}
                detectedIndicLanguages={detectedIndicLanguages}
                onConvertToIndicRoman={handleConvertToIndicRoman}
                onShiftAllTimestamps={shiftAllTimestamps}
                onStartTutorial={isTutorialEnabled ? handleStartTutorial : undefined}
              />
              {settings.enableTimelineEditor && (
                <TimelineEditor
                  lines={doc.lines}
                  activeLineIndex={activeLineIndex}
                  onSelectLine={(idx) => setActiveLineIndex(idx)}
                  currentTime={displayTime}
                  duration={doc.metadata.duration}
                  onSeek={handleSeek}
                  onUpdateLineTiming={setLineTiming}
                  onSetWordToken={setWordToken}
                  isOpen={isTimelineOpen}
                  onToggleOpen={() => setIsTimelineOpen((prev) => !prev)}
                  isPlaying={isExternalPlaying || Boolean(wavesurfer?.isPlaying())}
                />
              )}
            </div>
          )}

          {viewTab === 'preview' && (
            <div
              onClickCapture={handleStageFocusClickCapture}
              className={
                isStageFocused
                  ? 'fixed inset-0 z-[200] bg-black'
                  : 'flex-1 flex flex-col overflow-hidden relative h-full'
              }
            >
              <LyricRenderer
                lines={doc.lines}
                currentTime={displayTime}
                songTitle={activeSongTitle}
                artistName={doc.metadata.artist}
                coverArt={doc.metadata.coverArt}
                onSeek={handleSeek}
                viewMode={rendererMode}
                onViewModeChange={setRendererMode}
                hasBackdrop={rendererMode !== 'editorial' && rendererMode !== 'peak' && rendererMode !== 'colors' && rendererMode !== 'flythrough' && Boolean(doc.metadata.youtubeId)}
                palette={palette}
                editorialMaxLines={settings.editorialMaxLines ?? 4}
                editorialCleanLyrics={settings.editorialCleanLyrics ?? true}
                editorialWordsPerRow={settings.editorialWordsPerRow ?? 0}
                onUpdateEditorialSettings={handleUpdateEditorialSettings}
                onUndoEditorial={handleUndoEditorialSettings}
                canUndoEditorial={editorialHistory.length > 0}
                stageFontFamily={settings.stageFontFamily ?? 'poppins'}
                stageFontWeight={settings.stageFontWeight ?? '500'}
                onUpdateStageSettings={handleUpdateSettings}
                alveDayNight={settings.alveDayNight ?? true}
                alveAnimation={settings.alveAnimation ?? true}
                alveDim={settings.alveDim ?? 0.25}
                alveTimeMode={settings.alveTimeMode ?? 'cycle'}
                alveFontSize={settings.alveFontSize ?? 1}
                onUpdateAlveSettings={handleUpdateSettings}
                peakTextX={settings.peakTextX ?? 0}
                peakTextY={settings.peakTextY ?? 16}
                peakFontSize={settings.peakFontSize ?? 1}
                peakParallax={settings.peakParallax ?? false}
                onUpdatePeakSettings={handleUpdateSettings}
                colorsBeatDivision={settings.colorsBeatDivision ?? '4'}
                colorsFontFamily={settings.colorsFontFamily ?? 'anton'}
                colorsFontSize={settings.colorsFontSize ?? 1}
                onUpdateColorsSettings={handleUpdateSettings}
                onOpenBpmModal={() => setIsBpmModalOpen(true)}
                onActionToast={showActionToast}
                bpm={doc.metadata.bpm}
                onBpmDetected={(bpm) => updateMetadata({ bpm })}
              />
            </div>
          )}

          {viewTab === 'split' && (
            <div className="flex-1 flex flex-col overflow-hidden relative h-full">
              <div
                ref={splitContainerRef}
                className="flex-1 flex overflow-hidden relative z-10 bg-transparent"
              >
                <div
                  style={{ width: `${splitPercent}%` }}
                  className={`flex flex-col min-w-[320px] max-w-[80%] bg-transparent overflow-hidden shrink-0 ${
                    isDraggingSplit ? 'pointer-events-none select-none' : ''
                  }`}
                >
                  <LyricEditor
                    lines={filteredLines}
                    activeLineIndex={activeLineIndex}
                    setActiveLineIndex={setActiveLineIndex}
                    currentTime={displayTime}
                    activeTokenIndex={activeTokenIndex}
                    setActiveTokenIndex={setActiveTokenIndex}
                    collabPeers={collab.peers}
                    onStampLineStart={(idx, time) => setLineStart(idx, time !== undefined ? time : rawTime)}
                    onStampLineEnd={(idx, time) => setLineEnd(idx, time !== undefined ? time : rawTime)}
                    onUpdateLineText={updateLineText}
                    onAddLine={addLine}
                    onDeleteLine={deleteLine}
                    onDivideLineIntoWords={divideLineIntoWords}
                    onDivideAllLines={divideAllLines}
                    onTokenizeLine={tokenizeLine}
                    onBatchTokenizeAll={batchTokenizeAll}
                    onSetWordToken={setWordToken}
                    onSetWordTokenText={setWordTokenText}
                    onToggleWordEmphasis={toggleWordEmphasis}
                    onToggleLineEmphasis={toggleLineEmphasis}
                    onRemoveWordTokens={removeWordTokens}
                    onUpdateWordTokens={updateWordTokens}
                    onSeek={handleSeek}
                    precisionMode={isPrecision}
                    autoFollowPlayhead={autoFollowPlayhead}
                    onToggleAutoFollow={setAutoFollowPlayhead}
                    onInputFocusChange={setIsInputFocused}
                    onActionToast={showActionToast}
                    onUndo={undo}
                    isHoldSyncing={isHoldSyncing}
                    onSetLineVocalist={setLineVocalist}
                    onTriggerImport={triggerLrcPicker}
                    onOpenPasteLyrics={() => navigateToHash('paste')}
                    onImportFile={handleIncomingFile}
                    onConvertToRomaji={hasJapaneseLyrics ? handleConvertToRomaji : undefined}
                    onConvertToRomanHindi={hasHindiLyrics ? handleConvertToRomanHindi : undefined}
                    onConvertToKoreanRoman={hasKoreanLyrics ? handleConvertToKoreanRoman : undefined}
                    detectedIndicLanguages={detectedIndicLanguages}
                    onConvertToIndicRoman={handleConvertToIndicRoman}
                    onShiftAllTimestamps={shiftAllTimestamps}
                    onStartTutorial={isTutorialEnabled ? handleStartTutorial : undefined}
                  />
                </div>

                {/* Adjustable Split Divider */}
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-valuenow={Math.round(splitPercent)}
                  aria-valuemin={20}
                  aria-valuemax={80}
                  aria-label="Adjust editor and stage split ratio"
                  tabIndex={0}
                  onPointerDown={handleSplitPointerDown}
                  onDoubleClick={() => {
                    setSplitPercent(50);
                    try {
                      localStorage.setItem('openlyryc:split-percent', '50');
                    } catch {}
                  }}
                  onKeyDown={handleSplitKeyDown}
                  className="relative w-3 -mx-1.5 z-30 group cursor-col-resize select-none flex items-center justify-center outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                  title="Drag left or right to adjust split view (Double-click to reset 50:50)"
                >
                  <div
                    className={`w-0 h-full transition-colors ${
                      isDraggingSplit
                        ? 'border-r-2 border-dotted border-white'
                        : 'border-r border-solid border-white/[0.08] group-hover:border-r-2 group-hover:border-dotted group-hover:border-white/90'
                    }`}
                  />
                </div>

                <div
                  className={`flex-1 flex flex-col min-w-[280px] bg-transparent overflow-hidden ${
                    isDraggingSplit ? 'pointer-events-none select-none' : ''
                  }`}
                >
                  <LyricRenderer
                    lines={doc.lines}
                    currentTime={displayTime}
                    songTitle={activeSongTitle}
                    artistName={doc.metadata.artist}
                    coverArt={doc.metadata.coverArt}
                    onSeek={handleSeek}
                    viewMode={rendererMode}
                    onViewModeChange={setRendererMode}
                    hasBackdrop={false}
                    palette={palette}
                    editorialMaxLines={settings.editorialMaxLines ?? 4}
                    editorialCleanLyrics={settings.editorialCleanLyrics ?? true}
                    editorialWordsPerRow={settings.editorialWordsPerRow ?? 0}
                    onUpdateEditorialSettings={handleUpdateEditorialSettings}
                    onUndoEditorial={handleUndoEditorialSettings}
                    canUndoEditorial={editorialHistory.length > 0}
                    stageFontFamily={settings.stageFontFamily ?? 'poppins'}
                    stageFontWeight={settings.stageFontWeight ?? '500'}
                    onUpdateStageSettings={handleUpdateSettings}
                    alveDayNight={settings.alveDayNight ?? true}
                    alveAnimation={settings.alveAnimation ?? true}
                    alveDim={settings.alveDim ?? 0.25}
                    alveTimeMode={settings.alveTimeMode ?? 'cycle'}
                    alveFontSize={settings.alveFontSize ?? 1}
                    onUpdateAlveSettings={handleUpdateSettings}
                    peakTextX={settings.peakTextX ?? 0}
                    peakTextY={settings.peakTextY ?? 16}
                    peakFontSize={settings.peakFontSize ?? 1}
                    peakParallax={settings.peakParallax ?? false}
                    onUpdatePeakSettings={handleUpdateSettings}
                    colorsBeatDivision={settings.colorsBeatDivision ?? '4'}
                    onUpdateColorsSettings={handleUpdateSettings}
                    onOpenBpmModal={() => setIsBpmModalOpen(true)}
                    onActionToast={showActionToast}
                    bpm={doc.metadata.bpm}
                    onBpmDetected={(bpm) => updateMetadata({ bpm })}
                  />
                </div>
              </div>
              {settings.enableTimelineEditor && (
                <TimelineEditor
                  lines={doc.lines}
                  activeLineIndex={activeLineIndex}
                  onSelectLine={(idx) => setActiveLineIndex(idx)}
                  currentTime={displayTime}
                  duration={doc.metadata.duration}
                  onSeek={handleSeek}
                  onUpdateLineTiming={setLineTiming}
                  onSetWordToken={setWordToken}
                  isOpen={isTimelineOpen}
                  onToggleOpen={() => setIsTimelineOpen((prev) => !prev)}
                  isPlaying={isExternalPlaying || Boolean(wavesurfer?.isPlaying())}
                />
              )}
            </div>
          )}

          {viewTab === 'timeline' && (
            <div className="flex-1 flex flex-col overflow-hidden relative h-full">
              <ClassicNLEStudio
                doc={doc}
                activeLineIndex={activeLineIndex}
                onSelectLine={(idx) => setActiveLineIndex(idx)}
                currentTime={displayTime}
                duration={
                  doc.metadata.duration && doc.metadata.duration >= 1
                    ? doc.metadata.duration
                    : (doc.lines && doc.lines.length > 0 ? doc.lines[doc.lines.length - 1].end : 0)
                }
                isPlaying={isExternalPlaying || Boolean(wavesurfer?.isPlaying())}
                onSeek={handleSeek}
                onTogglePlay={togglePlay}
                onUpdateLineTiming={setLineTiming}
                onSetLineLayer={setLineLayer}
                onReorderLines={reorderLines}
                onUpdateMetadata={updateMetadata}
                onUpdateLineText={updateLineText}
                onSetWordToken={setWordToken}
                onSetWordTokenText={setWordTokenText}
                onSetLineVocalist={setLineVocalist}
                onAddLine={addLine}
                onDeleteLine={deleteLine}
                onDivideLineIntoWords={divideLineIntoWords}
                onToggleLineEmphasis={toggleLineEmphasis}
                onUndo={undo}
                onRedo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
                youtubeId={doc.metadata.youtubeId}
                palette={palette}
                monitorMode={nleMonitorMode}
                onMonitorModeChange={setNleMonitorMode}
                wavesurfer={wavesurfer}
                currentAudioFile={currentAudioFile}
                audioSourceMode={audioSourceMode}
                onAudioSelect={processAudioFile}
              />
            </div>
          )}

          {/* Floating Corner Picture-in-Picture or In-Stage Canvas YouTube Embed */}
          {doc.metadata.youtubeId && (
            <YouTubeCornerEmbed
              youtubeId={doc.metadata.youtubeId}
              isOpen={isYouTubeEmbedOpen && activeHashView === 'editor' && audioSourceMode === 'yt'}
              onClose={handleCloseYouTubeEmbed}
              wavesurfer={wavesurfer}
              isLocalAudioLoaded={
                audioSourceMode === 'stream' ||
                audioSourceMode === 'local' ||
                (audioSourceMode === 'connect' && Boolean(currentAudioFile))
              }
              onExternalTimeUpdate={setExternalPlaybackTime}
              onExternalPlayStateChange={handleExternalPlayStateChange}
              onDurationDetected={handleDurationDetected}
              framerateTarget={settings.framerateTarget}
              videoDisplayMode={
                rendererMode === 'editorial'
                  ? 'pip'
                  : viewTab === 'preview'
                  ? 'backdrop'
                  : 'pip'
              }
              disableBackdropMode={rendererMode === 'editorial'}
              isTimelineMode={viewTab === 'timeline'}
              nleMonitorMode={nleMonitorMode}
              onToggleDisplayMode={handleToggleVideoDisplayMode}
              backdropOpacity={settings.videoBackdropOpacity}
              backdropBlur={settings.videoBackdropBlur}
              videoQualityPreference={settings.videoQualityPreference}
            />
          )}

          {/* OpenLyryc Studio Connect: downloads the matched track straight into the Studio */}
          {doc.metadata.youtubeId && (
            <StudioConnectPlayer
              youtubeId={doc.metadata.youtubeId}
              isOpen={audioSourceMode === 'connect'}
              onResolvedFile={(file, title) => {
                ingestConnectFile(file, title);
                showActionToast(`Studio Connect: ${title}`, null, { actionType: 'info' });
              }}
              onError={(message) => {
                setConnectError(message);
                showActionToast(message);
              }}
              onStatusChange={setConnectStatus}
            />
          )}
        </div>
      </main>

      {/* Audio Waveform Canvas & Transport Bar (Docked Bottom Footer - Always Warm Mounted) */}
      <div
        className={
          (!isMobile || viewTab === 'editor') && viewTab !== 'timeline'
            ? 'w-full shrink-0'
            : 'absolute -top-[9999px] -left-[9999px] w-[600px] h-0 overflow-hidden pointer-events-none opacity-0'
        }
      >
        {audioSourceMode === 'sc' && doc.metadata.soundcloudUrl ? (
          <SoundCloudBottomEmbed
            soundcloudUrl={doc.metadata.soundcloudUrl}
            isOpen={true}
            coverArt={doc.metadata.coverArt}
            onClose={() => {
              handleAudioSourceModeChange('none');
            }}
            onOpenChangeTrack={() => setIsSoundCloudModalOpen(true)}
            onSwitchToWaveform={() => {
              handleAudioSourceModeChange(currentAudioFile ? 'local' : doc.metadata.youtubeId ? 'yt' : 'none');
            }}
            hasYouTube={Boolean(doc.metadata.youtubeId)}
            onSwitchToYouTube={() => handleAudioSourceModeChange('yt')}
            onExternalTimeUpdate={(t) => setExternalPlaybackTime(t)}
            onExternalPlayStateChange={handleExternalPlayStateChange}
            onDurationDetected={handleDurationDetected}
            trackTitle={doc.metadata.title}
            artistName={doc.metadata.artist}
          />
        ) : (
          <WaveformPlayer
            onWaveSurferInit={setWavesurfer}
            currentTime={displayTime}
            currentAudioFile={currentAudioFile}
            onAudioSelect={processAudioFile}
            onDurationDetected={handleDurationDetected}
            externalDuration={
              doc.metadata.duration && doc.metadata.duration >= 1
                ? doc.metadata.duration
                : (doc.lines && doc.lines.length > 0 ? doc.lines[doc.lines.length - 1].end : 0)
            }
            isExternalPlaying={isExternalPlaying}
            onTogglePlay={togglePlay}
            onSeek={handleSeek}
            trackTitle={activeSongTitle}
            hasYouTubeEmbed={Boolean(doc.metadata.youtubeId)}
            hasSoundCloudEmbed={Boolean(doc.metadata.soundcloudUrl)}
            isConnectAvailable={isConnectAvailable}
            connectStatus={connectStatus}
            audioSourceMode={audioSourceMode}
            onAudioSourceModeChange={handleAudioSourceModeChange}
            resolvedStreamUrl={resolvedStreamUrl}
            isResolvingStream={isResolvingStream}
            hasStreamResolver={hasStreamResolver}
            onTriggerStreamResolve={() => resolveCurrentTrackStream(true)}
            isResolvingSoundCloud={isResolvingSoundCloud}
            isConnectResolving={isResolvingConnect}
            onTriggerConnectResolve={handleModalFetchConnect}
            onTriggerSoundCloudResolve={handleModalFetchSoundCloud}
            loopRegion={loopRegion}
            onClearLoop={() => setLoopRegion(null)}
            lines={doc.lines}
            isCompanionOnline={isCompanionOnline || isCompanionPaired()}
          />
        )}
      </div>

      {/* Mobile Touch Sync Controller Bar (Docked above bottom nav on mobile in Editor mode) */}
      {activeHashView === 'editor' && viewTab === 'editor' && (
          <div className="md:hidden sticky bottom-14 left-0 right-0 z-30 bg-[#0f0f12]/95 border-t border-white/[0.1] px-4 py-2.5 backdrop-blur-md flex items-center justify-between gap-2 shadow-2xl studio-chrome">
          <button
            onClick={() => seekRelative(-0.5)}
            className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.1] text-zinc-300 active:scale-95 flex items-center justify-center cursor-pointer"
            title="Nudge -500ms"
          >
            <span className="material-symbols-outlined text-[18px]">replay_5</span>
          </button>

          <button
            onClick={() => stampActiveStart()}
            className="flex-1 min-h-[44px] rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
            title="Stamp Line Start (Touch)"
          >
            <span className="material-symbols-outlined text-[18px]">play_circle</span>
            <span>Stamp Start</span>
          </button>

          <button
            onClick={togglePlay}
            className="w-12 h-12 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-lg active:scale-95 cursor-pointer shrink-0"
            title="Play / Pause"
          >
            <span className="material-symbols-outlined fill text-[24px]">
              {isExternalPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          <button
            onClick={() => stampActiveEnd()}
            className="flex-1 min-h-[44px] rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
            title="Stamp Line End & Advance"
          >
            <span className="material-symbols-outlined text-[18px]">stop_circle</span>
            <span>End & Next</span>
          </button>

          <button
            onClick={() => seekRelative(0.5)}
            className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.1] text-zinc-300 active:scale-95 flex items-center justify-center cursor-pointer"
            title="Nudge +500ms"
          >
            <span className="material-symbols-outlined text-[18px]">forward_5</span>
          </button>
        </div>
      )}

      {/* Full-Screen Modal Sub-Pages Overlay Layer (Hardware Accelerated & Zero Background Teardown)
          Rendered through a PORTAL to document.body. Two layout bugs forced this:
            1. `absolute inset-0` resolved against the viewport column, which also
               holds the header + workspace + waveform transport — the transport
               rendered on top of sub-pages (cards sliding under the footer).
            2. That column is `z-[1]`, so its fixed child could never rise above
               the left dock (`aside`, z-50) — a sibling, later in DOM order.
          Portaling to body escapes both: a true full-viewport layer whose z-50
          competes at the root stacking context. Opaque bg keeps the ambient
          gradient / backdrop from bleeding through. */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {activeHashView !== 'editor' && (
          <motion.div
            key="studio-modal-subpage-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            data-studio-overlay={activeHashView}
            className="fixed inset-0 z-[70] bg-[#08080a] flex flex-col overflow-hidden"
            style={{ willChange: 'opacity, transform' }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeHashView}
                initial={{ opacity: 0, scale: 0.998 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.998 }}
                transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                className="w-full h-full flex flex-col overflow-hidden"
                style={{ willChange: 'opacity, transform' }}
              >
                {activeHashView === 'projects' && (
                  <ProjectsView
                    onBack={() => navigateToHash('editor')}
                    onSelectProject={(project) => {
                      handleSelectProject(project);
                      navigateToHash('editor');
                    }}
                    onNewBlankProject={handleNewBlankProject}
                    activeProjectId={activeProjectId}
                    currentTitle={activeSongTitle}
                  />
                )}

                {activeHashView === 'export' && (
                  <ExportView
                    onBack={() => navigateToHash('editor')}
                    document={{
                      ...doc,
                      metadata: { ...doc.metadata, title: activeSongTitle },
                    }}
                    onDownload={handleDownload}
                    onOpenUnisonSubmit={() => setIsUnisonSubmitModalOpen(true)}
                  />
                )}

                {activeHashView === 'settings' && (
                  <SettingsView
                    settings={settings}
                    onUpdateSettings={handleUpdateSettings}
                    onBack={() => navigateToHash('editor')}
                    activeCategory={settingsCategory}
                    onSelectCategory={setSettingsCategory}
                    precisionMode={isPrecision}
                    onTogglePrecision={() => updateMetadata({ precisionMode: !isPrecision })}
                    audioOffset={doc.metadata.offset || 0}
                    onUpdateOffset={(offset) => updateMetadata({ offset })}
                    document={doc}
                    songTitle={activeSongTitle}
                    onDownloadFile={handleDownload}
                    onUploadBackdrop={(file) => void handleBackdropFile(file)}
                    onOpenBpmModal={() => setIsBpmModalOpen(true)}
                    currentBpm={doc.metadata.bpm}
                  />
                )}

                {activeHashView === 'shortcuts' && (
                  <ShortcutsView onBack={() => navigateToHash('editor')} />
                )}

                {activeHashView === 'plugins' && PLUGINS_ENABLED && (
                  <PluginsView onBack={() => navigateToHash('editor')} />
                )}

                {isMonoModalOpen && PLUGINS_ENABLED && (
                  <MonochromeFetchModal
                    isOpen={isMonoModalOpen}
                    onClose={() => setIsMonoModalOpen(false)}
                    initialQuery={
                      doc.metadata.title && doc.metadata.title !== 'Untitled Track'
                        ? `${doc.metadata.artist || ''} ${doc.metadata.title}`.trim()
                        : ''
                    }
                    onLoadFile={handleMonochromeFile}
                  />
                )}

                {isCompanionModalOpen && (
                  <CompanionFetchModal
                    isOpen={isCompanionModalOpen}
                    onClose={() => setIsCompanionModalOpen(false)}
                    initialQuery={
                      doc.metadata.title && doc.metadata.title !== 'Untitled Track'
                        ? `${doc.metadata.artist || ''} ${doc.metadata.title}`.trim()
                        : ''
                    }
                    onSelectAudio={(streamUrl, title) => {
                      setResolvedStreamUrl(streamUrl);
                      setAudioSourceMode('stream');
                      setIsYouTubeEmbedOpen(false);
                      if (title && (!doc.metadata.title || doc.metadata.title === 'Untitled Track')) {
                        updateMetadata({ title });
                      }
                      showActionToast('Loaded audio from Companion bridge');
                    }}
                  />
                )}

                {activeHashView === 'revisions' && (
                  <RevisionHistoryView
                    onBack={() => navigateToHash('editor')}
                    songId={
                      doc.metadata.canonicalKey
                        ? `cl_${doc.metadata.canonicalKey.replace(/[^a-z0-9]/g, '_')}`
                        : undefined
                    }
                    songTitle={activeSongTitle}
                    currentDocument={doc}
                    onRestoreRevision={(revDoc) => {
                      if (revDoc && revDoc.lines) {
                        setDocument(revDoc);
                        showActionToast('Restored revision snapshot');
                        navigateToHash('editor');
                      }
                    }}
                  />
                )}

                {activeHashView === 'search' && (
                  <CloudSearchView
                    onBack={() => navigateToHash('editor')}
                    onSelectSong={(newDoc, song) => {
                      handleSelectCloudSong(newDoc, song);
                      navigateToHash('editor');
                    }}
                  />
                )}

                {activeHashView === 'paste' && (
                  <PasteLyricsView
                    onBack={() => navigateToHash('editor')}
                    onImportText={(text) => {
                      handleImportLyricsText(text);
                      navigateToHash('editor');
                    }}
                  />
                )}

                {activeHashView === 'collab' && (
                  <CollabView
                    onBack={() => navigateToHash('editor')}
                    roomId={collab.roomId}
                    roomUrl={collab.roomUrl}
                    roomMode={collab.roomMode}
                    transport={collab.transport}
                    isConnected={collab.isConnected}
                    isConnecting={collab.isConnecting}
                    isHost={collab.isHost}
                    peers={collab.peers}
                    localUser={collab.localUser}
                    connectionError={collab.connectionError}
                    stageConfig={collab.stageConfig}
                    playbackState={collab.playbackState}
                    audioTransfer={collab.audioTransfer}
                    onCreateRoom={(mode, t) => collab.createRoom(mode, t)}
                    onJoinRoom={(id, mode, t) => collab.joinRoom(id, false, undefined, mode, t)}
                    onLeaveRoom={() => collab.leaveRoom()}
                    onUpdateProfile={collab.updateLocalProfile}
                    onUpdateStageConfig={(st) => {
                      setRendererMode(st.mode);
                      collab.broadcastStageConfig({
                        ...st,
                        viewTab,
                        roomMode: collab.roomMode,
                        colorsBeatDivision: st.colorsBeatDivision ?? settings.colorsBeatDivision ?? '4',
                        colorsFontFamily: st.colorsFontFamily ?? settings.colorsFontFamily ?? 'anton',
                        colorsFontSize: st.colorsFontSize ?? settings.colorsFontSize ?? 1,
                      });
                    }}
                    onUpdateRoomMode={collab.updateRoomMode}
                    onRequestAudio={collab.requestAudioFromHost}
                  />
                )}

                {activeHashView === 'publish' && (
                  <CloudPublishView
                    onBack={() => navigateToHash('editor')}
                    document={doc}
                    onPublished={(res) => {
                      showActionToast(`Revision ${res.revisionHash ? res.revisionHash.slice(0, 7) : ''} published to cloud`);
                      navigateToHash('editor');
                    }}
                    onOpenSidebar={() => {
                      navigateToHash('metadata');
                    }}
                  />
                )}

                {activeHashView === 'share' && (
                  <TurnstileGate
                    section="share"
                    onBack={() => navigateToHash('editor')}
                  >
                    <SharePreviewView
                      onBack={() => navigateToHash('editor')}
                      document={{
                        ...doc,
                        metadata: { ...doc.metadata, title: activeSongTitle },
                      }}
                      songId={
                        doc.metadata.canonicalKey
                          ? `cl_${doc.metadata.canonicalKey.replace(/[^a-z0-9]/g, '_')}`
                          : `cl_song_${(doc.metadata.artist || 'artist').toLowerCase().replace(/[^a-z0-9]/g, '')}_${(activeSongTitle || 'untitled').toLowerCase().replace(/[^a-z0-9]/g, '')}`
                      }
                    />
                  </TurnstileGate>
                )}

                {activeHashView === 'metadata' && (
                  <TurnstileGate
                    section="metadata"
                    onBack={() => navigateToHash('editor')}
                  >
                    <TrackMetadataView
                      metadata={doc.metadata}
                      lines={doc.lines}
                      onUpdateMetadata={updateMetadata}
                      onOpenBpmModal={() => setIsBpmModalOpen(true)}
                      onBack={() => navigateToHash('editor')}
                      currentAudioFile={currentAudioFile}
                      onAudioUpload={processAudioFile}
                      isYouTubeEmbedOpen={isYouTubeEmbedOpen}
                      onToggleYouTubeEmbed={() => setIsYouTubeEmbedOpen((prev) => !prev)}
                    />
                  </TurnstileGate>
                )}

                {activeHashView === 'unison' && (
                  <TurnstileGate
                    section="unison"
                    onBack={() => navigateToHash('editor')}
                  >
                    <UnisonExplorerView
                      onBack={() => navigateToHash('editor')}
                      onStartTimingSong={handleStartTimingUnisonSong}
                      onOpenProfileModal={() => setIsUserProfileModalOpen(true)}
                    />
                  </TurnstileGate>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>

      {/* Mobile Bottom Navigation Bar (Thumb ergonomics on phone screens) */}
      {activeHashView === 'editor' && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-[#09090b]/95 border-t border-white/[0.08] backdrop-blur-md flex items-center justify-around px-2 select-none studio-chrome">
          <button
            onClick={() => {
              setViewTab('editor');
            }}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${
              viewTab === 'editor' ? 'text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Edit3 className="w-5 h-5" />
            <span className="text-[10px] font-sans">Editor</span>
          </button>

          <button
            onClick={() => {
              setViewTab('preview');
            }}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${
              viewTab === 'preview' ? 'text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Tv className="w-5 h-5" />
            <span className="text-[10px] font-sans">Performance</span>
          </button>

          <button
            onClick={() => navigateToHash('metadata')}
            className="flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer"
          >
            <Music className="w-5 h-5" />
            <span className="text-[10px] font-sans">Track Info</span>
          </button>

          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer"
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-sans">Actions</span>
          </button>
        </nav>
      )}
      </>
      )}

      {/* Mobile Actions Bottom Sheet Modal */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#121216] border-t border-white/10 rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-200"
          >
            <div className="w-12 h-1 rounded-full bg-white/20 mx-auto" />
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-bold text-sm text-white">Studio Quick Actions</h3>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Contributor Profile Card */}
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsUserProfileModalOpen(true);
              }}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] text-zinc-100 transition-colors cursor-pointer select-none"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-white/[0.06] ring-1 ring-white/15 flex items-center justify-center shrink-0">
                  {userProfile.avatarUrl ? (
                    <img src={userProfile.avatarUrl} alt={userProfile.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-white">{(userProfile.displayName || 'L').slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 text-left">
                  <div className="text-xs font-medium text-white truncate">{userProfile.displayName}</div>
                  <div className="text-[10px] text-zinc-400 truncate">
                    {userProfile.username ? `@${userProfile.username}` : 'Claim @username'}
                  </div>
                </div>
              </div>
              <span className="text-[11px] text-zinc-400 font-medium">Profile &rarr;</span>
            </button>

            <div className="grid grid-cols-2 gap-2.5 text-xs font-medium">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigateToHash('projects');
                }}
                className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 cursor-pointer"
              >
                <Folder className="w-4 h-4 text-zinc-300" />
                <span>Projects</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigateToHash('search');
                }}
                className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base text-zinc-300">library_music</span>
                <span>Cloud Catalog</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigateToHash('paste');
                }}
                className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base text-zinc-300">content_paste</span>
                <span>Got lyrics already? Paste it here</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  triggerLrcPicker();
                }}
                className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base text-zinc-300">file_open</span>
                <span>Import LRC</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigateToHash('export');
                }}
                className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base text-zinc-300">file_download</span>
                <span>Export Lyrics</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigateToHash('share');
                }}
                className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base text-zinc-300">share</span>
                <span>Share Preview</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigateToHash('unison');
                }}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 cursor-pointer"
              >
                <BetterLyricsLogo size={16} variant="color" className="shrink-0" />
                <span className="text-sm font-medium">Unison Hub</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsUnisonSubmitModalOpen(true);
                }}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 cursor-pointer"
              >
                <BetterLyricsLogo size={16} variant="monochrome" className="text-white" />
                <span className="text-sm font-medium">Publish to Unison</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigateToHash('revisions');
                }}
                className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base text-zinc-300">history</span>
                <span>Revisions</span>
              </button>

              {PLUGINS_ENABLED && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigateToHash('plugins');
                }}
                className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base text-zinc-300">extension</span>
                <span>Plugins & Add-ons</span>
              </button>
              )}

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigateToHash('metadata');
                }}
                className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base text-zinc-300">music_note</span>
                <span>Track Metadata</span>
                {isCompanionOnline && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                )}
              </button>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigateToHash('shortcuts');
                }}
                className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base text-zinc-300">keyboard</span>
                <span>Shortcuts</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigateToHash('settings');
                }}
                className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base text-zinc-400">tune</span>
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Undo Toast for destructive actions */}
      <UndoToast
        toast={activeToast}
        onDismiss={handleDismissToast}
      />

      {/* No Audio Source Free Playback Confirmation Modal */}
      <NoAudioSourceModal
        isOpen={isNoAudioModalOpen}
        onClose={() => setIsNoAudioModalOpen(false)}
        onConfirmFreePlay={startFreePlayback}
        onOpenAudioUpload={() => audioInputRef.current?.click()}
        onFetchYouTube={handleModalFetchYouTube}
        fetchYouTubeError={ytFetchError}
        canFetchYouTube={Boolean(doc.metadata.artist || doc.metadata.title)}
        onFetchSoundCloud={handleModalFetchSoundCloud}
        canFetchSoundCloud={Boolean(doc.metadata.artist?.trim() || doc.metadata.title?.trim())}
        isCompanionOnline={isCompanionOnline}
        onFetchCompanion={handleModalFetchCompanion}
        onOpenCompanionModal={() => setIsCompanionModalOpen(true)}
        isConnectAvailable={isConnectAvailable}
        onFetchConnect={handleModalFetchConnect}
        fetchConnectError={connectError}
      />

      {/* SoundCloud Track Selection Modal */}
      <SoundCloudSelectModal
        isOpen={isSoundCloudModalOpen}
        onClose={() => setIsSoundCloudModalOpen(false)}
        currentSoundCloudUrl={doc.metadata.soundcloudUrl}
        defaultQuery={`${doc.metadata.artist || ''} ${doc.metadata.title || ''}`.trim()}
        onSelectTrack={(url, title) => {
          updateMetadata({ soundcloudUrl: url });
          handleAudioSourceModeChange('sc');
          showActionToast(title ? `SoundCloud linked: ${title}` : 'SoundCloud track updated');
        }}
        onClearTrack={() => {
          updateMetadata({ soundcloudUrl: undefined });
          handleAudioSourceModeChange('none');
          showActionToast('SoundCloud track unlinked');
        }}
      />

      {/* About OpenLyryc Studio & What's New Modal */}
      <AboutStudioModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
        enableTutorial={isTutorialEnabled}
      />

      {/* Dedicated Song BPM & Tempo Finder Modal */}
      <BpmSearchModal
        isOpen={isBpmModalOpen}
        onClose={() => setIsBpmModalOpen(false)}
        currentBpm={doc.metadata.bpm}
        trackTitle={doc.metadata.title}
        artistName={doc.metadata.artist}
        onSelectBpm={(bpm, details) => {
          const prevBpm = doc.metadata.bpm;
          updateMetadata({
            bpm,
            ...(details?.key && !doc.metadata.key ? { key: details.key } : {}),
          });
          showActionToast(`Set track tempo to ${bpm} BPM`, () => updateMetadata({ bpm: prevBpm }), {
            actionType: 'info',
          });
        }}
        onClearBpm={() => {
          const prevBpm = doc.metadata.bpm;
          updateMetadata({ bpm: undefined });
          showActionToast('Cleared track tempo', () => updateMetadata({ bpm: prevBpm }), {
            actionType: 'info',
          });
        }}
      />

      {/* Universal User Profile & Connected Services Modal */}
      <UserProfileModal
        isOpen={isUserProfileModalOpen}
        onClose={() => setIsUserProfileModalOpen(false)}
        onOpenUnisonHub={() => {
          setIsUserProfileModalOpen(false);
          navigateToHash('unison');
        }}
        onNameChanged={(newName) => {
          updateMetadata({ syncedBy: newName });
        }}
      />

      {/* Unison Song Explorer & Community Requests ("Most Wanted") */}
      <UnisonHubModal
        isOpen={isUnisonHubModalOpen}
        onClose={() => setIsUnisonHubModalOpen(false)}
        onStartTimingSong={handleStartTimingUnisonSong}
      />

      {/* Direct ECDSA-Signed Unison Submission Modal */}
      <UnisonSubmitModal
        isOpen={isUnisonSubmitModalOpen}
        onClose={() => setIsUnisonSubmitModalOpen(false)}
        document={{
          ...doc,
          metadata: {
            ...doc.metadata,
            syncedBy: userProfile.displayName || doc.metadata.syncedBy || 'OpenLyryc Studio',
          },
        }}
        onOpenProfile={() => {
          setIsUnisonSubmitModalOpen(false);
          setIsUserProfileModalOpen(true);
        }}
      />

      {/* First-Time User Interactive Tutorial & Spotlight Tour (Gated until finalized) */}
      {isTutorialEnabled && (
        <InteractiveTutorial
        isOpen={isTutorialModalOpen}
        isActiveTour={isTutorialTourActive}
        onClose={() => {
          setIsTutorialModalOpen(false);
          setIsTutorialTourActive(false);
        }}
        onStartTour={handleStartTutorial}
        onFinishTour={handleFinishTutorial}
        onStepChange={handleTutorialStepChange}
      />
      )}

      {/* Mindful Screentime Break Overlay */}
      <BreakReminderOverlay
        isOpen={isBreakActive}
        onFinish={finishBreak}
      />
    </div>
  );
}
