'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  Play,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import { OpenLyrycLogo } from '@/components/OpenLyrycLogo';
import {
  PublicUserProfile,
  STATIC_PROFILES,
  KNOWN_FEATURED_TRACKS,
  ProfileTrackInfo,
  fetchPublicUserProfile,
  getLastActiveLabel,
} from '@/lib/profiles';
import {
  fetchUnisonUserStats,
  fetchUnisonUserSubmissions,
  fetchUnisonUserRank,
} from '@/lib/unison/apiClient';
import type {
  UnisonUserStats,
  UnisonUserSubmission,
} from '@/lib/unison/types';
import {
  Achievement,
  ACHIEVEMENTS_CATALOGUE,
  getUserAchievements,
} from '@/lib/achievements';
import { AchievementStickers } from '@/components/achievements/AchievementStickers';
import { SteamAchievementToast } from '@/components/achievements/SteamAchievementToast';

interface ProfileClientViewProps {
  initialUsername: string;
}

const GithubIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

export default function ProfileClientView({ initialUsername }: ProfileClientViewProps) {
  const [cleanUsername] = useState(() => {
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/^\/(?:u\/|@)([^/]+)/i);
      if (match && match[1]) {
        return match[1].toLowerCase().replace(/^@+/, '');
      }
    }
    return (initialUsername || 'aurostron').toLowerCase().replace(/^@+/, '');
  });

  // Profile data from static seed or Turso point lookup
  const initialProfile = STATIC_PROFILES[cleanUsername] || {
    username: cleanUsername,
    displayName: cleanUsername,
    bio: 'Curating word-by-word synced lyrics on OpenLyryc.',
  };

  const isStaticUser = Boolean(STATIC_PROFILES[cleanUsername]);
  const [isClaimed, setIsClaimed] = useState<boolean>(isStaticUser);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(!isStaticUser);
  const [profile, setProfile] = useState<PublicUserProfile>(initialProfile);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  // Unison dynamic stats (0 Turso reads)
  const [unisonStats, setUnisonStats] = useState<UnisonUserStats | null>(null);
  const [unisonSubmissions, setUnisonSubmissions] = useState<UnisonUserSubmission[]>([]);
  const [unisonRank, setUnisonRank] = useState<{ rank: number; score: number; tier?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'lyrics' | 'badges'>('lyrics');

  // Steam-style achievement toast state
  const [activeToast, setActiveToast] = useState<Achievement | null>(null);

  // Load profile from Turso / Multi-Tier Cache
  // Always fetch — static seed is only an initial placeholder, never a hard short-circuit.
  useEffect(() => {
    let isMounted = true;

    setIsLoadingProfile(true);
    fetchPublicUserProfile(cleanUsername)
      .then((fetched) => {
        if (!isMounted) return;
        if (fetched) {
          setProfile(fetched);
          setIsClaimed(true);
        } else if (STATIC_PROFILES[cleanUsername]) {
          setProfile(STATIC_PROFILES[cleanUsername]);
          setIsClaimed(true);
        } else {
          setIsClaimed(false);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        if (STATIC_PROFILES[cleanUsername]) {
          setProfile(STATIC_PROFILES[cleanUsername]);
          setIsClaimed(true);
        } else {
          setIsClaimed(false);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingProfile(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cleanUsername]);

  // Load live Unison curator stats if unisonKeyId is linked (0 Turso reads)
  useEffect(() => {
    const keyId = profile.unisonKeyId;
    if (!keyId) return;

    let isMounted = true;

    fetchUnisonUserStats(keyId)
      .then((st) => isMounted && setUnisonStats(st))
      .catch(() => {});

    fetchUnisonUserSubmissions(keyId, { limit: 20 })
      .then((res) => isMounted && setUnisonSubmissions(res.submissions || []))
      .catch(() => {});

    fetchUnisonUserRank(keyId)
      .then((rk) => isMounted && setUnisonRank(rk))
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [profile.unisonKeyId]);

  // Copy Key ID
  const handleCopyKey = () => {
    if (!profile.unisonKeyId) return;
    navigator.clipboard.writeText(profile.unisonKeyId);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Copy Profile URL (Domain-agnostic)
  const handleCopyShare = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${origin}/@${profile.username}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  // Compile featured tracks: merge known seeded tracks + any live Unison submissions
  const isAurostron = cleanUsername === 'aurostron';

  const featuredTracks: ProfileTrackInfo[] = React.useMemo(() => {
    const list: ProfileTrackInfo[] = [];
    const seenIds = new Set<string>();

    // 1. Add featured track IDs configured on profile (only aurostron defaults to demo tracks)
    const pinned = profile.featuredTrackIds || (isAurostron ? ['FA_J8XwpCaQ', 'MR3uP7IYz44'] : []);
    for (const vid of pinned) {
      if (KNOWN_FEATURED_TRACKS[vid]) {
        list.push(KNOWN_FEATURED_TRACKS[vid]);
        seenIds.add(vid);
      }
    }

    // 2. Add any live submissions from Unison
    for (const sub of unisonSubmissions) {
      if (sub.videoId && !seenIds.has(sub.videoId)) {
        list.push({
          videoId: sub.videoId,
          title: sub.song,
          artist: sub.artist,
          format: sub.format === 'lrc' ? 'lrc' : 'ttml',
          syncType: sub.syncType === 'linesync' ? 'linesync' : 'richsync',
          score: sub.score,
          humanTimed: true,
        });
        seenIds.add(sub.videoId);
      }
    }

    return list;
  }, [cleanUsername, isAurostron, profile.featuredTrackIds, unisonSubmissions]);

  // Dynamic user achievements based on actual activity and handle claim
  const userAchievements = React.useMemo(() => {
    return getUserAchievements({
      username: cleanUsername,
      hasClaimedHandle: isClaimed,
      unisonKeyId: profile.unisonKeyId,
      submissionsCount: unisonStats?.contributions ?? featuredTracks.length,
    });
  }, [cleanUsername, isClaimed, profile.unisonKeyId, unisonStats?.contributions, featuredTracks.length]);

  const unlockedCount = React.useMemo(() => {
    return userAchievements.filter((a) => a.unlocked).length;
  }, [userAchievements]);

  const shortKeyId = profile.unisonKeyId
    ? `${profile.unisonKeyId.slice(0, 6)}...${profile.unisonKeyId.slice(-4)}`
    : null;
  const lastActiveLabel = getLastActiveLabel(profile.lastActiveAt);

  return (
    <div className="min-h-screen w-full bg-[#08080a] text-zinc-100 flex flex-col font-sans selection:bg-white/20 selection:text-white">
      {/* ── Minimal Top Bar (No sticky navbar, pure breather) ── */}
      <div className="w-full max-w-6xl mx-auto px-6 sm:px-10 pt-8 sm:pt-10 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5 group text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          title="Back to OpenLyryc"
        >
          <OpenLyrycLogo className="h-4 sm:h-5 w-auto text-zinc-300 group-hover:text-white transition-colors select-none" />
          <span className="text-[10px] font-sans uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-500 border border-white/[0.04]">
            Beta
          </span>
        </Link>

        <div className="flex items-center gap-4 text-xs font-sans">
          <Link
            href="/studio"
            className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <span>Studio</span>
            <ArrowRight className="w-3 h-3 text-zinc-500" />
          </Link>
        </div>
      </div>

      {/* ── Unclaimed State ── */}
      {!isClaimed && !isLoadingProfile ? (
        <section className="relative w-full border-b border-white/[0.08] overflow-hidden flex-1 flex flex-col justify-center">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[360px] bg-white/[0.02] blur-[140px] pointer-events-none rounded-full" />
          <div className="max-w-4xl mx-auto px-6 sm:px-10 py-20 relative z-10 text-center flex flex-col items-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-3xl font-sans text-zinc-500 mb-6 select-none shrink-0 shadow-xl">
              @
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-white/10 text-xs font-sans text-zinc-400 mb-4">
              Unclaimed Handle
            </div>

            <h1 className="text-4xl sm:text-6xl font-light tracking-tight text-white max-w-2xl leading-[1.08]">
              @{cleanUsername}
            </h1>

            <p className="text-base sm:text-lg text-zinc-400 font-normal leading-relaxed max-w-md mt-4">
              This handle has not been registered yet on OpenLyryc. You can claim @{cleanUsername} and link your Unison identity in Studio.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link
                href="/studio"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 active:scale-[0.98] font-medium text-xs transition shadow-lg shadow-white/5 cursor-pointer"
              >
                <span>Claim @{cleanUsername} in Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 font-medium text-xs transition cursor-pointer"
              >
                <span>Explore OpenLyryc</span>
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* ── Hero Section (Starts directly with the Curator Name) ── */}
          <section className="relative w-full border-b border-white/[0.08] overflow-hidden">
        {/* Subtle radial focus glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[360px] bg-white/[0.03] blur-[140px] pointer-events-none rounded-full" />

        <div className="max-w-6xl mx-auto px-6 sm:px-10 pt-12 sm:pt-16 pb-16 relative z-10 text-center flex flex-col items-center">
          {/* Avatar Picture (Sleek, non-boxy circle) */}
          {profile.avatarUrl ? (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden ring-2 ring-white/15 shadow-2xl mb-6 select-none bg-zinc-900 shrink-0">
              <img
                src={profile.avatarUrl}
                alt={profile.displayName || profile.username}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/[0.04] ring-1 ring-white/10 flex items-center justify-center text-xl sm:text-2xl font-light text-zinc-300 mb-6 select-none shrink-0">
              {(profile.displayName || profile.username || 'L').slice(0, 1).toUpperCase()}
            </div>
          )}

          {/* Hero Curator Name (Huge, clean, homepage typography) */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-light tracking-tight text-white max-w-4xl leading-[1.08]">
            {profile.displayName || profile.username}
          </h1>

          {/* Bio / Purpose */}
          <p className="text-base sm:text-lg text-zinc-400 font-normal leading-relaxed max-w-2xl mt-5">
            {profile.bio || 'Curating word-by-word synced lyrics on OpenLyryc.'}
          </p>

          {/* Meta & Connection Chips */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-7">
            {shortKeyId && (
              <button
                onClick={handleCopyKey}
                title="Copy full Unison Public Key ID"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-sans text-zinc-300 transition-colors cursor-pointer"
              >
                <span className="text-zinc-500">Key:</span>
                <span>{shortKeyId}</span>
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-500" />}
              </button>
            )}

            {lastActiveLabel && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] text-xs font-sans text-zinc-400">
                {lastActiveLabel}
              </span>
            )}

            {profile.links?.github && (
              <a
                href={profile.links.github}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-zinc-300 transition-colors"
              >
                <GithubIcon className="w-3.5 h-3.5" />
                <span>GitHub</span>
                <ExternalLink className="w-3 h-3 text-zinc-500" />
              </a>
            )}

            <button
              onClick={handleCopyShare}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-zinc-300 transition-colors cursor-pointer"
              title="Copy public profile link"
            >
              {copiedShare ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Link copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Share</span>
                </>
              )}
            </button>
          </div>

          {/* Key Stats Bar (Clean, Borderless Numbers) */}
          <div className="grid grid-cols-3 gap-6 sm:gap-12 mt-12 pt-8 border-t border-white/[0.06] text-center max-w-lg w-full">
            <div>
              <div className="text-2xl sm:text-3xl font-light text-white tracking-tight">
                {unisonStats?.contributions ?? (isAurostron ? featuredTracks.length : 0)}
              </div>
              <div className="text-[11px] font-sans uppercase tracking-wider text-zinc-400 mt-1">
                Submissions
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-light text-white tracking-tight">
                {unisonStats?.reputation ?? (unisonRank?.score ?? (isAurostron ? 30 : 0))}
              </div>
              <div className="text-[11px] font-sans uppercase tracking-wider text-zinc-400 mt-1">
                Reputation
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-light text-white tracking-tight">
                {unisonRank?.rank
                  ? `#${unisonRank.rank}`
                  : unisonRank?.tier
                    ? unisonRank.tier
                    : isAurostron
                      ? 'Top 5%'
                      : '—'}
              </div>
              <div className="text-[11px] font-sans uppercase tracking-wider text-zinc-400 mt-1">
                Leaderboard
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Content Navigation Tabs (Clean Pills) ── */}
      <section className="w-full max-w-6xl mx-auto px-6 sm:px-10 pt-10 pb-5 flex items-center justify-between border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('lyrics')}
            className={`px-4 py-2 rounded-lg text-xs font-medium tracking-tight transition-all cursor-pointer ${
              activeTab === 'lyrics'
                ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <span>Works</span>
            <span className="ml-2 text-[10px] font-sans opacity-60">({featuredTracks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('badges')}
            className={`px-4 py-2 rounded-lg text-xs font-medium tracking-tight transition-all cursor-pointer ${
              activeTab === 'badges'
                ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <span>Achievements</span>
            <span className="ml-2 text-[10px] font-sans opacity-60">
              ({unlockedCount})
            </span>
          </button>
        </div>
      </section>

      {/* ── 4. Main Body: Synced Lyrics / Achievements ── */}
      <main className="w-full max-w-6xl mx-auto px-6 sm:px-10 py-10 flex-1">
        {activeTab === 'lyrics' ? (
          <div className="space-y-4">
            <div className="mb-6">
              <h2 className="text-xl font-light text-white tracking-tight">
                Synced lyrics on OpenLyryc
              </h2>
            </div>

            {featuredTracks.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-white/[0.08] rounded-2xl bg-white/[0.01]">
                <div>
                  </div>
                <p className="text-sm font-medium text-white tracking-tight">
                  No synced lyrics published yet
                </p>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  When @{profile.username} times and publishes synced lyrics in Studio, their verified contributions will appear here.
                </p>
                <div className="mt-5">
                  <Link
                    href="/studio"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-xs text-zinc-300 font-sans transition-colors"
                  >
                    <span>Open Studio</span>
                  </Link>
                </div>
              </div>
            ) : (
              /* Seamless Song Rows (No clunky boxy borders, pure clean hover rows) */
              <div className="divide-y divide-white/[0.04]">
                {featuredTracks.map((track) => {
                  const thumbUrl = `https://img.youtube.com/vi/${track.videoId}/hqdefault.jpg`;
                  const studioLink = `/studio?v=${track.videoId}`;
                  const previewLink = `/preview?q=${encodeURIComponent(`${track.artist} - ${track.title}`)}`;

                  return (
                    <div
                      key={track.videoId}
                      className="group py-4 px-3 -mx-3 rounded-xl hover:bg-white/[0.03] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      {/* Track info & thumbnail */}
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="relative w-128 h-12 sm:w-20 sm:h-14 rounded-lg overflow-hidden bg-zinc-900 shrink-0">
                          <img
                            src={thumbUrl}
                            alt={track.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/20" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm sm:text-base font-normal text-white truncate">
                              {track.title}
                            </h3>
                            {track.humanTimed && (
                              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-sans tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                                <ShieldCheck className="w-3 h-3" />
                                <span>Verified</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                            <span className="truncate">{track.artist}</span>
                            <span className="text-zinc-600">·</span>
                            <span className="font-sans text-[11px] text-zinc-400">
                              {track.syncType === 'richsync' ? 'Apple Music TTML' : 'Enhanced LRC'}
                            </span>
                            {track.wordsCount && (
                              <>
                                <span className="text-zinc-600">·</span>
                                <span className="font-sans text-[11px] text-zinc-400">
                                  {track.wordsCount} words
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Link
                          href={previewLink}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
                          title="View stage playback preview"
                        >
                          <Play className="w-3 h-3" />
                          <span>Preview</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-xl font-light text-white tracking-tight">
                Achievements
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Milestones earned on OpenLyryc!
              </p>
            </div>

            {/* Hand-Drawn Sticker Achievement Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {userAchievements.map((ach) => {
                const StickerIcon = AchievementStickers[ach.id] || AchievementStickers['first-pioneer'];
                return (
                  <div
                    key={ach.id}
                    onClick={() => ach.unlocked && setActiveToast(ach)}
                    className={`p-3.5 rounded-2xl border transition-all duration-200 flex items-start gap-3.5 group relative overflow-hidden ${
                      ach.unlocked
                        ? 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.06] hover:border-white/15 cursor-pointer'
                        : 'bg-white/[0.01] border-white/[0.03] opacity-40 cursor-default'
                    }`}
                  >
                    {/* Hand-drawn sticker icon */}
                    <div
                      className={`w-12 h-12 flex items-center justify-center shrink-0 transition-transform duration-300 ${
                        ach.unlocked
                          ? 'group-hover:scale-105 group-hover:rotate-2'
                          : 'grayscale opacity-0'
                      }`}
                    >
                      <StickerIcon className="w-12 h-12" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4
                          className={`text-xs font-medium tracking-tight truncate ${
                            ach.unlocked
                              ? 'text-white group-hover:text-zinc-100'
                              : 'text-zinc-500'
                          }`}
                        >
                          {ach.title}
                        </h4>
                        {ach.unlocked ? (
                          ach.unlockedAt && (
                            <span className="text-[9px] font-sans uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                              {ach.unlockedAt}
                            </span>
                          )
                        ) : (
                          <span className="text-[9px] font-sans uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-600 shrink-0">
                            Locked
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                        {ach.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 5. Minimal Studio Link ── */}
        <div className="mt-16 pt-8 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
        
        </div>
      </main>
      </>
      )}

      {/* ── 6. Minimalist Footer (Matching Homepage) ── */}
      <footer className="w-full border-t border-white/[0.08] py-8 mt-auto">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400 font-sans">
          <div className="flex items-center gap-3">
            <span>@{profile.username} on OpenLyryc</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-zinc-300 transition-colors">
              Home
            </Link>
            <Link href="/studio" className="hover:text-zinc-300 transition-colors">
              Studio
            </Link>
            <Link href="/status" className="hover:text-zinc-300 transition-colors">
              Status
            </Link>
            <a
              href="https://github.com/aurostron/openlyryc"
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>

      {/* ── Steam-Style Achievement Toast in Bottom-Right Corner ── */}
      <SteamAchievementToast
        achievement={activeToast}
        onDismiss={() => setActiveToast(null)}
      />
    </div>
  );
}
