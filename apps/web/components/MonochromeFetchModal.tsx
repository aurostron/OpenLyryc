'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TrackSearchResult } from '@/types/plugins';
import {
  searchTracksWithPlugins,
  resolveStreamWithPlugins,
  getInstalledPlugins,
} from '@/lib/plugins/pluginManager';

export interface FetchedTrackMeta {
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  coverArt?: string;
}

interface MonochromeFetchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  onLoadFile: (file: File, meta: FetchedTrackMeta) => void;
}

const QUALITY_OPTIONS = [
  { label: 'Low (fast preview)', value: 'LOW' },
  { label: 'High (fast)', value: 'HIGH' },
  { label: 'Lossless 16-bit FLAC', value: 'LOSSLESS' },
  { label: 'Hi-Res 24-bit FLAC (huge)', value: 'HI_RES_LOSSLESS' },
];

function extForMime(mime: string): string {
  const m = (mime || '').toLowerCase();
  if (m.includes('flac')) return 'flac';
  if (m.includes('mp4') || m.includes('m4a')) return 'm4a';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('wav')) return 'wav';
  if (m.includes('ogg') || m.includes('opus')) return 'opus';
  return 'audio';
}

function formatDuration(sec?: number): string {
  if (typeof sec !== 'number' || !Number.isFinite(sec) || sec <= 0) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const MonochromeFetchModal: React.FC<MonochromeFetchModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
  onLoadFile,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<TrackSearchResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Seed default quality from installed bridge plugin settings (lazy init, no reset effect)
  const [quality, setQuality] = useState(() => {
    const bridge = getInstalledPlugins().find((p) => p.manifest.id === 'org.openlyryc.monochrome-bridge');
    const q = bridge?.userSettings?.quality;
    return typeof q === 'string' && QUALITY_OPTIONS.some((o) => o.value === q) ? q : 'HIGH';
  });
  const [isSearching, setIsSearching] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadNote, setDownloadNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bridgeDown, setBridgeDown] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Abort in-flight search on unmount (cleanup only — parent mounts modal per open)
  useEffect(() => () => abortRef.current?.abort(), []);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDownloading) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDownloading, onClose]);

  if (!isOpen) return null;

  const handleSearch = async () => {
    const q = query.trim();
    if (q.length < 2 || isSearching) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsSearching(true);
    setError(null);
    setBridgeDown(false);
    setResults([]);
    setSelectedId(null);
    try {
      const { results: tracks } = await searchTracksWithPlugins(q, controller.signal);
      if (controller.signal.aborted) return;
      setResults(tracks);
      if (tracks.length === 0) {
        setBridgeDown(true);
        setError('No results. Is the bridge daemon running? (node tools/monochrome-bridge/server.mjs)');
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      if (controller.signal.aborted) return;
      setBridgeDown(true);
      setError(e instanceof Error ? e.message : 'Search failed. Is the bridge daemon running on localhost:8888?');
    } finally {
      if (!controller.signal.aborted) setIsSearching(false);
    }
  };

  const handleDownloadAndLoad = async () => {
    const track = results.find((t) => t.id === selectedId);
    if (!track || isDownloading) return;
    setIsDownloading(true);
    setError(null);
    setDownloadNote(
      quality === 'HI_RES_LOSSLESS'
        ? 'Downloading Hi-Res FLAC (30–80 MB) — this can take a while…'
        : 'Downloading full track…'
    );
    try {
      const { result } = await resolveStreamWithPlugins(
        {
          sourceId: track.id,
          title: track.title,
          artist: track.artist,
          album: track.album,
          duration: track.duration,
          query: `${track.artist} ${track.title}`,
        },
        { quality }
      );
      if (!result?.streamUrl) {
        throw new Error('Bridge could not resolve a stream URL for this track. Try another quality.');
      }
      const res = await fetch(result.streamUrl);
      if (!res.ok) {
        throw new Error(`Download failed: HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const ext = extForMime(blob.type || result.mimeType || '');
      const safeName = `${track.artist} - ${track.title}`.replace(/[\\/:*?"<>|]+/g, '').slice(0, 120);
      const file = new File([blob], `${safeName}.${ext}`, { type: blob.type || 'audio/*' });
      onLoadFile(file, {
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        coverArt: track.coverArt,
      });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Download failed.');
    } finally {
      setIsDownloading(false);
      setDownloadNote(null);
    }
  };

  const selectedTrack = results.find((t) => t.id === selectedId) || null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-xl bg-[#0e0e12]/95 border border-white/[0.12] rounded-3xl shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-hidden text-zinc-100 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-white shadow-inner">
              <span className="material-symbols-outlined text-xl">library_music</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-sans">Fetch Audio</h2>
              <p className="text-xs text-zinc-400 font-sans">
                Search Monochrome catalog → download → load into Studio
              </p>
            </div>
          </div>
          <button
            onClick={() => !isDownloading && onClose()}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            title="Close"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Search bar */}
        <div className="flex gap-2 pt-4 shrink-0">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Artist — Title (e.g. Kavinsky Nightcall)"
            className="flex-1 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white font-sans focus:border-white/40 outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || query.trim().length < 2}
            className="px-4 py-2 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          >
            {isSearching ? 'Searching…' : 'Search'}
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-4 space-y-2 pr-1 min-h-[120px]">
          {results.map((t) => {
            const isSel = t.id === selectedId;
            return (
              <button
                key={`${t.addonId}:${t.id}`}
                onClick={() => setSelectedId(t.id)}
                className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                  isSel
                    ? 'bg-white/[0.08] border-white/40'
                    : 'bg-white/[0.02] border-white/[0.08] hover:border-white/20'
                }`}
              >
                {t.coverArt ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.coverArt} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0 bg-white/[0.06]" />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-zinc-500">music_note</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate font-sans">{t.title}</div>
                  <div className="text-[11px] text-zinc-400 truncate font-sans">
                    {t.artist}{t.album ? ` — ${t.album}` : ''}
                  </div>
                </div>
                <div className="text-[11px] text-zinc-500 font-sans shrink-0">{formatDuration(t.duration)}</div>
              </button>
            );
          })}
          {!isSearching && results.length === 0 && !error && (
            <div className="py-10 text-center text-xs text-zinc-500 font-sans">
              Search the catalog to fetch a full track for syncing.
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-sans shrink-0 mb-3">
            {error}
            {bridgeDown && (
              <div className="mt-1.5 font-sans text-[11px] text-red-200/80">
                node tools/monochrome-bridge/server.mjs
              </div>
            )}
          </div>
        )}
        {downloadNote && (
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-zinc-300 text-xs font-sans shrink-0 mb-3">
            {downloadNote}
          </div>
        )}

        {/* Footer: quality + download */}
        <div className="flex items-center gap-2 pt-3 border-t border-white/[0.08] shrink-0">
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white font-sans outline-none cursor-pointer"
            title="Audio quality for this download"
          >
            {QUALITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-zinc-900">
                {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleDownloadAndLoad}
            disabled={!selectedTrack || isDownloading}
            className="flex-1 py-2 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            <span>{isDownloading ? 'Downloading…' : 'Download & Load into Studio'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
