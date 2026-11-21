import type { OvisManifest } from '@/types/ovis';
import type { RendererViewMode } from '@/types/editor';

/**
 * Official Registry of OpenLyryc Visuals (.ovis)
 * Captures metadata, capabilities, and dynamic control schemas for all 8 visualizers.
 */
export const OVIS_MANIFESTS: Record<RendererViewMode, OvisManifest> = {
  flow: {
    schemaVersion: '1.0',
    id: 'flow',
    name: 'Dynamic Flow',
    version: '1.0.0',
    author: 'OpenLyryc',
    description: 'Chronological kinetic scrolling view with 3D depth, syllable wipe, and audio-synced punctuation glide.',
    icon: 'waves',
    capabilities: {
      wordSync: true,
      stageFont: true,
      customPalette: true,
      embedded: true, // Bundled inside core studio for zero-latency fallback
    },
  },
  stage: {
    schemaVersion: '1.0',
    id: 'stage',
    name: 'Stage Focus',
    version: '1.0.0',
    author: 'OpenLyryc',
    description: 'Minimalist centered active line with soft volumetric backlight and single-line karaoke focus.',
    icon: 'center_focus_strong',
    capabilities: {
      wordSync: true,
      stageFont: true,
      customPalette: false,
    },
  },
  kinetic: {
    schemaVersion: '1.0',
    id: 'kinetic',
    name: 'Kinetic Type',
    version: '1.0.0',
    author: 'OpenLyryc',
    description: 'High-energy typography poster with punchy word animations and variable weight transforms.',
    icon: 'view_agenda',
    capabilities: {
      wordSync: true,
      stageFont: true,
      customPalette: true,
    },
  },
  editorial: {
    schemaVersion: '1.0',
    id: 'editorial',
    name: 'Editorial Stack',
    version: '1.0.0',
    author: 'OpenLyryc',
    description: 'Magazine-style typography layout with multi-column text wrap and editorial spacing.',
    icon: 'auto_stories',
    capabilities: {
      wordSync: false,
      stageFont: true,
      customPalette: true,
    },
    controls: [
      {
        key: 'maxLines',
        label: 'Max Lines',
        type: 'slider',
        min: 2,
        max: 8,
        step: 1,
        default: 4,
      },
      {
        key: 'cleanLyrics',
        label: 'Clean Lyrics',
        type: 'toggle',
        default: true,
      },
      {
        key: 'wordsPerRow',
        label: 'Words Per Row',
        type: 'slider',
        min: 3,
        max: 12,
        step: 1,
        default: 6,
      },
    ],
  },
  alve: {
    schemaVersion: '1.0',
    id: 'alve',
    name: 'Alve Town',
    version: '1.0.0',
    author: 'OpenLyryc',
    description: 'Isometric pixel townscape reacting to lyric rhythm and ambient song tone.',
    icon: 'location_city',
    capabilities: {
      wordSync: true,
      stageFont: true,
      customPalette: true,
      parallax: true,
    },
    controls: [
      {
        key: 'dayNight',
        label: 'Day / Night Cycle',
        type: 'toggle',
        default: true,
      },
      {
        key: 'animation',
        label: 'Ambient Motion',
        type: 'toggle',
        default: true,
      },
      {
        key: 'dim',
        label: 'Town Dimming',
        type: 'slider',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.3,
      },
    ],
  },
  peak: {
    schemaVersion: '1.0',
    id: 'peak',
    name: 'Mountain Peak',
    version: '1.0.0',
    author: 'OpenLyryc',
    description: 'Serene mountain landscape with atmospheric depth of field and elevation perspective.',
    icon: 'terrain',
    capabilities: {
      wordSync: true,
      stageFont: true,
      customPalette: true,
      parallax: true,
    },
    controls: [
      {
        key: 'fontSize',
        label: 'Font Size',
        type: 'slider',
        min: 24,
        max: 96,
        step: 2,
        default: 48,
      },
      {
        key: 'parallax',
        label: 'Parallax Motion',
        type: 'toggle',
        default: true,
      },
    ],
  },
  colors: {
    schemaVersion: '1.0',
    id: 'colors',
    name: 'Colors Mode',
    version: '1.0.0',
    author: 'OpenLyryc',
    description: 'Bold chromatic color-blocking and pulsating color field synced to song BPM and beat divisions.',
    icon: 'palette',
    capabilities: {
      wordSync: false,
      stageFont: true,
      customPalette: true,
    },
    controls: [
      {
        key: 'beatDivision',
        label: 'Beat Division',
        type: 'select',
        default: '4',
        options: [
          { label: 'Every Beat (1/1)', value: '1' },
          { label: 'Every 2 Beats (1/2)', value: '2' },
          { label: 'Every 4 Beats (1/4)', value: '4' },
          { label: 'Every 8 Beats (1/8)', value: '8' },
        ],
      },
      {
        key: 'fontSize',
        label: 'Scale Multiplier',
        type: 'slider',
        min: 0.6,
        max: 2.0,
        step: 0.1,
        default: 1.0,
      },
    ],
  },
  flythrough: {
    schemaVersion: '1.0',
    id: 'flythrough',
    name: '3D Flythrough',
    version: '1.0.0',
    author: 'OpenLyryc',
    description: 'Full 3D camera warp passing through suspended typographic space and starfield clusters.',
    icon: 'flight_takeoff',
    capabilities: {
      wordSync: true,
      stageFont: true,
      customPalette: true,
      webgl: true,
    },
  },
};

export const OVIS_ORDER: RendererViewMode[] = [
  'flow',
  'stage',
  'kinetic',
  'editorial',
  'peak',
  'colors',
  'flythrough',
];
