'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SongSearchResult, OpenLyricsDocument } from '@/types/lyrics';
import { searchSongs, fetchLyricsDocument } from '@/lib/apiClient';

interface CloudSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSong: (doc: OpenLyricsDocument, song: SongSearchResult) => void;
}

export const CloudSearchModal: React.FC<CloudSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectSong,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SongSearchResult[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'synced' | 'word'>('all');

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    performSearch(query);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [isOpen]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (val.trim().length < 2) {
      performSearch(val);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch(val);
    }, 300);
  };

  const performSearch = async (searchTerm: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoading(true);

    try {
      const res = await searchSongs(searchTerm, signal);
      if (!signal.aborted) {
        setResults(res.results || []);
      }
    } catch {
      if (!signal.aborted) {
        setResults([]);
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    performSearch(query);
  };

  const handleSelect = async (song: SongSearchResult) => {
    setLoadingId(song.id);
    try {
      const doc = await fetchLyricsDocument(song.id);
      if (doc) {
        onSelectSong(doc, song);
        onClose();
      }
    } catch (err) {
      console.warn('[CloudSearchModal] lyric document fetch failed:', err);
    } finally {
      setLoadingId(null);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const filteredResults = results.filter((song) => {
    if (filter === 'word') return song.hasWordSync;
    if (filter === 'synced') return song.hasLineSync || song.hasWordSync;
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-[#101014] border border-white/[0.1] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] text-zinc-100 overflow-hidden font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div>
            <h2 className="font-semibold text-white text-base tracking-tight">Search Lyrics</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Search across Musixmatch, Apple Music, and LRCLIB</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors flex items-center justify-center cursor-pointer"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Search Bar & Filter Tabs */}
        <div className="p-5 border-b border-white/[0.08] bg-white/[0.01] space-y-3">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-lg pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search by song title, artist, or album..."
              className="w-full bg-white/[0.04] border border-white/[0.1] focus:border-white/40 focus:bg-white/[0.06] rounded-xl text-white py-2.5 pl-11 pr-24 text-sm focus:outline-none transition-all placeholder:text-zinc-500"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  performSearch('');
                }}
                className="absolute right-20 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">clear</span>
              </button>
            )}
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3.5 py-1.5 bg-white text-zinc-950 font-medium text-xs rounded-lg hover:bg-zinc-200 transition-all cursor-pointer"
            >
              Search
            </button>
          </form>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-white text-zinc-950'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              All ({results.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('synced')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                filter === 'synced'
                  ? 'bg-white text-zinc-950'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              Line Synced ({results.filter((s) => s.hasLineSync || s.hasWordSync).length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('word')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                filter === 'word'
                  ? 'bg-white text-zinc-950'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              Word Synced ({results.filter((s) => s.hasWordSync).length})
            </button>
          </div>
        </div>

        {/* Results / Loading / Empty State */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {loading ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 py-3 text-zinc-400 text-xs font-medium">
                <span className="material-symbols-outlined animate-spin text-base text-zinc-300">progress_activity</span>
                <span>Searching for lyrics...</span>
              </div>

              {/* Skeleton Rows */}
              <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-white/[0.01]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/[0.08] text-zinc-500 font-medium text-[11px]">
                      <th className="px-4 py-3">Song</th>
                      <th className="px-4 py-3">Artist</th>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3">Format</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {[1, 2, 3, 4].map((i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 py-3 space-y-1">
                          <div className="h-3.5 bg-white/10 rounded w-36" />
                          <div className="h-2.5 bg-white/5 rounded w-24" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-3 bg-white/10 rounded w-28" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-3 bg-white/5 rounded w-10" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-3.5 bg-white/10 rounded w-20" />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="h-6 bg-white/10 rounded-lg w-12 ml-auto" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="text-center py-16 px-6 text-zinc-400 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-zinc-500 mx-auto mb-2">
                <span className="material-symbols-outlined text-xl">music_note</span>
              </div>
              <p className="text-sm font-medium text-zinc-200">
                {query.trim()
                  ? `No lyrics found for "${query}"`
                  : 'Search for Any Song'}
              </p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                {query.trim()
                  ? 'Try checking the spelling or searching with just the artist name.'
                  : 'Type a song or artist name above to find synchronized lyrics.'}
              </p>
            </div>
          ) : (
            <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-white/[0.01]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/[0.08] text-zinc-500 font-medium text-[11px]">
                    <th className="px-4 py-3">Song</th>
                    <th className="px-4 py-3">Artist</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Format</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredResults.map((song) => (
                    <tr
                      key={song.id}
                      className="hover:bg-white/[0.04] transition-colors group cursor-pointer"
                      onClick={() => handleSelect(song)}
                    >
                      <td className="px-4 py-3 font-medium text-white max-w-[240px] truncate">
                        <div className="truncate">{song.title}</div>
                        {song.album && (
                          <span className="block text-[11px] text-zinc-500 font-normal truncate">
                            {song.album}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-300 max-w-[180px] truncate">
                        {song.artist}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-zinc-400 font-sans text-[11px]">
                        {formatDuration(song.duration)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 items-start">
                          {song.hasWordSync ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-white text-zinc-950 text-[10px] font-semibold">
                              Word Sync
                            </span>
                          ) : song.hasLineSync ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/[0.08] text-zinc-300 text-[10px] font-medium border border-white/[0.08]">
                              Line Sync
                            </span>
                          ) : song.isInstrumental ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/[0.04] text-zinc-500 text-[10px]">
                              Instrumental
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/[0.04] text-zinc-500 text-[10px]">
                              Plain Text
                            </span>
                          )}
                          {song.syncedBy && (
                            <span className="text-[10px] text-zinc-500 truncate max-w-[140px]">
                              {song.syncedBy}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={loadingId === song.id}
                          className="px-3 py-1.5 bg-white text-zinc-950 font-medium text-xs rounded-lg hover:bg-zinc-200 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                        >
                          {loadingId === song.id ? 'Loading...' : 'Load'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/[0.08] bg-white/[0.02] flex justify-between items-center text-xs text-zinc-500">
          <span>{filteredResults.length} {filteredResults.length === 1 ? 'result' : 'results'}</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
};


