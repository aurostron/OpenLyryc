'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  Download,
  FolderOpen,
  RefreshCw,
  Music2,
  Check,
  Disc,
  ExternalLink,
} from 'lucide-react';
import {
  checkCompanionBridge,
  searchCompanionBridge,
  downloadViaCompanionBridge,
  getCompanionLibrary,
  openCompanionAudioFolder,
  setCompanionPaired,
  COMPANION_BRIDGE_ORIGIN,
  CompanionStatus,
  CompanionSearchResult,
  CompanionLibraryItem,
} from '@/lib/companionBridge';
import { OpenLyrycLogo } from '@/components/OpenLyrycLogo';

interface CompanionFetchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  onSelectAudio: (streamUrl: string, title?: string) => void;
}

export const CompanionFetchModal: React.FC<CompanionFetchModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
  onSelectAudio,
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'library'>('search');
  const [status, setStatus] = useState<CompanionStatus | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [format, setFormat] = useState<'opus' | 'm4a' | 'mp3'>('opus');

  // Search state
  const [query, setQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CompanionSearchResult[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadNote, setDownloadNote] = useState<string | null>(null);

  // Library state
  const [libraryItems, setLibraryItems] = useState<CompanionLibraryItem[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Poll status on modal open
  const refreshStatus = async () => {
    setIsCheckingStatus(true);
    const s = await checkCompanionBridge();
    if (s?.ok) {
      setCompanionPaired(true);
    }
    setStatus(s);
    setIsCheckingStatus(false);
  };

  const loadLibrary = async () => {
    setIsLoadingLibrary(true);
    const items = await getCompanionLibrary();
    setLibraryItems(items);
    setIsLoadingLibrary(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshStatus();
    loadLibrary();
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && activeTab === 'search') {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen, activeTab]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !downloadingId) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, downloadingId, onClose]);

  if (!isOpen) return null;

  const isOnline = Boolean(status?.ok);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = query.trim();
    if (!q || isSearching) return;

    // Check if directly a YouTube URL or 11-char ID
    if (/youtube\.com|youtu\.be/i.test(q) || (q.length === 11 && !q.includes(' '))) {
      await handleDownload(q, 'YouTube Track');
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    setDownloadNote(null);
    try {
      const results = await searchCompanionBridge(q);
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownload = async (urlOrId: string, title?: string) => {
    setDownloadingId(urlOrId);
    setDownloadNote(`Downloading ${format.toUpperCase()} audio at maximum bitrate...`);
    try {
      const res = await downloadViaCompanionBridge(urlOrId, format, title);
      if (res?.ok && res.streamUrl) {
        setDownloadNote('Audio ready! Loading into Studio...');
        setTimeout(() => {
          onSelectAudio(res.streamUrl, res.filename.replace(/\.[^/.]+$/, ''));
          onClose();
        }, 300);
      } else {
        setDownloadNote(res?.error || 'Download failed. Ensure yt-dlp is accessible.');
      }
    } catch {
      setDownloadNote('Download failed.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSelectCached = (item: CompanionLibraryItem) => {
    const streamUrl = `${COMPANION_BRIDGE_ORIGIN}/audio/${encodeURIComponent(item.filename)}`;
    onSelectAudio(streamUrl, item.title || item.filename);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-modal-3d-backdrop p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-xl glass-modal-3d rounded-2xl p-6 shadow-2xl flex flex-col font-sans text-zinc-100 relative max-h-[85vh] animate-modal-pop-3d">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-zinc-200">
              <OpenLyrycLogo className="h-4 w-auto text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">Desktop Companion Bridge</h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    isOnline
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  <span>{isOnline ? '127.0.0.1:4040' : 'Offline'}</span>
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Direct YouTube audio streamer & lossless local cache
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshStatus}
              disabled={isCheckingStatus}
              title="Refresh bridge status"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Offline Banner */}
        {!isOnline && (
          <div className="my-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 space-y-2">
            <div className="font-semibold text-amber-300">OpenLyryc Companion app is not running</div>
            <p className="text-zinc-300 leading-relaxed">
              Launch the companion app on your desktop to enable lossless raw Opus audio streaming, true Web Audio scrubbing, and local caching.
            </p>
            <div className="text-[11px] font-sans text-zinc-400 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 inline-block">
              npm run companion
            </div>
          </div>
        )}

        {/* Format Selector & Navigation Tabs */}
        {isOnline && (
          <div className="flex items-center justify-between py-3 border-b border-white/[0.06] gap-2">
            <div className="flex items-center gap-1.5 bg-black/30 p-1 rounded-xl border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setActiveTab('search')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'search'
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                YouTube Search
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('library');
                  loadLibrary();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'library'
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>Cached Library</span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[10px]">
                  {libraryItems.length}
                </span>
              </button>
            </div>

            {/* Audio Format Switcher */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[11px] text-zinc-500 mr-1 hidden sm:inline">Format:</span>
              {(['opus', 'm4a', 'mp3'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-sans uppercase tracking-wider transition-all cursor-pointer ${
                    format === fmt
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-white/[0.04] text-zinc-400 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 min-h-[260px] custom-scrollbar">
          {/* TAB 1: Search */}
          {activeTab === 'search' && isOnline && (
            <div className="space-y-3">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search song title or paste YouTube URL..."
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !query.trim()}
                  className="px-4 py-2 bg-white text-zinc-950 hover:bg-zinc-200 rounded-xl text-xs font-bold transition-all disabled:opacity-40 cursor-pointer shrink-0"
                >
                  {isSearching ? 'Searching…' : 'Search'}
                </button>
              </form>

              {downloadNote && (
                <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-emerald-300 flex items-center gap-2">
                  <Disc className="w-3.5 h-3.5 animate-spin" />
                  <span>{downloadNote}</span>
                </div>
              )}

              {/* Search results list */}
              <div className="space-y-1.5 pt-1">
                {searchResults.map((item) => {
                  const isDownloadingThis = downloadingId === item.id;
                  const thumb = item.thumbnail || `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] transition-colors gap-3"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <img
                          src={thumb}
                          alt=""
                          className="w-12 h-9 rounded object-cover bg-black/40 shrink-0"
                          loading="lazy"
                        />
                        <div className="overflow-hidden">
                          <div className="text-xs font-semibold text-white truncate" title={item.title}>
                            {item.title}
                          </div>
                          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                            <span className="truncate max-w-[140px]">{item.uploader || 'YouTube'}</span>
                            {item.durationFormatted && <span>· {item.durationFormatted}</span>}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownload(item.id, item.title)}
                        disabled={Boolean(downloadingId)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition-all active:scale-95 cursor-pointer disabled:opacity-40 shrink-0"
                      >
                        {isDownloadingThis ? (
                          <>
                            <Disc className="w-3.5 h-3.5 animate-spin" />
                            <span>Getting…</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Fetch</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}

                {searchResults.length === 0 && !isSearching && (
                  <div className="text-center py-8 text-zinc-500 text-xs">
                    Type a track title or paste a YouTube URL to stream lossless audio.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Library */}
          {activeTab === 'library' && isOnline && (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1">
                <span className="text-[11px] text-zinc-400">
                  Cached files on local companion disk
                </span>
                <button
                  type="button"
                  onClick={openCompanionAudioFolder}
                  className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  title="Reveal cache directory in Explorer/Finder"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Open Folder</span>
                </button>
              </div>

              {libraryItems.map((item) => {
                const ext = item.filename.split('.').pop() || 'opus';
                return (
                  <div
                    key={item.filename}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] transition-colors gap-3"
                  >
                    <div className="overflow-hidden">
                      <div className="text-xs font-semibold text-white truncate" title={item.title}>
                        {item.title}
                      </div>
                      <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                        <span className="font-sans uppercase text-emerald-400 text-[10px]">
                          {ext}
                        </span>
                        <span>·</span>
                        <span>{item.size_formatted}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectCached(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-semibold transition-all active:scale-95 cursor-pointer shrink-0"
                    >
                      <Music2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Load into Studio</span>
                    </button>
                  </div>
                );
              })}

              {libraryItems.length === 0 && !isLoadingLibrary && (
                <div className="text-center py-8 text-zinc-500 text-xs">
                  No cached audio files yet. Search and download tracks to populate the cache.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-1.5">
            <span>Eliminates YouTube iframe embeds</span>
            <span>·</span>
            <span>60fps Web Audio Waveform</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/10 text-zinc-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
