'use client';

import React, { useEffect, useState } from 'react';
import { CouncilSeal } from './CouncilSeal';
import { UnisonSongCard } from './UnisonSongCard';
import { fetchUnisonSealed, fetchUnisonFeedGrid, fetchUnisonMostWanted } from '@/lib/unison/apiClient';
import type { UnisonFeedEntry, UnisonMostWantedSong } from '@/lib/unison/types';
import { ArrowRight, Flame, Layers, Music2 } from 'lucide-react';

interface UnisonSongsViewProps {
  onPlaySong: (song: {
    videoId: string;
    song: string;
    artist: string;
    id?: number;
    thumbnailUrl?: string | null;
    originRect?: { top: number; left: number; width: number; height: number } | null;
  }) => void;
  onEditInStudio: (song: { videoId: string; song: string; artist: string; id?: number; thumbnailUrl?: string | null }) => void;
  onSelectCurator: (curator: { keyId: string; displayName?: string }) => void;
  onNavigateToTab: (tab: 'songs' | 'leaderboard' | 'about' | 'profile') => void;
  onHoverSongArtwork?: (artworkUrl: string | null) => void;
}

export const UnisonSongsView: React.FC<UnisonSongsViewProps> = ({
  onPlaySong,
  onEditInStudio,
  onSelectCurator,
  onNavigateToTab,
  onHoverSongArtwork,
}) => {
  const [sealedSongs, setSealedSongs] = useState<UnisonFeedEntry[]>([]);
  const [isLoadingSealed, setIsLoadingSealed] = useState(true);

  const [topVotedSongs, setTopVotedSongs] = useState<UnisonFeedEntry[]>([]);
  const [isLoadingTopVoted, setIsLoadingTopVoted] = useState(true);

  const [recentlySyncedSongs, setRecentlySyncedSongs] = useState<UnisonFeedEntry[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);

  const [mostWanted, setMostWanted] = useState<UnisonMostWantedSong[]>([]);
  const [isLoadingWanted, setIsLoadingWanted] = useState(true);

  useEffect(() => {
    let alive = true;

    // 1. Fetch Sealed by Council
    fetchUnisonSealed(12)
      .then((res) => {
        if (alive) setSealedSongs(res.items || []);
      })
      .catch((err) => console.warn('[UnisonSongsView] Failed to load sealed:', err))
      .finally(() => {
        if (alive) setIsLoadingSealed(false);
      });

    // 2. Fetch Top Voted
    fetchUnisonFeedGrid('top-rated', 8)
      .then((res) => {
        if (alive) setTopVotedSongs(res.items || []);
      })
      .catch((err) => console.warn('[UnisonSongsView] Failed to load top-voted:', err))
      .finally(() => {
        if (alive) setIsLoadingTopVoted(false);
      });

    // 3. Fetch Recently Synced
    fetchUnisonFeedGrid('newest', 8)
      .then((res) => {
        if (alive) setRecentlySyncedSongs(res.items || []);
      })
      .catch((err) => console.warn('[UnisonSongsView] Failed to load recent:', err))
      .finally(() => {
        if (alive) setIsLoadingRecent(false);
      });

    // 4. Fetch Most Wanted
    fetchUnisonMostWanted('', 10)
      .then((res) => {
        if (alive) setMostWanted(res.items || []);
      })
      .catch((err) => console.warn('[UnisonSongsView] Failed to load most wanted:', err))
      .finally(() => {
        if (alive) setIsLoadingWanted(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-16 max-sm:space-y-12 pb-16">
      {/* ── 1. Sealed by the Council Shelf ── */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CouncilSeal size={22} />
              <h2 className="text-xl sm:text-2xl font-medium text-white tracking-tight">
                Sealed by the Council
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-1 font-normal">
              Approved by the Better Lyrics Council
            </p>
          </div>
        </div>

        {/* Horizontal Scrolling Carousel */}
        <div className="relative">
          {isLoadingSealed ? (
            <div className="flex gap-4 overflow-hidden py-1">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="w-[152px] sm:w-[168px] shrink-0 animate-pulse">
                  <div className="aspect-square w-full rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
                  <div className="h-4 bg-white/[0.06] rounded-md mt-3 w-3/4" />
                  <div className="h-3 bg-white/[0.04] rounded-md mt-1.5 w-1/2" />
                </div>
              ))}
            </div>
          ) : sealedSongs.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {sealedSongs.map((entry) => (
                <UnisonSongCard
                  key={entry.id}
                  entry={entry}
                  variant="shelf"
                  onPlaySong={onPlaySong}
                  onEditInStudio={onEditInStudio}
                  onSelectCurator={onSelectCurator}
                  onHoverArtwork={onHoverSongArtwork}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center text-xs text-zinc-500">
              No sealed songs found right now.
            </div>
          )}
        </div>
      </section>

      {/* ── 2. Top Voted Grid ── */}
      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-medium text-white tracking-tight">
            Top Voted
          </h2>
          <p className="text-xs text-zinc-400 mt-1 font-normal">
            Top rated by the community
          </p>
        </div>

        {isLoadingTopVoted ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse flex flex-col">
                <div className="aspect-square w-full rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
                <div className="h-4 bg-white/[0.06] rounded-md mt-3 w-3/4" />
                <div className="h-3 bg-white/[0.04] rounded-md mt-1.5 w-1/2" />
              </div>
            ))}
          </div>
        ) : topVotedSongs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {topVotedSongs.map((entry) => (
              <UnisonSongCard
                key={entry.id}
                entry={entry}
                variant="grid"
                onPlaySong={onPlaySong}
                onEditInStudio={onEditInStudio}
                onSelectCurator={onSelectCurator}
                onHoverArtwork={onHoverSongArtwork}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center text-xs text-zinc-500">
            No top voted songs available.
          </div>
        )}
      </section>

      {/* ── 3. Recently Synced Grid ── */}
      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-medium text-white tracking-tight">
            Recently Synced
          </h2>
          <p className="text-xs text-zinc-400 mt-1 font-normal">
            Recently added lyrics
          </p>
        </div>

        {isLoadingRecent ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse flex flex-col">
                <div className="aspect-square w-full rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
                <div className="h-4 bg-white/[0.06] rounded-md mt-3 w-3/4" />
                <div className="h-3 bg-white/[0.04] rounded-md mt-1.5 w-1/2" />
              </div>
            ))}
          </div>
        ) : recentlySyncedSongs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {recentlySyncedSongs.map((entry) => (
              <UnisonSongCard
                key={entry.id}
                entry={entry}
                variant="grid"
                onPlaySong={onPlaySong}
                onEditInStudio={onEditInStudio}
                onSelectCurator={onSelectCurator}
                onHoverArtwork={onHoverSongArtwork}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center text-xs text-zinc-500">
            No recent submissions found.
          </div>
        )}
      </section>

      {/* ── 4. Most Wanted Queue ── */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-medium text-white tracking-tight">
              Most Wanted
            </h2>
            <p className="text-xs text-zinc-400 mt-1 font-normal">
              Songs waiting for lyrics, ranked by requests
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden divide-y divide-white/[0.04]">
          {isLoadingWanted ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-white/[0.03] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : mostWanted.length > 0 ? (
            mostWanted.map((song, idx) => {
              const thumb = song.thumbnailUrl || `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`;
              return (
                <div
                  key={song.videoId || idx}
                  className="flex items-center justify-between gap-4 p-3.5 sm:p-4 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="text-xs font-medium text-zinc-500 w-6 text-center shrink-0">
                      #{idx + 1}
                    </span>

                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-white/10 shrink-0 border border-white/10">
                      <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate leading-snug">
                        {song.song}
                      </div>
                      <div className="text-xs text-zinc-400 truncate mt-0.5 font-normal">
                        {song.artist}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <span className="text-xs font-medium text-zinc-200">{song.demand}</span>
                      <span className="text-[10px] text-zinc-500 block uppercase tracking-wider font-normal">Requests</span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onEditInStudio({
                          videoId: song.videoId,
                          song: song.song,
                          artist: song.artist,
                          thumbnailUrl: thumb,
                        })
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white text-zinc-200 hover:text-zinc-950 text-xs font-medium transition-all cursor-pointer active:scale-95 shadow-sm"
                    >
                      <span>Sync lyrics</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-zinc-500">
              No requested songs in the queue right now.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
