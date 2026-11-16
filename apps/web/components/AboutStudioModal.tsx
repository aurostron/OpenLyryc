'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, ArrowUpRight, History, Sparkles } from 'lucide-react';
import { OpenLyrycLogo } from '@/components/OpenLyrycLogo';

export interface ChangelogItem {
  hash: string;
  subject: string;
  tag: 'New' | 'Improvement' | 'Update' | 'Fix';
  date: string;
}

// Embedded recent commits as fallback for instant paint without waiting for network
const FALLBACK_CHANGELOG: ChangelogItem[] = [
  {
    hash: '55ff84c',
    subject: 'Drag-and-drop video backdrops, Dexie blob persistence, and flicker-free drag overlay',
    tag: 'New',
    date: 'Oct 15, 2026',
  },
  {
    hash: '7bb566c',
    subject: 'Native stream mode, remove embed icon, add standalone bridge script with ASCII logo',
    tag: 'New',
    date: 'Oct 14, 2026',
  },
  {
    hash: 'db050f2',
    subject: 'Add companion fetch buttons to YouTube embed, waveform player, and dock',
    tag: 'New',
    date: 'Oct 14, 2026',
  },
];

interface AboutStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  enableTutorial?: boolean;
}

export const AboutStudioModal: React.FC<AboutStudioModalProps> = ({
  isOpen,
  onClose,
  enableTutorial = false,
}) => {
  const [changelog, setChangelog] = useState<ChangelogItem[]>(FALLBACK_CHANGELOG);

  useEffect(() => {
    if (!isOpen) return;

    // Fetch fresh build-time changelog generated from git commits
    fetch('/changelog.json')
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data: ChangelogItem[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setChangelog(data);
        }
      })
      .catch(() => {
        // Fallback array remains intact
      });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center glass-modal-3d-backdrop p-4 select-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg glass-modal-3d rounded-2xl p-6 shadow-2xl space-y-5 font-sans text-zinc-100 relative animate-modal-pop-3d border border-white/10"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <OpenLyrycLogo className="h-5 w-auto text-white select-none" />
            <span className="px-2 py-0.5 rounded-md text-[10px] font-sans font-semibold tracking-wider bg-white/[0.06] text-zinc-300 border border-white/[0.1]">
              We&apos;re in Beta!
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* About Studio Summary */}
        <div className="space-y-3">
          <p className="text-sm text-zinc-300 leading-relaxed bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5">
            The Swiss army knife for all you have to do with lyrics.
          </p>

          {enableTutorial && (
            <button
              type="button"
              onClick={() => {
                onClose();
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('openlyryc:start-tutorial'));
                }
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Launch Interactive Tutorial (2 mins)</span>
            </button>
          )}
        </div>

        {/* What's New Section */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 uppercase tracking-wider font-sans">
              <History className="w-3.5 h-3.5 text-zinc-400" />
              <span>What&apos;s New</span>
            </div>
            <span className="text-[10px] font-sans text-zinc-500">
              Latest first
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {changelog.map((item, idx) => (
              <div
                key={`${item.hash}-${idx}`}
                className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.06] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-sans font-medium px-1.5 py-0.5 rounded bg-white/[0.08] text-zinc-300 border border-white/[0.08]">
                    {item.tag}
                  </span>
                  <span className="text-[10px] font-sans text-zinc-500">
                    {item.hash}
                  </span>
                  <span className="text-[10px] font-sans text-zinc-400 ml-auto">
                    {item.date}
                  </span>
                </div>
                <p className="text-xs text-zinc-200 mt-1.5 leading-snug">
                  {item.subject}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <Link
            href="/"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Homepage</span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-md shadow-white/5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
