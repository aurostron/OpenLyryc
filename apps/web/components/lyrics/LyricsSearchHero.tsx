'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Search, 
  Disc, 
  Clock, 
  ArrowUpRight, 
  SlidersHorizontal, 
  SunMedium,
  Palette,
  Check,
  Music2
} from 'lucide-react';
import { SongSearchResult } from '@/types/lyrics';
import { searchAllOnlineLyrics } from '@/lib/onlineLyricsService';
import { OpenLyrycLogo } from '@/components/OpenLyrycLogo';

interface LyricsSearchHeroProps {
  onSelectSong: (song: SongSearchResult) => void;
  onOpenBgCustomizer?: () => void;
  initialQuery?: string;
  mode?: 'lyrics' | 'karaoke';
  isKaraoke?: boolean;
}

const POPULAR_SUGGESTIONS = [
  { title: 'Tu Jaane Na', artist: 'Atif Aslam, Pritam', query: 'tu jaane na' },
  { title: 'Bohemian Rhapsody', artist: 'Queen', query: 'bohemian rhapsody' },
  { title: 'Blinding Lights', artist: 'The Weeknd', query: 'blinding lights' },
  { title: 'Midnight City', artist: 'M83', query: 'midnight city' },
  { title: 'Yellow', artist: 'Coldplay', query: 'yellow' },
  { title: 'As It Was', artist: 'Harry Styles', query: 'as it was' },
];

