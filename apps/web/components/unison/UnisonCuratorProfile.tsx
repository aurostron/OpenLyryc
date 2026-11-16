'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  fetchUnisonUserSubmissions,
  fetchUnisonKeyIdByHandle,
  deleteUnisonSubmission,
} from '@/lib/unison/apiClient';
import type { UnisonFeedEntry, UnisonUserSubmission } from '@/lib/unison/types';
import { UnisonBadge } from './UnisonBadge';
import { UnisonSongCard } from './UnisonSongCard';
import { BetterLyricsLogo } from './BetterLyricsLogo';
import { Trash2, AlertCircle, Check, Loader2, X } from 'lucide-react';

interface UnisonCuratorProfileProps {
  keyId: string;
  onBack: () => void;
  onSelectSong: (song: {
    videoId: string;
    title: string;
    artist: string;
    id?: number;
    thumbnailUrl?: string | null;
    originRect?: { top: number; left: number; width: number; height: number } | null;
  }) => void;
  onStartTimingSong: (title: string, artist: string, videoId?: string) => void;
  selfKeyId?: string | null;
  onProfileAvatarChange?: (avatarUrl: string | null) => void;
  onHoverSongArtwork?: (artworkUrl: string | null) => void;
}

interface CuratorProfileData {
  ranked: boolean;
  keyId: string;
  displayName: string;
  handle?: string;
  avatarUrl?: string;
  rank: number;
  score: number;
  reputation: number;
  tier?: string;
  level: number;
  xp: number;
  xpForNext: number;
  xpFloor: number;
  badgeCount: number;
  submissionCount: number;
  totalUpvotes: number;
  discordLinked?: boolean;
  featured?: Array<{ key: string; name: string; tier?: number }>;
}

