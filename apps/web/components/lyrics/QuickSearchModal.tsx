'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Disc, Clock, ArrowRight } from 'lucide-react';
import { SongSearchResult } from '@/types/lyrics';
import { searchAllOnlineLyrics } from '@/lib/onlineLyricsService';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSong: (song: SongSearchResult) => void;
}

function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const QUICK_SUGGESTIONS = [
  'Bohemian Rhapsody Queen',
  'Tu Jaane Na Atif Aslam',
  'Blinding Lights The Weeknd',
  'Midnight City M83',
  'Yellow Coldplay',
  'As It Was Harry Styles',
];

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectSong,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SongSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const hits = await searchAllOnlineLyrics(query.trim(), controller.signal);
        setResults(hits || []);
      } catch {
        // ignore
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Global key listener for Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl bg-[#0e0e12] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[75vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search song title, artist, or lyrics…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
          />
          {isSearching && (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List or Quick Suggestions */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {results.length > 0 ? (
            results.map((song) => (
              <div
                key={song.id}
                onClick={() => {
                  onSelectSong(song);
                  onClose();
                }}
                className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.06] border border-transparent hover:border-white/[0.06] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-900 border border-white/10 shrink-0 flex items-center justify-center">
                    {song.coverArt ? (
                      <img src={song.coverArt} alt={song.title} className="w-full h-full object-cover" />
                    ) : (
                      <Disc className="w-5 h-5 text-zinc-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate group-hover:text-white">
                      {song.title}
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {song.artist} {song.year ? `· ${song.year}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {song.duration ? (
                    <span className="text-[11px] font-sans text-zinc-500 tabular-nums">
                      {formatDuration(song.duration)}
                    </span>
                  ) : null}
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))
          ) : query.trim().length >= 2 && !isSearching ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              No matching lyrics found for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">
                Trending Tracks
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setQuery(s)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white text-xs border border-white/[0.06] transition-colors cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-2.5 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-between text-[11px] text-zinc-500">
          <span>Search 29.8M+ verified songs</span>
          <span className="font-sans text-[10px] bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/[0.06]">
            ESC to close
          </span>
        </div>
      </div>
    </div>
  );
};
