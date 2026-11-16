'use client';

import React from 'react';
import { X, Info, Music, Disc, Calendar, Clock, Hash, CheckCircle2, Mic2 } from 'lucide-react';
import { OpenLyricsDocument } from '@/types/lyrics';

interface TrackInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  doc: OpenLyricsDocument | null;
  coverArt?: string;
}

function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const TrackInfoModal: React.FC<TrackInfoModalProps> = ({
  isOpen,
  onClose,
  doc,
  coverArt,
}) => {
  if (!isOpen || !doc) return null;

  const meta = doc.metadata;
  const lineCount = doc.lines?.length || 0;
  const wordCount = doc.lines?.reduce((acc, l) => acc + (l.tokens?.length || 0), 0) || 0;
  const hasWordSync = doc.lines?.some((l) => l.tokens && l.tokens.length > 0);

  const infoRows = [
    { label: 'Track Title', value: meta.title, icon: Music },
    { label: 'Artist', value: meta.artist, icon: Mic2 },
    { label: 'Album', value: meta.album || 'Single / Unknown Album', icon: Disc },
    { label: 'Duration', value: formatDuration(meta.duration), icon: Clock },
    { label: 'Synced By', value: meta.syncedBy || 'OpenLyryc Registry', icon: CheckCircle2 },
    { label: 'Timing Precision', value: hasWordSync ? 'Syllable / Word Synchronized' : 'Line Synchronized', icon: Clock },
    { label: 'Lines / Tokens', value: `${lineCount} lines · ${wordCount > 0 ? `${wordCount} words` : 'Line timed'}`, icon: Hash },
    { label: 'ISRC Code', value: meta.isrc || 'Not registered', icon: Hash },
    { label: 'Canonical Key', value: meta.canonicalKey || 'Auto-generated', icon: Hash },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[#0e0e12] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white">
              <Info className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">Track & Lyrics Information</h2>
              <p className="text-[11px] text-zinc-400">Metadata, catalog identifiers, and sync providence</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Cover & Hero */}
          <div className="flex items-center gap-4 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            {coverArt ? (
              <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-white/10">
                <img src={coverArt} alt={meta.title} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-500">
                <Disc className="w-8 h-8" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">{meta.title}</h3>
              <p className="text-xs text-zinc-400 truncate mt-0.5">{meta.artist}</p>
              <div className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-md bg-white/[0.06] text-[10px] text-zinc-300 font-sans">
                <span>{hasWordSync ? 'Syllable Sync' : 'Line Sync'}</span>
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-white/[0.01]">
            {infoRows.map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.label} className="flex items-center justify-between px-4 py-2.5 text-xs">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Icon className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{row.label}</span>
                  </div>
                  <span className="text-zinc-200 font-medium truncate max-w-[220px] text-right font-sans">
                    {row.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
