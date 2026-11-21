import type { LyricLine } from '@/types/lyrics';
import type { RendererViewMode } from '@/types/editor';
import type { ColorPalette } from '@/lib/colorExtractor';

/**
 * OpenLyryc Visuals (.ovis) Specification v1.0
 * Standard interface for self-hosted modular lyric renderers.
 */

export type OvisControlFieldType = 'slider' | 'toggle' | 'select' | 'color';

export interface OvisControlField {
  key: string;
  label: string;
  type: OvisControlFieldType;
  min?: number;
  max?: number;
  step?: number;
  default: any;
  options?: Array<{ label: string; value: string | number }>;
}

export interface OvisManifest {
  schemaVersion: '1.0';
  id: RendererViewMode;
  name: string;
  version: string;
  author: string;
  description: string;
  icon: string;
  capabilities: {
    wordSync: boolean;
    stageFont: boolean;
    customPalette: boolean;
    embedded?: boolean; // True for flow.ovis (bundled core fallback)
    parallax?: boolean;
    webgl?: boolean;
  };
  controls?: OvisControlField[];
}

export interface OvisRenderProps {
  lines: LyricLine[];
  currentTime: number;
  isPlaying?: boolean;
  songTitle?: string;
  artistName?: string;
  coverArt?: string;
  onSeek?: (time: number) => void;
  stageStyle?: React.CSSProperties;
  palette?: ColorPalette | null;
  settings?: Record<string, any>;
  onUpdateSettings?: (patch: Record<string, any>) => void;
}

export interface OvisModule {
  manifest: OvisManifest;
  default: React.ComponentType<OvisRenderProps>;
}
