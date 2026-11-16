'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  ExternalLink,
  Radio,
  Check,
  Link2,
  Trash2,
  Music,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  searchSoundCloudDirect,
  DetectedSoundCloudMatch,
} from '@/lib/soundcloudAutoDetector';
import { parseSoundCloudTrackUrl } from '@/lib/platformLinker';

interface SoundCloudSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSoundCloudUrl?: string;
  defaultQuery?: string;
  onSelectTrack: (url: string, title?: string, author?: string) => void;
  onClearTrack?: () => void;
}

export const SoundCloudSelectModal: React.FC<SoundCloudSelectModalProps> = ({
  isOpen,
  onClose,
  currentSoundCloudUrl,
  defaultQuery = '',
  onSelectTrack,
  onClearTrack,
}) => {
  const [searchQuery, setSearchQuery] = useState(defaultQuery);
  const [directUrl, setDirectUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [candidates, setCandidates] = useState<DetectedSoundCloudMatch[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync initial query when modal opens
  useEffect(() => {
    if (isOpen) {
      const q = defaultQuery.trim();
      setSearchQuery(q);
      setDirectUrl(currentSoundCloudUrl || '');
      setUrlError(null);
      if (q && candidates.length === 0) {
        performSearch(q);
      }
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, defaultQuery, currentSoundCloudUrl]);

  if (!isOpen) return null;

  const performSearch = async (term: string) => {
    const q = term.trim();
    if (!q) return;

    setIsSearching(true);
    setHasSearched(true);
    try {
      const res = await searchSoundCloudDirect(q);
      setCandidates(res.candidates);
    } catch (err) {
      console.warn('[SoundCloudSelectModal] Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleApplyDirectUrl = () => {
    const trimmed = directUrl.trim();
    if (!trimmed) {
      setUrlError('Please enter a SoundCloud track link');
      return;
    }
    const parsed = parseSoundCloudTrackUrl(trimmed);
    if (!parsed) {
      setUrlError('Invalid SoundCloud URL. Expected: soundcloud.com/artist/track');
      return;
    }
    setUrlError(null);
    onSelectTrack(parsed);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 select-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#0d0d11] border border-white/[0.12] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 font-sans text-zinc-100 relative animate-modal-pop-3d max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-white shrink-0">
              <Radio className="w-4 h-4 text-zinc-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                SoundCloud Track Selector
              </h3>
              <p className="text-xs text-zinc-400">
                Pick the exact candidate track or paste a direct SoundCloud link
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Direct URL Input Row */}
        <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-2 shrink-0">
          <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5 uppercase tracking-wider">
            <Link2 className="w-3 h-3 text-zinc-400" />
            Direct Track Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={directUrl}
              onChange={(e) => {
                setDirectUrl(e.target.value);
                if (urlError) setUrlError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyDirectUrl();
                }
              }}
              placeholder="https://soundcloud.com/artist-name/track-name"
              className="flex-1 bg-white/[0.04] border border-white/[0.1] focus:border-white/40 focus:bg-white/[0.07] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 outline-none font-sans transition-all"
            />
            <button
              type="button"
              onClick={handleApplyDirectUrl}
              className="px-3.5 py-1.5 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold cursor-pointer transition-colors shrink-0"
            >
              Apply
            </button>
          </div>
          {urlError && <p className="text-[11px] text-red-400 font-medium">{urlError}</p>}
        </div>

        {/* Search Input Bar */}
        <div className="space-y-1.5 shrink-0">
          <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5 uppercase tracking-wider">
            <Search className="w-3 h-3 text-zinc-400" />
            Search SoundCloud Sounds
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    performSearch(searchQuery);
                  }
                }}
                placeholder="Search by artist, song name, or keywords..."
                className="w-full bg-white/[0.04] border border-white/[0.1] focus:border-white/40 focus:bg-white/[0.07] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-600 outline-none transition-all"
              />
            </div>
            <button
              type="button"
              disabled={isSearching || !searchQuery.trim()}
              onClick={() => performSearch(searchQuery)}
              className="px-4 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-xs font-medium text-white border border-white/[0.1] cursor-pointer transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Searching</span>
                </>
              ) : (
                <span>Search</span>
              )}
            </button>
          </div>
        </div>

        {/* Candidates List Body */}
        <div className="flex-1 min-h-[220px] max-h-[340px] overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
          {isSearching ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-300" />
              <p className="text-xs">Finding best SoundCloud candidates…</p>
            </div>
          ) : candidates.length > 0 ? (
            candidates.map((cand, idx) => {
              const isSelected = currentSoundCloudUrl === cand.url;
              return (
                <div
                  key={cand.url || idx}
                  onClick={() => {
                    onSelectTrack(cand.url, cand.title, cand.author);
                    onClose();
                  }}
                  className={`p-2.5 rounded-xl border transition-all text-xs flex items-center justify-between gap-3 cursor-pointer group ${
                    isSelected
                      ? 'bg-white/[0.12] border-white/30 text-white shadow-md'
                      : 'bg-white/[0.02] hover:bg-white/[0.06] border-white/[0.06] hover:border-white/[0.14] text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-white text-zinc-950 font-bold'
                          : 'bg-white/[0.06] text-zinc-400 group-hover:text-white'
                      }`}
                    >
                      {isSelected ? (
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      ) : (
                        <Music className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium truncate text-white">
                          {cand.title}
                        </p>
                        {cand.score !== undefined && cand.score >= 70 && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                            High Match
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                        {cand.author || 'SoundCloud Artist'}
                        {cand.score !== undefined && (
                          <span className="text-zinc-600 ml-1.5 font-sans">
                            · Score {cand.score}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={cand.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.08] transition-colors"
                      title="Preview on SoundCloud in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectTrack(cand.url, cand.title, cand.author);
                        onClose();
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                        isSelected
                          ? 'bg-emerald-500 text-black'
                          : 'bg-white/[0.08] hover:bg-white text-zinc-200 hover:text-zinc-950'
                      }`}
                    >
                      {isSelected ? 'Active' : 'Select'}
                    </button>
                  </div>
                </div>
              );
            })
          ) : hasSearched ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-xs text-zinc-400">No tracks found for this search.</p>
              <p className="text-[11px] text-zinc-600">
                Try searching for just the song name, or paste a SoundCloud URL above.
              </p>
            </div>
          ) : (
            <div className="py-10 text-center text-zinc-500 text-xs">
              Type keywords above or paste a SoundCloud link.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between shrink-0">
          <div>
            {currentSoundCloudUrl && onClearTrack && (
              <button
                type="button"
                onClick={() => {
                  onClearTrack();
                  onClose();
                }}
                className="text-xs text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Disconnect Track</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
