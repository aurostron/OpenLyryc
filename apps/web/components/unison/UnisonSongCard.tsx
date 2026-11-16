'use client';

import React, { useState } from 'react';
import { Play, PenLine, Trash2, ExternalLink } from 'lucide-react';
import { CouncilSeal } from './CouncilSeal';
import { useSongArtwork } from '@/lib/unison/artworkService';
import type { UnisonFeedEntry, UnisonUserSubmission, UnisonMostWantedSong } from '@/lib/unison/types';

interface UnisonSongCardProps {
  entry: UnisonFeedEntry | UnisonUserSubmission;
  variant?: 'grid' | 'shelf';
  onPlaySong?: (song: {
    videoId: string;
    song: string;
    artist: string;
    id?: number;
    thumbnailUrl?: string | null;
    originRect?: { top: number; left: number; width: number; height: number } | null;
  }) => void;
  onEditInStudio?: (song: { videoId: string; song: string; artist: string; id?: number; thumbnailUrl?: string | null }) => void;
  onDelete?: (song: { id: number; song: string }) => void;
  onSelectCurator?: (curator: { keyId: string; displayName?: string }) => void;
  onHoverArtwork?: (artworkUrl: string | null) => void;
}

function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return '';
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, now - timestamp);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  const months = Math.floor(diff / 2592000);
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

