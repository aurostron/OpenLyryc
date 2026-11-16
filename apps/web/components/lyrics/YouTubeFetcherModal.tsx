'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Check, 
  Play, 
  Volume2, 
  VolumeX, 
  SlidersHorizontal,
  ExternalLink,
  Layers,
  PictureInPicture,
  EyeOff,
  Music,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { parseYouTubeMusicId } from '@/lib/platformLinker';
import { searchYouTubeDirect, DetectedYouTubeMatch } from '@/lib/youtubeAutoDetector';
import { YouTubeDisplayMode } from './YouTubeEmbedPlayer';

const YouTubeIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

interface YouTubeFetcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVideoId: string | null;
  currentVideoTitle?: string;
  currentChannelTitle?: string;
  songTitle: string;
  artistName: string;
  songDuration?: number;
  displayMode: YouTubeDisplayMode;
  onChangeDisplayMode: (mode: YouTubeDisplayMode) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  volume: number;
  onChangeVolume: (val: number) => void;
  onSelectVideo: (videoId: string, meta?: { title: string; channelTitle: string }) => void;
  isKaraoke?: boolean;
}

function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const YouTubeFetcherModal: React.FC<YouTubeFetcherModalProps> = ({
  isOpen,
  onClose,
  currentVideoId,
  currentVideoTitle,
  currentChannelTitle,
  songTitle,
  artistName,
  songDuration,
  displayMode,
  onChangeDisplayMode,
  isMuted,
  onToggleMute,
  volume,
  onChangeVolume,
  onSelectVideo,
  isKaraoke = false,
}) => {
  const computeInitialQuery = () => {
    const base = `${artistName} ${songTitle}`.trim();
    if (!base) return '';
    return isKaraoke ? `${base} instrumental` : base;
  };

  const [searchQuery, setSearchQuery] = useState(computeInitialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [candidates, setCandidates] = useState<DetectedYouTubeMatch[]>([]);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [customUrlError, setCustomUrlError] = useState<string | null>(null);

  // Sync initial query when song changes
  useEffect(() => {
    if (songTitle || artistName) {
      setSearchQuery(computeInitialQuery());
    }
  }, [songTitle, artistName, isKaraoke]);

  // Initial candidate search on modal open if candidates empty
  useEffect(() => {
    if (isOpen && candidates.length === 0 && (songTitle || artistName)) {
      handleSearch(computeInitialQuery());
    }
  }, [isOpen, songTitle, artistName, isKaraoke]);

  const handleSearch = async (queryToSearch: string) => {
    const q = (queryToSearch || searchQuery).trim();
    if (!q) return;

    setIsSearching(true);
    try {
      const res = await searchYouTubeDirect(q, songDuration, { instrumentalOnly: isKaraoke });
      setCandidates(res.candidates || []);
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomUrlError(null);
    const parsed = parseYouTubeMusicId(customUrlInput.trim());
    if (parsed) {
      onSelectVideo(parsed, { title: 'Custom YouTube Link', channelTitle: 'YouTube' });
      setCustomUrlInput('');
      onClose();
    } else {
      setCustomUrlError('Please enter a valid YouTube video URL or 11-character video ID.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#0e0e12] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/15 border border-red-500/20 flex items-center justify-center text-red-500">
              <YouTubeIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">
                {isKaraoke ? 'YouTube Instrumental Audio & Sync' : 'YouTube Fetcher & Play Along'}
              </h2>
              <p className="text-[11px] text-zinc-400">
                {isKaraoke
                  ? 'Match authentic instrumental audio for karaoke play along'
                  : 'Match authentic YouTube audio/video for synchronized playback'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Active Audio / Video Source Card */}
          {currentVideoId ? (
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="relative w-24 aspect-video rounded-lg overflow-hidden bg-black shrink-0 border border-white/10 shadow-sm">
                  <img
                    src={`https://img.youtube.com/vi/${currentVideoId}/mqdefault.jpg`}
                    alt="Current Video Thumbnail"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-1">
                    <span className="text-[9px] font-sans text-zinc-300 font-medium">Active</span>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-white text-[11px] font-medium mb-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    <span>Active Video</span>
                  </div>
                  <h4 className="text-xs font-semibold text-white truncate max-w-sm">
                    {currentVideoTitle || 'YouTube Video'}
                  </h4>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {currentChannelTitle || 'Official Track'}
                  </p>
                </div>
              </div>
              <a
                href={`https://www.youtube.com/watch?v=${currentVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition-colors self-end sm:self-center shrink-0 cursor-pointer"
              >
                <span>Open in YT</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-zinc-300 text-xs flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0 text-zinc-400" />
              <span>No video matched yet. Search below or paste a link.</span>
            </div>
          )}

          {/* Embed Display Mode Selector */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-2">
              Display Mode
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'side', label: 'Side by side', icon: Layers, desc: 'Next to lyrics' },
                { id: 'backdrop', label: 'Background', icon: Play, desc: 'Ambient backdrop' },
                { id: 'pip', label: 'Floating', icon: PictureInPicture, desc: 'Corner window' },
                { id: 'audio', label: 'Audio only', icon: EyeOff, desc: 'Hidden player' },
              ].map((mode) => {
                const Icon = mode.icon;
                const isSelected = displayMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onChangeDisplayMode(mode.id as YouTubeDisplayMode)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white text-zinc-950 border-white font-medium shadow-md'
                        : 'bg-white/[0.03] text-zinc-400 border-white/[0.06] hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Icon className="w-4 h-4" />
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <div className="text-xs font-semibold">{mode.label}</div>
                    <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-zinc-600' : 'text-zinc-500'}`}>
                      {mode.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audio Controls */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onToggleMute}
                className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                  isMuted 
                    ? 'bg-red-500/20 border-red-500/30 text-red-300' 
                    : 'bg-white/[0.06] border-white/10 text-white hover:bg-white/10'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <div className="text-xs">
                <div className="text-white font-medium">{isMuted ? 'Muted' : 'Volume'}</div>
                <div className="text-[11px] text-zinc-400">{isMuted ? 'Audio muted' : `${volume}%`}</div>
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => onChangeVolume(Number(e.target.value))}
              disabled={isMuted}
              className="w-36 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>

          {/* Paste Custom YouTube URL or Video ID */}
          <form onSubmit={handleApplyCustomUrl} className="space-y-2">
            <label className="block text-xs font-medium text-zinc-300">
              Paste Custom YouTube URL or Video ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://youtube.com/watch?v=... or Video ID"
                value={customUrlInput}
                onChange={(e) => {
                  setCustomUrlInput(e.target.value);
                  setCustomUrlError(null);
                }}
                className="flex-1 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder:text-zinc-600 text-xs focus:outline-none focus:border-white/30 transition-colors"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-colors shrink-0 cursor-pointer"
              >
                Use link
              </button>
            </div>
            {customUrlError && (
              <p className="text-[11px] text-red-400">{customUrlError}</p>
            )}
          </form>

          {/* Search YouTube Candidates */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-zinc-300">
                Search Results
              </label>
              <span className="text-[11px] text-zinc-500 font-sans">
                {candidates.length} result{candidates.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={
                    isKaraoke
                      ? "Search instrumental track…"
                      : "Search YouTube track…"
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder:text-zinc-600 text-xs focus:outline-none focus:border-white/30 transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={() => handleSearch(searchQuery)}
                disabled={isSearching}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors shrink-0 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSearching ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>Search</span>
              </button>
            </div>

            {/* Candidates List */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {candidates.map((cand) => {
                const isCurrent = cand.videoId === currentVideoId;
                return (
                  <div
                    key={cand.videoId}
                    onClick={() => {
                      onSelectVideo(cand.videoId, { title: cand.title, channelTitle: cand.channelTitle || '' });
                      onClose();
                    }}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                      isCurrent
                        ? 'bg-white/10 border-white/30 text-white shadow-sm'
                        : 'bg-white/[0.02] border-white/[0.06] text-zinc-300 hover:bg-white/[0.06] hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-16 aspect-video rounded-md overflow-hidden bg-black shrink-0 border border-white/10">
                        <img
                          src={`https://img.youtube.com/vi/${cand.videoId}/mqdefault.jpg`}
                          alt={cand.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 truncate max-w-sm">
                          <span className="text-xs font-semibold text-white truncate">
                            {cand.title}
                          </span>
                          {/\binstrumentals?\b/i.test(cand.title) && (
                            <span className="text-[9px] font-sans font-medium px-1.5 py-0.5 rounded bg-white/10 text-zinc-200 border border-white/20 shrink-0">
                              Instrumental
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate flex items-center gap-2 mt-0.5">
                          <span>{cand.channelTitle}</span>
                          {cand.duration ? (
                            <>
                              <span>·</span>
                              <span className="font-sans">{formatDuration(cand.duration)}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                        isCurrent
                          ? 'bg-white/20 text-white border border-white/30'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      {isCurrent ? 'Active' : 'Select'}
                    </button>
                  </div>
                );
              })}

              {candidates.length === 0 && !isSearching && (
                <div className="p-6 text-center text-xs text-zinc-500">
                  No candidates loaded. Click Search to find alternative videos.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-between text-xs text-zinc-500">
          <span>Plays in synchronized harmony with OpenLyryc lyrics</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
