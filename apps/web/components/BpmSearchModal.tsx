'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Search,
  Activity,
  Music,
  RotateCcw,
  Check,
  Link as LinkIcon,
  HelpCircle,
} from 'lucide-react';

export interface TempoTrackItem {
  title: string;
  artist: string;
  bpm: number | null;
  key: string | null;
  duration: string | null;
  coverUrl: string | null;
  url: string;
}

interface BpmSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBpm?: number | null;
  trackTitle?: string;
  artistName?: string;
  onSelectBpm: (bpm: number, details?: { title?: string; artist?: string; key?: string | null }) => void;
  onClearBpm?: () => void;
}

const COMMON_PRESETS = [75, 90, 100, 110, 120, 128, 130, 140, 150, 160];

export const BpmSearchModal: React.FC<BpmSearchModalProps> = ({
  isOpen,
  onClose,
  currentBpm,
  trackTitle = '',
  artistName = '',
  onSelectBpm,
  onClearBpm,
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'tap' | 'url'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<TempoTrackItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Manual input state
  const [manualBpm, setManualBpm] = useState<number>(currentBpm || 120);

  // Tap tempo state
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [calculatedBpm, setCalculatedBpm] = useState<number | null>(null);
  const [tapCount, setTapCount] = useState(0);
  const [isTappingAnim, setIsTappingAnim] = useState(false);

  // Direct URL state
  const [directUrl, setDirectUrl] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [urlResult, setUrlResult] = useState<TempoTrackItem | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Clean initial query (Artist Title format)
  const computeInitialQuery = useCallback(() => {
    const rawT = (trackTitle || '').trim();
    const rawA = (artistName || '').trim();

    // Clean out parentheticals and noise
    const cleanT = rawT
      .replace(/[\u2010-\u2015\u2212\-–—_]/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\b(feat\.?|ft\.?)\b.*$/i, '')
      .replace(/\b(official|music|audio|video|lyrics?|remaster(?:ed)?|hd|4k)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const cleanA = rawA
      .replace(/[\u2010-\u2015\u2212\-–—_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Prevent duplicate tokens
    if (cleanA && cleanT.toLowerCase().includes(cleanA.toLowerCase())) {
      return cleanT;
    }
    if (cleanA && cleanT) {
      return `${cleanA} ${cleanT}`.trim();
    }
    return cleanT || cleanA || '';
  }, [trackTitle, artistName]);

  // Execute tempo search
  const performSearch = useCallback(async (queryToSearch: string) => {
    const q = queryToSearch.trim();
    if (!q) return;

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const endpoint = `https://openlyryc-core.aurostronyee1.workers.dev/api/v1/bpm?q=${encodeURIComponent(q)}`;
      const res = await fetch(endpoint);
      if (!res.ok) {
        throw new Error(`Search failed with status ${res.status}`);
      }
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.results)) {
        setResults(data.results);
      } else {
        setResults([]);
        if (data.message) setSearchError(data.message);
      }
    } catch (err: any) {
      setSearchError(err?.message || 'Network error querying tempo database');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Sync initial query when modal opens
  useEffect(() => {
    if (isOpen) {
      const initial = computeInitialQuery();
      setSearchQuery(initial);
      setResults([]);
      setHasSearched(false);
      setSearchError(null);
      setManualBpm(currentBpm || 120);
      setTapTimes([]);
      setCalculatedBpm(null);
      setTapCount(0);
      setUrlResult(null);
      setUrlError(null);

      if (initial) {
        performSearch(initial);
      }

      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 120);
    }
  }, [isOpen, computeInitialQuery, performSearch, currentBpm]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (activeTab === 'tap' && e.code === 'Space') {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab, onClose]);

  // Tap tempo handler
  const handleTap = () => {
    const now = Date.now();
    setIsTappingAnim(true);
    setTimeout(() => setIsTappingAnim(false), 90);

    setTapTimes((prev) => {
      const filtered = prev.length > 0 && now - prev[prev.length - 1] > 3000 ? [now] : [...prev, now];
      const slice = filtered.slice(-8);

      if (slice.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < slice.length; i++) {
          intervals.push(slice[i] - slice[i - 1]);
        }
        const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        if (avgMs > 100 && avgMs < 3000) {
          const bpm = Math.round(60000 / avgMs);
          setCalculatedBpm(bpm);
          setManualBpm(bpm);
        }
      }
      setTapCount((c) => c + 1);
      return slice;
    });
  };

  // Direct URL fetch
  const handleFetchDirectUrl = async () => {
    const trimmed = directUrl.trim();
    if (!trimmed || (!trimmed.startsWith('http://') && !trimmed.startsWith('https://'))) {
      setUrlError('Please enter a valid web URL starting with https://');
      return;
    }
    setIsFetchingUrl(true);
    setUrlError(null);
    try {
      const endpoint = `https://openlyryc-core.aurostronyee1.workers.dev/api/v1/bpm/song?url=${encodeURIComponent(trimmed)}`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        setUrlResult(data.data);
      } else {
        throw new Error(data.message || 'No track details found at URL');
      }
    } catch (err: any) {
      setUrlError(err.message || 'Failed to fetch track details');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 select-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#121216] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] font-sans text-zinc-100 relative animate-modal-pop-3d"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">Track Tempo</h3>
                {currentBpm && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-bold bg-white/10 text-white border border-white/20">
                    Active: {currentBpm} BPM
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Set track tempo for rhythm-synchronized background transitions
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl my-3 shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'search'
                ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tap')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'tap'
                ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Tap & Manual</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'url'
                ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Link</span>
          </button>
        </div>

        {/* TAB 1: Search */}
        {activeTab === 'search' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-3">
            {/* Search Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                performSearch(searchQuery);
              }}
              className="flex items-center gap-2 shrink-0"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by artist or track name..."
                  className="w-full pl-9 pr-8 py-2 bg-white/[0.04] border border-white/[0.1] focus:border-white/40 rounded-xl text-xs text-white placeholder-zinc-500 outline-none transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="px-4 py-2 bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-40 text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0 shadow-md active:scale-[0.98] flex items-center gap-1.5"
              >
                {isSearching ? (
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                ) : (
                  <span>Search</span>
                )}
              </button>
            </form>

            {/* Quick Suggestions */}
            {(artistName || trackTitle) && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-[10.5px] shrink-0">
                <span className="text-zinc-500 font-medium shrink-0">Suggestions:</span>
                {artistName && trackTitle && (
                  <button
                    type="button"
                    onClick={() => {
                      const q = `${artistName} ${trackTitle}`.trim();
                      setSearchQuery(q);
                      performSearch(q);
                    }}
                    className="px-2 py-0.5 rounded-md bg-white/[0.05] hover:bg-white/10 text-zinc-300 transition-colors whitespace-nowrap cursor-pointer shrink-0"
                  >
                    {artistName} {trackTitle}
                  </button>
                )}
                {trackTitle && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery(trackTitle);
                      performSearch(trackTitle);
                    }}
                    className="px-2 py-0.5 rounded-md bg-white/[0.05] hover:bg-white/10 text-zinc-300 transition-colors whitespace-nowrap cursor-pointer shrink-0"
                  >
                    {trackTitle}
                  </button>
                )}
                {artistName && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery(artistName);
                      performSearch(artistName);
                    }}
                    className="px-2 py-0.5 rounded-md bg-white/[0.05] hover:bg-white/10 text-zinc-300 transition-colors whitespace-nowrap cursor-pointer shrink-0"
                  >
                    {artistName}
                  </button>
                )}
              </div>
            )}

            {/* Search Results List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[220px]">
              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400">
                  <span className="material-symbols-outlined text-3xl animate-spin text-zinc-400 mb-2">
                    progress_activity
                  </span>
                  <p className="text-xs font-medium">Searching track tempo...</p>
                </div>
              ) : searchError ? (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center space-y-2">
                  <p className="text-xs text-red-300 font-medium">{searchError}</p>
                  <button
                    type="button"
                    onClick={() => performSearch(searchQuery)}
                    className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white cursor-pointer"
                  >
                    Try Again
                  </button>
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-sans uppercase tracking-wider text-zinc-500 px-1">
                    Found {results.length} {results.length === 1 ? 'match' : 'matches'}:
                  </div>
                  {results.map((item, idx) => {
                    const isSelected = item.bpm && currentBpm === item.bpm;
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-white/[0.08] border-white/30'
                            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/15'
                        }`}
                      >
                        {/* Cover Art / Icon */}
                        <div className="w-11 h-11 rounded-lg bg-zinc-800 shrink-0 overflow-hidden flex items-center justify-center border border-white/10 relative">
                          {item.coverUrl ? (
                            <img
                              src={item.coverUrl}
                              alt={item.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <Music className="w-5 h-5 text-zinc-500" />
                          )}
                        </div>

                        {/* Title & Artist */}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                            <span className="truncate">{item.title}</span>
                            {isSelected && (
                              <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-400 truncate mt-0.5">{item.artist}</div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500 font-sans">
                            {item.key && <span>Key: {item.key}</span>}
                            {item.duration && <span>· {item.duration}</span>}
                          </div>
                        </div>

                        {/* BPM & Action */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div className="text-sm font-extrabold font-sans text-white">
                              {item.bpm ? `${item.bpm}` : '—'}
                              <span className="text-[10px] font-sans font-medium text-zinc-400 ml-1">BPM</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (item.bpm) {
                                onSelectBpm(item.bpm, {
                                  title: item.title,
                                  artist: item.artist,
                                  key: item.key,
                                });
                                onClose();
                              }
                            }}
                            disabled={!item.bpm}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-white text-zinc-950 font-bold shadow-sm'
                                : 'bg-white/10 hover:bg-white text-white hover:text-zinc-950 active:scale-[0.98]'
                            }`}
                          >
                            {isSelected ? 'Applied' : 'Use BPM'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : hasSearched ? (
                <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                  <HelpCircle className="w-8 h-8 text-zinc-600 mb-1" />
                  <p className="text-xs text-zinc-400 font-medium">No results found for &ldquo;{searchQuery}&rdquo;</p>
                  <p className="text-[11px] text-zinc-500 max-w-sm">
                    Try searching with just the primary track name or artist, or use the <strong>Tap & Manual</strong> tab.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500 space-y-2">
                  <Search className="w-8 h-8 text-zinc-600" />
                  <p className="text-xs font-medium text-zinc-400">Search any track to look up its tempo</p>
                  <p className="text-[11px] text-zinc-500 max-w-xs">
                    Select a match to apply its tempo to your track.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Tap Tempo & Manual BPM */}
        {activeTab === 'tap' && (
          <div className="flex-1 overflow-y-auto space-y-4 py-1 custom-scrollbar">
            {/* Tap Tempo Interactive Area */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-center space-y-3">
              <div className="text-xs font-semibold text-zinc-300">Tap Tempo</div>
              <p className="text-[11px] text-zinc-500">
                Click the button or hit <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 font-sans text-[10px]">SPACE</kbd> rhythmically along with the track
              </p>

              <button
                type="button"
                onClick={handleTap}
                className={`w-full py-8 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center select-none active:scale-[0.99] ${
                  isTappingAnim
                    ? 'bg-white/15 border-white/50 shadow-lg'
                    : 'bg-white/[0.04] hover:bg-white/[0.07] border-white/15'
                }`}
              >
                <div className="text-4xl sm:text-5xl font-black font-sans tracking-tight text-white">
                  {calculatedBpm ? `${calculatedBpm}` : 'TAP'}
                  {calculatedBpm && <span className="text-base font-normal text-zinc-400 ml-2 font-sans">BPM</span>}
                </div>
                <div className="text-[11px] text-zinc-400 mt-2 font-medium">
                  {tapCount === 0
                    ? 'Click or tap SPACE on each beat'
                    : `Recorded ${tapCount} ${tapCount === 1 ? 'beat' : 'beats'} · Keep tapping to refine`}
                </div>
              </button>

              {calculatedBpm && (
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectBpm(calculatedBpm);
                      onClose();
                    }}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs transition-all shadow-md cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply {calculatedBpm} BPM</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTapTimes([]);
                      setCalculatedBpm(null);
                      setTapCount(0);
                    }}
                    className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
                    title="Reset tap counter"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Manual Numeric Entry */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-3">
              <div className="text-xs font-semibold text-zinc-300">Manual Entry</div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setManualBpm((v) => Math.max(40, v - 5))}
                  className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/10 text-xs font-sans text-zinc-300 cursor-pointer"
                >
                  -5
                </button>
                <button
                  type="button"
                  onClick={() => setManualBpm((v) => Math.max(40, v - 1))}
                  className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/10 text-xs font-sans text-zinc-300 cursor-pointer"
                >
                  -1
                </button>
                <input
                  type="number"
                  min="40"
                  max="280"
                  value={manualBpm}
                  onChange={(e) => setManualBpm(parseInt(e.target.value, 10) || 120)}
                  className="flex-1 py-1.5 px-3 bg-white/[0.05] border border-white/10 rounded-lg text-center font-sans font-bold text-sm text-white outline-none focus:border-white/40"
                />
                <button
                  type="button"
                  onClick={() => setManualBpm((v) => Math.min(280, v + 1))}
                  className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/10 text-xs font-sans text-zinc-300 cursor-pointer"
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => setManualBpm((v) => Math.min(280, v + 5))}
                  className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/10 text-xs font-sans text-zinc-300 cursor-pointer"
                >
                  +5
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectBpm(manualBpm);
                    onClose();
                  }}
                  className="px-4 py-1.5 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 font-semibold text-xs cursor-pointer shadow-sm transition-all active:scale-[0.98]"
                >
                  Set
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10.5px] text-zinc-500 mr-1 font-medium">Presets:</span>
                {COMMON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setManualBpm(preset)}
                    className={`px-2 py-0.5 rounded text-[10.5px] font-sans transition-colors cursor-pointer ${
                      manualBpm === preset
                        ? 'bg-white text-zinc-950 font-bold shadow-sm'
                        : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Track Link */}
        {activeTab === 'url' && (
          <div className="flex-1 overflow-y-auto space-y-3 py-1 custom-scrollbar">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Track Link</label>
              <p className="text-[11px] text-zinc-500">
                Paste a web link to inspect track tempo
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="url"
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 py-2 px-3 bg-white/[0.04] border border-white/10 focus:border-white/40 rounded-xl text-xs text-white placeholder-zinc-500 outline-none"
                />
                <button
                  type="button"
                  onClick={handleFetchDirectUrl}
                  disabled={isFetchingUrl || !directUrl.trim()}
                  className="px-4 py-2 bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-40 text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0 active:scale-[0.98]"
                >
                  {isFetchingUrl ? 'Fetching...' : 'Fetch'}
                </button>
              </div>
            </div>

            {urlError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                {urlError}
              </div>
            )}

            {urlResult && (
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">{urlResult.title}</h4>
                    <p className="text-[11px] text-zinc-400">{urlResult.artist}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-extrabold font-sans text-white">
                      {urlResult.bpm || '—'}
                    </span>
                    <span className="text-xs text-zinc-400 ml-1">BPM</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (urlResult.bpm) {
                      onSelectBpm(urlResult.bpm, {
                        title: urlResult.title,
                        artist: urlResult.artist,
                        key: urlResult.key,
                      });
                      onClose();
                    }
                  }}
                  className="w-full py-2 bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md active:scale-[0.98]"
                >
                  Apply {urlResult.bpm} BPM
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between shrink-0 text-xs text-zinc-400">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Activity className="w-3.5 h-3.5 text-zinc-400" />
            <span>Used for 4/4, 2/4, and 1/4 Colors rhythm transitions</span>
          </div>

          {currentBpm && onClearBpm && (
            <button
              type="button"
              onClick={() => {
                onClearBpm();
                onClose();
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              Clear Custom BPM
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
