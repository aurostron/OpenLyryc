'use client';

import React, { useRef, useState, useMemo } from 'react';
import {
  ArrowLeft,
  Music,
  Disc,
  Upload,
  Trash2,
  Copy,
  Check,
  Search,
  Sliders,
  Eye,
  EyeOff,
  ExternalLink,
  FileAudio,
  Tag,
  Radio,
  Clock,
  Fingerprint,
  Laptop,
  Link2,
  Unlink,
  FolderOpen,
} from 'lucide-react';
import { LyricLine, LyricMetadata } from '@/types/lyrics';
import {
  parseSpotifyTrackId,
  parseYouTubeMusicId,
  parseSoundCloudTrackUrl,
  normalizeIsrc,
  resolveCanonicalSongKey,
} from '@/lib/platformLinker';
import {
  searchYouTubeMatches,
  searchYouTubeDirect,
  DetectedYouTubeMatch,
} from '@/lib/youtubeAutoDetector';
import {
  searchSoundCloudMatches,
  searchSoundCloudDirect,
  DetectedSoundCloudMatch,
} from '@/lib/soundcloudAutoDetector';
import {
  isCompanionPaired,
  getStoredPairCode,
  pairWithCompanion,
  unpairCompanion,
  openCompanionAudioFolder,
} from '@/lib/companionBridge';

export interface TrackMetadataViewProps {
  metadata: LyricMetadata;
  lines?: LyricLine[];
  onUpdateMetadata: (metadata: Partial<LyricMetadata>) => void;
  onBack: () => void;
  currentAudioFile?: File | null;
  onAudioUpload?: (file: File) => void;
  isYouTubeEmbedOpen?: boolean;
  onToggleYouTubeEmbed?: () => void;
  onOpenBpmModal?: () => void;
}

