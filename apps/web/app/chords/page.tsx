'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SEEDED_CHORD_SONGS, getSeededSongByIdOrSlug, ChordSongConfig } from '@/lib/data/chordsData';
import { ChordsSearchHero } from '@/components/chords/ChordsSearchHero';
import { ChordsPlayerView } from '@/components/chords/ChordsPlayerView';
import { BackgroundConfig, DEFAULT_BG_CONFIG } from '@/components/lyrics/BackgroundCustomizerModal';

const BG_STORAGE_KEY = 'openlyryc_chords_bg_config';

function ChordsPageContent() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get('id') || searchParams.get('track') || searchParams.get('slug') || '';
  const qParam = searchParams.get('q') || searchParams.get('query') || '';
  const ytParam = searchParams.get('yt') || null;

  const [bgConfig, setBgConfig] = useState<BackgroundConfig>(DEFAULT_BG_CONFIG);
  const [selectedSong, setSelectedSong] = useState<ChordSongConfig | null>(null);

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

  if (!selectedSong) {
    return (
      <ChordsSearchHero
        onSelectSong={(song) => setSelectedSong(song)}
        onSearch={handleSearch}
      />
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