export const UnisonSongCard: React.FC<UnisonSongCardProps> = ({
  entry,
  variant = 'grid',
  onPlaySong,
  onEditInStudio,
  onDelete,
  onSelectCurator,
  onHoverArtwork,
}) => {
  const imgContainerRef = React.useRef<HTMLDivElement>(null);
  const isShelf = variant === 'shelf';

  const feedEntry = entry as UnisonFeedEntry;
  const isCouncilSealed = feedEntry.marks?.some((m) => m.type === 'seal');
  const submitter = feedEntry.submitter;

  // True 1:1 high-res uncropped square artwork from Unison / YouTube Music
  const artData = useSongArtwork(entry.videoId);

  // Robust multi-tier candidate cascade:
  // 1. Unison square artwork (Google usercontent)
  // 2. Unison CDN fallback (cdn.betterlyrics.org)
  // 3. YouTube HQ default (i.ytimg.com)
  // 4. YouTube MQ default (i.ytimg.com)
  const candidateUrls = React.useMemo(() => {
    const list: string[] = [];
    if (artData?.artworkUrl) list.push(artData.artworkUrl);
    if (artData?.fallbackUrl) list.push(artData.fallbackUrl);
    if (entry.videoId) {
      list.push(`https://i.ytimg.com/vi/${entry.videoId}/hqdefault.jpg`);
      list.push(`https://i.ytimg.com/vi/${entry.videoId}/mqdefault.jpg`);
    }
    return list;
  }, [artData, entry.videoId]);

  const [candidateIndex, setCandidateIndex] = React.useState(0);

  // When candidate list upgrades (e.g. square art resolves from API), reset index to top candidate
  React.useEffect(() => {
    setCandidateIndex(0);
  }, [candidateUrls]);

  const currentDisplayImage = candidateUrls[candidateIndex] || null;
  const isAllFailed = candidateUrls.length === 0 || candidateIndex >= candidateUrls.length;
  const isFallback = Boolean(
    currentDisplayImage && currentDisplayImage.includes('i.ytimg.com')
  );

  const handleImageError = () => {
    setCandidateIndex((prev) => prev + 1);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = imgContainerRef.current?.getBoundingClientRect();
    const originRect = rect
      ? {
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }
      : null;

    if (onPlaySong) {
      onPlaySong({
        videoId: entry.videoId,
        song: entry.song,
        artist: entry.artist,
        id: entry.id,
        thumbnailUrl: currentDisplayImage || candidateUrls[0] || null,
        originRect,
      });
    } else {
      // Default open in OpenLyryc /lyrics player
      const params = new URLSearchParams({
        yt: entry.videoId,
        unison: entry.videoId,
        variant: String(entry.id),
        title: entry.song,
        artist: entry.artist,
        cover: currentDisplayImage || candidateUrls[0] || '',
      });
      window.open(`/lyrics?${params.toString()}`, '_blank');
    }
  };

  const handleStudioClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onEditInStudio?.({
      videoId: entry.videoId,
      song: entry.song,
      artist: entry.artist,
      id: entry.id,
      thumbnailUrl: currentDisplayImage || candidateUrls[0] || null,
    });
  };

  const handleCuratorClick = (e: React.MouseEvent) => {
    if (!submitter?.keyId) return;
    e.stopPropagation();
    e.preventDefault();
    onSelectCurator?.({
      keyId: submitter.keyId,
      displayName: submitter.displayName,
    });
  };

  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={() => onHoverArtwork?.(currentDisplayImage || candidateUrls[0] || null)}
      onMouseLeave={() => onHoverArtwork?.(null)}
      className={`group relative flex flex-col rounded-2xl cursor-pointer select-none transition-all duration-200 hover:-translate-y-1 active:scale-[0.98] ${
        isShelf ? 'w-[152px] sm:w-[168px] shrink-0' : 'w-full'
      }`}
    >
      {/* ── 1. High-Resolution Album Artwork Container ── */}
      <div
        ref={imgContainerRef}
        className="relative aspect-square w-full rounded-2xl overflow-hidden bg-white/[0.04] border border-white/[0.08] shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
      >
        {currentDisplayImage && !isAllFailed ? (
          <img
            key={currentDisplayImage}
            src={currentDisplayImage}
            alt={`${entry.song} by ${entry.artist}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onError={handleImageError}
            className={`w-full h-full transition-transform duration-300 group-hover:scale-105 ${
              isFallback ? 'object-cover scale-115' : 'object-cover scale-100'
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#15141b] text-white/20">
            <span className="text-3xl font-light">♪</span>
          </div>
        )}

        {/* Ambient Dark Gradient Veil */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-40 group-hover:opacity-20 transition-opacity" />

        {/* Council Seal Stamp in Bottom-Right Corner */}
        {isCouncilSealed && (
          <div className="absolute bottom-2 right-2 z-10">
            <CouncilSeal size={isShelf ? 24 : 28} />
          </div>
        )}

        {/* Play Button Overlay on Hover */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
          <div className="w-12 h-12 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-2xl transition-transform duration-200 group-hover:scale-110 active:scale-95">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>

        {/* Quick 'Edit in Studio' action icon on top-right */}
        {onEditInStudio && (
          <button
            type="button"
            onClick={handleStudioClick}
            title="Edit lyrics in Studio"
            className="absolute top-2 right-2 p-2 rounded-xl bg-black/60 hover:bg-white hover:text-zinc-950 text-white/80 border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-200 z-30 cursor-pointer shadow-lg hover:scale-110"
          >
            <PenLine className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Delete / Hide submission action icon on top-left (for curator self-submissions) */}
        {onDelete && entry.id && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDelete({ id: entry.id!, song: entry.song });
            }}
            title="Delete submission from Unison"
            className="absolute top-2 left-2 p-2 rounded-xl bg-black/60 hover:bg-rose-500 hover:text-white text-rose-400 border border-rose-500/20 opacity-0 group-hover:opacity-100 transition-all duration-200 z-30 cursor-pointer shadow-lg hover:scale-110"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── 2. Track Typography & Submitter Metadata ── */}
      <div className="mt-3 flex flex-col min-w-0">
        <h4
          title={entry.song}
          className="text-sm font-medium text-zinc-100 tracking-tight truncate leading-snug group-hover:text-white transition-colors"
        >
          {entry.song}
        </h4>
        <p title={entry.artist} className="text-xs text-zinc-400 truncate mt-0.5 font-normal">
          {entry.artist}
        </p>

        {/* Submitter & Tag Line */}
        <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-zinc-500 font-normal">
          {submitter ? (
            <div
              onClick={handleCuratorClick}
              className="flex items-center gap-1.5 min-w-0 truncate hover:text-zinc-200 transition-colors"
              title={`Curated by ${submitter.displayName || 'Unison curator'}`}
            >
              <div className="w-4 h-4 rounded-full overflow-hidden bg-white/10 shrink-0 border border-white/10">
                {submitter.avatarUrl ? (
                  <img src={submitter.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[8px] text-zinc-400 font-medium">
                    {(submitter.displayName || 'U').slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="truncate text-zinc-400 hover:underline">
                {submitter.displayName || 'Curator'}
              </span>
              <span className="text-zinc-600 shrink-0">·</span>
              <span className="shrink-0 text-zinc-500">{formatTimeAgo(entry.createdAt)}</span>
            </div>
          ) : (
            <span className="truncate text-zinc-500">{formatTimeAgo(entry.createdAt)}</span>
          )}

          {/* Sync Type Badge */}
          {entry.syncType === 'richsync' ? (
            <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-medium tracking-wide bg-[#ffc83d]/15 text-[#ffc83d] border border-[#ffc83d]/30">
              Richsync
            </span>
          ) : entry.syncType === 'linesync' ? (
            <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-medium tracking-wide bg-white/10 text-zinc-300 border border-white/15">
              Linesync
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
