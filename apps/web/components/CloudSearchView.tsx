'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SongSearchResult, OpenLyricsDocument, LyricLine } from '@/types/lyrics';
import { searchSongs, fetchLyricsDocument } from '@/lib/apiClient';
import {
  ArrowLeft,
  Search,
  Music2,
  Clock,
  Loader2,
  ArrowRight,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface CloudSearchViewProps {
  onBack: () => void;
  onSelectSong: (doc: OpenLyricsDocument, song: SongSearchResult) => void;
}

export const CloudSearchView: React.FC<CloudSearchViewProps> = ({
  onBack,
  onSelectSong,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SongSearchResult[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'word' | 'synced'>('all');
  const [hasSearched, setHasSearched] = useState(false);

  // Inline preview cache: map of songId -> LyricLine[]
  const [previewMap, setPreviewMap] = useState<Record<string, LyricLine[]>>({});
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [expandedPreviewId, setExpandedPreviewId] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const performSearch = useCallback(
    async (searchTerm: string) => {
      const trimmed = searchTerm.trim();
      if (!trimmed) {
        setResults([]);
        setHasSearched(false);
        setLoading(false);
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setLoading(true);
      setHasSearched(true);

      try {
        const res = await searchSongs(trimmed, signal);
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
    },
    []
  );

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (val.trim().length === 0) {
      setHasSearched(false);
      setResults([]);
      return;
    }

    if (val.trim().length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        performSearch(val);
      }, 300);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      performSearch(query);
    } else if (e.key === 'Escape') {
      onBack();
    }
  };

  const handleClear = () => {
    setQuery('');
    setHasSearched(false);
    setResults([]);
    inputRef.current?.focus();
  };

  const handleSelect = async (song: SongSearchResult) => {
    setLoadingId(song.id);
    try {
      const doc = await fetchLyricsDocument(song.id);
      if (doc) {
        onSelectSong(doc, song);
      }
    } catch (err) {
      // A failing remote lookup must not reject past this handler: it runs from
      // an onClick, and an unhandled rejection tears down the whole studio tree.
      console.warn('[CloudSearch] lyric document fetch failed:', err);
    } finally {
      setLoadingId(null);
    }
  };

  const handleTogglePreview = async (e: React.MouseEvent, song: SongSearchResult) => {
    e.stopPropagation();
    if (expandedPreviewId === song.id) {
      setExpandedPreviewId(null);
      return;
    }

    if (previewMap[song.id]) {
      setExpandedPreviewId(song.id);
      return;
    }

    setPreviewLoadingId(song.id);
    try {
      const doc = await fetchLyricsDocument(song.id);
      if (doc && doc.lines) {
        setPreviewMap((prev) => ({ ...prev, [song.id]: doc.lines }));
        setExpandedPreviewId(song.id);
      }
    } catch (err) {
      console.warn('[CloudSearch] preview fetch failed:', err);
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(2);
    return `[${m.toString().padStart(2, '0')}:${s.padStart(5, '0')}]`;
  };

  const filteredResults = results.filter((song) => {
    if (filter === 'word') return song.hasWordSync;
    if (filter === 'synced') return song.hasLineSync || song.hasWordSync;
    return true;
  });

  const wordCount = results.filter((s) => s.hasWordSync).length;
  const lineCount = results.filter((s) => s.hasLineSync || s.hasWordSync).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent text-zinc-100 select-none overflow-hidden font-sans">
      {/* Top Header */}
      <header className="h-14 border-b border-white/[0.08] px-6 md:px-8 flex items-center justify-between shrink-0 bg-[#0e0e12] studio-chrome">
        <div className="flex items-center gap-3">
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
          <h1 className="text-sm font-semibold text-white tracking-tight">Search Lyrics</h1>
        </div>

        <div className="flex items-center gap-4 text-xs text-zinc-400">
          <a
            href="#paste"
            className="hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer py-1"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Got lyrics already? Paste it here</span>
          </a>
          <span className="text-zinc-600 hidden sm:inline">•</span>
          <span className="text-zinc-500 font-sans text-[11px] hidden sm:inline">Esc to close</span>
        </div>
      </header>

      {/* Fixed Search Bar & Filters Area */}
      <div className="px-6 md:px-8 pt-6 pb-4 border-b border-white/[0.06] bg-[#0b0b0e] studio-chrome shrink-0">
        <div className="max-w-3xl mx-auto space-y-3.5">
          {/* Search Input Bar */}
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-zinc-400 absolute left-4 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search song title, artist, or album..."
              className="w-full bg-[#131318] border border-white/[0.12] focus:border-white/40 rounded-xl pl-11 pr-24 py-3 text-sm text-white placeholder:text-zinc-500 outline-none transition-colors"
            />
            <div className="absolute right-3 flex items-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />}
              {query && !loading && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <span className="hidden sm:inline text-[11px] font-sans text-zinc-500 px-1.5 py-0.5 rounded border border-white/[0.08] bg-white/[0.02]">
                Enter
              </span>
            </div>
          </div>

          {/* Filter Tabs & Counter */}
          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  filter === 'all'
                    ? 'bg-white text-black font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                All Tracks {results.length > 0 && `(${results.length})`}
              </button>
              <button
                type="button"
                onClick={() => setFilter('word')}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  filter === 'word'
                    ? 'bg-white text-black font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                Word Synced {wordCount > 0 && `(${wordCount})`}
              </button>
              <button
                type="button"
                onClick={() => setFilter('synced')}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  filter === 'synced'
                    ? 'bg-white text-black font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                Line Synced {lineCount > 0 && `(${lineCount})`}
              </button>
            </div>

            {results.length > 0 && (
              <span className="text-xs font-sans text-zinc-400">
                {filteredResults.length} {filteredResults.length === 1 ? 'song found' : 'songs found'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Results and Lyrics Preview List */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Initial State */}
          {!hasSearched && query.trim().length === 0 && (
            <div className="text-center py-24 text-zinc-500 space-y-2 select-none">
              <Music2 className="w-9 h-9 text-zinc-600 mx-auto" />
              <p className="text-sm font-medium text-zinc-300">
                Type a song title, artist, or album to search
              </p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Indexed synchronized lyrics ready for one-click import into OpenLyryc Studio.
              </p>
            </div>
          )}

          {/* Loading State */}
          {loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
              <p className="text-xs">Searching lyrics database...</p>
            </div>
          )}

          {/* No Results Found */}
          {hasSearched && !loading && filteredResults.length === 0 && (
            <div className="text-center py-20 text-zinc-500 space-y-3">
              <p className="text-sm font-medium text-zinc-300">
                No songs matched &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Try searching for just the artist name or song title. If you have the lyrics, you can
                paste them directly.
              </p>
              <div className="pt-2">
                <a
                  href="#paste"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-xs text-white border border-white/[0.1] transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Paste raw lyrics into Studio</span>
                </a>
              </div>
            </div>
          )}

          {/* Results List */}
          {filteredResults.map((song) => {
            const isLoadingThis = loadingId === song.id;
            const isPreviewExpanded = expandedPreviewId === song.id;
            const isPreviewLoading = previewLoadingId === song.id;
            const previewLines = previewMap[song.id] || [];

            return (
              <div
                key={song.id}
                className="p-4 rounded-xl bg-[#121217] border border-white/[0.08] hover:border-white/20 transition-all flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2
                        onClick={() => !isLoadingThis && handleSelect(song)}
                        className="text-sm font-semibold text-white hover:text-zinc-300 transition-colors cursor-pointer truncate"
                      >
                        {song.title}
                      </h2>
                      {song.hasWordSync ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-sans bg-white/10 text-white border border-white/20 shrink-0">
                          Word Synced
                        </span>
                      ) : song.hasLineSync ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-sans bg-white/[0.06] text-zinc-300 border border-white/10 shrink-0">
                          Line Synced
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-sans bg-white/[0.04] text-zinc-400 border border-white/[0.06] shrink-0">
                          Plain
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 truncate mt-1">
                      {song.artist}
                      {song.album && <span className="text-zinc-500"> · {song.album}</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-sans text-zinc-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      <span>{formatDuration(song.duration)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => !isLoadingThis && handleSelect(song)}
                      disabled={isLoadingThis}
                      className="px-3 py-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      {isLoadingThis ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Loading</span>
                        </>
                      ) : (
                        <>
                          <span>Open</span>
                          <ArrowRight className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] text-xs">
                  <span className="text-[11px] font-sans text-zinc-500">
                    {song.source ? `via ${song.source}` : 'OpenLyryc'}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => handleTogglePreview(e, song)}
                    disabled={isPreviewLoading}
                    className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {isPreviewLoading ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Loading preview</span>
                      </>
                    ) : isPreviewExpanded ? (
                      <>
                        <span>Hide preview</span>
                        <ChevronUp className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        <span>Preview lyrics</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>

                {/* Inline Preview Drawer */}
                {isPreviewExpanded && (
                  <div className="mt-1 p-3 rounded-lg bg-[#0b0b0e] border border-white/[0.06] text-xs font-sans space-y-1">
                    <div className="text-[10px] text-zinc-500 pb-1.5 mb-1.5 border-b border-white/[0.06] flex items-center justify-between">
                      <span>Lyrics preview</span>
                      <span>{previewLines.length} lines total</span>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                      {previewLines.slice(0, 8).map((line, idx) => (
                        <div key={idx} className="flex items-baseline gap-2.5">
                          <span className="text-zinc-600 text-[10px] shrink-0 select-none">
                            {formatTimestamp(line.start)}
                          </span>
                          <span className="text-zinc-300 truncate">
                            {line.text || '(instrumental)'}
                          </span>
                        </div>
                      ))}
                      {previewLines.length > 8 && (
                        <div className="text-zinc-500 text-[10px] pt-1">
                          ... {previewLines.length - 8} more lines
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default CloudSearchView;
