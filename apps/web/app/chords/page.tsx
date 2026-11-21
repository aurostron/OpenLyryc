'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { SEEDED_CHORD_SONGS, getSeededSongByIdOrSlug, ChordSongConfig } from '@/lib/data/chordsData';
import { ChordsSearchHero } from '@/components/chords/ChordsSearchHero';
import { ChordsPlayerView } from '@/components/chords/ChordsPlayerView';
import { BackgroundConfig, DEFAULT_BG_CONFIG } from '@/components/lyrics/BackgroundCustomizerModal';
import { analyzeChordAudio } from '@/lib/chords/analyzerClient';
import { makeGeneratedSong, GeneratedChordAnalysis } from '@/lib/chords/analysis';
import { ChordAnalysisProgress } from '@/lib/chords/analysis';

const BG_STORAGE_KEY = 'openlyryc_chords_bg_config';

function ChordsPageContent() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get('id') || searchParams.get('track') || searchParams.get('slug') || '';
  const qParam = searchParams.get('q') || searchParams.get('query') || '';
  const ytParam = searchParams.get('yt') || null;

  const [bgConfig, setBgConfig] = useState<BackgroundConfig>(DEFAULT_BG_CONFIG);
  const [selectedSong, setSelectedSong] = useState<ChordSongConfig | null>(null);
  const [generatedAnalysis, setGeneratedAnalysis] = useState<GeneratedChordAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState<ChordAnalysisProgress | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyzeFile = async (file: File) => {
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalyzeProgress({ stage: 'decoding', progress: 0, message: 'Starting…' });
    try {
      const analysis = await analyzeChordAudio(file, {
        onProgress: (p) => setAnalyzeProgress(p),
      });
      setGeneratedAnalysis(analysis);
      setSelectedSong(makeGeneratedSong(analysis));
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem(BG_STORAGE_KEY);
      if (stored) {
        setBgConfig(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleUpdateBgConfig = (newCfg: BackgroundConfig) => {
    setBgConfig(newCfg);
    try {
      localStorage.setItem(BG_STORAGE_KEY, JSON.stringify(newCfg));
    } catch {
      // ignore
    }
  };

  // Resolve song from search query or ID param
  useEffect(() => {
    const targetQuery = idParam || qParam;
    if (targetQuery) {
      const song = getSeededSongByIdOrSlug(targetQuery);
      if (song) {
        setSelectedSong(song);
      }
    }
  }, [idParam, qParam]);

  const handleSearch = (query: string) => {
    const song = getSeededSongByIdOrSlug(query);
    if (song) {
      setSelectedSong(song);
    } else {
      // Fallback to first available chord sheet if query is not in catalog
      setSelectedSong(SEEDED_CHORD_SONGS[0]);
    }
  };

  if (generatedAnalysis && selectedSong) {
    return (
      <ChordsPlayerView
        song={selectedSong}
        bgConfig={bgConfig}
        onUpdateBgConfig={handleUpdateBgConfig}
        onBackToSearch={() => {
          if (generatedAnalysis.audioUrl) URL.revokeObjectURL(generatedAnalysis.audioUrl);
          setGeneratedAnalysis(null);
          setSelectedSong(null);
        }}
        onSelectSong={(s) => setSelectedSong(s)}
        analysis={generatedAnalysis}
      />
    );
  }

  if (!selectedSong) {
    return (
      <div className="relative">
        <ChordsSearchHero
          onSelectSong={(song) => setSelectedSong(song)}
          onSearch={handleSearch}
        />
        {/* -- Analyze audio file entry point ------------------------------- */}
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
          {analyzeError && (
            <div className="max-w-xs px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
              {analyzeError}
            </div>
          )}
          {analyzing && analyzeProgress && (
            <div className="px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-xs backdrop-blur">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
                <span>{analyzeProgress.message} ({Math.round(analyzeProgress.progress * 100)}%)</span>
              </div>
            </div>
          )}
          <button
            type="button"
            disabled={analyzing}
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-semibold shadow-lg transition-colors cursor-pointer"
          >
            {analyzing ? 'Analyzing…' : 'Analyze audio file'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleAnalyzeFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <ChordsPlayerView
      song={selectedSong}
      initialYoutubeId={ytParam}
      bgConfig={bgConfig}
      onUpdateBgConfig={handleUpdateBgConfig}
      onBackToSearch={() => setSelectedSong(null)}
      onSelectSong={(s) => setSelectedSong(s)}
    />
  );
}

export default function ChordsPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-4 font-sans">
          <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
          <p className="text-xs font-medium tracking-wide text-emerald-300">Loading Guitar Chords…</p>
        </div>
      }
    >
      <ChordsPageContent />
    </Suspense>
  );
}
