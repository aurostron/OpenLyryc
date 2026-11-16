'use client';

import React, { useRef, useState } from 'react';
import { Radio } from 'lucide-react';
import { LyricLine, LyricMetadata } from '@/types/lyrics';
import {
  parseSpotifyTrackId,
  parseYouTubeMusicId,
  parseSoundCloudTrackUrl,
  normalizeIsrc,
  resolveCanonicalSongKey,
} from '@/lib/platformLinker';
import { searchYouTubeMatches, searchYouTubeDirect, DetectedYouTubeMatch } from '@/lib/youtubeAutoDetector';

interface TrackMetadataSidebarProps {
  metadata: LyricMetadata;
  lines?: LyricLine[];
  onUpdateMetadata: (metadata: Partial<LyricMetadata>) => void;
  isOpen?: boolean;
  onToggle?: () => void;
  currentAudioFile?: File | null;
  onAudioUpload?: (file: File) => void;
  isYouTubeEmbedOpen?: boolean;
  onToggleYouTubeEmbed?: () => void;
}

export const TrackMetadataSidebar: React.FC<TrackMetadataSidebarProps> = React.memo(({
  metadata,
  lines,
  onUpdateMetadata,
  isOpen = true,
  onToggle,
  currentAudioFile,
  onAudioUpload,
  isYouTubeEmbedOpen,
  onToggleYouTubeEmbed,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const isPrecision = Boolean(metadata.precisionMode);
  const [copiedHash, setCopiedHash] = useState(false);
  const [isAutoDetectingYt, setIsAutoDetectingYt] = useState(false);
  const [autoDetectStatus, setAutoDetectStatus] = useState<string | null>(null);
  const [ytCandidates, setYtCandidates] = useState<DetectedYouTubeMatch[]>([]);
  const [showCandidatePicker, setShowCandidatePicker] = useState(false);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [isSearchingManualYt, setIsSearchingManualYt] = useState(false);

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
        setAutoDetectStatus(`Found ${candidates.length} videos`);
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

  const canonicalKey = resolveCanonicalSongKey({
    isrc: metadata.isrc,
    spotifyId: metadata.spotifyId,
    youtubeId: metadata.youtubeId,
    audioHash: metadata.audioHash,
    artist: metadata.artist,
    title: metadata.title,
  });

  const togglePrecisionMode = () => {
    onUpdateMetadata({ precisionMode: !isPrecision });
  };

  const handleArtworkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onUpdateMetadata({ coverArt: event.target.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAudioFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && onAudioUpload) {
      onAudioUpload(e.target.files[0]);
    }
  };

  const removeArtwork = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateMetadata({ coverArt: undefined });
  };

  const copyAudioHash = () => {
    if (metadata.audioHash) {
      navigator.clipboard.writeText(metadata.audioHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  return (
    <>
      {/* Mobile Drawer Backdrop Overlay */}
      {isOpen && onToggle && (
        <div
          onClick={onToggle}
          className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
        />
      )}
      <aside
        className={`bg-[#09090b] flex flex-col shrink-0 overflow-hidden select-none transition-all duration-300 ease-in-out relative ${
          isOpen
            ? 'w-64 border-l border-white/[0.06] max-md:fixed max-md:top-0 max-md:bottom-0 max-md:right-0 max-md:z-50 max-md:w-full max-md:max-w-md max-md:shadow-2xl'
            : 'w-0 border-l-0'
        }`}
      >
      <div className="w-full md:w-64 flex flex-col h-full overflow-y-auto custom-scrollbar relative p-4 pb-24 md:pb-4 space-y-3">
        {/* Right-pointing Collapse Arrow Button */}
        {onToggle && (
          <div className="flex justify-start pt-1 pl-1">
            <button
              type="button"
              onClick={onToggle}
              title="Collapse Track Details"
              className="p-1 rounded-lg bg-white/[0.04] hover:bg-white text-zinc-400 hover:text-zinc-950 border border-white/[0.08] hover:border-white transition-all cursor-pointer group active:scale-95 shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-0.5">
                chevron_right
              </span>
            </button>
          </div>
        )}

        {/* Track Identifiers */}
        <div className="p-4 bg-white/[0.03] border border-white/[0.1] rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-sans text-xs font-bold text-white flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-emerald-400">verified</span>
              Track Identifiers
            </h3>
          </div>

          {/* Audio Hash */}
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400 font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-zinc-500">fingerprint</span>
                Audio Hash
              </span>
              {metadata.audioHash ? (
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Matched
                </span>
              ) : currentAudioFile ? (
                <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Hashing...
                </span>
              ) : (
                <span className="text-[10px] text-zinc-500">No Audio</span>
              )}
            </div>

            {metadata.audioHash ? (
              <div className="flex items-center justify-between gap-1 pt-0.5">
                <span className="font-sans text-[10px] text-zinc-300 truncate max-w-[170px]" title={metadata.audioHash}>
                  {metadata.audioHash}
                </span>
                <button
                  type="button"
                  onClick={copyAudioHash}
                  title="Copy SHA-256 hash"
                  className="p-1 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">
                    {copiedHash ? 'check' : 'content_copy'}
                  </span>
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  ref={audioInputRef}
                  onChange={handleAudioFileInput}
                  accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="w-full mt-1 py-1 px-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[10px] text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">upload_file</span>
                  <span>Select Audio File</span>
                </button>
              </div>
            )}
          </div>

          {/* Canonical Platform Linkers */}
          <div className="space-y-2 pt-1 border-t border-white/[0.04]">
            {/* Spotify Track Link / ID */}
            <div>
              <label className="text-[11px] text-zinc-400 font-medium block mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-[#1DB954]">graphic_eq</span>
                Spotify Track ID / URL
              </label>
              <input
                type="text"
                value={metadata.spotifyId || ''}
                onChange={(e) => {
                  const parsed = parseSpotifyTrackId(e.target.value);
                  onUpdateMetadata({ spotifyId: parsed || e.target.value });
                }}
                placeholder="Paste open.spotify.com/track/..."
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.06] rounded-lg px-2.5 py-1 text-xs text-zinc-100 font-sans outline-none transition-all placeholder:text-zinc-600"
              />
            </div>

            {/* YouTube Music Link / ID & Search Controls */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs text-white">play_circle</span>
                  YouTube Video
                </label>
                {metadata.youtubeId && onToggleYouTubeEmbed && (
                  <button
                    type="button"
                    onClick={onToggleYouTubeEmbed}
                    title={isYouTubeEmbedOpen ? 'Hide Video' : 'Show Video'}
                    className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-0.5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">
                      {isYouTubeEmbedOpen ? 'visibility_off' : 'picture_in_picture_alt'}
                    </span>
                    <span>{isYouTubeEmbedOpen ? 'Hide' : 'Show'}</span>
                  </button>
                )}
              </div>

              {/* YouTube Mini Search Bar along with Automatic Finder Button */}
              <div className="flex items-center gap-1">
                <div className="relative flex-1 min-w-0">
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
                    className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.06] rounded-lg pl-6 pr-5 py-1 text-[11px] text-zinc-100 font-sans outline-none transition-all placeholder:text-zinc-500"
                  />
                  <span className="material-symbols-outlined text-[13px] text-zinc-500 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    search
                  </span>
                  {manualSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setManualSearchQuery('')}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5"
                    >
                      <span className="material-symbols-outlined text-[12px]">close</span>
                    </button>
                  )}
                </div>

                {/* Manual Mini Search Action Button */}
                <button
                  type="button"
                  disabled={
                    isSearchingManualYt ||
                    (!manualSearchQuery.trim() && !metadata.artist && !metadata.title)
                  }
                  onClick={() =>
                    handleManualSearch(
                      manualSearchQuery.trim() || `${metadata.artist || ''} ${metadata.title || ''}`.trim()
                    )
                  }
                  title="Search YouTube manually"
                  className="px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-white text-zinc-300 hover:text-zinc-950 text-[10px] font-medium border border-white/[0.08] hover:border-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 flex items-center gap-0.5"
                >
                  {isSearchingManualYt ? (
                    <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                  ) : (
                    <span>Find</span>
                  )}
                </button>

                {/* Automatic YouTube Video Finder Button */}
                <button
                  type="button"
                  disabled={isAutoDetectingYt || (!metadata.artist && !metadata.title)}
                  onClick={handleAutoDetectYouTube}
                  title="Auto-detect best matching YouTube video"
                  className="px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-white text-zinc-300 hover:text-zinc-950 text-[10px] font-medium border border-white/[0.08] hover:border-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 flex items-center gap-0.5"
                >
                  <span className={`material-symbols-outlined text-xs ${isAutoDetectingYt ? 'animate-spin' : ''}`}>
                    {isAutoDetectingYt ? 'progress_activity' : 'auto_awesome'}
                  </span>
                  <span>{isAutoDetectingYt ? 'Detecting...' : 'Auto'}</span>
                </button>
              </div>

              {/* Direct YouTube Video ID / URL Input */}
              <div className="relative">
                <input
                  type="text"
                  value={metadata.youtubeId || ''}
                  onChange={(e) => {
                    const parsed = parseYouTubeMusicId(e.target.value);
                    onUpdateMetadata({ youtubeId: parsed || e.target.value });
                  }}
                  placeholder="Or paste youtube.com URL / ID..."
                  className="w-full bg-white/[0.03] border border-white/[0.06] focus:border-white/30 rounded-lg px-2.5 py-1 text-[11px] text-zinc-300 font-sans outline-none transition-all placeholder:text-zinc-600 font-sans"
                />
              </div>

              {autoDetectStatus && (
                <p className="text-[10px] text-zinc-400 truncate flex items-center gap-1">
                  <span className="material-symbols-outlined text-[11px] text-white">check_circle</span>
                  <span className="truncate">{autoDetectStatus}</span>
                </p>
              )}

              {/* YouTube Video Candidates List */}
              {ytCandidates.length > 0 && (
                <div className="mt-1">
                  <div className="flex items-center justify-between py-0.5">
                    <button
                      type="button"
                      onClick={() => setShowCandidatePicker((prev) => !prev)}
                      className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xs">
                        {showCandidatePicker ? 'expand_less' : 'tune'}
                      </span>
                      <span>
                        {showCandidatePicker
                          ? 'Hide Videos'
                          : `Choose from ${ytCandidates.length} videos`}
                      </span>
                    </button>
                    {metadata.youtubeId && (
                      <span className="text-[9px] text-zinc-500 font-sans truncate max-w-[90px]" title={metadata.youtubeId}>
                        ID: {metadata.youtubeId}
                      </span>
                    )}
                  </div>

                  {showCandidatePicker && (
                    <div className="mt-1 space-y-1 max-h-56 overflow-y-auto p-1.5 rounded-lg bg-black/70 border border-white/[0.1] backdrop-blur-md custom-scrollbar">
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
                            className={`group w-full text-left p-1.5 rounded-md transition-all text-xs flex items-center gap-2 cursor-pointer ${
                              isSelected
                                ? 'bg-white/[0.14] text-white font-medium border border-white/20'
                                : 'hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 border border-transparent'
                            }`}
                          >
                            <img
                              src={`https://i.ytimg.com/vi/${c.videoId}/default.jpg`}
                              alt=""
                              className="w-10 h-7 object-cover rounded bg-black/80 shrink-0 border border-white/10"
                              loading="lazy"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] leading-tight truncate text-zinc-200 group-hover:text-white">
                                {c.title}
                              </p>
                              <p className="text-[9px] text-zinc-500 truncate mt-0.5">
                                {c.channelTitle} {durationFormatted ? `• ${durationFormatted}` : ''}
                              </p>
                            </div>
                            {isSelected ? (
                              <span className="material-symbols-outlined text-xs text-white shrink-0">
                                check_circle
                              </span>
                            ) : (
                              <button
                                type="button"
                                title="Open on YouTube"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(`https://www.youtube.com/watch?v=${c.videoId}`, '_blank', 'noopener,noreferrer');
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-white transition-opacity cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SoundCloud Track URL */}
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-[#ff5500] font-medium flex items-center gap-1">
                  <Radio className="w-3 h-3 text-[#ff5500]" />
                  SoundCloud Track
                </label>
                {metadata.soundcloudUrl && (
                  <button
                    type="button"
                    onClick={() => onUpdateMetadata({ soundcloudUrl: undefined })}
                    className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={metadata.soundcloudUrl || ''}
                  onChange={(e) => {
                    const parsed = parseSoundCloudTrackUrl(e.target.value);
                    onUpdateMetadata({ soundcloudUrl: parsed || e.target.value });
                  }}
                  placeholder="Paste soundcloud.com track URL..."
                  className="w-full bg-white/[0.03] border border-white/[0.06] focus:border-[#ff5500]/50 rounded-lg px-2.5 py-1 text-[11px] text-zinc-300 font-sans outline-none transition-all placeholder:text-zinc-600 font-sans"
                />
              </div>
            </div>

            {/* ISRC Code */}
            <div>
              <label className="text-[11px] text-zinc-400 font-medium block mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-zinc-400">tag</span>
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
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.06] rounded-lg px-2.5 py-1 text-xs text-zinc-100 font-sans outline-none transition-all placeholder:text-zinc-600 uppercase font-sans"
              />
            </div>
          </div>

          {/* Canonical Key Pill */}
          <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-[10px]">
            <span className="text-zinc-500 font-medium">Registry Key:</span>
            <span className="font-sans text-zinc-300 font-semibold truncate max-w-[140px]" title={canonicalKey}>
              {canonicalKey}
            </span>
          </div>
        </div>

        {/* Track Details Section */}
        <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl space-y-3.5">
          <h3 className="font-sans text-xs font-semibold text-zinc-300">
            Track Details
          </h3>
          <div className="space-y-2.5">
            <div>
              <label className="text-[11px] text-zinc-400 font-medium font-sans block mb-1">
                Title
              </label>
              <input
                type="text"
                value={metadata.title}
                onChange={(e) => onUpdateMetadata({ title: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-medium font-sans outline-none transition-all"
              />
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 font-medium font-sans block mb-1">
                Artist
              </label>
              <input
                type="text"
                value={metadata.artist}
                onChange={(e) => onUpdateMetadata({ artist: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-medium font-sans outline-none transition-all"
              />
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 font-medium font-sans block mb-1">
                Album
              </label>
              <input
                type="text"
                value={metadata.album || ''}
                onChange={(e) => onUpdateMetadata({ album: e.target.value })}
                placeholder="Optional Album Name"
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-medium font-sans outline-none transition-all placeholder:text-zinc-600"
              />
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 font-medium font-sans block mb-1">
                Synced By
              </label>
              <input
                type="text"
                value={metadata.syncedBy || ''}
                onChange={(e) => onUpdateMetadata({ syncedBy: e.target.value })}
                placeholder="LRC Creator / Syncer"
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-medium font-sans outline-none transition-all placeholder:text-zinc-600"
              />
            </div>
          </div>
        </div>

        {/* Appearance & Cover Artwork */}
        <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl space-y-3.5">
          <h3 className="font-sans text-xs font-semibold text-zinc-300">
            Appearance
          </h3>

          {/* Ambient Background Glow Toggle */}
          <div
            onClick={() =>
              onUpdateMetadata({
                ambientGlow: metadata.ambientGlow !== false ? false : true,
              })
            }
            className="flex items-center justify-between py-1 cursor-pointer group"
          >
            <div className="flex flex-col">
              <span className="text-xs text-zinc-200 group-hover:text-white font-medium font-sans">
                Ambient Glow
              </span>
              <span className="text-[10px] text-zinc-500 font-sans">
                Dynamic Color Mesh
              </span>
            </div>

            <div
              className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                metadata.ambientGlow !== false ? 'bg-white' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full transition-transform ${
                  metadata.ambientGlow !== false
                    ? 'translate-x-4 bg-zinc-950'
                    : 'translate-x-0 bg-zinc-400'
                }`}
              />
            </div>
          </div>

          {/* Artwork Uploader Container */}
          <div className="pt-2 border-t border-white/[0.04]">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleArtworkUpload}
              accept="image/*"
              className="hidden"
            />

            <label className="text-[11px] text-zinc-400 font-medium font-sans block mb-1.5">
              Cover Artwork
            </label>

            {metadata.coverArt ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative group rounded-xl overflow-hidden aspect-square border border-white/[0.1] cursor-pointer bg-black/40"
              >
                <img
                  src={metadata.coverArt}
                  alt="Album Cover"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <span className="text-[11px] font-medium text-white">Change</span>
                  <button
                    onClick={removeArtwork}
                    className="p-1 rounded-md bg-red-500/20 text-red-300 hover:bg-red-500/40 transition-colors"
                    title="Remove artwork"
                  >
                    <span className="material-symbols-outlined text-xs">delete</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-white/[0.1] hover:border-white/30 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-white/[0.01] hover:bg-white/[0.03] transition-all group"
              >
                <span className="material-symbols-outlined text-zinc-500 group-hover:text-white text-lg transition-colors">
                  add_photo_alternate
                </span>
                <span className="text-[11px] text-zinc-400 group-hover:text-zinc-200 font-medium font-sans">
                  Upload Artwork
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Sync Engine Configuration */}
        <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl space-y-3.5">
          <h3 className="font-sans text-xs font-semibold text-zinc-300">
            Sync Options
          </h3>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] text-zinc-400 font-medium font-sans">
                Time Offset (ms)
              </label>
              <span className="text-[11px] font-sans text-zinc-300 font-semibold tabular-nums">
                {(metadata.offset ?? 0) > 0 ? `+${metadata.offset}` : metadata.offset ?? 0}ms
              </span>
            </div>

            <div className="flex items-center gap-1.5 mb-2">
              <input
                type="number"
                value={metadata.offset ?? 0}
                onChange={(e) =>
                  onUpdateMetadata({ offset: parseInt(e.target.value, 10) || 0 })
                }
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-white/40 focus:bg-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 font-medium font-sans outline-none transition-all tabular-nums"
              />
              <button
                type="button"
                onClick={() => onUpdateMetadata({ offset: 0 })}
                disabled={!metadata.offset}
                title="Reset offset to 0ms"
                className="px-2 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] disabled:opacity-30 text-[10px] text-zinc-400 hover:text-white border border-white/[0.08] transition-all cursor-pointer shrink-0"
              >
                Reset
              </button>
            </div>

            {/* Quick Nudge Steppers */}
            <div className="grid grid-cols-4 gap-1 mb-1.5">
              {[-100, -10, 10, 100].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => onUpdateMetadata({ offset: (metadata.offset ?? 0) + step })}
                  className="py-1 px-1 rounded-md bg-white/[0.03] hover:bg-white/[0.08] text-[10px] font-sans font-semibold text-zinc-300 hover:text-white border border-white/[0.06] transition-all cursor-pointer text-center"
                >
                  {step > 0 ? `+${step}` : step}ms
                </button>
              ))}
            </div>
            <div className="text-[10px] text-zinc-500 font-sans">
              Hotkeys: <kbd className="px-1 py-0.5 rounded bg-white/[0.06] text-zinc-400 font-bold">[</kbd> / <kbd className="px-1 py-0.5 rounded bg-white/[0.06] text-zinc-400 font-bold">]</kbd> (±100ms, Shift: ±10ms)
            </div>
          </div>

          {/* Precision Switch */}
          <div
            onClick={togglePrecisionMode}
            className="flex items-center justify-between py-1 cursor-pointer group"
          >
            <div className="flex flex-col">
              <span className="text-xs text-zinc-200 group-hover:text-white font-medium font-sans">
                Millisecond Precision
              </span>
              <span className="text-[10px] text-zinc-500 font-sans">
                {isPrecision ? '3 decimals (00:00.000)' : '2 decimals (00:00.00)'}
              </span>
            </div>

            <div
              className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                isPrecision ? 'bg-white' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full transition-transform ${
                  isPrecision ? 'translate-x-4 bg-zinc-950' : 'translate-x-0 bg-zinc-400'
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
});

TrackMetadataSidebar.displayName = 'TrackMetadataSidebar';
