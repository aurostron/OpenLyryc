'use client';

import React from 'react';
import { GuitarChordDiagram } from './GuitarChordDiagram';
import { ChevronRight, ArrowRight } from 'lucide-react';

interface HorizontalChordCarouselProps {
  currentChord: string;
  nextChord: string | null;
  prevChord: string | null;
}

export const HorizontalChordCarousel: React.FC<HorizontalChordCarouselProps> = ({
  currentChord,
  nextChord,
  prevChord,
}) => {
  return (
    <div className="w-full flex items-center justify-center gap-6 sm:gap-12 py-4 select-none overflow-hidden">
      {/* ── 1. PREVIOUS CHORD (Sliding Off Left) ─────────────────────────── */}
      <div className="hidden sm:flex flex-col items-center opacity-25 scale-75 blur-[0.5px] transition-all duration-500 transform-gpu shrink-0">
        <span className="text-[9px] font-sans uppercase tracking-widest text-zinc-500 mb-1">
          Prev
        </span>
        {prevChord ? (
          <GuitarChordDiagram chord={prevChord} size="md" showTitle={true} theme="monochrome" />
        ) : (
          <div className="w-20 h-28" />
        )}
      </div>

      {/* ── 2. ACTIVE CURRENT CHORD (Center Focus) ───────────────────────── */}
      <div className="flex flex-col items-center scale-100 opacity-100 transition-all duration-400 transform-gpu shrink-0">
        <span className="text-[10px] font-sans uppercase tracking-widest text-white mb-2 font-bold flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/[0.08] border border-white/10">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          <span>Sync Chord</span>
        </span>
        <div className="p-4 rounded-3xl bg-white/[0.03] border border-white/10 shadow-[0_0_40px_rgba(255,255,255,0.08)] backdrop-blur-md">
          <GuitarChordDiagram chord={currentChord} size="xl" showTitle={true} theme="monochrome" />
        </div>
      </div>

      {/* ── 3. UPCOMING NEXT CHORD (Previewing Right, Sliding In) ────────── */}
      {nextChord ? (
        <div className="flex flex-col items-center opacity-60 scale-90 transition-all duration-400 transform-gpu shrink-0 hover:opacity-90 cursor-pointer">
          <span className="text-[10px] font-sans uppercase tracking-widest text-zinc-400 mb-2 font-semibold flex items-center gap-1">
            <span>Next</span>
            <ArrowRight className="w-3 h-3 text-zinc-400" />
          </span>
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm">
            <GuitarChordDiagram chord={nextChord} size="lg" showTitle={true} theme="monochrome" />
          </div>
        </div>
      ) : (
        <div className="hidden sm:block w-28 h-36" />
      )}
    </div>
  );
};
