'use client';

import React, { useState, useEffect } from 'react';
import {
  Radio,
  Search,
  Play,
  Flame,
  ExternalLink,
  RefreshCw,
  X,
  Music,
  Check,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import {
  fetchUnisonMostWanted,
  searchUnisonLyrics,
  fetchUnisonLyricsByVideo,
  fetchUnisonArtwork,
} from '@/lib/unison/apiClient';
import type { UnisonMostWantedSong } from '@/lib/unison/types';

export interface UnisonSelectedSong {
  videoId: string;
  song: string;
  artist: string;
  thumbnailUrl?: string | null;
  initialLyrics?: string;
  format?: 'ttml' | 'lrc' | 'plain';
}

interface UnisonHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTimingSong: (song: UnisonSelectedSong) => void;
}

export const UnisonHubModal: React.FC<UnisonHubModalProps> = ({
  isOpen,
  onClose,
  onStartTimingSong,
}) => {
  const [activeTab, setActiveTab] = useState<'most_wanted' | 'search'>('most_wanted');

  // Most Wanted state
  const [mostWanted, setMostWanted] = useState<UnisonMostWantedSong[]>([]);
  const [isLoadingWanted, setIsLoadingWanted] = useState<boolean>(false);
  const [wantedError, setWantedError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Loading a specific song
  const [loadingSongId, setLoadingSongId] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load Most Wanted on open
  useEffect(() => {
    if (isOpen) {
      loadWantedSongs();
    }
  }, [isOpen]);

  const loadWantedSongs = async () => {
    setIsLoadingWanted(true);
    setWantedError(null);
    try {
      const data = await fetchUnisonMostWanted('', 30);
      setMostWanted(data.items || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch Most Wanted songs.';
      setWantedError(msg);
    } finally {
      setIsLoadingWanted(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await searchUnisonLyrics({ q: searchQuery.trim() });
      setSearchResults(results || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Search failed.';
      setSearchError(msg);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectWanted = async (item: UnisonMostWantedSong) => {
    setLoadingSongId(item.videoId);
    try {
      let initialLyrics: string | undefined;
      let format: 'ttml' | 'lrc' | 'plain' | undefined;

      // Check if there are existing plain or linesync lyrics on Unison to start with
      try {
        const existing = await fetchUnisonLyricsByVideo(item.videoId);
        if (existing?.lyrics) {
          initialLyrics = existing.lyrics;
          format = existing.format;
        }
      } catch {
        // No existing lyrics, starting clean
      }

      onStartTimingSong({
        videoId: item.videoId,
        song: item.song,
        artist: item.artist,
        thumbnailUrl: item.thumbnailUrl,
        initialLyrics,
        format,
      });
      onClose();
    } catch (err) {
      console.error('Failed to prepare song for timing:', err);
    } finally {
      setLoadingSongId(null);
    }
  };

  const handleSelectSearchResult = (hit: any) => {
    onStartTimingSong({
      videoId: hit.videoId || '',
      song: hit.song || hit.title || 'Untitled',
      artist: hit.artist || 'Unknown Artist',
      thumbnailUrl: hit.thumbnailUrl || null,
      initialLyrics: hit.lyrics,
      format: hit.format,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-2xl bg-[#0d0d12] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-zinc-100 animate-in zoom-in-95 duration-150"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-[#09090b]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-white tracking-tight">Unison Song Explorer</h2>
              <p className="text-xs text-zinc-400">Discover songs requested by the community</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors flex items-center justify-center cursor-pointer"
            aria-label="Close explorer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 border-b border-white/[0.06] flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('most_wanted')}
            className={`pb-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'most_wanted'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>Most Wanted ({mostWanted.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`pb-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'search'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-zinc-400" />
            <span>Search Catalog</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* TAB 1: Most Wanted */}
          {activeTab === 'most_wanted' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">
                  Songs requested by Better Lyrics listeners with no word-synced lyrics yet:
                </p>
                <button
                  onClick={loadWantedSongs}
                  disabled={isLoadingWanted}
                  className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  title="Refresh list"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWanted ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {wantedError && (
                <div className="p-3 bg-red-950/30 border border-red-500/20 rounded-xl text-xs text-red-300">
                  {wantedError}
                </div>
              )}

              {isLoadingWanted && mostWanted.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500 space-y-2">
                  <RefreshCw className="w-5 h-5 mx-auto animate-spin text-zinc-400" />
                  <p>Fetching community requests...</p>
                </div>
              ) : mostWanted.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500">
                  No pending song requests found.
                </div>
              ) : (
                <div className="space-y-2">
                  {mostWanted.map((item, idx) => {
                    const isRowLoading = loadingSongId === item.videoId;
                    return (
                      <div
                        key={item.videoId || idx}
                        className="p-3 rounded-xl bg-white/[0.015] hover:bg-white/[0.035] border border-white/[0.06] flex items-center justify-between gap-4 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-normal text-zinc-500 w-5 text-right shrink-0">
                            #{item.rank || idx + 1}
                          </span>
                          <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden shrink-0 border border-white/[0.06] flex items-center justify-center">
                            {item.thumbnailUrl ? (
                              <img
                                src={item.thumbnailUrl}
                                alt={item.song}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Music className="w-4 h-4 text-zinc-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-medium text-white truncate group-hover:text-rose-200 transition-colors">
                              {item.song}
                            </h4>
                            <p className="text-[11px] text-zinc-400 truncate">{item.artist}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-xs font-medium text-rose-400">
                              {item.demand}
                            </span>
                            <span className="text-[10px] text-zinc-500 block uppercase">
                              Demand
                            </span>
                          </div>

                          <button
                            onClick={() => handleSelectWanted(item)}
                            disabled={isRowLoading}
                            className="h-8 px-3 rounded-lg bg-white/[0.06] hover:bg-white text-zinc-300 hover:text-zinc-950 font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98] disabled:opacity-50"
                          >
                            {isRowLoading ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <span>Start Timing</span>
                                <ArrowRight className="w-3 h-3" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Catalog Search */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search song title, artist, or YouTube URL..."
                    className="w-full h-9 pl-9 pr-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
                </button>
              </form>

              {searchError && (
                <div className="p-3 bg-red-950/30 border border-red-500/20 rounded-xl text-xs text-red-300">
                  {searchError}
                </div>
              )}

              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((hit, idx) => (
                    <div
                      key={hit.id || idx}
                      className="p-3 rounded-xl bg-white/[0.015] hover:bg-white/[0.035] border border-white/[0.06] flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white truncate">{hit.song || hit.title}</div>
                        <div className="text-[11px] text-zinc-400 truncate">{hit.artist}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-zinc-800 text-zinc-400">
                          {hit.syncType || hit.format || 'lyrics'}
                        </span>
                        <button
                          onClick={() => handleSelectSearchResult(hit)}
                          className="h-7 px-2.5 rounded-lg bg-white/[0.06] hover:bg-white text-zinc-300 hover:text-zinc-950 font-medium text-[11px] transition-all cursor-pointer"
                        >
                          Load
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchQuery && !isSearching ? (
                <div className="py-12 text-center text-xs text-zinc-500">
                  No matching lyrics found on Unison.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
