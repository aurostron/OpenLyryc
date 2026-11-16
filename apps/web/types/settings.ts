export type FramerateTarget = 'max' | '60' | '30';
export type VideoDisplayMode = 'pip' | 'backdrop';
export type VideoQualityPreference = 'default' | 'hd1080' | 'hd720' | 'large' | 'medium' | 'small';
export type AlveTimeMode = 'real' | 'cycle';
export type AppBackdropFit = 'cover' | 'contain' | 'fill';
export type AppBackdropType = 'auto' | 'image' | 'video';
export type ColorsBeatDivision = '1' | '2' | '4' | 'drums' | 'line' | 'alternate';

export interface AppSettings {
  framerateTarget: FramerateTarget;
  showFpsCounter: boolean;
  hardwareAcceleration: boolean;
  kineticScroll: boolean;
  videoDisplayMode: VideoDisplayMode;
  videoBackdropOpacity: number; // 0.10 to 0.90 (e.g. 0.35)
  videoBackdropBlur: number; // 0 to 24px (e.g. 0, 4, 12)
  videoQualityPreference: VideoQualityPreference;
  enableTimelineEditor: boolean; // Hidden feature: default false
  editorialMaxLines: number; // 1 (Horizontal Single Row), 2, 3, 4, 5, or 99 (tower). Default: 4
  editorialCleanLyrics: boolean; // Clean lyrics toggle: strips commas, periods, quotes for editorial typography
  editorialWordsPerRow?: number; // In 1 Row mode: 0 (Sentence / Auto), 4, 5, 6, 8. Default: 0
  stageFontFamily?: string; // Stage lyric font id from STAGE_FONT_OPTIONS. Default: 'default' (each mode keeps its designed font)
  stageFontWeight?: string; // 'auto' (mode default) or '100'..'900'. Default: 'auto'
  interfaceFontFamily?: string; // Studio UI font id from INTERFACE_FONT_OPTIONS. Default: 'geist' (Geist, bundled). Studio only — never affects lyric renderers.
  stageFontSize?: number; // 0.7..1.6 text size scale. Default: 1
  stageTextX?: number; // -40..40 percent horizontal position offset from center. Default: 0
  stageTextY?: number; // 5..35 percent vertical position from top. Default: 16
  alveDayNight?: boolean; // Time-of-day scene grading (lively-alve port). Default: true
  alveAnimation?: boolean; // Animated GIF layers (CPU heavy, lively default off). Default: true
  alveDim?: number; // 0..0.8 legibility veil over the scene. Default: 0.25
  alveTimeMode?: AlveTimeMode; // 'real' follows local time; 'cycle' loops a full day. Default: 'cycle'
  alveFontSize?: number; // 0.6..1.6 scale multiplier on the native billboard size. Default: 1
  peakTextX?: number; // -40..40 percent horizontal position offset. Default: 0
  peakTextY?: number; // 5..35 percent from top. Default: 16
  peakFontSize?: number; // 0.7..1.6 scale. Default: 1
  peakParallax?: boolean; // Deprecated. Default: false
  peakWordsPerChunk?: number; // 3 or 4 words max. Default: 4
  appBackdropUrl?: string; // Global Studio backdrop (URL, data URL, or session blob URL). Default: ''
  appBackdropType?: AppBackdropType; // 'auto' | 'image' | 'video'. Default: 'auto'
  appBackdropDim?: number; // 0..0.9 black veil over the backdrop. Default: 0.6
  appBackdropBlur?: number; // 0..24 backdrop blur px. Default: 10
  appBackdropFit?: AppBackdropFit; // cover / contain / fill. Default: 'cover'
  colorsBeatDivision?: ColorsBeatDivision; // '4' (default 4/4 1 bar), '2' (2/4), '1' (1/4), 'drums' (kick/snare), 'line', 'alternate'
  colorsFontFamily?: string; // Stage Colors lyric font id from STAGE_FONT_OPTIONS. Default: 'anton' (Colors designed display font)
  colorsFontSize?: number; // 0.6..1.6 scale on the dynamic Colors lyric font fit. Default: 1 (auto-fit)
  breakIntervalMinutes: number; // 10 to 60 minutes. Default: 30. Always-on mindful screentime break rule.
}

export const DEFAULT_SETTINGS: AppSettings = {
  framerateTarget: '60', // Default 60Hz: React state emits capped at 16.6ms. 'max' also capped (see useAudioClock) to avoid 120Hz re-render storms.
  showFpsCounter: false,
  hardwareAcceleration: true,
  kineticScroll: true,
  videoDisplayMode: 'pip', // 'pip' (floating window) or 'backdrop' (cinematic canvas background)
  videoBackdropOpacity: 0.35,
  videoBackdropBlur: 0,
  videoQualityPreference: 'default', // 'default' (Auto), 'hd1080', 'hd720', 'large', 'medium', 'small'
  enableTimelineEditor: false, // Hidden by default, activated in settings
  editorialMaxLines: 4,
  editorialCleanLyrics: true,
  editorialWordsPerRow: 4,
  stageFontFamily: 'poppins',
  stageFontWeight: '500',
  interfaceFontFamily: 'geist',
  stageFontSize: 1,
  stageTextX: 0,
  stageTextY: 16,
  alveDayNight: true,
  alveAnimation: true,
  alveDim: 0.25,
  alveTimeMode: 'cycle',
  alveFontSize: 1,
  peakTextX: 0,
  peakTextY: 16,
  peakFontSize: 1,
  peakParallax: false,
  peakWordsPerChunk: 4,
  appBackdropUrl: '',
  appBackdropType: 'auto',
  appBackdropDim: 0.6,
  appBackdropBlur: 10,
  appBackdropFit: 'cover',
  colorsBeatDivision: '4',
  colorsFontFamily: 'anton',
  colorsFontSize: 1,
  breakIntervalMinutes: 30,
};