function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const LyricsSearchHero: React.FC<LyricsSearchHeroProps> = ({
  onSelectSong,
  onOpenBgCustomizer,
  initialQuery = '',
  mode = 'lyrics',
  isKaraoke = false,
}) => {
  const isKaraokeMode = mode === 'karaoke' || isKaraoke;
  const [query, setQuery] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState<'titles' | 'lyrics'>('titles');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SongSearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Perform live search when query or filter changes
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const hits = await searchAllOnlineLyrics(q, controller.signal);
        let filtered = hits || [];

        // Apply filter weighting if user toggled 'titles' vs 'lyrics'
        if (activeFilter === 'titles') {
          const lq = q.toLowerCase();
          filtered = [...filtered].sort((a, b) => {
            const aTitleMatch = a.title.toLowerCase().includes(lq) ? 1 : 0;
            const bTitleMatch = b.title.toLowerCase().includes(lq) ? 1 : 0;
            return bTitleMatch - aTitleMatch;
          });
        }

        setResults(filtered);
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
  }, [query, activeFilter]);

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-white/20 selection:text-white">
      {/* Top Header Bar */}
      <header className="w-full px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link 
          href="/" 
          className="flex items-center gap-2 group cursor-pointer select-none"
          title="OpenLyryc Home"
        >
          <OpenLyrycLogo className="h-5 w-auto text-white group-hover:opacity-90 transition-opacity" />
          {isKaraokeMode && (
            <div className="relative inline-flex items-center justify-center overflow-hidden px-2 py-0.5 rounded-full border border-white/20 bg-white/[0.04] text-[10px] font-sans font-bold uppercase tracking-wider text-white shadow-sm">
              <span className="relative z-10 bg-gradient-to-r from-zinc-300 via-white to-zinc-300 bg-clip-text text-transparent animate-shine-text">
                Karaoke
              </span>
              <span className="absolute inset-0 pointer-events-none -translate-x-full animate-karaoke-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            </div>
          )}
        </Link>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {onOpenBgCustomizer && (
            <button
              type="button"
              onClick={onOpenBgCustomizer}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] border border-transparent hover:border-white/[0.06] transition-all cursor-pointer"
              title="Change Background"
            >
              <Palette className="w-4 h-4" />
            </button>
          )}

          <Link
            href="/studio"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 hover:text-white text-xs font-medium border border-white/[0.08] transition-colors cursor-pointer"
          >
            <span>Studio</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400" />
          </Link>
        </div>
      </header>

      {/* Main Hero Search Section */}
      <main className="w-full max-w-3xl mx-auto px-6 py-8 flex-1 flex flex-col justify-start">
        {/* Subtitle */}
        <div className="mb-3">
          <p className="text-xs sm:text-sm font-medium text-zinc-400 tracking-wide">
            {isKaraokeMode
              ? 'Karaoke tracks and synchronized lyrics'
              : 'Synchronized lyrics catalog'}
          </p>
        </div>

        {/* Large Borderless Live Input */}
        <div className="relative mb-4">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isKaraokeMode ? 'Search song or artist…' : 'Search song or artist…'}
            className="w-full bg-transparent text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white placeholder:text-zinc-700 focus:outline-none caret-white transition-colors py-1"
          />
        </div>

        {/* Dynamic Query Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {POPULAR_SUGGESTIONS.map((item) => (
            <button
              key={item.query}
              type="button"
              onClick={() => {
                setQuery(item.query);
                inputRef.current?.focus();
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                query.toLowerCase() === item.query.toLowerCase()
                  ? 'bg-white text-zinc-950 border-white shadow-sm'
                  : 'bg-white/[0.03] text-zinc-400 border-white/[0.06] hover:bg-white/[0.08] hover:text-white hover:border-white/15'
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>

        {/* Matches Header Row + Segmented Filter Pill */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm font-semibold text-zinc-300">
              Matches
            </span>
            {results.length > 0 && (
              <span className="text-xs font-sans text-zinc-500">
                ({results.length})
              </span>
            )}
            {isSearching && (
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                <div className="w-3 h-3 rounded-full border border-zinc-500 border-t-white animate-spin" />
                <span className="text-[11px] text-zinc-400">Searching</span>
              </div>
            )}
          </div>

          {/* Segmented Control: [ Titles ] [ Lyrics ] */}
          <div className="flex items-center bg-white/[0.04] p-0.5 rounded-full border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setActiveFilter('titles')}
              className={`px-3.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                activeFilter === 'titles'
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Titles
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('lyrics')}
              className={`px-3.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                activeFilter === 'lyrics'
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Lyrics
            </button>
          </div>
        </div>

        {/* Search Results List */}
        <div className="space-y-1.5">
          {results.length > 0 ? (
            results.map((song) => {
              const hasWordSync = song.hasWordSync;
              return (
                <div
                  key={song.id}
                  onClick={() => onSelectSong(song)}
                  className="group flex items-center justify-between p-3 rounded-2xl hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] transition-all cursor-pointer"
                >
                  {/* Left Artwork & Titles */}
                  <div className="flex items-center gap-3.5 min-w-0 pr-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-zinc-900 border border-white/10 shrink-0 flex items-center justify-center shadow-sm">
                      {song.coverArt ? (
                        <img
                          src={song.coverArt}
                          alt={song.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <Disc className="w-6 h-6 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 truncate">
                        <span className="text-sm sm:text-base font-semibold text-white truncate">
                          {song.title}
                        </span>
                        <span className="text-xs sm:text-sm text-zinc-400 font-normal truncate">
                          {song.artist}
                        </span>
                      </div>

                      <div className="text-xs text-zinc-500 font-normal truncate mt-0.5 flex items-center gap-2">
                        <span className="truncate">
                          {song.album || 'Single'} {song.year ? `· ${song.year}` : ''}
                        </span>
                        {hasWordSync ? (
                          <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-white/[0.08] text-zinc-300 shrink-0">
                            Syllable
                          </span>
                        ) : (
                          <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-white/[0.04] text-zinc-400 shrink-0">
                            Synced
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Duration */}
                  <div className="shrink-0 text-right">
                    <span className="text-xs sm:text-sm font-sans text-zinc-400 tabular-nums">
                      {formatDuration(song.duration)}
                    </span>
                  </div>
                </div>
              );
            })
          ) : query.trim().length >= 2 && !isSearching ? (
            <div className="py-16 text-center text-sm text-zinc-500">
              No verified lyrics found for &ldquo;{query}&rdquo;. Try another title or artist.
            </div>
          ) : (
            /* Recommendations when query is empty */
            <div className="py-8">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                Popular & Verified Tracks
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {POPULAR_SUGGESTIONS.map((item) => (
                  <div
                    key={item.title}
                    onClick={() => setQuery(item.query)}
                    className="p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/15 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate group-hover:text-white">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {item.artist}
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 ml-2" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 py-6 border-t border-white/[0.06] text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span>{isKaraokeMode ? 'OpenLyryc Karaoke' : 'Brought to you by Lrclib, Lrc.red and Unison.'}</span>
        </div>
        <div className="flex items-center gap-4 text-zinc-400">
          <Link href="/lyrics" className="hover:text-white transition-colors">Lyrics</Link>
          <Link href="/karaoke" className="hover:text-white transition-colors">Karaoke</Link>
          <Link href="/studio" className="hover:text-white transition-colors">Studio</Link>
          <Link href="/preview" className="hover:text-white transition-colors">Stage</Link>
          <Link href="/help" className="hover:text-white transition-colors">Guide</Link>
        </div>
      </footer>
    </div>
  );
};
