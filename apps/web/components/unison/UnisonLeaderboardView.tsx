'use client';

import React, { useEffect, useState } from 'react';
import { fetchUnisonCuratorsLeaderboard } from '@/lib/unison/apiClient';
import type { UnisonCurator } from '@/lib/unison/types';
import { UnisonBadge } from './UnisonBadge';

interface UnisonLeaderboardViewProps {
  onSelectCurator: (keyId: string) => void;
  selfKeyId?: string | null;
}

function DiscordIconSmall({ className = 'w-2.5 h-2.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function TrophyIcon({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <svg className="w-5 h-5 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3L12 16.1l-4.8 2.5.9-5.3L4.3 9.6l5.3-.8L12 2z" />
      </svg>
    );
  }
  if (rank === 2) {
    return (
      <svg className="w-5 h-5 text-slate-300 drop-shadow-[0_0_8px_rgba(203,213,225,0.4)]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3L12 16.1l-4.8 2.5.9-5.3L4.3 9.6l5.3-.8L12 2z" />
      </svg>
    );
  }
  if (rank === 3) {
    return (
      <svg className="w-5 h-5 text-amber-700 drop-shadow-[0_0_8px_rgba(180,83,9,0.4)]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3L12 16.1l-4.8 2.5.9-5.3L4.3 9.6l5.3-.8L12 2z" />
      </svg>
    );
  }
  return <span className="text-xs tabular-nums text-white/40">#{rank}</span>;
}

export function UnisonLeaderboardView({ onSelectCurator, selfKeyId }: UnisonLeaderboardViewProps) {
  const [curators, setCurators] = useState<UnisonCurator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const list = await fetchUnisonCuratorsLeaderboard();
        if (active) setCurators(list);
      } catch (err: any) {
        if (active) setError(err.message || 'Failed to load leaderboard');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {/* Header section */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-medium text-white tracking-tight">Leaderboard</h1>
        <p className="text-xs sm:text-sm text-white/50 mt-1">
          Ranked by community votes and approved songs
        </p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse"
            >
              <div className="w-6 h-6 rounded-full bg-white/10 shrink-0" />
              <div className="w-12 h-12 rounded-full bg-white/10 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="w-1/3 h-4 rounded bg-white/10" />
                <div className="w-24 h-3 rounded bg-white/5" />
              </div>
              <div className="w-16 h-8 rounded bg-white/5" />
              <div className="w-16 h-8 rounded bg-white/5" />
              <div className="w-16 h-8 rounded bg-white/5" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="p-8 rounded-2xl border border-red-500/20 bg-red-950/20 text-center text-red-200">
          <p className="font-medium text-base">Could not load leaderboard</p>
          <p className="text-xs text-red-400/80 mt-1">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Curators List */}
      {!isLoading && !error && curators.length > 0 && (
        <ul className="space-y-1.5 sm:space-y-2">
          {curators.map((entry) => {
            const isSelf = selfKeyId ? entry.keyId === selfKeyId : false;
            const truncatedKey = `${entry.keyId.slice(0, 6)}…${entry.keyId.slice(-6)}`;
            const podium = !entry.community && entry.rank >= 1 && entry.rank <= 3;

            return (
              <li key={entry.keyId}>
                <button
                  type="button"
                  onClick={() => onSelectCurator(entry.keyId)}
                  className={`w-full text-left flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border transition-all duration-200 group ${
                    isSelf
                      ? 'bg-amber-500/[0.08] border-amber-500/30 hover:bg-amber-500/[0.12]'
                      : 'bg-[#15141b]/50 hover:bg-white/[0.05] border-white/[0.04] hover:border-white/[0.08]'
                  }`}
                >
                  {/* Rank Cell */}
                  <span className="w-7 sm:w-8 shrink-0 flex items-center justify-center">
                    {podium && entry.tier ? (
                      <UnisonBadge badgeKey={entry.tier} size="md" />
                    ) : (
                      <TrophyIcon rank={entry.rank} />
                    )}
                  </span>

                  {/* Avatar with Discord Badge */}
                  <span className="relative w-11 h-11 sm:w-12 sm:h-12 shrink-0">
                    <img
                      src={entry.avatarUrl || 'https://cdn.betterlyrics.org/avatars/default.webp'}
                      alt={entry.displayName}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          'https://cdn.betterlyrics.org/avatars/default.webp';
                      }}
                      className="w-full h-full rounded-full object-cover border border-white/10 bg-white/5"
                    />
                    {entry.discordLinked && (
                      <span
                        title="Discord connected"
                        className="absolute -right-0.5 -bottom-0.5 grid place-items-center w-4 h-4 rounded-full border border-[#0f0e13] bg-[#5865f2] text-white shadow-sm"
                      >
                        <DiscordIconSmall className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </span>

                  {/* Curator Name, Badges, KeyId */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-medium text-white group-hover:text-amber-300 transition-colors truncate">
                        {entry.displayName}
                      </span>
                      {isSelf && (
                        <span className="rounded bg-amber-400 text-black px-1.5 py-0.5 text-[10px] font-medium tracking-wider uppercase">
                          You
                        </span>
                      )}
                      {/* Featured badges row */}
                      {entry.featured && entry.featured.length > 0 && (
                        <span className="inline-flex items-center gap-1 shrink-0 ml-1">
                          {entry.featured.slice(0, 5).map((badge, bIdx) => (
                            <UnisonBadge
                              key={`${badge.key}-${badge.tier || bIdx}`}
                              badgeKey={badge.key}
                              name={badge.name}
                              tier={badge.tier}
                              size="xs"
                            />
                          ))}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-white/40 mt-0.5" title={entry.keyId}>
                      {truncatedKey}
                    </p>
                  </div>

                  {/* Subs count */}
                  <div className="hidden sm:block text-right w-16 shrink-0">
                    <p className="text-sm font-medium text-white">{entry.submissionCount.toLocaleString()}</p>
                    <p className="text-[10px] tracking-wider uppercase text-white/40">songs</p>
                  </div>

                  {/* Upvotes count */}
                  <div className="hidden sm:block text-right w-16 shrink-0">
                    <p className="text-sm font-medium text-white">{entry.totalUpvotes.toLocaleString()}</p>
                    <p className="text-[10px] tracking-wider uppercase text-white/40">votes</p>
                  </div>

                  {/* Score */}
                  <div className="text-right w-14 sm:w-16 shrink-0">
                    <p className="text-sm font-medium text-amber-400">
                      {entry.score.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </p>
                    <p className="text-[10px] tracking-wider uppercase text-white/40">score</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Empty State */}
      {!isLoading && !error && curators.length === 0 && (
        <div className="p-12 text-center text-white/50 border border-white/5 rounded-2xl bg-white/[0.01]">
          <p className="text-base font-medium text-white/80">No curators ranked yet</p>
          <p className="text-xs text-white/40 mt-1">
            Be the first to add lyrics!
          </p>
        </div>
      )}
    </div>
  );
}