export function UnisonCuratorProfile({
  keyId,
  onBack,
  onSelectSong,
  onStartTimingSong,
  selfKeyId,
  onProfileAvatarChange,
  onHoverSongArtwork,
}: UnisonCuratorProfileProps) {
  const [profile, setProfile] = useState<CuratorProfileData | null>(null);
  const [submissions, setSubmissions] = useState<UnisonUserSubmission[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Deletion state
  const [deletingSong, setDeletingSong] = useState<{ id: number; song: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [syncTypeFilter, setSyncTypeFilter] = useState<'all' | 'richsync' | 'linesync' | 'plain'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'most_votes'>('newest');
  const [copied, setCopied] = useState(false);

  // Avoid effect re-trigger loop by storing callback in a ref
  const onAvatarChangeRef = useRef(onProfileAvatarChange);
  useEffect(() => {
    onAvatarChangeRef.current = onProfileAvatarChange;
  }, [onProfileAvatarChange]);

  // Load curator profile info
  useEffect(() => {
    let active = true;
    async function loadProfile() {
      setIsLoadingProfile(true);
      setError(null);
      try {
        let lookupKey = keyId;
        if (keyId.length < 32) {
          const resolved = await fetchUnisonKeyIdByHandle(keyId);
          if (resolved) lookupKey = resolved;
        }
        const res = await fetch(`https://unison.betterlyrics.org/leaderboard/users/${encodeURIComponent(lookupKey)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (active && json.data) {
          setProfile(json.data);
          onAvatarChangeRef.current?.(json.data.avatarUrl || null);
        }
      } catch (err: any) {
        if (active) setError(err.message || 'Could not load curator');
      } finally {
        if (active) setIsLoadingProfile(false);
      }
    }
    loadProfile();
    return () => {
      active = false;
    };
  }, [keyId]);

  const handleConfirmDelete = async () => {
    if (!deletingSong) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteUnisonSubmission(deletingSong.id);
      setSubmissions((prev) => prev.filter((s) => s.id !== deletingSong.id));
      if (profile) {
        setProfile({
          ...profile,
          submissionCount: Math.max(0, profile.submissionCount - 1),
        });
      }
      setDeleteSuccess(`"${deletingSong.song}" was deleted from Unison.`);
      setDeletingSong(null);
      setTimeout(() => setDeleteSuccess(null), 4000);
    } catch (err: any) {
      setDeleteError(err.message || 'Could not delete submission');
    } finally {
      setIsDeleting(false);
    }
  };

  // Load curator submissions
  useEffect(() => {
    let active = true;
    async function loadSubmissions() {
      setIsLoadingSubmissions(true);
      try {
        let lookupKey = keyId;
        if (keyId.length < 32) {
          const resolved = await fetchUnisonKeyIdByHandle(keyId);
          if (resolved) lookupKey = resolved;
        }
        const resp = await fetchUnisonUserSubmissions(lookupKey, {
          syncType: syncTypeFilter === 'all' ? undefined : syncTypeFilter,
          sort: sortBy,
          limit: 50,
        });
        if (active) {
          const list = Array.isArray(resp) ? resp : (resp as any)?.submissions || [];
          setSubmissions(list);
        }
      } catch (err) {
        console.warn('Failed to load user submissions', err);
        if (active) setSubmissions([]);
      } finally {
        if (active) setIsLoadingSubmissions(false);
      }
    }
    loadSubmissions();
    return () => {
      active = false;
    };
  }, [keyId, syncTypeFilter, sortBy]);

  // Client-side text search filter
  const filteredSubmissions = useMemo(() => {
    if (!searchQuery.trim()) return submissions;
    const q = searchQuery.toLowerCase().trim();
    return submissions.filter(
      (s) =>
        s.song.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        (s.album && s.album.toLowerCase().includes(q))
    );
  }, [submissions, searchQuery]);

  // Progress to next level calculation
  const levelProgress = useMemo(() => {
    if (!profile) return { percent: 0, needed: 0 };
    const current = profile.xp - profile.xpFloor;
    const range = profile.xpForNext - profile.xpFloor;
    const percent = range > 0 ? Math.min(100, Math.max(0, Math.round((current / range) * 100))) : 100;
    const needed = Math.max(0, profile.xpForNext - profile.xp);
    return { percent, needed };
  }, [profile]);

  const handleCopyLink = () => {
    const handle = profile?.handle || keyId;
    const link = `https://unison.betterlyrics.org/u/${handle}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSelf = selfKeyId ? keyId === selfKeyId : false;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300 pb-16">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/70 hover:text-white text-xs font-medium transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
      </div>

      {/* Loading Skeleton */}
      {isLoadingProfile && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 h-96 rounded-3xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
          <div className="lg:col-span-7 space-y-4">
            <div className="h-12 w-3/4 bg-white/[0.04] rounded-2xl animate-pulse" />
            <div className="h-6 w-1/2 bg-white/[0.03] rounded-xl animate-pulse" />
            <div className="h-10 w-48 bg-white/[0.04] rounded-xl animate-pulse" />
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !isLoadingProfile && (
        <div className="p-8 rounded-2xl border border-red-500/20 bg-red-950/20 text-center text-red-200">
          <p className="font-medium text-base">Curator profile not found</p>
          <p className="text-xs text-red-400/80 mt-1">{error}</p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      )}

      {/* Profile Hero Header */}
      {!isLoadingProfile && profile && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left: Floating Profile Glass Card (matching Image 4) */}
          <div className="lg:col-span-5 relative group">
            {/* Ambient warm background glow behind card */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-amber-600/20 via-orange-500/10 to-red-600/20 rounded-[34px] blur-2xl opacity-60 pointer-events-none" />

            <div className="relative rounded-[28px] bg-[#16141a]/85 border border-white/[0.09] p-7 shadow-2xl backdrop-blur-2xl space-y-6 overflow-hidden">
              {/* Card top pills row */}
              <div className="flex items-center justify-between">
                {/* Unison Brand badge */}
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.07] border border-white/[0.08] text-xs font-medium text-white shadow-inner">
                  <BetterLyricsLogo size={16} />
                  <span>Unison</span>
                </span>

                {/* Tier & Rank pill */}
                {profile.tier && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-medium text-amber-300">
                    <UnisonBadge badgeKey={profile.tier} size="xs" showTooltip={false} />
                    <span className="capitalize">{profile.tier}</span>
                    <span className="text-amber-400">#{profile.rank}</span>
                  </span>
                )}
              </div>

              {/* Avatar with Circular XP progress ring */}
              <div className="flex items-center justify-center pt-2">
                <div className="relative w-28 h-28 sm:w-32 sm:h-32">
                  {/* SVG circular XP ring */}
                  <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="transparent"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="5"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="transparent"
                      stroke="#fbbf24"
                      strokeWidth="5"
                      strokeDasharray={283}
                      strokeDashoffset={283 - (283 * levelProgress.percent) / 100}
                      strokeLinecap="round"
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>

                  {/* Avatar Image centered */}
                  <div className="absolute inset-2 rounded-full overflow-hidden border-2 border-white/20 bg-black/40 shadow-inner">
                    <img
                      src={profile.avatarUrl || 'https://cdn.betterlyrics.org/avatars/default.webp'}
                      alt={profile.displayName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          'https://cdn.betterlyrics.org/avatars/default.webp';
                      }}
                    />
                  </div>

                  {/* Level badge pill at bottom-right */}
                  <span className="absolute bottom-0 right-1 px-2 py-0.5 rounded-full bg-white text-black font-medium text-xs shadow-md border-2 border-[#16141a]">
                    {profile.level}
                  </span>
                </div>
              </div>

              {/* Handle & Name */}
              <div className="text-center space-y-1">
                <h2 className="text-2xl sm:text-3xl font-medium text-white tracking-tight">
                  {profile.displayName}
                </h2>
                <p className="text-xs font-normal text-white/50">
                  @{profile.handle || `${keyId.slice(0, 6)}…${keyId.slice(-6)}`}
                </p>

                {/* Featured badges row */}
                {profile.featured && profile.featured.length > 0 && (
                  <div className="flex items-center justify-center gap-1.5 pt-2">
                    {profile.featured.map((badge, idx) => (
                      <UnisonBadge
                        key={`${badge.key}-${badge.tier || idx}`}
                        badgeKey={badge.key}
                        name={badge.name}
                        tier={badge.tier}
                        size="md"
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Stats 3-column row */}
              <div className="grid grid-cols-3 pt-4 border-t border-white/[0.08] text-center">
                <div>
                  <div className="text-xl sm:text-2xl font-medium text-white">{profile.submissionCount}</div>
                  <div className="text-[11px] text-white/40 uppercase tracking-wider mt-0.5 font-normal">Synced songs</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-medium text-white">{profile.totalUpvotes}</div>
                  <div className="text-[11px] text-white/40 uppercase tracking-wider mt-0.5 font-normal">Votes</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-medium text-white">{profile.badgeCount}</div>
                  <div className="text-[11px] text-white/40 uppercase tracking-wider mt-0.5 font-normal">Badges</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Hero side (matching Image 4) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-5xl font-normal text-white tracking-tight leading-tight">
                {profile.submissionCount} songs synced.{' '}
                <span className="text-white/40 font-normal block sm:inline">
                  {profile.ranked ? `Ranked #${profile.rank} on Unison.` : 'New curator.'}
                </span>
              </h1>
              <p className="text-sm text-white/60 font-normal">
                Level <span className="text-white font-medium">{profile.level}</span> •{' '}
                {levelProgress.needed > 0
                  ? `${levelProgress.needed} XP to Level ${profile.level + 1}`
                  : 'Max level reached'}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white text-xs font-medium transition-all shadow-sm"
              >
                <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                {copied ? 'Copied' : 'Share'}
              </button>

              <a
                href={`https://unison.betterlyrics.org/u/${profile.handle || keyId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/80 hover:text-white text-xs font-medium transition-all"
              >
                <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open on web
              </a>
            </div>
          </div>
        </div>
      )}

      {/* "Songs synced" Section */}
      <div className="space-y-6 pt-6 border-t border-white/[0.08]">
        {/* Section title & Filters bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-medium text-white tracking-tight">Synced songs</h2>
            <span className="text-xs font-normal text-white/40">
              {filteredSubmissions.length} total
            </span>
          </div>

          {/* Search & dropdowns */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1 sm:flex-none">
              <input
                type="text"
                placeholder="Search song or artist..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#18161e] border border-white/[0.08] focus:border-amber-400/50 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/40 outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sync type filter */}
            <select
              value={syncTypeFilter}
              onChange={(e) => setSyncTypeFilter(e.target.value as any)}
              className="bg-[#18161e] border border-white/[0.08] focus:border-amber-400/50 rounded-xl px-3 py-2 text-xs text-white/80 outline-none cursor-pointer"
            >
              <option value="all">All types</option>
              <option value="richsync">Richsync</option>
              <option value="linesync">Linesync</option>
              <option value="plain">Plain</option>
            </select>

            {/* Sort order filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#18161e] border border-white/[0.08] focus:border-amber-400/50 rounded-xl px-3 py-2 text-xs text-white/80 outline-none cursor-pointer"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="most_votes">Most votes</option>
            </select>
          </div>
        </div>

        {/* Loading submissions */}
        {isLoadingSubmissions && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
            ))}
          </div>
        )}

        {/* Submissions Grid */}
        {!isLoadingSubmissions && filteredSubmissions.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
            {filteredSubmissions.map((sub) => {
              // Convert submission to UnisonFeedEntry format for UnisonSongCard
              const feedEntry: UnisonFeedEntry = {
                id: sub.id,
                videoId: sub.videoId,
                song: sub.song,
                artist: sub.artist,
                album: sub.album,
                duration: sub.duration,
                format: sub.format || 'ttml',
                syncType: sub.syncType,
                language: sub.language,
                voteCount: sub.voteCount,
                confidence: sub.confidence,
                createdAt: sub.createdAt,
                submitter: {
                  keyId,
                  displayName: profile?.displayName || 'Curator',
                  avatarUrl: profile?.avatarUrl,
                },
              };

              return (
                <UnisonSongCard
                  key={sub.id || sub.videoId}
                  entry={feedEntry}
                  onPlaySong={(s) =>
                    onSelectSong({
                      videoId: s.videoId,
                      title: s.song,
                      artist: s.artist,
                      id: s.id,
                      thumbnailUrl: s.thumbnailUrl,
                      originRect: s.originRect,
                    })
                  }
                  onEditInStudio={(s) => onStartTimingSong(s.song, s.artist, s.videoId)}
                  onSelectCurator={() => {}}
                  onHoverArtwork={(art) => onHoverSongArtwork?.(art)}
                  onDelete={
                    isSelf && sub.id
                      ? () => setDeletingSong({ id: sub.id!, song: sub.song })
                      : undefined
                  }
                />
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoadingSubmissions && filteredSubmissions.length === 0 && (
          <div className="p-12 text-center border border-white/5 rounded-2xl bg-white/[0.01] space-y-2">
            <p className="text-sm font-medium text-white/70">No songs found</p>
            <p className="text-xs text-white/40">Try searching with a different title or artist name.</p>
          </div>
        )}
      </div>

      {/* ── Delete Submission Modal ── */}
      {deletingSong && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl bg-[#141219] border border-white/10 p-6 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-medium text-white tracking-tight">Delete submission?</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Remove your synced lyrics for <span className="text-white font-medium">&ldquo;{deletingSong.song}&rdquo;</span> from Unison. This cannot be undone.
              </p>
            </div>

            {deleteError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeletingSong(null);
                  setDeleteError(null);
                }}
                className="flex-1 h-10 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md shadow-rose-600/30"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success Toast ── */}
      {deleteSuccess && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{deleteSuccess}</span>
        </div>
      )}
    </div>
  );
}
