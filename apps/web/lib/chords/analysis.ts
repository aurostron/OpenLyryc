// Contracts for a generated chord analysis. These intentionally reuse the existing
// SyncedChordFrame type from beatSyncEngine.ts so the existing animation path
// (getActiveChordFrame, carousel, guitar diagram) works unchanged.

import type { SyncedChordFrame } from './beatSyncEngine';
import { ChordSongConfig } from '@/lib/data/chordsData';

// Stub song config for a generated analysis (so ChordsPlayerView's existing
// code paths that reference `song` keep working). Real metadata is on the
// GeneratedChordAnalysis; this is just a placeholder.
export function makeGeneratedSong(analysis: GeneratedChordAnalysis): ChordSongConfig {
  return {
    id: `generated-${analysis.title}`,
    slug: `generated-${analysis.title}`,
    title: analysis.title,
    artist: 'Generated',
    coverArt: '',
    bpm: 120,
    timeSignature: [4, 4],
    chordsUsed: [],
    chordAnnotations: [],
  };
}

export interface AnalysisRow {
  index: number;
  startTime: number;
  endTime: number;
  label: string; // "Intro", "Verse 1", "Chorus", ...
  tokens?: Array<{ time: number; chord: string; duration?: number }>;
}

export interface GeneratedChordAnalysis {
  title: string;
  audioUrl: string; // object URL, revoked on unmount
  duration: number;
  frames: SyncedChordFrame[];
  rows: AnalysisRow[];
  meta: {
    backend: 'wasm' | 'webgpu';
    modelId: string;
    frameDuration: number;
    analysedMs: number;
    meanFeature: number;
    stdFeature: number;
  };
}

// Progress events mirror packages/ai-aligner's alignerClient shape.
export type ChordAnalysisStage =
  | 'decoding'
  | 'resampling'
  | 'cqt'
  | 'inferring'
  | 'smoothing'
  | 'done';

export interface ChordAnalysisProgress {
  stage: ChordAnalysisStage;
  progress: number; // 0..1
  message: string;
}