export const TrackMetadataView: React.FC<TrackMetadataViewProps> = React.memo(({
  metadata,
  lines,
  onUpdateMetadata,
  onBack,
  currentAudioFile,
  onAudioUpload,
  isYouTubeEmbedOpen,
  onToggleYouTubeEmbed,
  onOpenBpmModal,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const isPrecision = Boolean(metadata.precisionMode);

  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isAutoDetectingYt, setIsAutoDetectingYt] = useState(false);
  const [autoDetectStatus, setAutoDetectStatus] = useState<string | null>(null);
  const [ytCandidates, setYtCandidates] = useState<DetectedYouTubeMatch[]>([]);
  const [showCandidatePicker, setShowCandidatePicker] = useState(false);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [isSearchingManualYt, setIsSearchingManualYt] = useState(false);
  const [isAutoDetectingSc, setIsAutoDetectingSc] = useState(false);
  const [scAutoDetectStatus, setScAutoDetectStatus] = useState<string | null>(null);
  const [scCandidates, setScCandidates] = useState<DetectedSoundCloudMatch[]>([]);
  const [showScCandidatePicker, setShowScCandidatePicker] = useState(false);
  const [scManualSearchQuery, setScManualSearchQuery] = useState('');
  const [isSearchingManualSc, setIsSearchingManualSc] = useState(false);
  const [isPairedCompanion, setIsPairedCompanion] = useState(() => isCompanionPaired());
  const [localPairCode] = useState(() => {
    const existing = getStoredPairCode();
    if (existing) return existing;
    return Math.floor(1000 + Math.random() * 9000).toString();
  });
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [isPairingLoading, setIsPairingLoading] = useState(false);
  const [pairingMessage, setPairingMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const handlePairSubmit = async (codeToUse?: string) => {
    const code = (codeToUse || manualCodeInput || localPairCode).trim();
    if (code.length !== 4 || !/^\d{4}$/.test(code)) {
      setPairingMessage({ text: 'Please enter a 4-digit numeric code', ok: false });
      return;
    }
    setIsPairingLoading(true);
    setPairingMessage(null);
    try {
      const res = await pairWithCompanion(code);
      if (res.ok && res.paired) {
        setIsPairedCompanion(true);
        setPairingMessage({ text: 'Linked with Desktop Companion', ok: true });
      } else {
        setPairingMessage({ text: res.message || 'Companion not found. Open the desktop app first.', ok: false });
      }
    } catch {
      setPairingMessage({ text: 'Could not connect. Is the companion app running?', ok: false });
    } finally {
      setIsPairingLoading(false);
    }
  };

  const handleUnpairClick = async () => {
    setIsPairingLoading(true);
    await unpairCompanion();
    setIsPairedCompanion(false);
    setPairingMessage({ text: 'Companion unlinked', ok: true });
    setIsPairingLoading(false);
  };

  const canonicalKey = useMemo(() => {
    return resolveCanonicalSongKey(metadata);
  }, [metadata]);

  const handleArtworkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onUpdateMetadata({ coverArt: event.target.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeArtwork = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateMetadata({ coverArt: undefined });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAudioFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAudioUpload) {
      onAudioUpload(file);
    }
  };

  const copyAudioHash = async () => {
    if (!metadata.audioHash) return;
    try {
      await navigator.clipboard.writeText(metadata.audioHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {
      // ignore
    }
  };

  const copyCanonicalKey = async () => {
    if (!canonicalKey) return;
    try {
      await navigator.clipboard.writeText(canonicalKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleManualSearch = async (overrideQuery?: string) => {
    const rawQ = overrideQuery !== undefined ? overrideQuery : manualSearchQuery;
    const query = rawQ.trim();
    if (!query) return;

    setIsSearchingManualYt(true);
    setAutoDetectStatus(null);
    try {
      const targetDuration =
        metadata.duration ||
        (lines && lines.length > 0 ? Math.ceil(lines[lines.length - 1].end) : undefined);

      const { bestMatch, candidates } = await searchYouTubeDirect(query, targetDuration);

      if (candidates.length > 0) {
        setYtCandidates(candidates);
        setShowCandidatePicker(true);
        setAutoDetectStatus(`Found ${candidates.length} candidate videos`);
        setTimeout(() => setAutoDetectStatus(null), 4000);
      } else if (bestMatch && bestMatch.videoId) {
        setYtCandidates([bestMatch]);
        setShowCandidatePicker(true);
        setAutoDetectStatus(`Found: ${bestMatch.title}`);
        setTimeout(() => setAutoDetectStatus(null), 4000);
      } else {
        setAutoDetectStatus('No videos found for this search');
        setTimeout(() => setAutoDetectStatus(null), 4000);
      }
    } catch {
      setAutoDetectStatus('Search timed out');
      setTimeout(() => setAutoDetectStatus(null), 4000);
    } finally {
      setIsSearchingManualYt(false);
    }
  };

  const handleAutoDetectYouTube = async () => {
    const suggested = `${metadata.artist || ''} ${metadata.title || ''}`.trim();
    if (!suggested) return;
    if (!manualSearchQuery) {
      setManualSearchQuery(suggested);
    }
    setIsAutoDetectingYt(true);
    setAutoDetectStatus(null);
    try {
      const targetDuration =
        metadata.duration ||
        (lines && lines.length > 0 ? Math.ceil(lines[lines.length - 1].end) : undefined);

      const { bestMatch, candidates } = await searchYouTubeMatches(
        metadata.artist || '',
        metadata.title || '',
        targetDuration
      );
      if (candidates.length > 0) {
        setYtCandidates(candidates);
        setShowCandidatePicker(true);
      }
      if (bestMatch && bestMatch.videoId) {
        onUpdateMetadata({ youtubeId: bestMatch.videoId });
        setAutoDetectStatus(`Matched: ${bestMatch.title}`);
        setTimeout(() => setAutoDetectStatus(null), 5000);
      } else {
        setAutoDetectStatus('No exact match found');
        setTimeout(() => setAutoDetectStatus(null), 4000);
      }
    } catch {
      setAutoDetectStatus('Detection timed out');
      setTimeout(() => setAutoDetectStatus(null), 4000);
    } finally {
      setIsAutoDetectingYt(false);
    }
  };

  const handleManualSearchSoundCloud = async (overrideQuery?: string) => {
    const rawQ = overrideQuery !== undefined ? overrideQuery : scManualSearchQuery;
    const query = rawQ.trim();
    if (!query) return;

    setIsSearchingManualSc(true);
    setScAutoDetectStatus(null);
    try {
      const { bestMatch, candidates } = await searchSoundCloudDirect(query);

      if (candidates.length > 0) {
        setScCandidates(candidates);
        setShowScCandidatePicker(true);
        setScAutoDetectStatus(`Found ${candidates.length} candidate tracks`);
        setTimeout(() => setScAutoDetectStatus(null), 4000);
      } else if (bestMatch && bestMatch.url) {
        setScCandidates([bestMatch]);
        setShowScCandidatePicker(true);
        setScAutoDetectStatus(`Found: ${bestMatch.title}`);
        setTimeout(() => setScAutoDetectStatus(null), 4000);
      } else {
        setScAutoDetectStatus('No tracks found for this search');
        setTimeout(() => setScAutoDetectStatus(null), 4000);
      }
    } catch {
      setScAutoDetectStatus('SoundCloud search timed out');
      setTimeout(() => setScAutoDetectStatus(null), 4000);
    } finally {
      setIsSearchingManualSc(false);
    }
  };

  const handleAutoDetectSoundCloud = async () => {
    const suggested = `${metadata.artist || ''} ${metadata.title || ''}`.trim();
    if (!suggested) return;
    if (!scManualSearchQuery) {
      setScManualSearchQuery(suggested);
    }
    setIsAutoDetectingSc(true);
    setScAutoDetectStatus(null);
    try {
      const { bestMatch, candidates } = await searchSoundCloudMatches(
        metadata.artist || '',
        metadata.title || ''
      );
      if (candidates.length > 0) {
        setScCandidates(candidates);
        setShowScCandidatePicker(true);
      }
      if (bestMatch && bestMatch.url) {
        onUpdateMetadata({ soundcloudUrl: bestMatch.url });
        setScAutoDetectStatus(`Matched: ${bestMatch.title}`);
        setTimeout(() => setScAutoDetectStatus(null), 5000);
      } else {
        setScAutoDetectStatus('No exact match found');
        setTimeout(() => setScAutoDetectStatus(null), 4000);
      }
    } catch {
      setScAutoDetectStatus('Detection timed out');
      setTimeout(() => setScAutoDetectStatus(null), 4000);
    } finally {
      setIsAutoDetectingSc(false);
    }
  };


  return (
    <div className="flex-1 flex flex-col h-full bg-transparent text-zinc-100 select-none overflow-hidden font-sans">
      {/* Top Header */}
      <header className="h-14 bg-[#0e0e12] border-b border-white/[0.08] px-6 md:px-8 flex items-center justify-between shrink-0 gap-4 studio-chrome">
        <div className="flex items-center gap-3">
          {/* Mobile-only back button */}
          <button
            type="button"
            onClick={onBack}
            className="md:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/[0.1] transition-colors cursor-pointer text-xs font-medium"
            title="Back to Editor"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2]" />
            <span>Back</span>
          </button>
          <div className="md:hidden h-4 w-[1px] bg-white/[0.1]" />

          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-zinc-300" />
            <h1 className="text-sm font-semibold text-white tracking-tight">Track Metadata</h1>
          </div>
          <span className="text-xs text-zinc-500 font-sans hidden sm:inline">
            · {metadata.title || 'Untitled Track'} {metadata.artist ? `by ${metadata.artist}` : ''}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[11px] text-zinc-400 font-sans hidden sm:flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Auto-saved
          </span>
          <div className="text-xs text-zinc-500 font-sans hidden md:inline">
            Esc to close
          </div>
        </div>
      </header>

      {/* Main Form Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
          {/* Left Column: Core Track Info, Identifiers, Timing */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Track Details Card */}
            <div className="p-5 bg-white/[0.02] border border-white/[0.08] rounded-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <h2 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <Music className="w-3.5 h-3.5 text-zinc-400" />
                  Song Details
                </h2>
                <span className="text-[10px] text-zinc-500 font-sans">Standard ID3</span>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1.5">
                    Track Title <span className="text-zinc-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={metadata.title}
                    onChange={(e) => onUpdateMetadata({ title: e.target.value })}
                    placeholder="e.g. Lady (Hear Me Tonight)"
                    className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.05] rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs text-zinc-400 font-medium block mb-1.5">
                      Artist Name <span className="text-zinc-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={metadata.artist}
                      onChange={(e) => onUpdateMetadata({ artist: e.target.value })}
                      placeholder="e.g. Modjo"
                      className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.05] rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 font-medium block mb-1.5">
                      Album Name
                    </label>
                    <input
                      type="text"
                      value={metadata.album || ''}
                      onChange={(e) => onUpdateMetadata({ album: e.target.value })}
                      placeholder="e.g. Modjo (Remastered)"
                      className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.05] rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1.5">
                    Synced By / Lyricist
                  </label>
                  <input
                    type="text"
                    value={metadata.syncedBy || ''}
                    onChange={(e) => onUpdateMetadata({ syncedBy: e.target.value })}
                    placeholder="e.g. OpenLyryc Contributor"
                    className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.05] rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs text-zinc-400 font-medium">
                        Tempo / BPM
                      </label>
                      <button
                        type="button"
                        onClick={() => onOpenBpmModal?.()}
                        className="text-[11px] font-semibold text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Search className="w-3 h-3" />
                        <span>Find Tempo</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="30"
                        max="300"
                        value={metadata.bpm || ''}
                        onChange={(e) => onUpdateMetadata({ bpm: parseInt(e.target.value, 10) || undefined })}
                        placeholder="e.g. 128 (for Colors beat-sync)"
                        className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.05] rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 outline-none transition-all font-sans"
                      />
                      {metadata.bpm && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-sans text-emerald-400 font-bold">
                          BPM
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 font-medium block mb-1.5">
                      Musical Key
                    </label>
                    <input
                      type="text"
                      value={metadata.key || ''}
                      onChange={(e) => onUpdateMetadata({ key: e.target.value })}
                      placeholder="e.g. F# Minor or G Major"
                      className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.05] rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 outline-none transition-all font-sans"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Platform Identifiers Card */}
            <div className="p-5 bg-white/[0.02] border border-white/[0.08] rounded-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <h2 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-zinc-400" />
                  Platform Identifiers
                </h2>
              
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1.5">
                    Spotify Track ID or URL
                  </label>
                  <input
                    type="text"
                    value={metadata.spotifyId || ''}
                    onChange={(e) => {
                      const parsed = parseSpotifyTrackId(e.target.value);
                      onUpdateMetadata({ spotifyId: parsed || e.target.value });
                    }}
                    placeholder="https://open.spotify.com/track/..."
                    className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.05] rounded-xl px-3.5 py-2 text-xs text-white font-sans placeholder:text-zinc-600 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1.5">
                    ISRC Recording Code
                  </label>
                  <input
                    type="text"
                    value={metadata.isrc || ''}
                    onChange={(e) => {
                      const normalized = normalizeIsrc(e.target.value);
                      onUpdateMetadata({ isrc: normalized || e.target.value });
                    }}
                    placeholder="e.g. USUM72400123"
                    className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.05] rounded-xl px-3.5 py-2 text-xs text-white font-sans uppercase placeholder:text-zinc-600 outline-none transition-all"
                  />
                </div>

                {canonicalKey && (
                  <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-xs">
                    <span className="text-zinc-500 font-medium" title="A stable ID derived from title, artist, and ISRC — used for matching across devices.">Song ID:</span>
                    <button
                      type="button"
                      onClick={copyCanonicalKey}
                      className="flex items-center gap-1.5 font-sans text-[11px] text-zinc-300 hover:text-white px-2 py-0.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors cursor-pointer"
                      title="Copy Registry Key"
                    >
                      <span>{canonicalKey}</span>
                      {copiedKey ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-zinc-500" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Sync Engine Calibration Card */}
            <div className="p-5 bg-white/[0.02] border border-white/[0.08] rounded-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <h2 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                  Sync Calibration
                </h2>
              
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-zinc-400 font-medium">
                      Global Time Offset
                    </label>
                    <span className="text-xs font-sans text-white font-semibold tabular-nums">
                      {(metadata.offset ?? 0) > 0 ? `+${metadata.offset}` : metadata.offset ?? 0} ms
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="number"
                      value={metadata.offset ?? 0}
                      onChange={(e) =>
                        onUpdateMetadata({ offset: parseInt(e.target.value, 10) || 0 })
                      }
                      className="flex-1 bg-white/[0.03] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.05] rounded-xl px-3.5 py-1.5 text-xs text-white font-sans tabular-nums outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => onUpdateMetadata({ offset: 0 })}
                      disabled={!metadata.offset}
                      className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] disabled:opacity-30 text-xs text-zinc-400 hover:text-white border border-white/[0.08] transition-all cursor-pointer shrink-0"
                    >
                      Reset (0ms)
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {[-100, -10, 10, 100].map((step) => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => onUpdateMetadata({ offset: (metadata.offset ?? 0) + step })}
                        className="py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-xs font-sans font-medium text-zinc-300 hover:text-white border border-white/[0.06] transition-all cursor-pointer text-center"
                      >
                        {step > 0 ? `+${step}` : step}ms
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-500 font-sans mt-2">
                    Keyboard Hotkeys: <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400 font-semibold">[</kbd> and <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400 font-semibold">]</kbd> in editor (±100ms, Shift: ±10ms)
                  </p>
                </div>

                <div className="pt-3 border-t border-white/[0.04] flex items-center justify-between">
                  <div>
                    <span className="text-xs text-zinc-200 font-medium block">
                      Millisecond Precision Mode
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {isPrecision ? '3 decimals (00:00.000)' : '2 decimals (00:00.00)'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onUpdateMetadata({ precisionMode: !isPrecision })}
                    className={`w-10 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                      isPrecision ? 'bg-white' : 'bg-zinc-800 border border-white/10'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full transition-transform ${
                        isPrecision ? 'translate-x-4 bg-zinc-950' : 'translate-x-0 bg-zinc-400'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Artwork, Audio File, YouTube Video */}
          <div className="lg:col-span-5 space-y-6">
            {/* 4. Cover Artwork & Visuals Card */}
            <div className="p-5 bg-white/[0.02] border border-white/[0.08] rounded-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <h2 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <Disc className="w-3.5 h-3.5 text-zinc-400" />
                  Artwork & Visuals
                </h2>
              </div>

              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleArtworkUpload}
                  accept="image/*"
                  className="hidden"
                />

                {metadata.coverArt ? (
                  <div className="space-y-3">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="relative group rounded-xl overflow-hidden aspect-square border border-white/[0.1] cursor-pointer bg-black/40 shadow-inner"
                    >
                      <img
                        src={metadata.coverArt}
                        alt="Album Cover"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <span className="text-xs font-medium text-white flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          Change Image
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors cursor-pointer"
                      >
                        Replace Image
                      </button>
                      <button
                        type="button"
                        onClick={removeArtwork}
                        className="text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-dashed border-white/[0.1] hover:border-white/30 rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer bg-white/[0.01] hover:bg-white/[0.03] transition-all group"
                  >
                    <Upload className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
                    <span className="text-xs text-zinc-400 group-hover:text-zinc-200 font-medium">
                      Upload Album Cover
                    </span>
                    <span className="text-[10px] text-zinc-600">PNG, JPG, WebP up to 5MB</span>
                  </div>
                )}
              </div>

              {/* Ambient Glow Switch */}
              <div className="pt-3 border-t border-white/[0.04] flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-200 font-medium block">
                    Ambient Glow
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    Pulls colors from the album artwork
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onUpdateMetadata({
                      ambientGlow: metadata.ambientGlow !== false ? false : true,
                    })
                  }
                  className={`w-10 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                    metadata.ambientGlow !== false ? 'bg-white' : 'bg-zinc-800 border border-white/10'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full transition-transform ${
                      metadata.ambientGlow !== false ? 'translate-x-4 bg-zinc-950' : 'translate-x-0 bg-zinc-400'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* 5. Audio File & Fingerprint Card */}
            <div className="p-5 bg-white/[0.02] border border-white/[0.08] rounded-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <h2 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <FileAudio className="w-3.5 h-3.5 text-zinc-400" />
                  Audio Source & Hash
                </h2>
              </div>

              <div className="space-y-3">
                <input
                  type="file"
                  ref={audioInputRef}
                  onChange={handleAudioFileInput}
                  accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg"
                  className="hidden"
                />

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                      <Fingerprint className="w-3.5 h-3.5 text-zinc-500" />
                      SHA-256 Audio Hash
                    </span>
                    {metadata.audioHash ? (
                      <span className="text-[10px] text-emerald-400 font-sans font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Matched
                      </span>
                    ) : currentAudioFile ? (
                      <span className="text-[10px] text-amber-400 font-sans font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        Reading file...
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-500 font-sans">No Local Audio</span>
                    )}
                  </div>

                  {metadata.audioHash ? (
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.04]">
                      <span className="font-sans text-[10px] text-zinc-300 truncate" title={metadata.audioHash}>
                        {metadata.audioHash}
                      </span>
                      <button
                        type="button"
                        onClick={copyAudioHash}
                        title="Copy SHA-256 hash"
                        className="p-1 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
                      >
                        {copiedHash ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="w-full py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-zinc-200 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer font-medium"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{currentAudioFile ? 'Replace Audio File' : 'Select Local Audio File'}</span>
                </button>
                <p className="text-[11px] text-zinc-500 font-sans text-center">
                  Your audio stays on your device. Nothing is uploaded.
                </p>
              </div>
            </div>

            {/* 6. YouTube Video Association Card */}
            <div className="p-5 bg-white/[0.02] border border-white/[0.08] rounded-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <h2 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-zinc-400" />
                  YouTube Synchronization
                </h2>
                {metadata.youtubeId && onToggleYouTubeEmbed && (
                  <button
                    type="button"
                    onClick={onToggleYouTubeEmbed}
                    className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {isYouTubeEmbedOpen ? (
                      <>
                        <EyeOff className="w-3 h-3" />
                        <span>Hide Video</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" />
                        <span>Show Video</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {/* Search Bar + Auto Button */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={manualSearchQuery}
                      onChange={(e) => setManualSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleManualSearch();
                        }
                      }}
                      placeholder={
                        metadata.artist && metadata.title
                          ? `${metadata.artist} - ${metadata.title}`
                          : 'Search YouTube...'
                      }
                      className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.05] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-600 outline-none transition-all"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={isSearchingManualYt}
                    onClick={() =>
                      handleManualSearch(
                        manualSearchQuery.trim() || `${metadata.artist || ''} ${metadata.title || ''}`.trim()
                      )
                    }
                    className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white text-zinc-300 hover:text-zinc-950 text-xs font-medium border border-white/[0.08] transition-all cursor-pointer shrink-0 disabled:opacity-40"
                  >
                    {isSearchingManualYt ? 'Searching...' : 'Find'}
                  </button>

                  <button
                    type="button"
                    disabled={isAutoDetectingYt || (!metadata.artist && !metadata.title)}
                    onClick={handleAutoDetectYouTube}
                    className="px-3 py-1.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold transition-all cursor-pointer shrink-0 disabled:opacity-40 flex items-center gap-1"
                  >
                    <Search className="w-3 h-3" />
                    <span>{isAutoDetectingYt ? 'Matching...' : 'Auto'}</span>
                  </button>
                </div>

                {/* Direct ID / URL Input */}
                <div>
                  <label className="text-[11px] text-zinc-500 block mb-1">
                    Or directly paste video URL / ID:
                  </label>
                  <input
                    type="text"
                    value={metadata.youtubeId || ''}
                    onChange={(e) => {
                      const parsed = parseYouTubeMusicId(e.target.value);
                      onUpdateMetadata({ youtubeId: parsed || e.target.value });
                    }}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.05] rounded-xl px-3 py-1.5 text-xs text-zinc-300 font-sans placeholder:text-zinc-600 outline-none transition-all"
                  />
                </div>

                {autoDetectStatus && (
                  <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>{autoDetectStatus}</span>
                  </p>
                )}

                {/* Candidates list */}
                {ytCandidates.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-white/[0.04]">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>Matches ({ytCandidates.length})</span>
                      <button
                        type="button"
                        onClick={() => setShowCandidatePicker((p) => !p)}
                        className="text-[11px] text-zinc-500 hover:text-white"
                      >
                        {showCandidatePicker ? 'Hide' : 'Show'}
                      </button>
                    </div>

                    {showCandidatePicker && (
                      <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar p-1 rounded-xl bg-black/40 border border-white/[0.06]">
                        {ytCandidates.map((c) => {
                          const isSelected = metadata.youtubeId === c.videoId;
                          const durationFormatted = c.duration
                            ? `${Math.floor(c.duration / 60)}:${(c.duration % 60).toString().padStart(2, '0')}`
                            : '';

                          return (
                            <div
                              key={c.videoId}
                              onClick={() => {
                                onUpdateMetadata({ youtubeId: c.videoId });
                                setAutoDetectStatus(`Selected: ${c.title}`);
                              }}
                              className={`p-2 rounded-lg transition-all text-xs flex items-center gap-2.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-white/10 text-white font-medium border border-white/20'
                                  : 'hover:bg-white/[0.04] text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              <img
                                src={`https://i.ytimg.com/vi/${c.videoId}/default.jpg`}
                                alt=""
                                className="w-10 h-7 object-cover rounded bg-black shrink-0 border border-white/10"
                                loading="lazy"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs truncate text-zinc-200">{c.title}</p>
                                <p className="text-[10px] text-zinc-500 truncate">
                                  {c.channelTitle} {durationFormatted ? `• ${durationFormatted}` : ''}
                                </p>
                              </div>
                              {isSelected && (
                                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 6.5. SoundCloud Synchronization Card */}
            <div className="p-5 bg-white/[0.02] border border-white/[0.08] rounded-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <h2 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-zinc-400" />
                  SoundCloud Native Stream
                </h2>
                {metadata.soundcloudUrl && (
                  <button
                    type="button"
                    onClick={() => onUpdateMetadata({ soundcloudUrl: undefined })}
                    className="text-[11px] text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    Clear Link
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Embeds the official SoundCloud player directly into the studio transport dock with zero CORS barriers and native sync.
                </p>

                {/* Search Bar + Auto Button */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={scManualSearchQuery}
                      onChange={(e) => setScManualSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleManualSearchSoundCloud();
                        }
                      }}
                      placeholder={
                        metadata.artist && metadata.title
                          ? `${metadata.artist} - ${metadata.title}`
                          : 'Search SoundCloud...'
                      }
                      className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.05] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-600 outline-none transition-all"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={isSearchingManualSc}
                    onClick={() =>
                      handleManualSearchSoundCloud(
                        scManualSearchQuery.trim() || `${metadata.artist || ''} ${metadata.title || ''}`.trim()
                      )
                    }
                    className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white text-zinc-300 hover:text-zinc-950 text-xs font-medium border border-white/[0.08] transition-all cursor-pointer shrink-0 disabled:opacity-40"
                  >
                    {isSearchingManualSc ? 'Searching...' : 'Find'}
                  </button>

                  <button
                    type="button"
                    disabled={isAutoDetectingSc || (!metadata.artist && !metadata.title)}
                    onClick={handleAutoDetectSoundCloud}
                    className="px-3 py-1.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold transition-all cursor-pointer shrink-0 disabled:opacity-40 flex items-center gap-1"
                  >
                    <Search className="w-3 h-3" />
                    <span>{isAutoDetectingSc ? 'Matching...' : 'Auto'}</span>
                  </button>
                </div>

                {/* Direct URL Input */}
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-300 font-medium block">
                    SoundCloud Track URL
                  </label>
                  <input
                    type="text"
                    value={metadata.soundcloudUrl || ''}
                    onChange={(e) => {
                      const parsed = parseSoundCloudTrackUrl(e.target.value);
                      onUpdateMetadata({ soundcloudUrl: parsed || e.target.value });
                    }}
                    placeholder="https://soundcloud.com/artist/track-name"
                    className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.05] rounded-xl px-3 py-1.5 text-xs text-zinc-300 font-sans placeholder:text-zinc-600 outline-none transition-all"
                  />
                </div>

                {/* Detection Status Toast */}
                {scAutoDetectStatus && (
                  <p className="text-xs text-zinc-400 font-sans flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                    {scAutoDetectStatus}
                  </p>
                )}

                {/* Candidate Selection List */}
                {scCandidates.length > 0 && (
                  <div className="pt-2 border-t border-white/[0.04] space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowScCandidatePicker((prev) => !prev)}
                      className="text-xs font-medium text-zinc-400 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Sliders className="w-3 h-3" />
                      <span>
                        {showScCandidatePicker ? 'Hide Candidate Tracks' : `Select from ${scCandidates.length} Candidates`}
                      </span>
                    </button>

                    {showScCandidatePicker && (
                      <div className="space-y-1 max-h-56 overflow-y-auto custom-scrollbar p-1 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                        {scCandidates.map((c, idx) => {
                          const isSelected = metadata.soundcloudUrl === c.url;

                          return (
                            <div
                              key={c.url || idx}
                              onClick={() => {
                                onUpdateMetadata({ soundcloudUrl: c.url });
                                setScAutoDetectStatus(`Selected: ${c.title}`);
                              }}
                              className={`p-2 rounded-lg transition-all text-xs flex items-center gap-2.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-white/10 text-white font-medium border border-white/20'
                                  : 'hover:bg-white/[0.04] text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              <div className="w-8 h-8 rounded bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0">
                                <Radio className="w-4 h-4 text-zinc-400" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs truncate text-zinc-200">{c.title}</p>
                                <p className="text-[10px] text-zinc-500 truncate">
                                  {c.author || 'SoundCloud Artist'}
                                  {c.score !== undefined ? ` • Score: ${c.score}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <a
                                  href={c.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1 rounded text-zinc-500 hover:text-white hover:bg-white/[0.08] transition-colors"
                                  title="Preview on SoundCloud in new tab"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                                {isSelected && (
                                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 7. Desktop Companion Bridge Card */}
            <div className="p-5 bg-white/[0.02] border border-white/[0.08] rounded-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <h2 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <Laptop className="w-3.5 h-3.5 text-zinc-400" />
                  Desktop Companion Bridge
                </h2>
                {isPairedCompanion ? (
                  <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Linked
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-500 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-full">
                    Not Linked
                  </span>
                )}
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                Connect the local OpenLyryc desktop app to stream high-quality audio directly from your machine without ads or video overhead.
              </p>

              {isPairedCompanion ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/20 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-zinc-200">Bridge Active</div>
                      <div className="text-[11px] text-zinc-500 font-sans">127.0.0.1:4040</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await openCompanionAudioFolder();
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 text-xs font-medium border border-white/[0.08] transition cursor-pointer flex items-center gap-1.5"
                        title="Reveal audio cache in Explorer/Finder"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Cache Folder</span>
                      </button>
                      <button
                        type="button"
                        disabled={isPairingLoading}
                        onClick={handleUnpairClick}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium border border-rose-500/20 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        <span>Unlink</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2.5">
                    <div className="text-[11px] text-zinc-400 font-medium">Link Option 1: Enter Studio Code in Companion</div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Your pairing code:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-sans text-sm tracking-widest font-bold text-white bg-black/40 px-3 py-1 rounded-lg border border-white/10">
                          {localPairCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => handlePairSubmit(localPairCode)}
                          disabled={isPairingLoading}
                          className="px-3 py-1 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold transition cursor-pointer disabled:opacity-40"
                        >
                          {isPairingLoading ? 'Connecting...' : 'Verify'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2.5">
                    <div className="text-[11px] text-zinc-400 font-medium">Link Option 2: Enter Companion Code Here</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={4}
                        value={manualCodeInput}
                        onChange={(e) => setManualCodeInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="4 digits"
                        className="w-28 text-center font-sans tracking-widest text-sm bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30"
                      />
                      <button
                        type="button"
                        disabled={isPairingLoading || manualCodeInput.length !== 4}
                        onClick={() => handlePairSubmit(manualCodeInput)}
                        className="px-3 py-1 rounded-lg bg-white/[0.08] hover:bg-white text-zinc-200 hover:text-zinc-950 text-xs font-semibold border border-white/10 transition cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Link Companion</span>
                      </button>
                    </div>
                  </div>

                  {pairingMessage && (
                    <div
                      className={`text-xs p-2 rounded-lg ${
                        pairingMessage.ok
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                      }`}
                    >
                      {pairingMessage.text}
                    </div>
                  )}

                  <p className="text-[11px] text-zinc-500">
                    Pairing is private and only communicates with your own computer.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

TrackMetadataView.displayName = 'TrackMetadataView';
