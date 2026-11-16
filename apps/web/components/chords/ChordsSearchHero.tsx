'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Search, 
  Disc, 
  ArrowUpRight, 
  Palette
} from 'lucide-react';
import { SEEDED_CHORD_SONGS, ChordSongConfig } from '@/lib/data/chordsData';
import { OpenLyrycLogo } from '@/components/OpenLyrycLogo';

interface ChordsSearchHeroProps {
  onSelectSong: (song: ChordSongConfig) => void;
  onSearch?: (query: string) => void;
  onOpenBgCustomizer?: () => void;
  initialQuery?: string;
}

const POPULAR_SUGGESTIONS = [
  { title: 'Tu Jaane Na', artist: 'Atif Aslam', query: 'tu jaane na' },
  { title: "Can't Help Falling In Love", artist: 'Elvis Presley', query: "can't help falling in love" },
  { title: 'Wonderwall', artist: 'Oasis', query: 'wonderwall' },
  { title: 'Perfect', artist: 'Ed Sheeran', query: 'perfect' },
  { title: 'Kabira', artist: 'Tochi Raina', query: 'kabira' },
];

export const ChordsSearchHero: React.FC<ChordsSearchHeroProps> = ({
  onSelectSong,
  onOpenBgCustomizer,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState<'titles' | 'chords'>('titles');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filteredSongs = SEEDED_CHORD_SONGS.filter((s) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    return (
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      s.chordsUsed.some((c) => c.toLowerCase() === q)
    );
  });

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-white/20 selection:text-white bg-[#08080a] text-zinc-100 font-sans">
      {/* ── Top Header Bar ─────────────────────────────────────────────────── */}
      <header className="w-full px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link 
          href="/" 
          className="flex items-center gap-2 group cursor-pointer select-none"
          title="OpenLyryc Home"
        >
          <OpenLyrycLogo className="h-5 w-auto text-white group-hover:opacity-90 transition-opacity" />
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

      {/* ── Main Hero Search Section ─────────────────────────────────────────── */}
      <main className="w-full max-w-3xl mx-auto px-6 py-8 flex-1 flex flex-col justify-start">
        {/* Subtitle / Counter */}
        <div className="mb-3">
          <p className="text-xs sm:text-sm font-medium text-zinc-400 tracking-wide">
            Interactive Chords & Diagrams.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative mb-4">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search song title or artist…"
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
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-6">
          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm font-semibold text-zinc-300">
              Matches
            </span>
            <span className="text-xs font-sans text-zinc-500">
              ({filteredSongs.length})
            </span>
          </div>

          {/* Segmented Control: [ Titles ] [ Chords ] */}
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
              onClick={() => setActiveFilter('chords')}
              className={`px-3.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                activeFilter === 'chords'
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Chords
            </button>
          </div>
        </div>

        {/* Popular & Verified Tracks List */}
        <div className="space-y-4">
          <div className="text-[11px] font-sans uppercase tracking-widest text-zinc-500 font-semibold">
            POPULAR & VERIFIED CHORD TRACKS
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredSongs.map((song) => (
              <div
                key={song.id}
                onClick={() => onSelectSong(song)}
                className="group flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/15 transition-all cursor-pointer shadow-sm"
              >
                <div className="min-w-0 pr-3 space-y-0.5">
                  <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                    {song.title}
                  </h3>
                  <p className="text-xs text-zinc-400 truncate">
                    {song.artist}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-sans text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                      {song.key || 'G Major'}
                    </span>
                    {song.capo && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-sans text-zinc-400 bg-white/[0.06]">
                        {song.capo}
                      </span>
                    )}
                  </div>
                </div>

                <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ── Footer Bar ────────────────────────────────────────────────────────── */}
      <footer className="w-full px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 py-6 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
        <div>
          OpenLyryc Guitar Chords Engine · Handcrafted chord sheets & diagram lookup
        </div>
        <div className="flex items-center gap-4 text-zinc-400">
          <Link href="/about" className="hover:text-white transition-colors">About</Link>
          <Link href="/preview" className="hover:text-white transition-colors">Stage</Link>
          <Link href="/studio" className="hover:text-white transition-colors">Studio</Link>
          <Link href="/help" className="hover:text-white transition-colors">Guide</Link>
        </div>
      </footer>
    </div>
  );
};
